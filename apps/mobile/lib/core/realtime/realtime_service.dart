import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api/models/notification.dart';
import '../auth/auth_controller.dart';
import '../config/api_config.dart';

/// Événements temps réel de haut niveau émis par le [RealtimeService] et
/// consommés par l'app (badge, écran notifs, carte).
sealed class RealtimeEvent {
  const RealtimeEvent();
}

/// Une notification vient d'arriver (event socket 'notification.created').
class NotificationRecue extends RealtimeEvent {
  const NotificationRecue({required this.notification, required this.unreadCount});

  final AppNotification notification;
  final int unreadCount;
}

/// La carte doit se rafraîchir (event socket 'map.updated').
class CarteAMettreAJour extends RealtimeEvent {
  const CarteAMettreAJour();
}

/// Un message de conversation vient d'arriver (event socket 'message.created',
/// CP2.3) : `unreadConversations` est le badge ABSOLU du serveur, `message`
/// reste un Map brut décodé par la feature messages (le core ne dépend pas de
/// ses modèles).
class MessageRecu extends RealtimeEvent {
  const MessageRecu({
    required this.conversationId,
    required this.message,
    required this.unreadConversations,
  });

  final String conversationId;
  final Map<String, dynamic> message;
  final int unreadConversations;
}

/// Service temps réel socket.io — canal MINIMAL du Lot 1 (pas de messagerie).
///
/// Connexion au namespace par défaut de l'API avec le jeton d'accès dans
/// `auth.token` (vérifié au handshake côté serveur). Reconnexion automatique
/// gérée par socket.io. Le service N'EST PAS une source de vérité : c'est un
/// CONFORT. Le badge et les listes restent alimentés par REST ; le POLLING de
/// repli (voir realtime_bridge.dart) prend le relais quand le socket est
/// indisponible.
///
/// Le service expose un [Stream] d'[RealtimeEvent] : les contrôleurs Riverpod
/// s'y abonnent sans dépendre du transport socket.io.
class RealtimeService {
  // Le paramètre public garde un nom sans underscore (API du service) ;
  // l'affectation au champ privé est donc explicite plutôt qu'un formal.
  // ignore: prefer_initializing_formals
  RealtimeService({required TokenLecteur lireJeton}) : _lireJeton = lireJeton;

  /// Fournit le jeton d'accès courant au moment de (re)connexion.
  final TokenLecteur _lireJeton;

  io.Socket? _socket;
  final StreamController<RealtimeEvent> _evenements =
      StreamController<RealtimeEvent>.broadcast();

  /// Flux des événements temps réel décodés.
  Stream<RealtimeEvent> get evenements => _evenements.stream;

  /// Vrai quand le socket est effectivement connecté (pilote la bascule
  /// vers/depuis le polling de repli).
  bool get connecte => _socket?.connected ?? false;

  /// Ouvre (ou ré-ouvre) la connexion avec le jeton courant. Idempotent : une
  /// connexion déjà active est d'abord fermée pour repartir proprement (jeton
  /// rafraîchi après reconnexion de session).
  Future<void> connecter() async {
    final String? token = await _lireJeton();
    if (token == null || token.isEmpty) {
      return;
    }
    await deconnecter();

    final socket = io.io(
      ApiConfig.baseUrl,
      io.OptionBuilder()
          // WebSocket direct : évite le polling XHR long (plus fiable en émulateur).
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(10000)
          // Auth au HANDSHAKE : le serveur lit handshake.auth.token.
          .setAuth({'token': token})
          .build(),
    );

    socket.onConnect((_) {
      // La carte s'abonne aux rafraîchissements légers côté serveur.
      socket.emit('map.subscribe');
      if (kDebugMode) {
        debugPrint('[realtime] connecté');
      }
    });
    // Avant CHAQUE tentative de reconnexion auto, on relit le jeton courant
    // depuis le stockage et on met à jour l'auth du handshake : sinon socket.io
    // rejouerait le jeton figé à la première connexion et bouclerait en rejets
    // dès que l'access token a expiré. Le fallback polling reste le filet.
    //
    // NB : l'événement 'reconnect_attempt' est émis par le MANAGER (socket.io),
    // pas par le socket lui-même ; on l'écoute donc sur `socket.io`. Le champ
    // `socket.auth` est relu par le handshake (onopen → sendConnectPacket),
    // qui n'a lieu qu'après l'ouverture réseau du transport — donc bien après
    // cette lecture locale du jeton.
    socket.io.on('reconnect_attempt', (_) async {
      final String? frais = await _lireJeton();
      if (frais != null && frais.isNotEmpty) {
        socket.auth = {'token': frais};
      }
      if (kDebugMode) {
        debugPrint('[realtime] reconnexion : jeton rafraîchi');
      }
    });
    socket.onDisconnect((_) {
      if (kDebugMode) {
        debugPrint('[realtime] déconnecté');
      }
    });
    socket.onConnectError((erreur) {
      if (kDebugMode) {
        debugPrint('[realtime] erreur de connexion : $erreur');
      }
    });

    socket.on('notification.created', _surNotification);
    socket.on('map.updated', _surCarte);
    socket.on('message.created', _surMessage);

    _socket = socket;
    socket.connect();
  }

  /// Ferme la connexion (déconnexion de l'utilisateur, changement de jeton).
  Future<void> deconnecter() async {
    final socket = _socket;
    if (socket == null) {
      return;
    }
    _socket = null;
    try {
      socket.clearListeners();
      socket.dispose();
    } catch (_) {
      // Fermeture au mieux : ne jamais casser le flux de déconnexion.
    }
  }

  /// Libère le service (fin de vie du provider).
  Future<void> disposer() async {
    await deconnecter();
    await _evenements.close();
  }

  /// Décode 'notification.created' → { notification: NOTIFICATION, unreadCount }.
  void _surNotification(dynamic data) {
    if (data is! Map) {
      return;
    }
    final dynamic brut = data['notification'];
    if (brut is! Map) {
      return;
    }
    try {
      final notif = AppNotification.fromJson(
        brut.cast<String, dynamic>(),
      );
      final int unread = (data['unreadCount'] as num?)?.toInt() ?? 0;
      _emettre(
        NotificationRecue(notification: notif, unreadCount: unread),
      );
    } catch (_) {
      // Charge utile inattendue : on ignore l'événement (le REST resynchronise).
    }
  }

  /// Décode 'map.updated' → { reason }. Le contenu importe peu : le client
  /// recharge ses marqueurs.
  void _surCarte(dynamic data) {
    _emettre(const CarteAMettreAJour());
  }

  /// Décode 'message.created' (CP2.3) →
  /// { conversationId, message: MESSAGE, unreadConversations }.
  void _surMessage(dynamic data) {
    if (data is! Map) {
      return;
    }
    final dynamic conversationId = data['conversationId'];
    final dynamic message = data['message'];
    if (conversationId is! String || message is! Map) {
      return;
    }
    _emettre(
      MessageRecu(
        conversationId: conversationId,
        message: message.cast<String, dynamic>(),
        unreadConversations: (data['unreadConversations'] as num?)?.toInt() ?? 0,
      ),
    );
  }

  void _emettre(RealtimeEvent evenement) {
    if (!_evenements.isClosed) {
      _evenements.add(evenement);
    }
  }
}

/// Lecteur asynchrone du jeton d'accès courant.
typedef TokenLecteur = Future<String?> Function();

/// Service temps réel unique de l'application. Il vit tant que le provider est
/// gardé en vie (par le bridge) — la (dé)connexion effective suit l'état
/// d'authentification.
final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final service = RealtimeService(lireJeton: tokenStorage.readAccessToken);
  ref.onDispose(service.disposer);
  return service;
});

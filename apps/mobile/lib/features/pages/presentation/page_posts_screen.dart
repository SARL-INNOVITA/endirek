import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/feed_post.dart';
import '../../../core/theme/endirek_theme.dart';
import '../../feed/presentation/widgets/post_card.dart';
import '../data/pages_repository.dart';

/// Liste COMPLÈTE des publications d'une page (/pages/:id/posts —
/// « Voir tout » de l'écran de page) : cartes du fil réutilisées, pagination
/// offset/limit en infinite scroll + tirer-pour-rafraîchir, mêmes états
/// vide/erreur/chargement que le fil.
class PagePostsScreen extends ConsumerStatefulWidget {
  const PagePostsScreen({super.key, required this.pageId});

  final String pageId;

  @override
  ConsumerState<PagePostsScreen> createState() => _PagePostsScreenState();
}

class _PagePostsScreenState extends ConsumerState<PagePostsScreen> {
  static const int _taillePage = 20;

  final ScrollController _defilement = ScrollController();

  List<FeedPost> _posts = [];
  int _total = 0;
  bool _initialise = false;
  bool _chargement = false;
  bool _chargementSuite = false;
  String? _erreur;

  bool get _peutChargerSuite =>
      _initialise && !_chargement && !_chargementSuite && _posts.length < _total;

  @override
  void initState() {
    super.initState();
    _defilement.addListener(_surDefilement);
    _rafraichir();
  }

  @override
  void dispose() {
    _defilement.dispose();
    super.dispose();
  }

  void _surDefilement() {
    if (_defilement.position.pixels >=
        _defilement.position.maxScrollExtent - 400) {
      _chargerSuite();
    }
  }

  Future<void> _rafraichir() async {
    setState(() {
      _chargement = true;
      _erreur = null;
    });
    try {
      final page = await ref
          .read(pagesRepositoryProvider)
          .chargerPostsDePage(widget.pageId, limit: _taillePage);
      if (!mounted) {
        return;
      }
      setState(() {
        _posts = page.items;
        _total = page.total;
        _initialise = true;
        _chargement = false;
      });
    } on ApiException catch (erreur) {
      if (!mounted) {
        return;
      }
      setState(() {
        _chargement = false;
        _erreur = erreur.message;
      });
    }
  }

  /// Page suivante — silencieux en cas d'erreur réseau (comme le fil).
  Future<void> _chargerSuite() async {
    if (!_peutChargerSuite) {
      return;
    }
    setState(() => _chargementSuite = true);
    try {
      final page = await ref.read(pagesRepositoryProvider).chargerPostsDePage(
            widget.pageId,
            limit: _taillePage,
            offset: _posts.length,
          );
      if (!mounted) {
        return;
      }
      final Set<String> connus = {for (final p in _posts) p.id};
      setState(() {
        _posts = [..._posts, ...page.items.where((p) => !connus.contains(p.id))];
        _total = page.total;
        _chargementSuite = false;
      });
    } on ApiException {
      if (mounted) {
        setState(() => _chargementSuite = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Publications')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: _rafraichir,
          child: _contenu(),
        ),
      ),
    );
  }

  Widget _contenu() {
    if (_chargement && !_initialise) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_erreur != null && _posts.isEmpty) {
      return _EtatMessage(
        icone: Icons.wifi_off_outlined,
        message: _erreur!,
        actionLibelle: 'Réessayer',
        surAction: _rafraichir,
      );
    }
    if (_initialise && _posts.isEmpty) {
      return const _EtatMessage(
        icone: Icons.forum_outlined,
        message: 'Cette page n\'a encore rien publié.',
      );
    }
    return ListView.builder(
      controller: _defilement,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      itemCount: _posts.length + 1,
      itemBuilder: (context, index) {
        if (index < _posts.length) {
          return PostCard(post: _posts[index]);
        }
        if (_chargementSuite) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ),
          );
        }
        return const SizedBox(height: 8);
      },
    );
  }
}

/// État centré (vide / erreur) dans un ListView pour garder le
/// tirer-pour-rafraîchir.
class _EtatMessage extends StatelessWidget {
  const _EtatMessage({
    required this.icone,
    required this.message,
    this.actionLibelle,
    this.surAction,
  });

  final IconData icone;
  final String message;
  final String? actionLibelle;
  final VoidCallback? surAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 96, 32, 0),
          child: Column(
            children: [
              Icon(icone, size: 44, color: EndirekColors.encreSecondaire),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
              if (actionLibelle != null)
                TextButton.icon(
                  onPressed: surAction,
                  icon: const Icon(Icons.refresh),
                  label: Text(actionLibelle!),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

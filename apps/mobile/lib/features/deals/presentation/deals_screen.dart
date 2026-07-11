import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/endirek_theme.dart';
import '../application/deal_providers.dart';
import '../domain/deal_models.dart';

/// LISTE « Mes deals » (/deals — CP2.4) : cartes triées par activité —
/// numéro, statut, partenaire, annonce, résumé de l'échange. Tap → page de
/// deal. Accessible depuis le volet Profil Dealplace et les notifications.
class DealsScreen extends ConsumerWidget {
  const DealsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deals = ref.watch(mesDealsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mes deals')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(mesDealsProvider),
          child: switch (deals) {
            AsyncData(:final value) when value.items.isEmpty => ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.fromLTRB(32, 96, 32, 0),
                    child: Column(
                      children: [
                        Icon(Icons.handshake_outlined,
                            size: 40, color: EndirekColors.encreSecondaire),
                        SizedBox(height: 12),
                        Text(
                          'Aucun deal pour le moment.\nProposez un deal '
                          'depuis une annonce du Dealplace !',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: EndirekColors.encreSecondaire,
                            fontSize: 14,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            AsyncData(:final value) => ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                itemCount: value.items.length,
                itemBuilder: (context, index) =>
                    _CarteDeal(deal: value.items[index]),
              ),
            AsyncError() => ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(32, 96, 32, 0),
                    child: Column(
                      children: [
                        const Text(
                          'Impossible de charger vos deals.',
                          style: TextStyle(
                            color: EndirekColors.encreSecondaire,
                            fontSize: 14,
                          ),
                        ),
                        TextButton(
                          onPressed: () => ref.invalidate(mesDealsProvider),
                          child: const Text('Réessayer'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            _ => const Center(child: CircularProgressIndicator()),
          },
        ),
      ),
    );
  }
}

class _CarteDeal extends StatelessWidget {
  const _CarteDeal({required this.deal});

  final DealCard deal;

  @override
  Widget build(BuildContext context) {
    final (String statut, Color couleur) = switch (deal.status) {
      'proposed' => ('Proposé', EndirekColors.bleu),
      'active' => ('En cours', EndirekColors.bleu),
      'completed' => ('Conclu', const Color(0xFF16A34A)),
      'declined' => ('Refusé', const Color(0xFFB3261E)),
      'cancelled' => ('Annulé', EndirekColors.encreSecondaire),
      'disputed' => ('Litige', const Color(0xFFB3261E)),
      _ => (deal.status, EndirekColors.encreSecondaire),
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/deals/${deal.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'Deal ${deal.dealNumber}',
                    style: const TextStyle(
                      color: EndirekColors.encre,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '· avec ${deal.otherParticipant.displayName}',
                    style: const TextStyle(
                      color: EndirekColors.encreSecondaire,
                      fontSize: 12.5,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    statut,
                    style: TextStyle(
                      color: couleur,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      deal.myOfferSummary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(Icons.swap_horiz,
                        size: 18, color: EndirekColors.bleu),
                  ),
                  Expanded(
                    child: Text(
                      deal.theirOfferSummary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                deal.listing.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: EndirekColors.encreSecondaire,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

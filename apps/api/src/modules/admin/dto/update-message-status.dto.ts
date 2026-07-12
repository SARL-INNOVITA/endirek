import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MessageStatus } from '../../../database/domain/entities';

/** Statuts posables par la modération sur un message (D67 — pas de
 * 'deleted' : les messages ne sont ni éditables ni supprimables, D63). */
const SETTABLE_MESSAGE_STATUSES: MessageStatus[] = ['active', 'hidden'];

/**
 * Corps de PATCH /admin/dealplace/messages/:id/status (CP2.5 — D67) :
 * masquer (« hidden ») ou réactiver (« active ») un message. Idempotent.
 */
export class UpdateMessageStatusDto {
  @ApiProperty({
    description:
      '« hidden » : le corps du message est masqué aux participants ' +
      '(placeholder « Message masqué par la modération. ») ; « active » : ' +
      'le message redevient visible',
    enum: SETTABLE_MESSAGE_STATUSES,
  })
  @IsIn(SETTABLE_MESSAGE_STATUSES, {
    message: 'Le statut doit être « active » ou « hidden »',
  })
  status!: MessageStatus;
}

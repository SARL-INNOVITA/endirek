import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  FullProfile,
  PublicProfile,
} from '../../common/mappers/profile.mapper';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  AccountExport,
  PagedPublicProfiles,
  UsersService,
} from './users.service';

/**
 * Contrôleur utilisateurs — contrat d'API étape 3 (profils, follows,
 * export RGPD, suppression RGPD).
 *
 * TOUTES les routes exigent un jeton (guard JWT global, aucune n'est
 * @Public) ; les routes « me/... » sont déclarées avant « :id » pour ne
 * jamais être capturées par le paramètre dynamique.
 *
 * Deux formes de profil, jamais mélangées :
 * - PROFIL COMPLET (me/profile) : soi-même uniquement ;
 * - PROFIL PUBLIC (:id, :id/followers, :id/following) : jamais
 *   email/settings/role/status.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Mon compte (« me »)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('me/profile')
  @ApiOperation({ summary: "Profil complet de l'utilisateur connecté" })
  @ApiResponse({ status: 200, description: 'Profil complet' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<FullProfile> {
    return this.usersService.getMyProfile(user.userId);
  }

  @Patch('me/profile')
  @ApiOperation({
    summary: 'Mettre à jour mon profil',
    description:
      'Sémantique PATCH : seuls les champs présents dans le corps sont ' +
      'modifiés. Validation : displayName 2-50, bio ≤ 500, city ≤ 80.',
  })
  @ApiResponse({ status: 200, description: 'Profil complet mis à jour' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<FullProfile> {
    return this.usersService.updateMyProfile(user.userId, dto);
  }

  @Get('me/export')
  @Header('Content-Disposition', 'attachment; filename="endirek-export.json"')
  @ApiOperation({
    summary: 'Exporter toutes les données de mon compte (RGPD)',
    description:
      "Droit d'accès et de portabilité (articles 15 et 20 du RGPD) : JSON " +
      'complet du compte — profil, publications, commentaires, réactions, ' +
      'abonnements émis/reçus, collections et enregistrements, ' +
      'notifications, signalements émis. Servi en pièce jointe ' +
      '(Content-Disposition: attachment).',
  })
  @ApiResponse({ status: 200, description: 'Export JSON complet du compte' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  exportMyData(@CurrentUser() user: AuthenticatedUser): Promise<AccountExport> {
    return this.usersService.exportMyData(user.userId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer mon compte (RGPD — soft-delete + anonymisation)',
    description:
      'Le compte est anonymisé (nom « Utilisateur supprimé », email ' +
      'technique, photos/ville/position effacées) puis marqué supprimé. ' +
      'Les publications et commentaires sont CONSERVÉS avec un auteur ' +
      'anonymisé — le fil ne casse pas. Les jetons existants cessent de ' +
      'fonctionner immédiatement : le statut du compte est revérifié à ' +
      'chaque requête.',
  })
  @ApiResponse({ status: 204, description: 'Compte supprimé' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  async deleteMyAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.deleteMyAccount(user.userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Profils publics et follows (« :id »)
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: "Profil public d'un utilisateur",
    description:
      'Forme PUBLIQUE uniquement (jamais email, settings, role ni status). ' +
      '404 si le compte n’existe pas, est supprimé ou est suspendu.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Profil public' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  getPublicProfile(@Param('id') id: string): Promise<PublicProfile> {
    return this.usersService.getPublicProfile(id);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Suivre un utilisateur',
    description:
      'Idempotent : suivre un compte déjà suivi ne change rien (204). Les ' +
      'compteurs followers/following sont tenus à jour.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur à suivre" })
  @ApiResponse({ status: 204, description: 'Suivi effectif' })
  @ApiResponse({ status: 400, description: 'Impossible de se suivre soi-même' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.usersService.follow(user.userId, id);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Ne plus suivre un utilisateur',
    description: 'Idempotent : se désabonner d’un compte non suivi rend 204.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 204, description: 'Désabonnement effectif' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.usersService.unfollow(user.userId, id);
  }

  @Get(':id/followers')
  @ApiOperation({
    summary: "Liste paginée des followers d'un utilisateur",
    description:
      'Profils PUBLICS uniquement, du suivi le plus récent au plus ancien.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: '{ items: profils publics, total }' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  listFollowers(
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedPublicProfiles> {
    return this.usersService.listFollowers(id, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }

  @Get(':id/following')
  @ApiOperation({
    summary: 'Liste paginée des comptes suivis par un utilisateur',
    description:
      'Profils PUBLICS uniquement, du suivi le plus récent au plus ancien.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: '{ items: profils publics, total }' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  listFollowing(
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PagedPublicProfiles> {
    return this.usersService.listFollowing(id, {
      limit: pagination.limit,
      offset: pagination.offset,
    });
  }
}

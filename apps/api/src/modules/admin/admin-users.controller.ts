import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FullProfile } from '../../common/mappers/profile.mapper';
import {
  AdminUsersService,
  PagedFullProfiles,
} from './admin-users.service';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

/**
 * Contrôleur utilisateurs du backoffice — contrat d'API étape 3.
 *
 * Double protection sur TOUT le contrôleur :
 * 1. le guard JWT GLOBAL (AuthModule) authentifie le porteur du jeton
 *    (aucune route n'est @Public) → 401 sans jeton valide ;
 * 2. RolesGuard + @Roles('moderator', 'super_admin') exige un rôle
 *    d'administration → 403 pour un utilisateur simple.
 *
 * Forme renvoyée : PROFIL COMPLET (email, role, status, settings inclus) —
 * réservée aux administrateurs, jamais servie à un tiers ailleurs.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les comptes utilisateurs (backoffice)',
    description:
      'Liste paginée de PROFILS COMPLETS. ?search= filtre sur le nom ' +
      'affiché et l’email (insensible à la casse), ?status= filtre par ' +
      'statut (active, suspended, deleted — les comptes supprimés restent ' +
      'visibles du backoffice pour l’audit).',
  })
  @ApiResponse({ status: 200, description: '{ items: profils complets, total }' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  listUsers(@Query() query: AdminListUsersQueryDto): Promise<PagedFullProfiles> {
    return this.adminUsersService.listUsers({
      search: query.search,
      status: query.status,
      role: query.role,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: "Profil complet d'un compte (backoffice)",
    description:
      'PROFIL COMPLET quel que soit le statut du compte (actif, suspendu ' +
      'ou supprimé) — 404 uniquement si l’identifiant n’existe pas.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Profil complet' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle administrateur requis' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  getUser(@Param('id') id: string): Promise<FullProfile> {
    return this.adminUsersService.getUser(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: "Suspendre ou réactiver un compte (backoffice)",
    description:
      'Statuts posables : « active » et « suspended » UNIQUEMENT — la ' +
      'suppression d’un compte passe par le flux RGPD (DELETE /users/me), ' +
      'jamais par ici. Un compte suspendu ne peut plus se connecter ni ' +
      'utiliser ses jetons (statut revérifié à chaque requête). Le statut ' +
      'd’un super administrateur est intouchable (403).',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Profil complet à jour' })
  @ApiResponse({ status: 400, description: 'Statut invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({
    status: 403,
    description:
      'Rôle administrateur requis, ou cible super administrateur',
  })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Compte supprimé (RGPD) : statut définitif',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<FullProfile> {
    return this.adminUsersService.updateStatus(id, dto.status);
  }
}

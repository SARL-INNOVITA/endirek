import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import {
  AdminPostTypeView,
  AdminPostTypesService,
} from './admin-post-types.service';
import { UpdatePostTypeDto } from './dto/update-post-type.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('moderator', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/post-types')
export class AdminPostTypesController {
  constructor(private readonly service: AdminPostTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les types de posts pilotables (backoffice)',
    description:
      'Retourne tous les types, actifs ou non. GET /posts/types reste public ' +
      'et ne sert que les types actifs au composer mobile.',
  })
  @ApiResponse({ status: 200, description: 'Liste des post_types' })
  list(): Promise<AdminPostTypeView[]> {
    return this.service.list();
  }

  @Patch(':slug')
  @ApiOperation({
    summary: 'Modifier les parametres pilotables d’un type de post',
    description:
      'Le slug est immuable. La duree carte modifiee ne recalcule pas les ' +
      'posts existants ; elle s’applique uniquement aux nouvelles creations.',
  })
  @ApiParam({ name: 'slug', description: 'Slug du type de publication' })
  @ApiResponse({ status: 200, description: 'Type mis a jour' })
  @ApiResponse({ status: 400, description: 'Parametres incoherents' })
  @ApiResponse({ status: 404, description: 'Type introuvable' })
  update(
    @Param('slug') slug: string,
    @Body() dto: UpdatePostTypeDto,
  ): Promise<AdminPostTypeView> {
    return this.service.update(slug, dto);
  }
}

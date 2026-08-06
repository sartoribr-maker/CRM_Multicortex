import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions-catalog')
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  listPermissionCatalog() {
    return this.rolesService.listPermissionCatalog();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  create(@Body() dto: CreateRoleDto, @CurrentUser() currentUser: JwtPayload) {
    return this.rolesService.create(dto, currentUser.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.rolesService.update(id, dto, currentUser.sub);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    await this.rolesService.remove(id, currentUser.sub);
    return { success: true };
  }

  @Put(':id/permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.rolesService.setPermissions(id, dto.permissionKeys, currentUser.sub);
  }
}

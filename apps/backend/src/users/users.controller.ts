import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.create(dto, currentUser.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.update(id, dto, currentUser.sub);
  }

  @Post(':id/deactivate')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.setStatus(id, 'INACTIVE', currentUser.sub);
  }

  @Post(':id/reactivate')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.setStatus(id, 'ACTIVE', currentUser.sub);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    await this.usersService.resetPassword(id, dto.newPassword, currentUser.sub);
    return { success: true };
  }
}

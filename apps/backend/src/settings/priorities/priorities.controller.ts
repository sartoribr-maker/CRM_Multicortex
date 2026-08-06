import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrioritiesService } from './priorities.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { ReorderDto } from '../common/dto/reorder.dto';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@ApiTags('settings/priorities')
@Controller('priorities')
export class PrioritiesController {
  constructor(private readonly prioritiesService: PrioritiesService) {}

  @Get()
  findAll(@Query() query: ListSettingsQueryDto) {
    return this.prioritiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prioritiesService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreatePriorityDto, @CurrentUser() currentUser: JwtPayload) {
    return this.prioritiesService.create(dto, currentUser.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriorityDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.prioritiesService.update(id, dto, currentUser.sub);
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.prioritiesService.archive(id, currentUser.sub);
  }

  @Put('reorder')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  reorder(@Body() dto: ReorderDto, @CurrentUser() currentUser: JwtPayload) {
    return this.prioritiesService.reorder(dto, currentUser.sub);
  }
}

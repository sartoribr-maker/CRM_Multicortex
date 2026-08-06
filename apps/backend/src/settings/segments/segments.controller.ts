import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { SegmentsService } from './segments.service';

@ApiTags('settings/segments')
@Controller('segments')
export class SegmentsController {
  constructor(private readonly service: SegmentsService) {}
  @Get() findAll(@Query() query: ListSettingsQueryDto) {
    return this.service.findAll(query);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateSegmentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSegmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user.sub);
  }
}

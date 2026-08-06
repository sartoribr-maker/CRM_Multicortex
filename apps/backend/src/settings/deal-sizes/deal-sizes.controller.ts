import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DealSizesService } from './deal-sizes.service';
import { CreateDealSizeDto } from './dto/create-deal-size.dto';
import { UpdateDealSizeDto } from './dto/update-deal-size.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@ApiTags('settings/deal-sizes')
@Controller('deal-sizes')
export class DealSizesController {
  constructor(private readonly dealSizesService: DealSizesService) {}

  @Get()
  findAll(@Query() query: ListSettingsQueryDto) {
    return this.dealSizesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dealSizesService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateDealSizeDto, @CurrentUser() currentUser: JwtPayload) {
    return this.dealSizesService.create(dto, currentUser.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealSizeDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.dealSizesService.update(id, dto, currentUser.sub);
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.dealSizesService.archive(id, currentUser.sub);
  }
}

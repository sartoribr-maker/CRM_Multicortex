import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { ListPartnersQueryDto } from './dto/list-partners.query.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@Controller('partners')
export class PartnersController {
  constructor(private readonly service: PartnersService) {}
  @Get() @RequirePermissions(PERMISSIONS.PARTNERS_VIEW) findAll(@Query() query: ListPartnersQueryDto) { return this.service.findAll(query); }
  @Get(':id') @RequirePermissions(PERMISSIONS.PARTNERS_VIEW) findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }
  @Post() @RequirePermissions(PERMISSIONS.PARTNERS_CREATE) create(@Body() dto: CreatePartnerDto, @CurrentUser() user: JwtPayload) { return this.service.create(dto, user.sub); }
  @Patch(':id') @RequirePermissions(PERMISSIONS.PARTNERS_EDIT) update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.sub); }
  @Post(':id/deactivate') @RequirePermissions(PERMISSIONS.PARTNERS_DELETE) deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) { return this.service.setStatus(id, 'INACTIVE', user.sub); }
  @Post(':id/reactivate') @RequirePermissions(PERMISSIONS.PARTNERS_EDIT) reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) { return this.service.setStatus(id, 'ACTIVE', user.sub); }
}

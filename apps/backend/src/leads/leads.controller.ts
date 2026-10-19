import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.query.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AutocompleteLeadsQueryDto } from './dto/autocomplete-leads.query.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { AllowThirdPartyPortal } from '../auth/decorators/allow-third-party-portal.decorator';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  findAll(@Query() query: ListLeadsQueryDto, @CurrentUser() currentUser: JwtPayload) {
    return this.leadsService.findAll(query, currentUser);
  }

  @Get('autocomplete')
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  autocomplete(@Query() query: AutocompleteLeadsQueryDto, @CurrentUser() currentUser: JwtPayload) {
    return this.leadsService.autocomplete(query, currentUser);
  }

  @Get(':id')
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.leadsService.findOne(id, currentUser);
  }

  @Post()
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_CREATE)
  create(@Body() dto: CreateLeadDto, @CurrentUser() currentUser: JwtPayload) {
    return this.leadsService.create(dto, currentUser);
  }

  @Patch(':id')
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.leadsService.update(id, dto, currentUser);
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.LEADS_DELETE)
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    await this.leadsService.archive(id, currentUser);
    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LEADS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    await this.leadsService.remove(id, currentUser);
    return { success: true };
  }

  @Get(':id/activities')
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  listActivities(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.leadsService.listActivities(id, currentUser);
  }

  @Get(':id/stage-history')
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  listStageHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.leadsService.listStageHistory(id, currentUser);
  }

  @Post(':id/comments')
  @AllowThirdPartyPortal()
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.leadsService.addComment(id, dto.message, currentUser);
  }
}

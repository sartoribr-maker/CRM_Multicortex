import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { AllowThirdPartyPortal } from '../auth/decorators/allow-third-party-portal.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { AttendeeSuggestionsQueryDto } from './dto/attendee-suggestions.query.dto';
import { CreateLeadMeetingDto } from './dto/create-lead-meeting.dto';
import { LeadMeetingsService } from './lead-meetings.service';

@ApiTags('calendar')
@Controller()
@AllowThirdPartyPortal()
export class LeadMeetingsController {
  constructor(private readonly service: LeadMeetingsService) {}

  @Get('calendar/config')
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  config() {
    return this.service.config();
  }

  @Get('calendar/attendee-suggestions')
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  attendeeSuggestions(@Query() query: AttendeeSuggestionsQueryDto) {
    return this.service.attendeeSuggestions(query.search);
  }

  @Get('leads/:leadId/meetings')
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  list(@Param('leadId', ParseUUIDPipe) leadId: string, @CurrentUser() user: JwtPayload) {
    return this.service.list(leadId, user);
  }

  @Post('leads/:leadId/meetings')
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  create(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateLeadMeetingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(leadId, dto, user);
  }
}

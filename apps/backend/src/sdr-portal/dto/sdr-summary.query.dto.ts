import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import type { SdrPeriod } from '../sdr-summary';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class SdrSummaryQueryDto {
  @ApiPropertyOptional({ enum: ['today', 'week', 'month', 'custom'], default: 'month' })
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'custom'])
  period: SdrPeriod = 'month';

  @ApiPropertyOptional({ description: 'Início (AAAA-MM-DD, Brasília) quando period=custom' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'from deve estar no formato AAAA-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ description: 'Fim inclusivo (AAAA-MM-DD, Brasília) quando period=custom' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'to deve estar no formato AAAA-MM-DD.' })
  to?: string;
}

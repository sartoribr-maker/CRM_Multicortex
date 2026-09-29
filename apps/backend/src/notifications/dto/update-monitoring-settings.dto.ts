import { IsBoolean, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class UpdateMonitoringSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  intervalDays!: number;

  @IsOptional()
  @IsUUID()
  monitorUserId?: string | null;
}

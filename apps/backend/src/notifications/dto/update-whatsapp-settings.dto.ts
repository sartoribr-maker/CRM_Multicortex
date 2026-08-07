import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateWhatsAppSettingsDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty() @IsString() @Matches(/^v\d+\.\d+$/) apiVersion!: string;
  @ApiProperty() @IsString() phoneNumberId!: string;
  @ApiProperty() @IsString() businessAccountId!: string;
  @ApiPropertyOptional({ description: 'Deixe vazio para manter o token atual.' })
  @IsOptional()
  @IsString()
  accessToken?: string;
  @ApiProperty() @IsString() @MinLength(2) languageCode!: string;
  @ApiProperty() @IsString() testTemplate!: string;
  @ApiProperty() @IsString() leadCreatedTemplate!: string;
  @ApiProperty() @IsString() leadStageTemplate!: string;
  @ApiProperty() @IsString() taskCreatedTemplate!: string;
  @ApiProperty() @IsString() taskUpdatedTemplate!: string;
  @ApiProperty() @IsString() testPhone!: string;
  @ApiProperty() @IsBoolean() notifyLeadCreated!: boolean;
  @ApiProperty() @IsBoolean() notifyLeadStageChanged!: boolean;
  @ApiProperty() @IsBoolean() notifyTaskCreated!: boolean;
  @ApiProperty() @IsBoolean() notifyTaskUpdated!: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty() @IsString() @MinLength(2) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiProperty() @IsDateString() dueDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() leadId?: string;
  @ApiPropertyOptional({ description: 'Se omitido, atribui ao criador' }) @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional({ type: [String], description: 'Responsáveis pela tarefa' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}

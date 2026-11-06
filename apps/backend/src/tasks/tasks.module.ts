import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskAttachmentsController } from './attachments/task-attachments.controller';
import { TaskAttachmentsService } from './attachments/task-attachments.service';
@Module({
  imports: [CalendarModule],
  controllers: [TasksController, TaskAttachmentsController],
  providers: [TasksService, TaskAttachmentsService],
})
export class TasksModule {}

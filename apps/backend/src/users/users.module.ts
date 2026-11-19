import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CalendarModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

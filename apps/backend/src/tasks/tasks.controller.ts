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
import { PERMISSIONS } from '../auth/constants/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';
import { ExtendTaskDeadlineDto } from './dto/extend-task-deadline.dto';
import { TransferTaskDto } from './dto/transfer-task.dto';
@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}
  @Get() @RequirePermissions(PERMISSIONS.TASKS_VIEW) findAll(
    @Query() query: ListTasksQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user);
  }
  @Get(':id') @RequirePermissions(PERMISSIONS.TASKS_VIEW) findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findOne(id, user);
  }
  @Post() @RequirePermissions(PERMISSIONS.TASKS_CREATE) create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user);
  }
  @Patch(':id') @RequirePermissions(PERMISSIONS.TASKS_EDIT) update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }
  @Post(':id/complete') @RequirePermissions(PERMISSIONS.TASKS_EDIT) complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, { status: 'DONE' }, user);
  }
  @Post(':id/extend-deadline') @RequirePermissions(PERMISSIONS.TASKS_EDIT) extendDeadline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendTaskDeadlineDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.extendDeadline(id, dto, user);
  }
  @Post(':id/transfer') @RequirePermissions(PERMISSIONS.TASKS_EDIT) transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.transfer(id, dto, user);
  }
  @Get(':id/history') @RequirePermissions(PERMISSIONS.TASKS_VIEW) history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.history(id, user);
  }
  @Post(':id/archive') @RequirePermissions(PERMISSIONS.TASKS_DELETE) async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.archive(id, user);
    return { success: true };
  }
  @Delete(':id') @RequirePermissions(PERMISSIONS.TASKS_DELETE) async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.remove(id, user);
    return { success: true };
  }
}

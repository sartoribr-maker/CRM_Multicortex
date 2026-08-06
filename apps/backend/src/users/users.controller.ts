import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Public()
  @Get(':id/avatar')
  async avatar(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const { stream, mimeType } = await this.usersService.getAvatar(id);
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    return new StreamableFile(stream);
  }

  @Post(':id/avatar')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
          return callback(new BadRequestException('Envie uma imagem JPG, PNG ou WebP.'), false);
        callback(null, true);
      },
    }),
  )
  uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Nenhuma imagem enviada.');
    return this.usersService.uploadAvatar(id, file, user.sub);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.create(dto, currentUser.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.update(id, dto, currentUser.sub);
  }

  @Post(':id/deactivate')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.setStatus(id, 'INACTIVE', currentUser.sub);
  }

  @Post(':id/reactivate')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.usersService.setStatus(id, 'ACTIVE', currentUser.sub);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    await this.usersService.resetPassword(id, dto.newPassword, currentUser.sub);
    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() currentUser: JwtPayload) {
    await this.usersService.remove(id, currentUser.sub);
    return { success: true };
  }
}

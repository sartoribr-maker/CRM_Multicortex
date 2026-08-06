import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { StagesModule } from './settings/stages/stages.module';
import { PrioritiesModule } from './settings/priorities/priorities.module';
import { DealSizesModule } from './settings/deal-sizes/deal-sizes.module';
import { SourcesModule } from './settings/sources/sources.module';
import { ProjectTypesModule } from './settings/project-types/project-types.module';
import { CustomFieldsModule } from './settings/custom-fields/custom-fields.module';
import { StorageModule } from './storage/storage.module';
import { LeadsModule } from './leads/leads.module';
import { AttachmentsModule } from './leads/attachments/attachments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    StagesModule,
    PrioritiesModule,
    DealSizesModule,
    SourcesModule,
    ProjectTypesModule,
    CustomFieldsModule,
    StorageModule,
    LeadsModule,
    AttachmentsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

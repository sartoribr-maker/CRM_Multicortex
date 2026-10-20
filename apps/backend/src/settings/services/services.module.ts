import { Module } from '@nestjs/common';
import { ServicesImportService } from './import/services-import.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({ controllers: [ServicesController], providers: [ServicesService, ServicesImportService] })
export class ServicesModule {}

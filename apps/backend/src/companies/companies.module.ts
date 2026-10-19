import { Module } from '@nestjs/common';
import { CompanyContactService } from './company-contact.service';

@Module({
  providers: [CompanyContactService],
  exports: [CompanyContactService],
})
export class CompaniesModule {}

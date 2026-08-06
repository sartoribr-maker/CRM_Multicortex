import { Global, Module } from '@nestjs/common';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Global()
@Module({
  providers: [{ provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}

import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';
import type { SaveFileParams, SaveFileResult, StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(configService: ConfigService) {
    this.basePath = configService.get<string>('STORAGE_LOCAL_PATH', './storage');
  }

  async save({ buffer, originalName, mimeType: _mimeType }: SaveFileParams): Promise<SaveFileResult> {
    const storageKey = `${randomUUID()}${extname(originalName)}`;
    const fullPath = join(this.basePath, storageKey);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return { storageKey, sizeBytes: buffer.length };
  }

  async getStream(storageKey: string): Promise<Readable> {
    return createReadStream(join(this.basePath, storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(join(this.basePath, storageKey)).catch(() => undefined);
  }
}

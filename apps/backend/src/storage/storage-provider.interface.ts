import type { Readable } from 'stream';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface SaveFileParams {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface SaveFileResult {
  storageKey: string;
  sizeBytes: number;
}

export interface StorageProvider {
  save(params: SaveFileParams): Promise<SaveFileResult>;
  getStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}

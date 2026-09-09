export interface StoredFile {
  key: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface UploadBufferInput {
  buffer: Buffer;
  name: string;
  mimeType: string;
  customId?: string;
}

export interface FileStorage {
  uploadBuffer(input: UploadBufferInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

import "server-only";

import { UTApi, UTFile } from "uploadthing/server";

import type { FileStorage, StoredFile, UploadBufferInput } from "./types";

const utapi = new UTApi();

export const uploadThingStorage: FileStorage = {
  async uploadBuffer({
    buffer,
    name,
    mimeType,
    customId,
  }: UploadBufferInput): Promise<StoredFile> {
    if (!buffer.length) {
      throw new Error("Cannot upload an empty file.");
    }

    // Convert Node Buffer into a standalone ArrayBuffer that
    // satisfies the DOM BlobPart type expected by UTFile.
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);

    new Uint8Array(arrayBuffer).set(buffer);

    const file = new UTFile([arrayBuffer], name, {
      type: mimeType,
      ...(customId ? { customId } : {}),
    });

    const response = await utapi.uploadFiles(file);

    if (response.error || !response.data) {
      throw new Error(response.error?.message ?? "Failed to upload file.");
    }

    return {
      key: response.data.key,
      url: response.data.url,
      name: response.data.name,
      size: response.data.size,
      mimeType,
    };
  },

  async delete(key: string): Promise<void> {
    if (!key.trim()) {
      return;
    }

    await utapi.deleteFiles(key);
  },
};

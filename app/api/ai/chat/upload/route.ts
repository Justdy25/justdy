import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

import prisma from "@/lib/prisma";
import { getRequiredOpenAIAPIKey } from "@/lib/ai/config";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 3;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getExtension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function isAllowedFile(file: File) {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;

  return new Set([
    "pdf",
    "txt",
    "md",
    "csv",
    "json",
    "rtf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
  ]).has(getExtension(file.name));
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      const single = formData.get("file");
      if (single instanceof File) files.push(single);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Please choose a file to upload." },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `You can upload up to ${MAX_FILES_PER_REQUEST} files at once.`,
        },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (file.size <= 0) {
        return NextResponse.json(
          { error: `${file.name} is empty.` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${file.name} is larger than 25 MB.` },
          { status: 413 },
        );
      }

      if (!isAllowedFile(file)) {
        return NextResponse.json(
          {
            error: `${file.name} is not a supported file type. Use PDF, Word, PowerPoint, Excel, CSV, text, JSON, Markdown, or common image files.`,
          },
          { status: 415 },
        );
      }
    }

    const openai = new OpenAI({ apiKey: getRequiredOpenAIAPIKey() });
    const attachments = [] as Array<{
      assetId: string;
      name: string;
      mimeType: string;
      size: number;
      kind: "image" | "file";
    }>;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await openai.files.create({
        file: await toFile(buffer, file.name, {
          type: file.type || "application/octet-stream",
        }),
        purpose: "user_data",
      });

      const kind = file.type.startsWith("image/") ? "image" : "file";
      const asset = await prisma.aIAsset.create({
        data: {
          userId: user.id,
          type: kind === "image" ? "IMAGE" : "DOCUMENT",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          metadata: {
            source: "chat-upload",
            kind,
            openAIFileId: uploaded.id,
            originalName: file.name,
          },
        },
        select: { id: true },
      });

      attachments.push({
        assetId: asset.id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        kind,
      });
    }

    return NextResponse.json(
      { attachments },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("POST /api/ai/chat/upload:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to upload file.",
      },
      { status: 500 },
    );
  }
}

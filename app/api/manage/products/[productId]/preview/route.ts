import "server-only";

import { NextResponse } from "next/server";
import { headers } from "next/headers";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    // ========================================================
    // AUTHENTICATE
    // ========================================================

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ========================================================
    // PRODUCT ID
    // ========================================================

    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 },
      );
    }

    // ========================================================
    // FIND PRODUCT
    // ========================================================

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        userId: true,
        fileKey: true,
        fileType: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }

    // ========================================================
    // ONLY PRODUCT OWNER CAN PREVIEW
    // ========================================================

    if (product.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have permission to preview this file." },
        { status: 403 },
      );
    }

    // ========================================================
    // CHECK FILE
    // ========================================================

    if (!product.fileKey) {
      return NextResponse.json(
        { error: "Product has no file." },
        { status: 404 },
      );
    }

    // ========================================================
    // BUILD UPLOADTHING URL
    // ========================================================

    const fileUrl =
      product.fileKey.startsWith("http://") ||
      product.fileKey.startsWith("https://")
        ? product.fileKey
        : `https://utfs.io/f/${product.fileKey}`;

    console.log("PDF PREVIEW REQUEST:", {
      productId: product.id,
      fileKey: product.fileKey,
      fileType: product.fileType,
      fileUrl,
    });

    // ========================================================
    // FETCH FILE FROM UPLOADTHING
    // ========================================================

    const response = await fetch(fileUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("UPLOADTHING PDF FETCH FAILED:", {
        status: response.status,
        statusText: response.statusText,
        fileUrl,
      });

      return NextResponse.json(
        {
          error: "Unable to retrieve the PDF from storage.",
        },
        {
          status: 502,
        },
      );
    }

    // ========================================================
    // RETURN PDF TO BROWSER
    // ========================================================

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Content-Length": String(pdfBuffer.byteLength),

        // Important for iframe/browser PDF rendering
        "Cache-Control": "private, no-store, max-age=0",

        // Helps prevent MIME sniffing
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PDF PREVIEW ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to preview PDF.",
      },
      {
        status: 500,
      },
    );
  }
}

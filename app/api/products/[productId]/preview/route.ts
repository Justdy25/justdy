import "server-only";

import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        {
          error: "Product ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        status: true,
        fileKey: true,
        fileType: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          error: "Product not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (product.status !== "Published") {
      return NextResponse.json(
        {
          error: "Preview unavailable.",
        },
        {
          status: 404,
        },
      );
    }

    if (!product.fileKey) {
      return NextResponse.json(
        {
          error: "No preview file found.",
        },
        {
          status: 404,
        },
      );
    }

    const fileUrl =
      product.fileKey.startsWith("http://") ||
      product.fileKey.startsWith("https://")
        ? product.fileKey
        : `https://utfs.io/f/${product.fileKey}`;

    return NextResponse.redirect(fileUrl);
  } catch (error) {
    console.error("PUBLIC PRODUCT PREVIEW ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to load product preview.",
      },
      {
        status: 500,
      },
    );
  }
}

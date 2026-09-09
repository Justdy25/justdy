import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: "Published",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        type: true,
        imageKey: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const result = products.map((product) => ({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price,
      type: product.type,
      image: product.imageKey ?? null,
    }));

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to load explore products:", error);

    return NextResponse.json(
      {
        error: "Failed to load products",
      },
      {
        status: 500,
      },
    );
  }
}

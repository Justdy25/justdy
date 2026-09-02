"use server";

import prisma from "@/lib/prisma";
import { ProductStatus } from "@/lib/generated/prisma/client";

export interface ProductSearchResult {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  category: string | null;
  type: string;
  imageUrl: string | null;
}

function getImageUrl(imageKey: string | null | undefined) {
  if (!imageKey) return null;

  if (
    imageKey.startsWith("http://") ||
    imageKey.startsWith("https://") ||
    imageKey.startsWith("/")
  ) {
    return imageKey;
  }

  return `https://utfs.io/f/${imageKey}`;
}

export async function searchProducts(
  query: string = "",
): Promise<ProductSearchResult[]> {
  const trimmedQuery = query.trim();

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.Published,

      ...(trimmedQuery
        ? {
            OR: [
              {
                title: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                category: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      category: true,
      type: true,
      imageKey: true,
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 8,
  });

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    price: product.price,
    category: product.category,
    type: product.type,
    imageUrl: getImageUrl(product.imageKey),
  }));
}

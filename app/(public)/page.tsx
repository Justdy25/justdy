import prisma from "@/lib/prisma";
import LandingPageClient from "../_components/LandingPage";
import FeaturedProducts from "../_components/FeaturedProducts";

export default async function LandingPage() {
  // ============================================================
  // GET PRODUCTS WITH PRODUCT THUMBNAILS
  // ============================================================
  //
  // ProductImage has been removed from the Prisma schema.
  // The product thumbnail is now stored directly on Product
  // using imageKey.
  //
  const products = await prisma.product.findMany({
    where: {
      imageKey: {
        not: null,
      },
    },

    take: 8,

    orderBy: {
      createdAt: "desc",
    },

    select: {
      imageKey: true,
    },
  });

  // ============================================================
  // EXTRACT IMAGE KEYS
  // ============================================================

  const imageKeys = products
    .map((product) => product.imageKey)
    .filter((imageKey): imageKey is string => Boolean(imageKey));

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <LandingPageClient uploadthingImages={imageKeys} />

      <FeaturedProducts />
    </>
  );
}

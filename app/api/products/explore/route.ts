// import prisma from "@/lib/prisma";
// import { NextResponse } from "next/server";

// export async function GET() {
//   try {
//     const products = await prisma.product.findMany({
//       where: {
//         status: "Published",
//       },
//       select: {
//         id: true,
//         title: true,
//         slug: true,
//         price: true,
//         type: true,
//         imageKey: true,

//         images: {
//           orderBy: {
//             position: "asc",
//           },
//           take: 1,
//           select: {
//             imageKey: true,
//           },
//         },
//       },

//       orderBy: {
//         createdAt: "desc",
//       },
//     });

//     const result = products.map((product) => ({
//       id: product.id,
//       title: product.title,
//       slug: product.slug,
//       price: product.price,
//       type: product.type,

//       // Prefer the first ProductImage.
//       // Fall back to Product.imageKey.
//       image: product.images[0]?.imageKey ?? product.imageKey ?? null,
//     }));

//     return NextResponse.json(result, {
//       headers: {
//         // Keep the API lightweight while still allowing
//         // relatively fresh product data.
//         "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
//       },
//     });
//   } catch (error) {
//     console.error("Failed to load explore products:", error);

//     return NextResponse.json(
//       {
//         error: "Failed to load products",
//       },
//       {
//         status: 500,
//       },
//     );
//   }
// }

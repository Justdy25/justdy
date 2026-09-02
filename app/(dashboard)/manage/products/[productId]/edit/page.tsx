import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, FileEdit } from "lucide-react";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import { buttonVariants } from "@/app/_components/ui/button";
import { EditProductForm } from "@/app/_components/EditProductForm";

type Params = Promise<{
  productId: string;
}>;

export default async function EditProduct({ params }: { params: Params }) {
  const { productId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
      userId: session.user.id,
    },
    include: {
      subject: true,
      topic: true,
      chapters: {
        include: {
          lessons: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const subjects = await prisma.subject.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      topics: {
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  const statusLower = String(product.status ?? "Draft").toLowerCase();

  const renderStatusBadge = () => {
    switch (statusLower) {
      case "published":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            Published
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3.5" />
            In Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <FileEdit className="size-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            <FileEdit className="size-3.5" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="flex items-center gap-4">
          <Link
            href="/manage/products"
            className={buttonVariants({
              variant: "outline",
              size: "icon",
              className: "h-9 w-9 rounded-lg border-border/80 shadow-xs",
            })}
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {product.title || "Untitled Product"}
              </h1>
              {renderStatusBadge()}
            </div>
          </div>
        </div>
      </div>

      <EditProductForm product={product} subjects={subjects} />
    </div>
  );
}

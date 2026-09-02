"use client";

import {
  DndContext,
  DragEndEvent,
  DraggableSyntheticListeners,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { PdfPreview } from "@/app/_components/PdfPreview";
import {
  ChangeEvent,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useRef,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";
import Image from "next/image";
import slugify from "slugify";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Loader2,
  Save,
  UploadCloud,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react";

import { tryCatch } from "@/hooks/try-catch";
import { useUploadThing } from "@/lib/uploadthing";
import { deleteUTFile } from "@/app/actions/delete-file";

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { AdminCourseSingularType } from "@/app/actions/educator-get-course";
import { cn } from "@/lib/utils";

import Link from "next/link";

import { NewChapterModal } from "./NewChapterModal";
import { NewLessonModal } from "./NewLessonModal";
import { DeleteLesson } from "./DeleteLesson";
import { DeleteChapter } from "./DeleteChapter";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/_components/ui/collapsible";

import { Button } from "@/app/_components/ui/button";

import {
  reorderChapters,
  reorderLessons,
  editCourse,
} from "../actions/manage-edit-course";

import {
  ProductStatus,
  ProductType,
  GradeLevel,
} from "@/lib/generated/prisma/enums";

import {
  courseCategories,
  productSchema,
  ProductSchemaType,
  productType,
} from "@/lib/zodSchemas";

import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";

import { RichTextEditor } from "@/app/_components/rich-text-editor/Editor";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";

import { updateProduct } from "../actions/manage-update-product";
import { deleteProductDeliverable } from "../actions/manage-delete-product-deliverable";

/* ============================================================
   COURSE STRUCTURE TYPES
============================================================ */

interface iAppProps {
  data: AdminCourseSingularType;
}

interface SortableItemsProps {
  productId: string;

  children: (listeners: DraggableSyntheticListeners) => ReactNode;

  className?: string;

  data?: {
    type: "chapter" | "lesson";
    chapterId?: string;
  };
}

type ChapterItemState = {
  id: string;
  title: string;
  order: number;
  isOpen: boolean;

  lessons: Array<{
    id: string;
    title: string;
    order: number;
  }>;
};

/* ============================================================
   COURSE STRUCTURE
============================================================ */

export function CourseStructure({ data }: iAppProps) {
  const formatChapters = (
    chapters: typeof data.chapters,
  ): ChapterItemState[] => {
    return (
      chapters?.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        order: chapter.position,
        isOpen: true,

        lessons: chapter.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          order: lesson.position,
        })),
      })) ?? []
    );
  };

  const [items, setItems] = useState<ChapterItemState[]>(() =>
    formatChapters(data.chapters),
  );

  function SortableItem({
    children,
    productId,
    className,
    data,
  }: SortableItemsProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: productId,
      data,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={cn("touch-none", className, isDragging ? "z-10" : "")}
      >
        {children(listeners)}
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeType = active.data.current?.type as
      | "chapter"
      | "lesson"
      | undefined;

    const overType = over.data.current?.type as
      | "chapter"
      | "lesson"
      | undefined;

    const courseId = data.id;

    /* ========================================================
       REORDER CHAPTERS
    ======================================================== */

    if (activeType === "chapter") {
      let targetChapterId: string | null = null;

      if (overType === "chapter") {
        targetChapterId = overId;
      } else if (overType === "lesson") {
        targetChapterId =
          (over.data.current?.chapterId as string | undefined) ?? null;
      }

      if (!targetChapterId) {
        toast.error("Could not determine the chapter for reordering");
        return;
      }

      const oldIndex = items.findIndex((item) => item.id === activeId);

      const newIndex = items.findIndex((item) => item.id === targetChapterId);

      if (oldIndex === -1 || newIndex === -1) {
        toast.error("Could not find chapter old/new index for reordering");
        return;
      }

      const reorderedLocalChapters = arrayMove(items, oldIndex, newIndex);

      const updatedChapterForState = reorderedLocalChapters.map(
        (chapter, index) => ({
          ...chapter,
          order: index + 1,
        }),
      );

      const previousItems = [...items];

      setItems(updatedChapterForState);

      const chaptersToUpdate = updatedChapterForState.map((chapter) => ({
        id: chapter.id,
        position: chapter.order,
      }));

      toast.promise(reorderChapters(courseId, chaptersToUpdate), {
        loading: "Reordering Chapters...",

        success: (result) => {
          if (result.status === "success") {
            return result.message;
          }

          throw new Error(result.message);
        },

        error: () => {
          setItems(previousItems);
          return "Failed to reorder chapters";
        },
      });

      return;
    }

    /* ========================================================
       REORDER LESSONS
    ======================================================== */

    if (activeType === "lesson" && overType === "lesson") {
      const chapterId = active.data.current?.chapterId as string | undefined;

      const overChapterId = over.data.current?.chapterId as string | undefined;

      if (!chapterId || chapterId !== overChapterId) {
        toast.error(
          "Lesson move between different chapters or invalid chapter ID is not allowed.",
        );
        return;
      }

      const chapterIndex = items.findIndex(
        (chapter) => chapter.id === chapterId,
      );

      if (chapterIndex === -1) {
        toast.error("Could not find chapter for lesson");
        return;
      }

      const chapterToUpdate = items[chapterIndex];

      const oldLessonIndex = chapterToUpdate.lessons.findIndex(
        (lesson) => lesson.id === activeId,
      );

      const newLessonIndex = chapterToUpdate.lessons.findIndex(
        (lesson) => lesson.id === overId,
      );

      if (oldLessonIndex === -1 || newLessonIndex === -1) {
        toast.error("Could not find lesson for reordering");
        return;
      }

      const reorderedLessons = arrayMove(
        chapterToUpdate.lessons,
        oldLessonIndex,
        newLessonIndex,
      );

      const updatedLessonForState = reorderedLessons.map((lesson, index) => ({
        ...lesson,
        order: index + 1,
      }));

      const newItems = [...items];

      newItems[chapterIndex] = {
        ...chapterToUpdate,
        lessons: updatedLessonForState,
      };

      const previousItems = [...items];

      setItems(newItems);

      const lessonsToUpdate = updatedLessonForState.map((lesson) => ({
        id: lesson.id,
        position: lesson.order,
      }));

      toast.promise(reorderLessons(chapterId, lessonsToUpdate, courseId), {
        loading: "Reordering Lessons...",

        success: (result) => {
          if (result.status === "success") {
            return result.message;
          }

          throw new Error(result.message);
        },

        error: () => {
          setItems(previousItems);
          return "Failed to reorder lessons";
        },
      });
    }
  }

  function toggleChapter(chapterId: string) {
    setItems((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              isOpen: !chapter.isOpen,
            }
          : chapter,
      ),
    );
  }

  const sensors = useSensors(
    useSensor(PointerSensor),

    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      collisionDetection={rectIntersection}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border">
          <CardTitle className="text-base font-semibold">
            Course Curriculum & Chapters
          </CardTitle>

          <NewChapterModal productId={data.id} />
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <SortableItem
                key={item.id}
                productId={item.id}
                data={{
                  type: "chapter",
                }}
              >
                {(listeners) => (
                  <Card>
                    <Collapsible
                      open={item.isOpen}
                      onOpenChange={() => toggleChapter(item.id)}
                    >
                      <div className="flex items-center justify-between p-3 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" {...listeners}>
                            <GripVertical className="size-4" />
                          </Button>

                          <CollapsibleTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="flex items-center"
                            >
                              {item.isOpen ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>

                          <p className="cursor-pointer hover:text-primary pl-2 font-medium text-sm">
                            {item.title}
                          </p>
                        </div>

                        <DeleteChapter chapterId={item.id} courseId={data.id} />
                      </div>

                      <CollapsibleContent>
                        <div className="p-1">
                          <SortableContext
                            items={item.lessons.map((lesson) => lesson.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {item.lessons.map((lesson) => (
                              <SortableItem
                                key={lesson.id}
                                productId={lesson.id}
                                data={{
                                  type: "lesson",
                                  chapterId: item.id,
                                }}
                              >
                                {(lessonListeners) => (
                                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded-sm text-sm">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        {...lessonListeners}
                                      >
                                        <GripVertical className="size-4" />
                                      </Button>

                                      <FileText className="size-4" />

                                      <Link
                                        href={`/manage/products/${data.id}/${item.id}/${lesson.id}`}
                                        className="hover:underline"
                                      >
                                        {lesson.title}
                                      </Link>
                                    </div>

                                    <DeleteLesson
                                      chapterId={item.id}
                                      courseId={data.id}
                                      lessonId={lesson.id}
                                    />
                                  </div>
                                )}
                              </SortableItem>
                            ))}
                          </SortableContext>

                          <div className="p-2">
                            <NewLessonModal
                              chapterId={item.id}
                              productId={data.id}
                            />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )}
              </SortableItem>
            ))}
          </SortableContext>
        </CardContent>
      </Card>
    </DndContext>
  );
}

/* ============================================================
   PRODUCT TYPES
============================================================ */

interface LessonItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  position: number;
  thumbnailKey: string | null;
  videoKey: string | null;
  chapterId: string;
}

interface ChapterItem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  position: number;
  productId: string;
  lessons: LessonItem[];
}

interface TopicOption {
  id: string;
  name: string;
  slug: string;
  gradeLevel: GradeLevel;
  subjectId: string;
}

interface SubjectOption {
  id: string;
  name: string;
  description: string | null;
  topics: TopicOption[];
}

/* ============================================================
   UPDATED PRODUCT WITH RELATIONS
============================================================ */

interface ProductWithRelations {
  id: string;

  title: string | null;
  description: string | null;

  price: number | null;

  printedPrice?: number | null;

  status: ProductStatus;
  type: ProductType;

  subjectId: string;
  topicId: string;
  gradeLevel: GradeLevel | null;

  subject?: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    description: string | null;
  } | null;

  topic?: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    slug: string;
    gradeLevel: GradeLevel;
    subjectId: string;
  } | null;

  slug: string | null;
  duration: number | null;
  category: string | null;

  imageKey: string | null;
  fileKey: string | null;
  fileType: string | null;
  fileSize: number | null;

  chapters: ChapterItem[];
}

/* ============================================================
   EDIT PRODUCT FORM
============================================================ */

export function EditProductForm({
  product,
  subjects,
}: {
  product: ProductWithRelations;
  subjects: SubjectOption[];
}) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();

  /* ============================================================
   ACADEMIC CLASSIFICATION
============================================================ */

  const [selectedProductType, setSelectedProductType] = useState<ProductType>(
    product.type,
  );

  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel | "">(
    product.gradeLevel ?? product.topic?.gradeLevel ?? "",
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    product.subjectId ?? product.subject?.id ?? "",
  );

  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    product.topicId ?? product.topic?.id ?? "",
  );

  const isCourse = selectedProductType === ProductType.Course;

  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const [selectedDeliverableFile, setSelectedDeliverableFile] =
    useState<File | null>(null);

  const [imageError, setImageError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Native file input for the unified deliverable preview/uploader.
  const deliverableFileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: startMediaUpload } = useUploadThing("mediaUploader", {
    onUploadError: (error) => {
      console.error("Media upload error:", error);

      toast.error(error.message || "Failed to upload media.");
    },
  });

  const { startUpload: startDeliverableUpload } = useUploadThing(
    "deliverableUploader",
    {
      onUploadError: (error) => {
        console.error("Deliverable upload error:", error);

        toast.error(error.message || "Failed to upload deliverable file.");
      },
    },
  );

  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const [, setIsChangingDeliverable] = useState(false);

  const [fileKey, setFileKey] = useState(product.fileKey ?? "");

  const [fileType, setFileType] = useState(product.fileType ?? "");

  const [fileSize, setFileSize] = useState<number>(product.fileSize ?? 0);

  const originalFileKey = product.fileKey ?? "";

  const [isDeletingDeliverable, setIsDeletingDeliverable] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const rawImageKey = product.imageKey ?? "";

  const rawImageUrl = rawImageKey
    ? rawImageKey.startsWith("http://") || rawImageKey.startsWith("https://")
      ? rawImageKey
      : `https://utfs.io/f/${rawImageKey}`
    : "";

  /* ==========================================================
     FORM
  ========================================================== */

  const form = useForm<ProductSchemaType>({
    resolver: zodResolver(productSchema) as Resolver<ProductSchemaType>,

    defaultValues: {
      title: product.title || "",

      description: product.description || "",

      fileKey: product.fileKey ?? "",

      /*
       * Product.price can now be null.
       * Normalize null to 0 for the form.
       */
      price: product.price != null ? product.price / 100 : 0,

      printedPrice:
        product.printedPrice != null ? product.printedPrice / 100 : undefined,

      duration: product.duration ?? null,

      category:
        (product.category as ProductSchemaType["category"] | undefined) || "",

      slug: product.slug || "",

      type: product.type as ProductSchemaType["type"],

      status: product.status as ProductSchemaType["status"],

      gradeLevel: product.gradeLevel ?? product.topic?.gradeLevel ?? "",
      subjectId: product.subjectId ?? product.subject?.id ?? "",
      topicId: product.topicId ?? product.topic?.id ?? "",
    },
  });

  /* ============================================================
   FILTER TOPICS
============================================================ */

  const selectedSubject = useMemo(() => {
    return subjects.find((subject) => subject.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  const filteredTopics = useMemo(() => {
    if (!selectedSubjectId || !selectedGradeLevel) {
      return [];
    }

    return (
      selectedSubject?.topics.filter(
        (topic) =>
          topic.subjectId === selectedSubjectId &&
          topic.gradeLevel === selectedGradeLevel,
      ) ?? []
    );
  }, [selectedSubject, selectedSubjectId, selectedGradeLevel]);

  const [title, setTitle] = useState(product.title || "");

  const [description, setDescription] = useState(product.description || "");

  const [price, setPrice] = useState(
    (product.price != null ? product.price / 100 : 0).toString(),
  );

  const [printedPrice, setPrintedPrice] = useState(
    product.printedPrice != null ? (product.printedPrice / 100).toString() : "",
  );

  const previewUrl = useMemo(() => {
    if (!selectedImage) {
      return null;
    }

    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const deliverablePreviewUrl = useMemo(() => {
    if (!selectedDeliverableFile) {
      return null;
    }

    return URL.createObjectURL(selectedDeliverableFile);
  }, [selectedDeliverableFile]);

  useEffect(() => {
    return () => {
      if (deliverablePreviewUrl) {
        URL.revokeObjectURL(deliverablePreviewUrl);
      }
    };
  }, [deliverablePreviewUrl]);

  const existingImageUrl = useMemo(() => {
    if (rawImageUrl?.trim()) {
      return rawImageUrl;
    }

    return null;
  }, [rawImageUrl]);

  const imageSrc = useMemo(() => {
    if (previewUrl) {
      return previewUrl;
    }

    if (!imageError && existingImageUrl) {
      return existingImageUrl;
    }

    return "/images/no-image.jpeg";
  }, [previewUrl, imageError, existingImageUrl]);

  /* ==========================================================
     FILE HELPERS
  ========================================================== */

  const extractKeyFromUrl = (url: string): string => {
    if (!url) {
      return "";
    }

    if (url.includes("/f/")) {
      return url.split("/f/").pop() || "";
    }

    return url;
  };

  const getDeliverableUrl = (key: string) => {
    if (!key) return "";

    // Support both a stored UploadThing key and a complete URL.
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return key;
    }

    const normalizedKey = extractKeyFromUrl(key);

    return normalizedKey ? `https://utfs.io/f/${normalizedKey}` : "";
  };

  const isPdfFile = (key: string, type: string) => {
    if (type === "application/pdf") return true;

    const normalizedKey = extractKeyFromUrl(key).toLowerCase();
    return normalizedKey.endsWith(".pdf");
  };

  const getFileName = (key: string) => {
    if (!key) {
      return "Deliverable file";
    }

    const normalizedKey = extractKeyFromUrl(key);

    return normalizedKey.split("/").pop() || "Deliverable file";
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) {
      return "Unknown size";
    }

    const units = ["B", "KB", "MB", "GB"];

    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(
      index === 0 ? 0 : 1,
    )} ${units[index]}`;
  };

  /* ==========================================================
     DELETE DELIVERABLE
  ========================================================== */

  const handleDeleteDeliverable = async () => {
    // If the user has selected a replacement but has not submitted yet,
    // remove only the local selection and keep the currently saved file.
    if (selectedDeliverableFile) {
      setSelectedDeliverableFile(null);
      setFileKey(originalFileKey);
      setFileType(product.fileType ?? "");
      setFileSize(product.fileSize ?? 0);
      setIsChangingDeliverable(false);
      setIsPreviewOpen(false);

      toast.success("Selected replacement removed.");
      return;
    }

    if (!fileKey && !originalFileKey) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this deliverable? This will remove it from the product and UploadThing. This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingDeliverable(true);

    try {
      const result = await deleteProductDeliverable(product.id);

      if (result.status !== "success") {
        toast.error(result.message || "Failed to delete deliverable.");
        return;
      }

      setFileKey("");
      setFileType("");
      setFileSize(0);
      setSelectedDeliverableFile(null);
      setIsPreviewOpen(false);
      setIsChangingDeliverable(false);

      toast.success(result.message || "Deliverable deleted successfully.");

      router.refresh();
    } catch (error) {
      console.error("Failed to delete deliverable:", error);
      toast.error("Failed to delete deliverable.");
    } finally {
      setIsDeletingDeliverable(false);
    }
  };

  /* ==========================================================
     DELIVERABLE CHANGE
  ========================================================== */

  const handleDeliverableFileSelect = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const isAllowedType =
      file.type === "application/pdf" ||
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.name.toLowerCase().endsWith(".zip") ||
      file.name.toLowerCase().endsWith(".rar");

    if (!isAllowedType) {
      toast.error("Please select a PDF, image, video, ZIP, or RAR file.");
      event.currentTarget.value = "";
      return;
    }

    // Keep the selected file local until Save Changes is submitted.
    setSelectedDeliverableFile(file);
    setFileType(file.type || "application/octet-stream");
    setFileSize(file.size);
    setIsChangingDeliverable(true);

    // Allow selecting the same file again later.
    event.currentTarget.value = "";
  };

  /* ==========================================================
     SAVE
  ========================================================== */

  const handleSave = async (values: ProductSchemaType) => {
    startTransition(async () => {
      /* ======================================================
           COURSE
        ====================================================== */

      if (isCourse) {
        let finalFileKey = values.fileKey;

        let newlyUploadedKey: string | null = null;

        if (selectedImage) {
          const uploadRes = await startMediaUpload([selectedImage]);

          if (!uploadRes || uploadRes.length === 0) {
            toast.error("Failed to upload thumbnail image to cloud storage.");

            return;
          }

          finalFileKey = uploadRes[0].key;

          newlyUploadedKey = uploadRes[0].key;
        }

        if (!finalFileKey) {
          toast.error("Please upload a course thumbnail.");

          return;
        }

        const submissionData = {
          ...values,
          fileKey: finalFileKey,
        };

        const { data: result, error } = await tryCatch(
          editCourse(submissionData, product.id),
        );

        if (error || result?.status === "error") {
          if (newlyUploadedKey) {
            await deleteUTFile(newlyUploadedKey);
          }

          toast.error(result?.message || "An unexpected error occurred.");

          return;
        }

        if (result.status === "success") {
          toast.success(result.message);

          router.refresh();
        } else {
          toast.error(result.message);
        }

        return;
      }

      /* ======================================================
           DIGITAL PRODUCT
        ====================================================== */

      let finalFileKey = fileKey;

      let finalFileType = fileType;

      let finalFileSize = fileSize;

      let newlyUploadedPdfKey: string | null = null;

      if (selectedDeliverableFile) {
        setIsUploadingImages(true);

        try {
          const uploadRes = await startDeliverableUpload([
            selectedDeliverableFile,
          ]);

          if (!uploadRes || uploadRes.length === 0) {
            toast.error("Failed to upload deliverable file to cloud storage.");

            return;
          }

          finalFileKey = uploadRes[0].key;

          newlyUploadedPdfKey = uploadRes[0].key;

          finalFileType = selectedDeliverableFile.type;

          finalFileSize = selectedDeliverableFile.size;
        } catch (error: unknown) {
          console.error("Failed to upload deliverable:", error);

          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to upload deliverable file.",
          );

          return;
        } finally {
          setIsUploadingImages(false);
        }
      }

      if (!title || !description || !price) {
        toast.error("Please fill in all required basic information fields.");

        return;
      }

      if (!finalFileKey) {
        toast.error("Please upload the main digital asset file.");

        return;
      }

      const numericPrice = parseFloat(price);

      if (isNaN(numericPrice) || numericPrice > 1) {
        toast.error("Please enter a valid price of at least $1.");

        return;
      }

      const numericPrintedPrice =
        printedPrice.trim() !== "" ? parseFloat(printedPrice) : null;

      if (!selectedGradeLevel) {
        toast.error("Grade level is required.");
        return;
      }

      const gradeLevel: GradeLevel = selectedGradeLevel;
      const subjectId = selectedSubjectId.trim();
      const topicId = selectedTopicId.trim();

      if (!subjectId) {
        toast.error("Subject is required.");
        return;
      }

      if (!topicId) {
        toast.error("Topic is required.");
        return;
      }

      const selectedTopic = filteredTopics.find(
        (topic) => topic.id === topicId,
      );

      if (!selectedTopic) {
        toast.error(
          "Please select a valid topic for the selected subject and grade level.",
        );
        return;
      }

      const payload = {
        productId: product.id,
        title,
        description,
        type: selectedProductType,
        gradeLevel,
        subjectId,
        topicId,
        price: Math.round(numericPrice * 100),
        printedPrice:
          numericPrintedPrice !== null &&
          Number.isFinite(numericPrintedPrice) &&
          numericPrintedPrice > 0
            ? Math.round(numericPrintedPrice * 100)
            : null,
        fileKey: finalFileKey,
        fileType: finalFileType,
        fileSize: finalFileSize,
      };

      const result = await updateProduct(payload);

      if (result.status === "success") {
        toast.success(result.message || "Changes saved successfully");

        router.refresh();
      } else {
        if (newlyUploadedPdfKey) {
          await deleteUTFile(newlyUploadedPdfKey);
        }

        toast.error(result.message || "Failed to save product");
      }
    });
  };

  const isLoading = pending || isUploadingImages;

  /* ==========================================================
     COURSE FORM DATA
  ========================================================== */

  const courseFormData = {
    id: product.id,
    title: product.title ?? "",
    type: selectedProductType as (typeof productType)[number],
    slug: product.slug ?? "",
    description: product.description ?? "",
    price: product.price ?? 0,
    status: product.status,
    fileKey: (product.fileKey ?? "").trim(),
    imageUrl: rawImageUrl.trim(),
    duration: product.duration ?? 0,
    category: product.category ?? "",
    hasCourseRelation: selectedProductType === "Course",
    chapters: product.chapters ?? [],
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSave, (errors) => {
          console.error("FORM VALIDATION ERRORS:", errors);

          Object.entries(errors).forEach(([field, error]) => {
            toast.error(`${field}: ${error?.message || "Invalid value"}`);
          });
        })}
        className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden "
      >
        {/* ====================================================
            VIEWPORT EDITOR
        ==================================================== */}
        <div className="min-h-0 flex-1 overflow-hidden p-0 sm:p-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* ====================================================
              MAIN DETAILS
          ==================================================== */}

            <main className="min-h-0 overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-4 pb-1">
                <Card className="overflow-hidden rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
                  <CardContent className="space-y-4 pt-4 sm:pt-0">
                    {/* Product Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">
                            Product Title
                          </FormLabel>

                          <FormControl>
                            <Input
                              placeholder="e.g. Master Next.js 15"
                              className="h-10 text-sm"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);

                                setTitle(e.target.value);

                                form.setValue(
                                  "slug",
                                  slugify(e.target.value, {
                                    lower: true,
                                  }),
                                );
                              }}
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">
                            Description
                          </FormLabel>

                          <FormControl>
                            <RichTextEditor
                              field={{
                                value: field.value,

                                onChange: (val: string) => {
                                  field.onChange(val);

                                  setDescription(val);
                                },
                              }}
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Course Structure */}
                {isCourse && <CourseStructure data={courseFormData} />}
              </div>
            </main>

            {/* ====================================================
              SIDEBAR (Screen Height)
          ==================================================== */}

            <aside className="h-160 overflow-y-auto overscroll-contain pr-1">
              <div className="flex h-full min-h-full flex-col gap-3 pb-1">
                <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-border bg-card/50 shadow-sm backdrop-blur-sm">
                  <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto pt-4">
                    {isCourse && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          Course Thumbnail
                        </Label>

                        <FormField
                          control={form.control}
                          name="fileKey"
                          render={() => (
                            <FormItem>
                              <FormControl>
                                <div>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    aria-label={
                                      selectedImage || existingImageUrl
                                        ? "Change course thumbnail"
                                        : "Upload course thumbnail"
                                    }
                                    className={cn(
                                      "group relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl border bg-muted/40 transition-all",
                                      "border-border hover:border-primary/60 hover:ring-2 hover:ring-primary/10",
                                      "focus:outline-none focus:ring-2 focus:ring-primary/30",
                                    )}
                                    onClick={() =>
                                      fileInputRef.current?.click()
                                    }
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                      ) {
                                        event.preventDefault();
                                        fileInputRef.current?.click();
                                      }
                                    }}
                                  >
                                    {selectedImage && previewUrl ? (
                                      <Image
                                        src={previewUrl}
                                        alt={
                                          selectedImage.name ||
                                          "Selected course thumbnail"
                                        }
                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                      />
                                    ) : existingImageUrl && !imageError ? (
                                      <Image
                                        src={existingImageUrl}
                                        alt="Current course thumbnail"
                                        fill
                                        unoptimized
                                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                        onError={() => setImageError(true)}
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                                        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                                          <UploadCloud className="size-6 text-primary" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">
                                            Upload thumbnail
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            Click to choose an image
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {selectedImage && previewUrl && (
                                      <div className="absolute left-2 top-2 z-20 rounded-md bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
                                        Preview · not uploaded yet
                                      </div>
                                    )}

                                    {(selectedImage || existingImageUrl) && (
                                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus:opacity-100">
                                        <div className="flex items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-sm">
                                          <UploadCloud className="size-4" />
                                          Click to change image
                                        </div>
                                      </div>
                                    )}

                                    {selectedImage && (
                                      <div className="absolute bottom-2 left-2 right-2 z-20 truncate rounded-md bg-black/60 px-2.5 py-1.5 text-[10px] font-medium text-white backdrop-blur-sm">
                                        {selectedImage.name}
                                      </div>
                                    )}
                                  </div>

                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onClick={(event) => {
                                      event.currentTarget.value = "";
                                    }}
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];

                                      if (!file) return;

                                      if (!file.type.startsWith("image/")) {
                                        toast.error(
                                          "Please select an image file.",
                                        );
                                        return;
                                      }

                                      setSelectedImage(file);
                                      setImageError(false);
                                    }}
                                  />
                                </div>
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* =================================================
                    DELIVERABLE (Short Preview + Horizontal Icon Actions)
                ================================================= */}

                    {!isCourse && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-xs font-semibold">
                              Deliverable
                            </Label>
                            <p className="text-[10px] text-muted-foreground truncate max-w-60">
                              {selectedDeliverableFile
                                ? selectedDeliverableFile.name
                                : getFileName(fileKey)}
                            </p>
                          </div>
                        </div>

                        {/* Short height preview box */}
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={
                            selectedDeliverableFile || fileKey
                              ? "Click to change deliverable file"
                              : "Click to upload deliverable file"
                          }
                          className={cn(
                            "group relative h-32 w-full cursor-pointer overflow-hidden rounded-xl border bg-muted/40 transition-all",
                            "border-border/80 hover:border-primary/60 hover:bg-muted/50 hover:ring-2 hover:ring-primary/10",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30",
                          )}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("video"))
                              return;
                            deliverableFileInputRef.current?.click();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              deliverableFileInputRef.current?.click();
                            }
                          }}
                        >
                          {selectedDeliverableFile && deliverablePreviewUrl ? (
                            selectedDeliverableFile.type ===
                            "application/pdf" ? (
                              <PdfPreview
                                key={deliverablePreviewUrl}
                                src={deliverablePreviewUrl}
                                className="absolute inset-0"
                                showAllPages={false}
                              />
                            ) : selectedDeliverableFile.type.startsWith(
                                "video/",
                              ) ? (
                              <video
                                src={deliverablePreviewUrl}
                                controls
                                playsInline
                                className="absolute inset-0 h-full w-full object-contain bg-black"
                                onClick={(event) => event.stopPropagation()}
                              />
                            ) : selectedDeliverableFile.type.startsWith(
                                "image/",
                              ) ? (
                              <Image
                                src={deliverablePreviewUrl}
                                alt={selectedDeliverableFile.name}
                                className="absolute inset-0 h-full w-full object-contain bg-background"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                                  <FileText className="size-4 text-primary" />
                                </div>
                                <div className="min-w-0 max-w-full">
                                  <p className="truncate text-xs font-semibold">
                                    {selectedDeliverableFile.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatFileSize(
                                      selectedDeliverableFile.size,
                                    )}
                                  </p>
                                </div>
                              </div>
                            )
                          ) : fileKey && isPdfFile(fileKey, fileType) ? (
                            <div className="absolute inset-0 bg-muted/20">
                              <PdfPreview
                                key={fileKey}
                                src={`/api/manage/products/${product.id}/preview`}
                                className="absolute inset-0"
                                showAllPages={false}
                              />
                            </div>
                          ) : fileKey && fileType.startsWith("video/") ? (
                            <video
                              src={getDeliverableUrl(fileKey)}
                              controls
                              playsInline
                              className="absolute inset-0 h-full w-full object-contain bg-black"
                              onClick={(event) => event.stopPropagation()}
                            />
                          ) : fileKey && fileType.startsWith("image/") ? (
                            <Image
                              src={getDeliverableUrl(fileKey)}
                              alt="Current deliverable"
                              className="absolute inset-0 h-full w-full object-contain bg-background"
                            />
                          ) : fileKey ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="size-4 text-primary" />
                              </div>
                              <div className="min-w-0 max-w-full">
                                <p className="truncate text-xs font-semibold">
                                  {getFileName(fileKey)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatFileSize(fileSize)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center">
                              <div className="flex size-9 items-center justify-center rounded-lg border bg-background shadow-sm">
                                <UploadCloud className="size-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold">
                                  Upload deliverable
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  PDF, image, video, ZIP/RAR
                                </p>
                              </div>
                            </div>
                          )}

                          {selectedDeliverableFile && (
                            <div className="absolute left-2 top-2 z-40 rounded-md bg-background/95 px-2 py-0.5 text-[9px] font-medium text-foreground shadow-sm backdrop-blur">
                              Preview · unsaved
                            </div>
                          )}

                          <input
                            ref={deliverableFileInputRef}
                            type="file"
                            accept="application/pdf,image/*,video/*,.zip,.rar"
                            hidden
                            onClick={(event) => {
                              event.currentTarget.value = "";
                            }}
                            onChange={handleDeliverableFileSelect}
                          />
                        </div>

                        {/* Horizontal Icon Buttons Directly Under Preview */}
                        {(fileKey || selectedDeliverableFile) && (
                          <div className="flex items-center justify-center gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8 rounded-lg"
                              onClick={() =>
                                deliverableFileInputRef.current?.click()
                              }
                              title="Change file"
                            >
                              <UploadCloud className="size-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8 rounded-lg"
                              onClick={() => setIsPreviewOpen(true)}
                              title="Preview file"
                            >
                              <Eye className="size-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8 rounded-lg"
                              asChild
                              title="Open file"
                            >
                              <a
                                href={
                                  selectedDeliverableFile &&
                                  deliverablePreviewUrl
                                    ? deliverablePreviewUrl
                                    : getDeliverableUrl(fileKey)
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void handleDeleteDeliverable()}
                              disabled={isDeletingDeliverable}
                              title={
                                selectedDeliverableFile
                                  ? "Remove selection"
                                  : "Delete deliverable"
                              }
                            >
                              {isDeletingDeliverable ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Full preview modal */}
                        {isPreviewOpen &&
                          (fileKey || selectedDeliverableFile) && (
                            <div
                              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                              role="dialog"
                              aria-modal="true"
                              aria-label="Deliverable preview"
                              onClick={() => setIsPreviewOpen(false)}
                            >
                              <div
                                className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background shadow-xl"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="flex items-center justify-between border-b px-4 py-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                      {selectedDeliverableFile
                                        ? selectedDeliverableFile.name
                                        : getFileName(fileKey)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Deliverable Preview
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setIsPreviewOpen(false)}
                                    aria-label="Close preview"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>

                                <div className="min-h-0 flex-1 bg-muted/20 p-2">
                                  {selectedDeliverableFile &&
                                  deliverablePreviewUrl &&
                                  selectedDeliverableFile.type ===
                                    "application/pdf" ? (
                                    <PdfPreview
                                      key={`modal-${deliverablePreviewUrl}`}
                                      src={deliverablePreviewUrl}
                                      className="h-full w-full rounded-md"
                                      showAllPages={true}
                                    />
                                  ) : !selectedDeliverableFile &&
                                    fileKey &&
                                    isPdfFile(fileKey, fileType) ? (
                                    <PdfPreview
                                      key={`modal-${fileKey}`}
                                      src={`/api/manage/products/${product.id}/preview`}
                                      className="h-full w-full rounded-md"
                                      showAllPages={true}
                                    />
                                  ) : selectedDeliverableFile &&
                                    deliverablePreviewUrl &&
                                    selectedDeliverableFile.type.startsWith(
                                      "video/",
                                    ) ? (
                                    <video
                                      src={deliverablePreviewUrl}
                                      controls
                                      className="h-full w-full object-contain bg-black"
                                    />
                                  ) : !selectedDeliverableFile &&
                                    fileKey &&
                                    fileType.startsWith("video/") ? (
                                    <video
                                      src={getDeliverableUrl(fileKey)}
                                      controls
                                      className="h-full w-full object-contain bg-black"
                                    />
                                  ) : selectedDeliverableFile &&
                                    deliverablePreviewUrl &&
                                    selectedDeliverableFile.type.startsWith(
                                      "image/",
                                    ) ? (
                                    <div className="flex h-full items-center justify-center overflow-auto">
                                      <Image
                                        src={deliverablePreviewUrl}
                                        alt="Deliverable preview"
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    </div>
                                  ) : !selectedDeliverableFile &&
                                    fileKey &&
                                    fileType.startsWith("image/") ? (
                                    <div className="flex h-full items-center justify-center overflow-auto">
                                      <Image
                                        src={getDeliverableUrl(fileKey)}
                                        alt="Deliverable preview"
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-3">
                                      <FileText className="size-12 text-muted-foreground" />
                                      <p className="text-center text-sm text-muted-foreground">
                                        Preview is not available for this file
                                        type.
                                      </p>
                                      <Button type="button" asChild>
                                        <a
                                          href={
                                            selectedDeliverableFile &&
                                            deliverablePreviewUrl
                                              ? deliverablePreviewUrl
                                              : getDeliverableUrl(fileKey)
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          Open File
                                        </a>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* =================================================
                    COURSE CATEGORY
                ================================================= */}

                    {isCourse && (
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              Category
                            </FormLabel>

                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>

                              <SelectContent>
                                {courseCategories.map((item) => (
                                  <SelectItem key={item} value={item}>
                                    {item}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* ============================================================
                     PRODUCT CLASSIFICATION
                 ============================================================ */}

                    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs font-medium">
                              Product Type
                            </Label>

                            <Select
                              value={selectedProductType}
                              onValueChange={(value) => {
                                const newType = value as ProductType;
                                setSelectedProductType(newType);

                                form.setValue(
                                  "type",
                                  newType as ProductSchemaType["type"],
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                                <SelectValue placeholder="Select product type" />
                              </SelectTrigger>

                              <SelectContent>
                                {Object.values(ProductType).map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs font-medium">
                              Grade Level
                            </Label>

                            <Select
                              value={selectedGradeLevel}
                              onValueChange={(value) => {
                                const grade = value as GradeLevel;
                                setSelectedGradeLevel(grade);
                                setSelectedTopicId("");
                                form.setValue("gradeLevel", grade, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                form.setValue("topicId", "", {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                                <SelectValue placeholder="Select grade level" />
                              </SelectTrigger>

                              <SelectContent>
                                {Object.values(GradeLevel).map((grade) => (
                                  <SelectItem key={grade} value={grade}>
                                    {grade.replace("Grade", "Grade ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Subject</Label>

                          <Select
                            value={selectedSubjectId}
                            onValueChange={(value) => {
                              setSelectedSubjectId(value);
                              setSelectedTopicId("");
                              form.setValue("subjectId", value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              form.setValue("topicId", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue placeholder="Select subject" />
                            </SelectTrigger>

                            <SelectContent>
                              {subjects.map((subject) => (
                                <SelectItem key={subject.id} value={subject.id}>
                                  {subject.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium">Topic</Label>

                            {selectedSubjectId && selectedGradeLevel && (
                              <span className="text-[10px] text-muted-foreground">
                                {filteredTopics.length} available
                              </span>
                            )}
                          </div>

                          <Select
                            value={selectedTopicId}
                            onValueChange={(value) => {
                              setSelectedTopicId(value);
                              form.setValue("topicId", value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            disabled={!selectedSubjectId || !selectedGradeLevel}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue
                                placeholder={
                                  !selectedSubjectId
                                    ? "Select subject first"
                                    : !selectedGradeLevel
                                      ? "Select grade first"
                                      : "Select topic"
                                }
                              />
                            </SelectTrigger>

                            <SelectContent>
                              {filteredTopics.length > 0 ? (
                                filteredTopics.map((topic) => (
                                  <SelectItem key={topic.id} value={topic.id}>
                                    {topic.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-2 text-xs text-muted-foreground">
                                  {selectedSubjectId && selectedGradeLevel
                                    ? "No topics found."
                                    : "Select a subject & grade first."}
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* =================================================
                    PRICING
                ================================================= */}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              {isCourse
                                ? "Course Price ($)"
                                : "Digital Price ($)"}
                            </FormLabel>

                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="h-8 text-xs"
                                value={isCourse ? (field.value ?? 0) : price}
                                onChange={(e) => {
                                  const value = e.target.value;

                                  if (isCourse) {
                                    field.onChange(
                                      value === "" ? 0 : Number(value),
                                    );
                                  } else {
                                    setPrice(value);

                                    field.onChange(
                                      value === "" ? 0 : Number(value),
                                    );
                                  }
                                }}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {!isCourse && (
                        <FormField
                          control={form.control}
                          name="printedPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Printed Price ($)
                                <span className="ml-1 text-muted-foreground font-normal">
                                  Opt.
                                </span>
                              </FormLabel>

                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-8 text-xs"
                                  placeholder="e.g. 29.99"
                                  value={printedPrice}
                                  onChange={(e) => {
                                    const value = e.target.value;

                                    setPrintedPrice(value);

                                    field.onChange(
                                      value === "" ? undefined : Number(value),
                                    );
                                  }}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {isCourse && (
                        <FormField
                          control={form.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Duration (hrs)
                              </FormLabel>

                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  className="h-8 text-xs"
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    )
                                  }
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-9 shrink-0 rounded-lg px-3.5 text-xs font-semibold shadow-sm sm:px-4"
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-3.5" />
                      )}
                      {isUploadingImages
                        ? "Uploading..."
                        : pending
                          ? "Saving..."
                          : "Save Changes"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </form>
    </Form>
  );
}

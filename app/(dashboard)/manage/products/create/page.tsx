"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import slugify from "slugify";

import { useForm, useWatch, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  ArrowLeft,
  Loader2,
  SlidersHorizontal,
  DollarSign,
  Printer,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Infinity,
  Layers3,
} from "lucide-react";

import { toast } from "sonner";

/* ============================================================
   SCHEMAS
============================================================ */

import {
  productSchema,
  ProductSchemaType,
  productType,
  gradeLevels,
} from "@/lib/zodSchemas";

/* ============================================================
   SERVER ACTIONS
============================================================ */

import { CreateProduct } from "@/app/actions/manage-create-product";

import {
  GetProductSubjects,
  GetProductTopics,
} from "@/app/actions/manage-product-taxonomy";

/* ============================================================
   HELPERS
============================================================ */

import { tryCatch } from "@/hooks/try-catch";

/* ============================================================
   UI
============================================================ */

import { Button, buttonVariants } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";
import { RichTextEditor } from "@/app/_components/rich-text-editor/Editor";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";

/* ============================================================
   TYPES
============================================================ */

type ProductSubject = {
  id: string;
  name: string;
  description?: string | null;
};

type ProductTopic = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  gradeLevel: string;
  subjectId: string;
};

/* ============================================================
   COMPONENT
============================================================ */

export default function ProductCreation() {
  const router = useRouter();

  /* ============================================================
     STATE
  ============================================================ */

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [subjects, setSubjects] = useState<ProductSubject[]>([]);

  const [topics, setTopics] = useState<ProductTopic[]>([]);

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);

  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  /* ============================================================
     FORM
  ============================================================ */

  const form = useForm<ProductSchemaType>({
    resolver: zodResolver(productSchema) as Resolver<ProductSchemaType>,

    defaultValues: {
      title: "",

      description: "",

      price: undefined,

      printedPrice: undefined,

      type: "Course",

      gradeLevel: "Grade1",

      subjectId: "",

      topicId: "",

      status: "Draft",

      slug: "",

      fileKey: "",

      duration: null,

      category: "",
    },
  });

  /* ============================================================
     WATCH FORM VALUES
  ============================================================ */

  const slug = useWatch({
    control: form.control,
    name: "slug",
  });

  const selectedType = useWatch({
    control: form.control,
    name: "type",
  });

  const selectedGrade = useWatch({
    control: form.control,
    name: "gradeLevel",
  });

  const selectedSubjectId = useWatch({
    control: form.control,
    name: "subjectId",
  });

  const selectedTopicId = useWatch({
    control: form.control,
    name: "topicId",
  });

  const currentPrice = useWatch({
    control: form.control,
    name: "price",
  });

  const currentPrintedPrice = useWatch({
    control: form.control,
    name: "printedPrice",
  });

  const currentDuration = useWatch({
    control: form.control,
    name: "duration",
  });

  /* ============================================================
     DERIVED VALUES
  ============================================================ */

  const isWorksheet = selectedType === "Worksheets";

  const isWorkbook = selectedType === "Workbooks";

  const isCourse = selectedType === "Course";

  const isIndividualProduct = !isWorksheet;

  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedSubjectId,
  );

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);

  const selectedGradeLabel =
    gradeLevels.find((grade) => grade.value === selectedGrade)?.label ??
    "Not selected";

  /* ============================================================
     LOAD SUBJECTS
     
     Subjects are global.
     
     They DO NOT depend on grade level.
     
     This runs once when the page loads.
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    async function loadSubjects() {
      setIsLoadingSubjects(true);

      try {
        const result = await GetProductSubjects();

        if (!mounted) {
          return;
        }

        if (result.status === "success") {
          setSubjects(result.data);
        } else {
          setSubjects([]);

          toast.error(result.message ?? "Failed to load subjects.");
        }
      } catch (error) {
        console.error("Failed to load subjects:", error);

        if (mounted) {
          setSubjects([]);

          toast.error("Failed to load subjects.");
        }
      } finally {
        if (mounted) {
          setIsLoadingSubjects(false);
        }
      }
    }

    loadSubjects();

    return () => {
      mounted = false;
    };
  }, []);

  /* ============================================================
     LOAD TOPICS
     
     Topics depend on:

        Grade Level
              +
        Subject

     Example:

        Grade 1 + Mathematics
             ↓
        Addition
        Subtraction
        Place Value
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    async function loadTopics() {
      /*
       * No subject selected.
       *
       * There cannot be a useful topic list yet.
       */

      if (!selectedSubjectId) {
        setTopics([]);

        setIsLoadingTopics(false);

        return;
      }

      /*
       * Grade should normally always exist because
       * the form starts with Grade1.
       */

      if (!selectedGrade) {
        setTopics([]);

        setIsLoadingTopics(false);

        return;
      }

      setIsLoadingTopics(true);

      try {
        const result = await GetProductTopics(selectedGrade, selectedSubjectId);

        if (!mounted) {
          return;
        }

        if (result.status === "success") {
          setTopics(result.data);

          /*
           * Make sure the currently selected topic
           * still belongs to the new Grade + Subject.
           */

          const currentTopicId = form.getValues("topicId");

          if (
            currentTopicId &&
            !result.data.some((topic) => topic.id === currentTopicId)
          ) {
            form.setValue("topicId", "", {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
        } else {
          setTopics([]);

          form.setValue("topicId", "", {
            shouldValidate: true,
            shouldDirty: true,
          });

          toast.error(result.message ?? "Failed to load topics.");
        }
      } catch (error) {
        console.error("Failed to load topics:", error);

        if (mounted) {
          setTopics([]);

          form.setValue("topicId", "", {
            shouldValidate: true,
            shouldDirty: true,
          });

          toast.error("Failed to load topics.");
        }
      } finally {
        if (mounted) {
          setIsLoadingTopics(false);
        }
      }
    }

    loadTopics();

    return () => {
      mounted = false;
    };
  }, [selectedGrade, selectedSubjectId, form]);

  /* ============================================================
     HANDLE GRADE CHANGE
     
     IMPORTANT:
     
     Grade does NOT clear Subject.
     
     Subject is global.
     
     Grade only invalidates the Topic.
  ============================================================ */

  function handleGradeChange(value: ProductSchemaType["gradeLevel"]) {
    form.setValue("gradeLevel", value, {
      shouldValidate: true,
      shouldDirty: true,
    });

    /*
     * Topic belongs to a specific Grade + Subject.
     * Therefore changing Grade invalidates Topic.
     */

    form.setValue("topicId", "", {
      shouldValidate: true,
      shouldDirty: true,
    });

    setTopics([]);
  }

  /* ============================================================
     HANDLE SUBJECT CHANGE
     
     Subject is independent of Grade.
     
     Changing Subject only invalidates Topic.
  ============================================================ */

  function handleSubjectChange(value: string) {
    form.setValue("subjectId", value, {
      shouldValidate: true,
      shouldDirty: true,
    });

    /*
     * Topic belongs to a specific Subject.
     */

    form.setValue("topicId", "", {
      shouldValidate: true,
      shouldDirty: true,
    });

    setTopics([]);
  }

  /* ============================================================
     HANDLE PRODUCT TYPE CHANGE
  ============================================================ */

  function handleProductTypeChange(value: ProductSchemaType["type"]) {
    form.setValue("type", value, {
      shouldValidate: true,
      shouldDirty: true,
    });

    /* ----------------------------------------------------------
       WORKSHEETS

       Subscription only.

       No individual price.
       No printed price.
    ---------------------------------------------------------- */

    if (value === "Worksheets") {
      form.setValue("price", undefined);

      form.setValue("printedPrice", undefined);

      form.setValue("duration", null);

      form.setValue("category", "");
    }

    /* ----------------------------------------------------------
       COURSE

       Individual price.
       No printed price.
    ---------------------------------------------------------- */

    if (value === "Course") {
      form.setValue("printedPrice", undefined);
    }

    /* ----------------------------------------------------------
       NON-COURSE

       Clear course-specific fields.
    ---------------------------------------------------------- */

    if (value !== "Course") {
      form.setValue("duration", null);

      form.setValue("category", "");
    }
  }

  /* ============================================================
     PRODUCT TYPE DESCRIPTION
  ============================================================ */

  function getProductTypeDescription() {
    if (isWorksheet) {
      return "Included with the applicable grade-level subscription.";
    }

    if (isWorkbook) {
      return "Sold individually as a digital workbook, with an optional printed version.";
    }

    if (isCourse) {
      return "Sold individually with access to the complete course.";
    }

    return "Sold individually as a digital product.";
  }

  /* ============================================================
     SUBMIT
  ============================================================ */

  async function handleProcess(values: ProductSchemaType) {
    setIsSubmitting(true);

    try {
      /* --------------------------------------------------------
         FINAL CLIENT VALIDATION
      -------------------------------------------------------- */

      if (!values.gradeLevel) {
        toast.error("Please select a grade level.");

        return;
      }

      if (!values.subjectId) {
        toast.error("Please select a subject.");

        return;
      }

      if (!values.topicId) {
        toast.error("Please select a topic.");

        return;
      }

      /* --------------------------------------------------------
         CLEAN SUBMISSION PAYLOAD
      -------------------------------------------------------- */

      const submissionData: ProductSchemaType = {
        ...values,

        /*
         * Products are always created as Draft.
         */

        status: "Draft",

        /*
         * Worksheets are subscription-only.
         */

        price: values.type === "Worksheets" ? undefined : values.price,

        /*
         * Only Workbooks may have a printed price.
         */

        printedPrice:
          values.type === "Workbooks" ? values.printedPrice : undefined,

        /*
         * Course-specific fields.
         */

        duration: values.type === "Course" ? values.duration : null,

        category: values.type === "Course" ? values.category : "",

        /*
         * Normalize IDs.
         */

        subjectId: values.subjectId.trim(),

        topicId: values.topicId.trim(),

        /*
         * Normalize text.
         */

        title: values.title.trim(),

        description: values.description.trim(),

        slug: values.slug.trim(),
      };

      /* --------------------------------------------------------
         CREATE PRODUCT
      -------------------------------------------------------- */

      const { data: result, error } = await tryCatch(
        CreateProduct(submissionData),
      );

      if (error) {
        console.error("CreateProduct error:", error);

        toast.error("An unexpected error occurred.");

        return;
      }

      /* --------------------------------------------------------
         SUCCESS
      -------------------------------------------------------- */

      if (result.status === "success") {
        toast.success("Product saved successfully!");

        form.reset();

        setTopics([]);

        router.push("/manage/products");

        return;
      }

      /* --------------------------------------------------------
         SERVER ERROR
      -------------------------------------------------------- */

      if (result.status === "error") {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Product creation error:", error);

      toast.error("Something went wrong processing your submission.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleProcess)}
        className="max-w-6xl w-full mx-auto px-0 py-8 lg:py-5 space-y-5"
      >
        {/* ======================================================
            TOP CONTROL BAR
        ====================================================== */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div className="flex items-center gap-4">
            <Link
              href="/manage/products"
              className={buttonVariants({
                variant: "ghost",
                size: "icon",
              })}
            >
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Create a new product
              </h1>

              <p className="text-sm text-muted-foreground mt-1">
                Organize your resource by grade, subject, and topic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Link
              href="/manage/products"
              className={buttonVariants({
                variant: "ghost",
              })}
            >
              Cancel
            </Link>

            <Button type="submit" disabled={isSubmitting} className="min-w-32">
              {isSubmitting && <Loader2 className="animate-spin mr-2 size-4" />}

              {isSubmitting ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </div>

        {/* ======================================================
            CONTENT
        ====================================================== */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* ====================================================
              MAIN COLUMN
          ==================================================== */}

          <div className="lg:col-span-2 space-y-6">
            {/* ==================================================
                BASIC INFORMATION
            ================================================== */}

            <Card className="border-border bg-card/50 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* PRODUCT TITLE */}

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Product Name
                      </FormLabel>

                      <FormControl>
                        <Input
                          className="h-11 shadow-sm"
                          placeholder="e.g. Grade 1 Two-Digit Addition Workbook"
                          {...field}
                          onChange={(event) => {
                            field.onChange(event);

                            form.setValue(
                              "slug",
                              slugify(event.target.value, {
                                lower: true,
                                strict: true,
                              }),
                            );
                          }}
                        />
                      </FormControl>

                      {slug && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          URL:{" "}
                          <span className="font-mono text-primary">
                            /products/
                            {slug}
                          </span>
                        </p>
                      )}

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* DESCRIPTION */}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Full Description
                      </FormLabel>

                      <FormControl>
                        <div className="min-h-75 border border-input rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
                          <RichTextEditor field={field} />
                        </div>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* ====================================================
              SIDEBAR
          ==================================================== */}

          <div className="space-y-4 lg:sticky lg:top-6">
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader className="px-4 py-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  Product Settings
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* ============================================================
          PRODUCT TYPE + GRADE LEVEL
      ============================================================ */}

                <div className="grid grid-cols-2 gap-3">
                  {/* PRODUCT TYPE */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium text-foreground">
                          Product Type
                        </FormLabel>

                        <Select
                          value={field.value}
                          onValueChange={handleProductTypeChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full text-sm">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>

                          <SelectContent>
                            {productType.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* GRADE LEVEL */}
                  <FormField
                    control={form.control}
                    name="gradeLevel"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium flex items-center gap-1.5">
                          <GraduationCap className="size-3.5 text-muted-foreground" />
                          Grade
                        </FormLabel>

                        <Select
                          value={field.value}
                          onValueChange={handleGradeChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full text-sm">
                              <SelectValue placeholder="Select grade" />
                            </SelectTrigger>
                          </FormControl>

                          <SelectContent>
                            {gradeLevels.map((grade) => (
                              <SelectItem key={grade.value} value={grade.value}>
                                {grade.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ============================================================
          SUBJECT
      ============================================================ */}

                <FormField
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium flex items-center gap-1.5">
                        <BookOpen className="size-3.5 text-muted-foreground" />
                        Subject
                      </FormLabel>

                      <Select
                        value={field.value}
                        onValueChange={handleSubjectChange}
                        disabled={isLoadingSubjects}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full text-sm">
                            <SelectValue
                              placeholder={
                                isLoadingSubjects
                                  ? "Loading subjects..."
                                  : subjects.length === 0
                                    ? "No subjects available"
                                    : "Select subject"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <FormMessage />

                      {!isLoadingSubjects && subjects.length === 0 && (
                        <div className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                          No subjects available. Create a subject first.
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                {/* ============================================================
          TOPIC
      ============================================================ */}

                <FormField
                  control={form.control}
                  name="topicId"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium flex items-center gap-1.5">
                        <Layers3 className="size-3.5 text-muted-foreground" />
                        Topic
                      </FormLabel>

                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={
                          !selectedGrade ||
                          !selectedSubjectId ||
                          isLoadingTopics ||
                          topics.length === 0
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full text-sm">
                            <SelectValue
                              placeholder={
                                !selectedGrade
                                  ? "Select grade first"
                                  : !selectedSubjectId
                                    ? "Select subject first"
                                    : isLoadingTopics
                                      ? "Loading topics..."
                                      : topics.length === 0
                                        ? "No topics available"
                                        : "Select topic"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          {topics.map((topic) => (
                            <SelectItem key={topic.id} value={topic.id}>
                              {topic.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <FormMessage />

                      {selectedSubjectId &&
                        !isLoadingTopics &&
                        topics.length === 0 && (
                          <div className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                            No topics exist for this grade and subject.
                          </div>
                        )}
                    </FormItem>
                  )}
                />

                {/* ============================================================
          PRICING
      ============================================================ */}

                {isIndividualProduct && (
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 pt-1 border-t border-border/50">
                        <FormLabel className="text-xs font-medium pt-3">
                          {isCourse ? "Course Price" : "Digital Price"}
                        </FormLabel>

                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />

                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-10 pl-9 text-sm"
                              placeholder={isCourse ? "29.99" : "7.00"}
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;

                                field.onChange(
                                  value === "" ? undefined : Number(value),
                                );
                              }}
                            />
                          </div>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* ============================================================
          PRINTED PRICE
      ============================================================ */}

                {isWorkbook && (
                  <FormField
                    control={form.control}
                    name="printedPrice"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 pt-1 border-t border-border/50">
                        <FormLabel className="text-xs font-medium flex items-center gap-1.5 pt-3">
                          <Printer className="size-3.5 text-muted-foreground" />
                          Printed Price
                          <span className="text-[10px] font-normal text-muted-foreground">
                            Optional
                          </span>
                        </FormLabel>

                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />

                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-10 pl-9 text-sm"
                              placeholder="12.99"
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;

                                field.onChange(
                                  value === "" ? undefined : Number(value),
                                );
                              }}
                            />
                          </div>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* ============================================================
          COURSE DURATION
      ============================================================ */}

                {isCourse && (
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 pt-1 border-t border-border/50">
                        <FormLabel className="text-xs font-medium pt-3">
                          Course Duration
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            className="h-10 text-sm"
                            placeholder="e.g. 8"
                            value={field.value ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;

                              field.onChange(
                                value === "" ? null : Number(value),
                              );
                            }}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}

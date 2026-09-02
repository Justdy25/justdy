"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Edit3,
  Filter,
  GraduationCap,
  Layers3,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { toast } from "sonner";

import {
  CreateAcademicSubject,
  CreateAcademicTopic,
  DeleteAcademicSubject,
  DeleteAcademicTopic,
  GetAcademicSubjects,
  GetAcademicTopics,
  UpdateAcademicSubject,
  UpdateAcademicTopic,
  AcademicSubject,
  AcademicTopic,
} from "@/app/actions/manage-academic-content";

import {
  createSubjectSchema,
  createTopicSchema,
  updateSubjectSchema,
  updateTopicSchema,
  gradeLevels,
} from "@/lib/zodSchemas";

import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/_components/ui/dropdown-menu";

import { Badge } from "@/app/_components/ui/badge";

/* ============================================================
   COMPONENT
============================================================ */

export default function AcademicContentManager() {
  const [activeTab, setActiveTab] = useState<"subjects" | "topics">("subjects");

  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [topics, setTopics] = useState<AcademicTopic[]>([]);

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  const [search, setSearch] = useState("");

  const [selectedGrade, setSelectedGrade] = useState<string>("all");

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");

  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);

  const [topicDialogOpen, setTopicDialogOpen] = useState(false);

  const [editingSubject, setEditingSubject] = useState<AcademicSubject | null>(
    null,
  );

  const [editingTopic, setEditingTopic] = useState<AcademicTopic | null>(null);

  /* ============================================================
     LOAD SUBJECTS
  ============================================================ */

  const loadSubjects = useCallback(async () => {
    setIsLoadingSubjects(true);

    try {
      const result = await GetAcademicSubjects();

      if (result.status === "success") {
        setSubjects(result.data);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Failed to load subjects:", error);
      toast.error("Failed to load subjects.");
    } finally {
      setIsLoadingSubjects(false);
    }
  }, []);

  /* ============================================================
     LOAD TOPICS
  ============================================================ */

  const loadTopics = useCallback(async () => {
    setIsLoadingTopics(true);

    try {
      const result = await GetAcademicTopics({
        gradeLevel: selectedGrade === "all" ? undefined : selectedGrade,

        subjectId: selectedSubjectId === "all" ? undefined : selectedSubjectId,
      });

      if (result.status === "success") {
        setTopics(result.data);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Failed to load topics:", error);
      toast.error("Failed to load topics.");
    } finally {
      setIsLoadingTopics(false);
    }
  }, [selectedGrade, selectedSubjectId]);

  /* ============================================================
     INITIAL SUBJECT LOAD
  ============================================================ */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSubjects();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSubjects]);

  /* ============================================================
     LOAD TOPICS WHEN TAB / FILTERS CHANGE
  ============================================================ */

  useEffect(() => {
    if (activeTab !== "topics") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadTopics();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeTab, loadTopics]);

  /* ============================================================
     SUBJECT MAP
  ============================================================ */

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  /* ============================================================
     FILTER SUBJECTS
  ============================================================ */

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return subjects;
    }

    return subjects.filter((subject) => {
      return (
        subject.name.toLowerCase().includes(query) ||
        subject.description?.toLowerCase().includes(query)
      );
    });
  }, [subjects, search]);

  /* ============================================================
     FILTER TOPICS
  ============================================================ */

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return topics;
    }

    return topics.filter((topic) => {
      const subject = subjectMap.get(topic.subjectId);

      return (
        topic.name.toLowerCase().includes(query) ||
        subject?.name.toLowerCase().includes(query)
      );
    });
  }, [topics, subjectMap, search]);

  /* ============================================================
     TOTAL PRODUCTS
  ============================================================ */

  const totalProducts = useMemo(() => {
    return topics.reduce(
      (total, topic) => total + (topic.productCount ?? 0),
      0,
    );
  }, [topics]);

  /* ============================================================
     SELECTED SUBJECT
  ============================================================ */

  const selectedSubject = useMemo(() => {
    if (selectedSubjectId === "all") {
      return null;
    }

    return subjectMap.get(selectedSubjectId) ?? null;
  }, [selectedSubjectId, subjectMap]);

  /* ============================================================
     OPEN CREATE SUBJECT
  ============================================================ */

  function openCreateSubject() {
    setEditingSubject(null);
    setSubjectDialogOpen(true);
  }

  /* ============================================================
     OPEN EDIT SUBJECT
  ============================================================ */

  function openEditSubject(subject: AcademicSubject) {
    setEditingSubject(subject);
    setSubjectDialogOpen(true);
  }

  /* ============================================================
     OPEN CREATE TOPIC
  ============================================================ */

  function openCreateTopic() {
    setEditingTopic(null);
    setTopicDialogOpen(true);
  }

  /* ============================================================
     OPEN EDIT TOPIC
  ============================================================ */

  function openEditTopic(topic: AcademicTopic) {
    setEditingTopic(topic);
    setTopicDialogOpen(true);
  }

  /* ============================================================
     DELETE SUBJECT
  ============================================================ */

  async function handleDeleteSubject(subject: AcademicSubject) {
    const confirmed = window.confirm(
      `Delete "${subject.name}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await DeleteAcademicSubject(subject.id);

      if (result.status === "success") {
        toast.success(result.message);

        await loadSubjects();

        if (activeTab === "topics") {
          await loadTopics();
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
      toast.error("Failed to delete subject.");
    }
  }

  /* ============================================================
     DELETE TOPIC
  ============================================================ */

  async function handleDeleteTopic(topic: AcademicTopic) {
    const confirmed = window.confirm(
      `Delete "${topic.name}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await DeleteAcademicTopic(topic.id);

      if (result.status === "success") {
        toast.success(result.message);

        await loadTopics();
        await loadSubjects();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Failed to delete topic:", error);
      toast.error("Failed to delete topic.");
    }
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="min-h-full bg-muted/20">
      <div className="mx-auto max-w-360 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm sm:flex">
              <GraduationCap className="size-6" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Academic Content
              </h1>
            </div>
          </div>

          <Button
            onClick={
              activeTab === "subjects" ? openCreateSubject : openCreateTopic
            }
            className="h-10 gap-2 rounded-md px-4 shadow-sm"
          >
            <Plus className="size-4" />

            {activeTab === "subjects" ? "New Subject" : "New Topic"}
          </Button>
        </div>

        {/* ======================================================
            KPI CARDS
        ====================================================== */}

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            icon={BookOpen}
            label="Subjects"
            value={subjects.length}
            description="Curriculum subjects"
          />

          <MetricCard
            icon={Layers3}
            label="Topics"
            value={topics.length}
            description="Organized topics"
          />

          <MetricCard
            icon={Users}
            label="Resources"
            value={totalProducts}
            description="Linked products"
          />

          <MetricCard
            icon={GraduationCap}
            label="Grade Levels"
            value={12}
            description="Grade 1 through 12"
          />
        </div>

        {/* ======================================================
            MAIN WORKSPACE
        ====================================================== */}

        <div className="mt-7 overflow-hidden rounded-md border bg-background shadow-sm">
          {/* WORKSPACE HEADER */}

          <div className="border-b px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("subjects");
                    setSearch("");
                  }}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    activeTab === "subjects"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Subjects
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("topics");
                    setSearch("");
                  }}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    activeTab === "topics"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Topics
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-md bg-emerald-500" />
                Curriculum system active
              </div>
            </div>
          </div>

          {/* ====================================================
              SUBJECT WORKSPACE
          ==================================================== */}

          {activeTab === "subjects" && (
            <div className="p-5 sm:p-6">
              {/* SUBJECT SEARCH */}

              <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search subjects..."
                    className="h-10 rounded-md border-muted-foreground/20 bg-muted/30 pl-10"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={openCreateSubject}
                  className="h-10 gap-2 rounded-md"
                >
                  <Plus className="size-4" />
                  Add Subject
                </Button>
              </div>

              {isLoadingSubjects ? (
                <LoadingState />
              ) : filteredSubjects.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={search ? "No subjects found" : "No subjects yet"}
                  description={
                    search
                      ? "Try adjusting your search."
                      : "Create your first academic subject to start organizing your curriculum."
                  }
                  actionLabel="Create Subject"
                  onAction={openCreateSubject}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSubjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="group relative overflow-hidden rounded-md border bg-background transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-primary/80 opacity-0 transition-opacity group-hover:opacity-100" />

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <BookOpen className="size-5" />
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate font-semibold">
                                {subject.name}
                              </h3>

                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {subject.topicCount}{" "}
                                {subject.topicCount === 1 ? "topic" : "topics"}
                              </p>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 rounded-md opacity-70 hover:opacity-100"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditSubject(subject)}
                              >
                                <Edit3 className="mr-2 size-4" />
                                Edit subject
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteSubject(subject)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete subject
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <p className="mt-5 min-h-10 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {subject.description ||
                            "No description has been added for this subject."}
                        </p>

                        <div className="mt-5 flex items-center justify-between border-t pt-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Layers3 className="size-3.5" />
                            {subject.topicCount} topics
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectId(subject.id);
                              setActiveTab("topics");
                              setSearch("");
                            }}
                            className="flex items-center gap-1 text-xs font-medium text-primary transition-all hover:gap-2"
                          >
                            View topics
                            <ArrowUpRight className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====================================================
              TOPIC WORKSPACE
          ==================================================== */}

          {activeTab === "topics" && (
            <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
              {/* ==================================================
                  SUBJECT SIDEBAR
              ================================================== */}

              <aside className="border-b bg-muted/20 lg:border-b-0 lg:border-r">
                <div className="border-b px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Subjects
                  </p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Filter topics by subject
                  </p>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId("all")}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition ${
                      selectedSubjectId === "all"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Layers3 className="size-4" />
                      All subjects
                    </span>

                    {selectedSubjectId === "all" && (
                      <Check className="size-4" />
                    )}
                  </button>

                  <div className="mt-1 space-y-0.5">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => setSelectedSubjectId(subject.id)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition ${
                          selectedSubjectId === subject.id
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <BookOpen className="size-4 shrink-0" />

                          <span className="truncate">{subject.name}</span>
                        </span>

                        <span className="ml-2 text-xs tabular-nums">
                          {subject.topicCount}
                        </span>
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    onClick={openCreateSubject}
                    className="mt-2 w-full justify-start gap-2 rounded-md text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    Add subject
                  </Button>
                </div>
              </aside>

              {/* ==================================================
                  TOPIC CONTENT
              ================================================== */}

              <section className="min-w-0">
                {/* TOPIC TOOLBAR */}

                <div className="border-b p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">
                          {selectedSubject?.name ?? "All Topics"}
                        </h2>

                        <Badge
                          variant="secondary"
                          className="rounded-md px-2.5"
                        >
                          {filteredTopics.length}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Manage topics across your curriculum.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative min-w-0 sm:w-64">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search topics..."
                          className="h-9 rounded-md pl-9"
                        />
                      </div>

                      <Select
                        value={selectedGrade}
                        onValueChange={setSelectedGrade}
                      >
                        <SelectTrigger className="h-9 w-full rounded-md sm:w-40">
                          <Filter className="mr-2 size-3.5 text-muted-foreground" />
                          <SelectValue placeholder="All grades" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="all">All grades</SelectItem>

                          {gradeLevels.map((grade) => (
                            <SelectItem key={grade.value} value={grade.value}>
                              {grade.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        onClick={openCreateTopic}
                        className="h-9 gap-2 rounded-md"
                      >
                        <Plus className="size-4" />
                        Add Topic
                      </Button>
                    </div>
                  </div>
                </div>

                {/* TOPIC LIST */}

                <div className="p-4 sm:p-5">
                  {isLoadingTopics ? (
                    <LoadingState />
                  ) : filteredTopics.length === 0 ? (
                    <EmptyState
                      icon={Layers3}
                      title="No topics found"
                      description={
                        search || selectedGrade !== "all"
                          ? "Try changing your search or filters."
                          : "Create your first topic and assign it to a subject and grade."
                      }
                      actionLabel="Create Topic"
                      onAction={openCreateTopic}
                    />
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      {/* DESKTOP TABLE HEADER */}

                      <div className="hidden grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_120px_110px_48px] items-center gap-4 border-b bg-muted/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                        <span>Topic</span>
                        <span>Subject</span>
                        <span>Grade</span>
                        <span>Resources</span>
                        <span />
                      </div>

                      {/* TABLE BODY */}

                      <div className="divide-y">
                        {filteredTopics.map((topic) => {
                          const subject = subjectMap.get(topic.subjectId);

                          const gradeLabel =
                            gradeLevels.find(
                              (grade) => grade.value === topic.gradeLevel,
                            )?.label ?? topic.gradeLevel;

                          return (
                            <div
                              key={topic.id}
                              className="group grid gap-4 px-4 py-4 transition hover:bg-muted/20 md:grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_120px_110px_48px] md:items-center"
                            >
                              {/* TOPIC */}

                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <div className="hidden size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary sm:flex">
                                    <Layers3 className="size-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {topic.name}
                                    </p>

                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                      /{topic.slug}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* SUBJECT */}

                              <div>
                                <Badge
                                  variant="secondary"
                                  className="rounded-md font-medium"
                                >
                                  {subject?.name ?? "Unknown subject"}
                                </Badge>
                              </div>

                              {/* GRADE */}

                              <div>
                                <span className="inline-flex rounded-md border bg-background px-2.5 py-1 text-xs font-medium">
                                  {gradeLabel}
                                </span>
                              </div>

                              {/* RESOURCES */}

                              <div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium tabular-nums">
                                    {topic.productCount ?? 0}
                                  </span>

                                  <span className="text-xs text-muted-foreground">
                                    resources
                                  </span>
                                </div>
                              </div>

                              {/* ACTIONS */}

                              <div className="flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 rounded-md"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => openEditTopic(topic)}
                                    >
                                      <Edit3 className="mr-2 size-4" />
                                      Edit topic
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteTopic(topic)}
                                    >
                                      <Trash2 className="mr-2 size-4" />
                                      Delete topic
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ======================================================
              SUBJECT DIALOG
          ====================================================== */}

          <SubjectDialog
            key={editingSubject?.id ?? "new-subject"}
            open={subjectDialogOpen}
            onOpenChange={setSubjectDialogOpen}
            subject={editingSubject}
            onSaved={loadSubjects}
          />

          {/* ======================================================
              TOPIC DIALOG
          ====================================================== */}

          <TopicDialog
            key={editingTopic?.id ?? "new-topic"}
            open={topicDialogOpen}
            onOpenChange={setTopicDialogOpen}
            topic={editingTopic}
            subjects={subjects}
            onSaved={async () => {
              await loadSubjects();

              if (activeTab === "topics") {
                await loadTopics();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   METRIC CARD
============================================================ */

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-md border bg-background p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>

          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {value}
          </p>

          <p className="mt-1 text-[11px] text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SUBJECT DIALOG
============================================================ */

function SubjectDialog({
  open,
  onOpenChange,
  subject,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: AcademicSubject | null;
  onSaved: () => Promise<void>;
}) {
  /*
   * No useEffect here.
   *
   * The parent supplies a changing key based on the subject ID.
   * That allows the form to initialize correctly without calling
   * setState inside an effect.
   */

  const [name, setName] = useState(() => subject?.name ?? "");

  const [description, setDescription] = useState(
    () => subject?.description ?? "",
  );

  const [isSaving, setIsSaving] = useState(false);

  /* ============================================================
     SUBMIT
  ============================================================ */

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setIsSaving(true);

    try {
      /* ========================================================
         UPDATE
      ======================================================== */

      if (subject) {
        const validation = updateSubjectSchema.safeParse({
          id: subject.id,
          name,
          description,
        });

        if (!validation.success) {
          toast.error(
            validation.error.issues[0]?.message ?? "Invalid subject.",
          );

          return;
        }

        const result = await UpdateAcademicSubject(validation.data);

        if (result.status === "success") {
          toast.success(result.message);

          onOpenChange(false);

          await onSaved();
        } else {
          toast.error(result.message);
        }

        return;
      }

      /* ========================================================
         CREATE
      ======================================================== */

      const validation = createSubjectSchema.safeParse({
        name,
        description,
      });

      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message ?? "Invalid subject.");

        return;
      }

      const result = await CreateAcademicSubject(validation.data);

      if (result.status === "success") {
        toast.success(result.message);

        onOpenChange(false);

        await onSaved();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Subject save error:", error);

      toast.error("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          {/* HEADER */}

          <div className="border-b bg-muted/20 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="size-5" />
              </div>

              <DialogHeader className="space-y-1 text-left">
                <DialogTitle>
                  {subject ? "Edit Subject" : "Create Subject"}
                </DialogTitle>

                <DialogDescription>
                  {subject
                    ? "Update the subject information below."
                    : "Add a subject to organize your academic curriculum."}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* FORM */}

          <div className="space-y-5 px-6 py-6">
            {/* SUBJECT NAME */}

            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Name</label>

              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Mathematics"
                autoFocus
                className="h-11 rounded-xl"
              />

              <p className="text-xs text-muted-foreground">
                Use a clear name learners and administrators will recognize.
              </p>
            </div>

            {/* DESCRIPTION */}

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Brief description of this subject..."
                className="min-h-28 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* FOOTER */}

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl"
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isSaving} className="rounded-xl">
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}

              {subject ? "Save Changes" : "Create Subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   TOPIC DIALOG
============================================================ */

function TopicDialog({
  open,
  onOpenChange,
  topic,
  subjects,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: AcademicTopic | null;
  subjects: AcademicSubject[];
  onSaved: () => Promise<void>;
}) {
  /*
   * Topic DOES NOT have a description field.
   *
   * We only submit:
   *
   * {
   *   name,
   *   gradeLevel,
   *   subjectId
   * }
   */

  const [name, setName] = useState(() => topic?.name ?? "");

  const [gradeLevel, setGradeLevel] = useState<string>(
    () => topic?.gradeLevel ?? "",
  );

  const [subjectId, setSubjectId] = useState<string>(
    () => topic?.subjectId ?? "",
  );

  const [isSaving, setIsSaving] = useState(false);

  /* ============================================================
     SUBMIT
  ============================================================ */

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setIsSaving(true);

    try {
      /* ========================================================
         UPDATE TOPIC
      ======================================================== */

      if (topic) {
        const validation = updateTopicSchema.safeParse({
          id: topic.id,
          name,
          gradeLevel,
          subjectId,
        });

        if (!validation.success) {
          toast.error(validation.error.issues[0]?.message ?? "Invalid topic.");

          return;
        }

        const result = await UpdateAcademicTopic(validation.data);

        if (result.status === "success") {
          toast.success(result.message);

          onOpenChange(false);

          await onSaved();
        } else {
          toast.error(result.message);
        }

        return;
      }

      /* ========================================================
         CREATE TOPIC
      ======================================================== */

      const validation = createTopicSchema.safeParse({
        name,
        gradeLevel,
        subjectId,
      });

      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message ?? "Invalid topic.");

        return;
      }

      const result = await CreateAcademicTopic(validation.data);

      if (result.status === "success") {
        toast.success(result.message);

        onOpenChange(false);

        await onSaved();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Topic save error:", error);

      toast.error("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          {/* HEADER */}

          <div className="border-b bg-muted/20 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers3 className="size-5" />
              </div>

              <DialogHeader className="space-y-1 text-left">
                <DialogTitle>
                  {topic ? "Edit Topic" : "Create Topic"}
                </DialogTitle>

                <DialogDescription>
                  {topic
                    ? "Update this topic's curriculum assignment."
                    : "Assign this topic to a grade level and subject."}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* FORM */}

          <div className="space-y-5 px-6 py-6">
            {/* TOPIC NAME */}

            <div className="space-y-2">
              <label className="text-sm font-medium">Topic Name</label>

              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Addition of Two-Digit Numbers"
                autoFocus
                className="h-11 rounded-xl"
              />

              <p className="text-xs text-muted-foreground">
                Give the topic a clear, learner-friendly name.
              </p>
            </div>

            {/* GRADE */}

            <div className="space-y-2">
              <label className="text-sm font-medium">Grade Level</label>

              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select grade level" />
                </SelectTrigger>

                <SelectContent>
                  {gradeLevels.map((grade) => (
                    <SelectItem key={grade.value} value={grade.value}>
                      {grade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                Choose the grade level where this topic belongs.
              </p>
            </div>

            {/* SUBJECT */}

            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>

              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="h-11 rounded-xl">
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

              {subjects.length === 0 && (
                <p className="text-xs text-destructive">
                  Create a subject before creating a topic.
                </p>
              )}
            </div>

            {/* PREVIEW */}

            {name && gradeLevel && subjectId && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  Assignment preview
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="rounded-lg">
                    {subjects.find((subject) => subject.id === subjectId)
                      ?.name ?? "Subject"}
                  </Badge>

                  <ChevronRight className="size-4 text-muted-foreground" />

                  <Badge variant="secondary" className="rounded-lg">
                    {gradeLevels.find((grade) => grade.value === gradeLevel)
                      ?.label ?? gradeLevel}
                  </Badge>

                  <ChevronRight className="size-4 text-muted-foreground" />

                  <span className="font-medium">{name}</span>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSaving || subjects.length === 0}
              className="rounded-xl"
            >
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}

              {topic ? "Save Changes" : "Create Topic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   LOADING STATE
============================================================ */

function LoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-2xl border bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Loader2 className="size-5 animate-spin" />
        </div>

        <div>
          <p className="text-sm font-medium">Loading academic content</p>

          <p className="mt-1 text-xs text-muted-foreground">
            Preparing your curriculum workspace...
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed bg-background px-6 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>

      <h3 className="text-lg font-semibold">{title}</h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <Button onClick={onAction} className="mt-6 gap-2 rounded-xl">
        <Plus className="size-4" />
        {actionLabel}
      </Button>
    </div>
  );
}

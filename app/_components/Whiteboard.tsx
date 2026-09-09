"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  useId,
} from "react";
import {
  Circle,
  Copy,
  MousePointer2,
  Download,
  Eraser,
  FolderOpen,
  Maximize2,
  Minimize2,
  Minus,
  PenLine,
  Redo2,
  Save,
  Sigma,
  Square,
  Triangle,
  Type,
  Undo2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Layers3,
  Plus,
  Ruler,
  BookOpen,
  X,
  PanelRight,
  Shapes,
  Crosshair,
  Trash2,
  FunctionSquare,
  Settings2,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import MyLogo from "@/app/_components/Logo";

type Tool =
  | "select"
  | "pen"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle"
  | "triangle"
  | "text"
  | "equation"
  | "axes"
  | "ruler";

type Point = {
  x: number;
  y: number;
};

type StrokeElement = {
  id: string;
  type: "stroke";
  points: Point[];
  color: string;
  width: number;
  pressureSensitive: boolean;
};

type ShapeType = "line" | "rectangle" | "circle" | "triangle" | "axes";

type ShapeElement = {
  id: string;
  type: ShapeType;
  start: Point;
  end: Point;
  color: string;
  width: number;
};

type ImageElement = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  name?: string;
};

type TextElement = {
  id: string;
  type: "text" | "equation";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type WhiteboardElement =
  | StrokeElement
  | ShapeElement
  | TextElement
  | ImageElement;

type WhiteboardPage = {
  id: string;
  name: string;
  elements: WhiteboardElement[];
};

type FormulaCategory =
  | "algebra"
  | "geometry"
  | "calculus"
  | "trigonometry"
  | "statistics"
  | "physics";

type WhiteboardMode = "standalone" | "appointment";

export type WhiteboardRealtimeData = {
  version: number;
  whiteboardId?: string;
  mode?: WhiteboardMode;
  appointmentId?: string;
  pages: WhiteboardPage[];
  currentPageIndex: number;
  showGrid: boolean;
  backgroundColor: string;
  backgroundImage: string | null;
  gridColor: string;
  snapToGrid: boolean;
  color: string;
  width: number;
  tool: Tool;
  formulaCategory: FormulaCategory;
  savedAt?: string;
  /** Runtime-only realtime ordering metadata. */
  realtimeOriginId?: string;
  realtimeRevision?: number;
};

type WhiteboardProps = {
  mode: WhiteboardMode;
  appointmentId?: string;
  onRealtimeChange?: (data: WhiteboardRealtimeData) => void;
  onReady?: (data: WhiteboardRealtimeData) => void;
  remoteData?: WhiteboardRealtimeData | null;
};

type SavedWhiteboardData = {
  version?: number;
  whiteboardId?: string;
  mode?: WhiteboardMode;
  appointmentId?: string;
  pages?: WhiteboardPage[];
  currentPageIndex?: number;
  showGrid?: boolean;
  backgroundColor?: string;
  backgroundImage?: string | null;
  gridColor?: string;
  snapToGrid?: boolean;
  color?: string;
  width?: number;
  tool?: Tool;
  formulaCategory?: FormulaCategory;
  savedAt?: string;
  realtimeOriginId?: string;
  realtimeRevision?: number;
};

const FORMULA_CATEGORIES: readonly FormulaCategory[] = [
  "algebra",
  "geometry",
  "calculus",
  "trigonometry",
  "statistics",
  "physics",
];

function isTool(value: unknown): value is Tool {
  return (
    value === "select" ||
    value === "pen" ||
    value === "eraser" ||
    value === "line" ||
    value === "rectangle" ||
    value === "circle" ||
    value === "triangle" ||
    value === "text" ||
    value === "equation" ||
    value === "axes" ||
    value === "ruler"
  );
}

function isFormulaCategory(value: unknown): value is FormulaCategory {
  return (
    typeof value === "string" &&
    FORMULA_CATEGORIES.includes(value as FormulaCategory)
  );
}

function parseSavedBoardData(value: unknown): SavedWhiteboardData | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;

  return {
    version:
      typeof candidate.version === "number" ? candidate.version : undefined,
    whiteboardId:
      typeof candidate.whiteboardId === "string"
        ? candidate.whiteboardId
        : undefined,
    mode:
      candidate.mode === "standalone" || candidate.mode === "appointment"
        ? candidate.mode
        : undefined,
    appointmentId:
      typeof candidate.appointmentId === "string"
        ? candidate.appointmentId
        : undefined,
    pages: Array.isArray(candidate.pages)
      ? (candidate.pages as WhiteboardPage[])
      : undefined,
    currentPageIndex:
      typeof candidate.currentPageIndex === "number"
        ? candidate.currentPageIndex
        : undefined,
    showGrid:
      typeof candidate.showGrid === "boolean" ? candidate.showGrid : undefined,
    backgroundColor:
      typeof candidate.backgroundColor === "string"
        ? candidate.backgroundColor
        : undefined,
    backgroundImage:
      typeof candidate.backgroundImage === "string"
        ? candidate.backgroundImage
        : candidate.backgroundImage === null
          ? null
          : undefined,
    gridColor:
      typeof candidate.gridColor === "string" ? candidate.gridColor : undefined,
    snapToGrid:
      typeof candidate.snapToGrid === "boolean"
        ? candidate.snapToGrid
        : undefined,
    color: typeof candidate.color === "string" ? candidate.color : undefined,
    width: typeof candidate.width === "number" ? candidate.width : undefined,
    tool: isTool(candidate.tool) ? candidate.tool : undefined,
    formulaCategory: isFormulaCategory(candidate.formulaCategory)
      ? candidate.formulaCategory
      : undefined,
    savedAt:
      typeof candidate.savedAt === "string" ? candidate.savedAt : undefined,
    realtimeOriginId:
      typeof candidate.realtimeOriginId === "string"
        ? candidate.realtimeOriginId
        : undefined,
    realtimeRevision:
      typeof candidate.realtimeRevision === "number"
        ? candidate.realtimeRevision
        : undefined,
  };
}

const COLORS = [
  "#0f172a",
  "#ffffff",
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#f59e0b",
  "#64748b",
  "#db2777",
  "#4f46e5",
];

const DEFAULT_BACKGROUND_IMAGE = "/images/chalkboard.png";

const BACKGROUND_IMAGE_OPTIONS = [
  { label: "Chalkboard", value: DEFAULT_BACKGROUND_IMAGE },
];

const BACKGROUND_OPTIONS = [
  { label: "Pure White", value: "#ffffff" },
  { label: "Modern Slate", value: "#f8fafc" },
  { label: "Cool Gray", value: "#f1f5f9" },
  { label: "Classic Blueprint", value: "#0f172a" },
  { label: "Midnight Navy", value: "#090d16" },
  { label: "Graphite Dark", value: "#18181b" },
  { label: "Sepia Warm", value: "#fefce8" },
  { label: "Soft Cream", value: "#fffbeb" },
  { label: "Pastel Mint", value: "#ecfdf5" },
  { label: "Sky Blue", value: "#f0f9ff" },
  { label: "Soft Lavender", value: "#f5f3ff" },
  { label: "Rose Tint", value: "#fff1f2" },
];

const GRID_COLOR_OPTIONS = [
  { label: "Subtle Gray", value: "#e5e7eb" },
  { label: "Slate Grid", value: "#cbd5e1" },
  { label: "Vivid Blue", value: "#3b82f6" },
  { label: "Soft Blue Tint", value: "#dbeafe" },
  { label: "Dark Mode Grid", value: "#1e293b" },
  { label: "Midnight Glow", value: "#334155" },
  { label: "Emerald Trace", value: "#a7f3d0" },
  { label: "Amber Accent", value: "#fde68a" },
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createPage(name: string): WhiteboardPage {
  return {
    id: createId(),
    name,
    elements: [],
  };
}

const MATH_SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  Delta: "Δ",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  sigma: "σ",
  Sigma: "Σ",
  phi: "φ",
  varphi: "ϕ",
  omega: "ω",
  Omega: "Ω",
  pi: "π",
  rho: "ρ",
  tau: "τ",
  infinity: "∞",
  pm: "±",
  mp: "∓",
  times: "×",
  cdot: "·",
  div: "÷",
  le: "≤",
  ge: "≥",
  neq: "≠",
  approx: "≈",
  propto: "∝",
  degree: "°",
  sum: "∑",
  prod: "∏",
  int: "∫",
  partial: "∂",
  nabla: "∇",
  rightarrow: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  infty: "∞",
};

function latexToReadable(text: string): string {
  const convert = (source: string): string => {
    let value = source;

    const readBalancedGroup = (
      input: string,
      openIndex: number,
    ): { content: string; end: number } | null => {
      if (input[openIndex] !== "{") return null;

      let depth = 0;
      for (let index = openIndex; index < input.length; index++) {
        if (input[index] === "{") depth++;
        if (input[index] === "}") {
          depth--;
          if (depth === 0) {
            return {
              content: input.slice(openIndex + 1, index),
              end: index + 1,
            };
          }
        }
      }

      return null;
    };

    // Resolve fractions from the inside out so nested fractions work too.
    let fractionIndex = value.indexOf("\\frac");
    while (fractionIndex !== -1) {
      const numeratorStart = fractionIndex + 5;

      // Skip optional whitespace between \frac and its arguments.
      let numeratorIndex = numeratorStart;
      while (/\s/.test(value[numeratorIndex] ?? "")) numeratorIndex++;

      const numerator = readBalancedGroup(value, numeratorIndex);

      if (!numerator) {
        fractionIndex = value.indexOf("\\frac", fractionIndex + 5);
        continue;
      }

      let denominatorIndex = numerator.end;
      while (/\s/.test(value[denominatorIndex] ?? "")) denominatorIndex++;

      const denominator = readBalancedGroup(value, denominatorIndex);

      if (!denominator) {
        fractionIndex = value.indexOf("\\frac", fractionIndex + 5);
        continue;
      }

      const numeratorText = convert(numerator.content);
      const denominatorText = convert(denominator.content);

      value =
        value.slice(0, fractionIndex) +
        `${numeratorText}/${denominatorText}` +
        value.slice(denominator.end);

      fractionIndex = value.indexOf("\\frac");
    }

    // Common LaTeX symbols.
    Object.entries(MATH_SYMBOLS).forEach(([name, symbol]) => {
      value = value.replace(new RegExp(`\\\\${name}\\b`, "g"), symbol);
    });

    value = value.replace(/\\text\{([^{}]*)\}/g, "$1");
    value = value.replace(/\\left|\\right/g, "");
    value = value.replace(/\\,|\\;|\\!|\\quad/g, " ");
    value = value.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
    value = value.replace(/\\sqrt\s*([A-Za-z0-9])/g, "√$1");
    value = value.replace(/\^\{([^{}]*)\}/g, "^$1");
    value = value.replace(/_\{([^{}]*)\}/g, "_$1");

    // Remove only grouping braces that are left after the supported
    // structures have been converted.
    value = value.replace(/[{}]/g, "");

    return value;
  };

  return convert(text);
}

function estimateMathMetrics(
  text: string,
  fontSize: number,
  ctx?: CanvasRenderingContext2D | null,
) {
  const readable = latexToReadable(text);
  const plainWidth = ctx
    ? ctx.measureText(readable).width
    : readable.length * fontSize * 0.62;
  const fractionCount = (text.match(/\\frac/g) || []).length;
  const sqrtCount = (text.match(/\\sqrt/g) || []).length;
  const superscriptCount = (text.match(/\^/g) || []).length;
  const subscriptCount = (text.match(/_/g) || []).length;

  return {
    width: Math.max(
      fontSize * 0.8,
      plainWidth + fractionCount * fontSize * 0.25 + sqrtCount * fontSize * 0.1,
    ),
    height:
      fontSize *
      (1.25 +
        Math.min(1.2, fractionCount * 0.55) +
        Math.min(0.45, (superscriptCount + subscriptCount) * 0.08)),
  };
}

function drawMathEquation(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
) {
  // Lightweight LaTeX-style renderer for the canvas. It supports common
  // classroom notation without requiring an external math-rendering package.
  const render = (
    source: string,
    size: number,
    originX: number,
    originY: number,
  ) => {
    let cursorX = originX;
    let i = 0;
    const baseFont = `${size}px Cambria Math, STIX Two Math, Times New Roman, serif`;
    ctx.font = baseFont;
    ctx.textBaseline = "alphabetic";

    const readGroup = () => {
      if (source[i] === "{") {
        let depth = 0;
        const start = ++i;
        while (i < source.length) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") {
            if (depth === 0) break;
            depth--;
          }
          i++;
        }
        const group = source.slice(start, i);
        if (source[i] === "}") i++;
        return group;
      }
      if (source[i] === "\\") {
        const start = i;
        i++;
        while (i < source.length && /[A-Za-z]/.test(source[i])) i++;
        return source.slice(start, i);
      }
      return source[i++] || "";
    };

    const readCommand = () => {
      i++;
      const start = i;
      while (i < source.length && /[A-Za-z]/.test(source[i])) i++;
      return source.slice(start, i);
    };

    while (i < source.length) {
      if (/\s/.test(source[i])) {
        cursorX += size * 0.22;
        i++;
        continue;
      }

      if (source[i] === "\\") {
        const command = readCommand();
        if (command === "frac") {
          const numerator = readGroup();
          const denominator = readGroup();
          const fracSize = size * 0.86;
          const numMetrics = estimateMathMetrics(numerator, fracSize, ctx);
          const denMetrics = estimateMathMetrics(denominator, fracSize, ctx);
          const width =
            Math.max(numMetrics.width, denMetrics.width) + size * 0.35;
          const center = cursorX + width / 2;
          render(
            numerator,
            fracSize,
            center - numMetrics.width / 2,
            originY - size * 0.28,
          );
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1, size * 0.055);
          ctx.beginPath();
          ctx.moveTo(cursorX + size * 0.08, originY - size * 0.02);
          ctx.lineTo(cursorX + width - size * 0.08, originY - size * 0.02);
          ctx.stroke();
          render(
            denominator,
            fracSize,
            center - denMetrics.width / 2,
            originY + size * 0.72,
          );
          cursorX += width;
          continue;
        }
        if (command === "sqrt") {
          const radicand = readGroup();
          const metrics = estimateMathMetrics(radicand, size * 0.9, ctx);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1, size * 0.07);
          ctx.beginPath();
          ctx.moveTo(cursorX, originY - size * 0.28);
          ctx.lineTo(cursorX + size * 0.18, originY + size * 0.05);
          ctx.lineTo(cursorX + size * 0.34, originY - size * 0.62);
          ctx.lineTo(
            cursorX + size * 0.34 + metrics.width,
            originY - size * 0.62,
          );
          ctx.stroke();
          render(radicand, size * 0.9, cursorX + size * 0.36, originY);
          cursorX += size * 0.36 + metrics.width + size * 0.08;
          continue;
        }
        if (command === "text") {
          const content = readGroup();
          ctx.font = `${size}px Inter, sans-serif`;
          ctx.fillText(content, cursorX, originY);
          cursorX += ctx.measureText(content).width;
          continue;
        }

        const symbol = MATH_SYMBOLS[command] ?? command;
        ctx.font = baseFont;
        ctx.fillText(symbol, cursorX, originY);
        cursorX += ctx.measureText(symbol).width;
        continue;
      }

      if (source[i] === "^" || source[i] === "_") {
        const isSup = source[i] === "^";
        i++;
        const group = readGroup();
        const subSize = size * 0.62;
        const offsetY = isSup ? -size * 0.48 : size * 0.34;
        render(group, subSize, cursorX, originY + offsetY);
        continue;
      }

      if (source[i] === "{") {
        const group = readGroup();
        render(group, size, cursorX, originY);
        cursorX += estimateMathMetrics(group, size, ctx).width;
        continue;
      }

      const ch = source[i++];
      ctx.font = baseFont;
      ctx.fillText(ch, cursorX, originY);
      cursorX += ctx.measureText(ch).width;
    }
    return cursorX - originX;
  };

  ctx.save();
  ctx.fillStyle = color;
  render(text, fontSize, x, y + fontSize);
  ctx.restore();
}

function getElementBounds(
  element: WhiteboardElement,
  ctx?: CanvasRenderingContext2D | null,
): { left: number; top: number; right: number; bottom: number } {
  if (element.type === "stroke") {
    const xs = element.points.map((point) => point.x);
    const ys = element.points.map((point) => point.y);
    if (xs.length === 0) return { left: 0, top: 0, right: 0, bottom: 0 };
    const padding = Math.max(element.width, 8) + 4;
    return {
      left: Math.min(...xs) - padding,
      top: Math.min(...ys) - padding,
      right: Math.max(...xs) + padding,
      bottom: Math.max(...ys) + padding,
    };
  }

  if ("start" in element && "end" in element) {
    const padding = Math.max(element.width, 8) + 4;
    return {
      left: Math.min(element.start.x, element.end.x) - padding,
      top: Math.min(element.start.y, element.end.y) - padding,
      right: Math.max(element.start.x, element.end.x) + padding,
      bottom: Math.max(element.start.y, element.end.y) + padding,
    };
  }

  if (element.type === "image") {
    return {
      left: element.x,
      top: element.y,
      right: element.x + element.width,
      bottom: element.y + element.height,
    };
  }

  const mathMetrics =
    element.type === "equation"
      ? estimateMathMetrics(element.text, element.fontSize, ctx)
      : null;
  const measuredWidth = mathMetrics
    ? mathMetrics.width
    : ctx
      ? ctx.measureText(element.text).width
      : element.text.length * element.fontSize * 0.62;
  const measuredHeight = mathMetrics?.height ?? element.fontSize + 6;

  return {
    left: element.x - 4,
    top: element.y - 4,
    right: element.x + Math.max(measuredWidth, element.fontSize * 0.6) + 4,
    bottom: element.y + measuredHeight + 4,
  };
}

function pointInsideBounds(
  point: Point,
  bounds: { left: number; top: number; right: number; bottom: number },
  tolerance = 0,
): boolean {
  return (
    point.x >= bounds.left - tolerance &&
    point.x <= bounds.right + tolerance &&
    point.y >= bounds.top - tolerance &&
    point.y <= bounds.bottom + tolerance
  );
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  const projection = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function hitTestElement(
  element: WhiteboardElement,
  point: Point,
  ctx: CanvasRenderingContext2D | null,
): boolean {
  const bounds = getElementBounds(element, ctx);
  if (!pointInsideBounds(point, bounds, 12)) return false;

  if (element.type === "stroke") {
    const tolerance = Math.max(element.width, 12);
    for (let index = 1; index < element.points.length; index++) {
      if (
        distanceToSegment(
          point,
          element.points[index - 1],
          element.points[index],
        ) <= tolerance
      ) {
        return true;
      }
    }
    return (
      element.points.length === 1 &&
      Math.hypot(
        point.x - element.points[0].x,
        point.y - element.points[0].y,
      ) <= tolerance
    );
  }
  return true;
}

function translateElement(
  element: WhiteboardElement,
  dx: number,
  dy: number,
): WhiteboardElement {
  if (element.type === "stroke") {
    return {
      ...element,
      points: element.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  if ("start" in element && "end" in element) {
    return {
      ...element,
      start: { x: element.start.x + dx, y: element.start.y + dy },
      end: { x: element.end.x + dx, y: element.end.y + dy },
    };
  }
  return { ...element, x: element.x + dx, y: element.y + dy };
}

export default function Whiteboard({
  mode,
  appointmentId,
  onRealtimeChange,
  onReady,
  remoteData,
}: WhiteboardProps) {
  const [databaseWhiteboardId, setDatabaseWhiteboardId] = useState<
    string | null
  >(null);
  const [whiteboardReady, setWhiteboardReady] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const hasLoadedBoardRef = useRef(false);
  const realtimeReadyReportedRef = useRef(false);
  const realtimeOriginId = useId();
  const realtimeOriginIdRef = useRef<string>(realtimeOriginId);
  const realtimeRevisionRef = useRef(0);
  const lastAppliedRemoteSignatureRef = useRef<string | null>(null);
  const lastRemoteRevisionByOriginRef = useRef<Map<string, number>>(new Map());

  const storageKey = useMemo(() => {
    if (mode === "standalone") {
      return "justdy-lab-whiteboard:standalone";
    }

    return `justdy-lab-whiteboard:appointment:${appointmentId ?? "unknown"}`;
  }, [mode, appointmentId]);

  const [pages, setPages] = useState<WhiteboardPage[]>([createPage("Page 1")]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#2563eb");
  const [width, setWidth] = useState(4);
  const [fontSize] = useState(24);

  const [showGrid, setShowGrid] = useState(true);
  const [gridSize] = useState(32);
  const [backgroundColor, setBackgroundColor] = useState("#18181b");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    DEFAULT_BACKGROUND_IMAGE,
  );
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [backgroundImageVersion, setBackgroundImageVersion] = useState(0);
  const [gridColor, setGridColor] = useState("#e5e7eb");

  const [showColorPopup, setShowColorPopup] = useState(false);
  const [colorPopupTarget, setColorPopupTarget] = useState<
    "pen" | "object" | null
  >("pen");
  const colorButtonRef = useRef<HTMLButtonElement | null>(null);
  const objectColorButtonRef = useRef<HTMLButtonElement | null>(null);
  const [colorPopupPosition, setColorPopupPosition] = useState({
    top: 0,
    left: 0,
  });

  const [axisColor] = useState("#475569");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showMinorGrid] = useState(true);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [showShapeToolsPopup, setShowShapeToolsPopup] = useState(false);
  const shapeToolsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [showPagesPanel, setShowPagesPanel] = useState(false);
  const [showGraphSettings, setShowGraphSettings] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState("");
  const [calculatorResult, setCalculatorResult] = useState("");
  const [calculatorAngleMode, setCalculatorAngleMode] = useState<"DEG" | "RAD">(
    "DEG",
  );
  const [calculatorMemory, setCalculatorMemory] = useState(0);
  const [calculatorHistory, setCalculatorHistory] = useState<
    Array<{ expression: string; result: string }>
  >([]);
  const [calculatorPosition, setCalculatorPosition] = useState({ x: 0, y: 0 });
  const [popupPositions, setPopupPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const popupDragRef = useRef<{
    key: string;
    dx: number;
    dy: number;
    element: HTMLElement;
    captureTarget: HTMLElement;
  } | null>(null);

  const getPopupPosition = useCallback(
    (key: string, fallback: { x: number; y: number }) =>
      popupPositions[key] ?? fallback,
    [popupPositions],
  );

  const startPopupDrag = useCallback(
    (key: string, event: React.PointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, select, textarea, [data-no-drag]"))
        return;

      // Store the actual popup element. The popup's parent is often the
      // full-screen whiteboard wrapper, which was causing small popups to
      // clamp to the left edge.
      // Always resolve the actual popup dialog itself. When the drag starts
      // from a popup header, event.currentTarget is the header; when it starts
      // from the popup container, its parent is the full-screen board wrapper.
      // Using closest(dialog) fixes the left-edge clamping for every popup.
      const popup = event.currentTarget.closest(
        '[role="dialog"], aside',
      ) as HTMLElement | null;
      if (!popup) return;

      const rect = popup.getBoundingClientRect();

      popupDragRef.current = {
        key,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        element: popup,
        captureTarget: event.currentTarget,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [],
  );

  const movePopupDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = popupDragRef.current;
      if (!drag) return;

      const root = rootRef.current?.getBoundingClientRect();
      if (!root) return;

      // Always measure the popup itself, never event.currentTarget.parentElement.
      const popupRect = drag.element.getBoundingClientRect();
      const width = popupRect.width;
      const height = popupRect.height;

      const maxX = Math.max(8, root.width - width - 8);
      const maxY = Math.max(8, root.height - height - 8);

      const x = Math.max(
        8,
        Math.min(event.clientX - root.left - drag.dx, maxX),
      );
      const y = Math.max(8, Math.min(event.clientY - root.top - drag.dy, maxY));

      setPopupPositions((previous) => ({
        ...previous,
        [drag.key]: { x, y },
      }));
    },
    [],
  );

  const endPopupDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = popupDragRef.current;
    popupDragRef.current = null;

    if (!drag) return;

    try {
      drag.captureTarget.releasePointerCapture(event.pointerId);
    } catch {}
  }, []);
  const calculatorDraggingRef = useRef(false);
  const calculatorDragOffsetRef = useRef({ x: 0, y: 0 });
  const [formulaCategory, setFormulaCategory] =
    useState<FormulaCategory>("algebra");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTeacherControls, setShowTeacherControls] = useState(true);
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const [teacherControlDragging, setTeacherControlDragging] = useState(false);

  // Draggable teacher-control launcher position.
  // The default position is the bottom-right corner, but the teacher can
  // drag the logo anywhere on the whiteboard.
  const [teacherControlPosition, setTeacherControlPosition] = useState({
    left: 0,
    top: 0,
  });
  const teacherControlInitializedRef = useRef(false);
  const teacherControlDraggingRef = useRef(false);
  const teacherControlDidDragRef = useRef(false);
  const teacherControlDragOffsetRef = useRef({
    x: 0,
    y: 0,
  });

  const [renamePageState, setRenamePageState] = useState<{
    open: boolean;
    index: number | null;
    name: string;
  }>({
    open: false,
    index: null,
    name: "",
  });
  const [, setIsSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [selectedEquation, setSelectedEquation] = useState("");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, setImageVersion] = useState(0);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [textEditor, setTextEditor] = useState<{
    open: boolean;
    type: "text" | "equation";
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    editingElementId: string | null;
  }>({
    open: false,
    type: "text",
    x: 0,
    y: 0,
    text: "",
    fontSize: 24,
    color: "#2563eb",
    bold: false,
    italic: false,
    underline: false,
    editingElementId: null,
  });

  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeTextPanel, setActiveTextPanel] = useState<
    "symbols" | "templates" | "formatting" | null
  >(null);

  const drawingRef = useRef(false);
  const startPointRef = useRef<Point | null>(null);
  const currentStrokeRef = useRef<StrokeElement | null>(null);
  const previewElementRef = useRef<ShapeElement | null>(null);

  const transformRef = useRef<{
    mode: "move" | "resize";
    ids: string[];
    elements: WhiteboardElement[];
    originalElements: WhiteboardElement[];
    startPoint: Point;
    anchor: Point;
    handle: "nw" | "ne" | "se" | "sw" | null;
    moved: boolean;
  } | null>(null);

  const marqueeRef = useRef<{
    start: Point;
    current: Point;
    moved: boolean;
  } | null>(null);

  const historyRef = useRef<WhiteboardPage[][]>([[createPage("Page 1")]]);
  const redoRef = useRef<WhiteboardPage[][]>([]);

  const currentPage = pages[currentPageIndex] ?? pages[0];
  const elements = useMemo(() => currentPage?.elements ?? [], [currentPage]);
  const positionColorPopup = useCallback((target: "pen" | "object") => {
    const button =
      target === "object"
        ? objectColorButtonRef.current
        : colorButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const popupWidth = 220;
    const popupHeight = 190;
    const gap = 10;

    let left = rect.right + gap;
    if (left + popupWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.left - popupWidth - gap);
    }

    let top = rect.top;
    if (top + popupHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - popupHeight - 12);
    }

    setColorPopupPosition({ top, left });
    setColorPopupTarget(target);
    setShowColorPopup(true);
  }, []);

  const pushHistory = useCallback(() => {
    historyRef.current.push(JSON.parse(JSON.stringify(pages)));

    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }

    redoRef.current = [];
  }, [pages]);

  const updateCurrentPage = useCallback(
    (updater: (page: WhiteboardPage) => WhiteboardPage) => {
      setPages((previous) =>
        previous.map((page, index) =>
          index === currentPageIndex ? updater(page) : page,
        ),
      );

      setIsSaved(false);
    },
    [currentPageIndex],
  );

  const applySelectedElementColor = useCallback(
    (nextColor: string) => {
      if (!selectedElementId) return;

      const selected = elements.find(
        (element: WhiteboardElement) => element.id === selectedElementId,
      );
      if (!selected) return;

      if (!("color" in selected)) {
        setShowColorPopup(false);
        setColorPopupTarget(null);
        return;
      }

      if (selected.color === nextColor) {
        setShowColorPopup(false);
        return;
      }

      pushHistory();
      updateCurrentPage((page) => ({
        ...page,
        elements: page.elements.map((element: WhiteboardElement) =>
          element.id === selectedElementId
            ? { ...element, color: nextColor }
            : element,
        ),
      }));

      setShowColorPopup(false);
      setColorPopupTarget(null);
    },
    [elements, pushHistory, selectedElementId, updateCurrentPage],
  );

  const getPoint = useCallback(
    (event: Pick<MouseEvent, "clientX" | "clientY">): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      let x = event.clientX - rect.left;
      let y = event.clientY - rect.top;
      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }
      return { x, y };
    },
    [gridSize, snapToGrid],
  );

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvasWidth: number,
      canvasHeight: number,
    ) => {
      if (!showGrid) return;
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      if (showMinorGrid) {
        ctx.strokeStyle = gridColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.5;
        const minor = Math.max(4, gridSize / 4);
        for (let x = 0; x <= canvasWidth; x += minor) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasHeight);
          ctx.stroke();
        }
        for (let y = 0; y <= canvasHeight; y += minor) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasWidth, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    [gridColor, gridSize, showGrid, showMinorGrid],
  );

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, element: StrokeElement) => {
      if (element.points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = element.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const first = element.points[0];
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < element.points.length; i++) {
        const point = element.points[i];
        const previous = element.points[i - 1];
        const midpointX = (previous.x + point.x) / 2;
        const midpointY = (previous.y + point.y) / 2;
        ctx.lineWidth = element.width;
        ctx.quadraticCurveTo(previous.x, previous.y, midpointX, midpointY);
      }
      const last = element.points[element.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, element: ShapeElement) => {
      const { start, end } = element;
      ctx.save();
      ctx.strokeStyle = element.color || axisColor;
      ctx.lineWidth = element.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;

      ctx.beginPath();
      if (element.type === "line") {
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      } else if (element.type === "rectangle") {
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (element.type === "circle") {
        const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      } else if (element.type === "triangle") {
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(start.x, end.y);
        ctx.closePath();
      } else if (element.type === "axes") {
        ctx.moveTo(start.x, centerY);
        ctx.lineTo(end.x, centerY);
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(centerX, end.y);
      }
      ctx.stroke();
      ctx.restore();
    },
    [axisColor],
  );

  const drawText = useCallback(
    (ctx: CanvasRenderingContext2D, element: TextElement) => {
      if (element.type === "equation") {
        drawMathEquation(
          ctx,
          element.text,
          element.x,
          element.y,
          element.fontSize,
          element.color,
        );
        return;
      }

      ctx.save();
      ctx.fillStyle = element.color;
      ctx.font = `${element.italic ? "italic " : ""}${element.bold ? "700 " : "400 "}${element.fontSize}px Inter, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(element.text, element.x, element.y);

      if (element.underline) {
        const textWidth = ctx.measureText(element.text).width;
        ctx.strokeStyle = element.color;
        ctx.lineWidth = Math.max(1, element.fontSize / 14);
        ctx.beginPath();
        ctx.moveTo(element.x, element.y + element.fontSize + 2);
        ctx.lineTo(element.x + textWidth, element.y + element.fontSize + 2);
        ctx.stroke();
      }

      ctx.restore();
    },
    [],
  );

  const drawSelection = useCallback(
    (ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
      const bounds = getElementBounds(element, ctx);
      const handleSize = 9;
      const half = handleSize / 2;
      const handles = [
        { x: bounds.left, y: bounds.top },
        { x: bounds.right, y: bounds.top },
        { x: bounds.right, y: bounds.bottom },
        { x: bounds.left, y: bounds.bottom },
      ];

      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(
        bounds.left,
        bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top,
      );
      ctx.setLineDash([]);

      handles.forEach(({ x, y }) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - half, y - half, handleSize, handleSize, 2);
        ctx.fill();
        ctx.stroke();
      });

      // Delete control: red circular node at the top-right.
      const deleteX = bounds.right + 14;
      const deleteY = bounds.top - 14;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(deleteX, deleteY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(deleteX - 3, deleteY - 3);
      ctx.lineTo(deleteX + 3, deleteY + 3);
      ctx.moveTo(deleteX + 3, deleteY - 3);
      ctx.lineTo(deleteX - 3, deleteY + 3);
      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  const getUnionBounds = useCallback((items: WhiteboardElement[]) => {
    if (!items.length) return null;
    return items.reduce(
      (acc, item) => {
        const b = getElementBounds(item, contextRef.current);
        return {
          left: Math.min(acc.left, b.left),
          top: Math.min(acc.top, b.top),
          right: Math.max(acc.right, b.right),
          bottom: Math.max(acc.bottom, b.bottom),
        };
      },
      getElementBounds(items[0], contextRef.current),
    );
  }, []);

  const drawSelectionGroup = useCallback(
    (ctx: CanvasRenderingContext2D, items: WhiteboardElement[]) => {
      const bounds = getUnionBounds(items);
      if (!bounds) return;

      const handleSize = 9;
      const half = handleSize / 2;
      const handles = [
        { x: bounds.left, y: bounds.top },
        { x: bounds.right, y: bounds.top },
        { x: bounds.right, y: bounds.bottom },
        { x: bounds.left, y: bounds.bottom },
      ];

      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        bounds.left,
        bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top,
      );
      ctx.setLineDash([]);
      handles.forEach(({ x, y }) => {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#2563eb";
        ctx.beginPath();
        ctx.roundRect(x - half, y - half, handleSize, handleSize, 2);
        ctx.fill();
        ctx.stroke();
      });

      if (items.length === 1) {
        const deleteX = bounds.right + 14;
        const deleteY = bounds.top - 14;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(deleteX, deleteY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(deleteX - 3, deleteY - 3);
        ctx.lineTo(deleteX + 3, deleteY + 3);
        ctx.moveTo(deleteX + 3, deleteY - 3);
        ctx.lineTo(deleteX - 3, deleteY + 3);
        ctx.stroke();
      }

      if (items.length > 1) {
        ctx.fillStyle = "#2563eb";
        ctx.font = "700 10px Inter, sans-serif";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          `${items.length} objects selected`,
          bounds.left,
          Math.max(12, bounds.top - 8),
        );
      }
      ctx.restore();
    },
    [getUnionBounds],
  );

  const getSelectionHandle = useCallback(
    (element: WhiteboardElement, point: Point) => {
      const bounds = getElementBounds(element, contextRef.current);
      const tolerance = 12;
      const handles = [
        { name: "nw" as const, x: bounds.left, y: bounds.top },
        { name: "ne" as const, x: bounds.right, y: bounds.top },
        { name: "se" as const, x: bounds.right, y: bounds.bottom },
        { name: "sw" as const, x: bounds.left, y: bounds.bottom },
      ];
      return (
        handles.find(
          (handle) =>
            Math.abs(point.x - handle.x) <= tolerance &&
            Math.abs(point.y - handle.y) <= tolerance,
        )?.name ?? null
      );
    },
    [],
  );

  const isDeleteHandle = useCallback(
    (element: WhiteboardElement, point: Point) => {
      const bounds = getElementBounds(element, contextRef.current);
      const x = bounds.right + 14;
      const y = bounds.top - 14;
      return Math.hypot(point.x - x, point.y - y) <= 14;
    },
    [],
  );

  const resizeElement = useCallback(
    (
      original: WhiteboardElement,
      handle: "nw" | "ne" | "se" | "sw",
      point: Point,
    ) => {
      const bounds = getElementBounds(original, contextRef.current);
      const minSize = 12;
      let left = bounds.left;
      let right = bounds.right;
      let top = bounds.top;
      let bottom = bounds.bottom;

      if (handle.includes("w")) left = Math.min(point.x, right - minSize);
      if (handle.includes("e")) right = Math.max(point.x, left + minSize);
      if (handle.includes("n")) top = Math.min(point.y, bottom - minSize);
      if (handle.includes("s")) bottom = Math.max(point.y, top + minSize);

      const oldWidth = Math.max(bounds.right - bounds.left, minSize);
      const oldHeight = Math.max(bounds.bottom - bounds.top, minSize);
      const newWidth = Math.max(right - left, minSize);
      const newHeight = Math.max(bottom - top, minSize);
      const sx = newWidth / oldWidth;
      const sy = newHeight / oldHeight;

      if (original.type === "stroke") {
        return {
          ...original,
          width: Math.max(1, original.width * Math.sqrt(Math.abs(sx * sy))),
          points: original.points.map((p) => ({
            x: left + (p.x - bounds.left) * sx,
            y: top + (p.y - bounds.top) * sy,
          })),
        };
      }

      if (original.type === "image") {
        return {
          ...original,
          x: left,
          y: top,
          width: Math.max(minSize, right - left),
          height: Math.max(minSize, bottom - top),
        };
      }

      if ("start" in original && "end" in original) {
        return {
          ...original,
          start: { x: left, y: top },
          end: { x: right, y: bottom },
        };
      }

      if (original.type === "text" || original.type === "equation") {
        return {
          ...original,
          x: left + 4,
          y: top + 4,
          fontSize: Math.max(8, original.fontSize * Math.max(sx, sy)),
        };
      }

      return original;
    },
    [],
  );

  const getSelectedElement = useCallback(() => {
    if (!selectedElementId) return null;
    return (
      elements.find((el: WhiteboardElement) => el.id === selectedElementId) ??
      null
    );
  }, [elements, selectedElementId]);

  const getSelectedElements = useCallback(() => {
    const ids = selectedElementIds.length
      ? selectedElementIds
      : selectedElementId
        ? [selectedElementId]
        : [];
    return elements.filter((el) => ids.includes(el.id));
  }, [elements, selectedElementId, selectedElementIds]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    contextRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    // Clear the previously loaded image immediately when the selected
    // background changes. The image is loaded asynchronously below.
    backgroundImageRef.current = null;

    if (!backgroundImage) return;

    const image = new Image();
    const requestedBackground = backgroundImage;

    image.onload = () => {
      // Ignore a late response from an image that is no longer selected.
      if (backgroundImage !== requestedBackground) return;

      backgroundImageRef.current = image;
      // This state update happens from the external image-load callback,
      // rather than synchronously inside the effect body.
      setBackgroundImageVersion((value) => value + 1);
    };

    image.onerror = () => {
      if (backgroundImage !== requestedBackground) return;

      console.error(
        `Failed to load whiteboard background image: ${requestedBackground}`,
      );
      backgroundImageRef.current = null;
      setBackgroundImageVersion((value) => value + 1);
    };

    image.src = requestedBackground;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [backgroundImage]);

  // Load imported board images once and redraw when they become available.
  useEffect(() => {
    const imageElements = elements.filter(
      (element): element is ImageElement => element.type === "image",
    );
    imageElements.forEach((element) => {
      if (imageCacheRef.current.has(element.src)) return;
      const image = new Image();
      image.onload = () => {
        imageCacheRef.current.set(element.src, image);
        setImageVersion((value) => value + 1);
      };
      image.onerror = () => {
        imageCacheRef.current.delete(element.src);
      };
      image.src = element.src;
    });
  }, [elements]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    resizeCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = container.getBoundingClientRect();

    if (backgroundImage && backgroundImageRef.current) {
      const image = backgroundImageRef.current;

      const scale = Math.max(
        rect.width / image.naturalWidth,
        rect.height / image.naturalHeight,
      );

      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      const imageX = (rect.width - imageWidth) / 2;
      const imageY = (rect.height - imageHeight) / 2;

      ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    drawGrid(ctx, rect.width, rect.height);

    // During move/resize, draw the live transformed element instead of waiting
    // for React state to update on pointer-up. This makes resizing feel
    // continuous and keeps the selection handles attached to the live object.
    const liveTransform = transformRef.current;
    const liveElementsById = new Map(
      (liveTransform?.elements ?? []).map((element) => [element.id, element]),
    );

    for (const element of elements) {
      const elementToDraw = liveElementsById.get(element.id) ?? element;

      if (elementToDraw.type === "stroke") drawStroke(ctx, elementToDraw);
      else if (elementToDraw.type === "image") {
        const image = imageCacheRef.current.get(elementToDraw.src);
        if (image) {
          ctx.drawImage(
            image,
            elementToDraw.x,
            elementToDraw.y,
            elementToDraw.width,
            elementToDraw.height,
          );
        } else {
          ctx.save();
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(
            elementToDraw.x,
            elementToDraw.y,
            elementToDraw.width,
            elementToDraw.height,
          );
          ctx.strokeStyle = "#94a3b8";
          ctx.strokeRect(
            elementToDraw.x,
            elementToDraw.y,
            elementToDraw.width,
            elementToDraw.height,
          );
          ctx.fillStyle = "#64748b";
          ctx.font = "12px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            "Loading image…",
            elementToDraw.x + elementToDraw.width / 2,
            elementToDraw.y + elementToDraw.height / 2,
          );
          ctx.restore();
        }
      } else if (
        ["line", "rectangle", "circle", "triangle", "axes"].includes(
          elementToDraw.type,
        )
      )
        drawShape(ctx, elementToDraw as ShapeElement);
      else if (
        elementToDraw.type === "text" ||
        elementToDraw.type === "equation"
      )
        drawText(ctx, elementToDraw as TextElement);
    }

    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
    if (previewElementRef.current) drawShape(ctx, previewElementRef.current);

    const selectedItems = liveTransform
      ? liveTransform.elements
      : getSelectedElements();

    if (selectedItems.length === 1) {
      drawSelection(ctx, selectedItems[0]);
    } else if (selectedItems.length > 1) {
      drawSelectionGroup(ctx, selectedItems);
    }

    const marquee = marqueeRef.current;
    if (marquee?.moved) {
      const left = Math.min(marquee.start.x, marquee.current.x);
      const top = Math.min(marquee.start.y, marquee.current.y);
      const width = Math.abs(marquee.current.x - marquee.start.x);
      const height = Math.abs(marquee.current.y - marquee.start.y);
      ctx.save();
      ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
      ctx.fillRect(left, top, width, height);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(left, top, width, height);
      ctx.restore();
    }
  }, [
    backgroundColor,
    backgroundImage,
    drawGrid,
    drawShape,
    drawStroke,
    drawText,
    drawSelection,
    drawSelectionGroup,
    elements,
    getSelectedElements,
    resizeCanvas,
  ]);

  // backgroundImageVersion is intentionally a render trigger. The image is
  // loaded outside React, so redraw the canvas when that external image load
  // completes without making it an unnecessary renderCanvas dependency.
  useEffect(() => {
    if (backgroundImageVersion >= 0) {
      renderCanvas();
    }
  }, [backgroundImageVersion, renderCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeFrame = 0;

    const syncCanvasSize = () => {
      cancelAnimationFrame(resizeFrame);

      resizeFrame = requestAnimationFrame(() => {
        resizeCanvas();
        renderCanvas();

        // Run one more frame after browser layout settles.
        requestAnimationFrame(() => {
          resizeCanvas();
          renderCanvas();
        });
      });
    };

    // Initial render
    syncCanvasSize();

    // Detect normal browser/window resizing AND flex/container resizing.
    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });

    resizeObserver.observe(container);

    const handleResize = () => {
      syncCanvasSize();
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));

      // Fullscreen changes can happen across multiple layout frames.
      syncCanvasSize();

      requestAnimationFrame(() => {
        syncCanvasSize();
      });

      setTimeout(() => {
        syncCanvasSize();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [resizeCanvas, renderCanvas]);

  const openTextEditor = useCallback(
    (
      point: Point,
      type: "text" | "equation",
      initialText = "",
      editingElementId: string | null = null,
      existingFontSize?: number,
      existingColor?: string,
      existingBold?: boolean,
      existingItalic?: boolean,
      existingUnderline?: boolean,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const popupWidth = 520;
      const popupHeight = 500;
      const margin = 16;

      let left = point.x + rect.left + 18;
      let top = point.y + rect.top + 18;

      if (left + popupWidth > window.innerWidth - margin) {
        left = Math.max(margin, point.x + rect.left - popupWidth - 18);
      }
      if (top + popupHeight > window.innerHeight - margin) {
        top = Math.max(margin, point.y + rect.top - popupHeight - 18);
      }

      setActiveTextPanel(null);
      setTextEditor({
        open: true,
        type,
        x: left,
        y: top,
        text: initialText,
        fontSize:
          existingFontSize ??
          (type === "equation" ? Math.max(fontSize, 24) : fontSize),
        color: existingColor ?? color,
        bold: existingBold ?? false,
        italic: existingItalic ?? false,
        underline: existingUnderline ?? false,
        editingElementId,
      });

      requestAnimationFrame(() => {
        textInputRef.current?.focus();
        textInputRef.current?.select();
      });
    },
    [color, fontSize],
  );

  const handleTextEditorDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, select, textarea, [data-no-drag]"))
        return;
      const rect = event.currentTarget.parentElement?.getBoundingClientRect();
      if (!rect) return;
      popupDragRef.current = {
        key: "textEditor",
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        element: event.currentTarget.parentElement as HTMLElement,
        captureTarget: event.currentTarget,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [],
  );

  const handleTextEditorDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = popupDragRef.current;
      if (!drag || drag.key !== "textEditor") return;
      const root = rootRef.current?.getBoundingClientRect();
      if (!root) return;

      const popup = drag.element;
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      const maxX = Math.max(8, root.width - width - 8);
      const maxY = Math.max(8, root.height - height - 8);

      const x = Math.max(
        8,
        Math.min(event.clientX - root.left - drag.dx, maxX),
      );
      const y = Math.max(8, Math.min(event.clientY - root.top - drag.dy, maxY));

      setTextEditor((previous) => ({ ...previous, x, y }));
    },
    [],
  );

  const handleTextEditorDragEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = popupDragRef.current;
      popupDragRef.current = null;

      if (drag) {
        try {
          drag.captureTarget.releasePointerCapture(event.pointerId);
        } catch {}
      }
    },
    [],
  );

  const closeTextEditor = useCallback(() => {
    setTextEditor((previous) => ({
      ...previous,
      open: false,
      editingElementId: null,
    }));
    setActiveTextPanel(null);
  }, []);

  const insertLatexAtCursor = useCallback(
    (value: string) => {
      const input = textInputRef.current;
      if (!input) {
        setTextEditor((previous) => ({
          ...previous,
          text: `${previous.text}${value}`,
        }));
        return;
      }

      const start = input.selectionStart ?? textEditor.text.length;
      const end = input.selectionEnd ?? start;
      const nextText =
        textEditor.text.slice(0, start) + value + textEditor.text.slice(end);
      const nextCursor = start + value.length;

      setTextEditor((previous) => ({ ...previous, text: nextText }));
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [textEditor.text],
  );

  const addTextElement = useCallback(() => {
    const value = textEditor.text.trim();
    if (!value) {
      textInputRef.current?.focus();
      return;
    }

    pushHistory();

    if (textEditor.editingElementId) {
      updateCurrentPage((page) => ({
        ...page,
        elements: page.elements.map((element: WhiteboardElement) => {
          if (element.id !== textEditor.editingElementId) return element;
          if (element.type !== "text" && element.type !== "equation")
            return element;

          return {
            ...element,
            type: textEditor.type,
            text: value,
            color: textEditor.color,
            fontSize:
              textEditor.type === "equation"
                ? Math.max(textEditor.fontSize, 24)
                : textEditor.fontSize,
            bold: textEditor.type === "text" ? textEditor.bold : false,
            italic: textEditor.type === "text" ? textEditor.italic : false,
            underline:
              textEditor.type === "text" ? textEditor.underline : false,
          };
        }),
      }));

      setSelectedElementId(textEditor.editingElementId);
      setSelectedElementIds([textEditor.editingElementId]);
      setTextEditor((previous) => ({
        ...previous,
        open: false,
        text: "",
        editingElementId: null,
      }));
      return;
    }

    const el: TextElement = {
      id: createId(),
      type: textEditor.type,
      x: textEditor.x,
      y: textEditor.y,
      text: value,
      color: textEditor.color,
      fontSize:
        textEditor.type === "equation"
          ? Math.max(textEditor.fontSize, 24)
          : textEditor.fontSize,
      bold: textEditor.type === "text" ? textEditor.bold : false,
      italic: textEditor.type === "text" ? textEditor.italic : false,
      underline: textEditor.type === "text" ? textEditor.underline : false,
    };

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      el.x = Math.max(0, textEditor.x - rect.left - 18);
      el.y = Math.max(0, textEditor.y - rect.top - 18);
    }

    updateCurrentPage((page) => ({
      ...page,
      elements: [...page.elements, el],
    }));

    setSelectedElementId(el.id);
    setSelectedElementIds([el.id]);
    setTextEditor((previous) => ({
      ...previous,
      open: false,
      text: "",
      editingElementId: null,
    }));
  }, [pushHistory, textEditor, updateCurrentPage]);

  // Duplicate the currently selected object using the latest React state.
  // This avoids stale `elements` when the board is updating at the same time.
  const duplicateSelectedElement = useCallback(() => {
    if (!selectedElementId) return;

    pushHistory();

    let duplicatedId: string | null = null;

    setPages((previous) =>
      previous.map((page, index) => {
        if (index !== currentPageIndex) return page;

        const selected = page.elements.find(
          (element: WhiteboardElement) => element.id === selectedElementId,
        );
        if (!selected) return page;

        const duplicate = structuredClone(selected) as WhiteboardElement;
        duplicate.id = createId();
        duplicatedId = duplicate.id;

        const offset = 24;

        if (duplicate.type === "stroke") {
          duplicate.points = duplicate.points.map((point) => ({
            x: point.x + offset,
            y: point.y + offset,
          }));
        } else if ("start" in duplicate && "end" in duplicate) {
          duplicate.start = {
            x: duplicate.start.x + offset,
            y: duplicate.start.y + offset,
          };
          duplicate.end = {
            x: duplicate.end.x + offset,
            y: duplicate.end.y + offset,
          };
        } else {
          duplicate.x += offset;
          duplicate.y += offset;
        }

        return {
          ...page,
          elements: [...page.elements, duplicate],
        };
      }),
    );

    if (duplicatedId) {
      setSelectedElementId(duplicatedId);
      setSelectedElementIds([duplicatedId]);
      setIsSaved(false);
    }
  }, [currentPageIndex, pushHistory, selectedElementId]);

  const handleTextEditorKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTextEditor();
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      addTextElement();
    }
  };

  const importImage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        const image = new Image();
        image.onload = () => {
          const canvas = canvasRef.current;
          const rect = canvas?.getBoundingClientRect();
          if (!rect) return;

          const maxWidth = Math.min(520, rect.width * 0.48);
          const maxHeight = Math.min(420, rect.height * 0.48);
          const scale = Math.min(
            1,
            maxWidth / image.naturalWidth,
            maxHeight / image.naturalHeight,
          );
          const width = Math.max(80, image.naturalWidth * scale);
          const height = Math.max(80, image.naturalHeight * scale);

          const element: ImageElement = {
            id: createId(),
            type: "image",
            x: Math.max(12, (rect.width - width) / 2),
            y: Math.max(12, (rect.height - height) / 2),
            width,
            height,
            src,
            name: file.name,
          };

          pushHistory();
          updateCurrentPage((page) => ({
            ...page,
            elements: [...page.elements, element],
          }));
          imageCacheRef.current.set(src, image);
          setImageVersion((value) => value + 1);
          setTool("select");
          setSelectedElementId(element.id);
          setSelectedElementIds([element.id]);
        };
        image.src = src;
      };
      reader.readAsDataURL(file);
    },
    [pushHistory, updateCurrentPage],
  );

  const handleCanvasContextMenu = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool !== "select" || !selectedElementId) return;

      const point = getPoint(event.nativeEvent);
      const selected = elements.find(
        (element: WhiteboardElement) => element.id === selectedElementId,
      );

      if (selected && hitTestElement(selected, point, contextRef.current)) {
        event.preventDefault();
        duplicateSelectedElement();
      }
    },
    [duplicateSelectedElement, elements, getPoint, selectedElementId, tool],
  );

  const handleCanvasDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool !== "select") return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      let x = event.clientX - rect.left;
      let y = event.clientY - rect.top;

      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }

      const point: Point = { x, y };

      const hit = [...elements]
        .reverse()
        .find((element: WhiteboardElement) =>
          hitTestElement(element, point, contextRef.current),
        );

      if (!hit || (hit.type !== "text" && hit.type !== "equation")) {
        return;
      }

      setSelectedElementId(hit.id);
      setSelectedElementIds([hit.id]);

      openTextEditor(
        point,
        hit.type,
        hit.text,
        hit.id,
        hit.fontSize,
        hit.color,
        hit.bold ?? false,
        hit.italic ?? false,
        hit.underline ?? false,
      );
    },
    [elements, gridSize, openTextEditor, snapToGrid, tool],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);

    const point = getPoint(event.nativeEvent);
    startPointRef.current = point;

    if (tool === "select") {
      const selected = getSelectedElement();
      const isMulti = selectedElementIds.length > 1;

      if (selected && !isMulti && isDeleteHandle(selected, point)) {
        pushHistory();
        updateCurrentPage((page) => ({
          ...page,
          elements: page.elements.filter((el) => el.id !== selected.id),
        }));
        setSelectedElementId(null);
        setSelectedElementIds([]);
        setShowColorPopup(false);
        setColorPopupTarget(null);
        return;
      }

      if (selected && !isMulti) {
        const handle = getSelectionHandle(selected, point);
        if (handle) {
          pushHistory();
          drawingRef.current = true;
          transformRef.current = {
            mode: "resize",
            ids: [selected.id],
            elements: [structuredClone(selected)],
            originalElements: [structuredClone(selected)],
            startPoint: point,
            anchor: point,
            handle,
            moved: false,
          };
          return;
        }
      }

      const hit = [...elements]
        .reverse()
        .find((el) => hitTestElement(el, point, contextRef.current));

      if (hit) {
        const alreadySelected = selectedElementIds.includes(hit.id);
        let nextIds = selectedElementIds;

        if (event.shiftKey) {
          nextIds = alreadySelected
            ? selectedElementIds.filter((id) => id !== hit.id)
            : [...selectedElementIds, hit.id];
          setSelectedElementIds(nextIds);
          setSelectedElementId(nextIds[0] ?? null);

          if (!nextIds.length) {
            drawingRef.current = false;
            return;
          }
        } else if (!alreadySelected || !selectedElementIds.length) {
          nextIds = [hit.id];
          setSelectedElementIds(nextIds);
          setSelectedElementId(hit.id);
        }

        const movingElements = elements.filter((el) => nextIds.includes(el.id));
        pushHistory();
        drawingRef.current = true;
        transformRef.current = {
          mode: "move",
          ids: nextIds,
          elements: structuredClone(movingElements),
          originalElements: structuredClone(movingElements),
          startPoint: point,
          anchor: point,
          handle: null,
          moved: false,
        };
      } else {
        setSelectedElementId(null);
        if (!event.shiftKey) setSelectedElementIds([]);
        marqueeRef.current = {
          start: point,
          current: point,
          moved: false,
        };
        drawingRef.current = true;
      }
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      pushHistory();
      drawingRef.current = true;
      currentStrokeRef.current = {
        id: createId(),
        type: "stroke",
        points: [point],
        color: tool === "eraser" ? backgroundColor : color,
        width: tool === "eraser" ? Math.max(width * 4, 24) : width,
        pressureSensitive: true,
      };
      return;
    }

    if (
      ["line", "rectangle", "circle", "triangle", "axes", "ruler"].includes(
        tool,
      )
    ) {
      pushHistory();
      drawingRef.current = true;
      const shapeType: ShapeType =
        tool === "ruler" ? "line" : (tool as ShapeType);
      previewElementRef.current = {
        id: createId(),
        type: shapeType,
        start: point,
        end: point,
        color,
        width,
      };
      renderCanvas();
      return;
    }

    if (tool === "text" || tool === "equation") {
      openTextEditor(point, tool, tool === "equation" ? selectedEquation : "");
      setSelectedEquation("");
      return;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event.nativeEvent);

    if (transformRef.current) {
      const tr = transformRef.current;

      if (
        tr.mode === "resize" &&
        tr.handle &&
        tr.originalElements.length === 1
      ) {
        tr.elements = [resizeElement(tr.originalElements[0], tr.handle, point)];
      } else {
        const dx = point.x - tr.startPoint.x;
        const dy = point.y - tr.startPoint.y;
        tr.elements = tr.originalElements.map((element) =>
          translateElement(element, dx, dy),
        );
      }

      tr.moved = true;
      renderCanvas();
      return;
    }

    if (marqueeRef.current) {
      marqueeRef.current.current = point;
      marqueeRef.current.moved =
        Math.abs(point.x - marqueeRef.current.start.x) > 4 ||
        Math.abs(point.y - marqueeRef.current.start.y) > 4;
      renderCanvas();
      return;
    }

    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push(point);
      renderCanvas();
      return;
    }

    if (previewElementRef.current) {
      previewElementRef.current.end = point;
      renderCanvas();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {}
    }

    if (transformRef.current) {
      const tr = transformRef.current;
      if (tr.moved) {
        const finalElements = tr.elements;
        updateCurrentPage((page) => ({
          ...page,
          elements: page.elements.map((el) => {
            const final = finalElements.find((item) => item.id === el.id);
            return final ?? el;
          }),
        }));
      }
      transformRef.current = null;
      renderCanvas();
      return;
    }

    if (marqueeRef.current) {
      const marquee = marqueeRef.current;
      const left = Math.min(marquee.start.x, marquee.current.x);
      const right = Math.max(marquee.start.x, marquee.current.x);
      const top = Math.min(marquee.start.y, marquee.current.y);
      const bottom = Math.max(marquee.start.y, marquee.current.y);

      if (marquee.moved) {
        const ids = elements
          .filter((element) => {
            const b = getElementBounds(element, contextRef.current);
            return (
              b.left >= left &&
              b.right <= right &&
              b.top >= top &&
              b.bottom <= bottom
            );
          })
          .map((element) => element.id);

        const nextIds = event.shiftKey
          ? Array.from(new Set([...selectedElementIds, ...ids]))
          : ids;

        setSelectedElementIds(nextIds);
        setSelectedElementId(nextIds[0] ?? null);
      } else if (!event.shiftKey) {
        setSelectedElementIds([]);
        setSelectedElementId(null);
      }

      marqueeRef.current = null;
      renderCanvas();
      return;
    }

    if (currentStrokeRef.current) {
      const stroke = currentStrokeRef.current;
      if (stroke.points.length > 0) {
        updateCurrentPage((p) => ({
          ...p,
          elements: [...p.elements, stroke],
        }));
      }
      currentStrokeRef.current = null;
    }

    if (previewElementRef.current) {
      const el = previewElementRef.current;
      updateCurrentPage((p) => ({
        ...p,
        elements: [...p.elements, el],
      }));
      previewElementRef.current = null;
      renderCanvas();
    }
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push(JSON.parse(JSON.stringify(pages)));
    setPages(prev);
    setCurrentPageIndex((i) => Math.min(i, prev.length - 1));
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(JSON.parse(JSON.stringify(pages)));
    setPages(next);
    setCurrentPageIndex((i) => Math.min(i, next.length - 1));
  };

  const clearPage = () => {
    if (!currentPage || currentPage.elements.length === 0) return;
    pushHistory();
    updateCurrentPage((p) => ({ ...p, elements: [] }));
  };

  const addPage = () => {
    pushHistory();
    const newPage = createPage(`Page ${pages.length + 1}`);
    setPages((p) => [...p, newPage]);
    setCurrentPageIndex(pages.length);
  };

  const duplicatePage = useCallback(
    (index: number) => {
      pushHistory();

      let duplicatedIndex = index;

      setPages((previous) => {
        const sourcePage = previous[index];
        if (!sourcePage) return previous;

        const duplicatedPage: WhiteboardPage = {
          ...structuredClone(sourcePage),
          id: createId(),
          name: `${sourcePage.name} (Copy)`,
          elements: sourcePage.elements.map((element: WhiteboardElement) => ({
            ...structuredClone(element),
            id: createId(),
          })),
        };

        duplicatedIndex = index + 1;

        return [
          ...previous.slice(0, duplicatedIndex),
          duplicatedPage,
          ...previous.slice(duplicatedIndex),
        ];
      });

      setCurrentPageIndex(duplicatedIndex);
      setSelectedElementId(null);
      setSelectedElementIds([]);
      setIsSaved(false);
    },
    [pushHistory],
  );

  const duplicateCurrentPage = useCallback(() => {
    duplicatePage(currentPageIndex);
  }, [currentPageIndex, duplicatePage]);

  const deletePage = (index: number) => {
    if (pages.length === 1) {
      clearPage();
      return;
    }
    pushHistory();
    setPages((p) => p.filter((_, idx) => idx !== index));
    setCurrentPageIndex((c) => Math.max(0, Math.min(c, pages.length - 2)));
  };

  const goToPreviousPage = useCallback(() => {
    setCurrentPageIndex((current) => {
      const next = Math.max(0, current - 1);
      if (next !== current) {
        setSelectedElementId(null);
        setSelectedElementIds([]);
      }
      return next;
    });
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPageIndex((current) => {
      const next = Math.min(pages.length - 1, current + 1);
      if (next !== current) {
        setSelectedElementId(null);
        setSelectedElementIds([]);
      }
      return next;
    });
  }, [pages.length]);

  const renamePage = (index: number) => {
    const page = pages[index];
    if (!page) return;

    setRenamePageState({
      open: true,
      index,
      name: page.name,
    });
  };

  const closeRenamePage = () => {
    setRenamePageState({
      open: false,
      index: null,
      name: "",
    });
  };

  const saveRenamedPage = () => {
    const index = renamePageState.index;
    const name = renamePageState.name.trim();

    if (index === null || !name) return;

    const page = pages[index];
    if (!page || page.name === name) {
      closeRenamePage();
      return;
    }

    pushHistory();
    setPages((previous) =>
      previous.map((item, idx) => (idx === index ? { ...item, name } : item)),
    );
    closeRenamePage();
  };

  const resolveWhiteboard = useCallback(async () => {
    try {
      setWhiteboardReady(false);

      if (mode === "appointment" && !appointmentId) {
        throw new Error("Appointment ID is required");
      }

      const response = await fetch("/api/whiteboards/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          appointmentId: mode === "appointment" ? appointmentId : undefined,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to resolve whiteboard");
      }

      const id = result?.whiteboard?.id;
      if (!id) throw new Error("Whiteboard ID was not returned");

      setDatabaseWhiteboardId(id);
      return id as string;
    } catch (error) {
      console.error("Failed to resolve whiteboard:", error);
      setSaveStatus("error");
      setWhiteboardReady(false);
      return null;
    }
  }, [mode, appointmentId]);

  const applyBoardData = useCallback((input: unknown) => {
    const boardData = parseSavedBoardData(input);
    if (!boardData) return;

    if (Array.isArray(boardData.pages) && boardData.pages.length > 0) {
      setPages(boardData.pages);
      const nextPageIndex = Math.min(
        Math.max(boardData.currentPageIndex ?? 0, 0),
        boardData.pages.length - 1,
      );
      setCurrentPageIndex(nextPageIndex);
      historyRef.current = [structuredClone(boardData.pages)];
      redoRef.current = [];
    }

    if (typeof boardData.showGrid === "boolean")
      setShowGrid(boardData.showGrid);
    if (typeof boardData.backgroundColor === "string")
      setBackgroundColor(boardData.backgroundColor);
    if (typeof boardData.backgroundImage === "string")
      setBackgroundImage(boardData.backgroundImage);
    else if (boardData.backgroundImage === null) setBackgroundImage(null);
    if (typeof boardData.gridColor === "string")
      setGridColor(boardData.gridColor);
    if (typeof boardData.snapToGrid === "boolean")
      setSnapToGrid(boardData.snapToGrid);
    if (typeof boardData.color === "string") setColor(boardData.color);
    if (typeof boardData.width === "number") setWidth(boardData.width);
    if (boardData.tool) setTool(boardData.tool);
    if (boardData.formulaCategory)
      setFormulaCategory(boardData.formulaCategory);

    setSelectedElementId(null);
    setSelectedElementIds([]);
  }, []);

  const saveBoard = useCallback(
    async (showFeedback = true) => {
      if (!databaseWhiteboardId || !whiteboardReady) return;

      if (showFeedback) {
        setSaveStatus("saving");
        setIsSaved(false);
      }

      const boardData = {
        version: 1,
        whiteboardId: databaseWhiteboardId,
        mode,
        appointmentId,
        pages,
        currentPageIndex,
        showGrid,
        backgroundColor,
        backgroundImage,
        gridColor,
        snapToGrid,
        color,
        width,
        tool,
        formulaCategory,
        savedAt: new Date().toISOString(),
      };

      try {
        const response = await fetch(
          `/api/whiteboards/${databaseWhiteboardId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: currentPage?.name ?? "Untitled Whiteboard",
              data: boardData,
            }),
          },
        );

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.error || "Failed to save whiteboard");
        }

        localStorage.setItem(storageKey, JSON.stringify(boardData));

        if (showFeedback) {
          setSaveStatus("saved");
          setIsSaved(true);
          window.setTimeout(() => {
            setIsSaved(false);
            setSaveStatus("idle");
          }, 2500);
        }
      } catch (error) {
        console.error("Failed to save whiteboard:", error);
        if (showFeedback) {
          setSaveStatus("error");
          setIsSaved(false);
        }
      }
    },
    [
      databaseWhiteboardId,
      whiteboardReady,
      mode,
      appointmentId,
      storageKey,
      pages,
      currentPageIndex,
      showGrid,
      backgroundColor,
      backgroundImage,
      gridColor,
      snapToGrid,
      color,
      width,
      tool,
      formulaCategory,
      currentPage,
    ],
  );

  const restoreBoard = useCallback(async () => {
    if (!databaseWhiteboardId) return;

    try {
      const response = await fetch(`/api/whiteboards/${databaseWhiteboardId}`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to retrieve whiteboard");
      }

      const boardData = result?.whiteboard?.data;
      if (boardData) {
        applyBoardData(boardData);
        localStorage.setItem(storageKey, JSON.stringify(boardData));
      }
    } catch (error) {
      console.error("Failed to restore whiteboard from database:", error);

      // Local cache is only a fallback when the database cannot be reached.
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          applyBoardData(parsed);
        }
      } catch (localError) {
        console.error("Failed to restore local whiteboard cache:", localError);
      }
    }
  }, [databaseWhiteboardId, storageKey, applyBoardData]);

  // Resolve the route context into the actual Prisma Whiteboard ID.
  useEffect(() => {
    if (mode === "appointment" && !appointmentId) return;

    let cancelled = false;

    const initializeWhiteboard = async () => {
      hasLoadedBoardRef.current = false;
      realtimeReadyReportedRef.current = false;
      setWhiteboardReady(false);

      const id = await resolveWhiteboard();
      if (!id || cancelled) return;

      try {
        const response = await fetch(`/api/whiteboards/${id}`, {
          method: "GET",
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.error || "Failed to load whiteboard");
        }

        if (!cancelled) {
          const boardData = result?.whiteboard?.data;

          if (boardData) {
            applyBoardData(boardData);
            localStorage.setItem(storageKey, JSON.stringify(boardData));
          }

          hasLoadedBoardRef.current = true;
          setWhiteboardReady(true);
        }
      } catch (error) {
        console.error("Failed to initialize whiteboard:", error);

        if (!cancelled) {
          try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              const parsed: unknown = JSON.parse(stored);
              applyBoardData(parsed);
            }
          } catch (localError) {
            console.error(
              "Failed to restore local whiteboard cache:",
              localError,
            );
          }

          hasLoadedBoardRef.current = true;
          setWhiteboardReady(true);
        }
      }
    };

    initializeWhiteboard();

    return () => {
      cancelled = true;
    };
  }, [mode, appointmentId, resolveWhiteboard, applyBoardData, storageKey]);

  const buildRealtimeData = useCallback(
    (revision = realtimeRevisionRef.current): WhiteboardRealtimeData => ({
      version: 1,
      whiteboardId: databaseWhiteboardId ?? undefined,
      mode,
      appointmentId,
      pages,
      currentPageIndex,
      showGrid,
      backgroundColor,
      backgroundImage,
      gridColor,
      snapToGrid,
      color,
      width,
      tool,
      formulaCategory,
      savedAt: new Date().toISOString(),
      realtimeOriginId: realtimeOriginIdRef.current,
      realtimeRevision: revision,
    }),
    [
      databaseWhiteboardId,
      mode,
      appointmentId,
      pages,
      currentPageIndex,
      showGrid,
      backgroundColor,
      backgroundImage,
      gridColor,
      snapToGrid,
      color,
      width,
      tool,
      formulaCategory,
    ],
  );

  const getRealtimeSignature = useCallback((data: WhiteboardRealtimeData) => {
    return JSON.stringify({
      whiteboardId: data.whiteboardId,
      mode: data.mode,
      appointmentId: data.appointmentId,
      pages: data.pages,
      currentPageIndex: data.currentPageIndex,
      showGrid: data.showGrid,
      backgroundColor: data.backgroundColor,
      backgroundImage: data.backgroundImage,
      gridColor: data.gridColor,
      snapToGrid: data.snapToGrid,
      color: data.color,
      width: data.width,
      tool: data.tool,
      formulaCategory: data.formulaCategory,
    });
  }, []);

  useEffect(() => {
    if (!remoteData || !whiteboardReady || !hasLoadedBoardRef.current) return;

    if (remoteData.realtimeOriginId === realtimeOriginIdRef.current) return;

    const remoteOrigin = remoteData.realtimeOriginId;
    const remoteRevision = remoteData.realtimeRevision;

    if (remoteOrigin && typeof remoteRevision === "number") {
      const lastRevision =
        lastRemoteRevisionByOriginRef.current.get(remoteOrigin);
      if (typeof lastRevision === "number" && remoteRevision <= lastRevision) {
        return;
      }
      lastRemoteRevisionByOriginRef.current.set(remoteOrigin, remoteRevision);
    }

    const signature = getRealtimeSignature(remoteData);
    if (signature === lastAppliedRemoteSignatureRef.current) return;

    lastAppliedRemoteSignatureRef.current = signature;
    applyBoardData(remoteData);
  }, [remoteData, whiteboardReady, applyBoardData, getRealtimeSignature]);

  useEffect(() => {
    if (!databaseWhiteboardId || !whiteboardReady || !hasLoadedBoardRef.current)
      return;

    const realtimeData = buildRealtimeData(realtimeRevisionRef.current);
    const signature = getRealtimeSignature(realtimeData);

    if (signature === lastAppliedRemoteSignatureRef.current) {
      lastAppliedRemoteSignatureRef.current = null;
      return;
    }

    realtimeRevisionRef.current += 1;
    onRealtimeChange?.(buildRealtimeData(realtimeRevisionRef.current));
  }, [
    databaseWhiteboardId,
    whiteboardReady,
    pages,
    currentPageIndex,
    showGrid,
    backgroundColor,
    backgroundImage,
    gridColor,
    snapToGrid,
    color,
    width,
    tool,
    formulaCategory,
    buildRealtimeData,
    getRealtimeSignature,
    onRealtimeChange,
  ]);

  useEffect(() => {
    if (
      !databaseWhiteboardId ||
      !whiteboardReady ||
      !hasLoadedBoardRef.current ||
      realtimeReadyReportedRef.current
    ) {
      return;
    }

    realtimeReadyReportedRef.current = true;
    onReady?.(buildRealtimeData());
  }, [databaseWhiteboardId, whiteboardReady, buildRealtimeData, onReady]);

  useEffect(() => {
    if (!databaseWhiteboardId || !whiteboardReady || !hasLoadedBoardRef.current)
      return;

    const timeout = window.setTimeout(() => {
      saveBoard(false);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [
    databaseWhiteboardId,
    whiteboardReady,
    pages,
    currentPageIndex,
    showGrid,
    backgroundColor,
    backgroundImage,
    gridColor,
    snapToGrid,
    color,
    width,
    tool,
    formulaCategory,
    saveBoard,
  ]);

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${currentPage?.name || "math-workspace"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && rootRef.current) {
        await rootRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTeacherControls = () => {
    setShowTeacherControls((current) => {
      const next = !current;

      if (!next) {
        setShowGraphSettings(false);
        setShowCalculator(false);
        setShowToolsPanel(false);
        setShowPagesPanel(false);
        setShowColorPopup(false);
        setColorPopupTarget(null);
      }

      return next;
    });
  };

  const clampTeacherControlPosition = useCallback(
    (left: number, top: number) => {
      if (typeof window === "undefined") {
        return { left, top };
      }

      const size = 52;
      const margin = 12;

      return {
        left: Math.min(
          Math.max(margin, left),
          Math.max(margin, window.innerWidth - size - margin),
        ),
        top: Math.min(
          Math.max(margin, top),
          Math.max(margin, window.innerHeight - size - margin),
        ),
      };
    },
    [],
  );

  // Put the launcher in the bottom-right corner on first mount.
  useEffect(() => {
    if (teacherControlInitializedRef.current || typeof window === "undefined") {
      return;
    }

    teacherControlInitializedRef.current = true;

    const size = 52;
    const margin = 20;

    setTeacherControlPosition({
      left: Math.max(margin, window.innerWidth - size - margin),
      top: Math.max(margin, window.innerHeight - size - margin),
    });
  }, []);

  // Keep a dragged launcher inside the visible board when the viewport changes.
  useEffect(() => {
    const handleResize = () => {
      setTeacherControlPosition((current) =>
        clampTeacherControlPosition(current.left, current.top),
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampTeacherControlPosition]);

  const handleTeacherControlPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();

    teacherControlDraggingRef.current = true;
    setTeacherControlDragging(true);
    teacherControlDidDragRef.current = false;
    teacherControlDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTeacherControlPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!teacherControlDraggingRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const offset = teacherControlDragOffsetRef.current;
    const next = clampTeacherControlPosition(
      event.clientX - offset.x,
      event.clientY - offset.y,
    );

    if (
      Math.abs(next.left - teacherControlPosition.left) > 2 ||
      Math.abs(next.top - teacherControlPosition.top) > 2
    ) {
      teacherControlDidDragRef.current = true;
    }

    setTeacherControlPosition(next);
  };

  const handleTeacherControlPointerUp = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!teacherControlDraggingRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    teacherControlDraggingRef.current = false;
    setTeacherControlDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTeacherControlClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // A drag should reposition the launcher without also opening/closing it.
    if (teacherControlDidDragRef.current) {
      teacherControlDidDragRef.current = false;
      return;
    }

    toggleTeacherControls();
  };

  const appendCalculator = useCallback((value: string) => {
    setCalculatorValue((current) => `${current}${value}`);
  }, []);

  const factorial = useCallback((n: number) => {
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n || n > 170)
      throw new Error("Invalid factorial");
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }, []);

  const runCalculator = useCallback(
    (expression = calculatorValue) => {
      if (!expression.trim()) return;
      try {
        let norm = expression
          .replace(/π/g, "Math.PI")
          .replace(/e/g, "Math.E")
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/−/g, "-")
          .replace(/√/g, "sqrt")
          .replace(/\^/g, "**")
          .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

        // Scientific functions. Angle mode applies to trigonometry.
        const angle = calculatorAngleMode === "DEG" ? "Math.PI/180" : "1";
        norm = norm
          .replace(/asin\(/g, `Math.asin(`)
          .replace(/acos\(/g, `Math.acos(`)
          .replace(/atan\(/g, `Math.atan(`)
          .replace(/sin\(/g, `Math.sin(`)
          .replace(/cos\(/g, `Math.cos(`)
          .replace(/tan\(/g, `Math.tan(`)
          .replace(/sqrt\(/g, `Math.sqrt(`)
          .replace(/ln\(/g, `Math.log(`)
          .replace(/log\(/g, `Math.log10(`)
          .replace(/abs\(/g, `Math.abs(`)
          .replace(/floor\(/g, `Math.floor(`)
          .replace(/ceil\(/g, `Math.ceil(`)
          .replace(/round\(/g, `Math.round(`);

        // Apply DEG/RAD conversion to trig arguments and inverse-trig results.
        if (calculatorAngleMode === "DEG") {
          norm = norm.replace(/Math\.(sin|cos|tan)\(/g, `Math.$1((`);
          norm = norm.replace(
            /Math\.(sin|cos|tan)\(\(([^()]*)\)/g,
            `Math.$1(($2)*${angle})`,
          );
          norm = norm.replace(
            /Math\.(asin|acos|atan)\(([^()]*)\)/g,
            `(Math.$1($2)/${angle})`,
          );
        }

        if (
          !/^[0-9A-Za-z_+\-*/().,%\s*]+$/.test(norm) ||
          /(constructor|prototype|window|document|globalThis|Function|eval)/i.test(
            norm,
          )
        ) {
          throw new Error("Invalid expression");
        }

        // Factorials are evaluated before the final expression.
        while (/([0-9.]+)!/.test(norm))
          norm = norm.replace(/([0-9.]+)!/g, (_, n) => `factorial(${n})`);

        const res = Function(
          "factorial",
          `"use strict"; return (${norm})`,
        )(factorial);
        const formatted =
          typeof res === "number" && Number.isFinite(res)
            ? String(Number(res.toPrecision(12)))
            : "Error";
        setCalculatorResult(formatted);
        setCalculatorHistory((history) =>
          [{ expression, result: formatted }, ...history].slice(0, 12),
        );
      } catch {
        setCalculatorResult("Error");
      }
    },
    [calculatorAngleMode, calculatorValue, factorial],
  );

  const clearCalculator = useCallback(() => {
    setCalculatorValue("");
    setCalculatorResult("");
  }, []);

  const handleCalculatorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, select, textarea")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      calculatorDraggingRef.current = true;
      calculatorDragOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handleCalculatorPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!calculatorDraggingRef.current) return;
      const parent = event.currentTarget.parentElement?.getBoundingClientRect();
      if (!parent) return;
      const width = event.currentTarget.offsetWidth;
      const height = event.currentTarget.offsetHeight;
      const x = Math.max(
        8,
        Math.min(
          event.clientX - parent.left - calculatorDragOffsetRef.current.x,
          parent.width - width - 8,
        ),
      );
      const y = Math.max(
        8,
        Math.min(
          event.clientY - parent.top - calculatorDragOffsetRef.current.y,
          parent.height - height - 8,
        ),
      );
      setCalculatorPosition({ x, y });
    },
    [],
  );

  const handleCalculatorPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      calculatorDraggingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    },
    [],
  );

  const insertFormula = useCallback((val: string) => {
    setTool("equation");
    setSelectedEquation(val);
  }, []);

  const formulaSets = {
    algebra: [
      ["Quadratic formula", "x = (-b ± √(b² - 4ac)) / 2a"],
      ["Slope formula", "m = (y₂ - y₁) / (x₂ - x₁)"],
      ["Distance formula", "d = √((x₂ - x₁)² + (y₂ - y₁)²)"],
      ["Midpoint formula", "M = ((x₁ + x₂)/2, (y₁ + y₂)/2)"],
      ["Exponential growth", "A = P(1 + r)^t"],
      ["Logarithm power rule", "log(a^b) = b · log(a)"],
    ],
    geometry: [
      ["Circle area", "A = πr²"],
      ["Circumference", "C = 2πr"],
      ["Triangle area", "A = ½bh"],
      ["Pythagorean theorem", "a² + b² = c²"],
      ["Sphere volume", "V = 4/3 πr³"],
      ["Cylinder volume", "V = πr²h"],
    ],
    calculus: [
      ["Derivative definition", "f'(x) = lim(h→0) [f(x+h) - f(x)] / h"],
      ["Power rule", "d/dx [x^n] = n · x^(n-1)"],
      ["Product rule", "(fg)' = f'g + fg'"],
      ["Integration by parts", "∫ u dv = uv - ∫ v du"],
      ["Fundamental theorem", "∫_a^b f(x)dx = F(b) - F(a)"],
    ],
    trigonometry: [
      ["Sine definition", "sin(θ) = Opposite / Hypotenuse"],
      ["Cosine definition", "cos(θ) = Adjacent / Hypotenuse"],
      ["Tangent definition", "tan(θ) = Sin(θ) / Cos(θ)"],
      ["Pythagorean identity", "sin²(θ) + cos²(θ) = 1"],
      ["Law of sines", "a / sin(A) = b / sin(B) = c / sin(C)"],
      ["Law of cosines", "c² = a² + b² - 2ab cos(C)"],
    ],
    statistics: [
      ["Arithmetic mean", "μ = Σx / N"],
      ["Sample variance", "s² = Σ(x - x̄)² / (n - 1)"],
      ["Standard deviation", "σ = √(Σ(x - μ)² / N)"],
      ["Binomial probability", "P(X = k) = C(n,k) p^k (1-p)^(n-k)"],
      ["Z-score", "z = (x - μ) / σ"],
    ],
    physics: [
      ["Newton's second law", "F = ma"],
      ["Kinematic equation", "d = v₀t + ½at²"],
      ["Work energy theorem", "W = ΔKE = Fd cos(θ)"],
      ["Universal gravitation", "F = G (m₁m₂)/r²"],
      ["Ohm's Law", "V = IR"],
    ],
  };

  const toolButton = (
    name: Tool,
    label: string,
    icon: React.ReactNode,
    shortcut?: string,
  ) => {
    const active = tool === name;

    return (
      <button
        key={name}
        type="button"
        onClick={() => {
          setTool(name);
          setShowShapeToolsPopup(false);
        }}
        title={shortcut ? `${label} (${shortcut})` : label}
        aria-label={label}
        className={`group relative flex size-10 shrink-0 items-center justify-center rounded-2xl transition-all ${
          active
            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
            : "text-white/65 hover:bg-white/10 hover:text-white"
        }`}
      >
        {icon}

        {shortcut && (
          <span className="pointer-events-none absolute -right-1.5 -top-1 hidden rounded bg-slate-900 px-1 py-0.5 text-[7px] font-bold text-white shadow-sm 2xl:block">
            {shortcut}
          </span>
        )}

        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/90 px-2 py-1 text-[9px] font-semibold text-white shadow-xl backdrop-blur-xl opacity-0 transition-opacity group-hover:opacity-100 lg:block">
          {label}
        </span>
      </button>
    );
  };

  const openToolbarTextEditor = useCallback(
    (type: "text" | "equation") => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      setTool(type);
      openTextEditor(
        {
          x: rect.width / 2,
          y: Math.max(120, rect.height / 2 - 120),
        },
        type,
        type === "equation" ? selectedEquation : "",
      );
      setSelectedEquation("");
    },
    [openTextEditor, selectedEquation],
  );

  useEffect(() => {
    const handleFocusModeKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (
        !isTypingTarget &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        toggleTeacherControls();
      }
    };

    window.addEventListener("keydown", handleFocusModeKeyDown);
    return () => window.removeEventListener("keydown", handleFocusModeKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (tool !== "select" || !selectedElementIds.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "d" &&
        selectedElementIds.length === 1
      ) {
        event.preventDefault();
        duplicateSelectedElement();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        pushHistory();
        updateCurrentPage((page) => ({
          ...page,
          elements: page.elements.filter(
            (el: WhiteboardElement) => !selectedElementIds.includes(el.id),
          ),
        }));
        setSelectedElementId(null);
        setSelectedElementIds([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    duplicateSelectedElement,
    elements,
    pushHistory,
    selectedElementId,
    selectedElementIds,
    tool,
    updateCurrentPage,
  ]);

  const selectedElement = getSelectedElement();

  return (
    <main
      ref={rootRef}
      className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900 antialiased"
    >
      {showTeacherControls && showGraphSettings && (
        <div
          className="fixed z-[290] w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl shadow-slate-950/15 backdrop-blur-2xl"
          style={{
            left: getPopupPosition("graph", {
              x: Math.max(12, window.innerWidth - 420),
              y: Math.max(80, window.innerHeight / 2 - 220),
            }).x,
            top: getPopupPosition("graph", {
              x: 0,
              y: Math.max(80, window.innerHeight / 2 - 220),
            }).y,
          }}
          onPointerMove={movePopupDrag}
          onPointerUp={endPopupDrag}
        >
          <div
            className="mb-3 flex cursor-move items-center justify-between select-none"
            onPointerDown={(event) => startPopupDrag("graph", event)}
          >
            <h3 className="text-sm font-bold text-slate-900">
              Background & Grid Settings
            </h3>
            <button
              onClick={() => setShowGraphSettings(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
              Enable Grid Lines
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="size-4 accent-blue-600"
              />
            </label>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Background Color
              </label>
              <select
                value={backgroundColor}
                onChange={(e) => {
                  setBackgroundColor(e.target.value);
                  setBackgroundImage(null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              >
                {BACKGROUND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 grid grid-cols-6 gap-1.5">
                {BACKGROUND_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setBackgroundColor(opt.value);
                      setBackgroundImage(null);
                    }}
                    className={`h-6 w-full rounded-md border ${backgroundColor === opt.value && !backgroundImage ? "border-blue-600 ring-2 ring-blue-500/20" : "border-slate-200"}`}
                    style={{ backgroundColor: opt.value }}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Background Image
              </label>
              <select
                value={backgroundImage ?? ""}
                onChange={(e) => {
                  setBackgroundImage(e.target.value || null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              >
                <option value="">No Image — Use Background Color</option>
                {BACKGROUND_IMAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {BACKGROUND_IMAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBackgroundImage(opt.value)}
                    className={`group relative h-16 overflow-hidden rounded-lg border transition ${
                      backgroundImage === opt.value
                        ? "border-blue-600 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                    title={opt.label}
                    aria-label={`Use ${opt.label} background`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.value}
                      alt={opt.label}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[9px] font-bold text-white">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Grid Line Color
              </label>
              <select
                value={gridColor}
                onChange={(e) => setGridColor(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              >
                {GRID_COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {GRID_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGridColor(opt.value)}
                    className={`h-6 w-full rounded-md border ${gridColor === opt.value ? "border-blue-600 ring-2 ring-blue-500/20" : "border-slate-200"}`}
                    style={{ backgroundColor: opt.value }}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
              Snap to Grid
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="size-4 accent-blue-600"
              />
            </label>
          </div>
        </div>
      )}

      {showTeacherControls && showCalculator && (
        <div className="fixed inset-0 z-[500] pointer-events-none">
          <div
            className="pointer-events-auto absolute w-[min(430px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/98 shadow-2xl shadow-slate-950/25 backdrop-blur-2xl"
            style={{
              left: calculatorPosition.x || undefined,
              top: calculatorPosition.y || undefined,
              right: calculatorPosition.x ? undefined : "360px",
              bottom: calculatorPosition.y ? undefined : "96px",
            }}
            onPointerDown={handleCalculatorPointerDown}
            onPointerMove={handleCalculatorPointerMove}
            onPointerUp={handleCalculatorPointerUp}
          >
            <div className="flex cursor-move items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-3 select-none">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Scientific Calculator
                </h3>
                <p className="text-[10px] text-slate-500">
                  Drag the header to move • {calculatorAngleMode} mode
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalculatorAngleMode((m) => (m === "DEG" ? "RAD" : "DEG"))
                  }
                  className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300"
                >
                  {calculatorAngleMode}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCalculator(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="p-3">
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-3 text-right">
                <input
                  value={calculatorValue}
                  onChange={(e) => setCalculatorValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runCalculator();
                    if (e.key === "Escape") clearCalculator();
                  }}
                  placeholder="0"
                  className="w-full bg-transparent text-right font-mono text-lg text-white outline-none placeholder:text-slate-500"
                />
                <div className="min-h-7 pt-1 font-mono text-2xl font-bold text-blue-300">
                  {calculatorResult || "0"}
                </div>
              </div>

              <div className="mb-2 grid grid-cols-4 gap-1.5">
                {[
                  {
                    label: "MC",
                    action: () => setCalculatorMemory(0),
                  },
                  {
                    label: "MR",
                    action: () =>
                      setCalculatorValue(
                        (value) => `${value}${calculatorMemory}`,
                      ),
                  },
                  {
                    label: "M+",
                    action: () =>
                      setCalculatorMemory(
                        (memory) => memory + (Number(calculatorResult) || 0),
                      ),
                  },
                  {
                    label: "M−",
                    action: () =>
                      setCalculatorMemory(
                        (memory) => memory - (Number(calculatorResult) || 0),
                      ),
                  },
                ].map((button) => (
                  <button
                    key={button.label}
                    type="button"
                    onClick={button.action}
                    className="rounded-xl bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                  >
                    {button.label}
                  </button>
                ))}
              </div>

              <div className="mb-2 grid grid-cols-4 gap-1.5">
                {[
                  ["sin", "sin("],
                  ["cos", "cos("],
                  ["tan", "tan("],
                  ["√", "√("],
                  ["sin⁻¹", "asin("],
                  ["cos⁻¹", "acos("],
                  ["tan⁻¹", "atan("],
                  ["x²", "^2"],
                  ["ln", "ln("],
                  ["log", "log("],
                  ["π", "π"],
                  ["e", "e"],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => appendCalculator(value)}
                    className="rounded-xl bg-blue-50 px-2 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  ["7", "7"],
                  ["8", "8"],
                  ["9", "9"],
                  ["÷", "/"],
                  ["4", "4"],
                  ["5", "5"],
                  ["6", "6"],
                  ["×", "*"],
                  ["1", "1"],
                  ["2", "2"],
                  ["3", "3"],
                  ["−", "-"],
                  ["0", "0"],
                  [".", "."],
                  ["(", "("],
                  ["+", "+"],
                  ["%", "%"],
                  ["xʸ", "^"],
                  ["!", "!"],
                  ["⌫", "BACK"],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      value === "BACK"
                        ? setCalculatorValue((v) => v.slice(0, -1))
                        : appendCalculator(value)
                    }
                    className="rounded-xl bg-slate-100 px-2 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearCalculator}
                  className="rounded-xl bg-rose-50 px-2 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100"
                >
                  AC
                </button>
                <button
                  type="button"
                  onClick={() => runCalculator()}
                  className="col-span-2 rounded-xl bg-blue-600 px-2 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                >
                  =
                </button>
              </div>

              {calculatorHistory.length > 0 && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-600">
                    History ({calculatorHistory.length})
                  </summary>
                  <div className="max-h-32 overflow-auto border-t border-slate-200">
                    {calculatorHistory.map((item, index) => (
                      <button
                        key={`${item.expression}-${index}`}
                        type="button"
                        onClick={() => setCalculatorValue(item.expression)}
                        className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-white"
                      >
                        <div className="truncate font-mono text-[10px] text-slate-500">
                          {item.expression}
                        </div>
                        <div className="font-mono text-xs font-bold text-slate-800">
                          = {item.result}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {textEditor.open && (
        <div
          className="fixed z-100 w-130 max-w-[calc(100vw-24px)] overflow-visible rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
          style={{
            left: textEditor.x,
            top: textEditor.y,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={handleTextEditorDragMove}
          onPointerUp={handleTextEditorDragEnd}
        >
          <div
            className="flex cursor-move items-center justify-between border-b border-slate-100 bg-slate-50/95 px-4 py-3 select-none"
            onPointerDown={handleTextEditorDrag}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                {textEditor.type === "equation" ? (
                  <Sigma className="size-4" />
                ) : (
                  <Type className="size-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {textEditor.editingElementId
                    ? textEditor.type === "equation"
                      ? "Edit Equation"
                      : "Edit Text"
                    : textEditor.type === "equation"
                      ? "LaTeX Equation"
                      : "Add Text"}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {textEditor.editingElementId
                    ? "Edit the selected item on your board"
                    : textEditor.type === "equation"
                      ? "Type LaTeX directly and preview the result"
                      : "Add a label or note to your board"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeTextEditor}
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close text editor"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="mb-3 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTextPanel(null);
                  setTextEditor((previous) => ({ ...previous, type: "text" }));
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  textEditor.type === "text"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Type className="size-3.5" /> Text
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setTextEditor((previous) => ({
                    ...previous,
                    type: "equation",
                    fontSize: Math.max(previous.fontSize, 24),
                  }))
                }
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                  textEditor.type === "equation"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sigma className="size-3.5" /> Math / LaTeX
                </span>
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2">
              {textEditor.type === "equation" && (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTextPanel((v) =>
                          v === "symbols" ? null : "symbols",
                        )
                      }
                      className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${
                        activeTextPanel === "symbols"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Sigma className="size-3.5" /> Symbols
                    </button>
                    {activeTextPanel === "symbols" && (
                      <div className="absolute left-0 top-11 z-120 w-85 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Insert LaTeX symbols
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {[
                            ["α", "\\alpha "],
                            ["β", "\\beta "],
                            ["γ", "\\gamma "],
                            ["θ", "\\theta "],
                            ["π", "\\pi "],
                            ["λ", "\\lambda "],
                            ["μ", "\\mu "],
                            ["Σ", "\\Sigma "],
                            ["∑", "\\sum "],
                            ["∏", "\\prod "],
                            ["∫", "\\int "],
                            ["∞", "\\infty "],
                            ["±", "\\pm "],
                            ["×", "\\times "],
                            ["≤", "\\le "],
                            ["≥", "\\ge "],
                            ["≠", "\\neq "],
                            ["≈", "\\approx "],
                            ["→", "\\rightarrow "],
                            ["∂", "\\partial "],
                            ["∇", "\\nabla "],
                          ].map(([label, value]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => insertLatexAtCursor(value)}
                              className="flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title={`Insert ${value.trim()}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTextPanel((v) =>
                          v === "templates" ? null : "templates",
                        )
                      }
                      className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${
                        activeTextPanel === "templates"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <FunctionSquare className="size-3.5" /> Templates
                    </button>
                    {activeTextPanel === "templates" && (
                      <div className="absolute left-0 top-11 z-120 w-90 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Common LaTeX structures
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            ["Fraction", "\\frac{a}{b}"],
                            ["Square root", "\\sqrt{x}"],
                            ["Power", "x^{2}"],
                            ["Subscript", "x_{i}"],
                            ["Sum", "\\sum_{i=1}^{n} x_i"],
                            ["Integral", "\\int_{a}^{b} f(x)\\,dx"],
                            ["Limit", "\\lim_{x\\to0} f(x)"],
                            ["Text", "\\text{word}"],
                            ["Parentheses", "\\left( x \\right)"],
                            ["Absolute value", "\\left| x \\right|"],
                          ].map(([label, value]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => insertLatexAtCursor(value)}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left hover:border-blue-300 hover:bg-blue-50"
                            >
                              <div className="text-[10px] font-bold text-slate-700">
                                {label}
                              </div>
                              <div className="mt-0.5 truncate font-mono text-[10px] text-blue-600">
                                {value}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:inline">
                  Format
                </span>

                <button
                  type="button"
                  disabled={textEditor.type === "equation"}
                  onClick={() =>
                    setTextEditor((p) => ({ ...p, bold: !p.bold }))
                  }
                  className={`flex size-9 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                    textEditor.type === "equation"
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : textEditor.bold
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Bold"
                  aria-label="Bold"
                >
                  B
                </button>

                <button
                  type="button"
                  disabled={textEditor.type === "equation"}
                  onClick={() =>
                    setTextEditor((p) => ({ ...p, italic: !p.italic }))
                  }
                  className={`flex size-9 items-center justify-center rounded-lg border text-sm italic transition-colors ${
                    textEditor.type === "equation"
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : textEditor.italic
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Italic"
                  aria-label="Italic"
                >
                  I
                </button>

                <button
                  type="button"
                  disabled={textEditor.type === "equation"}
                  onClick={() =>
                    setTextEditor((p) => ({
                      ...p,
                      underline: !p.underline,
                    }))
                  }
                  className={`flex size-9 items-center justify-center rounded-lg border text-sm font-semibold underline transition-colors ${
                    textEditor.type === "equation"
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : textEditor.underline
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Underline"
                  aria-label="Underline"
                >
                  U
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTextEditor((p) => ({
                      ...p,
                      fontSize: Math.max(12, p.fontSize - 2),
                    }))
                  }
                  className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50"
                  title="Decrease font size"
                  aria-label="Decrease font size"
                >
                  −
                </button>

                <input
                  type="number"
                  min={12}
                  max={96}
                  value={textEditor.fontSize}
                  onChange={(event) =>
                    setTextEditor((p) => ({
                      ...p,
                      fontSize: Math.min(
                        96,
                        Math.max(12, Number(event.target.value) || 12),
                      ),
                    }))
                  }
                  className="h-9 w-16 rounded-lg border border-slate-200 bg-white text-center text-xs font-semibold"
                  title="Font size"
                  aria-label="Font size"
                />

                <button
                  type="button"
                  onClick={() =>
                    setTextEditor((p) => ({
                      ...p,
                      fontSize: Math.min(96, p.fontSize + 2),
                    }))
                  }
                  className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50"
                  title="Increase font size"
                  aria-label="Increase font size"
                >
                  +
                </button>

                <div className="relative">
                  <button
                    type="button"
                    disabled={textEditor.type === "equation"}
                    onClick={() =>
                      setActiveTextPanel((v) =>
                        v === "formatting" ? null : "formatting",
                      )
                    }
                    className={`flex size-9 items-center justify-center rounded-lg border transition-colors ${
                      textEditor.type === "equation"
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                        : activeTextPanel === "formatting"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Text color"
                    aria-label="Text color"
                  >
                    <span
                      className="size-4 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-300"
                      style={{ backgroundColor: textEditor.color }}
                    />
                  </button>

                  {activeTextPanel === "formatting" &&
                    textEditor.type === "text" && (
                      <div className="absolute right-0 top-11 z-120 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Text Color
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setTextEditor((p) => ({ ...p, color: c }));
                                setActiveTextPanel(null);
                              }}
                              className={`flex size-8 items-center justify-center rounded-full ${
                                textEditor.color === c
                                  ? "ring-2 ring-blue-500 ring-offset-2"
                                  : ""
                              }`}
                              title={`Text color ${c}`}
                              aria-label={`Text color ${c}`}
                            >
                              <span
                                className="size-6 rounded-full border border-slate-200"
                                style={{ backgroundColor: c }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div>
              <textarea
                ref={textInputRef}
                value={textEditor.text}
                onChange={(event) =>
                  setTextEditor((previous) => ({
                    ...previous,
                    text: event.target.value,
                  }))
                }
                onKeyDown={handleTextEditorKeyDown}
                placeholder={
                  textEditor.type === "equation"
                    ? "Type LaTeX here… e.g. \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
                    : "Type your text..."
                }
                rows={textEditor.type === "equation" ? 4 : 3}
                spellCheck={textEditor.type !== "equation"}
                className={`w-full resize-none rounded-xl border px-3.5 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 ${
                  textEditor.type === "equation"
                    ? "min-h-29 bg-slate-950 font-mono leading-6 text-emerald-300 placeholder:text-slate-500"
                    : "bg-slate-50 placeholder:text-slate-400"
                }`}
              />
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>
                  {textEditor.type === "equation"
                    ? "LaTeX source • Ctrl/Cmd + Enter to add"
                    : "Ctrl/Cmd + Enter to add"}
                </span>
                <span>{textEditor.text.length}/1000</span>
              </div>
            </div>

            {textEditor.text.trim() && (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Live Preview
                  </span>
                  {textEditor.type === "equation" && (
                    <span className="font-mono text-[9px] text-slate-400">
                      LaTeX → Math
                    </span>
                  )}
                </div>
                <div
                  className="max-h-16 overflow-hidden wrap-break-word whitespace-pre-wrap"
                  style={{
                    color: textEditor.color,
                    fontSize: Math.min(textEditor.fontSize, 30),
                    fontWeight: textEditor.bold ? 700 : 400,
                    fontStyle: textEditor.italic ? "italic" : "normal",
                    textDecoration: textEditor.underline ? "underline" : "none",
                    fontFamily:
                      textEditor.type === "equation"
                        ? "Cambria Math, STIX Two Math, Times New Roman, serif"
                        : "Inter, ui-sans-serif, system-ui, sans-serif",
                  }}
                >
                  {textEditor.type === "equation"
                    ? latexToReadable(textEditor.text)
                    : textEditor.text}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-[10px] text-slate-400">
                {textEditor.editingElementId
                  ? "Changes will update the selected item."
                  : textEditor.type === "equation"
                    ? "Use the popups for quick LaTeX structures."
                    : "Add text directly to the board."}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeTextEditor}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addTextElement}
                  disabled={!textEditor.text.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {textEditor.type === "equation" ? (
                    <Sigma className="size-3.5" />
                  ) : (
                    <Type className="size-3.5" />
                  )}
                  {textEditor.editingElementId
                    ? textEditor.type === "equation"
                      ? "Update Equation"
                      : "Update Text"
                    : textEditor.type === "equation"
                      ? "Add Equation"
                      : "Add to Board"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={importImage}
      />

      {/* Full-screen drawing workspace */}
      <div className="absolute inset-0">
        <section
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{ backgroundColor }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={handleCanvasDoubleClick}
              onContextMenu={handleCanvasContextMenu}
            />
          </div>
        </section>

        {/* Floating glass drawing dock — auto-reveals when the pointer enters the bottom hover zone */}
        {showTeacherControls && (
          <div
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-[400] flex h-[124px] items-end justify-center px-2 pb-3 sm:px-3 sm:pb-5"
            onPointerEnter={() => setToolbarHovered(true)}
            onPointerLeave={(event) => {
              // Keep the toolbar open while the pointer moves toward the popup.
              const next = event.relatedTarget;
              if (
                next instanceof Node &&
                (event.currentTarget.contains(next) ||
                  (next instanceof Element && next.closest('[role="dialog"]')))
              )
                return;
              setToolbarHovered(false);
            }}
          >
            <div
              className={`relative flex w-fit max-w-[calc(100vw-16px)] items-center gap-1 overflow-x-auto overflow-y-visible scrollbar-none rounded-[28px] sm:max-w-[calc(100vw-24px)] sm:gap-1.5 border border-white/20 bg-slate-950/45 px-2.5 py-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-3xl backdrop-saturate-150 transition-all duration-300 ease-out ${
                toolbarHovered
                  ? "translate-y-0 opacity-100 scale-100"
                  : "translate-y-[88px] opacity-0 scale-[0.96]"
              }`}
            >
              <span
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
                aria-hidden="true"
              />

              {/* Page navigation */}
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={currentPageIndex === 0}
                title="Previous page"
                aria-label="Previous page"
                className="group flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white/75 shadow-inner shadow-white/5 transition-all hover:-translate-y-0.5 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronLeft className="size-5" />
              </button>

              <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 sm:flex">
                <div className="flex size-7 items-center justify-center rounded-xl bg-white/10 text-[10px] font-extrabold text-white">
                  {currentPageIndex + 1}
                </div>
                <div className="min-w-0 max-w-[125px]">
                  <div className="truncate text-[10px] font-bold text-white">
                    {currentPage?.name ?? "Page"}
                  </div>
                  <div className="text-[8px] font-medium text-white/45">
                    {currentPageIndex + 1} / {pages.length}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPageIndex >= pages.length - 1}
                title="Next page"
                aria-label="Next page"
                className="group flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white/75 shadow-inner shadow-white/5 transition-all hover:-translate-y-0.5 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronRight className="size-5" />
              </button>

              <div className="mx-0.5 h-8 w-px shrink-0 bg-white/10" />

              {/* Core drawing tools — Select and Pen remain immediately available. */}
              <div className="flex shrink-0 items-center gap-0.5">
                {toolButton(
                  "select",
                  "Select / Move",
                  <MousePointer2 className="size-4" />,
                  "V",
                )}
                {toolButton(
                  "pen",
                  "Pen / Draw",
                  <PenLine className="size-4" />,
                  "P",
                )}
              </div>

              <div className="mx-0.5 h-8 w-px shrink-0 bg-white/10" />

              {/* Import image for classroom illustrations */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                title="Import image"
                aria-label="Import image"
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ImageIcon className="size-4" />
              </button>

              {/* Shapes & math tools popup — replaces the horizontal-scrolling tool strip. */}
              <button
                ref={shapeToolsButtonRef}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowShapeToolsPopup((value) => !value);
                }}
                title="Shapes & math tools"
                aria-label="Open shapes and math tools"
                aria-expanded={showShapeToolsPopup}
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-white/65 transition-colors hover:text-white"
              >
                <Shapes className="size-4" />
              </button>

              <div className="mx-0.5 h-8 w-px shrink-0 bg-white/10" />

              {/* More board controls — kept compact so the dock remains a single surface */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  ref={colorButtonRef}
                  type="button"
                  onClick={() => {
                    if (showColorPopup && colorPopupTarget === "pen") {
                      setShowColorPopup(false);
                      return;
                    }
                    positionColorPopup("pen");
                  }}
                  title="Pen color"
                  aria-label="Pen color"
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    colorPopupTarget === "pen" && showColorPopup
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className="size-4 rounded-full border border-white/70 shadow-sm ring-1 ring-white/20"
                    style={{ backgroundColor: color }}
                  />
                </button>

                {selectedElement ? (
                  <>
                    <button
                      type="button"
                      onClick={duplicateSelectedElement}
                      title="Duplicate selected object (⌘/Ctrl+D)"
                      aria-label="Duplicate selected object"
                      className="flex size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-blue-500/15 hover:text-blue-300"
                    >
                      <Copy className="size-4" />
                    </button>
                    <button
                      ref={objectColorButtonRef}
                      type="button"
                      onClick={() => {
                        if (showColorPopup && colorPopupTarget === "object") {
                          setShowColorPopup(false);
                          setColorPopupTarget(null);
                          return;
                        }
                        positionColorPopup("object");
                      }}
                      title="Selected object color"
                      aria-label="Selected object color"
                      className={`flex size-10 items-center justify-center rounded-2xl transition ${
                        colorPopupTarget === "object" && showColorPopup
                          ? "bg-blue-500/20 text-blue-300"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span
                        className="size-4 rounded-md border border-white/70 shadow-sm ring-1 ring-white/20"
                        style={{
                          backgroundColor:
                            "color" in selectedElement
                              ? selectedElement.color
                              : "#94a3b8",
                        }}
                      />
                    </button>
                  </>
                ) : null}

                <div
                  className="hidden h-10 w-28 shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2.5 sm:flex"
                  title="Stroke width"
                >
                  <PenLine className="size-3.5 shrink-0 text-white/50" />
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    aria-label="Stroke width"
                    className="h-1 w-full cursor-pointer accent-blue-500"
                  />
                  <span className="w-7 text-right text-[8px] font-bold text-white/45">
                    {width}px
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGraphSettings((v) => !v)}
                  title="Canvas & grid"
                  aria-label="Canvas & grid"
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    showGraphSettings
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Grid2X2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCalculator((v) => !v)}
                  title="Calculator"
                  aria-label="Calculator"
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    showCalculator
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Calculator className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowToolsPanel((v) => !v)}
                  title="Math toolkit"
                  aria-label="Math toolkit"
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    showToolsPanel
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <PanelRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPagesPanel((v) => !v)}
                  title="Manage pages"
                  aria-label="Manage pages"
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    showPagesPanel
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <BookOpen className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={restoreBoard}
                  title="Restore workspace"
                  aria-label="Restore workspace"
                  className="flex size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <FolderOpen className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={exportPNG}
                  title="Export PNG"
                  aria-label="Export PNG"
                  className="flex size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <Download className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={clearPage}
                  title="Clear page"
                  aria-label="Clear page"
                  className="flex size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-red-500/15 hover:text-red-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mx-0.5 h-8 w-px shrink-0 bg-white/10" />

              {/* Compact actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={undo}
                  title="Undo"
                  aria-label="Undo"
                  className="flex size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <Undo2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  title="Redo"
                  aria-label="Redo"
                  className="flex size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <Redo2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => saveBoard(true)}
                  title="Save workspace"
                  aria-label="Save workspace"
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    saveStatus === "saved"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : saveStatus === "saving"
                        ? "bg-blue-400/15 text-blue-300"
                        : saveStatus === "error"
                          ? "bg-red-400/15 text-red-300"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Save
                    className={`size-4 ${saveStatus === "saving" ? "animate-pulse" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={addPage}
                  title="Add blank page"
                  aria-label="Add blank page"
                  className="hidden size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-white/10 hover:text-white sm:flex"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={duplicateCurrentPage}
                  title="Duplicate current page"
                  aria-label="Duplicate current page"
                  className="hidden size-10 items-center justify-center rounded-2xl text-white/65 transition hover:bg-blue-500/15 hover:text-blue-300 sm:flex"
                >
                  <Copy className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className={`flex size-10 items-center justify-center rounded-2xl transition ${
                    isFullscreen
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {isFullscreen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </button>
              </div>

              {/* Tiny active-state indicator */}
              <span
                className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-white/30"
                aria-hidden="true"
              />
            </div>

            {showShapeToolsPopup && (
              <div
                className="fixed z-[500] w-[min(390px,calc(100vw-20px))] rounded-2xl border border-white/15 bg-slate-950/95 p-2.5 shadow-2xl shadow-black/50 backdrop-blur-2xl"
                style={{
                  left: getPopupPosition("shapes", {
                    x: Math.max(12, window.innerWidth / 2 - 195),
                    y: Math.max(70, window.innerHeight - 300),
                  }).x,
                  top: getPopupPosition("shapes", {
                    x: 0,
                    y: Math.max(70, window.innerHeight - 300),
                  }).y,
                }}
                onPointerDown={(event) => {
                  if (!(event.target as HTMLElement).closest("button")) {
                    startPopupDrag("shapes", event);
                  }
                  event.stopPropagation();
                }}
                onPointerMove={movePopupDrag}
                onPointerUp={endPopupDrag}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-label="Shapes and math tools"
              >
                <div
                  className="mb-2 flex cursor-move touch-none items-center justify-between px-1 select-none"
                  onPointerDown={(event) => startPopupDrag("shapes", event)}
                >
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                      Shapes & Math Tools
                    </div>
                    <div className="text-[8px] text-white/40">
                      Select a tool to use on the board
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShapeToolsPopup(false)}
                    aria-label="Close shapes and math tools"
                    className="flex size-7 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    title="Import image"
                    aria-label="Import image"
                    className="flex size-10 items-center justify-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white"
                  >
                    <Upload className="size-4" />
                  </button>
                  {toolButton(
                    "eraser",
                    "Eraser",
                    <Eraser className="size-4" />,
                    "E",
                  )}
                  {toolButton(
                    "line",
                    "Line",
                    <Minus className="size-4" />,
                    "L",
                  )}
                  {toolButton(
                    "rectangle",
                    "Rectangle",
                    <Square className="size-4" />,
                    "R",
                  )}
                  {toolButton(
                    "circle",
                    "Circle",
                    <Circle className="size-4" />,
                    "C",
                  )}
                  {toolButton(
                    "triangle",
                    "Triangle",
                    <Triangle className="size-4" />,
                  )}
                  {toolButton(
                    "ruler",
                    "Ruler",
                    <Ruler className="size-4" />,
                    "U",
                  )}
                  {toolButton(
                    "axes",
                    "Coordinate Axes",
                    <Crosshair className="size-4" />,
                    "A",
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTool("equation");
                      setShowShapeToolsPopup(false);
                      openToolbarTextEditor("equation");
                    }}
                    title="LaTeX equation (Q)"
                    aria-label="Add LaTeX equation"
                    className={`flex size-10 items-center justify-center rounded-xl transition-all ${
                      tool === "equation"
                        ? "bg-blue-500 text-white"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Sigma className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTool("text");
                      setShowShapeToolsPopup(false);
                      openToolbarTextEditor("text");
                    }}
                    title="Text entry (T)"
                    aria-label="Add text"
                    className={`flex size-10 items-center justify-center rounded-xl transition-all ${
                      tool === "text"
                        ? "bg-blue-500 text-white"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Type className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Invisible/low-profile hover runway: moving the pointer near the bottom
                edge reveals the dock again without needing a permanent launcher. */}
            {!toolbarHovered && (
              <span
                className="pointer-events-none absolute bottom-1 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/25 shadow-[0_0_18px_rgba(255,255,255,0.18)] blur-[0.2px]"
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* Compact page manager — preserves duplicate / rename / delete page controls */}
        {showTeacherControls && showPagesPanel && (
          <aside
            className="fixed z-[310] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-white/15 bg-slate-950/80 shadow-2xl shadow-black/30 backdrop-blur-2xl"
            style={{
              left: getPopupPosition("pages", {
                x: Math.max(12, window.innerWidth / 2 - 180),
                y: Math.max(70, window.innerHeight - 390),
              }).x,
              top: getPopupPosition("pages", {
                x: 0,
                y: Math.max(70, window.innerHeight - 390),
              }).y,
            }}
            onPointerMove={movePopupDrag}
            onPointerUp={endPopupDrag}
            onPointerEnter={() => setToolbarHovered(true)}
            onPointerLeave={() => setToolbarHovered(false)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              className="flex cursor-move touch-none items-center justify-between border-b border-white/10 px-3 py-2.5 select-none"
              onPointerDown={(event) => startPopupDrag("pages", event)}
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                  Pages
                </div>
                <div className="text-[8px] text-white/40">
                  {pages.length} {pages.length === 1 ? "page" : "pages"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={addPage}
                  title="Add page"
                  aria-label="Add page"
                  className="flex size-8 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPagesPanel(false)}
                  title="Close pages"
                  aria-label="Close manage pages"
                  className="flex size-8 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto p-2">
              {pages.map((page, index) => {
                const isActive = currentPageIndex === index;
                return (
                  <div
                    key={page.id}
                    className={`group flex items-center gap-1 rounded-xl border px-1 transition ${
                      isActive
                        ? "border-blue-400/30 bg-blue-500/15"
                        : "border-white/5 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPageIndex(index);
                        setSelectedElementId(null);
                        setSelectedElementIds([]);
                        setShowPagesPanel(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-2 text-left"
                      title={`Open ${page.name}`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-[8px] font-extrabold ${
                          isActive
                            ? "bg-blue-500 text-white"
                            : "bg-white/10 text-white/55"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[9px] font-bold ${
                          isActive ? "text-blue-200" : "text-white/70"
                        }`}
                      >
                        {page.name}
                      </span>
                      <span className="text-[8px] text-white/30">
                        {page.elements.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicatePage(index)}
                      title="Duplicate page"
                      aria-label={`Duplicate ${page.name}`}
                      className="flex size-7 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/10 hover:text-white"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => renamePage(index)}
                      title="Rename page"
                      aria-label={`Rename ${page.name}`}
                      className="flex size-7 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/10 hover:text-white"
                    >
                      <Settings2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePage(index)}
                      title="Delete page"
                      aria-label={`Delete ${page.name}`}
                      className="flex size-7 items-center justify-center rounded-lg text-white/35 transition hover:bg-red-500/15 hover:text-red-300"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Floating color palette — teacher only */}
        {showTeacherControls && showColorPopup && (
          <div
            className="fixed z-[310] w-55 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/90 bg-white/98 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-xl"
            style={{
              top: getPopupPosition("color", {
                x: colorPopupPosition.left,
                y: colorPopupPosition.top,
              }).y,
              left: getPopupPosition("color", {
                x: colorPopupPosition.left,
                y: colorPopupPosition.top,
              }).x,
            }}
            onPointerMove={movePopupDrag}
            onPointerUp={endPopupDrag}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              className="mb-3 flex cursor-move touch-none items-center justify-between select-none"
              onPointerDown={(event) => startPopupDrag("color", event)}
            >
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {colorPopupTarget === "object" ? "Object Color" : "Pen Color"}
                </p>
                <p className="mt-0.5 text-[9px] text-slate-400">
                  Choose a color
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowColorPopup(false);
                  setColorPopupTarget(null);
                }}
                aria-label="Close color palette"
                className="flex size-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((c) => {
                const activeColor =
                  colorPopupTarget === "object"
                    ? selectedElement && "color" in selectedElement
                      ? selectedElement.color
                      : undefined
                    : color;

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (colorPopupTarget === "object") {
                        applySelectedElementColor(c);
                      } else {
                        setColor(c);
                        setShowColorPopup(false);
                        setColorPopupTarget(null);
                      }
                    }}
                    title={c}
                    aria-label={`Choose color ${c}`}
                    className={`flex size-7 items-center justify-center rounded-lg transition ${
                      activeColor === c
                        ? "bg-blue-50 ring-2 ring-blue-500 ring-offset-1"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <span
                      className="size-5 rounded-full border border-slate-200 shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                  </button>
                );
              })}
            </div>

            {colorPopupTarget === "object" && selectedElement && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[9px] font-semibold text-slate-400">
                  Selected object
                </span>
                <span
                  className="size-4 rounded-full border border-slate-200 shadow-sm"
                  style={{
                    backgroundColor:
                      "color" in selectedElement
                        ? selectedElement.color
                        : "#94a3b8",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Floating Math Toolkit — teacher only */}
        {showTeacherControls && showToolsPanel && (
          <aside
            className="fixed z-[290] flex max-h-[calc(100vh-32px)] w-72 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-950/15 backdrop-blur-2xl"
            style={{
              left: getPopupPosition("toolkit", {
                x: Math.max(12, window.innerWidth - 420),
                y: Math.max(80, window.innerHeight / 2 - 260),
              }).x,
              top: getPopupPosition("toolkit", {
                x: 0,
                y: Math.max(80, window.innerHeight / 2 - 260),
              }).y,
            }}
            onPointerMove={movePopupDrag}
            onPointerUp={endPopupDrag}
          >
            <div
              className="flex shrink-0 cursor-move touch-none items-center justify-between border-b border-slate-100 px-3 py-2.5 select-none"
              onPointerDown={(event) => startPopupDrag("toolkit", event)}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Layers3 className="size-3.5" />
                </div>
                <div>
                  <h2 className="text-[11px] font-extrabold text-slate-900">
                    Math Toolkit
                  </h2>
                  <p className="text-[8px] text-slate-400">
                    STEM tools & formulas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToolsPanel(false)}
                title="Close toolkit"
                aria-label="Close toolkit"
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTool("axes")}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <Crosshair className="size-3.5 text-blue-600" />
                  <span className="text-[10px] font-semibold text-slate-700">
                    Grid Axes
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTool("ruler")}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <Ruler className="size-3.5 text-blue-600" />
                  <span className="text-[10px] font-semibold text-slate-700">
                    Ruler
                  </span>
                </button>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-900">
                    Formula Library
                  </span>
                  <BookOpen className="size-3.5 text-slate-400" />
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                  {(
                    [
                      "algebra",
                      "geometry",
                      "calculus",
                      "trigonometry",
                      "statistics",
                      "physics",
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormulaCategory(cat)}
                      className={`rounded-md px-1 py-1.5 text-[9px] font-bold capitalize transition ${formulaCategory === cat ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {formulaSets[formulaCategory].map(([label, val]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => insertFormula(val)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <div className="text-[10px] font-bold text-slate-800">
                      {label}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[9px] text-blue-600">
                      {val}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Draggable teacher control launcher */}
      <div
        className="pointer-events-none fixed inset-0 z-[320]"
        aria-hidden={false}
      >
        <button
          type="button"
          onPointerDown={handleTeacherControlPointerDown}
          onPointerMove={handleTeacherControlPointerMove}
          onPointerUp={handleTeacherControlPointerUp}
          onPointerCancel={handleTeacherControlPointerUp}
          onClick={handleTeacherControlClick}
          title={
            showTeacherControls
              ? "Hide toolbar · drag to reposition"
              : "Show toolbar · drag to reposition"
          }
          aria-label={
            showTeacherControls
              ? "Hide toolbar. Drag to reposition."
              : "Show toolbar. Drag to reposition."
          }
          style={{
            left: teacherControlPosition.left,
            top: teacherControlPosition.top,
            touchAction: "none",
          }}
          className={`pointer-events-auto fixed z-[321] flex size-[50px] select-none items-center justify-center overflow-hidden rounded-[18px] border border-white/25 bg-slate-950/45 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl transition-all duration-200 hover:scale-105 hover:border-white/40 hover:bg-slate-950/55 active:scale-95 ${
            showTeacherControls ? "shadow-blue-500/25" : "shadow-black/30"
          } ${
            teacherControlDragging
              ? "cursor-grabbing shadow-2xl"
              : "cursor-grab"
          }`}
        >
          {/* Brand-only launcher: click to show/hide the auto-hide toolbar. */}
          <span className="pointer-events-none flex size-full items-center justify-center">
            <MyLogo showText={false} clickable={false} />
          </span>
          <span
            className={`pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ${
              showTeacherControls ? "ring-blue-400/30" : "ring-white/10"
            }`}
          />
        </button>
      </div>

      {/* Professional page rename dialog */}
      {renamePageState.open && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-page-title"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeRenamePage();
          }}
        >
          <div
            className="fixed w-[min(420px,calc(100vw-24px))] max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
            style={{
              left: getPopupPosition("rename", {
                x: Math.max(12, window.innerWidth / 2 - 210),
                y: Math.max(70, window.innerHeight / 2 - 180),
              }).x,
              top: getPopupPosition("rename", {
                x: 0,
                y: Math.max(70, window.innerHeight / 2 - 180),
              }).y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={movePopupDrag}
            onPointerUp={endPopupDrag}
          >
            <div
              className="flex cursor-move touch-none items-start justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4 select-none"
              onPointerDown={(event) => startPopupDrag("rename", event)}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <PenLine className="size-4" />
                </div>
                <div>
                  <h2
                    id="rename-page-title"
                    className="text-sm font-extrabold text-slate-900"
                  >
                    Rename page
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Give this page a clear, memorable name.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRenamePage}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                aria-label="Close rename dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5">
              <label
                htmlFor="page-name-input"
                className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Page name
              </label>
              <input
                id="page-name-input"
                autoFocus
                value={renamePageState.name}
                onChange={(event) =>
                  setRenamePageState((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveRenamedPage();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeRenamePage();
                  }
                }}
                maxLength={80}
                placeholder="e.g. Fractions & Percents"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Press Enter to save • Esc to cancel</span>
                <span>{renamePageState.name.length}/80</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <button
                type="button"
                onClick={closeRenamePage}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRenamedPage}
                disabled={!renamePageState.name.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save name
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { extractTextItems } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParsedRow = Record<string, string>;

type PdfTextItem = {
  str: string;
  x: number;
  y: number;
};

/**
 * Fidelity frequently gives us a CUSIP where a normal ticker would appear.
 * A CUSIP must never be saved as tickerOrSymbol because the live-price API
 * expects an actual tradable symbol.
 */
const CUSIP_TO_SYMBOL: Record<string, string> = {
  "46138G649": "QQQM",
  "922908363": "VOO",
  "808524797": "SCHD",
  "921909768": "VXUS",
  "921909818": "VTIAX",
  "922908710": "VFIAX",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMoney(value: string): string {
  const cleaned = value
    .replace(/[$€£₵]/g, "")
    .replace(/,/g, "")
    .trim();

  const match = cleaned.match(/^-?\d+(?:\.\d+)?$/);
  return match?.[0] ?? "";
}

function isFullDate(value: string): boolean {
  const cleaned = value.trim();

  return (
    /^\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}$/.test(cleaned) ||
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/.test(cleaned) ||
    /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}$/.test(cleaned)
  );
}

function dateWithYear(value: string, statementYear: number): string {
  const cleaned = value.trim();

  const shortDate = cleaned.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (shortDate) {
    return `${statementYear}-${shortDate[1].padStart(2, "0")}-${shortDate[2].padStart(2, "0")}`;
  }

  const parsed = new Date(cleaned);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return cleaned;
}

function extractStatementYear(text: string): number {
  const rangeMatch = text.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)/i,
  );

  if (rangeMatch) return Number(rangeMatch[1]);

  const yearMatch = text.match(/\b20\d{2}\b/);
  return yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
}

function resolveSymbol(cusip: string, securityName: string): string {
  const normalizedCusip = cusip.trim().toUpperCase();

  if (normalizedCusip && CUSIP_TO_SYMBOL[normalizedCusip]) {
    return CUSIP_TO_SYMBOL[normalizedCusip];
  }

  const symbolMatch = securityName.match(/\(([A-Z][A-Z0-9.-]{0,9})\)/);
  return symbolMatch?.[1]?.toUpperCase() ?? "";
}

function normalizeRows(rows: unknown[][]): ParsedRow[] {
  if (rows.length < 2) return [];

  let headerIndex = 0;
  let bestScore = -1;

  rows.slice(0, 40).forEach((row, index) => {
    const text = row
      .map((value) => String(value ?? "").toLowerCase())
      .join(" ");

    const score =
      (/(date|trade date|transaction date|settlement date)/.test(text)
        ? 3
        : 0) +
      (/(symbol|ticker|security|description|asset|instrument|fund)/.test(text)
        ? 2
        : 0) +
      (/(quantity|shares|units|qty|volume)/.test(text) ? 2 : 0) +
      (/(amount|price|consideration|proceeds|cost)/.test(text) ? 1 : 0);

    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  const headerRow = rows[headerIndex];
  if (!headerRow) return [];

  const headers = headerRow.map(normalizeHeader);

  return rows
    .slice(headerIndex + 1)
    .map((values) => {
      const row: ParsedRow = {};
      headers.forEach((header, index) => {
        if (header) row[header] = String(values[index] ?? "").trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));
}

function groupPdfItemsIntoLines(items: PdfTextItem[]): PdfTextItem[][] {
  const lineMap = new Map<number, PdfTextItem[]>();

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const key = Math.round(item.y / 3) * 3;
    const existing = lineMap.get(key);

    if (existing) existing.push(item);
    else lineMap.set(key, [item]);
  }

  return Array.from(lineMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([, line]) => line.sort((a, b) => a.x - b.x));
}

function convertPdfPagesToText(pages: PdfTextItem[][]): string {
  let output = "";

  pages.forEach((pageItems, pageIndex) => {
    const lines = groupPdfItemsIntoLines(pageItems);
    const pageText = lines
      .map((line) =>
        line
          .map((item) => item.str.trim())
          .filter(Boolean)
          .join("\t"),
      )
      .filter(Boolean)
      .join("\n");

    output += `--- Page ${pageIndex + 1} ---\n${pageText}\n\n`;
  });

  return output;
}

async function extractPdfText(
  bytes: Buffer,
): Promise<{ text: string; totalPages: number }> {
  const result = await extractTextItems(new Uint8Array(bytes));
  const pages = result.items as unknown as PdfTextItem[][];

  return {
    text: convertPdfPagesToText(pages),
    totalPages: result.totalPages,
  };
}

function isFidelityStatement(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("fidelity investments") ||
    lower.includes("fidelity brokerage services") ||
    lower.includes("fidelity brokerage") ||
    lower.includes("investment report")
  );
}

function parseFidelityTransactions(
  lines: string[],
  statementYear: number,
): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const sectionStart = lines.findIndex((line) =>
    /securities bought\s*&\s*sold/i.test(line),
  );

  if (sectionStart === -1) return rows;

  const sectionEnd = lines.findIndex(
    (line, index) =>
      index > sectionStart &&
      /dividends,\s*interest\s*&\s*other income/i.test(line),
  );

  const section = lines.slice(
    sectionStart + 1,
    sectionEnd === -1 ? lines.length : sectionEnd,
  );

  let currentDate = "";
  let block: string[] = [];

  const flushBlock = (): void => {
    if (!currentDate || block.length === 0) {
      block = [];
      return;
    }

    const combined = cleanText(block.join(" "));
    const actionMatch = combined.match(/\bYou\s+(Bought|Sold)\b/i);

    if (!actionMatch) {
      block = [];
      return;
    }

    const action = actionMatch[1].toUpperCase();
    const beforeAction = combined.slice(0, actionMatch.index ?? 0).trim();
    const afterAction = combined.slice(
      (actionMatch.index ?? 0) + actionMatch[0].length,
    );

    const cusipMatch = beforeAction.match(/\b[A-Z0-9]{9}\b/);
    const cusip = cusipMatch?.[0]?.toUpperCase() ?? "";

    const securityName = cleanText(
      beforeAction.replace(cusip, "").replace(/^\d{1,2}\/\d{1,2}\s*/, ""),
    );

    const numericValues = afterAction
      .split(/\s+/)
      .map(normalizeMoney)
      .filter((value) => value !== "");

    if (numericValues.length < 3) {
      block = [];
      return;
    }

    const quantity = numericValues[0] ?? "";
    const price = numericValues[1] ?? "";
    const amount = numericValues[numericValues.length - 1] ?? "";
    const symbol = resolveSymbol(cusip, securityName);

    if (Number(quantity) <= 0 || Number(price) <= 0 || Number(amount) <= 0) {
      block = [];
      return;
    }

    rows.push({
      source: "FIDELITY",
      institution: "Fidelity Investments",
      record_type: "transaction",
      date: dateWithYear(currentDate, statementYear),
      security_name: securityName,
      symbol,
      cusip,
      transaction_type: action,
      quantity,
      price,
      amount,
      currency: "USD",
    });

    block = [];
  };

  for (const rawLine of section) {
    const line = cleanText(rawLine);
    if (!line) continue;

    if (
      /^(settlement|date|security name|symbol|cusip|description|quantity|price|transaction|cost|amount)$/i.test(
        line,
      )
    ) {
      continue;
    }

    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2})(?:\s+|$)/);

    if (dateMatch) {
      flushBlock();
      currentDate = dateMatch[1];
      const remainder = line.slice(dateMatch[0].length).trim();
      block = remainder ? [remainder] : [];
      continue;
    }

    if (
      /^(total securities bought|total securities sold|net securities bought\s*&\s*sold)/i.test(
        line,
      )
    ) {
      flushBlock();
      continue;
    }

    block.push(line);
  }

  flushBlock();
  return rows;
}

function parseFidelityIncome(
  lines: string[],
  statementYear: number,
): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const sectionStart = lines.findIndex((line) =>
    /dividends,\s*interest\s*&\s*other income/i.test(line),
  );

  if (sectionStart === -1) return rows;

  const sectionEnd = lines.findIndex(
    (line, index) => index > sectionStart && /^contributions$/i.test(line),
  );

  const section = lines.slice(
    sectionStart + 1,
    sectionEnd === -1 ? lines.length : sectionEnd,
  );

  let currentDate = "";
  let block: string[] = [];

  const flushBlock = (): void => {
    if (!currentDate || block.length === 0) {
      block = [];
      return;
    }

    const combined = cleanText(block.join(" "));
    const incomeMatch = combined.match(
      /\b(Dividend Received|Interest Received)\b/i,
    );

    if (!incomeMatch) {
      block = [];
      return;
    }

    const numericValues = combined
      .split(/\s+/)
      .map(normalizeMoney)
      .filter((value) => value !== "");

    if (numericValues.length === 0) {
      block = [];
      return;
    }

    const amount = Math.abs(Number(numericValues[numericValues.length - 1]));
    const beforeAction = combined.slice(0, incomeMatch.index ?? 0).trim();
    const cusipMatch = beforeAction.match(/\b[A-Z0-9]{9}\b/);
    const cusip = cusipMatch?.[0]?.toUpperCase() ?? "";
    const securityName = cleanText(beforeAction.replace(cusip, ""));
    const symbol = resolveSymbol(cusip, securityName);

    if (amount <= 0) {
      block = [];
      return;
    }

    rows.push({
      source: "FIDELITY",
      institution: "Fidelity Investments",
      record_type: "income",
      date: dateWithYear(currentDate, statementYear),
      security_name: securityName || "Fidelity Income",
      symbol,
      cusip,
      transaction_type: incomeMatch[1].toUpperCase(),
      quantity: "",
      price: "",
      amount: amount.toFixed(2),
      currency: "USD",
    });

    block = [];
  };

  for (const rawLine of section) {
    const line = cleanText(rawLine);
    if (!line) continue;

    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2})(?:\s+|$)/);

    if (dateMatch) {
      flushBlock();
      currentDate = dateMatch[1];
      const remainder = line.slice(dateMatch[0].length).trim();
      block = remainder ? [remainder] : [];
      continue;
    }

    if (/^total dividends/i.test(line)) {
      flushBlock();
      continue;
    }

    if (
      /^(settlement|date|security name|symbol|cusip|description|quantity|price|amount)$/i.test(
        line,
      )
    ) {
      continue;
    }

    block.push(line);
  }

  flushBlock();
  return rows;
}

const FIDELITY_SYMBOL_NAMES: Record<string, string> = {
  QQQM: "Invesco Nasdaq 100 ETF",
  VOO: "Vanguard S&P 500 ETF",
  SCHD: "Schwab US Dividend Equity ETF",
  VXUS: "Vanguard Total International Stock Index Fund",
  SPCX: "Space Exploration Technologies Corp",
  VTIAX: "Vanguard Total International Stock Index Fund Admiral Shares",
  VFIAX: "Vanguard 500 Index Fund Admiral Shares",
};

function parseHoldingNumbers(line: string): number[] {
  const withoutPercentages = line.replace(/-?\d[\d,]*(?:\.\d+)?%/g, "");
  const matches =
    withoutPercentages.match(/-?\$?\d[\d,]*\.\d+|-?\$\d[\d,]*/g) ?? [];
  return matches
    .map((value) => Number(value.replace(/[$,]/g, "")))
    .filter((value) => Number.isFinite(value));
}

function extractHoldingName(
  lines: string[],
  index: number,
  symbol: string,
): string {
  const known = FIDELITY_SYMBOL_NAMES[symbol];
  if (known) return known;

  const candidates = [
    lines[index] ?? "",
    lines[index - 1] ?? "",
    lines[index - 2] ?? "",
    lines[index + 1] ?? "",
  ];

  for (const candidate of candidates) {
    const cleaned = cleanText(
      candidate
        .replace(/\([A-Z][A-Z0-9.-]{0,9}\)/g, "")
        .replace(/-?\$?\d[\d,]*(?:\.\d+)?%?/g, "")
        .replace(/\b(unavailable|not applicable)\b/gi, ""),
    );

    if (
      cleaned &&
      !/^(total|holdings|stocks|equity etps|common stock)$/i.test(cleaned)
    ) {
      return cleaned;
    }
  }

  return symbol;
}

function parseFidelityHoldings(
  lines: string[],
  statementDate: string,
): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let currentAccount = "";
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanText(lines[index] ?? "");

    const accountMatch = line.match(/Account #\s*([A-Z0-9-]+)/i);
    if (accountMatch) {
      currentAccount = accountMatch[1].toUpperCase();
    }

    if (!/^Holdings\s+/i.test(line)) continue;

    // Only inspect the local Holdings section until the next Activity section.
    for (
      let cursor = index + 1;
      cursor < Math.min(lines.length, index + 90);
      cursor += 1
    ) {
      const current = cleanText(lines[cursor] ?? "");
      if (/^Activity$/i.test(current)) break;
      if (/^Account #\s*/i.test(current)) break;
      if (/^Total Holdings$/i.test(current)) continue;
      if (
        /^Total (Core Account|Equity ETPs|Exchange Traded Products|Stocks|Common Stock)/i.test(
          current,
        )
      )
        continue;

      const symbolMatch = current.match(/\(([A-Z][A-Z0-9.-]{0,9})\)/);
      if (!symbolMatch) continue;

      const symbol = symbolMatch[1].toUpperCase();
      const key = `${currentAccount}|${symbol}|${statementDate}`;
      if (seen.has(key)) continue;

      let numericLine = "";
      let numericValues: number[] = [];

      for (
        let neighbor = Math.max(index + 1, cursor - 3);
        neighbor <= Math.min(lines.length - 1, cursor + 2);
        neighbor += 1
      ) {
        const candidate = cleanText(lines[neighbor] ?? "");
        if (/^Total /i.test(candidate)) continue;
        if (/not applicable/i.test(candidate)) continue;
        const values = parseHoldingNumbers(candidate);
        if (values.length >= 6) {
          numericLine = candidate;
          numericValues = values;
          break;
        }
      }

      if (numericValues.length < 5) continue;

      const unavailableBeginning = /unavailable/i.test(numericLine);
      const offset = unavailableBeginning ? 0 : 1;
      const quantity = numericValues[offset];
      const price = numericValues[offset + 1];
      const marketValue = numericValues[offset + 2];
      const costBasis = numericValues[offset + 3];
      const unrealizedGain = numericValues[offset + 4];

      if (
        !Number.isFinite(quantity) ||
        !Number.isFinite(price) ||
        !Number.isFinite(marketValue) ||
        !Number.isFinite(costBasis) ||
        quantity <= 0 ||
        marketValue < 0 ||
        costBasis < 0
      ) {
        continue;
      }

      const unrealizedGainPercent =
        costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;

      rows.push({
        source: "FIDELITY",
        institution: "Fidelity Investments",
        record_type: "holding",
        date: statementDate,
        account_number: currentAccount,
        security_name: extractHoldingName(lines, cursor, symbol),
        symbol,
        cusip: "",
        transaction_type: "HOLDING",
        quantity: quantity.toString(),
        price: price.toString(),
        amount: costBasis.toString(),
        market_value: marketValue.toString(),
        cost_basis: costBasis.toString(),
        unrealized_gain: unrealizedGain.toString(),
        unrealized_gain_percent: unrealizedGainPercent.toString(),
        currency: "USD",
      });

      seen.add(key);
    }
  }

  return rows;
}

/**
 * Fidelity Holdings are returned as explicit position snapshots. The frontend
 * uses these snapshots for current shares, cost basis, market value and gain,
 * while the Activity sections remain historical transactions.
 */
function parseFidelityPdf(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  const statementYear = extractStatementYear(text);

  const statementRange = text.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*-\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  );
  const parsedEndDate = statementRange
    ? new Date(statementRange[1])
    : new Date();
  const statementDate = Number.isNaN(parsedEndDate.getTime())
    ? `${statementYear}-12-31`
    : parsedEndDate.toISOString().slice(0, 10);

  return [
    ...parseFidelityTransactions(lines, statementYear),
    ...parseFidelityIncome(lines, statementYear),
    ...parseFidelityHoldings(lines, statementDate),
  ];
}

function parseGenericPdf(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  if (lines.length === 0) return [];

  const headerLine = lines.find((line) => {
    const lower = line.toLowerCase();
    return (
      /date|trade.?date|transaction.?date|settlement.?date/.test(lower) &&
      /symbol|ticker|security|description|asset|instrument|fund/.test(lower)
    );
  });

  if (!headerLine) return [];

  const separator = headerLine.includes("\t") ? /\t+/ : /\s{2,}/;
  const headers = headerLine
    .split(separator)
    .map((value) => value.trim())
    .filter(Boolean);

  if (headers.length < 2) return [];

  const start = lines.indexOf(headerLine);
  const rows: ParsedRow[] = [];

  for (const line of lines.slice(start + 1)) {
    if (
      /^(page|account|statement|total|summary|beginning|ending|generated|opening|closing)\b/i.test(
        line,
      )
    ) {
      continue;
    }

    const values = line
      .split(separator)
      .map((value) => value.trim())
      .filter(Boolean);

    if (values.length < Math.max(2, headers.length - 2)) continue;
    if (!isFullDate(values[0] ?? "")) continue;

    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      row[normalizeHeader(header)] = values[index] ?? "";
    });

    rows.push(row);
  }

  return rows;
}

function parsePdfText(text: string): ParsedRow[] {
  return isFidelityStatement(text)
    ? parseFidelityPdf(text)
    : parseGenericPdf(text);
}

function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;

      currentRow.push(currentValue.trim());
      if (currentRow.some((value) => value.length > 0)) rows.push(currentRow);

      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue.trim());
    if (currentRow.some((value) => value.length > 0)) rows.push(currentRow);
  }

  return rows;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No financial file was uploaded." },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const bytes = Buffer.from(await file.arrayBuffer());

    if (extension === "xlsx" || extension === "xls") {
      const workbook = XLSX.read(bytes, {
        type: "buffer",
        cellDates: true,
        raw: false,
      });

      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = firstSheetName
        ? workbook.Sheets[firstSheetName]
        : undefined;

      if (!firstSheet) {
        return NextResponse.json(
          { success: false, error: "The spreadsheet contains no worksheets." },
          { status: 400 },
        );
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      const normalized = normalizeRows(rows);

      if (normalized.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No recognizable transaction rows were found in the spreadsheet.",
          },
          { status: 422 },
        );
      }

      return NextResponse.json({ success: true, rows: normalized });
    }

    if (extension === "csv") {
      const normalized = normalizeRows(parseCsv(bytes.toString("utf8")));

      if (normalized.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No recognizable transaction rows were found in the CSV.",
          },
          { status: 422 },
        );
      }

      return NextResponse.json({ success: true, rows: normalized });
    }

    if (extension === "pdf") {
      const extracted = await extractPdfText(bytes);

      if (!extracted.text.trim()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The PDF contains no extractable text. It may be scanned or image-only and will require OCR.",
            totalPages: extracted.totalPages,
          },
          { status: 422 },
        );
      }

      const fidelity = isFidelityStatement(extracted.text);
      const rows = parsePdfText(extracted.text);

      if (rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: fidelity
              ? "The Fidelity statement was read successfully, but no transactions or Holdings position snapshots could be identified."
              : "The PDF was opened successfully, but no recognizable investment transactions were found.",
            institution: fidelity ? "Fidelity Investments" : "Unknown",
            totalPages: extracted.totalPages,
            extractedText: extracted.text.slice(0, 30000),
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        success: true,
        institution: fidelity ? "Fidelity Investments" : "Unknown",
        rows,
        totalPages: extracted.totalPages,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unsupported file format. Use CSV, XLS, XLSX, or PDF.",
      },
      { status: 400 },
    );
  } catch (error: unknown) {
    console.error("Statement parsing failed:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: `The financial report could not be parsed. ${message}`,
      },
      { status: 500 },
    );
  }
}

import {
  AssetType,
  CurrencyType,
  InvestmentTransactionType,
  RegionType,
} from "@/lib/generated/prisma/enums";
import { fidelityTypeFromAction } from "./fidelity-portfolio-engine";

export type ParsedFidelityRow = {
  name: string;
  tickerOrSymbol: string;
  cusip: string | null;
  accountNumber: string | null;
  accountName: string | null;
  type: InvestmentTransactionType;
  assetClass: AssetType;
  region: RegionType;
  currency: CurrencyType;
  shares: number | null;
  pricePerShare: number | null;
  amount: number;
  grossAmount: number;
  fees: number;
  taxes: number;
  date: string;
  settlementDate: string | null;
  exchangeRate: number;
  notes: string;
  fingerprint: string;
};

function header(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(header);
  return rows
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((key, i) => [key, (values[i] ?? "").trim()]),
      ),
    );
}

function first(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) if (row[key]) return row[key];
  return "";
}

function money(value: string): number {
  const raw = value.trim();
  const negative = /^\(.*\)$/.test(raw);
  const n = Number(raw.replace(/[$€£₵,\s]/g, "").replace(/^\((.*)\)$/, "$1"));
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function dateOnly(value: string): string | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
}

function assetClass(name: string, symbol: string): AssetType {
  if (/SPAXX|MONEY MARKET|CASH/i.test(name)) return AssetType.CASH_EQUIVALENT;
  if (symbol) return /APPLE|AAPL/i.test(name) ? AssetType.STOCK : AssetType.ETF;
  return AssetType.STOCK;
}

function fingerprint(
  row: Omit<ParsedFidelityRow, "fingerprint">,
  action: string,
): string {
  return [
    row.date,
    row.accountNumber ?? "",
    row.accountName ?? "",
    row.tickerOrSymbol || row.name.trim().toUpperCase(),
    action.trim().toUpperCase(),
    row.type,
    row.shares?.toFixed(8) ?? "0",
    row.pricePerShare?.toFixed(6) ?? "0",
    row.amount.toFixed(2),
    row.grossAmount.toFixed(2),
    row.fees.toFixed(2),
    row.taxes.toFixed(2),
    row.settlementDate ?? "",
  ].join("|");
}

const CUSIP_TO_SYMBOL: Record<string, string> = {
  "46138G649": "QQQM",
  "922908363": "VOO",
  "808524797": "SCHD",
  "921909768": "VXUS",
  "921909818": "VTIAX",
  "922908710": "VFIAX",
};

function resolveFidelitySymbol(
  symbol: string,
  cusip: string | null,
  name: string,
): string {
  const direct = symbol.trim().toUpperCase();
  if (direct && CUSIP_TO_SYMBOL[direct]) return CUSIP_TO_SYMBOL[direct];
  if (direct && !/^[A-Z0-9]{9}$/.test(direct)) return direct;
  if (cusip && CUSIP_TO_SYMBOL[cusip.trim().toUpperCase()]) {
    return CUSIP_TO_SYMBOL[cusip.trim().toUpperCase()];
  }
  const match = name.match(/\(([A-Z][A-Z0-9.-]{1,9})\)/);
  return match?.[1]?.toUpperCase() ?? "";
}

export function parseFidelityCsv(text: string): ParsedFidelityRow[] {
  const source = parseCsv(text);
  const result: ParsedFidelityRow[] = [];

  for (const row of source) {
    const runDate = dateOnly(
      first(row, ["run_date", "date", "transaction_date"]),
    );
    if (!runDate) continue;

    const action = first(row, [
      "action",
      "transaction",
      "activity_type",
      "type",
    ]);
    const name =
      first(row, ["description", "security_name", "name", "security"]) ||
      "Cash";
    const rawSymbol = first(row, [
      "symbol",
      "ticker",
      "ticker_symbol",
    ]).toUpperCase();
    const cusip = first(row, ["cusip", "security_id"]) || null;
    const symbol = resolveFidelitySymbol(rawSymbol, cusip, name);
    const accountNumber = first(row, ["account_number", "account_no"]) || null;
    const accountName = first(row, ["account", "account_name"]) || null;
    const sharesRaw = first(row, ["quantity", "shares", "units", "qty"]);
    const priceRaw = first(row, ["price", "price_per_share", "share_price"]);
    const amountRaw = first(row, [
      "amount",
      "transaction_amount",
      "net_amount",
      "total_amount",
    ]);
    const settlementDate = dateOnly(
      first(row, ["settlement_date", "settlement"]),
    );
    const sharesValue = money(sharesRaw);
    const priceValue = money(priceRaw);
    const amount =
      Math.abs(money(amountRaw)) || Math.abs(sharesValue * priceValue);
    const fees = Math.abs(
      money(first(row, ["fees", "fees_", "commission", "commission_"])),
    );
    const taxes = Math.abs(money(first(row, ["taxes", "tax"])));
    const type = fidelityTypeFromAction(action);

    const normalized: Omit<ParsedFidelityRow, "fingerprint"> = {
      name,
      tickerOrSymbol: symbol,
      cusip,
      accountNumber,
      accountName,
      type,
      assetClass: assetClass(name, symbol),
      region: RegionType.USA,
      currency: CurrencyType.USD,
      shares: sharesValue > 0 ? sharesValue : null,
      pricePerShare: priceValue > 0 ? priceValue : null,
      amount,
      grossAmount: amount,
      fees,
      taxes,
      date: runDate,
      settlementDate,
      exchangeRate: 1,
      notes: `Imported from Fidelity Investments.|FIDELITY_ACTION=${action}|FIDELITY_ACTIVITY=${type}`,
    };

    result.push({
      ...normalized,
      fingerprint: fingerprint(normalized, action),
    });
  }
  return result;
}

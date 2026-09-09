import type {
  InvestmentTransactionType,
  AssetType,
  RegionType,
  CurrencyType,
} from "@/lib/generated/prisma/enums";

export type PortfolioTransaction = {
  id: string;
  name: string;
  tickerOrSymbol?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  assetClass: AssetType;
  region: RegionType;
  currency: CurrencyType;
  type: InvestmentTransactionType;
  shares?: number | null;
  pricePerShare?: number | null;
  amount: number;
  amountUSD: number;
  exchangeRate: number;
  date: string | Date;
  settlementDate?: string | Date | null;
  fees?: number | null;
  taxes?: number | null;
  marketValue?: number | null;
  costBasis?: number | null;
  unrealizedGain?: number | null;
  unrealizedGainPercent?: number | null;
  notes?: string | null;
};

type Lot = { shares: number; costPerShare: number; totalCost: number };

export type LedgerResult = {
  shares: number;
  costBasis: number;
  purchases: number;
  saleProceeds: number;
  realizedGain: number;
  dividends: number;
  fees: number;
  taxes: number;
  contributions: number;
  withdrawals: number;
  lots: Lot[];
};

function n(value: unknown): number {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

export function normalizeSymbol(
  symbol?: string | null,
  name?: string | null,
): string {
  const direct = symbol?.trim().toUpperCase() ?? "";
  if (direct && !/^[A-Z0-9]{9}$/.test(direct)) return direct;
  const fromName = name?.match(/\(([A-Z][A-Z0-9.-]{1,9})\)/)?.[1];
  return fromName?.toUpperCase() ?? "";
}

export function fidelityTypeFromAction(
  action: string,
): InvestmentTransactionType {
  const value = action.toUpperCase();
  if (/REINVESTMENT|DRIP/.test(value))
    return "DRIP" as InvestmentTransactionType;
  if (/DIVIDEND/.test(value)) return "DIVIDEND" as InvestmentTransactionType;
  if (/SELL|SOLD|SALE|DISPOSAL/.test(value))
    return "SELL" as InvestmentTransactionType;
  if (/INTEREST/.test(value)) return "INTEREST" as InvestmentTransactionType;
  if (/FEE|COMMISSION/.test(value)) return "FEE" as InvestmentTransactionType;
  if (/TAX/.test(value)) return "TAX" as InvestmentTransactionType;
  if (/CONTRIBUTION/.test(value))
    return "CONTRIBUTION" as InvestmentTransactionType;
  if (/TRANSFER.*RECEIVED|ELECTRONIC FUNDS TRANSFER/.test(value))
    return "TRANSFER_IN" as InvestmentTransactionType;
  if (/WITHDRAWAL|TRANSFER.*OUT/.test(value))
    return "TRANSFER_OUT" as InvestmentTransactionType;
  if (/BUY|BOUGHT|PURCHASE/.test(value))
    return "BUY" as InvestmentTransactionType;
  if (/CASH|DEPOSIT/.test(value)) return "CASH" as InvestmentTransactionType;
  return "OTHER" as InvestmentTransactionType;
}

export function calculateLedger(
  transactions: PortfolioTransaction[],
): LedgerResult {
  const lots: Lot[] = [];
  let purchases = 0;
  let saleProceeds = 0;
  let realizedGain = 0;
  let dividends = 0;
  let fees = 0;
  let taxes = 0;
  let contributions = 0;
  let withdrawals = 0;

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const tx of sorted) {
    const shares = Math.abs(n(tx.shares));
    const amount = Math.abs(n(tx.amount));
    const price =
      Math.abs(n(tx.pricePerShare)) || (shares > 0 ? amount / shares : 0);
    const type = String(tx.type).toUpperCase();

    fees += Math.abs(n(tx.fees));
    taxes += Math.abs(n(tx.taxes));

    if (type === "CONTRIBUTION" || type === "TRANSFER_IN") {
      contributions += amount;
      continue;
    }
    if (type === "WITHDRAWAL" || type === "TRANSFER_OUT") {
      withdrawals += amount;
      continue;
    }
    if (type === "BUY") {
      if (shares > 0 && amount > 0) {
        lots.push({
          shares,
          costPerShare: price || amount / shares,
          totalCost: amount,
        });
        purchases += amount;
      }
      continue;
    }
    if (type === "DRIP") {
      dividends += amount;
      if (shares > 0 && amount > 0) {
        lots.push({
          shares,
          costPerShare: price || amount / shares,
          totalCost: amount,
        });
      }
      continue;
    }
    if (type === "DIVIDEND" || type === "INTEREST") {
      dividends += amount;
      continue;
    }
    if (type === "SELL") {
      let remaining = shares;
      let costSold = 0;
      while (remaining > 1e-10 && lots.length) {
        const lot = lots[0];
        const fromLot = Math.min(remaining, lot.shares);
        const cost = fromLot * lot.costPerShare;
        costSold += cost;
        lot.shares -= fromLot;
        lot.totalCost -= cost;
        remaining -= fromLot;
        if (lot.shares <= 1e-8) lots.shift();
      }
      saleProceeds += amount;
      realizedGain += amount - costSold;
    }
  }

  return {
    shares: lots.reduce((sum, lot) => sum + lot.shares, 0),
    costBasis: lots.reduce((sum, lot) => sum + lot.totalCost, 0),
    purchases,
    saleProceeds,
    realizedGain,
    dividends,
    fees,
    taxes,
    contributions,
    withdrawals,
    lots,
  };
}

export function xirr(
  cashFlows: Array<{ date: Date | string; amount: number }>,
  guess = 0.1,
): number | null {
  // Preserve the public optional parameter for existing callers.
  void guess;

  if (cashFlows.length < 2) return null;
  const flows = cashFlows
    .map((flow) => ({ date: new Date(flow.date), amount: flow.amount }))
    .filter(
      (flow) =>
        Number.isFinite(flow.date.getTime()) && Number.isFinite(flow.amount),
    );
  if (flows.length < 2) return null;

  const start = flows[0].date.getTime();
  const f = (rate: number) =>
    flows.reduce((sum, flow) => {
      const years =
        (flow.date.getTime() - start) / (365.25 * 24 * 60 * 60 * 1000);
      return sum + flow.amount / Math.pow(1 + rate, years);
    }, 0);

  let low = -0.9999;
  let high = 10;
  let fLow = f(low);

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const value = f(mid);
    if (Math.abs(value) < 1e-8) return mid;
    if (fLow * value <= 0) {
      high = mid;
    } else {
      low = mid;
      fLow = value;
    }
  }
  return (low + high) / 2;
}

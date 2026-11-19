import type { Channel, TransactionInput } from "./types";

const VALID_CHANNELS: Set<string> = new Set([
  "MOBILE_BANKING",
  "CARD_POS",
  "QRIS_MERCHANT",
  "INTERNET_BANKING",
  "ATM_BRANCH",
]);

export const CSV_HEADERS = [
  "tx_id",
  "account_id",
  "recipient_account",
  "device_id",
  "channel",
  "merchant_category",
  "city",
  "amount_idr",
  "customer_avg_idr",
  "hour_of_day",
  "tx_velocity_1h",
  "tx_velocity_24h",
  "is_new_device",
  "is_cross_border",
  "distance_km",
  "is_dormant_account",
  "recipient_fan_in_24h",
  "is_new_recipient",
] as const;

export function generateSampleCsvTemplate(): string {
  const rows = [
    CSV_HEADERS.join(","),
    "TX-CSV-001,ACC-5001,MRC-2210,DEV-5001-A,QRIS_MERCHANT,Retail & Groceries,Solo,185000,350000,13,1,2,0,0,3.2,0,2,0",
    "TX-CSV-002,ACC-5002,MULE-911,DEV-UNK-8812,MOBILE_BANKING,Peer Transfer,Singapore,48500000,2200000,2,4,5,1,1,1180,0,4,1",
    "TX-CSV-003,ACC-5003,MULE-774,DEV-5003-A,MOBILE_BANKING,Peer Transfer,Jakarta,12500000,3000000,15,3,6,0,0,14,0,12,1",
    "TX-CSV-004,ACC-5004,ACC-9910,DEV-DRM-401,INTERNET_BANKING,Peer Transfer,Surabaya,72000000,1500000,1,2,2,1,0,410,1,2,1",
    "TX-CSV-005,ACC-5005,ACC-8821,DEV-5005-A,INTERNET_BANKING,Peer Transfer,Bandung,24750000,4000000,10,4,7,0,0,22,0,3,1",
  ];
  return rows.join("\n");
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function toNum(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFlag(val: string | undefined): number {
  if (!val) return 0;
  const v = val.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "ya" ? 1 : 0;
}

export interface CsvParseResult {
  transactions: TransactionInput[];
  error?: string;
}

export function parseTransactionsCsv(rawText: string): CsvParseResult {
  const lines = rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      transactions: [],
      error: "CSV harus berisi baris header dan minimal 1 baris data transaksi.",
    };
  }

  // Support both comma and semicolon (common in Indonesian Excel exports)
  const headerLine = lines[0];
  const delimiter =
    headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";

  const headers = splitCsvLine(headerLine, delimiter).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_")
  );

  const idxOf = (name: string) => headers.indexOf(name);
  const amountIdx = idxOf("amount_idr");
  if (amountIdx === -1) {
    return {
      transactions: [],
      error:
        "Kolom wajib 'amount_idr' tidak ditemukan. Gunakan tombol Template CSV sebagai acuan format.",
    };
  }

  const transactions: TransactionInput[] = [];
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = splitCsvLine(lines[rowIdx], delimiter);
    const get = (name: string) => {
      const i = idxOf(name);
      return i >= 0 ? cols[i] : undefined;
    };

    const rawChannel = (get("channel") ?? "MOBILE_BANKING").toUpperCase();
    const channel: Channel = VALID_CHANNELS.has(rawChannel)
      ? (rawChannel as Channel)
      : "MOBILE_BANKING";

    const amountIdr = Math.max(1000, toNum(get("amount_idr"), 0));
    const customerAvg = Math.max(50000, toNum(get("customer_avg_idr"), 1_500_000));
    const vel1h = Math.max(1, Math.round(toNum(get("tx_velocity_1h"), 1)));
    const vel24h = Math.max(vel1h, Math.round(toNum(get("tx_velocity_24h"), vel1h)));

    transactions.push({
      tx_id: get("tx_id") || `TX-CSV-${Date.now().toString().slice(-4)}-${rowIdx}`,
      account_id: get("account_id") || `ACC-CSV-${1000 + rowIdx}`,
      recipient_account: get("recipient_account") || `ACC-DEST-${2000 + rowIdx}`,
      device_id: get("device_id") || `DEV-CSV-${rowIdx}`,
      channel,
      merchant_category: get("merchant_category") || "Peer Transfer",
      city: get("city") || "Jakarta",
      amount_idr: amountIdr,
      customer_avg_idr: customerAvg,
      hour_of_day: Math.max(0, Math.min(23, Math.round(toNum(get("hour_of_day"), 12)))),
      tx_velocity_1h: vel1h,
      tx_velocity_24h: vel24h,
      is_new_device: toFlag(get("is_new_device")),
      is_cross_border: toFlag(get("is_cross_border")),
      distance_km: Math.max(0, toNum(get("distance_km"), 5)),
      is_dormant_account: toFlag(get("is_dormant_account")),
      recipient_fan_in_24h: Math.max(1, Math.round(toNum(get("recipient_fan_in_24h"), 1))),
      is_new_recipient: toFlag(get("is_new_recipient")),
    });
  }

  return { transactions };
}

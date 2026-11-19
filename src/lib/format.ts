import type { Language } from "./types";

function groupThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatIDR(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const prefix = rounded < 0 ? "-Rp " : "Rp ";
  return prefix + groupThousands(String(abs));
}

export function formatCompactIDR(amount: number, lang: Language): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) {
    const val = (abs / 1_000_000_000_000).toFixed(2);
    return `${sign}Rp ${val} ${lang === "id" ? "T" : "T"}`;
  }
  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2);
    return `${sign}Rp ${val} ${lang === "id" ? "M" : "B"}`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1);
    return `${sign}Rp ${val} ${lang === "id" ? "Jt" : "M"}`;
  }
  if (abs >= 1_000) {
    const val = Math.round(abs / 1_000);
    return `${sign}Rp ${val} ${lang === "id" ? "Rb" : "K"}`;
  }
  return formatIDR(amount);
}

export function formatInt(value: number): string {
  const rounded = Math.round(value);
  return (rounded < 0 ? "-" : "") + groupThousands(String(Math.abs(rounded)));
}

export function formatPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  Upload,
} from "lucide-react";
import { generateSampleCsvTemplate, parseTransactionsCsv } from "@/lib/csv-utils";
import { formatIDR } from "@/lib/format";
import {
  CHANNEL_LABELS,
  DECISION_META,
  DICT,
  REVIEW_STATUS_META,
  SCENARIO_LABELS,
} from "@/lib/i18n";
import type {
  DecisionTier,
  Language,
  ReviewStatus,
  TransactionInput,
  TransactionRecord,
  WatchlistEntry,
  WhitelistEntry,
} from "@/lib/types";

interface AnalystWorkbenchProps {
  lang: Language;
  records: TransactionRecord[];
  watchlist: WatchlistEntry[];
  whitelist: WhitelistEntry[];
  initialSelectedTxId?: string | null;
  onConfirmFraud: (record: TransactionRecord) => void;
  onMarkSafe: (record: TransactionRecord) => void;
  onTestInSimulator: (entry: WatchlistEntry) => void;
  onImportCsvBatch: (inputs: TransactionInput[]) => { total: number; highRiskCount: number };
}

const PAGE_SIZE = 20;

export function AnalystWorkbench({
  lang,
  records,
  watchlist,
  whitelist,
  initialSelectedTxId,
  onConfirmFraud,
  onMarkSafe,
  onTestInSimulator,
  onImportCsvBatch,
}: AnalystWorkbenchProps) {
  const t = DICT[lang];
  const isId = lang === "id";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | DecisionTier>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReviewStatus>("ALL");
  const [page, setPage] = useState(1);
  const [csvFeedback, setCsvFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string>(
    initialSelectedTxId ?? records[0]?.tx_id ?? ""
  );

  useEffect(() => {
    if (initialSelectedTxId) {
      setSelectedTxId(initialSelectedTxId);
    }
  }, [initialSelectedTxId]);

  const handleDownloadTemplate = () => {
    const csv = generateSampleCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sentinelbank-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseTransactionsCsv(text);
      if (parsed.error || parsed.transactions.length === 0) {
        setCsvFeedback({
          type: "err",
          text:
            parsed.error ??
            (isId ? "File CSV kosong atau tidak valid." : "CSV file is empty or invalid."),
        });
        return;
      }
      const res = onImportCsvBatch(parsed.transactions);
      setPage(1);
      setDecisionFilter("ALL");
      setStatusFilter("ALL");
      setCsvFeedback({
        type: "ok",
        text: isId
          ? `${res.total} transaksi dari "${file.name}" berhasil di-scoring (${res.highRiskCount} risiko tinggi masuk antrean).`
          : `${res.total} transactions from "${file.name}" scored (${res.highRiskCount} high-risk alerts queued).`,
      });
    } catch {
      setCsvFeedback({
        type: "err",
        text: isId ? "Gagal membaca file CSV." : "Failed to read CSV file.",
      });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      if (decisionFilter !== "ALL" && rec.scoring.decision !== decisionFilter) return false;
      if (statusFilter !== "ALL" && rec.reviewStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        rec.tx_id.toLowerCase().includes(q) ||
        rec.account_id.toLowerCase().includes(q) ||
        rec.recipient_account.toLowerCase().includes(q) ||
        rec.device_id.toLowerCase().includes(q) ||
        rec.city.toLowerCase().includes(q)
      );
    });
  }, [records, search, decisionFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const selected = useMemo(() => {
    return (
      filtered.find((r) => r.tx_id === selectedTxId) ??
      records.find((r) => r.tx_id === selectedTxId) ??
      filtered[0] ??
      null
    );
  }, [filtered, records, selectedTxId]);

  const pendingCount = useMemo(
    () => records.filter((r) => r.reviewStatus === "PENDING").length,
    [records]
  );
  const autoBlockCount = useMemo(
    () => records.filter((r) => r.scoring.decision === "AUTO_BLOCK").length,
    [records]
  );
  const confirmedCount = useMemo(
    () => records.filter((r) => r.reviewStatus === "CONFIRMED_FRAUD").length,
    [records]
  );

  // Proportional bar widths for Inspector baseline comparison
  const baselineBar = useMemo(() => {
    if (!selected) return { avgPct: 0, txPct: 0 };
    const maxVal = Math.max(selected.amount_idr, selected.customer_avg_idr, 1);
    return {
      avgPct: Math.max(6, Math.round((selected.customer_avg_idr / maxVal) * 100)),
      txPct: Math.max(6, Math.round((selected.amount_idr / maxVal) * 100)),
    };
  }, [selected]);

  return (
    <div className="space-y-4">
      {/* Compact 4-Column Operational KPI Strip (100% Bilingual) */}
      <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-[#0c0c0f] lg:grid-cols-4 lg:divide-y-0">
        <div className="border-t-2 border-t-amber-500 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{isId ? "Alert Menunggu" : "Pending Alerts"}</span>
          </div>
          <div className="mt-1 font-mono text-xl font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
            {pendingCount}
          </div>
        </div>
        <div className="border-t-2 border-t-rose-600 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
            <span>{isId ? "Blokir Otomatis" : "Auto-Blocked"}</span>
          </div>
          <div className="mt-1 font-mono text-xl font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
            {autoBlockCount}
          </div>
        </div>
        <div className="border-t-2 border-t-blue-600 px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {isId ? "Fraud Terkonfirmasi" : "Confirmed Fraud"}
          </div>
          <div className="mt-1 font-mono text-xl font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
            {confirmedCount}
          </div>
        </div>
        <div className="border-t-2 border-t-emerald-600 px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {isId ? "Watchlist Aktif" : "Active Watchlist"}
          </div>
          <div className="mt-1 font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {watchlist.length}
          </div>
        </div>
      </div>

      {/* Main Split View: Integrated Table + Sticky Inspector */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Left: Table Card with Integrated Slim Search/Filter Toolbar */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0c0c0f]">
          {/* Slim Integrated Toolbar (Search, Filters & Batch CSV Ingestion) */}
          <div className="space-y-2 border-b border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
              <div className="relative sm:col-span-6">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t.queue.searchPlaceholder}
                  className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={decisionFilter}
                  onChange={(e) => {
                    setDecisionFilter(e.target.value as "ALL" | DecisionTier);
                    setPage(1);
                  }}
                  aria-label={t.queue.filterDecision}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="ALL">
                    {isId ? "Keputusan: Semua" : "Decision: All"}
                  </option>
                  {(Object.keys(DECISION_META) as DecisionTier[]).map((tier) => (
                    <option key={tier} value={tier}>
                      {DECISION_META[tier][lang]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "ALL" | ReviewStatus);
                    setPage(1);
                  }}
                  aria-label={t.queue.filterStatus}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="ALL">
                    {isId ? "Status: Semua" : "Status: All"}
                  </option>
                  {(Object.keys(REVIEW_STATUS_META) as ReviewStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {REVIEW_STATUS_META[st][lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batch CSV Upload Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {isId
                  ? "Ingin uji data transaksi Anda sendiri? Unggah file CSV massal:"
                  : "Test your own transaction dataset via batch CSV upload:"}
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>{isId ? "Template CSV" : "CSV Template"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-blue-700"
                >
                  <Upload className="h-3 w-3" aria-hidden="true" />
                  <span>{isId ? "Import CSV" : "Import CSV"}</span>
                </button>
              </div>
            </div>

            {csvFeedback && (
              <div
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  csvFeedback.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                }`}
              >
                {csvFeedback.text}
              </div>
            )}
          </div>

          {/* 5-Column Non-Cramped Table */}
          <div
            tabIndex={0}
            role="region"
            aria-label={t.queue.title}
            className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3.5 py-2.5 font-medium">
                    {isId ? "Transaksi & Rekening" : "Transaction & Account"}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {isId ? "Kanal" : "Channel"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {isId ? "Nominal" : "Amount"}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {isId ? "Skor" : "Risk"}
                  </th>
                  <th className="px-3.5 py-2.5 font-medium">
                    {isId ? "Keputusan & Status" : "Decision & Status"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {paginatedRows.map((rec) => {
                  const active = selected?.tx_id === rec.tx_id;
                  const dMeta = DECISION_META[rec.scoring.decision];
                  const rMeta = REVIEW_STATUS_META[rec.reviewStatus];
                  const barColor =
                    rec.scoring.riskScore >= 85
                      ? "bg-rose-600"
                      : rec.scoring.riskScore >= 65
                        ? "bg-amber-500"
                        : rec.scoring.riskScore >= 40
                          ? "bg-blue-600"
                          : "bg-emerald-600";
                  return (
                    <tr
                      key={rec.tx_id}
                      onClick={() => setSelectedTxId(rec.tx_id)}
                      className={`cursor-pointer transition-colors ${
                        active
                          ? "bg-blue-50/80 dark:bg-blue-950/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                      }`}
                    >
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <div className="font-mono font-semibold text-zinc-950 dark:text-zinc-100">
                          {rec.tx_id}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {rec.account_id} → {rec.recipient_account}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-zinc-700 dark:text-zinc-300">
                        <div className="font-medium">{CHANNEL_LABELS[rec.channel][lang]}</div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          {rec.city}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-medium text-zinc-950 dark:text-zinc-100 tabular-nums">
                        {formatIDR(rec.amount_idr)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-10 overflow-hidden rounded-sm bg-zinc-200 dark:bg-zinc-800">
                            <div
                              className={`h-full rounded-sm ${barColor}`}
                              style={{ width: `${rec.scoring.riskScore}%` }}
                            />
                          </div>
                          <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {rec.scoring.riskScore}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${dMeta.textClass} ${
                            rec.scoring.decision === "AUTO_BLOCK"
                              ? "bg-rose-50 dark:bg-rose-950/40"
                              : rec.scoring.decision === "MANUAL_REVIEW"
                                ? "bg-amber-50 dark:bg-amber-950/40"
                                : rec.scoring.decision === "STEP_UP_CHALLENGE"
                                  ? "bg-blue-50 dark:bg-blue-950/40"
                                  : "bg-emerald-50 dark:bg-emerald-950/40"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${dMeta.dotClass}`} />
                          <span>{dMeta[lang]}</span>
                        </span>
                        <div className={`mt-0.5 flex items-center gap-1 text-[10px] ${rMeta.textClass}`}>
                          <span>{rMeta[lang]}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <span className="font-mono text-[11px] tabular-nums">
              {filtered.length} {isId ? "transaksi" : "tx"} • {isId ? "Hal." : "Page"} {safePage} /{" "}
              {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                aria-label="First page"
                className="rounded border border-zinc-200 bg-white p-1 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
                className="rounded border border-zinc-200 bg-white p-1 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                className="rounded border border-zinc-200 bg-white p-1 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage >= totalPages}
                aria-label="Last page"
                className="rounded border border-zinc-200 bg-white p-1 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sticky Inspector with Always-Visible Footer Action Bar */}
        <div className="lg:col-span-5 lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5.25rem)] flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0c0c0f]">
          {!selected ? (
            <div className="flex h-64 items-center justify-center p-5 text-xs text-zinc-500 dark:text-zinc-400">
              {t.queue.selectPrompt}
            </div>
          ) : (
            <>
              {/* Fixed Inspector Header */}
              <div className="shrink-0 flex items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3.5 dark:border-zinc-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-zinc-950 dark:text-zinc-50">
                      {selected.tx_id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        DECISION_META[selected.scoring.decision].textClass
                      } ${
                        selected.scoring.decision === "AUTO_BLOCK"
                          ? "bg-rose-50 dark:bg-rose-950/40"
                          : selected.scoring.decision === "MANUAL_REVIEW"
                            ? "bg-amber-50 dark:bg-amber-950/40"
                            : selected.scoring.decision === "STEP_UP_CHALLENGE"
                              ? "bg-blue-50 dark:bg-blue-950/40"
                              : "bg-emerald-50 dark:bg-emerald-950/40"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          DECISION_META[selected.scoring.decision].dotClass
                        }`}
                      />
                      {DECISION_META[selected.scoring.decision][lang]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {SCENARIO_LABELS[selected.scenario]?.[lang] ?? selected.scenario} •{" "}
                    {selected.city}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-2xl font-bold leading-none text-zinc-950 dark:text-zinc-50 tabular-nums">
                    {selected.scoring.riskScore}
                  </div>
                  <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                    {isId ? "Skor Risiko" : "Risk Score"}
                  </div>
                </div>
              </div>

              {/* Scrollable Inspector Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
                {/* 3-Layer Mini Score Strip */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: isId ? "Aturan (25%)" : "Rules (25%)",
                      val: selected.scoring.layerScores.ruleScore,
                      color: "bg-amber-500",
                    },
                    {
                      label: isId ? "Anomali (15%)" : "IsoForest (15%)",
                      val: selected.scoring.layerScores.isolationForestScore,
                      color: "bg-indigo-500",
                    },
                    {
                      label: isId ? "Model ML (60%)" : "Classifier (60%)",
                      val: selected.scoring.layerScores.classifierScore,
                      color: "bg-blue-600",
                    },
                  ].map((layer) => (
                    <div
                      key={layer.label}
                      className="rounded-md border border-zinc-200 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900/40"
                    >
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {layer.label}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                        {layer.val.toFixed(0)}
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-zinc-200 dark:bg-zinc-800">
                        <div
                          className={`h-full rounded-sm ${layer.color}`}
                          style={{ width: `${Math.min(100, layer.val)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Visual Baseline vs Current Amount Comparison */}
                <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {t.queue.baselineVsCurrent}
                    </span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 tabular-nums">
                      {selected.scoring.amountRatio}x {isId ? "rata-rata" : "avg"}
                    </span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {t.queue.txAmount}
                        </span>
                        <span className="font-mono font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                          {formatIDR(selected.amount_idr)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-sm bg-rose-600 dark:bg-rose-500"
                          style={{ width: `${baselineBar.txPct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {t.queue.custBaseline}
                        </span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">
                          {formatIDR(selected.customer_avg_idr)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-sm bg-zinc-400 dark:bg-zinc-500"
                          style={{ width: `${baselineBar.avgPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Telemetry Strip */}
                <div className="grid grid-cols-3 divide-x divide-zinc-200 rounded-md border border-zinc-200 text-xs dark:divide-zinc-800 dark:border-zinc-800">
                  <div className="p-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {t.queue.velocityLabel}
                    </div>
                    <div className="mt-0.5 font-mono font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                      {selected.tx_velocity_1h} / {selected.tx_velocity_24h}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {t.queue.muleSignal}
                    </div>
                    <div className="mt-0.5 font-mono font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                      {selected.recipient_fan_in_24h} {isId ? "pengirim" : "senders"}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {t.queue.dormantLabel}
                    </div>
                    <div className="mt-0.5 font-semibold text-zinc-950 dark:text-zinc-50">
                      {selected.is_dormant_account ? t.queue.yes : t.queue.no}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  {isId ? "Akun" : "Acc"}:{" "}
                  <span className="text-zinc-900 dark:text-zinc-100">{selected.account_id}</span> •{" "}
                  {isId ? "Tujuan" : "Dest"}:{" "}
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {selected.recipient_account}
                  </span>{" "}
                  • Dev:{" "}
                  <span className="text-zinc-900 dark:text-zinc-100">{selected.device_id}</span>
                </div>

                {/* Rules Triggered */}
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {t.simulator.rulesTriggered} ({selected.scoring.triggeredRules.length})
                  </div>
                  {selected.scoring.triggeredRules.length === 0 ? (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                      {t.simulator.noRulesTriggered}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                      {selected.scoring.triggeredRules.map((r) => (
                        <div key={r.ruleId} className="px-3 py-2 text-xs">
                          <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                            <span>{isId ? r.titleId : r.titleEn}</span>
                            <span className="font-mono text-rose-700 dark:text-rose-400">
                              +{r.weight}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {isId ? r.detailId : r.detailEn}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer Action Bar (Always visible above the fold!) */}
              <div className="shrink-0 grid grid-cols-2 gap-2 border-t border-zinc-200 bg-zinc-50/90 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                <button
                  type="button"
                  onClick={() => onConfirmFraud(selected)}
                  className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  {isId ? "Konfirmasi Fraud" : "Confirm Fraud"}
                </button>
                <button
                  type="button"
                  onClick={() => onMarkSafe(selected)}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  {isId ? "Tandai Aman" : "Mark Safe"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Watchlist & Whitelist Registry */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0c0c0f]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t.queue.watchlistTitle}
          </h3>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {t.queue.whitelistCount}: {whitelist.length}
          </span>
        </div>

        {watchlist.length === 0 ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            {t.queue.watchlistEmpty}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watchlist.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                      {entry.kind}
                    </span>
                    <span className="truncate font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                      {entry.value}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {entry.reason}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onTestInSimulator(entry)}
                  className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-blue-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-blue-400 dark:hover:bg-zinc-800"
                >
                  {t.queue.testWatchlistBtn}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

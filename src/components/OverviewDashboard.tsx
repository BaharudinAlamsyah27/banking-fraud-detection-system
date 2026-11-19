"use client";

import React, { useMemo } from "react";
import { ArrowRight, FlaskConical, SlidersHorizontal } from "lucide-react";
import { EChartBox } from "@/components/EChartBox";
import { formatCompactIDR, formatIDR, formatInt, formatPct } from "@/lib/format";
import { CHANNEL_LABELS, DECISION_META, SCENARIO_LABELS } from "@/lib/i18n";
import type { Language, ModelArtifact, TransactionRecord } from "@/lib/types";

interface OverviewDashboardProps {
  lang: Language;
  theme: "light" | "dark";
  artifact: ModelArtifact;
  records: TransactionRecord[];
  onNavigate: (tab: "queue" | "dashboard" | "simulator" | "architecture") => void;
  onInspectTransaction: (txId: string) => void;
}

export function OverviewDashboard({
  lang,
  theme,
  artifact,
  records,
  onNavigate,
  onInspectTransaction,
}: OverviewDashboardProps) {
  const isId = lang === "id";
  const isDark = theme === "dark";

  const axisLabelColor = isDark ? "#a1a1aa" : "#64748b";
  const splitLineColor = isDark ? "#27272a" : "#e2e8f0";
  const tooltipBg = isDark ? "#18181b" : "#ffffff";
  const tooltipBorder = isDark ? "#27272a" : "#e2e8f0";
  const tooltipText = isDark ? "#fafafa" : "#0f172a";

  const defaultSweep = useMemo(() => {
    return (
      artifact.threshold_sweep.find((p) => p.threshold === 65) ??
      artifact.threshold_sweep[0]
    );
  }, [artifact.threshold_sweep]);

  const liveStats = useMemo(() => {
    let pending = 0;
    let approve = 0;
    let stepUp = 0;
    let manual = 0;
    let autoBlock = 0;

    for (const r of records) {
      if (r.reviewStatus === "PENDING") pending += 1;
      if (r.scoring.decision === "APPROVE") approve += 1;
      else if (r.scoring.decision === "STEP_UP_CHALLENGE") stepUp += 1;
      else if (r.scoring.decision === "MANUAL_REVIEW") manual += 1;
      else autoBlock += 1;
    }

    return { pending, approve, stepUp, manual, autoBlock };
  }, [records]);

  const topPendingAlerts = useMemo(() => {
    return records
      .filter((r) => r.reviewStatus === "PENDING")
      .slice(0, 5);
  }, [records]);

  // Aggregate daily trend from actual transaction timestamps
  const trendChartOption = useMemo(() => {
    const dayMap = new Map<string, { normal: number; flagged: number }>();
    for (const r of records) {
      const dayKey = r.timestamp.slice(5, 10); // MM-DD
      const entry = dayMap.get(dayKey) ?? { normal: 0, flagged: 0 };
      if (r.scoring.decision === "AUTO_BLOCK" || r.scoring.decision === "MANUAL_REVIEW") {
        entry.flagged += 1;
      } else {
        entry.normal += 1;
      }
      dayMap.set(dayKey, entry);
    }

    const sortedDays = Array.from(dayMap.keys()).sort();
    const normalData = sortedDays.map((d) => dayMap.get(d)?.normal ?? 0);
    const flaggedData = sortedDays.map((d) => dayMap.get(d)?.flagged ?? 0);

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" },
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: axisLabelColor, fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" },
      },
      grid: { left: 36, right: 16, top: 32, bottom: 26 },
      xAxis: {
        type: "category",
        data: sortedDays,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: axisLabelColor, fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
        axisLabel: { color: axisLabelColor, fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" },
      },
      series: [
        {
          name: isId ? "Lolos / Step-Up" : "Cleared / Step-Up",
          type: "bar",
          stack: "tx",
          barMaxWidth: 22,
          itemStyle: { color: isDark ? "#3b82f6" : "#2563eb", borderRadius: [0, 0, 0, 0] },
          data: normalData,
        },
        {
          name: isId ? "Alert Risiko Tinggi" : "High-Risk Alerts",
          type: "bar",
          stack: "tx",
          barMaxWidth: 22,
          itemStyle: { color: "#e11d48", borderRadius: [3, 3, 0, 0] },
          data: flaggedData,
        },
      ],
    };
  }, [records, isId, isDark, axisLabelColor, splitLineColor, tooltipBg, tooltipBorder, tooltipText]);

  const decisionDonutOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" },
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: axisLabelColor, fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" },
      },
      series: [
        {
          type: "pie",
          radius: ["54%", "76%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: {
            borderColor: isDark ? "#0c0c0f" : "#ffffff",
            borderWidth: 2,
          },
          data: [
            {
              name: DECISION_META.APPROVE[lang],
              value: liveStats.approve,
              itemStyle: { color: "#10b981" },
            },
            {
              name: DECISION_META.STEP_UP_CHALLENGE[lang],
              value: liveStats.stepUp,
              itemStyle: { color: "#2563eb" },
            },
            {
              name: DECISION_META.MANUAL_REVIEW[lang],
              value: liveStats.manual,
              itemStyle: { color: "#f59e0b" },
            },
            {
              name: DECISION_META.AUTO_BLOCK[lang],
              value: liveStats.autoBlock,
              itemStyle: { color: "#e11d48" },
            },
          ],
        },
      ],
    };
  }, [liveStats, lang, isDark, axisLabelColor, tooltipBg, tooltipBorder, tooltipText]);

  return (
    <div className="space-y-5">
      {/* Executive Welcome / Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 border-t-2 border-t-blue-600 bg-white p-4 dark:border-zinc-800 dark:border-t-blue-500 dark:bg-[#0c0c0f]">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Total Volume Uji" : "Total Test Volume"}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {formatCompactIDR(artifact.metadata.dataset_summary.total_test_volume_idr, lang)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {formatInt(artifact.metadata.dataset_summary.test_size)}{" "}
            {isId ? "transaksi uji" : "test tx"} •{" "}
            {formatInt(artifact.metadata.dataset_summary.total_transactions)} total
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 border-t-2 border-t-emerald-600 bg-white p-4 dark:border-zinc-800 dark:border-t-emerald-500 dark:bg-[#0c0c0f]">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Kerugian Fraud Dicegah" : "Fraud Loss Prevented"}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCompactIDR(defaultSweep.fraud_value_saved_idr, lang)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            VDR {formatPct(defaultSweep.value_detection_rate, 1)} •{" "}
            {isId ? "Ambang skor 65" : "Threshold 65"}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 border-t-2 border-t-amber-500 bg-white p-4 dark:border-zinc-800 dark:border-t-amber-400 dark:bg-[#0c0c0f]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {isId ? "Alert Menunggu Tinjauan" : "Alerts Pending Review"}
            </span>
            <button
              type="button"
              onClick={() => onNavigate("queue")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {isId ? "Buka" : "Open"}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400 tabular-nums">
            {liveStats.pending}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {liveStats.autoBlock} {isId ? "blokir otomatis" : "auto-blocked"} •{" "}
            {liveStats.manual} {isId ? "tinjauan manual" : "manual hold"}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 border-t-2 border-t-rose-600 bg-white p-4 dark:border-zinc-800 dark:border-t-rose-500 dark:bg-[#0c0c0f]">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isId ? "Rasio Gangguan Nasabah (FP)" : "Customer Insult Rate (FP)"}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {formatPct(defaultSweep.insult_rate, 2)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {formatInt(defaultSweep.fp)}{" "}
            {isId ? "transaksi aman terdampak" : "legit tx impacted"}
          </div>
        </div>
      </div>

      {/* Middle Charts Row: Daily Activity Trend + 4-Tier Decision Donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {isId
                  ? "Aktivitas Transaksi & Deteksi Alert Harian"
                  : "Daily Transaction & Alert Activity"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isId
                  ? "Sebaran transaksi sampel uji per tanggal (lolos vs terdeteksi risiko tinggi)"
                  : "Distribution of curated test transactions by date (cleared vs high-risk alerts)"}
              </p>
            </div>
          </div>
          <EChartBox option={trendChartOption} height={240} />
        </div>

        <div className="lg:col-span-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {isId ? "Distribusi Keputusan 4-Tier" : "4-Tier Decision Distribution"}
          </h2>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            {isId ? "Proporsi hasil evaluasi antrean aktif" : "Breakdown of active queue outcomes"}
          </p>
          <EChartBox option={decisionDonutOption} height={240} />
        </div>
      </div>

      {/* Bottom Row: Top 5 Priority Alerts + Quick Actions & Channel Health */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {isId ? "Alert Prioritas Tertinggi" : "Top Priority Alerts"}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("queue")}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {isId ? "Lihat semua antrean" : "View full queue"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">{isId ? "Transaksi" : "Transaction"}</th>
                  <th className="px-4 py-2 font-medium">{isId ? "Skenario / Kanal" : "Scenario / Channel"}</th>
                  <th className="px-4 py-2 text-right font-medium">{isId ? "Nominal" : "Amount"}</th>
                  <th className="px-4 py-2 text-center font-medium">{isId ? "Skor" : "Score"}</th>
                  <th className="px-4 py-2 text-right font-medium">{isId ? "Aksi" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {topPendingAlerts.map((rec) => (
                  <tr
                    key={rec.tx_id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <div className="font-semibold text-zinc-950 dark:text-zinc-100 tabular-nums">
                        {rec.tx_id}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {rec.account_id} → {rec.recipient_account}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">
                        {SCENARIO_LABELS[rec.scenario]?.[lang] ?? rec.scenario}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {CHANNEL_LABELS[rec.channel][lang]} • {rec.city}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-zinc-950 dark:text-zinc-100 tabular-nums">
                      {formatIDR(rec.amount_idr)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-center">
                      <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 tabular-nums">
                        {rec.scoring.riskScore}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectTransaction(rec.tx_id)}
                        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
                      >
                        {isId ? "Tinjau" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Actions & Channel Summary */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0c0c0f]">
            <h3 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {isId ? "Aksi Cepat" : "Quick Actions"}
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigate("simulator")}
                className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-left transition hover:border-blue-500 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500"
              >
                <div className="flex items-center gap-2.5">
                  <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                      {isId ? "Uji Transaksi di Simulator" : "Run Live Tx Simulator"}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {isId ? "6 skenario serangan + Explainable AI" : "6 attack presets + Explainable AI"}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-left transition hover:border-blue-500 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500"
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                      {isId ? "Kalibrasi Ambang Skor" : "Tune Risk Threshold"}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {isId ? "Optimasi kerugian Rp vs False Positive" : "Optimize IDR loss vs false positives"}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0c0c0f]">
            <h3 className="mb-2.5 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {isId ? "Rasio Fraud per Kanal" : "Fraud Rate by Channel"}
            </h3>
            <div className="space-y-2.5">
              {artifact.channel_stats.map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {CHANNEL_LABELS[ch.channel][lang]}
                  </span>
                  <div className="flex items-center gap-2.5 tabular-nums">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {formatCompactIDR(ch.fraud_volume_idr, lang)}
                    </span>
                    <span className="w-11 text-right font-semibold text-zinc-950 dark:text-zinc-100">
                      {formatPct(ch.fraud_rate, 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

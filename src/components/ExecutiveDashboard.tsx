"use client";

import React, { useMemo, useState } from "react";
import { EChartBox } from "@/components/EChartBox";
import { formatCompactIDR, formatIDR, formatInt, formatPct } from "@/lib/format";
import { CHANNEL_LABELS, DICT, FEATURE_LABELS, SCENARIO_LABELS } from "@/lib/i18n";
import type { Language, ModelArtifact } from "@/lib/types";

interface ExecutiveDashboardProps {
  lang: Language;
  theme: "light" | "dark";
  artifact: ModelArtifact;
}

export function ExecutiveDashboard({
  lang,
  theme,
  artifact,
}: ExecutiveDashboardProps) {
  const t = DICT[lang];
  const [threshold, setThreshold] = useState<number>(65);
  const isDark = theme === "dark";

  const axisLabelColor = isDark ? "#a1a1aa" : "#71717a";
  const splitLineColor = isDark ? "#27272a" : "#e4e4e7";
  const tooltipBg = isDark ? "#18181b" : "#ffffff";
  const tooltipBorder = isDark ? "#27272a" : "#e4e4e7";
  const tooltipText = isDark ? "#fafafa" : "#09090b";

  const sweepPoint = useMemo(() => {
    return (
      artifact.threshold_sweep.find((p) => p.threshold === threshold) ??
      artifact.threshold_sweep[0]
    );
  }, [artifact.threshold_sweep, threshold]);

  const thresholdChartOption = useMemo(() => {
    const xLabels = artifact.threshold_sweep.map((p) => String(p.threshold));
    const vdrSeries = artifact.threshold_sweep.map((p) =>
      Number((p.value_detection_rate * 100).toFixed(1))
    );
    const precSeries = artifact.threshold_sweep.map((p) =>
      Number((p.precision * 100).toFixed(1))
    );
    const insultSeries = artifact.threshold_sweep.map((p) =>
      Number((p.insult_rate * 100).toFixed(2))
    );

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" },
        valueFormatter: (val: number) => `${val}%`,
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: axisLabelColor, fontSize: 11 },
      },
      grid: { left: 42, right: 16, top: 34, bottom: 26 },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: axisLabelColor, fontSize: 11, fontFamily: "IBM Plex Sans, sans-serif" },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
        axisLabel: {
          color: axisLabelColor,
          fontSize: 11,
          fontFamily: "IBM Plex Sans, sans-serif",
          formatter: "{value}%",
        },
      },
      series: [
        {
          name: t.kpis.valueDetectionRate,
          type: "line",
          smooth: false,
          symbolSize: 6,
          itemStyle: { color: "#2563eb" },
          lineStyle: { width: 2.2, color: "#2563eb" },
          data: vdrSeries,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#2563eb", type: "dashed", width: 1.5 },
            label: {
              formatter: `@${threshold}`,
              color: "#2563eb",
              fontFamily: "IBM Plex Sans, sans-serif",
              fontSize: 11,
            },
            data: [{ xAxis: String(threshold) }],
          },
        },
        {
          name: t.optimizer.precision,
          type: "line",
          smooth: false,
          symbolSize: 6,
          itemStyle: { color: isDark ? "#e4e4e7" : "#18181b" },
          lineStyle: { width: 2, color: isDark ? "#e4e4e7" : "#18181b" },
          data: precSeries,
        },
        {
          name: t.kpis.insultRate,
          type: "line",
          smooth: false,
          symbolSize: 5,
          itemStyle: { color: "#e11d48" },
          lineStyle: { width: 1.8, color: "#e11d48" },
          data: insultSeries,
        },
      ],
    };
  }, [
    artifact.threshold_sweep,
    threshold,
    isDark,
    axisLabelColor,
    splitLineColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    t.kpis.valueDetectionRate,
    t.optimizer.precision,
    t.kpis.insultRate,
  ]);

  const channelChartOption = useMemo(() => {
    const names = artifact.channel_stats.map((c) => CHANNEL_LABELS[c.channel][lang]);
    const exposureMillions = artifact.channel_stats.map((c) =>
      Number((c.fraud_volume_idr / 1_000_000).toFixed(2))
    );
    const fraudRates = artifact.channel_stats.map((c) =>
      Number((c.fraud_rate * 100).toFixed(1))
    );

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12 },
      },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: axisLabelColor, fontSize: 11 },
      },
      grid: { left: 48, right: 44, top: 34, bottom: 26 },
      xAxis: {
        type: "category",
        data: names,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: axisLabelColor, fontSize: 10 },
      },
      yAxis: [
        {
          type: "value",
          splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
          axisLabel: {
            color: axisLabelColor,
            fontSize: 10,
            fontFamily: "IBM Plex Sans, sans-serif",
            formatter: "{value}M",
          },
        },
        {
          type: "value",
          splitLine: { show: false },
          axisLabel: {
            color: axisLabelColor,
            fontSize: 10,
            fontFamily: "IBM Plex Sans, sans-serif",
            formatter: "{value}%",
          },
        },
      ],
      series: [
        {
          name: lang === "id" ? "Eksposur (Rp Jt)" : "Exposure (IDR M)",
          type: "bar",
          barWidth: 26,
          itemStyle: { color: "#2563eb", borderRadius: [3, 3, 0, 0] },
          data: exposureMillions,
        },
        {
          name: t.charts.fraudRate,
          type: "line",
          yAxisIndex: 1,
          symbolSize: 6,
          itemStyle: { color: "#e11d48" },
          lineStyle: { width: 2, color: "#e11d48" },
          data: fraudRates,
        },
      ],
    };
  }, [
    artifact.channel_stats,
    lang,
    axisLabelColor,
    splitLineColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    t.charts.fraudRate,
  ]);

  const scenarioChartOption = useMemo(() => {
    const sorted = [...artifact.scenario_stats].sort(
      (a, b) => a.total_exposure_idr - b.total_exposure_idr
    );
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12 },
        valueFormatter: (val: number) => `Rp ${val}M`,
      },
      grid: { left: 155, right: 24, top: 10, bottom: 24 },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
        axisLabel: {
          color: axisLabelColor,
          fontSize: 10,
          fontFamily: "IBM Plex Sans, sans-serif",
          formatter: "{value}M",
        },
      },
      yAxis: {
        type: "category",
        data: sorted.map((s) => SCENARIO_LABELS[s.scenario]?.[lang] ?? s.scenario),
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: axisLabelColor, fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          barWidth: 16,
          itemStyle: { color: isDark ? "#d4d4d8" : "#27272a", borderRadius: [0, 3, 3, 0] },
          data: sorted.map((s) => Number((s.total_exposure_idr / 1_000_000).toFixed(1))),
        },
      ],
    };
  }, [
    artifact.scenario_stats,
    lang,
    isDark,
    axisLabelColor,
    splitLineColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
  ]);

  const featureChartOption = useMemo(() => {
    const top8 = [...artifact.feature_importances].slice(0, 8).reverse();
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText, fontSize: 12 },
        valueFormatter: (val: number) => `${val}%`,
      },
      grid: { left: 175, right: 24, top: 10, bottom: 24 },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
        axisLabel: {
          color: axisLabelColor,
          fontSize: 10,
          fontFamily: "IBM Plex Sans, sans-serif",
          formatter: "{value}%",
        },
      },
      yAxis: {
        type: "category",
        data: top8.map((f) => FEATURE_LABELS[f.feature]?.[lang] ?? f.feature),
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: axisLabelColor, fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          barWidth: 14,
          itemStyle: { color: "#2563eb", borderRadius: [0, 3, 3, 0] },
          data: top8.map((f) => Number((f.rf_importance * 100).toFixed(1))),
        },
      ],
    };
  }, [
    artifact.feature_importances,
    lang,
    axisLabelColor,
    splitLineColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
  ]);

  return (
    <div className="space-y-6">
      {/* Unified 5-Column Metric Strip */}
      <div className="grid grid-cols-1 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-[#0c0c0f] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        <div className="p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t.kpis.totalTx}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {formatCompactIDR(artifact.metadata.dataset_summary.total_test_volume_idr, lang)}
          </div>
          <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {formatInt(artifact.metadata.dataset_summary.test_size)} test /{" "}
            {formatInt(artifact.metadata.dataset_summary.total_transactions)} total
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span>{t.kpis.fraudPrevented}</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCompactIDR(sweepPoint.fraud_value_saved_idr, lang)}
          </div>
          <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            @{threshold} • {formatIDR(sweepPoint.fraud_value_saved_idr)}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t.kpis.valueDetectionRate}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {formatPct(sweepPoint.value_detection_rate, 1)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.kpis.ofFraudValue}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            <span>{t.kpis.insultRate}</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {formatPct(sweepPoint.insult_rate, 2)}
          </div>
          <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {formatInt(sweepPoint.fp)} {t.kpis.legitImpacted}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t.kpis.modelAuc}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {artifact.metadata.metrics.hybrid.pr_auc.toFixed(3)}{" "}
            <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
              / {artifact.metadata.metrics.hybrid.roc_auc.toFixed(3)}
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.kpis.calibratedHybrid}
          </div>
        </div>
      </div>

      {/* Cost-Sensitive Threshold Optimizer (ECharts + 2x2 Matrix) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t.optimizer.title}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {t.optimizer.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t.optimizer.thresholdLabel}
              </div>
              <div className="font-mono text-lg font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                {threshold} / 100
              </div>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              aria-label={t.optimizer.thresholdLabel}
              className="h-1.5 w-44 cursor-pointer accent-blue-600 dark:accent-blue-500"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-md border border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
            <EChartBox option={thresholdChartOption} height={240} />
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              <div className="bg-white p-3 dark:bg-[#0c0c0f]">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t.optimizer.fraudSaved}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatIDR(sweepPoint.fraud_value_saved_idr)}
                </div>
              </div>
              <div className="bg-white p-3 dark:bg-[#0c0c0f]">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t.optimizer.fraudMissed}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                  {formatIDR(sweepPoint.fraud_value_missed_idr)}
                </div>
              </div>
              <div className="bg-white p-3 dark:bg-[#0c0c0f]">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t.optimizer.precision} / {t.optimizer.recall}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                  {formatPct(sweepPoint.precision, 1)} / {formatPct(sweepPoint.recall, 1)}
                </div>
              </div>
              <div className="bg-white p-3 dark:bg-[#0c0c0f]">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t.optimizer.alertsLoad} (F1 {sweepPoint.f1.toFixed(2)})
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                  {formatInt(sweepPoint.alerts_generated)} alerts
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
              <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                {t.optimizer.confusionTitle}
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
                    <th className="px-3 py-2 font-medium">
                      {lang === "id" ? "Aktual \\ Prediksi" : "Actual \\ Predicted"}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {lang === "id" ? "Terdeteksi (Alert)" : "Flagged (Alert)"}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {lang === "id" ? "Lolos (Aman)" : "Cleared (Pass)"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-mono tabular-nums dark:divide-zinc-800">
                  <tr>
                    <td className="px-3 py-2.5 font-sans text-zinc-700 dark:text-zinc-300">
                      {lang === "id" ? "Aktual Fraud" : "Actual Fraud"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950 dark:text-zinc-50">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        {formatInt(sweepPoint.tp)}
                      </span>
                      <span className="ml-1.5 text-[10px] text-zinc-400">TP</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
                        {formatInt(sweepPoint.fn)}
                      </span>
                      <span className="ml-1.5 text-[10px] text-zinc-400">FN</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-sans text-zinc-700 dark:text-zinc-300">
                      {lang === "id" ? "Aktual Aman" : "Actual Legit"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                        {formatInt(sweepPoint.fp)}
                      </span>
                      <span className="ml-1.5 text-[10px] text-zinc-400">FP</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                        {formatInt(sweepPoint.tn)}
                      </span>
                      <span className="ml-1.5 text-[10px] text-zinc-400">TN</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ECharts Analytical Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t.charts.channelTitle}
            </h3>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">n = 6,000</span>
          </div>
          <EChartBox option={channelChartOption} height={240} />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t.charts.scenarioTitle}
            </h3>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              360 fraud (6.0%)
            </span>
          </div>
          <EChartBox option={scenarioChartOption} height={240} />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <h3 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t.charts.importanceTitle}
          </h3>
          <EChartBox option={featureChartOption} height={240} />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <h3 className="mb-3 border-b border-zinc-100 pb-2.5 text-sm font-semibold text-zinc-950 dark:border-zinc-800/80 dark:text-zinc-50">
            {t.charts.modelBenchTitle}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2.5 font-medium">Model</th>
                  <th className="py-2.5 text-right font-medium">ROC-AUC</th>
                  <th className="py-2.5 text-right font-medium">PR-AUC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono tabular-nums dark:divide-zinc-800/80">
                <tr>
                  <td className="py-3 font-sans font-semibold text-zinc-950 dark:text-zinc-50">
                    Hybrid 3-Layer Ensemble
                  </td>
                  <td className="py-3 text-right text-zinc-950 dark:text-zinc-50">
                    {artifact.metadata.metrics.hybrid.roc_auc.toFixed(4)}
                  </td>
                  <td className="py-3 text-right text-zinc-950 dark:text-zinc-50">
                    {artifact.metadata.metrics.hybrid.pr_auc.toFixed(4)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-sans text-zinc-600 dark:text-zinc-400">
                    Logistic Regression (Calibrated)
                  </td>
                  <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {artifact.metadata.metrics.logistic_regression.roc_auc.toFixed(4)}
                  </td>
                  <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {artifact.metadata.metrics.logistic_regression.pr_auc.toFixed(4)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-sans text-zinc-600 dark:text-zinc-400">
                    Random Forest (100 Trees)
                  </td>
                  <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {artifact.metadata.metrics.random_forest.roc_auc.toFixed(4)}
                  </td>
                  <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {artifact.metadata.metrics.random_forest.pr_auc.toFixed(4)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { EChartBox } from "@/components/EChartBox";
import { evaluateTransaction } from "@/lib/fraud-engine";
import { formatIDR } from "@/lib/format";
import { CHANNEL_LABELS, DECISION_META, DICT, FEATURE_LABELS } from "@/lib/i18n";
import type {
  Channel,
  Language,
  ScoringResult,
  TransactionInput,
  WatchlistEntry,
  WhitelistEntry,
} from "@/lib/types";

interface SimulatorPreset {
  id: string;
  labelId: string;
  labelEn: string;
  data: TransactionInput;
}

export const SIMULATOR_PRESETS: SimulatorPreset[] = [
  {
    id: "normal",
    labelId: "Normal (QRIS)",
    labelEn: "Normal (QRIS)",
    data: {
      account_id: "ACC-1420",
      recipient_account: "MRC-8821",
      device_id: "DEV-1420-A",
      channel: "QRIS_MERCHANT",
      merchant_category: "Retail & Groceries",
      city: "Solo",
      amount_idr: 325_000,
      customer_avg_idr: 450_000,
      hour_of_day: 14,
      tx_velocity_1h: 1,
      tx_velocity_24h: 2,
      is_new_device: 0,
      is_cross_border: 0,
      distance_km: 4.5,
      is_dormant_account: 0,
      recipient_fan_in_24h: 2,
      is_new_recipient: 0,
    },
  },
  {
    id: "ato",
    labelId: "Account Takeover",
    labelEn: "Account Takeover",
    data: {
      account_id: "ACC-1185",
      recipient_account: "MULE-904",
      device_id: "DEV-UNK-7731",
      channel: "MOBILE_BANKING",
      merchant_category: "Peer Transfer",
      city: "Singapore",
      amount_idr: 42_000_000,
      customer_avg_idr: 2_500_000,
      hour_of_day: 2,
      tx_velocity_1h: 4,
      tx_velocity_24h: 5,
      is_new_device: 1,
      is_cross_border: 1,
      distance_km: 1240,
      is_dormant_account: 0,
      recipient_fan_in_24h: 3,
      is_new_recipient: 1,
    },
  },
  {
    id: "mule",
    labelId: "Money Mule (Fan-In)",
    labelEn: "Money Mule (Fan-In)",
    data: {
      account_id: "ACC-1904",
      recipient_account: "MULE-442",
      device_id: "DEV-1904-A",
      channel: "MOBILE_BANKING",
      merchant_category: "Peer Transfer",
      city: "Jakarta",
      amount_idr: 14_500_000,
      customer_avg_idr: 2_800_000,
      hour_of_day: 16,
      tx_velocity_1h: 3,
      tx_velocity_24h: 6,
      is_new_device: 0,
      is_cross_border: 0,
      distance_km: 12,
      is_dormant_account: 0,
      recipient_fan_in_24h: 14,
      is_new_recipient: 1,
    },
  },
  {
    id: "dormant",
    labelId: "Rekening Dorman",
    labelEn: "Dormant Account",
    data: {
      account_id: "ACC-2109",
      recipient_account: "ACC-8122",
      device_id: "DEV-DRM-312",
      channel: "INTERNET_BANKING",
      merchant_category: "Peer Transfer",
      city: "Surabaya",
      amount_idr: 65_000_000,
      customer_avg_idr: 1_200_000,
      hour_of_day: 1,
      tx_velocity_1h: 2,
      tx_velocity_24h: 2,
      is_new_device: 1,
      is_cross_border: 0,
      distance_km: 340,
      is_dormant_account: 1,
      recipient_fan_in_24h: 2,
      is_new_recipient: 1,
    },
  },
  {
    id: "structuring",
    labelId: "Structuring (<25 Jt)",
    labelEn: "Structuring (<25M)",
    data: {
      account_id: "ACC-1677",
      recipient_account: "ACC-7451",
      device_id: "DEV-1677-A",
      channel: "INTERNET_BANKING",
      merchant_category: "Peer Transfer",
      city: "Bandung",
      amount_idr: 24_800_000,
      customer_avg_idr: 3_500_000,
      hour_of_day: 11,
      tx_velocity_1h: 4,
      tx_velocity_24h: 8,
      is_new_device: 0,
      is_cross_border: 0,
      distance_km: 18,
      is_dormant_account: 0,
      recipient_fan_in_24h: 4,
      is_new_recipient: 1,
    },
  },
  {
    id: "velocity",
    labelId: "Velocity Attack",
    labelEn: "Velocity Attack",
    data: {
      account_id: "ACC-1552",
      recipient_account: "MRC-5510",
      device_id: "DEV-VEL-908",
      channel: "CARD_POS",
      merchant_category: "Digital Goods / Gaming",
      city: "Kuala Lumpur",
      amount_idr: 2_900_000,
      customer_avg_idr: 1_100_000,
      hour_of_day: 3,
      tx_velocity_1h: 11,
      tx_velocity_24h: 15,
      is_new_device: 1,
      is_cross_border: 1,
      distance_km: 1180,
      is_dormant_account: 0,
      recipient_fan_in_24h: 2,
      is_new_recipient: 1,
    },
  },
];

interface TransactionSimulatorProps {
  lang: Language;
  theme: "light" | "dark";
  watchlist: WatchlistEntry[];
  whitelist: WhitelistEntry[];
  externalPreset?: TransactionInput | null;
  onClearExternalPreset: () => void;
  onPushToQueue: (input: TransactionInput, scoring: ScoringResult) => void;
}

export function TransactionSimulator({
  lang,
  theme,
  watchlist,
  whitelist,
  externalPreset,
  onClearExternalPreset,
  onPushToQueue,
}: TransactionSimulatorProps) {
  const t = DICT[lang];
  const [form, setForm] = useState<TransactionInput>(SIMULATOR_PRESETS[1].data);
  const [activePresetId, setActivePresetId] = useState<string>("ato");
  const [apiScoring, setApiScoring] = useState<ScoringResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [pushedToast, setPushedToast] = useState(false);

  useEffect(() => {
    if (externalPreset) {
      setForm(externalPreset);
      setActivePresetId("");
      setApiScoring(null);
      onClearExternalPreset();
    }
  }, [externalPreset, onClearExternalPreset]);

  const liveScoring = useMemo(
    () => evaluateTransaction(form, watchlist, whitelist),
    [form, watchlist, whitelist]
  );

  const scoring = apiScoring ?? liveScoring;
  const decisionMeta = DECISION_META[scoring.decision];

  const explainChartOption = useMemo(() => {
    const isDark = theme === "dark";
    const top6 = [...scoring.featureContributions].slice(0, 6).reverse();
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        textStyle: { color: isDark ? "#fafafa" : "#09090b", fontSize: 12 },
        valueFormatter: (val: number) => `${val >= 0 ? "+" : ""}${val} log-odds`,
      },
      grid: { left: 175, right: 20, top: 8, bottom: 22 },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: isDark ? "#27272a" : "#e4e4e7", type: "dashed" } },
        axisLabel: {
          color: isDark ? "#a1a1aa" : "#71717a",
          fontSize: 10,
          fontFamily: "IBM Plex Sans, sans-serif",
        },
      },
      yAxis: {
        type: "category",
        data: top6.map((f) => FEATURE_LABELS[f.feature]?.[lang] ?? f.feature),
        axisLine: { lineStyle: { color: isDark ? "#27272a" : "#e4e4e7" } },
        axisLabel: { color: isDark ? "#d4d4d8" : "#3f3f46", fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          barWidth: 14,
          data: top6.map((f) => ({
            value: Number(f.contribution.toFixed(2)),
            itemStyle: {
              color: f.direction === "RISK_UP" ? "#e11d48" : "#059669",
              borderRadius: f.contribution >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3],
            },
          })),
        },
      ],
    };
  }, [scoring.featureContributions, lang, theme]);

  const handleField = <K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) => {
    setApiScoring(null);
    setActivePresetId("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleApiEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: form, watchlist, whitelist }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.scoring) {
          setApiScoring(json.scoring);
        }
      }
    } catch {
      setApiScoring(liveScoring);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSendToQueue = () => {
    onPushToQueue(form, scoring);
    setPushedToast(true);
    setTimeout(() => setPushedToast(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Preset Bar */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0c0c0f]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t.simulator.title}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {t.simulator.subtitle}
            </p>
          </div>
          <span className="self-start font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            POST /api/score
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
          {SIMULATOR_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setApiScoring(null);
                  setActivePresetId(preset.id);
                  setForm({ ...preset.data });
                }}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {lang === "id" ? preset.labelId : preset.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Form Inputs */}
        <div className="lg:col-span-6 space-y-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <h3 className="border-b border-zinc-100 pb-2.5 text-sm font-semibold text-zinc-950 dark:border-zinc-800/80 dark:text-zinc-50">
            {t.simulator.inputSection}
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.simulator.accountId}
              </label>
              <input
                type="text"
                value={form.account_id}
                onChange={(e) => handleField("account_id", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.simulator.recipientAccount}
              </label>
              <input
                type="text"
                value={form.recipient_account}
                onChange={(e) => handleField("recipient_account", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.simulator.deviceId}
              </label>
              <input
                type="text"
                value={form.device_id}
                onChange={(e) => handleField("device_id", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.simulator.channel}
              </label>
              <select
                value={form.channel}
                onChange={(e) => handleField("channel", e.target.value as Channel)}
                className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {(Object.keys(CHANNEL_LABELS) as Channel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABELS[ch][lang]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.simulator.city}
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleField("city", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.simulator.merchantCategory}
              </label>
              <input
                type="text"
                value={form.merchant_category}
                onChange={(e) => handleField("merchant_category", e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-950 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                  {t.simulator.amountIdr}
                </span>
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatIDR(form.amount_idr)}
                </span>
              </div>
              <input
                type="number"
                min={10000}
                step={50000}
                value={form.amount_idr}
                onChange={(e) => handleField("amount_idr", Math.max(0, Number(e.target.value)))}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-950 tabular-nums focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              {scoring.nearStructuring && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>{t.simulator.structuringBadge}</span>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                  {t.simulator.customerAvgIdr}
                </span>
                <span className="font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">
                  {formatIDR(form.customer_avg_idr)} ({scoring.amountRatio}x)
                </span>
              </div>
              <input
                type="number"
                min={50000}
                step={50000}
                value={form.customer_avg_idr}
                onChange={(e) =>
                  handleField("customer_avg_idr", Math.max(50000, Number(e.target.value)))
                }
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-950 tabular-nums focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{t.simulator.hourOfDay}</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {String(form.hour_of_day).padStart(2, "0")}:00
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={23}
                value={form.hour_of_day}
                onChange={(e) => handleField("hour_of_day", Number(e.target.value))}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{t.simulator.velocity1h}</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {form.tx_velocity_1h}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={form.tx_velocity_1h}
                onChange={(e) => {
                  const v1 = Number(e.target.value);
                  handleField("tx_velocity_1h", v1);
                  if (form.tx_velocity_24h < v1) {
                    handleField("tx_velocity_24h", v1);
                  }
                }}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{t.simulator.velocity24h}</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {form.tx_velocity_24h}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={form.tx_velocity_24h}
                onChange={(e) => handleField("tx_velocity_24h", Number(e.target.value))}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{t.simulator.fanIn24h}</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {form.recipient_fan_in_24h}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={25}
                value={form.recipient_fan_in_24h}
                onChange={(e) => handleField("recipient_fan_in_24h", Number(e.target.value))}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
            </div>

            <div className="col-span-2">
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{t.simulator.distanceKm}</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {form.distance_km} km
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3500}
                step={25}
                value={form.distance_km}
                onChange={(e) => handleField("distance_km", Number(e.target.value))}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
            </div>
          </div>

          {/* Behavioral Flags */}
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {t.simulator.flagsTitle}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { key: "is_new_device" as const, label: t.simulator.flagNewDevice },
                { key: "is_cross_border" as const, label: t.simulator.flagCrossBorder },
                { key: "is_dormant_account" as const, label: t.simulator.flagDormant },
                { key: "is_new_recipient" as const, label: t.simulator.flagNewRecipient },
              ].map((flag) => {
                const active = form[flag.key] === 1;
                return (
                  <button
                    key={flag.key}
                    type="button"
                    onClick={() => handleField(flag.key, active ? 0 : 1)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/30 dark:text-blue-200"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>{flag.label}</span>
                    <span
                      className={`h-4 w-7 rounded-full p-0.5 transition ${
                        active ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                          active ? "translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={handleApiEvaluate}
              disabled={isEvaluating}
              className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {t.simulator.evaluateBtn}
            </button>

            <button
              type="button"
              onClick={handleSendToQueue}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t.simulator.pushQueueBtn}
            </button>

            {pushedToast && (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {t.simulator.pushedNotice}
              </span>
            )}
          </div>
        </div>

        {/* Right: Scoring Result Panel */}
        <div className="lg:col-span-6 space-y-5">
          {/* Neutral Card with 4px Semantic Left Accent */}
          <div
            className={`rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f] ${decisionMeta.panelClass}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${decisionMeta.dotClass}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${decisionMeta.textClass}`}>
                    {decisionMeta[lang]}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {lang === "id" ? decisionMeta.actionId : decisionMeta.actionEn}
                </p>
                <div className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {t.simulator.latencyLabel}: {scoring.latencyMs} ms
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-3xl font-bold text-zinc-950 dark:text-zinc-50 tabular-nums">
                  {scoring.riskScore}
                  <span className="text-sm font-normal text-zinc-400"> / 100</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                  Hybrid Risk Score
                </div>
              </div>
            </div>

            {scoring.watchlistHit && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {t.simulator.watchlistWarning}
              </div>
            )}
            {scoring.whitelistHit && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                {t.simulator.whitelistNotice}
              </div>
            )}

            {/* 3-Layer Breakdown */}
            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800/80 sm:grid-cols-3">
              {[
                {
                  label: t.simulator.layerRule,
                  score: scoring.layerScores.ruleScore,
                  weight: "25%",
                },
                {
                  label: t.simulator.layerIso,
                  score: scoring.layerScores.isolationForestScore,
                  weight: "15%",
                },
                {
                  label: t.simulator.layerClf,
                  score: scoring.layerScores.classifierScore,
                  weight: "60%",
                },
              ].map((layer) => (
                <div
                  key={layer.label}
                  className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>{layer.label}</span>
                    <span className="font-mono">{layer.weight}</span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-zinc-950 dark:text-zinc-50 tabular-nums">
                    {layer.score.toFixed(1)}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-sm bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                      style={{ width: `${Math.min(100, layer.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Triggered Banking Rules */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
            <h3 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t.simulator.rulesTriggered} ({scoring.triggeredRules.length})
            </h3>
            {scoring.triggeredRules.length === 0 ? (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                {t.simulator.noRulesTriggered}
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {scoring.triggeredRules.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className="flex items-start justify-between gap-3 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {rule.ruleId}
                        </span>
                        <span>{lang === "id" ? rule.titleId : rule.titleEn}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {lang === "id" ? rule.detailId : rule.detailEn}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                      +{rule.weight}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Explainable AI Feature Contributions (ECharts) */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
            <h3 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t.simulator.explainTitle}
            </h3>
            <EChartBox option={explainChartOption} height={210} />
          </div>
        </div>
      </div>
    </div>
  );
}

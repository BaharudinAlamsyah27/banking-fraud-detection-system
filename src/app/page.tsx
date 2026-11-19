"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Sun,
  X,
} from "lucide-react";
import { AnalystWorkbench } from "@/components/AnalystWorkbench";
import { ArchitectureGuide } from "@/components/ArchitectureGuide";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";
import { OverviewDashboard } from "@/components/OverviewDashboard";
import { SIMULATOR_PRESETS, TransactionSimulator } from "@/components/TransactionSimulator";
import {
  buildInitialTransactionRecords,
  evaluateTransaction,
  modelArtifact,
} from "@/lib/fraud-engine";
import { DICT } from "@/lib/i18n";
import type {
  Language,
  ScoringResult,
  TransactionInput,
  TransactionRecord,
  WatchlistEntry,
  WhitelistEntry,
} from "@/lib/types";

type TabId = "overview" | "queue" | "dashboard" | "simulator" | "architecture";
type ThemeMode = "light" | "dark";

const STORAGE_KEY = "sentinelbank_fds_state_v2";

interface PersistedState {
  lang: Language;
  theme: ThemeMode;
  watchlist: WatchlistEntry[];
  whitelist: WhitelistEntry[];
  records: TransactionRecord[];
}

export default function HomePage() {
  const [lang, setLang] = useState<Language>("id");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [records, setRecords] = useState<TransactionRecord[]>(() =>
    buildInitialTransactionRecords()
  );
  const [simPresetOverride, setSimPresetOverride] = useState<TransactionInput | null>(null);
  const [selectedQueueTxId, setSelectedQueueTxId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (parsed.lang === "id" || parsed.lang === "en") setLang(parsed.lang);
        if (parsed.theme === "light" || parsed.theme === "dark") setTheme(parsed.theme);
        if (Array.isArray(parsed.watchlist)) setWatchlist(parsed.watchlist);
        if (Array.isArray(parsed.whitelist)) setWhitelist(parsed.whitelist);
        if (Array.isArray(parsed.records) && parsed.records.length > 0) {
          setRecords(parsed.records);
        }
      }
    } catch {
      // ignore malformed storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedState = { lang, theme, watchlist, whitelist, records };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [hydrated, lang, theme, watchlist, whitelist, records]);

  const t = DICT[lang];

  const pendingCount = useMemo(
    () => records.filter((r) => r.reviewStatus === "PENDING").length,
    [records]
  );

  const handleResetDemo = () => {
    const emptyWatch: WatchlistEntry[] = [];
    const emptyWhite: WhitelistEntry[] = [];
    setWatchlist(emptyWatch);
    setWhitelist(emptyWhite);
    setRecords(buildInitialTransactionRecords(emptyWatch, emptyWhite));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handlePushToQueue = useCallback(
    (input: TransactionInput, scoring: ScoringResult) => {
      const nowIso = new Date().toISOString();
      const txId = `TX-SIM-${Math.floor(100000 + Math.random() * 899999)}`;
      const newRecord: TransactionRecord = {
        ...input,
        tx_id: txId,
        timestamp: nowIso,
        scenario: "SIMULATED_LIVE",
        ground_truth_fraud: scoring.riskScore >= 65 ? 1 : 0,
        scoring,
        reviewStatus:
          scoring.decision === "MANUAL_REVIEW" || scoring.decision === "AUTO_BLOCK"
            ? "PENDING"
            : "AUTO_CLEARED",
      };
      setRecords((prev) => [newRecord, ...prev]);
    },
    []
  );

  const handleImportCsvBatch = useCallback(
    (inputs: TransactionInput[]) => {
      const nowIso = new Date().toISOString();
      const scoredRecords: TransactionRecord[] = inputs.map((input, idx) => {
        const scoring = evaluateTransaction(input, watchlist, whitelist);
        return {
          ...input,
          tx_id: input.tx_id || `TX-CSV-${Date.now().toString().slice(-4)}-${idx + 1}`,
          timestamp: nowIso,
          scenario: "BATCH_CSV",
          ground_truth_fraud: scoring.riskScore >= 65 ? 1 : 0,
          scoring,
          reviewStatus:
            scoring.decision === "MANUAL_REVIEW" || scoring.decision === "AUTO_BLOCK"
              ? "PENDING"
              : "AUTO_CLEARED",
        };
      });
      setRecords((prev) => [...scoredRecords, ...prev]);
      if (scoredRecords[0]) {
        setSelectedQueueTxId(scoredRecords[0].tx_id);
      }
      const highRiskCount = scoredRecords.filter(
        (r) => r.scoring.decision === "AUTO_BLOCK" || r.scoring.decision === "MANUAL_REVIEW"
      ).length;
      return { total: scoredRecords.length, highRiskCount };
    },
    [watchlist, whitelist]
  );

  const handleConfirmFraud = useCallback(
    (target: TransactionRecord) => {
      const nowIso = new Date().toISOString();
      const nextWatchlist = [...watchlist];

      if (
        !nextWatchlist.some(
          (w) => w.kind === "RECIPIENT" && w.value === target.recipient_account
        )
      ) {
        nextWatchlist.unshift({
          id: `wl-rec-${Date.now()}`,
          kind: "RECIPIENT",
          value: target.recipient_account,
          reason: `Confirmed fraud on ${target.tx_id}`,
          addedAt: nowIso,
        });
      }
      if (!nextWatchlist.some((w) => w.kind === "DEVICE" && w.value === target.device_id)) {
        nextWatchlist.unshift({
          id: `wl-dev-${Date.now() + 1}`,
          kind: "DEVICE",
          value: target.device_id,
          reason: `Confirmed fraud device on ${target.tx_id}`,
          addedAt: nowIso,
        });
      }

      setWatchlist(nextWatchlist);
      setRecords((prev) =>
        prev.map((rec) => {
          if (rec.tx_id === target.tx_id) {
            return {
              ...rec,
              reviewStatus: "CONFIRMED_FRAUD",
              scoring: evaluateTransaction(rec, nextWatchlist, whitelist),
            };
          }
          if (rec.reviewStatus === "PENDING") {
            return {
              ...rec,
              scoring: evaluateTransaction(rec, nextWatchlist, whitelist),
            };
          }
          return rec;
        })
      );
    },
    [watchlist, whitelist]
  );

  const handleMarkSafe = useCallback(
    (target: TransactionRecord) => {
      const nowIso = new Date().toISOString();
      const nextWhitelist = [...whitelist];
      if (
        !nextWhitelist.some(
          (w) => w.accountId === target.account_id && w.deviceId === target.device_id
        )
      ) {
        nextWhitelist.unshift({
          id: `wh-${Date.now()}`,
          accountId: target.account_id,
          deviceId: target.device_id,
          addedAt: nowIso,
        });
      }

      setWhitelist(nextWhitelist);
      setRecords((prev) =>
        prev.map((rec) => {
          if (rec.tx_id === target.tx_id) {
            return {
              ...rec,
              reviewStatus: "MARKED_SAFE",
              scoring: evaluateTransaction(rec, watchlist, nextWhitelist),
            };
          }
          if (rec.reviewStatus === "PENDING") {
            return {
              ...rec,
              scoring: evaluateTransaction(rec, watchlist, nextWhitelist),
            };
          }
          return rec;
        })
      );
    },
    [watchlist, whitelist]
  );

  const handleTestWatchlistInSimulator = useCallback((entry: WatchlistEntry) => {
    const base = { ...SIMULATOR_PRESETS[0].data };
    if (entry.kind === "RECIPIENT") {
      base.recipient_account = entry.value;
    } else {
      base.device_id = entry.value;
      base.is_new_device = 1;
    }
    setSimPresetOverride(base);
    setActiveTab("simulator");
  }, []);

  const handleInspectFromOverview = useCallback((txId: string) => {
    setSelectedQueueTxId(txId);
    setActiveTab("queue");
  }, []);

  const clearExternalPreset = useCallback(() => {
    setSimPresetOverride(null);
  }, []);

  const navGroups: {
    groupLabel: string;
    items: {
      id: TabId;
      label: string;
      icon: React.ReactNode;
      badge?: number;
    }[];
  }[] = [
    {
      groupLabel: lang === "id" ? "Operasional" : "Operations",
      items: [
        {
          id: "overview",
          label: "Dashboard",
          icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        },
        {
          id: "queue",
          label: lang === "id" ? "Antrean Risiko" : "Risk Queue",
          icon: <ListChecks className="h-4 w-4" aria-hidden="true" />,
          badge: pendingCount,
        },
      ],
    },
    {
      groupLabel: lang === "id" ? "Analitik & Uji" : "Analytics & Test",
      items: [
        {
          id: "dashboard",
          label: lang === "id" ? "Analitik & Threshold" : "Model & Cost Analytics",
          icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
        },
        {
          id: "simulator",
          label: lang === "id" ? "Simulator Transaksi" : "Tx Simulator",
          icon: <FlaskConical className="h-4 w-4" aria-hidden="true" />,
        },
      ],
    },
    {
      groupLabel: lang === "id" ? "Sistem" : "System",
      items: [
        {
          id: "architecture",
          label: lang === "id" ? "Aturan & Arsitektur" : "Rules & Architecture",
          icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
        },
      ],
    },
  ];

  const navItems = navGroups.flatMap((g) => g.items);
  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? "";

  return (
    <div className="flex min-h-screen bg-[#f4f6f9] text-zinc-950 dark:bg-[#09090b] dark:text-zinc-50">
      {/* Desktop Left Sidebar (Collapsible + Grouped Nav + Live Engine Status) */}
      <aside
        className={`hidden lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:shrink-0 lg:flex-col lg:justify-between overflow-y-auto border-r border-slate-800 bg-[#0f172a] text-slate-100 transition-all duration-200 ${
          sidebarCollapsed ? "lg:w-16" : "lg:w-60"
        }`}
      >
        <div>
          {/* Brand + Collapse Toggle */}
          <div
            className={`flex items-center border-b border-slate-800/80 py-3 ${
              sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
                SB
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold tracking-tight text-white">
                    SentinelBank
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {lang === "id" ? "Operasi Risiko Fraud" : "Fraud Risk Operations"}
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                aria-label={lang === "id" ? "Lipat sidebar" : "Collapse sidebar"}
                title={lang === "id" ? "Lipat sidebar" : "Collapse sidebar"}
                className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <div className="flex justify-center border-b border-slate-800/80 py-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label={lang === "id" ? "Perluas sidebar" : "Expand sidebar"}
                title={lang === "id" ? "Perluas sidebar" : "Expand sidebar"}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Grouped Primary Navigation */}
          <nav aria-label="Primary" className="p-2.5 space-y-4">
            {navGroups.map((group) => (
              <div key={group.groupLabel}>
                {!sidebarCollapsed && (
                  <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.groupLabel}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex w-full items-center rounded-md text-xs font-medium transition-colors ${
                          sidebarCollapsed
                            ? "justify-center p-2.5"
                            : "justify-between px-2.5 py-2"
                        } ${
                          active
                            ? "bg-blue-600/20 text-white border-l-2 border-l-blue-400"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className={active ? "text-blue-400" : "text-slate-500"}>
                            {item.icon}
                          </span>
                          {!sidebarCollapsed && <span>{item.label}</span>}
                        </span>
                        {!sidebarCollapsed && typeof item.badge === "number" && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                              active
                                ? "bg-blue-500/30 text-blue-200"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Live Engine Status Card + Meta Footer */}
        <div className="p-2.5 space-y-2.5">
          {!sidebarCollapsed ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {lang === "id" ? "Mesin Aktif" : "Engine Active"}
                </span>
                <span className="text-[10px] text-slate-400">3-Layer</span>
              </div>

              <div className="mt-2.5 space-y-1.5 border-t border-slate-800 pt-2 text-slate-400 tabular-nums">
                <div className="flex items-center justify-between">
                  <span>{lang === "id" ? "Ambang Hold / Block" : "Hold / Block"}</span>
                  <span className="font-semibold text-slate-200">65 / 85</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Watchlist / Whitelist</span>
                  <span className="font-semibold text-slate-200">
                    {watchlist.length} / {whitelist.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>ROC-AUC</span>
                  <span className="font-semibold text-emerald-400">
                    {modelArtifact.metadata.metrics.hybrid.roc_auc.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex justify-center py-2"
              title={lang === "id" ? "Mesin Aktif • 3-Lapis Hibrida" : "Engine Active • 3-Layer Hybrid"}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
          )}

          {!sidebarCollapsed && (
            <div className="border-t border-slate-800/80 px-1.5 pt-2 text-[10px] text-slate-500">
              {lang === "id" ? "Simulasi Portfolio" : "Portfolio Prototype"} • 6,000 tx
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Workspace Header (Controls always visible at top-right!) */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-[#0c0c0f] sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="rounded-md border border-zinc-200 p-1.5 text-zinc-600 lg:hidden dark:border-zinc-800 dark:text-zinc-300"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <h1 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {activeNavLabel}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setLang("id")}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                  lang === "id"
                    ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                  lang === "en"
                    ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                EN
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              aria-label="Toggle color theme"
              title={theme === "light" ? "Dark Mode" : "Light Mode"}
              className="rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {theme === "light" ? (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {/* Reset Demo */}
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">{t.resetDemo}</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileNavOpen && (
          <nav
            aria-label="Mobile"
            className="border-b border-zinc-200 bg-white p-2 lg:hidden dark:border-zinc-800 dark:bg-[#0c0c0f]"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium ${
                    active
                      ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {typeof item.badge === "number" && (
                    <span className="text-[11px] text-zinc-500 tabular-nums">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Active View Content */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-5">
          {activeTab === "overview" && (
            <OverviewDashboard
              lang={lang}
              theme={theme}
              artifact={modelArtifact}
              records={records}
              onNavigate={(tab) => setActiveTab(tab)}
              onInspectTransaction={handleInspectFromOverview}
            />
          )}

          {activeTab === "queue" && (
            <AnalystWorkbench
              lang={lang}
              records={records}
              watchlist={watchlist}
              whitelist={whitelist}
              initialSelectedTxId={selectedQueueTxId}
              onConfirmFraud={handleConfirmFraud}
              onMarkSafe={handleMarkSafe}
              onTestInSimulator={handleTestWatchlistInSimulator}
              onImportCsvBatch={handleImportCsvBatch}
            />
          )}

          {activeTab === "dashboard" && (
            <ExecutiveDashboard
              lang={lang}
              theme={theme}
              artifact={modelArtifact}
            />
          )}

          {activeTab === "simulator" && (
            <TransactionSimulator
              lang={lang}
              theme={theme}
              watchlist={watchlist}
              whitelist={whitelist}
              externalPreset={simPresetOverride}
              onClearExternalPreset={clearExternalPreset}
              onPushToQueue={handlePushToQueue}
            />
          )}

          {activeTab === "architecture" && <ArchitectureGuide lang={lang} />}
        </main>
      </div>
    </div>
  );
}

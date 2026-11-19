"use client";

import React from "react";
import { DICT } from "@/lib/i18n";
import type { Language } from "@/lib/types";

interface ArchitectureGuideProps {
  lang: Language;
}

export function ArchitectureGuide({ lang }: ArchitectureGuideProps) {
  const t = DICT[lang];
  const isId = lang === "id";

  return (
    <div className="space-y-6">
      {/* 3-Layer Hybrid Flow */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
        <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t.arch.title}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {t.arch.subtitle}
          </p>
        </div>

        <h3 className="mt-4 mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {t.arch.flowTitle}
        </h3>
        <div className="grid grid-cols-1 divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {[
            {
              step: "01",
              title: isId ? "Konteks & Fitur Perbankan" : "Banking Feature Context",
              desc: isId
                ? "Ekstraksi 12 fitur real-time: rasio nominal vs rata-rata nasabah, velocity 1j/24j, perangkat, jarak, status dorman, fan-in penerima, dan zona structuring."
                : "Extracts 12 real-time features: amount ratio vs baseline, 1h/24h velocity, device, distance, dormant status, recipient fan-in, and structuring bands.",
            },
            {
              step: "02",
              title: isId ? "Lapis 1: Rule Engine (25%)" : "Layer 1: Rule Engine (25%)",
              desc: isId
                ? "9 aturan deterministik perbankan (ATO, Money Mule, Reaktivasi Dorman, Structuring < Rp 25 Jt/100 Jt, Velocity, Watchlist) dengan bobot transparan."
                : "9 deterministic banking rules (ATO, Money Mule, Dormant Reactivation, Structuring < Rp 25M/100M, Velocity, Watchlist) with transparent weights.",
            },
            {
              step: "03",
              title: isId
                ? "Lapis 2 & 3: Isolation Forest + Classifier (75%)"
                : "Layer 2 & 3: Isolation Forest + Classifier (75%)",
              desc: isId
                ? "48 pohon Isolation Forest (15%) mendeteksi anomali baru tanpa label, digabung Regresi Logistik terkalibrasi (60%) + kontribusi log-odds untuk Explainable AI."
                : "48 exact Isolation Forest trees (15%) catch novel anomalies, combined with calibrated Logistic Regression (60%) + log-odds Explainable AI drivers.",
            },
            {
              step: "04",
              title: isId
                ? "Keputusan 4-Tier & Umpan Balik"
                : "4-Tier Decision & Feedback Loop",
              desc: isId
                ? "Approve (0-39), Step-Up Challenge (40-64), Manual Review (65-84), Auto-Block (85-100). Keputusan analis langsung memperbarui Watchlist/Whitelist."
                : "Approve (0-39), Step-Up Challenge (40-64), Manual Review (65-84), Auto-Block (85-100). Analyst verdicts immediately update active Watchlist/Whitelist.",
            },
          ].map((item) => (
            <div key={item.step} className="p-4">
              <div className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                STAGE {item.step}
              </div>
              <div className="mt-1.5 text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                {item.title}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Banking Controls Specification */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {t.arch.pillarsTitle}
        </h3>
        <div className="grid grid-cols-1 divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 md:grid-cols-2 md:divide-x">
          {[
            {
              title: isId
                ? "1. Risiko Counterparty, Rekening Dorman & Structuring"
                : "1. Counterparty Mule, Dormant & Structuring Controls",
              body: isId
                ? "Melacak fan-in rekening penerima (Money Mule), reaktivasi rekening pasif >6 bulan, serta pemecahan nominal di bawah batas otorisasi (Rp 25 Jt / Rp 100 Jt)."
                : "Tracks recipient fan-in (Money Mule), dormant account reactivation (>6 mos), and split transactions just under Rp 25M / Rp 100M authorization limits.",
            },
            {
              title: isId
                ? "2. Metrik Berbasis Nilai Rupiah (Cost-Sensitive)"
                : "2. IDR Value-Based Evaluation (Cost-Sensitive)",
              body: isId
                ? "Menghitung Value Detection Rate (VDR %) dan Customer Insult Rate (%) pada Optimizer Ambang Skor untuk menyeimbangkan penyelamatan kerugian vs kenyamanan nasabah."
                : "Tracks Value Detection Rate (VDR %) and Customer Insult Rate (%) in the interactive threshold optimizer to balance IDR loss prevention against customer friction.",
            },
            {
              title: isId
                ? "3. Matriks Keputusan 4-Tier dengan Step-Up Challenge"
                : "3. 4-Tier Decisioning with Step-Up Authentication",
              body: isId
                ? "Transaksi berisiko sedang (skor 40-64) diarahkan ke Step-Up Challenge (Biometrik / OTP dinamis) sebelum memblokir dana atau membebani antrean analis."
                : "Medium-risk activity (score 40-64) triggers a Step-Up Challenge (Biometric / dynamic OTP) instead of harsh false blocks or analyst queue overload.",
            },
            {
              title: isId
                ? "4. Feedback Loop Analis ke Watchlist & Whitelist"
                : "4. Closed-Loop Analyst Watchlist & Whitelist",
              body: isId
                ? "Saat analis mengonfirmasi fraud di Antrean Investigasi, perangkat & rekening tujuan otomatis masuk ke Blacklist aktif sehingga transaksi berikutnya langsung ditolak."
                : "Confirming fraud in the Analyst Queue immediately blacklists the device & recipient, causing subsequent simulator attempts to hit Rule R9 and auto-block.",
            },
          ].map((card) => (
            <div key={card.title} className="p-4">
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                {card.title}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Python Pipeline & API Specification */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <h3 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t.arch.deployTitle}
          </h3>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            {isId
              ? "Model ML dilatih secara offline di Python (scikit-learn), diekspor menjadi artefak JSON ringan (~123 KB), lalu dijalankan instan di Next.js API (Vercel) tanpa cold-start Python."
              : "Models are trained in Python (scikit-learn), exported to a compact JSON artifact (~123 KB) with exact IsolationForest trees and calibrated weights, and executed inside Vercel serverless routes."}
          </p>
          <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
{`# 1. Train & export ML artifact (Python 3.10+)
pip install -r ml/requirements.txt
python ml/train_and_export.py

# 2. Run Next.js web app locally
npm install
npm run dev

# 3. Deploy free to Vercel (Zero cold-start)
# Push to GitHub -> Import repo in Vercel -> Deploy`}
          </pre>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0c0c0f]">
          <h3 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {isId
              ? "Endpoint API & Keamanan Data Portfolio"
              : "REST API Endpoints & Portfolio Data Safety"}
          </h3>
          <div className="space-y-3 text-xs">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-950">
              <div className="font-semibold text-blue-600 dark:text-blue-400">POST /api/score</div>
              <div className="mt-1 font-sans text-zinc-500 dark:text-zinc-400">
                {isId
                  ? "Mengevaluasi payload transaksi terhadap 3-layer hybrid engine + watchlist/whitelist."
                  : "Scores any transaction payload via the 3-layer hybrid engine + active lists."}
              </div>
              <div className="mt-3 font-semibold text-blue-600 dark:text-blue-400">
                GET /api/model-info
              </div>
              <div className="mt-1 font-sans text-zinc-500 dark:text-zinc-400">
                {isId
                  ? "Mengembalikan metrik model (ROC-AUC, PR-AUC), kurva threshold sweep, dan sampel uji."
                  : "Returns model evaluation metrics, threshold sweep curve, and test samples."}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              {isId
                ? "Catatan Keamanan: Seluruh 6.000 transaksi dalam sistem ini adalah 100% data sintetis untuk keperluan pembelajaran dan simulasi portfolio (tidak menggunakan data nasabah perbankan asli)."
                : "Safety Note: All 6,000 transactions in this prototype are 100% synthetic data generated for learning and portfolio demonstration (no real customer banking records are used)."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import artifactJson from "@/data/model-artifact.json";
import type {
  DecisionTier,
  FeatureContribution,
  ModelArtifact,
  RuleHit,
  ScoringResult,
  TransactionInput,
  TransactionRecord,
  WatchlistEntry,
  WhitelistEntry,
} from "./types";

export const modelArtifact = artifactJson as unknown as ModelArtifact;

function cFactor(n: number): number {
  if (n > 2) {
    return 2.0 * (Math.log(n - 1) + 0.5772156649) - (2.0 * (n - 1)) / n;
  }
  if (n === 2) return 1.0;
  return 0.0;
}

export function isNearStructuringThreshold(amountIdr: number): boolean {
  const in25mBand = amountIdr >= 22_500_000 && amountIdr < 25_000_000;
  const in100mBand = amountIdr >= 90_000_000 && amountIdr < 100_000_000;
  return in25mBand || in100mBand;
}

function buildFeatureVector(input: TransactionInput): number[] {
  const amountIdr = Math.max(Number(input.amount_idr) || 0, 0);
  const customerAvg = Math.max(Number(input.customer_avg_idr) || 0, 50_000);
  const amountRatio = Math.min(amountIdr / customerAvg, 50.0);
  const hour = Number(input.hour_of_day) || 0;
  const isOddHour = hour >= 0 && hour <= 4 ? 1 : 0;
  const nearStructuring = isNearStructuringThreshold(amountIdr) ? 1 : 0;

  return [
    Math.log1p(amountIdr / 1000.0),
    amountRatio,
    Number(input.tx_velocity_1h) || 0,
    Number(input.tx_velocity_24h) || 0,
    isOddHour,
    Number(input.is_new_device) ? 1 : 0,
    Number(input.is_cross_border) ? 1 : 0,
    Math.log1p(Math.max(Number(input.distance_km) || 0, 0)),
    Number(input.is_dormant_account) ? 1 : 0,
    Number(input.recipient_fan_in_24h) || 0,
    Number(input.is_new_recipient) ? 1 : 0,
    nearStructuring,
  ];
}

function scoreIsolationForest(xScaled: number[]): number {
  const { normal_ref, anomaly_ref, exported } = modelArtifact.isolation_forest;
  const { c_max_samples, trees } = exported;

  let totalH = 0;
  for (let t = 0; t < trees.length; t++) {
    const nodes = trees[t];
    let nodeIdx = 0;
    let depth = 0;
    while (true) {
      const [feat, thresh, left, right, nSamples] = nodes[nodeIdx];
      if (left === -1) {
        totalH += depth + cFactor(nSamples);
        break;
      }
      if (xScaled[feat] <= thresh) {
        nodeIdx = left;
      } else {
        nodeIdx = right;
      }
      depth += 1;
    }
  }

  const avgH = totalH / trees.length;
  const rawScoreSample = -Math.pow(2.0, -avgH / c_max_samples);
  const denom = Math.max(normal_ref - anomaly_ref, 1e-6);
  const normalized = ((normal_ref - rawScoreSample) / denom) * 100.0;
  return Math.max(0, Math.min(100, normalized));
}

function evaluateDeterministicRules(
  input: TransactionInput,
  watchlist: WatchlistEntry[]
): { ruleScore: number; triggeredRules: RuleHit[]; watchlistHit: boolean } {
  const amountIdr = Math.max(Number(input.amount_idr) || 0, 0);
  const customerAvg = Math.max(Number(input.customer_avg_idr) || 0, 50_000);
  const amountRatio = amountIdr / customerAvg;
  const hour = Number(input.hour_of_day) || 0;
  const isOddHour = hour >= 0 && hour <= 4;
  const nearStructuring = isNearStructuringThreshold(amountIdr);

  const hits: RuleHit[] = [];
  let score = 0;

  if (input.tx_velocity_1h >= 5) {
    score += 28;
    hits.push({
      ruleId: "R1_VELOCITY_SPIKE",
      weight: 28,
      severity: "HIGH",
      titleId: "Lonjakan Frekuensi Transaksi (Velocity)",
      titleEn: "High-Frequency Velocity Spike",
      detailId: `${input.tx_velocity_1h} transaksi dalam 1 jam (batas normal < 5).`,
      detailEn: `${input.tx_velocity_1h} transactions in 1 hour (threshold >= 5).`,
    });
  }

  if (amountRatio >= 5.0) {
    score += 22;
    hits.push({
      ruleId: "R2_EXTREME_AMOUNT_RATIO",
      weight: 22,
      severity: "MEDIUM",
      titleId: "Lonjakan Nominal Terhadap Profil Nasabah",
      titleEn: "Extreme Amount Deviation vs Baseline",
      detailId: `Nominal ${amountRatio.toFixed(1)}x di atas rata-rata historis nasabah.`,
      detailEn: `Amount is ${amountRatio.toFixed(1)}x above customer historical baseline.`,
    });
  }

  if (input.is_new_device === 1 && (isOddHour || input.distance_km >= 300) && amountRatio >= 2.5) {
    score += 35;
    hits.push({
      ruleId: "R3_ACCOUNT_TAKEOVER",
      weight: 35,
      severity: "HIGH",
      titleId: "Indikasi Pengambilalihan Akun (ATO)",
      titleEn: "Account Takeover (ATO) Signature",
      detailId: "Perangkat baru + jam rawan/lokasi jauh + transfer di atas kebiasaan.",
      detailEn: "Unrecognized device + odd hour/distant geo + elevated transfer ratio.",
    });
  }

  if (input.recipient_fan_in_24h >= 5 && input.is_new_recipient === 1) {
    score += 34;
    hits.push({
      ruleId: "R4_MONEY_MULE_FAN_IN",
      weight: 34,
      severity: "HIGH",
      titleId: "Pola Rekening Penampung (Money Mule Fan-In)",
      titleEn: "Money Mule Counterparty Fan-In",
      detailId: `Rekening tujuan baru menerima dana dari ${input.recipient_fan_in_24h} pengirim berbeda dalam 24 jam.`,
      detailEn: `New recipient received inbound transfers from ${input.recipient_fan_in_24h} distinct senders in 24h.`,
    });
  }

  if (input.is_dormant_account === 1 && amountIdr >= 10_000_000) {
    score += 36;
    hits.push({
      ruleId: "R5_DORMANT_REACTIVATION",
      weight: 36,
      severity: "HIGH",
      titleId: "Reaktivasi Rekening Dorman Bernilai Besar",
      titleEn: "High-Value Dormant Account Reactivation",
      detailId: "Rekening tidak aktif (>6 bulan) tiba-tiba melakukan transaksi >= Rp 10 Jt.",
      detailEn: "Dormant account (>6 months inactive) abruptly initiated a >= Rp 10M transaction.",
    });
  }

  if (nearStructuring && input.tx_velocity_24h >= 3) {
    score += 32;
    hits.push({
      ruleId: "R6_STRUCTURING_SPLIT",
      weight: 32,
      severity: "HIGH",
      titleId: "Indikasi Pemecahan Transaksi (Structuring)",
      titleEn: "Structuring / Split-Threshold Pattern",
      detailId: "Nominal tepat di bawah batas otorisasi (Rp 25 Jt / Rp 100 Jt) dengan frekuensi berulang.",
      detailEn: "Amount sits right below reporting/approval limit (Rp 25M / Rp 100M) with repeated daily attempts.",
    });
  }

  if (input.is_cross_border === 1 && isOddHour) {
    score += 20;
    hits.push({
      ruleId: "R7_CROSS_BORDER_ODD_HOUR",
      weight: 20,
      severity: "MEDIUM",
      titleId: "Transaksi Lintas Negara di Jam Rawan",
      titleEn: "Cross-Border Odd-Hour Activity",
      detailId: `Transaksi lintas negara pada pukul ${String(hour).padStart(2, "0")}:00.`,
      detailEn: `Cross-border activity detected at ${String(hour).padStart(2, "0")}:00 local time.`,
    });
  }

  if (amountIdr >= 50_000_000 && input.is_new_recipient === 1 && input.is_new_device === 1) {
    score += 25;
    hits.push({
      ruleId: "R8_HIGH_VALUE_NEW_RECIPIENT",
      weight: 25,
      severity: "HIGH",
      titleId: "Transfer Besar ke Penerima & Perangkat Baru",
      titleEn: "Large Transfer to New Beneficiary & Device",
      detailId: "Nominal >= Rp 50 Jt ke rekening penerima baru dari perangkat baru.",
      detailEn: "Transfer >= Rp 50M to an unverified beneficiary from a new device.",
    });
  }

  const matchedWatchlist = watchlist.find(
    (entry) =>
      (entry.kind === "RECIPIENT" && entry.value === input.recipient_account) ||
      (entry.kind === "DEVICE" && entry.value === input.device_id)
  );

  if (matchedWatchlist) {
    score += 60;
    hits.push({
      ruleId: "R9_WATCHLIST_HIT",
      weight: 60,
      severity: "HIGH",
      titleId: "Kecocokan Daftar Hitam / Watchlist Aktif",
      titleEn: "Active Blacklist / Watchlist Hit",
      detailId: `${matchedWatchlist.kind === "RECIPIENT" ? "Rekening tujuan" : "Perangkat"} (${matchedWatchlist.value}) sebelumnya dikonfirmasi fraud.`,
      detailEn: `${matchedWatchlist.kind === "RECIPIENT" ? "Recipient account" : "Device"} (${matchedWatchlist.value}) was previously flagged as confirmed fraud.`,
    });
  }

  return {
    ruleScore: Math.min(100, score),
    triggeredRules: hits,
    watchlistHit: Boolean(matchedWatchlist),
  };
}

export function classifyDecision(score: number): DecisionTier {
  if (score >= 85) return "AUTO_BLOCK";
  if (score >= 65) return "MANUAL_REVIEW";
  if (score >= 40) return "STEP_UP_CHALLENGE";
  return "APPROVE";
}

export function evaluateTransaction(
  input: TransactionInput,
  watchlist: WatchlistEntry[] = [],
  whitelist: WhitelistEntry[] = []
): ScoringResult {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();

  const rawFeatures = buildFeatureVector(input);
  const { feature_names, mean, scale } = modelArtifact.scaler;
  const { intercept, coefficients } = modelArtifact.logistic_regression;

  const zFeatures = rawFeatures.map((val, idx) => (val - mean[idx]) / (scale[idx] || 1));

  // Layer 3: Logistic Regression calibrated log-odds + additive feature contributions
  let logit = intercept;
  const featureContributions: FeatureContribution[] = zFeatures.map((z, idx) => {
    const contribution = coefficients[idx] * z;
    logit += contribution;
    return {
      feature: feature_names[idx],
      rawValue: rawFeatures[idx],
      zScore: Number(z.toFixed(3)),
      contribution: Number(contribution.toFixed(3)),
      direction: contribution >= 0 ? "RISK_UP" : "RISK_DOWN",
    };
  });

  featureContributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const rawProb = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, logit))));
  const classifierScore = rawProb * 100;

  // Layer 2: Exact IsolationForest path-length score
  const isolationForestScore = scoreIsolationForest(zFeatures);

  // Layer 1: Deterministic Banking Rule Engine
  const { ruleScore, triggeredRules, watchlistHit } = evaluateDeterministicRules(input, watchlist);

  // Check Analyst Whitelist Override (False Positive Suppression)
  const whitelistHit = whitelist.some(
    (w) => w.accountId === input.account_id && w.deviceId === input.device_id
  );

  let riskScore = Math.round(
    0.25 * ruleScore + 0.15 * isolationForestScore + 0.60 * classifierScore
  );

  if (watchlistHit) {
    riskScore = Math.max(riskScore, 94);
  } else if (whitelistHit) {
    riskScore = Math.min(riskScore, 28);
  }

  riskScore = Math.max(0, Math.min(100, riskScore));

  const amountIdr = Math.max(Number(input.amount_idr) || 0, 0);
  const customerAvg = Math.max(Number(input.customer_avg_idr) || 0, 50_000);

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    riskScore,
    decision: classifyDecision(riskScore),
    layerScores: {
      ruleScore: Number(ruleScore.toFixed(1)),
      isolationForestScore: Number(isolationForestScore.toFixed(1)),
      classifierScore: Number(classifierScore.toFixed(1)),
      rawClassifierProb: Number(rawProb.toFixed(4)),
    },
    triggeredRules,
    featureContributions,
    watchlistHit,
    whitelistHit,
    nearStructuring: isNearStructuringThreshold(amountIdr),
    amountRatio: Number((amountIdr / customerAvg).toFixed(2)),
    latencyMs: Number(Math.max(0.2, end - start).toFixed(2)),
  };
}

export function buildInitialTransactionRecords(
  watchlist: WatchlistEntry[] = [],
  whitelist: WhitelistEntry[] = []
): TransactionRecord[] {
  return modelArtifact.sample_transactions.map((sample) => {
    const scoring = evaluateTransaction(sample, watchlist, whitelist);
    const reviewStatus =
      scoring.decision === "MANUAL_REVIEW" || scoring.decision === "AUTO_BLOCK"
        ? "PENDING"
        : "AUTO_CLEARED";
    return {
      ...sample,
      scoring,
      reviewStatus,
    };
  });
}

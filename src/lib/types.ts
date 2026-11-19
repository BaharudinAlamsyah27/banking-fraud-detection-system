export type Language = "id" | "en";

export type Channel =
  | "MOBILE_BANKING"
  | "CARD_POS"
  | "QRIS_MERCHANT"
  | "INTERNET_BANKING"
  | "ATM_BRANCH";

export type DecisionTier =
  | "APPROVE"
  | "STEP_UP_CHALLENGE"
  | "MANUAL_REVIEW"
  | "AUTO_BLOCK";

export type ReviewStatus =
  | "PENDING"
  | "CONFIRMED_FRAUD"
  | "MARKED_SAFE"
  | "AUTO_CLEARED";

export interface TransactionInput {
  tx_id?: string;
  account_id: string;
  recipient_account: string;
  device_id: string;
  channel: Channel;
  merchant_category: string;
  city: string;
  amount_idr: number;
  customer_avg_idr: number;
  hour_of_day: number;
  tx_velocity_1h: number;
  tx_velocity_24h: number;
  is_new_device: number;
  is_cross_border: number;
  distance_km: number;
  is_dormant_account: number;
  recipient_fan_in_24h: number;
  is_new_recipient: number;
}

export interface RuleHit {
  ruleId: string;
  weight: number;
  titleId: string;
  titleEn: string;
  detailId: string;
  detailEn: string;
  severity: "HIGH" | "MEDIUM";
}

export interface FeatureContribution {
  feature: string;
  rawValue: number;
  zScore: number;
  contribution: number;
  direction: "RISK_UP" | "RISK_DOWN";
}

export interface ScoringResult {
  riskScore: number;
  decision: DecisionTier;
  layerScores: {
    ruleScore: number;
    isolationForestScore: number;
    classifierScore: number;
    rawClassifierProb: number;
  };
  triggeredRules: RuleHit[];
  featureContributions: FeatureContribution[];
  watchlistHit: boolean;
  whitelistHit: boolean;
  nearStructuring: boolean;
  amountRatio: number;
  latencyMs: number;
}

export interface SampleTransactionRow extends TransactionInput {
  tx_id: string;
  timestamp: string;
  scenario: string;
  ground_truth_fraud: number;
}

export interface TransactionRecord extends SampleTransactionRow {
  scoring: ScoringResult;
  reviewStatus: ReviewStatus;
  analystNote?: string;
}

export interface WatchlistEntry {
  id: string;
  kind: "RECIPIENT" | "DEVICE";
  value: string;
  reason: string;
  addedAt: string;
}

export interface WhitelistEntry {
  id: string;
  accountId: string;
  deviceId: string;
  addedAt: string;
}

export interface ThresholdPoint {
  threshold: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  insult_rate: number;
  value_detection_rate: number;
  fraud_value_saved_idr: number;
  fraud_value_missed_idr: number;
  alerts_generated: number;
}

export interface ChannelStat {
  channel: Channel;
  total_tx: number;
  fraud_tx: number;
  fraud_rate: number;
  total_volume_idr: number;
  fraud_volume_idr: number;
}

export interface ScenarioStat {
  scenario: string;
  count: number;
  avg_amount_idr: number;
  total_exposure_idr: number;
}

export interface FeatureImportanceItem {
  feature: string;
  rf_importance: number;
  lr_coef: number;
}

export interface ModelArtifact {
  metadata: {
    model_version: string;
    generated_at: string;
    dataset_summary: {
      total_transactions: number;
      train_size: number;
      test_size: number;
      fraud_count: number;
      fraud_rate: number;
      total_test_volume_idr: number;
      total_test_fraud_idr: number;
    };
    metrics: {
      hybrid: {
        roc_auc: number;
        pr_auc: number;
        precision_at_65: number;
        recall_at_65: number;
        f1_at_65: number;
        value_detection_rate_at_65: number;
      };
      logistic_regression: {
        roc_auc: number;
        pr_auc: number;
      };
      random_forest: {
        roc_auc: number;
        pr_auc: number;
      };
    };
  };
  scaler: {
    feature_names: string[];
    mean: number[];
    scale: number[];
  };
  logistic_regression: {
    intercept: number;
    coefficients: number[];
  };
  isolation_forest: {
    normal_ref: number;
    anomaly_ref: number;
    exported: {
      max_samples: number;
      c_max_samples: number;
      trees: number[][][];
    };
  };
  feature_importances: FeatureImportanceItem[];
  threshold_sweep: ThresholdPoint[];
  channel_stats: ChannelStat[];
  scenario_stats: ScenarioStat[];
  sample_transactions: SampleTransactionRow[];
}

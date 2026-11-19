"""
Enterprise Banking Fraud Detection - Synthetic Data Generator, Model Training & Export Pipeline
----------------------------------------------------------------------------------------------
Generates 6,000 realistic multi-channel banking transactions (100% synthetic, safe for portfolio),
trains IsolationForest (unsupervised), LogisticRegression (calibrated + explainable), and
RandomForestClassifier (benchmark), validates exact IsolationForest tree parity, computes
cost-sensitive banking threshold sweeps in IDR, and exports `src/data/model-artifact.json`.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

CHANNELS = [
    "MOBILE_BANKING",
    "CARD_POS",
    "QRIS_MERCHANT",
    "INTERNET_BANKING",
    "ATM_BRANCH",
]

FRAUD_SCENARIOS = [
    "ACCOUNT_TAKEOVER",
    "MONEY_MULE_FAN_IN",
    "DORMANT_REACTIVATION",
    "STRUCTURING_SPLIT",
    "VELOCITY_ATTACK",
]

FEATURE_NAMES = [
    "log_amount",
    "amount_ratio",
    "tx_velocity_1h",
    "tx_velocity_24h",
    "is_odd_hour",
    "is_new_device",
    "is_cross_border",
    "log_distance_km",
    "is_dormant_account",
    "recipient_fan_in_24h",
    "is_new_recipient",
    "near_structuring_threshold",
]

CITIES_LOCAL = [
    "Jakarta",
    "Surabaya",
    "Bandung",
    "Semarang",
    "Solo",
    "Yogyakarta",
    "Medan",
    "Makassar",
]
CITIES_FOREIGN = ["Singapore", "Kuala Lumpur", "Hong Kong", "Bangkok", "Tokyo", "London"]
MERCHANT_CATEGORIES = [
    "Retail & Groceries",
    "Peer Transfer",
    "E-Commerce",
    "Bills & Utilities",
    "Travel & Airlines",
    "Jewelry & Luxury",
    "Digital Goods / Gaming",
    "Cash Withdrawal",
]


def _c_factor(n: int) -> float:
    if n > 2:
        return 2.0 * (math.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)
    if n == 2:
        return 1.0
    return 0.0


def compute_near_structuring(amount_idr: float) -> int:
    in_25m_band = 22_500_000 <= amount_idr < 25_000_000
    in_100m_band = 90_000_000 <= amount_idr < 100_000_000
    return 1 if (in_25m_band or in_100m_band) else 0


def build_feature_vector(row: dict[str, Any]) -> list[float]:
    amount_idr = float(row["amount_idr"])
    customer_avg = max(float(row["customer_avg_idr"]), 50_000.0)
    amount_ratio = min(amount_idr / customer_avg, 50.0)
    hour_of_day = int(row["hour_of_day"])
    is_odd_hour = 1 if 0 <= hour_of_day <= 4 else 0
    near_structuring = compute_near_structuring(amount_idr)
    return [
        math.log1p(amount_idr / 1000.0),
        amount_ratio,
        float(row["tx_velocity_1h"]),
        float(row["tx_velocity_24h"]),
        float(is_odd_hour),
        float(row["is_new_device"]),
        float(row["is_cross_border"]),
        math.log1p(max(float(row["distance_km"]), 0.0)),
        float(row["is_dormant_account"]),
        float(row["recipient_fan_in_24h"]),
        float(row["is_new_recipient"]),
        float(near_structuring),
    ]


def generate_synthetic_banking_data(n_rows: int = 6000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    base_time = datetime(2026, 11, 10, 8, 0, 0, tzinfo=timezone.utc)

    n_fraud = int(round(n_rows * 0.06))  # 360 fraud transactions (realistic imbalanced banking set)
    n_normal = n_rows - n_fraud

    fraud_scenarios = FRAUD_SCENARIOS

    records: list[dict[str, Any]] = []

    # 1. Generate NORMAL transactions
    for i in range(n_normal):
        channel = str(rng.choice(CHANNELS, p=[0.34, 0.22, 0.24, 0.12, 0.08]))
        cust_num = int(rng.integers(1001, 2600))
        account_id = f"ACC-{cust_num}"
        device_id = f"DEV-{cust_num}-A"
        recipient_id = f"ACC-{int(rng.integers(3000, 9999))}"

        if channel == "QRIS_MERCHANT":
            customer_avg = float(rng.uniform(80_000, 750_000))
            amount_idr = float(np.clip(rng.lognormal(mean=np.log(customer_avg), sigma=0.55), 15_000, 9_500_000))
        elif channel == "CARD_POS":
            customer_avg = float(rng.uniform(250_000, 2_800_000))
            amount_idr = float(np.clip(rng.lognormal(mean=np.log(customer_avg), sigma=0.6), 30_000, 28_000_000))
        elif channel == "ATM_BRANCH":
            customer_avg = float(rng.uniform(500_000, 3_500_000))
            amount_idr = float(round(np.clip(rng.uniform(100_000, 10_000_000), 100_000, 15_000_000) / 50_000) * 50_000)
        elif channel == "INTERNET_BANKING":
            customer_avg = float(rng.uniform(1_500_000, 15_000_000))
            amount_idr = float(np.clip(rng.lognormal(mean=np.log(customer_avg), sigma=0.65), 100_000, 85_000_000))
        else:  # MOBILE_BANKING
            customer_avg = float(rng.uniform(350_000, 4_500_000))
            amount_idr = float(np.clip(rng.lognormal(mean=np.log(customer_avg), sigma=0.6), 25_000, 35_000_000))

        # Occasional realistic false-positive boundary cases in normal traffic (payday, travel, merchant fan-in, legitimate large payment)
        is_borderline = rng.random() < 0.065
        if is_borderline and rng.random() < 0.30:
            amount_idr = float(rng.uniform(22_600_000, 24_800_000))
        elif is_borderline and rng.random() < 0.35:
            amount_idr = float(customer_avg * rng.uniform(3.5, 7.5))
        hour_of_day = int(rng.integers(0, 5)) if (is_borderline and rng.random() < 0.45) else int(rng.integers(6, 23))
        tx_velocity_1h = (
            int(rng.integers(4, 8))
            if (is_borderline and rng.random() < 0.35)
            else int(rng.choice([1, 1, 1, 2, 2, 3, 4], p=[0.48, 0.2, 0.12, 0.1, 0.05, 0.03, 0.02]))
        )
        tx_velocity_24h = tx_velocity_1h + int(rng.integers(0, 5))
        is_new_device = 1 if (rng.random() < (0.30 if is_borderline else 0.04)) else 0
        is_cross_border = 1 if (rng.random() < (0.25 if is_borderline else 0.02)) else 0
        distance_km = float(rng.uniform(250, 2200)) if is_cross_border else float(rng.uniform(0, 45))
        is_dormant_account = 1 if rng.random() < (0.08 if is_borderline else 0.01) else 0
        recipient_fan_in_24h = int(rng.integers(2, 7)) if (is_borderline and rng.random() < 0.4) else int(rng.integers(1, 4))
        is_new_recipient = 1 if rng.random() < (0.45 if is_borderline else 0.24) else 0
        city = str(rng.choice(CITIES_FOREIGN if is_cross_border else CITIES_LOCAL))
        merchant_cat = str(rng.choice(MERCHANT_CATEGORIES[:6]))

        ts = base_time + timedelta(minutes=int(rng.integers(0, 60 * 24 * 14)))
        ts = ts.replace(hour=hour_of_day)

        records.append(
            {
                "tx_id": f"TX-{100000 + len(records)}",
                "timestamp": ts.isoformat(),
                "account_id": account_id,
                "recipient_account": recipient_id,
                "device_id": f"DEV-{cust_num}-NEW" if is_new_device else device_id,
                "channel": channel,
                "merchant_category": merchant_cat,
                "city": city,
                "amount_idr": round(amount_idr, -3),
                "customer_avg_idr": round(customer_avg, -3),
                "hour_of_day": hour_of_day,
                "tx_velocity_1h": tx_velocity_1h,
                "tx_velocity_24h": tx_velocity_24h,
                "is_new_device": is_new_device,
                "is_cross_border": is_cross_border,
                "distance_km": round(distance_km, 1),
                "is_dormant_account": is_dormant_account,
                "recipient_fan_in_24h": recipient_fan_in_24h,
                "is_new_recipient": is_new_recipient,
                "scenario": "NORMAL",
                "is_fraud": 0,
            }
        )

    # 2. Generate FRAUD transactions across 5 banking scenarios
    per_scenario = n_fraud // len(fraud_scenarios)
    for s_idx, scenario in enumerate(fraud_scenarios):
        count = per_scenario + (n_fraud % len(fraud_scenarios) if s_idx == 0 else 0)
        for _ in range(count):
            cust_num = int(rng.integers(1001, 2600))
            account_id = f"ACC-{cust_num}"
            recipient_id = f"MULE-{int(rng.integers(100, 999))}"
            is_borderline_fraud = rng.random() < 0.20  # Stealthy fraud cases that partially mimic normal behavior

            if scenario == "ACCOUNT_TAKEOVER":
                channel = str(rng.choice(["MOBILE_BANKING", "INTERNET_BANKING"], p=[0.65, 0.35]))
                customer_avg = float(rng.uniform(400_000, 3_500_000))
                mult = rng.uniform(1.8, 3.6) if is_borderline_fraud else rng.uniform(4.5, 16.0)
                amount_idr = min(customer_avg * mult, 185_000_000)
                hour_of_day = int(rng.integers(8, 21)) if is_borderline_fraud else int(rng.choice([0, 1, 2, 3, 4, 23]))
                tx_velocity_1h = int(rng.integers(1, 4)) if is_borderline_fraud else int(rng.integers(2, 6))
                tx_velocity_24h = tx_velocity_1h + int(rng.integers(1, 5))
                is_new_device = 0 if (is_borderline_fraud and rng.random() < 0.4) else 1
                is_cross_border = 0 if is_borderline_fraud else (1 if rng.random() < 0.6 else 0)
                distance_km = float(rng.uniform(10, 150)) if is_borderline_fraud else float(rng.uniform(300, 3800))
                is_dormant_account = 0
                recipient_fan_in_24h = int(rng.integers(1, 5))
                is_new_recipient = 1
                device_id = f"DEV-UNK-{int(rng.integers(1000, 9999))}"
                merchant_cat = "Peer Transfer"
            elif scenario == "MONEY_MULE_FAN_IN":
                channel = str(rng.choice(["MOBILE_BANKING", "QRIS_MERCHANT", "INTERNET_BANKING"], p=[0.55, 0.25, 0.20]))
                customer_avg = float(rng.uniform(500_000, 4_000_000))
                amount_idr = float(rng.uniform(900_000, 22_000_000))
                hour_of_day = int(rng.integers(0, 24))
                tx_velocity_1h = int(rng.integers(1, 5))
                tx_velocity_24h = tx_velocity_1h + int(rng.integers(1, 8))
                is_new_device = 1 if rng.random() < 0.35 else 0
                is_cross_border = 0
                distance_km = float(rng.uniform(5, 180))
                is_dormant_account = 0
                recipient_fan_in_24h = int(rng.integers(3, 6)) if is_borderline_fraud else int(rng.integers(5, 22))
                is_new_recipient = 0 if (is_borderline_fraud and rng.random() < 0.3) else 1
                device_id = f"DEV-{cust_num}-{'X' if is_new_device else 'A'}"
                merchant_cat = "Peer Transfer"
            elif scenario == "DORMANT_REACTIVATION":
                channel = str(rng.choice(["ATM_BRANCH", "INTERNET_BANKING", "MOBILE_BANKING"], p=[0.35, 0.40, 0.25]))
                customer_avg = float(rng.uniform(300_000, 2_200_000))
                amount_idr = float(rng.uniform(4_500_000, 12_000_000)) if is_borderline_fraud else float(rng.uniform(12_000_000, 145_000_000))
                hour_of_day = int(rng.choice([1, 2, 3, 9, 14, 22]))
                tx_velocity_1h = int(rng.integers(1, 4))
                tx_velocity_24h = tx_velocity_1h + int(rng.integers(0, 3))
                is_new_device = 1 if rng.random() < 0.65 else 0
                is_cross_border = 1 if rng.random() < 0.2 else 0
                distance_km = float(rng.uniform(20, 950))
                is_dormant_account = 1
                recipient_fan_in_24h = int(rng.integers(1, 5))
                is_new_recipient = 1
                device_id = f"DEV-DRM-{int(rng.integers(100, 999))}"
                merchant_cat = "Cash Withdrawal" if channel == "ATM_BRANCH" else "Peer Transfer"
            elif scenario == "STRUCTURING_SPLIT":
                channel = str(rng.choice(["MOBILE_BANKING", "INTERNET_BANKING", "ATM_BRANCH"], p=[0.45, 0.40, 0.15]))
                customer_avg = float(rng.uniform(1_500_000, 9_500_000))
                if rng.random() < 0.72:
                    amount_idr = float(rng.uniform(22_700_000, 24_950_000))
                else:
                    amount_idr = float(rng.uniform(91_000_000, 99_800_000))
                hour_of_day = int(rng.integers(8, 23))
                tx_velocity_1h = int(rng.integers(1, 5))
                tx_velocity_24h = int(rng.integers(2, 4)) if is_borderline_fraud else int(rng.integers(4, 11))
                is_new_device = 1 if rng.random() < 0.25 else 0
                is_cross_border = 0
                distance_km = float(rng.uniform(2, 95))
                is_dormant_account = 0
                recipient_fan_in_24h = int(rng.integers(1, 7))
                is_new_recipient = 1 if rng.random() < 0.65 else 0
                device_id = f"DEV-{cust_num}-A"
                merchant_cat = "Peer Transfer"
            else:  # VELOCITY_ATTACK
                channel = str(rng.choice(["CARD_POS", "QRIS_MERCHANT", "MOBILE_BANKING"], p=[0.45, 0.35, 0.20]))
                customer_avg = float(rng.uniform(200_000, 2_000_000))
                amount_idr = float(rng.uniform(250_000, 5_500_000))
                hour_of_day = int(rng.choice([0, 1, 2, 3, 4, 13, 21]))
                tx_velocity_1h = int(rng.integers(4, 6)) if is_borderline_fraud else int(rng.integers(6, 17))
                tx_velocity_24h = tx_velocity_1h + int(rng.integers(2, 12))
                is_new_device = 1 if rng.random() < 0.5 else 0
                is_cross_border = 1 if rng.random() < 0.35 else 0
                distance_km = float(rng.uniform(15, 2200))
                is_dormant_account = 0
                recipient_fan_in_24h = int(rng.integers(1, 5))
                is_new_recipient = 1 if rng.random() < 0.7 else 0
                device_id = f"DEV-VEL-{int(rng.integers(100, 999))}"
                merchant_cat = str(rng.choice(["E-Commerce", "Digital Goods / Gaming", "Jewelry & Luxury"]))

            city = str(rng.choice(CITIES_FOREIGN if is_cross_border else CITIES_LOCAL))
            ts = base_time + timedelta(minutes=int(rng.integers(0, 60 * 24 * 14)))
            ts = ts.replace(hour=hour_of_day)

            records.append(
                {
                    "tx_id": f"TX-{100000 + len(records)}",
                    "timestamp": ts.isoformat(),
                    "account_id": account_id,
                    "recipient_account": recipient_id,
                    "device_id": device_id,
                    "channel": channel,
                    "merchant_category": merchant_cat,
                    "city": city,
                    "amount_idr": round(amount_idr, -3),
                    "customer_avg_idr": round(customer_avg, -3),
                    "hour_of_day": hour_of_day,
                    "tx_velocity_1h": tx_velocity_1h,
                    "tx_velocity_24h": tx_velocity_24h,
                    "is_new_device": is_new_device,
                    "is_cross_border": is_cross_border,
                    "distance_km": round(distance_km, 1),
                    "is_dormant_account": is_dormant_account,
                    "recipient_fan_in_24h": recipient_fan_in_24h,
                    "is_new_recipient": is_new_recipient,
                    "scenario": scenario,
                    "is_fraud": 1,
                }
            )

    df = pd.DataFrame(records).sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return df


def evaluate_rules_python(row: dict[str, Any]) -> tuple[float, list[str]]:
    amount_idr = float(row["amount_idr"])
    customer_avg = max(float(row["customer_avg_idr"]), 50_000.0)
    amount_ratio = amount_idr / customer_avg
    hour = int(row["hour_of_day"])
    is_odd_hour = 0 <= hour <= 4
    near_structuring = compute_near_structuring(amount_idr) == 1

    hits: list[str] = []
    score = 0.0

    if int(row["tx_velocity_1h"]) >= 5:
        hits.append("R1_VELOCITY_SPIKE")
        score += 28
    if amount_ratio >= 5.0:
        hits.append("R2_EXTREME_AMOUNT_RATIO")
        score += 22
    if int(row["is_new_device"]) == 1 and (is_odd_hour or float(row["distance_km"]) >= 300.0) and amount_ratio >= 2.5:
        hits.append("R3_ACCOUNT_TAKEOVER")
        score += 35
    if int(row["recipient_fan_in_24h"]) >= 5 and int(row["is_new_recipient"]) == 1:
        hits.append("R4_MONEY_MULE_FAN_IN")
        score += 34
    if int(row["is_dormant_account"]) == 1 and amount_idr >= 10_000_000:
        hits.append("R5_DORMANT_REACTIVATION")
        score += 36
    if near_structuring and int(row["tx_velocity_24h"]) >= 3:
        hits.append("R6_STRUCTURING_SPLIT")
        score += 32
    if int(row["is_cross_border"]) == 1 and is_odd_hour:
        hits.append("R7_CROSS_BORDER_ODD_HOUR")
        score += 20
    if amount_idr >= 50_000_000 and int(row["is_new_recipient"]) == 1 and int(row["is_new_device"]) == 1:
        hits.append("R8_HIGH_VALUE_NEW_RECIPIENT")
        score += 25

    return min(100.0, score), hits


def export_isolation_forest(iso: IsolationForest) -> dict[str, Any]:
    """Serialize sklearn IsolationForest trees into compact JSON arrays for exact TS execution."""
    trees = []
    max_samples = int(iso._max_samples)
    for est, feat_idx in zip(iso.estimators_, iso.estimators_features_):
        tree = est.tree_
        feat_map = [int(f) for f in feat_idx]
        nodes = []
        for idx in range(tree.node_count):
            left = int(tree.children_left[idx])
            right = int(tree.children_right[idx])
            raw_feat = int(tree.feature[idx])
            mapped_feat = feat_map[raw_feat] if raw_feat >= 0 else -1
            thresh = round(float(tree.threshold[idx]), 6) if raw_feat >= 0 else 0.0
            n_samples = int(tree.n_node_samples[idx])
            nodes.append([mapped_feat, thresh, left, right, n_samples])
        trees.append(nodes)
    return {
        "max_samples": max_samples,
        "c_max_samples": round(_c_factor(max_samples), 8),
        "trees": trees,
    }


def score_exported_iforest(x_scaled: np.ndarray, exported: dict[str, Any]) -> np.ndarray:
    """Exact verification of exported IsolationForest tree JSON against sklearn score_samples."""
    c_max = exported["c_max_samples"]
    trees = exported["trees"]
    scores = np.zeros(x_scaled.shape[0], dtype=np.float64)
    for row_idx in range(x_scaled.shape[0]):
        x = x_scaled[row_idx]
        total_h = 0.0
        for nodes in trees:
            node_idx = 0
            depth = 0
            while True:
                feat, thresh, left, right, n_samples = nodes[node_idx]
                if left == -1:
                    total_h += depth + _c_factor(n_samples)
                    break
                if x[feat] <= thresh:
                    node_idx = left
                else:
                    node_idx = right
                depth += 1
        avg_h = total_h / len(trees)
        scores[row_idx] = -(2.0 ** (-avg_h / c_max))
    return scores


def main() -> None:
    print("Generating synthetic multi-channel banking dataset (6,000 rows)...")
    df = generate_synthetic_banking_data(n_rows=6000, seed=42)

    X = np.array([build_feature_vector(row) for row in df.to_dict("records")], dtype=np.float64)
    y = df["is_fraud"].to_numpy(dtype=np.int32)

    indices = np.arange(len(df))
    idx_train, idx_test = train_test_split(indices, test_size=0.25, stratify=y, random_state=42)

    X_train, X_test = X[idx_train], X[idx_test]
    y_train, y_test = y[idx_train], y[idx_test]

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("Training Layer 2: IsolationForest (unsupervised anomaly detector)...")
    iso_forest = IsolationForest(
        n_estimators=48,
        max_samples=128,
        contamination=0.06,
        random_state=42,
    )
    iso_forest.fit(X_train_scaled)

    exported_iforest = export_isolation_forest(iso_forest)
    py_iso_raw = iso_forest.score_samples(X_test_scaled)
    manual_iso_raw = score_exported_iforest(X_test_scaled, exported_iforest)
    max_diff = float(np.max(np.abs(py_iso_raw - manual_iso_raw)))
    print(f"IsolationForest exact tree export parity max diff: {max_diff:.2e}")
    assert max_diff < 1e-4, f"IsolationForest export mismatch: {max_diff}"

    # Calibrate raw score_samples to 0..100 anomaly risk scale using training distribution quantiles
    train_iso_raw = iso_forest.score_samples(X_train_scaled)
    iso_normal_ref = float(np.percentile(train_iso_raw, 90))
    iso_anomaly_ref = float(np.percentile(train_iso_raw, 2))

    def raw_iso_to_score(raw_arr: np.ndarray) -> np.ndarray:
        denom = max(iso_normal_ref - iso_anomaly_ref, 1e-6)
        return np.clip(((iso_normal_ref - raw_arr) / denom) * 100.0, 0.0, 100.0)

    print("Training Layer 3: LogisticRegression (calibrated) & RandomForestClassifier (benchmark)...")
    log_reg = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    log_reg.fit(X_train_scaled, y_train)

    rf_clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        class_weight="balanced",
        random_state=42,
    )
    rf_clf.fit(X_train_scaled, y_train)

    # Evaluate supervised models on test set
    lr_probs = log_reg.predict_proba(X_test_scaled)[:, 1]
    rf_probs = rf_clf.predict_proba(X_test_scaled)[:, 1]

    # Compute Hybrid Score on test set (identical to TypeScript engine)
    test_records = df.iloc[idx_test].to_dict("records")
    test_iso_scores = raw_iso_to_score(py_iso_raw)
    test_rule_scores = np.array([evaluate_rules_python(r)[0] for r in test_records], dtype=np.float64)
    test_clf_scores = lr_probs * 100.0
    test_hybrid_raw = np.clip(
        0.25 * test_rule_scores + 0.15 * test_iso_scores + 0.60 * test_clf_scores,
        0.0,
        100.0,
    )
    test_hybrid_scores = np.round(test_hybrid_raw)
    test_hybrid_probs = test_hybrid_raw / 100.0
    test_amounts = np.array([float(r["amount_idr"]) for r in test_records], dtype=np.float64)

    # Default operational hold/block threshold = 65 (MANUAL_REVIEW + AUTO_BLOCK)
    default_preds = (test_hybrid_scores >= 65).astype(int)
    total_fraud_val = float(test_amounts[y_test == 1].sum())
    saved_fraud_val = float(test_amounts[(y_test == 1) & (default_preds == 1)].sum())

    # Threshold sweep table (10..95 step 5)
    threshold_sweep: list[dict[str, Any]] = []
    for thr in range(10, 100, 5):
        preds = (test_hybrid_scores >= thr).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_test, preds, labels=[0, 1]).ravel()
        prec = float(precision_score(y_test, preds, zero_division=0))
        rec = float(recall_score(y_test, preds, zero_division=0))
        f1 = float(f1_score(y_test, preds, zero_division=0))
        insult_rate = float(fp / max(fp + tn, 1))
        val_saved = float(test_amounts[(y_test == 1) & (preds == 1)].sum())
        val_missed = float(test_amounts[(y_test == 1) & (preds == 0)].sum())
        vdr = float(val_saved / max(total_fraud_val, 1.0))
        threshold_sweep.append(
            {
                "threshold": thr,
                "tp": int(tp),
                "fp": int(fp),
                "tn": int(tn),
                "fn": int(fn),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1": round(f1, 4),
                "insult_rate": round(insult_rate, 4),
                "value_detection_rate": round(vdr, 4),
                "fraud_value_saved_idr": round(val_saved),
                "fraud_value_missed_idr": round(val_missed),
                "alerts_generated": int(tp + fp),
            }
        )

    # Channel & Scenario breakdown across full dataset
    channel_stats = []
    for ch in CHANNELS:
        sub = df[df["channel"] == ch]
        channel_stats.append(
            {
                "channel": ch,
                "total_tx": int(len(sub)),
                "fraud_tx": int(sub["is_fraud"].sum()),
                "fraud_rate": round(float(sub["is_fraud"].mean()), 4),
                "total_volume_idr": round(float(sub["amount_idr"].sum())),
                "fraud_volume_idr": round(float(sub[sub["is_fraud"] == 1]["amount_idr"].sum())),
            }
        )

    scenario_stats = []
    for sc in FRAUD_SCENARIOS:
        sub = df[df["scenario"] == sc]
        scenario_stats.append(
            {
                "scenario": sc,
                "count": int(len(sub)),
                "avg_amount_idr": round(float(sub["amount_idr"].mean())),
                "total_exposure_idr": round(float(sub["amount_idr"].sum())),
            }
        )

    # Curate 120 realistic transactions from test set (include high-risk, medium-risk, and normal)
    test_df = df.iloc[idx_test].copy().reset_index(drop=True)
    test_df["hybrid_score"] = test_hybrid_scores
    test_df["rule_score"] = np.round(test_rule_scores, 1)
    test_df["iso_score"] = np.round(test_iso_scores, 1)
    test_df["clf_score"] = np.round(test_clf_scores, 1)

    fraud_sample = test_df[test_df["is_fraud"] == 1].head(48)
    borderline_sample = test_df[(test_df["is_fraud"] == 0) & (test_df["hybrid_score"] >= 38)].head(24)
    normal_sample = test_df[(test_df["is_fraud"] == 0) & (test_df["hybrid_score"] < 38)].head(48)
    curated_df = (
        pd.concat([fraud_sample, borderline_sample, normal_sample])
        .drop_duplicates(subset=["tx_id"])
        .sort_values(by="hybrid_score", ascending=False)
        .head(120)
    )

    sample_transactions = []
    for row in curated_df.to_dict("records"):
        sample_transactions.append(
            {
                "tx_id": row["tx_id"],
                "timestamp": row["timestamp"],
                "account_id": row["account_id"],
                "recipient_account": row["recipient_account"],
                "device_id": row["device_id"],
                "channel": row["channel"],
                "merchant_category": row["merchant_category"],
                "city": row["city"],
                "amount_idr": int(row["amount_idr"]),
                "customer_avg_idr": int(row["customer_avg_idr"]),
                "hour_of_day": int(row["hour_of_day"]),
                "tx_velocity_1h": int(row["tx_velocity_1h"]),
                "tx_velocity_24h": int(row["tx_velocity_24h"]),
                "is_new_device": int(row["is_new_device"]),
                "is_cross_border": int(row["is_cross_border"]),
                "distance_km": float(row["distance_km"]),
                "is_dormant_account": int(row["is_dormant_account"]),
                "recipient_fan_in_24h": int(row["recipient_fan_in_24h"]),
                "is_new_recipient": int(row["is_new_recipient"]),
                "scenario": row["scenario"],
                "ground_truth_fraud": int(row["is_fraud"]),
            }
        )

    feature_importances = [
        {
            "feature": name,
            "rf_importance": round(float(rf_imp), 4),
            "lr_coef": round(float(lr_coef), 4),
        }
        for name, rf_imp, lr_coef in zip(
            FEATURE_NAMES,
            rf_clf.feature_importances_,
            log_reg.coef_[0],
        )
    ]
    feature_importances.sort(key=lambda item: item["rf_importance"], reverse=True)

    artifact = {
        "metadata": {
            "model_version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "dataset_summary": {
                "total_transactions": int(len(df)),
                "train_size": int(len(idx_train)),
                "test_size": int(len(idx_test)),
                "fraud_count": int(y.sum()),
                "fraud_rate": round(float(y.mean()), 4),
                "total_test_volume_idr": round(float(test_amounts.sum())),
                "total_test_fraud_idr": round(total_fraud_val),
            },
            "metrics": {
                "hybrid": {
                    "roc_auc": round(float(roc_auc_score(y_test, test_hybrid_probs)), 4),
                    "pr_auc": round(float(average_precision_score(y_test, test_hybrid_probs)), 4),
                    "precision_at_65": round(float(precision_score(y_test, default_preds, zero_division=0)), 4),
                    "recall_at_65": round(float(recall_score(y_test, default_preds, zero_division=0)), 4),
                    "f1_at_65": round(float(f1_score(y_test, default_preds, zero_division=0)), 4),
                    "value_detection_rate_at_65": round(saved_fraud_val / max(total_fraud_val, 1.0), 4),
                },
                "logistic_regression": {
                    "roc_auc": round(float(roc_auc_score(y_test, lr_probs)), 4),
                    "pr_auc": round(float(average_precision_score(y_test, lr_probs)), 4),
                },
                "random_forest": {
                    "roc_auc": round(float(roc_auc_score(y_test, rf_probs)), 4),
                    "pr_auc": round(float(average_precision_score(y_test, rf_probs)), 4),
                },
            },
        },
        "scaler": {
            "feature_names": FEATURE_NAMES,
            "mean": [round(float(v), 6) for v in scaler.mean_],
            "scale": [round(float(v), 6) for v in scaler.scale_],
        },
        "logistic_regression": {
            "intercept": round(float(log_reg.intercept_[0]), 6),
            "coefficients": [round(float(v), 6) for v in log_reg.coef_[0]],
        },
        "isolation_forest": {
            "normal_ref": round(iso_normal_ref, 6),
            "anomaly_ref": round(iso_anomaly_ref, 6),
            "exported": exported_iforest,
        },
        "feature_importances": feature_importances,
        "threshold_sweep": threshold_sweep,
        "channel_stats": channel_stats,
        "scenario_stats": scenario_stats,
        "sample_transactions": sample_transactions,
    }

    output_path = Path(__file__).resolve().parent.parent / "src" / "data" / "model-artifact.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(artifact, f, separators=(",", ":"))

    size_kb = output_path.stat().st_size / 1024.0
    print(f"Exported artifact to {output_path} ({size_kb:.1f} KB)")
    print("Hybrid Metrics (Test Split @ threshold 65):")
    print(json.dumps(artifact["metadata"]["metrics"], indent=2))


if __name__ == "__main__":
    main()

# SentinelBank FDS — Hybrid Banking Fraud Detection System

> **Portfolio & Learning Simulation Disclaimer:**  
> Proyek ini adalah **prototipe/simulasi untuk pembelajaran dan portfolio**. Seluruh 6.000 data transaksi dihasilkan secara sintetis (*100% synthetic data*) tanpa menggunakan data nasabah asli perbankan atau BPRS mana pun.

Sistem **Deteksi Kecurangan di Perbankan (Banking Fraud Detection System)** berbasis arsitektur **3-Layer Hybrid Engine**, dilengkapi dukungan **2 Bahasa (`ID | EN`)**, **Cost-Sensitive Financial Impact Optimizer**, **Live Transaction Simulator**, dan **Fraud Analyst Investigation Workbench** dengan *feedback loop* ke Watchlist/Whitelist.

---

## Arsitektur Sistem (3-Layer Hybrid Engine)

1. **Layer 1 — Deterministic Banking Rule Engine (25%)**
   - Mengevaluasi 9 aturan bisnis perbankan secara transparan:
     - `R1_VELOCITY_SPIKE`: Lonjakan frekuensi transaksi dalam 1 jam.
     - `R2_EXTREME_AMOUNT_RATIO`: Nominal jauh di atas rata-rata historis nasabah.
     - `R3_ACCOUNT_TAKEOVER`: Perangkat baru + jam rawan/jarak jauh + rasio nominal tinggi.
     - `R4_MONEY_MULE_FAN_IN`: Rekening penerima baru menerima dana dari banyak pengirim berbeda dalam 24 jam (*Fan-In*).
     - `R5_DORMANT_REACTIVATION`: Reaktivasi rekening pasif (>6 bulan) bernilai besar.
     - `R6_STRUCTURING_SPLIT`: Pemecahan transaksi tepat di bawah batas otorisasi/pelaporan (Rp 25 Jt / Rp 100 Jt).
     - `R7_CROSS_BORDER_ODD_HOUR`: Transaksi lintas negara pada dini hari (00:00–04:59).
     - `R8_HIGH_VALUE_NEW_RECIPIENT`: Transfer nominal besar ke penerima baru dari perangkat baru.
     - `R9_WATCHLIST_HIT`: Kecocokan langsung dengan Blacklist/Watchlist aktif hasil konfirmasi analis.
2. **Layer 2 — Unsupervised Anomaly Detection (`Isolation Forest`, 15%)**
   - 48 pohon `IsolationForest` dilatih dengan `scikit-learn` di Python, lalu diekspor secara presisi (`max diff < 1e-9`) ke artefak JSON untuk mendeteksi pola anomali baru tanpa label.
3. **Layer 3 — Calibrated Supervised Classifier (`Logistic Regression`, 60%) + Explainable AI**
   - Menghasilkan probabilitas fraud terkalibrasi beserta kontribusi log-odds per fitur (*Top Risk Drivers*), serta pembandingan benchmark terhadap `RandomForestClassifier`.

### Matriks Keputusan 4-Tier
- **0–39 (`APPROVE`):** Transaksi lolos otomatis tanpa hambatan.
- **40–64 (`STEP_UP_CHALLENGE`):** Memicu verifikasi biometrik / OTP dinamis.
- **65–84 (`MANUAL_REVIEW`):** Dana ditahan sementara & masuk ke Antrean Investigasi Analis.
- **85–100 (`AUTO_BLOCK`):** Transaksi ditolak otomatis & dibuat alert prioritas tinggi.

---

## Fitur Utama Portfolio

- **Executive & Cost-Sensitive Analytics:** KPI volume uji, *Fraud Loss Prevented (Rp)*, *Value Detection Rate (VDR %)*, *Customer Insult Rate (%)*, *PR-AUC / ROC-AUC*, serta **Slider Threshold Optimizer** interaktif.
- **Live Transaction Simulator:** 6 preset serangan perbankan (*Normal, Account Takeover, Money Mule, Dormant Reactivation, Structuring, Velocity Attack*) + kustomisasi parameter lengkap + Explainable AI.
- **Analyst Workbench & Feedback Loop:** Meninjau alert, konfirmasi fraud (otomatis memasukkan rekening tujuan & perangkat ke Watchlist aktif), atau menandai aman (Whitelist), serta menguji kembali entitas Watchlist di Simulator.
- **Bilingual Switcher (`ID | EN`):** Penggantian bahasa Indonesia & Inggris secara instan.

---

## Struktur Proyek

```text
├── ml/
│   ├── requirements.txt            # numpy, pandas, scikit-learn
│   └── train_and_export.py         # Generator 6.000 tx sintetis, training ML & ekspor artefak
├── src/
│   ├── data/model-artifact.json    # Artefak model terlatih (~123 KB) & kurva threshold sweep
│   ├── lib/
│   │   ├── fraud-engine.ts         # Hybrid 3-Layer Scoring Engine (< 2ms inference)
│   │   ├── i18n.ts                 # Kamus 2 Bahasa (ID / EN)
│   │   ├── format.ts               # Formatter Rupiah & angka deterministik
│   │   └── types.ts                # Definisi tipe TypeScript
│   ├── components/
│   │   ├── ExecutiveDashboard.tsx  # KPI, Threshold Optimizer & visualisasi metrik
│   │   ├── TransactionSimulator.tsx# Simulator real-time + Explainable AI
│   │   ├── AnalystWorkbench.tsx    # Antrean investigasi + Watchlist/Whitelist loop
│   │   └── ArchitectureGuide.tsx   # Dokumentasi arsitektur & deployment
│   └── app/
│       ├── api/score/route.ts      # POST /api/score (Serverless scoring API)
│       ├── api/model-info/route.ts # GET /api/model-info
│       └── page.tsx                # Aplikasi utama
```

---

## Menjalankan Secara Lokal

### 1. Pipeline Machine Learning (Opsional — artefak sudah tersedia)
```bash
pip install -r ml/requirements.txt
python ml/train_and_export.py
```

### 2. Aplikasi Web Next.js
```bash
npm install
npm run dev
```
Buka `http://localhost:3000`.

---

## Panduan Hosting Gratis di Vercel

1. Push seluruh kode proyek ini ke repository **GitHub** Anda.
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → pilih repository GitHub tersebut.
3. Biarkan pengaturan build default Next.js (`npm run build`), lalu klik **Deploy**.
4. Tidak memerlukan server Python terpisah atau konfigurasi environment variable wajib — aplikasi langsung aktif dengan *zero cold start*!

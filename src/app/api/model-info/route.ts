import { NextResponse } from "next/server";
import { buildInitialTransactionRecords, modelArtifact } from "@/lib/fraud-engine";

export async function GET() {
  const initialRecords = buildInitialTransactionRecords();
  return NextResponse.json({
    ok: true,
    metadata: modelArtifact.metadata,
    threshold_sweep: modelArtifact.threshold_sweep,
    channel_stats: modelArtifact.channel_stats,
    scenario_stats: modelArtifact.scenario_stats,
    feature_importances: modelArtifact.feature_importances,
    sample_count: initialRecords.length,
    sample_transactions: initialRecords.slice(0, 15),
  });
}

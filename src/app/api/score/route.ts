import { NextResponse } from "next/server";
import { evaluateTransaction } from "@/lib/fraud-engine";
import type { TransactionInput, WatchlistEntry, WhitelistEntry } from "@/lib/types";

interface ScoreRequestBody {
  transaction: TransactionInput;
  watchlist?: WatchlistEntry[];
  whitelist?: WhitelistEntry[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ScoreRequestBody | TransactionInput;
    const isWrapped = "transaction" in body;
    const transaction = isWrapped ? body.transaction : body;
    const watchlist = isWrapped && Array.isArray(body.watchlist) ? body.watchlist : [];
    const whitelist = isWrapped && Array.isArray(body.whitelist) ? body.whitelist : [];

    if (!transaction || typeof transaction.amount_idr !== "number") {
      return NextResponse.json(
        { error: "Invalid transaction payload: amount_idr is required." },
        { status: 400 }
      );
    }

    const result = evaluateTransaction(transaction, watchlist, whitelist);
    return NextResponse.json({
      ok: true,
      transaction,
      scoring: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to evaluate transaction.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fetchLiveNearReceipts } from "@/lib/near-server";
import { getDemoTransactions } from "@/lib/near";
import { NEAR_NETWORK_LABEL } from "@/lib/near-network";

export const dynamic = "force-dynamic";

function isValidNearAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== "string") return false;
  const clean = accountId.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 64) return false;
  // 64-char hex implicit account
  if (/^[0-9a-f]{64}$/.test(clean)) return true;
  // Named account: lowercase alphanumeric, dashes, underscores, and dots (subaccounts)
  return /^([a-z0-9_-]+\.)*[a-z0-9_-]+$/.test(clean);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAccount = searchParams.get("account");
    if (!rawAccount || !rawAccount.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Account parameter is required.",
          receipts: [],
          summary: null,
        },
        { status: 400 }
      );
    }
    const account = rawAccount.trim().toLowerCase();
    const demoParam = searchParams.get("demo");
    const isDemo = demoParam === "true" || account === "demo" || account === "demo.near";
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    // If explicit demo requested
    if (isDemo) {
      const demoData = getDemoTransactions(account);
      return NextResponse.json({
        success: true,
        isDemo: true,
        account,
        summary: demoData.summary,
        receipts: demoData.receipts,
      });
    }

    // Validate account address syntax for live on-chain queries
    if (!isValidNearAccountId(account)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid NEAR account address format: "${rawAccount}". Account identifiers must be 2-64 characters (e.g. "sweat_welcome.near", "relay.tg", or a 64-character hex address).`,
          receipts: [],
          summary: null,
        },
        { status: 400 }
      );
    }

    // Otherwise, fetch real on-chain data
    const liveData = await fetchLiveNearReceipts(account, limit);

    // If no transactions found on-chain, still return clean on-chain result (never inject fake transactions as real)
    return NextResponse.json({
      success: true,
      isDemo: false,
      account,
      summary: liveData.summary,
      receipts: liveData.receipts,
      network: NEAR_NETWORK_LABEL,
    });
  } catch (error: any) {
    console.error("Error in /api/receipts:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch NEAR blockchain data",
        receipts: [],
        summary: null,
      },
      { status: 500 }
    );
  }
}

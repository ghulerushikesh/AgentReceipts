import { NextRequest, NextResponse } from "next/server";
import { recordAgentExecutionEvent, getAgentEventsForAccount } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

function getWebhookSecret(): string | null {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  return secret && secret.trim().length >= 32 ? secret : null;
}

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authHeader = request.headers.get("authorization");
  const xSecret = request.headers.get("x-agent-secret");

  if (xSecret && xSecret === secret) {
    return true;
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token === secret) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const secret = getWebhookSecret();
    if (!secret) return NextResponse.json({ success: false, error: "Agent webhook authentication is not configured." }, { status: 503 });
    // 1. Authentication check
    if (!isAuthorized(request, secret)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized. Please provide a valid Authorization: Bearer <secret> or X-Agent-Secret header.",
        },
        { status: 401 }
      );
    }

    // 2. Parse & validate request payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      eventId,
      agentId,
      agentName,
      accountId,
      txHash,
      taskId,
      promptSnippet,
      actionDescription,
      category,
      timestamp,
    } = body;

    // Required fields validation
    if (!eventId || typeof eventId !== "string" || !eventId.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required string field: 'eventId'" },
        { status: 400 }
      );
    }
    if (!agentId || typeof agentId !== "string" || !agentId.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required string field: 'agentId'" },
        { status: 400 }
      );
    }
    if (!accountId || typeof accountId !== "string" || !accountId.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required string field: 'accountId'" },
        { status: 400 }
      );
    }
    if (!txHash || typeof txHash !== "string" || !txHash.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required string field: 'txHash'" },
        { status: 400 }
      );
    }
    if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required string field: 'taskId'" },
        { status: 400 }
      );
    }

    // 3. Record event in store (handles deduplication automatically)
    const { event, isDuplicate } = recordAgentExecutionEvent({
      eventId,
      agentId,
      agentName,
      accountId,
      txHash,
      taskId,
      promptSnippet,
      actionDescription,
      category,
      timestamp: typeof timestamp === "number" ? timestamp : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        isDuplicate,
        message: isDuplicate
          ? `Event already recorded for transaction hash '${txHash}'. Idempotent response returned.`
          : `Agent execution event verified and recorded. Matching against NEAR on-chain records enabled.`,
        event,
      },
      { status: isDuplicate ? 200 : 201 }
    );
  } catch (err: any) {
    console.error("Error in POST /api/agent/events:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal server error while processing agent event",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account");

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Query parameter 'account' is required" },
        { status: 400 }
      );
    }

    const events = getAgentEventsForAccount(account);
    return NextResponse.json({
      success: true,
      account,
      totalEvents: events.length,
      events,
    });
  } catch (err: any) {
    console.error("Error in GET /api/agent/events:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve agent events" },
      { status: 500 }
    );
  }
}

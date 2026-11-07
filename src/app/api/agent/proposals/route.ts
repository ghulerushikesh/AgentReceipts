import { NextRequest, NextResponse } from "next/server";
import { getAllProposals, getDailySpentNear, getAllTasks } from "@/agent/proposal-store";
import { executeAgentTask, RunTaskInput } from "@/agent/runner";
import { isSupportedPaymentNetwork } from "@/lib/near-network";
import { getAgentConnectionForAccount, registerAgentConnection } from "@/lib/agent-store";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const view = searchParams.get("view"); // "tasks" | "proposals"

    if (view === "tasks") {
      const tasks = getAllTasks();
      return NextResponse.json({ success: true, tasks });
    }

    const proposals = getAllProposals({ payerAccount: account, status });
    const dailySpentNear = account ? getDailySpentNear(account) : 0;
    const pendingCount = proposals.filter((p) => p.status === "PROPOSED").length;

    return NextResponse.json({
      success: true,
      proposals,
      pendingCount,
      dailySpentNear,
      network: "testnet",
    });
  } catch (err: any) {
    console.error("Error in GET /api/agent/proposals:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load proposals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = getWebhookSecret();
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "Agent webhook authentication is not configured." },
        { status: 503 }
      );
    }

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

    const body = await request.json();
    if (body.network !== undefined && !isSupportedPaymentNetwork(body.network)) {
      return NextResponse.json({ success: false, error: "Only NEAR Testnet payment proposals are supported." }, { status: 400 });
    }
    const {
      taskType = "ORACLE_PRICE_FETCH",
      payerAccount = "agent-operator.testnet",
      recipientAccount,
      amountNear,
      prompt = "Autonomous agent scheduled task",
      policy,
      agentId,
      agentName,
    } = body;

    // Validate agent identity fields if provided
    if (agentId !== undefined) {
      if (typeof agentId !== "string" || !agentId.trim() || agentId.trim().length > 64) {
        return NextResponse.json(
          { success: false, error: "Invalid 'agentId': must be a non-empty string up to 64 characters." },
          { status: 400 }
        );
      }
    }

    if (agentName !== undefined) {
      if (typeof agentName !== "string" || !agentName.trim() || agentName.trim().length > 100) {
        return NextResponse.json(
          { success: false, error: "Invalid 'agentName': must be a non-empty string up to 100 characters." },
          { status: 400 }
        );
      }
    }

    let effectiveAgentId = typeof agentId === "string" ? agentId.trim() : undefined;
    let effectiveAgentName = typeof agentName === "string" ? agentName.trim() : undefined;

    // Backward compatibility: If no agent identity in payload, check registered connection for payer account
    const registered = getAgentConnectionForAccount(payerAccount);
    if (!effectiveAgentId && registered?.agentId) {
      effectiveAgentId = registered.agentId;
      effectiveAgentName = registered.agentName;
    }

    // Default agentName to agentId if only agentId provided
    if (effectiveAgentId && !effectiveAgentName) {
      effectiveAgentName = effectiveAgentId;
    }

    // Ensure the identity is consistently linked to the registered agent store
    if (effectiveAgentId && effectiveAgentName) {
      registerAgentConnection({
        agentId: effectiveAgentId,
        agentName: effectiveAgentName,
        accountId: payerAccount,
        network: "NEAR Testnet",
        status: "CONNECTED",
        lastSyncAt: new Date().toISOString(),
      });
    }

    const result = await executeAgentTask({
      taskType,
      payerAccount,
      recipientAccount,
      amountNear: typeof amountNear === "number" ? amountNear : undefined,
      prompt,
      policy,
      agentId: effectiveAgentId,
      agentName: effectiveAgentName,
    });

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        task: result.task,
        proposal: result.proposal,
      },
      { status: result.proposal?.status === "REJECTED" ? 422 : 201 }
    );
  } catch (err: any) {
    console.error("Error in POST /api/agent/proposals:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute agent task" },
      { status: 500 }
    );
  }
}

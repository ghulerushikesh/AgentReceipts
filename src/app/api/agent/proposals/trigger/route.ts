import { NextRequest, NextResponse } from "next/server";
import { executeAgentTask } from "@/agent/runner";
import { isSupportedPaymentNetwork } from "@/lib/near-network";

export const dynamic = "force-dynamic";

/**
 * Internal dashboard route for triggering agent task proposals from the UI.
 * Does not expose the secret to client-side frontend code.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.network !== undefined && !isSupportedPaymentNetwork(body.network)) {
      return NextResponse.json(
        { success: false, error: "Only NEAR Testnet payment proposals are supported." },
        { status: 400 }
      );
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

    const result = await executeAgentTask({
      taskType,
      payerAccount,
      recipientAccount,
      amountNear: typeof amountNear === "number" ? amountNear : undefined,
      prompt,
      policy,
      agentId: typeof agentId === "string" ? agentId.trim() : undefined,
      agentName: typeof agentName === "string" ? agentName.trim() : undefined,
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
    console.error("Error in POST /api/agent/proposals/trigger:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute agent task" },
      { status: 500 }
    );
  }
}

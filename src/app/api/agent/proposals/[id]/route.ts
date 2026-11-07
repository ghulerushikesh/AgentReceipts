import { NextRequest, NextResponse } from "next/server";
import { getProposalById } from "@/agent/proposal-store";

export const dynamic = "force-dynamic";

function getWebhookSecret(): string | null {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  return secret && secret.trim().length >= 32 ? secret : null;
}

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authHeader = request.headers.get("authorization");
  const xSecret = request.headers.get("x-agent-secret");

  if (xSecret && xSecret === secret) return true;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim() === secret;
  }
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const proposalId = params?.id ? params.id.trim() : "";
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "Missing proposal ID parameter" },
        { status: 400 }
      );
    }

    const proposal = getProposalById(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { success: false, error: `Proposal '${proposalId}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      proposal: {
        proposalId: proposal.proposalId,
        taskId: proposal.taskId,
        agentId: proposal.agentId,
        agentName: proposal.agentName,
        network: proposal.network,
        payerAccount: proposal.payerAccount,
        recipientAccount: proposal.recipientAccount,
        amountNear: proposal.amountNear,
        amountYocto: proposal.amountYocto,
        purpose: proposal.purpose,
        promptSnippet: proposal.promptSnippet,
        actionDescription: proposal.actionDescription,
        category: proposal.category,
        status: proposal.status,
        txHash: proposal.txHash || null,
        blockHeight: proposal.blockHeight || null,
        createdAt: proposal.createdAt,
        submittedAt: proposal.submittedAt || null,
        verifiedAt: proposal.verifiedAt || null,
        rejectionReason: proposal.rejectionReason || null,
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/agent/proposals/[id]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve proposal status" },
      { status: 500 }
    );
  }
}

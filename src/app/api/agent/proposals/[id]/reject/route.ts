import { NextRequest, NextResponse } from "next/server";
import { getProposalById, updateProposalStatus } from "@/agent/proposal-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    if (proposal.status === "VERIFIED") {
      return NextResponse.json(
        { success: false, error: "Cannot reject a verified on-chain payment." },
        { status: 400 }
      );
    }

    let reason = "Rejected by wallet owner";
    try {
      const body = await request.json();
      if (body?.reason && typeof body.reason === "string") {
        reason = body.reason.trim();
      }
    } catch {
      // Request body is optional
    }

    const updated = updateProposalStatus(proposalId, "REJECTED", {
      rejectionReason: reason,
    });

    return NextResponse.json({
      success: true,
      proposal: updated,
      message: "Payment proposal rejected.",
    });
  } catch (err: any) {
    console.error("Error in POST /api/agent/proposals/[id]/reject:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reject proposal" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAndFinalizeProposal } from "@/agent/runner";
import { getProposalById, updateProposalStatus } from "@/agent/proposal-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proposalId = params.id;
    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "Missing proposal ID parameter" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { txHash, payerAccount, signerAccount } = body;
    const requestedPayer =
      typeof (payerAccount || signerAccount) === "string" && (payerAccount || signerAccount).trim()
        ? (payerAccount || signerAccount).trim().toLowerCase()
        : undefined;

    const cleanHash = typeof txHash === "string" ? txHash.trim() : "";
    // NEAR transaction hashes are 32-byte Base58 strings (alphanumeric excluding 0, O, I, l)
    const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{40,55}$/;
    if (!cleanHash || !BASE58_REGEX.test(cleanHash)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid transaction hash format. Expected a valid NEAR base58 transaction hash.",
        },
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
    const retryingPendingFinality =
      proposal.status === "FAILED" &&
      proposal.txHash === cleanHash &&
      Boolean(
        proposal.rejectionReason?.startsWith("Transaction pending:") ||
        proposal.rejectionReason?.toLowerCase().includes("doesn't exist") ||
        proposal.rejectionReason?.toLowerCase().includes("not found") ||
        proposal.rejectionReason?.toLowerCase().includes("pending")
      );
    if (
      proposal.status !== "PROPOSED" &&
      proposal.status !== "SUBMITTED" &&
      !retryingPendingFinality
    ) {
      return NextResponse.json(
        { success: false, proposal, error: `Proposal '${proposalId}' cannot be submitted from status ${proposal.status}.` },
        { status: 422 }
      );
    }
    if (proposal.status === "SUBMITTED" && proposal.txHash !== cleanHash) {
      return NextResponse.json(
        { success: false, proposal, error: "A different transaction hash is already recorded for this submission." },
        { status: 422 }
      );
    }
    if (proposal.status === "PROPOSED") {
      // This endpoint is called only after the wallet returns its actual transaction hash.
      updateProposalStatus(proposalId, "SUBMITTED", { txHash: cleanHash });
      if (requestedPayer) {
        updateProposalStatus(proposalId, "SUBMITTED", { txHash: cleanHash, payerAccount: requestedPayer });
      }
    } else if (proposal.status === "SUBMITTED" && requestedPayer && !proposal.actualPayerAccount) {
      updateProposalStatus(proposalId, "SUBMITTED", { txHash: cleanHash, payerAccount: requestedPayer });
    }

    const result = await verifyAndFinalizeProposal(proposalId, cleanHash);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          proposal: result.proposal,
          error: result.error,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      proposal: result.proposal,
      verificationDetails: result.verificationDetails,
    });
  } catch (err: any) {
    const isNotFound = err?.message?.includes("not found");
    return NextResponse.json(
      { success: false, error: err.message || "Failed to verify proposal transaction" },
      { status: isNotFound ? 404 : 500 }
    );
  }
}

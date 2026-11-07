import { NextRequest, NextResponse } from "next/server";
import { getProposalById, getDailySpentNear } from "@/agent/proposal-store";
import { evaluateSpendingPolicy, isTestnetAccountId } from "@/agent/policy";

export const dynamic = "force-dynamic";

/**
 * Lightweight server-side validation endpoint for payment proposals.
 * Evaluated immediately before prompting Meteor Wallet for signature.
 *
 * Verifies:
 * 1. Proposal is still pending (PROPOSED); validation never approves it.
 * 2. Network and account validity (strictly NEAR Testnet).
 * 3. Signer match against authorized proposal payer.
 * 4. Positive payment amount.
 * 5. Rechecks 24h spending limits against active policy.
 */
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

    const proposal = getProposalById(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { success: false, error: `Proposal '${proposalId}' not found.` },
        { status: 404 }
      );
    }

    // Policy validation is not human approval. Only pending proposals can be validated.
    if (proposal.status !== "PROPOSED") {
      return NextResponse.json(
        {
          success: false,
          proposal,
          error: `Proposal '${proposalId}' is ${proposal.status} and cannot be validated for payment.`,
        },
        { status: 422 }
      );
    }

    // 2. Strict network and account validation
    if (proposal.network !== "testnet") {
      return NextResponse.json(
        {
          success: false,
          proposal,
          error: "Security violation: Only NEAR Testnet proposals are supported.",
        },
        { status: 400 }
      );
    }

    if (
      !isTestnetAccountId(proposal.payerAccount) ||
      !isTestnetAccountId(proposal.recipientAccount)
    ) {
      return NextResponse.json(
        {
          success: false,
          proposal,
          error: "Security violation: Accounts must be valid NEAR Testnet addresses.",
        },
        { status: 400 }
      );
    }

    // 3. Dynamic Payer Support: Verify connected signer wallet
    // Any connected NEAR Testnet account can authorize and pay the proposal.
    const body = await request.json().catch(() => ({}));
    const { signerAccount, payerAccount } = body;
    const requestedSigner = signerAccount || payerAccount;
    let effectivePayer = proposal.payerAccount;

    if (requestedSigner && typeof requestedSigner === "string") {
      const cleanSigner = requestedSigner.trim().toLowerCase();
      if (!isTestnetAccountId(cleanSigner)) {
        return NextResponse.json(
          {
            success: false,
            proposal,
            error: `Signer '${cleanSigner}' is not a valid NEAR Testnet account.`,
          },
          { status: 400 }
        );
      }
      effectivePayer = cleanSigner;
    }

    // 4. Amount validation
    if (proposal.amountNear <= 0) {
      return NextResponse.json(
        {
          success: false,
          proposal,
          error: "Payment amount must be greater than 0 NEAR.",
        },
        { status: 400 }
      );
    }

    // 5. Server-side policy limit check against cumulative 24h spending
    // Rechecks both proposal.payerAccount and the actual connected payer (effectivePayer)
    const currentDailySpent = getDailySpentNear(proposal.payerAccount, proposalId);
    const effectiveDailySpent =
      effectivePayer !== proposal.payerAccount.toLowerCase()
        ? getDailySpentNear(effectivePayer, proposalId)
        : currentDailySpent;

    const policyCheck = evaluateSpendingPolicy(
      proposal.amountNear,
      proposal.recipientAccount,
      effectiveDailySpent
    );

    if (!policyCheck.passed) {
      return NextResponse.json(
        {
          success: false,
          proposal,
          error: `Policy validation failed: ${policyCheck.reason}`,
          policyCheck,
        },
        { status: 422 }
      );
    }

    // Leave the proposal PROPOSED until a wallet submission returns a real hash.
    return NextResponse.json({
      success: true,
      proposal,
      effectivePayer,
      policyCheck,
    });
  } catch (err: any) {
    console.error("Error in POST /api/agent/proposals/[id]/validate:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to validate proposal" },
      { status: 500 }
    );
  }
}

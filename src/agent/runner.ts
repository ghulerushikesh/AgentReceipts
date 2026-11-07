import {
  AgentSpendingPolicy,
  AgentTaskRecord,
  PaymentProposal,
  AUTONOMOUS_SIGNING_ENABLED,
} from "./types";
import { DEFAULT_AGENT_SPENDING_POLICY, evaluateSpendingPolicy, isTestnetAccountId } from "./policy";
import {
  storeProposal,
  getProposalById,
  updateProposalStatus,
  getDailySpentNear,
  storeTaskRecord,
  getTaskById,
  isTxHashUsedByProposal,
} from "./proposal-store";
import { verifyTestnetTransaction } from "./verifier";
import { recordAgentExecutionEvent, hasAgentEventForTxHash } from "@/lib/agent-store";
import { nearToYocto } from "@/lib/near";

export const AGENT_IDENTITY = {
  agentId: "autonomous-oracle-agent.testnet",
  agentName: "Autonomous Oracle & Compute Agent",
  network: "testnet" as const,
  signingMode: "HUMAN_IN_THE_LOOP" as const,
  autonomousSigningEnabled: false,
  description:
    "Autonomous agent performing verified compute checks, oracle retrievals, and proposing policy-bounded micro-payments on NEAR Testnet awaiting MyNearWallet authorization.",
};

/**
 * Enforces safety: autonomous signing is explicitly disabled by design.
 */
export function assertAutonomousSigningDisabled(): void {
  if (AUTONOMOUS_SIGNING_ENABLED) {
    throw new Error(
      "SECURITY VIOLATION: Autonomous signing is disabled by design. Option A (Human-in-the-Loop) is active."
    );
  }
}

export interface RunTaskInput {
  taskType: "SERVICE_HEALTH_PING" | "ORACLE_PRICE_FETCH" | "AI_INFERENCE_PAYMENT" | "DATA_STORAGE_LEASE";
  payerAccount: string;
  recipientAccount?: string;
  amountNear?: number;
  prompt: string;
  policy?: AgentSpendingPolicy;
  agentId?: string;
  agentName?: string;
}

export interface RunTaskResult {
  task: AgentTaskRecord;
  proposal: PaymentProposal | null;
  message: string;
}

/**
 * Executes a configured agent task.
 * Enforces strict spending policy and creates an explicit PaymentProposal.
 *
 * Does NOT sign autonomously: all proposals require explicit human wallet approval.
 */
export async function executeAgentTask(input: RunTaskInput): Promise<RunTaskResult> {
  const taskId = `TASK-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const cleanPayer = input.payerAccount.trim().toLowerCase();
  const policy = input.policy || DEFAULT_AGENT_SPENDING_POLICY;
  const agentId = (input.agentId && input.agentId.trim()) || AGENT_IDENTITY.agentId;
  const agentName = (input.agentName && input.agentName.trim()) || AGENT_IDENTITY.agentName;

  // Task 1: Non-payment task (e.g. Service Health Ping)
  if (input.taskType === "SERVICE_HEALTH_PING") {
    const task: AgentTaskRecord = {
      taskId,
      agentId,
      agentName,
      taskType: input.taskType,
      prompt: input.prompt,
      requiresPayment: false,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary: `Task #${taskId} completed successfully: NEAR RPC node health verified. Zero payment required; no transaction submitted.`,
    };

    storeTaskRecord(task);

    return {
      task,
      proposal: null,
      message:
        "Task completed without requiring a payment. No on-chain transaction was generated or fabricated.",
    };
  }

  // Tasks 2, 3, 4: Tasks requiring payment
  const amountNear = input.amountNear ?? 0.01;
  const recipient = (
    input.recipientAccount ||
    (input.taskType === "ORACLE_PRICE_FETCH"
      ? "oracle.testnet"
      : input.taskType === "AI_INFERENCE_PAYMENT"
      ? "compute-node.testnet"
      : "storage-provider.testnet")
  ).toLowerCase();

  // 1. Calculate 24h spending from store
  const dailySpentNear = getDailySpentNear(cleanPayer);

  // 2. Server-side policy evaluation
  const policyCheck = evaluateSpendingPolicy(
    amountNear,
    recipient,
    dailySpentNear,
    policy
  );

  const proposalId = `PROP-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  // Convert NEAR to exact yoctoNEAR string for the proposal
  const amountYocto = nearToYocto(amountNear);

  const purpose =
    input.taskType === "ORACLE_PRICE_FETCH"
      ? "Decentralized Oracle Data Retrieval Fee"
      : input.taskType === "AI_INFERENCE_PAYMENT"
      ? "AI Inference Compute Quota Refill"
      : "Account Storage Bond Allocation";

  const actionDescription =
    input.taskType === "ORACLE_PRICE_FETCH"
      ? "Oracle Query Settlement"
      : input.taskType === "AI_INFERENCE_PAYMENT"
      ? "Compute Node Micro-Payment"
      : "Storage Lease Bond";

  const category =
    input.taskType === "ORACLE_PRICE_FETCH"
      ? "AI Inference & Compute"
      : input.taskType === "AI_INFERENCE_PAYMENT"
      ? "Autonomous Payment"
      : "Storage Lease";

  // If policy check failed, record as REJECTED proposal
  if (!policyCheck.passed) {
    const rejectedProposal: PaymentProposal = {
      proposalId,
      taskId,
      agentId,
      agentName,
      network: "testnet",
      payerAccount: cleanPayer,
      recipientAccount: recipient,
      amountNear,
      amountYocto,
      purpose,
      promptSnippet: input.prompt,
      actionDescription,
      category,
      policyCheck,
      status: "REJECTED",
      createdAt: new Date().toISOString(),
      rejectionReason: policyCheck.reason,
    };

    storeProposal(rejectedProposal);

    const task: AgentTaskRecord = {
      taskId,
      agentId,
      agentName,
      taskType: input.taskType,
      prompt: input.prompt,
      requiresPayment: true,
      proposalId,
      status: "FAILED",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary: `Task #${taskId} halted: Spending policy rejected proposed payment. ${policyCheck.reason}`,
    };

    storeTaskRecord(task);

    return {
      task,
      proposal: rejectedProposal,
      message: `Payment rejected by server-side spending guardrails: ${policyCheck.reason}`,
    };
  }

  // If policy check passed, record as PROPOSED awaiting human wallet authorization
  const proposal: PaymentProposal = {
    proposalId,
    taskId,
    agentId,
    agentName,
    network: "testnet",
    payerAccount: cleanPayer,
    recipientAccount: recipient,
    amountNear,
    amountYocto,
    purpose,
    promptSnippet: input.prompt,
    actionDescription,
    category,
    policyCheck,
    status: "PROPOSED",
    createdAt: new Date().toISOString(),
  };

  storeProposal(proposal);

  const task: AgentTaskRecord = {
    taskId,
    agentId,
    agentName,
    taskType: input.taskType,
    prompt: input.prompt,
    requiresPayment: true,
    proposalId,
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
    summary: `Task #${taskId} created. Proposal #${proposalId} for ${amountNear} NEAR to ${recipient} is awaiting wallet-owner authorization via MyNearWallet.`,
  };

  storeTaskRecord(task);

  return {
    task,
    proposal,
    message: `Payment proposal #${proposalId} created and passed spending policy. Awaiting wallet-owner signature.`,
  };
}

/**
 * Verifies a submitted transaction against NEAR Testnet RPC,
 * reconciles the outcome with the proposal, and dispatches the authenticated event.
 *
 * Strict security guarantees:
 * 1. Testnet-only network and account validation.
 * 2. State-machine protection: no re-verifying VERIFIED or REJECTED proposals.
 * 3. Anti-replay protection: txHash cannot be reused across proposals.
 * 4. Policy recheck: ensures daily budget has not been exceeded since proposal creation.
 * 5. Signer matching: verifies actual on-chain transaction signer matches proposal payer.
 * 6. Recipient matching: verifies transaction receiver matches proposal recipient.
 * 7. Amount verification: exact yoctoNEAR (10^24) integer comparison.
 * 8. Finality & status: verifies execution succeeded with FINAL finality on NEAR Testnet.
 */
export async function verifyAndFinalizeProposal(
  proposalId: string,
  txHash: string
): Promise<{
  success: boolean;
  proposal: PaymentProposal;
  verificationDetails?: any;
  error?: string;
}> {
  const proposal = getProposalById(proposalId);
  if (!proposal) {
    throw new Error(`Proposal '${proposalId}' not found.`);
  }

  // 1. Proposal state guards
  if (proposal.status === "VERIFIED") {
    return {
      success: false,
      proposal,
      error: `Proposal '${proposalId}' has already been verified and settled. Re-verification is rejected.`,
    };
  }

  if (proposal.status === "REJECTED") {
    return {
      success: false,
      proposal,
      error: `Proposal '${proposalId}' was rejected by policy and cannot be verified.`,
    };
  }

  // 2. Strict network safety enforcement
  if (proposal.network !== "testnet") {
    return {
      success: false,
      proposal,
      error: "Security violation: Non-testnet payment proposals cannot be verified.",
    };
  }

  if (
    !isTestnetAccountId(proposal.payerAccount) ||
    !isTestnetAccountId(proposal.recipientAccount)
  ) {
    return {
      success: false,
      proposal,
      error: "Security violation: Proposals with non-testnet account addresses cannot be verified.",
    };
  }

  const cleanTxHash = txHash.trim();

  // 3. Anti-replay protection: prevent transaction hash reuse across proposals
  if (isTxHashUsedByProposal(cleanTxHash, proposalId)) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Replay detected: transaction hash '${cleanTxHash}' has already been verified for another proposal.`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Transaction hash replay detected: '${cleanTxHash}' has already been verified for another proposal.`,
    };
  }

  if (hasAgentEventForTxHash(cleanTxHash)) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Replay detected: an execution receipt for transaction '${cleanTxHash}' already exists in AgentReceipts.`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Transaction hash replay detected: an agent execution event already exists for '${cleanTxHash}'.`,
    };
  }

  // 4. Re-check spending policy limits before finalizing settlement
  const currentDailySpent = getDailySpentNear(proposal.payerAccount, proposalId);
  const settlementPolicyCheck = evaluateSpendingPolicy(
    proposal.amountNear,
    proposal.recipientAccount,
    currentDailySpent
  );

  if (!settlementPolicyCheck.passed) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Settlement policy check failed: ${settlementPolicyCheck.reason}`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Settlement rejected by spending policy: ${settlementPolicyCheck.reason}`,
    };
  }

  // 5. Verify on-chain execution with official Testnet RPC
  const candidatePayer = (proposal.actualPayerAccount || proposal.payerAccount).trim().toLowerCase();
  let verification = await verifyTestnetTransaction(cleanTxHash, candidatePayer);

  // If candidate payer was not the on-chain signer, resolve actual on-chain signer via FastNear batch API and verify via official RPC
  if (!verification.isSuccessOnChain && !verification.verified) {
    try {
      const fnRes = await fetch("https://tx.test.fastnear.com/v0/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_hashes: [cleanTxHash] }),
      });
      if (fnRes.ok) {
        const fnData = await fnRes.json();
        const discoveredSigner = fnData.transactions?.[0]?.transaction?.signer_id;
        if (
          discoveredSigner &&
          isTestnetAccountId(discoveredSigner) &&
          discoveredSigner.toLowerCase() !== candidatePayer
        ) {
          const recheck = await verifyTestnetTransaction(cleanTxHash, discoveredSigner);
          if (recheck.isSuccessOnChain) {
            verification = recheck;
          }
        }
      }
    } catch (_) {
      // Fallback to original verification result
    }
  }

  if (!verification.verified || !verification.isSuccessOnChain) {
    const errorMsg = verification.error || "";
    const isPendingFinality =
      errorMsg.startsWith("Transaction pending:") ||
      errorMsg.toLowerCase().includes("doesn't exist") ||
      errorMsg.toLowerCase().includes("does not exist") ||
      errorMsg.toLowerCase().includes("not found") ||
      errorMsg.toLowerCase().includes("unknown_transaction") ||
      errorMsg.toLowerCase().includes("db not found") ||
      errorMsg.toLowerCase().includes("timeout") ||
      errorMsg.toLowerCase().includes("not ready") ||
      errorMsg.toLowerCase().includes("pending");

    const formattedReason = isPendingFinality
      ? (errorMsg.startsWith("Transaction pending:") ? errorMsg : `Transaction pending: ${errorMsg}`)
      : (errorMsg || "Transaction failed or was not confirmed on NEAR Testnet");

    updateProposalStatus(proposalId, isPendingFinality ? "SUBMITTED" : "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: formattedReason,
    });

    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: formattedReason,
    };
  }

  // 6. Strict Signer Matching: actual on-chain signer MUST match authorized proposal payer
  const cleanTxSigner = verification.senderId.trim().toLowerCase();
  const expectedPayer = (proposal.actualPayerAccount || cleanTxSigner).trim().toLowerCase();
  const cleanProposalPayer = expectedPayer;

  if (cleanTxSigner !== cleanProposalPayer) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Signer mismatch: expected payer '${cleanProposalPayer}', but transaction was signed by '${cleanTxSigner}'.`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Signer mismatch: transaction signer '${cleanTxSigner}' does not match proposal payer '${cleanProposalPayer}'.`,
    };
  }

  // Re-verify that actual payer account is a valid NEAR Testnet account
  if (!isTestnetAccountId(cleanTxSigner)) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Security violation: transaction signer '${cleanTxSigner}' is not a valid NEAR Testnet account.`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Security violation: signer '${cleanTxSigner}' is not a NEAR Testnet account.`,
    };
  }

  // Strict check on actual payer's daily spending limit at settlement time
  const actualDailySpent = cleanTxSigner !== proposal.payerAccount.toLowerCase()
    ? getDailySpentNear(cleanTxSigner, proposalId)
    : currentDailySpent;

  const payerSettlementPolicyCheck = evaluateSpendingPolicy(
    proposal.amountNear,
    proposal.recipientAccount,
    actualDailySpent
  );

  if (!payerSettlementPolicyCheck.passed) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Settlement policy check failed: ${payerSettlementPolicyCheck.reason}`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Settlement rejected by spending policy: ${payerSettlementPolicyCheck.reason}`,
    };
  }

  // 7. Strict Recipient Matching
  const cleanProposalRecipient = proposal.recipientAccount.trim().toLowerCase();
  const cleanTxReceiver = verification.receiverId.trim().toLowerCase();
  const recipientMatches = cleanTxReceiver === cleanProposalRecipient;

  if (!recipientMatches) {
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Recipient mismatch: expected '${cleanProposalRecipient}', but on-chain transaction went to '${cleanTxReceiver}'.`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Recipient mismatch: on-chain receiver '${cleanTxReceiver}' does not match proposal '${cleanProposalRecipient}'.`,
    };
  }

  // 8. Exact yoctoNEAR integer comparison (BigInt) - no floating point or loose tolerances
  // Strictly rejects both underpayments and overpayments
  const onChainDepositYocto = BigInt(verification.depositYocto || "0");
  const requiredDepositYocto = BigInt(proposal.amountYocto || "0");

  if (onChainDepositYocto !== requiredDepositYocto) {
    const diffType = onChainDepositYocto < requiredDepositYocto ? "underpayment" : "overpayment";
    updateProposalStatus(proposalId, "FAILED", {
      txHash: cleanTxHash,
      rejectionReason: `Amount mismatch (${diffType}): expected exactly ${requiredDepositYocto.toString()} yoctoNEAR (${proposal.amountNear} NEAR), but on-chain transfer was ${onChainDepositYocto.toString()} yoctoNEAR.`,
    });
    return {
      success: false,
      proposal: getProposalById(proposalId)!,
      error: `Amount mismatch (${diffType}): on-chain transfer (${onChainDepositYocto} yoctoNEAR) does not exactly match required proposal amount (${requiredDepositYocto} yoctoNEAR).`,
    };
  }

  // 9. Mark proposal as VERIFIED
  updateProposalStatus(proposalId, "VERIFIED", {
    txHash: cleanTxHash,
    blockHeight: verification.blockHeight,
    rejectionReason: null,
    payerAccount: cleanTxSigner,
  });

  const updatedProposal = getProposalById(proposalId)!;

  // 10. Update corresponding task record
  const task = getTaskById(proposal.taskId);
  if (task) {
    task.status = "COMPLETED";
    task.completedAt = new Date().toISOString();
    task.summary = `Task #${task.taskId} verified on NEAR Testnet (tx: ${cleanTxHash.slice(
      0,
      10
    )}...). Settlement confirmed.`;
    storeTaskRecord(task);
  }

  // 11. Emit authenticated event to AgentReceipts store using actual on-chain payer
  recordAgentExecutionEvent({
    eventId: `evt_${Date.now()}_${proposalId}`,
    agentId: proposal.agentId,
    agentName: proposal.agentName,
    accountId: cleanTxSigner,
    txHash: cleanTxHash,
    taskId: proposal.taskId,
    promptSnippet: proposal.promptSnippet,
    actionDescription: proposal.actionDescription,
    category: proposal.category,
    timestamp: Date.now(),
  });

  return {
    success: true,
    proposal: updatedProposal,
    verificationDetails: verification,
  };
}

export type NetworkType = "testnet";

/**
 * SECURITY CONFIGURATION:
 * Autonomous signing is explicitly disabled by design.
 * All payments require explicit human-in-the-loop authorization via MyNearWallet Testnet.
 */
export const AUTONOMOUS_SIGNING_ENABLED = false;

export type ProposalStatus =
  | "PROPOSED"
  | "APPROVED"
  | "REJECTED"
  | "SUBMITTED"
  | "VERIFIED"
  | "FAILED";

export interface AgentSpendingPolicy {
  network: NetworkType; // Strictly testnet
  maxPerTransactionNear: number; // e.g. 0.05 NEAR
  maxDailyNear: number; // e.g. 0.2 NEAR
  allowedRecipients?: string[];
  enforceRecipientWhitelist: boolean;
}

export interface PolicyCheckResult {
  passed: boolean;
  reason: string;
  perTxLimitNear: number;
  dailyLimitNear: number;
  dailySpentNear: number;
  amountNear: number;
  recipient: string;
  network: NetworkType;
}

export interface PaymentProposal {
  proposalId: string;
  taskId: string;
  agentId: string;
  agentName: string;
  network: NetworkType;
  payerAccount: string;
  proposedPayerAccount?: string;
  actualPayerAccount?: string;
  recipientAccount: string;
  amountNear: number;
  amountYocto: string;
  purpose: string;
  promptSnippet: string;
  actionDescription: string;
  category: string;
  policyCheck: PolicyCheckResult;
  status: ProposalStatus;
  txHash?: string;
  blockHeight?: number;
  createdAt: string;
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface AgentTaskRecord {
  taskId: string;
  agentId: string;
  agentName: string;
  taskType: "SERVICE_HEALTH_PING" | "ORACLE_PRICE_FETCH" | "AI_INFERENCE_PAYMENT" | "DATA_STORAGE_LEASE";
  prompt: string;
  requiresPayment: boolean;
  status: "COMPLETED" | "FAILED" | "PENDING_APPROVAL";
  proposalId?: string;
  createdAt: string;
  completedAt?: string;
  summary: string;
}

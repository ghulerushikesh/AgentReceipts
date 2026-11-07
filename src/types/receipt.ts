export type TransactionDirection = "OUTGOING" | "INCOMING" | "SELF";

export type AttributionStatus = "CONFIRMED" | "INFERRED" | "UNKNOWN";

export type ActionCategory =
  | "AI Inference & Compute"
  | "Autonomous Payment"
  | "Treasury & Staking"
  | "Smart Contract Execution"
  | "Storage Lease"
  | "Account Management"
  | "Contract Deployment"
  | "Uncategorized Action";

export interface TaskAttribution {
  status: AttributionStatus;
  category: ActionCategory;
  taskId: string | null;
  agentId: string | null;
  proposalId: string | null;
  agentName: string | null;
  promptSnippet: string | null;
  source: "PROPOSAL_WORKFLOW" | "AGENT_LOG_INTEGRATION" | "ON_CHAIN_MEMO" | "HEURISTIC" | "NONE";
  reasoning: string;
  integrationConnected: boolean;
  integrationNotice: string;
}

export interface EvidenceBreakdown {
  onChainFacts: {
    hash: string;
    blockHeight: number;
    blockTimestamp: number;
    sender: string;
    recipient: string;
    rawActionType: string;
    rawMethodName: string | null;
    rawDepositYocto: string;
    rawTokensBurntYocto: string | null;
    rawGasBurntTgas: number;
    rawExecutionStatus: string;
  };
  calculatedFields: {
    amountNear: number;
    networkFeeNear: number | null;
    feeIsExactBurnt: boolean;
    calculationFormula: string;
  };
  inferences: {
    purposeTitle: string;
    heuristicRule: string;
  };
  unavailableFields: string[];
}

export interface AgentReceipt {
  id: string;
  hash: string;
  blockHeight: number;
  blockTimestamp: number; // Unix timestamp in ms
  signerId: string;
  predecessorId: string;
  receiverId: string;
  direction: TransactionDirection;
  actionType: string;
  methodName: string | null;
  argsPreview: string | null;
  amountNear: number;
  amountYocto: string;
  amountUsd: number;
  assetId: string; // e.g. "native:near"
  assetSymbol: string; // "NEAR"
  gasBurntTgas: number;
  networkFeeNear: number | null;
  networkFeeYocto: string | null;
  feeIsExactBurnt: boolean; // true if tokens_burnt from FastNear outcome
  status: "SUCCESS" | "FAILURE" | "PENDING";
  isRealOnChain: boolean;
  isRefund: boolean;
  explorerUrl: string;
  attribution: TaskAttribution;
  evidence: EvidenceBreakdown;
  logs: string[];
}

export interface AccountFinancialSummary {
  accountId: string;
  network: "NEAR Testnet";
  liveBalanceNear: number;
  storageUsageBytes: number;
  totalOutgoingNear: number; // Completed outgoing transfers
  totalIncomingNear: number; // Completed incoming transfers
  netVolumeNear: number;
  totalNetworkFeeNear: number;
  totalNetworkFeeYocto: string;
  networkFeeUnavailableCount: number;
  feeCalculationNote: string;
  totalTransactions: number;
  successCount: number;
  failureCount: number;
  failedOutlaysNear: number; // Attempted amounts in failed txs (reported separately)
  refundCount: number;
  refundTotalNear: number;
  successRate: number;
  connectionStatus?: "AGENT_CONNECTED" | "ACCOUNT_MONITORED";
  connectedAgentName?: string | null;
  verifiedTasksCount?: number;
  isDemo: boolean;
  sourceApi: "FastNear Transactions API + NEAR RPC" | "Synthetic Demo Dataset";
  generatedAt: string;
  howWeCalculatedThis: {
    completedSpending: string;
    incomingCredits: string;
    networkFees: string;
    dailyBudgetWindow: string;
    dataLimitations: string;
  };
}

export interface BudgetConfig {
  dailyBudgetNear: number;
  warningThresholdPercent: number; // 80%
  alertThresholdPercent: number; // 100%
}

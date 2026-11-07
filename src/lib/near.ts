import {
  AgentReceipt,
  AccountFinancialSummary,
  TaskAttribution,
  EvidenceBreakdown,
  TransactionDirection,
  ActionCategory,
} from "@/types/receipt";
import { NEAR_EXPLORER_URL, NEAR_NETWORK_LABEL } from "@/lib/near-network";

// 1 NEAR = 10^24 yoctoNEAR
export const YOCTO_PER_NEAR = BigInt("1000000000000000000000000");
export const NEAR_USD_ESTIMATE = 4.25; // Estimated reference display rate

/**
 * Accurately converts a yoctoNEAR string/number to a floating NEAR value.
 * Uses exact BigInt decimal position slicing to avoid IEEE 754 precision loss.
 */
export function yoctoToNear(yoctoStr: string | number | bigint | undefined | null, decimals = 6): number {
  if (!yoctoStr || yoctoStr === "0") return 0;
  try {
    const raw = typeof yoctoStr === "string" ? yoctoStr.trim() : yoctoStr.toString();
    if (raw === "0" || !raw) return 0;

    const isNegative = raw.startsWith("-");
    const cleanStr = isNegative ? raw.slice(1) : raw;

    const padded = cleanStr.padStart(25, "0");
    const whole = padded.slice(0, padded.length - 24) || "0";
    const fraction = padded.slice(padded.length - 24);

    const formatted = `${whole}.${fraction.slice(0, decimals)}`;
    const parsed = parseFloat(formatted);
    return isNegative ? -parsed : parsed;
  } catch (err) {
    console.warn("Failed to parse yoctoNEAR:", yoctoStr, err);
    return 0;
  }
}

/**
 * Accurately converts a NEAR amount to yoctoNEAR integer string (10^24).
 * Uses string manipulation on decimal representation to avoid floating-point precision loss.
 */
export function nearToYocto(near: string | number | bigint): string {
  if (typeof near === "bigint") {
    return (near * YOCTO_PER_NEAR).toString();
  }
  let raw = typeof near === "number" ? near.toString() : near.trim();
  if (!raw || raw === "0") return "0";

  // Handle exponential notation if any (e.g. 1e-6)
  if (raw.includes("e-")) {
    const [coeff, expStr] = raw.split("e-");
    const exp = parseInt(expStr, 10);
    const [cWhole, cFrac = ""] = coeff.split(".");
    raw = "0." + "0".repeat(exp - 1) + cWhole + cFrac;
  }

  const isNegative = raw.startsWith("-");
  const cleanStr = isNegative ? raw.slice(1) : raw;

  const [wholePart = "0", fracPart = ""] = cleanStr.split(".");
  const paddedFrac = fracPart.padEnd(24, "0").slice(0, 24);
  const combined = `${wholePart}${paddedFrac}`.replace(/^0+/, "");
  const result = combined === "" ? "0" : combined;
  return isNegative ? `-${result}` : result;
}

/**
 * Converts gas units into TeraGas (1 Tgas = 10^12 gas)
 */
export function gasToTgas(gasStr: string | number | undefined | null): number {
  if (!gasStr) return 0;
  const gas = typeof gasStr === "string" ? parseFloat(gasStr) : Number(gasStr);
  if (isNaN(gas)) return 0;
  return Number((gas / 1e12).toFixed(3));
}

/**
 * Formats a NEAR account ID or transaction hash for readable display
 */
export function truncateHash(hash: string, start = 6, end = 4): string {
  if (!hash) return "Unavailable";
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

/**
 * Formats a timestamp into human-readable relative and ISO strings
 */
export function formatTimestamp(timestampMs: number): { formatted: string; relative: string } {
  const date = new Date(timestampMs);
  const now = Date.now();
  const diffSec = Math.floor((now - timestampMs) / 1000);

  let relative = "just now";
  if (diffSec >= 86400) {
    const days = Math.floor(diffSec / 86400);
    relative = `${days}d ago`;
  } else if (diffSec >= 3600) {
    const hours = Math.floor(diffSec / 3600);
    relative = `${hours}h ago`;
  } else if (diffSec >= 60) {
    const mins = Math.floor(diffSec / 60);
    relative = `${mins}m ago`;
  } else if (diffSec > 0) {
    relative = `${diffSec}s ago`;
  }

  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return { formatted, relative };
}

/**
 * Builds evidence-first task attribution.
 * NEVER fabricates task IDs, agent names, or business purposes.
 * Explicitly notes when an external agent run-log integration is not connected.
 */
export function buildEvidenceAndAttribution(
  methodName: string | null,
  receiverId: string,
  amountNear: number,
  hash: string,
  blockHeight: number,
  blockTimestamp: number,
  sender: string,
  recipient: string,
  depositYocto: string,
  tokensBurntYocto: string | null,
  gasBurntTgas: number,
  status: "SUCCESS" | "FAILURE" | "PENDING",
  feeIsExactBurnt: boolean
): { attribution: TaskAttribution; evidence: EvidenceBreakdown } {
  const method = (methodName || "").toLowerCase();
  const receiver = receiverId.toLowerCase();

  let category: ActionCategory = "Uncategorized Action";
  let purposeTitle = methodName ? `Contract call: ${methodName}()` : "Contract interaction";
  let heuristicRule = "General smart contract interaction with unknown application payload.";
  let attributionStatus: "CONFIRMED" | "INFERRED" | "UNKNOWN" = "UNKNOWN";

  if (method === "storage_deposit" || method.includes("storage")) {
    category = "Storage Lease";
    purposeTitle = "Account storage deposit";
    heuristicRule = "Method signature 'storage_deposit' corresponds to NEAR NEP-145 storage staking bond.";
    attributionStatus = "INFERRED";
  } else if (method.includes("swap") || method.includes("ft_transfer_call") || receiver.includes("ref-finance")) {
    category = "Smart Contract Execution";
    purposeTitle = "Token swap";
    heuristicRule = "Receiver or method matches decentralized exchange (DEX) liquidity contract patterns.";
    attributionStatus = "INFERRED";
  } else if (method.includes("stake") || receiver.includes("pool")) {
    category = "Treasury & Staking";
    purposeTitle = "Validator staking deposit";
    heuristicRule = "Receiver pool or method indicates proof-of-stake validator interaction.";
    attributionStatus = "INFERRED";
  } else if (amountNear > 0 && !methodName) {
    category = "Autonomous Payment";
    purposeTitle = "Transfer to account";
    heuristicRule = "Native NEAR value transfer without smart contract method invocation.";
    attributionStatus = "INFERRED";
  } else if (method.includes("infer") || method.includes("task") || receiver.includes("agent") || receiver.includes("oracle")) {
    category = "AI Inference & Compute";
    purposeTitle = `AI compute call: ${methodName || "run"}()`;
    heuristicRule = "Contract name or method signature suggests AI inference or autonomous agent tool execution.";
    attributionStatus = "INFERRED";
  }

  const networkFeeNear = tokensBurntYocto === null ? null : yoctoToNear(tokensBurntYocto, 12);

  const attribution: TaskAttribution = {
    status: attributionStatus,
    category,
    taskId: null, // Explicitly null: no fake task IDs!
    agentId: null,
    proposalId: null,
    agentName: null,
    promptSnippet: null,
    source: attributionStatus === "INFERRED" ? "HEURISTIC" : "NONE",
    reasoning: heuristicRule,
    integrationConnected: false,
    integrationNotice:
      "Agent Execution Log Integration: Not Connected. On-chain records verify transaction execution, but linking this transfer to a specific agent mission or user prompt requires streaming agent runtime execution logs.",
  };

  const evidence: EvidenceBreakdown = {
    onChainFacts: {
      hash,
      blockHeight,
      blockTimestamp,
      sender,
      recipient,
      rawActionType: methodName ? "FunctionCall" : amountNear > 0 ? "Transfer" : "Execution",
      rawMethodName: methodName,
      rawDepositYocto: depositYocto,
      rawTokensBurntYocto: tokensBurntYocto,
      rawGasBurntTgas: gasBurntTgas,
      rawExecutionStatus: status,
    },
    calculatedFields: {
      amountNear,
      networkFeeNear,
      feeIsExactBurnt,
      calculationFormula: feeIsExactBurnt
        ? "Actual network fee = transaction outcome plus all receipt outcome tokens_burnt, summed in yoctoNEAR."
        : "Actual network fee unavailable: complete transaction and receipt outcome data was not returned. No estimate is included.",
    },
    inferences: {
      purposeTitle,
      heuristicRule,
    },
    unavailableFields: [
      "Off-chain agent prompt text",
      "Task / workflow identifier",
      "External invoice reference",
      ...(tokensBurntYocto === null ? ["Complete transaction fee outcomes"] : []),
    ],
  };

  return { attribution, evidence };
}

/**
 * Synthetic demo dataset with realistic evidence records and explicit DEMO flags.
 * Includes completed outlays, inbound refills, and a failed transaction to verify separation.
 */
export function getDemoTransactions(targetAccount = "agent-autonomous.near"): {
  receipts: AgentReceipt[];
  summary: AccountFinancialSummary;
} {
  const now = Date.now();

  const demoItems: Array<{
    hash: string;
    blockHeight: number;
    timeOffset: number;
    sender: string;
    recipient: string;
    direction: TransactionDirection;
    method: string | null;
    amountNear: number;
    depositYocto: string;
    tokensBurntYocto: string;
    gasTgas: number;
    status: "SUCCESS" | "FAILURE";
    isRefund?: boolean;
  }> = [
    {
      hash: "8F4aX2qK9k11vLmN8P2aX7rQ3wE9yB1cZ0pL2mR5uV8t",
      blockHeight: 128945201,
      timeOffset: 12 * 60 * 1000, // 12 mins ago
      sender: targetAccount,
      recipient: "v2.ref-finance.near",
      direction: "OUTGOING",
      method: "swap",
      amountNear: 2.5,
      depositYocto: "2500000000000000000000000",
      tokensBurntYocto: "3400000000000000000000",
      gasTgas: 42.1,
      status: "SUCCESS",
    },
    {
      hash: "4KmN9qP2aX7rQ3wE9yB1cZ0pL2mR5uV8t8F4aX2kL11v",
      blockHeight: 128943110,
      timeOffset: 45 * 60 * 1000, // 45 mins ago
      sender: targetAccount,
      recipient: "oracle-feed.near",
      direction: "OUTGOING",
      method: "request_price_update",
      amountNear: 0.05,
      depositYocto: "50000000000000000000000",
      tokensBurntYocto: "1200000000000000000000",
      gasTgas: 18.5,
      status: "SUCCESS",
    },
    {
      hash: "7rQ3wE9yB1cZ0pL2mR5uV8t8F4aX2qK9k11vLmN8P2aX",
      blockHeight: 128938920,
      timeOffset: 3 * 3600 * 1000, // 3 hours ago
      sender: "treasury-multisig.near",
      recipient: targetAccount,
      direction: "INCOMING",
      method: null,
      amountNear: 25.0,
      depositYocto: "25000000000000000000000000",
      tokensBurntYocto: "450000000000000000000",
      gasTgas: 5.2,
      status: "SUCCESS",
    },
    {
      hash: "2mR5uV8t8F4aX2qK9k11vLmN8P2aX7rQ3wE9yB1cZ0pL",
      blockHeight: 128929000,
      timeOffset: 7 * 3600 * 1000, // 7 hours ago
      sender: targetAccount,
      recipient: "astrodao.near",
      direction: "OUTGOING",
      method: "vote_approve",
      amountNear: 0.0,
      depositYocto: "0",
      tokensBurntYocto: "1900000000000000000000",
      gasTgas: 24.8,
      status: "SUCCESS",
    },
    {
      hash: "1cZ0pL2mR5uV8t8F4aX2qK9k11vLmN8P2aX7rQ3wE9y",
      blockHeight: 128912440,
      timeOffset: 14 * 3600 * 1000, // 14 hours ago
      sender: targetAccount,
      recipient: "wrap.near",
      direction: "OUTGOING",
      method: "storage_deposit",
      amountNear: 0.0125,
      depositYocto: "12500000000000000000000",
      tokensBurntYocto: "950000000000000000000",
      gasTgas: 12.3,
      status: "SUCCESS",
    },
    {
      hash: "9k11vLmN8P2aX7rQ3wE9yB1cZ0pL2mR5uV8t8F4aX2qK",
      blockHeight: 128890200,
      timeOffset: 20 * 3600 * 1000, // 20 hours ago
      sender: targetAccount,
      recipient: "subagent-executor.near",
      direction: "OUTGOING",
      method: null,
      amountNear: 4.8,
      depositYocto: "4800000000000000000000000",
      tokensBurntYocto: "500000000000000000000",
      gasTgas: 6.1,
      status: "SUCCESS",
    },
    {
      // FAILED TRANSACTION EXAMPLE: Attempted 1.2 NEAR transfer that failed on-chain
      hash: "3wE9yB1cZ0pL2mR5uV8t8F4aX2qK9k11vLmN8P2aX7rQ",
      blockHeight: 128850020,
      timeOffset: 28 * 3600 * 1000, // 28 hours ago
      sender: targetAccount,
      recipient: "ai-compute-cluster.near",
      direction: "OUTGOING",
      method: "run_inference_batch",
      amountNear: 1.2,
      depositYocto: "1200000000000000000000000",
      tokensBurntYocto: "8200000000000000000000",
      gasTgas: 88.4,
      status: "FAILURE",
    },
    {
      hash: "5uV8t8F4aX2qK9k11vLmN8P2aX7rQ3wE9yB1cZ0pL2mR",
      blockHeight: 128820010,
      timeOffset: 34 * 3600 * 1000, // 34 hours ago
      sender: "sponsor-fund.near",
      recipient: targetAccount,
      direction: "INCOMING",
      method: null,
      amountNear: 15.0,
      depositYocto: "15000000000000000000000000",
      tokensBurntYocto: "450000000000000000000",
      gasTgas: 4.5,
      status: "SUCCESS",
    },
  ];

  const receipts: AgentReceipt[] = demoItems.map((raw, idx) => {
    const timestamp = now - raw.timeOffset;
    const { attribution, evidence } = buildEvidenceAndAttribution(
      raw.method,
      raw.recipient,
      raw.amountNear,
      raw.hash,
      raw.blockHeight,
      timestamp,
      raw.sender,
      raw.recipient,
      raw.depositYocto,
      raw.tokensBurntYocto,
      raw.gasTgas,
      raw.status,
      true
    );

    const feeNear = yoctoToNear(raw.tokensBurntYocto, 6);

    return {
      id: `${raw.hash}_${idx}`,
      hash: raw.hash,
      blockHeight: raw.blockHeight,
      blockTimestamp: timestamp,
      signerId: raw.sender,
      predecessorId: raw.sender,
      receiverId: raw.recipient,
      direction: raw.direction,
      actionType: raw.method ? "FunctionCall" : raw.amountNear > 0 ? "Transfer" : "Execution",
      methodName: raw.method,
      argsPreview: raw.method ? `{"method":"${raw.method}"}` : null,
      amountNear: raw.amountNear,
      amountYocto: raw.depositYocto,
      amountUsd: Number((raw.amountNear * NEAR_USD_ESTIMATE).toFixed(2)),
      assetId: "native:near",
      assetSymbol: "NEAR",
      gasBurntTgas: raw.gasTgas,
      networkFeeNear: feeNear,
      networkFeeYocto: raw.tokensBurntYocto,
      feeIsExactBurnt: true,
      status: raw.status,
      isRealOnChain: false, // Explicitly marked as demo
      isRefund: !!raw.isRefund,
      explorerUrl: `${NEAR_EXPLORER_URL}/txns/${raw.hash}`,
      attribution,
      evidence,
      logs: raw.status === "FAILURE" ? ["Smart contract panic: Execution out of gas limit in subcall"] : ["Execution outcome: SuccessValue(0x)"],
    };
  });

  // Calculate completed spending: ONLY completed outgoing transfers!
  const totalOutgoing = receipts
    .filter((r) => r.direction === "OUTGOING" && r.status === "SUCCESS")
    .reduce((acc, curr) => acc + curr.amountNear, 0);

  // Failed outlays reported separately
  const failedOutlays = receipts
    .filter((r) => r.direction === "OUTGOING" && r.status === "FAILURE")
    .reduce((acc, curr) => acc + curr.amountNear, 0);

  const totalIncoming = receipts
    .filter((r) => r.direction === "INCOMING" && r.status === "SUCCESS")
    .reduce((acc, curr) => acc + curr.amountNear, 0);

  const totalFeeYocto = receipts.reduce(
    (sum, receipt) => sum + (receipt.networkFeeYocto ? BigInt(receipt.networkFeeYocto) : BigInt(0)),
    BigInt(0)
  );
  const totalFee = yoctoToNear(totalFeeYocto, 12);
  const unavailableFeeCount = receipts.filter((receipt) => receipt.networkFeeYocto === null).length;
  const successCount = receipts.filter((r) => r.status === "SUCCESS").length;
  const failureCount = receipts.filter((r) => r.status === "FAILURE").length;

  const summary: AccountFinancialSummary = {
    accountId: targetAccount,
    network: NEAR_NETWORK_LABEL,
    liveBalanceNear: 42.85,
    storageUsageBytes: 42918,
    totalOutgoingNear: Number(totalOutgoing.toFixed(4)),
    totalIncomingNear: Number(totalIncoming.toFixed(4)),
    netVolumeNear: Number((totalIncoming - totalOutgoing).toFixed(4)),
    totalNetworkFeeNear: totalFee,
    totalNetworkFeeYocto: totalFeeYocto.toString(),
    networkFeeUnavailableCount: unavailableFeeCount,
    feeCalculationNote: "Sum of transaction and all receipt outcome tokens_burnt values. Missing outcome data is excluded and counted as unavailable.",
    totalTransactions: receipts.length,
    successCount,
    failureCount,
    failedOutlaysNear: Number(failedOutlays.toFixed(4)),
    refundCount: 0,
    refundTotalNear: 0,
    successRate: Number(((successCount / receipts.length) * 100).toFixed(1)),
    isDemo: true,
    sourceApi: "Synthetic Demo Dataset",
    generatedAt: new Date().toISOString(),
    howWeCalculatedThis: {
      completedSpending: "Sum of all confirmed outgoing transfers where status == 'SUCCESS'. Excludes failed attempts and gas fees.",
      incomingCredits: "Sum of all confirmed inbound transfers received by this account.",
      networkFees: "Sum of transaction and receipt outcome tokens_burnt; missing actual outcomes are excluded and reported as unavailable.",
      dailyBudgetWindow: "Calculated from 00:00:00 to now in the client's local timezone.",
      dataLimitations: "Synthetic demo dataset created for UI demonstration. No real on-chain assets were moved.",
    },
  };

  return { receipts, summary };
}

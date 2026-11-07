import {
  AgentReceipt,
  AccountFinancialSummary,
  TransactionDirection,
} from "@/types/receipt";
import {
  yoctoToNear,
  buildEvidenceAndAttribution,
  NEAR_USD_ESTIMATE,
  YOCTO_PER_NEAR,
} from "./near";
import {
  getAgentEventByTxHash,
  getAgentConnectionForAccount,
} from "./agent-store";
import { getVerifiedProposalAttributionByTxHash } from "@/agent/proposal-store";
import { NEAR_NETWORK_LABEL, NEAR_RPC_URL, NEAR_TRANSACTIONS_API_URL, NEAR_EXPLORER_URL } from "./near-network";

const FASTNEAR_TX_URL = `${NEAR_TRANSACTIONS_API_URL}/v0/account`;
const FASTNEAR_BATCH_TX_URL = `${NEAR_TRANSACTIONS_API_URL}/v0/transactions`;

interface FastNearTxItem {
  account_id: string;
  transaction_hash: string;
  tx_block_height: number;
  tx_block_timestamp: string; // nanoseconds string
  tx_index: number;
  is_signer: boolean;
  is_delegated_signer: boolean;
  is_real_signer: boolean;
  is_any_signer: boolean;
  is_predecessor: boolean;
  is_explicit_refund_to: boolean;
  is_receiver: boolean;
  is_real_receiver?: boolean;
  is_function_call: boolean;
  is_action_arg: boolean;
  is_event_log: boolean;
  is_success: boolean;
}

interface FastNearBatchTxItem {
  transaction: {
    hash: string;
    signer_id: string;
    receiver_id: string;
    actions: Array<{
      FunctionCall?: { method_name: string; deposit: string; gas: number };
      Transfer?: { deposit: string };
      Delegate?: { delegate_action: { sender_id: string; receiver_id: string; actions: any[] } };
      [key: string]: any;
    }>;
  };
  execution_outcome?: {
    block_hash: string;
    block_timestamp: number;
    block_height: number;
    outcome: {
      gas_burnt: number;
      tokens_burnt: string; // yoctoNEAR string
      status: any;
      logs: string[];
    };
  };
  receipts?: Array<{
    execution_outcome?: {
      outcome?: { gas_burnt?: number; tokens_burnt?: string; logs?: string[] };
    };
  }>;
}

interface FastNearTransferItem {
  account_id: string;
  action_index: number;
  amount: string; // yocto
  asset_id: string;
  asset_type: string;
  block_height: string;
  block_timestamp: string; // nanoseconds
  human_amount: number | null;
  method_name: string | null;
  other_account_id: string;
  predecessor_id: string;
  receipt_account_id: string;
  receipt_id: string;
  signer_id: string;
  transaction_id: string;
  transfer_type: string;
  usd_amount: number | null;
}

/**
 * Server-side: Fetches live account balance and storage from NEAR RPC
 */
export async function fetchNearAccountState(accountId: string): Promise<{
  balanceNear: number;
  storageUsageBytes: number;
  exists: boolean;
}> {
  try {
    const res = await fetch(NEAR_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "account-query",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
      next: { revalidate: 10 },
    });

    const data = await res.json();
    if (data.error || !data.result) {
      return { balanceNear: 0, storageUsageBytes: 0, exists: false };
    }

    const balanceNear = yoctoToNear(data.result.amount, 4);
    const storageUsageBytes = Number(data.result.storage_usage || 0);
    return { balanceNear, storageUsageBytes, exists: true };
  } catch (err) {
    console.error("Failed to query NEAR RPC view_account:", err);
    return { balanceNear: 0, storageUsageBytes: 0, exists: false };
  }
}

/**
 * Server-side: Queries FastNear Transactions API and Transfers API,
 * batches transaction details, extracts actual tokens_burnt gas fees,
 * normalizes spending, and generates evidence-first receipts.
 */
export async function fetchLiveNearReceipts(accountId: string, limit = 50): Promise<{
  receipts: AgentReceipt[];
  summary: AccountFinancialSummary;
}> {
  const cleanAccountId = accountId.trim().toLowerCase();

  // 1. Fetch live RPC account balance & storage
  const accountState = await fetchNearAccountState(cleanAccountId);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.FASTNEAR_API_KEY) {
    requestHeaders["Authorization"] = `Bearer ${process.env.FASTNEAR_API_KEY}`;
  }

  // 2. Query FastNear transactions and transfers in parallel
  const [txsRes] = await Promise.allSettled([
    fetch(FASTNEAR_TX_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        account_id: cleanAccountId,
        limit,
        desc: true,
      }),
      next: { revalidate: 15 },
    }),
  ]);

  let isRateLimited = false;
  if (txsRes.status === "fulfilled" && txsRes.value.status === 429) isRateLimited = true;

  if (isRateLimited) {
    throw new Error(
      "FastNear API rate limit exceeded (HTTP 429). Please wait a moment or configure FASTNEAR_API_KEY in .env.local."
    );
  }

  let rawTxs: FastNearTxItem[] = [];
  if (txsRes.status === "fulfilled" && txsRes.value.ok) {
    try {
      const parsed = await txsRes.value.json();
      if (Array.isArray(parsed.account_txs)) {
        rawTxs = parsed.account_txs;
      }
    } catch (e) {
      console.warn("Failed to parse FastNear txs:", e);
    }
  }

  // The documented Testnet Transactions API exposes account history and transaction
  // details, but no compatible /v0/transfers operation. Derive transfer evidence
  // from the returned canonical transaction actions below instead of querying Mainnet.
  const rawTransfers: FastNearTransferItem[] = [];

  // 3. Fetch every transaction's execution outcomes in documented batches of 20.
  // FastNear returns each transaction outcome and its descendant receipt outcomes.
  const batchTxMap = new Map<string, FastNearBatchTxItem>();
  const txHashesToQuery = rawTxs.map((t) => t.transaction_hash);
  for (let offset = 0; offset < txHashesToQuery.length; offset += 20) {
    const hashBatch = txHashesToQuery.slice(offset, offset + 20);
    try {
      const batchRes = await fetch(FASTNEAR_BATCH_TX_URL, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ tx_hashes: hashBatch }),
        next: { revalidate: 30 },
      });
      if (batchRes.ok) {
        const batchData = await batchRes.json();
        if (Array.isArray(batchData.transactions)) {
          for (const item of batchData.transactions) {
            if (item.transaction?.hash) batchTxMap.set(item.transaction.hash, item);
          }
        }
      }
    } catch (e) {
      console.warn("Optional FastNear batch tx lookup skipped:", e);
    }
  }

  // 4. Map transfers by transaction_id for fast lookup
  const transferMap = new Map<string, FastNearTransferItem[]>();
  for (const t of rawTransfers) {
    if (!t.transaction_id) continue;
    const existing = transferMap.get(t.transaction_id) || [];
    existing.push(t);
    transferMap.set(t.transaction_id, existing);
  }

  // 5. Build unified normalized receipts
  const receipts: AgentReceipt[] = [];
  const processedHashes = new Set<string>();

  for (let i = 0; i < rawTxs.length; i++) {
    const tx = rawTxs[i];
    if (processedHashes.has(tx.transaction_hash)) continue;
    processedHashes.add(tx.transaction_hash);

    const timestampMs = Math.floor(Number(tx.tx_block_timestamp) / 1_000_000);
    const associatedTransfers = transferMap.get(tx.transaction_hash) || [];
    const batchDetails = batchTxMap.get(tx.transaction_hash);

    // Verify that the monitored account was an actual party to the transaction
    // (signer, predecessor, or receiver) rather than merely referenced in third-party
    // contract arguments or event logs.
    const isTransferParticipant = associatedTransfers.some(
      (tr) =>
        tr.predecessor_id?.toLowerCase() === cleanAccountId ||
        tr.receipt_account_id?.toLowerCase() === cleanAccountId ||
        tr.signer_id?.toLowerCase() === cleanAccountId
    );

    const isParticipant =
      tx.is_signer ||
      tx.is_real_signer ||
      tx.is_any_signer ||
      tx.is_predecessor ||
      tx.is_receiver ||
      tx.is_real_receiver ||
      isTransferParticipant ||
      Boolean(
        batchDetails &&
          (batchDetails.transaction.signer_id?.toLowerCase() === cleanAccountId ||
            batchDetails.transaction.receiver_id?.toLowerCase() === cleanAccountId)
      );

    if (!isParticipant) {
      continue;
    }

    // Direction & counterparty resolution
    let direction: TransactionDirection = "OUTGOING";
    let transferAmountNear = 0;
    let transferAmountYocto = "0";
    let methodName: string | null = null;
    let receiverId = tx.account_id;
    let signerId = tx.is_signer ? cleanAccountId : "counterparty.near";
    let predecessorId = cleanAccountId;
    let isRefund = tx.is_explicit_refund_to || false;

    // Check batch details for exact actions and attached deposit
    if (batchDetails) {
      if (batchDetails.transaction.signer_id) {
        signerId = batchDetails.transaction.signer_id;
      }
      if (batchDetails.transaction.receiver_id) {
        receiverId = batchDetails.transaction.receiver_id;
      }
      if (Array.isArray(batchDetails.transaction.actions)) {
        for (const act of batchDetails.transaction.actions) {
          if (act.FunctionCall) {
            methodName = act.FunctionCall.method_name;
            if (act.FunctionCall.deposit && act.FunctionCall.deposit !== "0") {
              transferAmountYocto = act.FunctionCall.deposit;
              transferAmountNear += yoctoToNear(act.FunctionCall.deposit, 6);
            }
          } else if (act.Transfer) {
            if (act.Transfer.deposit && act.Transfer.deposit !== "0") {
              transferAmountYocto = act.Transfer.deposit;
              transferAmountNear += yoctoToNear(act.Transfer.deposit, 6);
            }
          } else if (act.Delegate?.delegate_action) {
            predecessorId = act.Delegate.delegate_action.sender_id;
            receiverId = act.Delegate.delegate_action.receiver_id;
          }
        }
      }
    }

    // Merge associated indexed token transfers
    if (associatedTransfers.length > 0) {
      let isIncomingTransfer = false;
      let isOutgoingTransfer = false;

      for (const tr of associatedTransfers) {
        if (tr.asset_id === "native:near" || tr.asset_type === "Near") {
          const rawVal =
            tr.human_amount !== null && tr.human_amount !== undefined
              ? tr.human_amount
              : yoctoToNear(tr.amount, 6);
          const absVal = Math.abs(rawVal);
          // If we haven't already counted deposit from batch actions, add transfer amount
          if (transferAmountNear === 0) {
            transferAmountNear = absVal;
            transferAmountYocto = tr.amount.replace("-", "");
          }
        }
        if (tr.method_name && !methodName) methodName = tr.method_name;

        if (tr.receipt_account_id === cleanAccountId && tr.predecessor_id !== cleanAccountId) {
          isIncomingTransfer = true;
          receiverId = cleanAccountId;
          predecessorId = tr.predecessor_id || tr.other_account_id || tr.signer_id;
          signerId = tr.signer_id;
        } else if (tr.predecessor_id === cleanAccountId || tr.signer_id === cleanAccountId) {
          isOutgoingTransfer = true;
          predecessorId = cleanAccountId;
          receiverId = tr.receipt_account_id || tr.other_account_id;
          signerId = tr.signer_id || cleanAccountId;
        }
      }

      if (isIncomingTransfer && !isOutgoingTransfer) {
        direction = "INCOMING";
      } else if (isOutgoingTransfer) {
        direction = "OUTGOING";
      }
    } else if (tx.is_any_signer || tx.is_predecessor) {
      direction = "OUTGOING";
      predecessorId = cleanAccountId;
    } else if (tx.is_receiver) {
      direction = "INCOMING";
      receiverId = cleanAccountId;
    }

    // A transaction's actual fee includes the transaction outcome and every
    // descendant receipt outcome. Do not substitute an estimate when any outcome
    // is missing: report that transaction fee as unavailable instead.
    const transactionBurnt = batchDetails?.execution_outcome?.outcome?.tokens_burnt;
    const receiptOutcomes = batchDetails?.receipts;
    let tokensBurntYocto: string | null = null;
    if (transactionBurnt && /^\d+$/.test(transactionBurnt) && Array.isArray(receiptOutcomes)) {
      try {
        const totalBurnt = receiptOutcomes.reduce((sum, receipt) => {
          const burnt = receipt.execution_outcome?.outcome?.tokens_burnt;
          if (!burnt || !/^\d+$/.test(burnt)) throw new Error("Incomplete receipt fee data");
          return sum + BigInt(burnt);
        }, BigInt(transactionBurnt));
        tokensBurntYocto = totalBurnt.toString();
      } catch {
        tokensBurntYocto = null;
      }
    }
    const gasBurntTgas = batchDetails?.execution_outcome?.outcome?.gas_burnt
      ? Number((batchDetails.execution_outcome.outcome.gas_burnt / 1e12).toFixed(3))
      : 0;
    const feeIsExactBurnt = tokensBurntYocto !== null;
    const networkFeeNear = tokensBurntYocto === null ? null : yoctoToNear(tokensBurntYocto, 12);
    const status: "SUCCESS" | "FAILURE" = tx.is_success ? "SUCCESS" : "FAILURE";

    // Build evidence-first task attribution
    const { attribution, evidence } = buildEvidenceAndAttribution(
      methodName,
      receiverId,
      transferAmountNear,
      tx.transaction_hash,
      tx.tx_block_height,
      timestampMs || Date.now(),
      signerId,
      receiverId,
      transferAmountYocto,
      tokensBurntYocto,
      gasBurntTgas,
      status,
      feeIsExactBurnt
    );

    // Proposal workflow records are authoritative for task attribution. Require
    // exact hash/account/task linkage plus on-chain sender, recipient, and amount.
    const matchedProposal = getVerifiedProposalAttributionByTxHash(cleanAccountId, tx.transaction_hash);
    if (
      matchedProposal &&
      matchedProposal.proposal.payerAccount.toLowerCase() === signerId.toLowerCase() &&
      matchedProposal.proposal.recipientAccount.toLowerCase() === receiverId.toLowerCase() &&
      matchedProposal.proposal.amountYocto === transferAmountYocto
    ) {
      const { proposal, task } = matchedProposal;
      attribution.status = "CONFIRMED";
      attribution.taskId = task.taskId;
      attribution.agentId = proposal.agentId;
      attribution.proposalId = proposal.proposalId;
      attribution.agentName = proposal.agentName;
      attribution.promptSnippet = proposal.promptSnippet || null;
      attribution.source = "PROPOSAL_WORKFLOW";
      attribution.integrationConnected = true;
      attribution.reasoning = `Confirmed by verified proposal ${proposal.proposalId} and task ${task.taskId}, matched to this on-chain payment.`;
      attribution.integrationNotice = `Stored Testnet proposal and completed task match this transaction hash, payer, recipient, and exact amount.`;
      evidence.inferences.purposeTitle = proposal.actionDescription || proposal.purpose;
      evidence.unavailableFields = evidence.unavailableFields.filter((field) =>
        !["Task / workflow identifier", "External invoice reference"].includes(field)
      );
    } else {
      // Preserve existing authenticated event matching for workflows that have
      // such a stored record, but never infer task details from transaction shape.
      const matchedAgentEvent = getAgentEventByTxHash(cleanAccountId, tx.transaction_hash);
      if (matchedAgentEvent) {
        attribution.status = "CONFIRMED";
        attribution.taskId = matchedAgentEvent.taskId;
        attribution.agentId = matchedAgentEvent.agentId;
        attribution.agentName = matchedAgentEvent.agentName;
        attribution.promptSnippet = matchedAgentEvent.promptSnippet || null;
        attribution.source = "AGENT_LOG_INTEGRATION";
        attribution.integrationConnected = true;
        attribution.reasoning = `Confirmed by stored authenticated agent event for task ${matchedAgentEvent.taskId}, matched to this transaction hash and payer.`;
        attribution.integrationNotice = `Stored agent event matches this transaction hash and payer.`;
        if (matchedAgentEvent.actionDescription) evidence.inferences.purposeTitle = matchedAgentEvent.actionDescription;
      }
    }

    receipts.push({
      id: `${tx.transaction_hash}_${i}`,
      hash: tx.transaction_hash,
      blockHeight: tx.tx_block_height,
      blockTimestamp: timestampMs || Date.now(),
      signerId,
      predecessorId,
      receiverId,
      direction,
      actionType: methodName ? "FunctionCall" : transferAmountNear > 0 ? "Transfer" : "Execution",
      methodName,
      argsPreview: methodName ? `{"method":"${methodName}"}` : null,
      amountNear: Number(transferAmountNear.toFixed(6)),
      amountYocto: transferAmountYocto,
      amountUsd: Number((transferAmountNear * NEAR_USD_ESTIMATE).toFixed(2)),
      assetId: "native:near",
      assetSymbol: "NEAR",
      gasBurntTgas,
      networkFeeNear,
      networkFeeYocto: tokensBurntYocto,
      feeIsExactBurnt,
      status,
      isRealOnChain: true,
      isRefund,
      explorerUrl: `${NEAR_EXPLORER_URL}/txns/${tx.transaction_hash}`,
      attribution,
      evidence,
      logs: batchDetails?.execution_outcome?.outcome?.logs || [
        `Verified on-chain execution (Block #${tx.tx_block_height})`,
        tx.is_success ? "Status: Final Execution Succeeded" : "Status: Execution Reverted / Failed",
      ],
    });
  }

  // Also include any standalone token transfers not captured in txs array
  for (const tr of rawTransfers) {
    if (!tr.transaction_id || processedHashes.has(tr.transaction_id)) continue;
    processedHashes.add(tr.transaction_id);

    const timestampMs = Math.floor(Number(tr.block_timestamp) / 1_000_000);
    const rawAmount =
      tr.human_amount !== null && tr.human_amount !== undefined
        ? tr.human_amount
        : yoctoToNear(tr.amount, 6);
    const amountNear = Math.abs(rawAmount);

    let isOutgoing = false;
    let signerId = tr.signer_id || cleanAccountId;
    let predecessorId = tr.predecessor_id || cleanAccountId;
    let receiverId = tr.receipt_account_id || cleanAccountId;

    if (tr.receipt_account_id === cleanAccountId && tr.predecessor_id !== cleanAccountId) {
      isOutgoing = false;
      receiverId = cleanAccountId;
      predecessorId = tr.predecessor_id || tr.other_account_id;
    } else if (tr.predecessor_id === cleanAccountId || tr.signer_id === cleanAccountId) {
      isOutgoing = true;
      predecessorId = cleanAccountId;
      receiverId = tr.receipt_account_id || tr.other_account_id;
    } else if (rawAmount < 0) {
      isOutgoing = true;
    }

    const direction: TransactionDirection = isOutgoing ? "OUTGOING" : "INCOMING";
    // Transfer index rows do not include finalized transaction + receipt outcomes,
    // so their actual fee is unknown and must not be estimated into totals.
    const tokensBurntYocto: string | null = null;
    const networkFeeNear: number | null = null;

    const { attribution, evidence } = buildEvidenceAndAttribution(
      tr.method_name,
      receiverId,
      amountNear,
      tr.transaction_id,
      Number(tr.block_height) || 0,
      timestampMs || Date.now(),
      signerId,
      receiverId,
      tr.amount.replace("-", ""),
      tokensBurntYocto,
      8.5,
      "SUCCESS",
      false
    );

    // Match against authenticated agent runtime events
    const matchedTrEvent = getAgentEventByTxHash(cleanAccountId, tr.transaction_id);
    if (matchedTrEvent) {
      attribution.status = "CONFIRMED";
      attribution.taskId = matchedTrEvent.taskId;
      attribution.agentId = matchedTrEvent.agentId;
      attribution.agentName = matchedTrEvent.agentName;
      attribution.promptSnippet = matchedTrEvent.promptSnippet || null;
      attribution.source = "AGENT_LOG_INTEGRATION";
      attribution.integrationConnected = true;
      attribution.reasoning = `Confirmed by stored authenticated agent event for task ${matchedTrEvent.taskId}, matched to this transaction hash and payer.`;
      attribution.integrationNotice = `Stored agent event matches this transaction hash and payer.`;
      if (matchedTrEvent.actionDescription) {
        evidence.inferences.purposeTitle = matchedTrEvent.actionDescription;
      }
    }

    receipts.push({
      id: `${tr.transaction_id}_tr`,
      hash: tr.transaction_id,
      blockHeight: Number(tr.block_height) || 0,
      blockTimestamp: timestampMs || Date.now(),
      signerId,
      predecessorId,
      receiverId,
      direction,
      actionType: tr.method_name ? "FunctionCall + Transfer" : "Transfer",
      methodName: tr.method_name,
      argsPreview: null,
      amountNear: Number(amountNear.toFixed(6)),
      amountYocto: tr.amount.replace("-", ""),
      amountUsd: Number((amountNear * NEAR_USD_ESTIMATE).toFixed(2)),
      assetId: tr.asset_id || "native:near",
      assetSymbol: "NEAR",
      gasBurntTgas: 8.5,
      networkFeeNear,
      networkFeeYocto: tokensBurntYocto,
      feeIsExactBurnt: false,
      status: "SUCCESS",
      isRealOnChain: true,
      isRefund: false,
      explorerUrl: `${NEAR_EXPLORER_URL}/txns/${tr.transaction_id}`,
      attribution,
      evidence,
      logs: [`Transfer evidence fetched from NEAR Testnet`],
    });
  }

  // Sort descending by timestamp
  receipts.sort((a, b) => b.blockTimestamp - a.blockTimestamp);

  // 6. Aggregate financial metrics accurately
  // Rule: Exclude failed transfers from completed spending! Report failed attempts separately.
  const totalOutgoing = receipts
    .filter((r) => r.direction === "OUTGOING" && r.status === "SUCCESS")
    .reduce((acc, curr) => acc + curr.amountNear, 0);

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
  const unavailableFeeCount = receipts.filter((receipt) => receipt.networkFeeYocto === null).length;
  const successCount = receipts.filter((r) => r.status === "SUCCESS").length;
  const failureCount = receipts.filter((r) => r.status === "FAILURE").length;

  const refundItems = receipts.filter((r) => r.isRefund);
  const refundTotalNear = refundItems.reduce((acc, curr) => acc + curr.amountNear, 0);

  const agentConnection = getAgentConnectionForAccount(cleanAccountId);
  const verifiedCount = receipts.filter((r) => r.attribution.status === "CONFIRMED").length;

  const summary: AccountFinancialSummary = {
    accountId: cleanAccountId,
    network: NEAR_NETWORK_LABEL,
    liveBalanceNear: accountState.balanceNear,
    storageUsageBytes: accountState.storageUsageBytes,
    totalOutgoingNear: Number(totalOutgoing.toFixed(4)),
    totalIncomingNear: Number(totalIncoming.toFixed(4)),
    netVolumeNear: Number((totalIncoming - totalOutgoing).toFixed(4)),
    totalNetworkFeeNear: yoctoToNear(totalFeeYocto, 12),
    totalNetworkFeeYocto: totalFeeYocto.toString(),
    networkFeeUnavailableCount: unavailableFeeCount,
    feeCalculationNote: "Sum of transaction and all receipt outcome tokens_burnt values. Missing outcome data is excluded and counted as unavailable.",
    totalTransactions: receipts.length,
    successCount,
    failureCount,
    failedOutlaysNear: Number(failedOutlays.toFixed(4)),
    refundCount: refundItems.length,
    refundTotalNear: Number(refundTotalNear.toFixed(4)),
    successRate: receipts.length > 0 ? Number(((successCount / receipts.length) * 100).toFixed(1)) : 100,
    connectionStatus: agentConnection ? "AGENT_CONNECTED" : "ACCOUNT_MONITORED",
    connectedAgentName: agentConnection?.agentName || null,
    verifiedTasksCount: verifiedCount,
    isDemo: false,
    sourceApi: "FastNear Transactions API + NEAR RPC",
    generatedAt: new Date().toISOString(),
    howWeCalculatedThis: {
      completedSpending: "Sum of all confirmed outgoing transfers where execution status is 'SUCCESS'. Excludes failed transactions and isolated protocol gas fees.",
      incomingCredits: "Sum of all confirmed inbound transfers received by this account.",
      networkFees: "Sum of transaction and all receipt outcome tokens_burnt values. Missing actual outcomes are excluded and counted as unavailable.",
      dailyBudgetWindow: "Calculated from 00:00:00 to now in the client's local timezone.",
      dataLimitations: "Attribution is confirmed only from stored proposal/task or authenticated event records matched to the transaction; otherwise it remains inferred.",
    },
  };

  return { receipts, summary };
}

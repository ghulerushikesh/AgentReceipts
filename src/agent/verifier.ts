import { yoctoToNear } from "@/lib/near";
import { NEAR_RPC_URL } from "@/lib/near-network";

export interface OnChainVerificationResult {
  verified: boolean;
  isSuccessOnChain: boolean;
  blockHeight: number;
  blockHash: string;
  senderId: string;
  receiverId: string;
  amountNear: number;
  depositYocto: string;
  gasBurntTgas: number;
  tokensBurntYocto: string;
  rawStatus: any;
  finalExecutionStatus?: string;
  error?: string;
}

/**
 * Verifies a transaction hash on NEAR Testnet via official JSON-RPC 2.0.
 * Confirms that the transaction exists, settled on-chain, and executed successfully.
 *
 * NEVER claims success if the transaction was not found or failed.
 */
export async function verifyTestnetTransaction(
  txHash: string,
  senderAccountId: string
): Promise<OnChainVerificationResult> {
  const cleanHash = txHash.trim();
  const cleanSender = senderAccountId.trim().toLowerCase();

  try {
    const res = await fetch(NEAR_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `verify-tx-${Date.now()}`,
        method: "tx",
        params: [cleanHash, cleanSender],
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        verified: false,
        isSuccessOnChain: false,
        blockHeight: 0,
        blockHash: "",
        senderId: cleanSender,
        receiverId: "",
        amountNear: 0,
        depositYocto: "0",
        gasBurntTgas: 0,
        tokensBurntYocto: "0",
        rawStatus: null,
        error: `NEAR RPC HTTP error: ${res.status} ${res.statusText}`,
      };
    }

    const data = await res.json();

    if (data.error) {
      const errorMsg =
        data.error.cause?.info?.error_message ||
        data.error.message ||
        "Transaction not found on NEAR testnet";
      return {
        verified: false,
        isSuccessOnChain: false,
        blockHeight: 0,
        blockHash: "",
        senderId: cleanSender,
        receiverId: "",
        amountNear: 0,
        depositYocto: "0",
        gasBurntTgas: 0,
        tokensBurntYocto: "0",
        rawStatus: null,
        error: errorMsg,
      };
    }

    const result = data.result;
    if (!result || !result.transaction) {
      return {
        verified: false,
        isSuccessOnChain: false,
        blockHeight: 0,
        blockHash: "",
        senderId: cleanSender,
        receiverId: "",
        amountNear: 0,
        depositYocto: "0",
        gasBurntTgas: 0,
        tokensBurntYocto: "0",
        rawStatus: null,
        error: "Invalid RPC response: transaction object missing",
      };
    }

    const transaction = result.transaction;
    const outcome = result.transaction_outcome?.outcome;
    const finalExecutionStatus = result.final_execution_status;

    // 1. Strict NEAR Testnet Finality check
    // In NEAR RPC, finalized transactions report final_execution_status: "FINAL".
    // Pending or optimistic states must not be treated as final settlement.
    const isFinal = !result.final_execution_status || result.final_execution_status === "FINAL";

    // 2. Strict On-Chain Failure check
    // Check top-level status, outcome status, and receipt execution outcomes
    const hasFailure = Boolean(
      result.status?.Failure !== undefined ||
        outcome?.status?.Failure !== undefined ||
        (Array.isArray(result.receipts_outcome) &&
          result.receipts_outcome.some(
            (ro: any) => ro?.outcome?.status?.Failure !== undefined
          ))
    );

    // 3. Success status verification
    const hasSuccessStatus = Boolean(
      (result.status &&
        (result.status.SuccessValue !== undefined ||
          result.status.SuccessReceiptId !== undefined)) ||
        (outcome?.status &&
          (outcome.status.SuccessValue !== undefined ||
            outcome.status.SuccessReceiptId !== undefined))
    );

    let isSuccessOnChain = isFinal && !hasFailure && hasSuccessStatus;
    let verificationError: string | undefined = undefined;

    if (!isFinal) {
      verificationError = `Transaction pending: finality is '${finalExecutionStatus}' (expected 'FINAL').`;
      isSuccessOnChain = false;
    } else if (hasFailure) {
      const failReason =
        JSON.stringify(result.status?.Failure || outcome?.status?.Failure) || "Execution reverted";
      verificationError = `Transaction failed on-chain: ${failReason}`;
      isSuccessOnChain = false;
    } else if (!hasSuccessStatus) {
      verificationError = "Transaction execution outcome does not indicate success.";
      isSuccessOnChain = false;
    }

    // Calculate transferred amount from actions
    let totalDepositYocto = BigInt(0);
    if (Array.isArray(transaction.actions)) {
      for (const act of transaction.actions) {
        if (act.Transfer?.deposit) {
          totalDepositYocto += BigInt(act.Transfer.deposit);
        } else if (act.FunctionCall?.deposit) {
          totalDepositYocto += BigInt(act.FunctionCall.deposit);
        }
      }
    }

    const amountNear = yoctoToNear(totalDepositYocto.toString(), 6);

    // Sum actual tokens_burnt and gas_burnt across transaction outcome and all receipt outcomes
    let totalTokensBurntYocto = BigInt(outcome?.tokens_burnt || "0");
    let totalGasBurnt = Number(outcome?.gas_burnt || 0);

    if (Array.isArray(result.receipts_outcome)) {
      for (const ro of result.receipts_outcome) {
        const burnt = ro?.outcome?.tokens_burnt;
        if (burnt && /^\d+$/.test(burnt)) {
          totalTokensBurntYocto += BigInt(burnt);
        }
        if (ro?.outcome?.gas_burnt) {
          totalGasBurnt += Number(ro.outcome.gas_burnt);
        }
      }
    }

    const tokensBurntYocto = totalTokensBurntYocto.toString();
    const gasBurntTgas = Number((totalGasBurnt / 1e12).toFixed(3));

    return {
      verified: !verificationError || isSuccessOnChain,
      isSuccessOnChain,
      blockHeight: outcome?.block_height || 0,
      blockHash: result.transaction_outcome?.block_hash || "",
      senderId: transaction.signer_id || cleanSender,
      receiverId: transaction.receiver_id || "",
      amountNear,
      depositYocto: totalDepositYocto.toString(),
      gasBurntTgas,
      tokensBurntYocto,
      rawStatus: result.status || outcome?.status,
      finalExecutionStatus,
      error: verificationError,
    };
  } catch (err: any) {
    return {
      verified: false,
      isSuccessOnChain: false,
      blockHeight: 0,
      blockHash: "",
      senderId: cleanSender,
      receiverId: "",
      amountNear: 0,
      depositYocto: "0",
      gasBurntTgas: 0,
      tokensBurntYocto: "0",
      rawStatus: null,
      error: err.message || "Failed to reach NEAR Testnet RPC",
    };
  }
}

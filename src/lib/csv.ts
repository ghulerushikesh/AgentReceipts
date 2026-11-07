import { AgentReceipt } from "@/types/receipt";

/**
 * Generates and downloads a clean RFC 4180 compliant CSV statement of agent receipts
 * based exclusively on the currently displayed records and active filters.
 */
export function exportReceiptsToCSV(receipts: AgentReceipt[], accountId: string) {
  if (!receipts || receipts.length === 0) {
    return;
  }

  const headers = [
    "Transaction Hash",
    "Block Height",
    "Timestamp (ISO)",
    "Direction",
    "Sender (From)",
    "Recipient (To)",
    "Asset",
    "Amount (NEAR)",
    "Amount (USD)",
    "Network Fee (NEAR)",
    "Network Fee (yoctoNEAR)",
    "Fee Calculation",
    "Execution Status",
    "Attribution Status",
    "Agent Name",
    "Agent ID",
    "Agent Task ID",
    "Agent Proposal ID",
    "Prompt Snippet",
    "Attribution Category",
    "Inferred Purpose",
    "Attribution Notice",
    "Explorer URL",
  ];

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = receipts.map((r) => [
    escapeCSV(r.hash),
    escapeCSV(r.blockHeight),
    escapeCSV(new Date(r.blockTimestamp).toISOString()),
    escapeCSV(r.direction),
    escapeCSV(r.predecessorId || r.signerId),
    escapeCSV(r.receiverId),
    escapeCSV(r.assetSymbol || "NEAR"),
    escapeCSV(r.amountNear),
    escapeCSV(r.amountUsd),
    escapeCSV(r.networkFeeNear === null ? "" : r.networkFeeNear.toFixed(12)),
    escapeCSV(r.networkFeeYocto || ""),
    escapeCSV(r.feeIsExactBurnt ? "Sum of transaction and receipt tokens_burnt" : "Unavailable: incomplete actual execution outcomes"),
    escapeCSV(r.status),
    escapeCSV(r.attribution?.status || "UNKNOWN"),
    escapeCSV(r.attribution?.agentName || ""),
    escapeCSV(r.attribution?.agentId || ""),
    escapeCSV(r.attribution?.taskId || ""),
    escapeCSV(r.attribution?.proposalId || ""),
    escapeCSV(r.attribution?.promptSnippet || ""),
    escapeCSV(r.attribution?.category || "Uncategorized Action"),
    escapeCSV(r.evidence?.inferences?.purposeTitle || r.actionType),
    escapeCSV(r.attribution?.integrationNotice || "No agent runner logs connected"),
    escapeCSV(r.explorerUrl),
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanAccount = accountId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];

  link.setAttribute("href", url);
  link.setAttribute("download", `agent_receipts_audit_${cleanAccount}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

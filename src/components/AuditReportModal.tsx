"use client";

import React from "react";
import { AgentReceipt, AccountFinancialSummary } from "@/types/receipt";
import { formatTimestamp, truncateHash, NEAR_USD_ESTIMATE } from "@/lib/near";
import { exportReceiptsToCSV } from "@/lib/csv";
import {
  X,
  Printer,
  Download,
  ExternalLink,
  ShieldCheck,
  Info,
  FileCheck2,
  AlertCircle,
} from "lucide-react";

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: AccountFinancialSummary | null;
  receipts: AgentReceipt[];
  accountId: string;
}

export default function AuditReportModal({
  isOpen,
  onClose,
  summary,
  receipts,
  accountId,
}: AuditReportModalProps) {
  if (!isOpen || !summary) return null;

  const now = new Date();
  const reportDateStr = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const completedReceipts = receipts.filter((r) => r.status === "SUCCESS");
  const failedReceipts = receipts.filter((r) => r.status === "FAILURE");

  const completedOutgoingNear = completedReceipts
    .filter((r) => r.direction === "OUTGOING")
    .reduce((sum, r) => sum + r.amountNear, 0);

  const completedIncomingNear = completedReceipts
    .filter((r) => r.direction === "INCOMING")
    .reduce((sum, r) => sum + r.amountNear, 0);

  const totalFeesNear = receipts.reduce((sum, r) => sum + (r.networkFeeNear ?? 0), 0);
  const failedAttemptedNear = failedReceipts
    .filter((r) => r.direction === "OUTGOING")
    .reduce((sum, r) => sum + r.amountNear, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    exportReceiptsToCSV(receipts, accountId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-[#18243A] rounded-2xl border border-[#263750] shadow-modal overflow-hidden my-6 z-10 text-[#F8FAFC]">
        {/* Top Control Bar */}
        <div className="p-4 sm:px-6 border-b border-[#1E2D44] flex items-center justify-between bg-[#142034] print:hidden">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#1E2D44] flex items-center justify-center text-[#20B486]">
              <FileCheck2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F8FAFC]">Agent Financial Audit Report</h3>
              <p className="text-xs text-[#94A3B8]">Reconciliation and evidence summary</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-[#18243A] hover:bg-[#1E2D44] text-[#F8FAFC] text-xs font-medium border border-[#263750] flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#20B486] hover:bg-[#199B72] text-[#101827] text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#1E2D44] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Report Document Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {/* Header Banner */}
          <div className="border-b border-[#1E2D44] pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-[#20B486]">
                  AgentReceipts • Financial Reconciliation
                </span>
                <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight mt-0.5">
                  Autonomous Agent Activity Statement
                </h1>
                <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
                  Account: <strong className="text-[#F8FAFC]">{accountId}</strong> • Network: {summary.network} • Connection: <strong className={summary.connectionStatus === "AGENT_CONNECTED" ? "text-[#20B486]" : "text-[#94A3B8]"}>{summary.connectionStatus === "AGENT_CONNECTED" ? "Agent Connected" : "Account Monitored"}</strong>
                </p>
              </div>

              <div className="text-left sm:text-right text-xs text-[#94A3B8] font-mono">
                <div>Generated: {reportDateStr}</div>
                <div>Client Timezone: {clientTimezone}</div>
                <div>Status: {summary.isDemo ? "DEMO DATASET" : "VERIFIED ON-CHAIN"}</div>
              </div>
            </div>
          </div>

          {/* Audit Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
            <div className="p-3.5 rounded-xl bg-[#121D30] border border-[#263750]">
              <span className="text-[11px] text-[#94A3B8] block font-medium">Completed Outgoing</span>
              <span className="text-lg font-bold text-[#F8FAFC] font-mono tabular-nums block mt-0.5">
                {completedOutgoingNear.toFixed(4)} NEAR
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">
                ≈ ${(completedOutgoingNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121D30] border border-[#263750]">
              <span className="text-[11px] text-[#94A3B8] block font-medium">Completed Incoming</span>
              <span className="text-lg font-bold text-[#20B486] font-mono tabular-nums block mt-0.5">
                +{completedIncomingNear.toFixed(4)} NEAR
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">
                ≈ ${(completedIncomingNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121D30] border border-[#263750]">
              <span className="text-[11px] text-[#94A3B8] block font-medium">Protocol Network Fees</span>
              <span className="text-lg font-bold text-[#F8FAFC] font-mono tabular-nums block mt-0.5">
                {totalFeesNear.toFixed(12)} NEAR
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">Isolated from transfers</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121D30] border border-[#263750]">
              <span className="text-[11px] text-[#94A3B8] block font-medium">Failed Attempts</span>
              <span className="text-lg font-bold text-[#EF4444] font-mono tabular-nums block mt-0.5">
                {failedReceipts.length} ({failedAttemptedNear.toFixed(2)} NEAR)
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">Excluded from spending</span>
            </div>
          </div>

          {/* Reconciliation & Accounting Methodology Notice */}
          <div className="p-4 rounded-xl bg-[#142034] border border-[#263750] text-xs space-y-2">
            <div className="flex items-center space-x-2 text-[#F8FAFC] font-semibold">
              <Info className="w-4 h-4 text-[#3978F6]" />
              <span>How We Calculated This & Reconciliation Notes</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#94A3B8] leading-relaxed text-[11px]">
              <div>
                <strong className="text-[#F8FAFC] block mb-0.5 font-medium">Completed Spending Rules:</strong>
                Includes only confirmed on-chain outgoing transfers where status == &quot;SUCCESS&quot;. Excludes failed transactions ({failedReceipts.length} attempts) and protocol gas fees.
              </div>
              <div>
                <strong className="text-[#F8FAFC] block mb-0.5 font-medium">Protocol Fee Isolation:</strong>
                Network fees reflect tokens burnt in execution receipts ($10^{'{24}'}$ yoctoNEAR/NEAR). Fees are reported separately and never double-counted into principal transfer totals.
              </div>
              <div>
                <strong className="text-[#F8FAFC] block mb-0.5 font-medium">Agent Task Attribution:</strong>
                CONFIRMED attribution is shown only when stored proposal/task or authenticated event records match the transaction. Otherwise, attribution remains INFERRED or UNKNOWN.
              </div>
              <div>
                <strong className="text-[#F8FAFC] block mb-0.5 font-medium">Data Limitations & Disclaimer:</strong>
                Data is sourced from FastNear Transactions API and NEAR Protocol RPC. This document is a financial reconciliation report linked to on-chain evidence, not a statutory certified audit.
              </div>
            </div>
          </div>

          {/* Itemized Activity Statement Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider font-mono">
              Itemized Records ({receipts.length} Transactions)
            </h4>

            <div className="border border-[#263750] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#142034] border-b border-[#1E2D44] text-[#94A3B8] font-mono text-[10px] uppercase">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Transaction Hash</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Counterparty</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-right">Fee</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Attribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D44] font-mono text-[11px]">
                  {receipts.map((r) => {
                    const { formatted } = formatTimestamp(r.blockTimestamp);
                    const isOut = r.direction === "OUTGOING";

                    return (
                      <tr key={r.id} className="hover:bg-[#142034]/70">
                        <td className="py-2 px-3 text-[#94A3B8] whitespace-nowrap">
                          {new Date(r.blockTimestamp).toISOString().split("T")[0]}
                        </td>
                        <td className="py-2 px-3">
                          <a
                            href={r.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#3978F6] hover:underline"
                          >
                            {truncateHash(r.hash, 5, 4)}
                          </a>
                        </td>
                        <td className="py-2 px-3 font-sans text-[#F8FAFC] truncate max-w-[120px]">
                          {r.evidence?.inferences?.purposeTitle || r.actionType}
                        </td>
                        <td className="py-2 px-3 text-[#94A3B8] truncate max-w-[120px]">
                          {isOut ? `to: ${r.receiverId}` : `from: ${r.predecessorId}`}
                        </td>
                        <td className={`py-2 px-3 text-right font-semibold ${isOut ? "text-[#F8FAFC]" : "text-[#20B486]"}`}>
                          {isOut ? "-" : "+"}
                          {r.amountNear.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right text-[#94A3B8]">
                          {r.networkFeeNear === null ? "Unavailable" : r.networkFeeNear.toFixed(12)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                              r.status === "SUCCESS"
                                ? "bg-[#20B486]/15 text-[#20B486]"
                                : "bg-[#EF4444]/15 text-[#EF4444]"
                            }`}
                          >
                            {r.status === "SUCCESS" ? "Confirmed" : "Failed"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.attribution?.status === "CONFIRMED" ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#20B486]/15 text-[#20B486] border border-[#20B486]/30">
                              CONFIRMED{r.attribution.taskId ? ` · Task ${r.attribution.taskId}` : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] font-sans text-[#94A3B8]">
                              {r.attribution?.status || "UNKNOWN"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Seal & Verification Note */}
          <div className="pt-4 border-t border-[#1E2D44] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#94A3B8] font-mono">
            <div className="flex items-center space-x-1.5 text-[#20B486]">
              <ShieldCheck className="w-4 h-4" />
              <span>Settled on NEAR Protocol consensus</span>
            </div>
            <div className="text-[#64748B]">AgentReceipts v1.0 • Evidence-First Ledger</div>
          </div>
        </div>
      </div>
    </div>
  );
}

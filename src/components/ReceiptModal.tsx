"use client";

import React, { useState } from "react";
import { AgentReceipt } from "@/types/receipt";
import { formatTimestamp, truncateHash, NEAR_USD_ESTIMATE } from "@/lib/near";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Printer,
  CheckCircle2,
  XCircle,
  FileText,
  Info,
  Cpu,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface ReceiptModalProps {
  receipt: AgentReceipt | null;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  if (!receipt) return null;

  const { formatted, relative } = formatTimestamp(receipt.blockTimestamp);
  const isOut = receipt.direction === "OUTGOING";

  const handleCopyHash = () => {
    navigator.clipboard.writeText(receipt.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-[#18243A] rounded-2xl border border-[#263750] shadow-modal overflow-hidden my-6 z-10 text-[#F8FAFC]">
        {/* Receipt Header */}
        <div className="p-5 pb-4 border-b border-[#1E2D44] flex items-center justify-between bg-[#142034]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1E2D44] flex items-center justify-center text-[#3978F6]">
              <FileText className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#F8FAFC]">Transaction receipt</h3>
                {!receipt.isRealOnChain && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F0A83B]/15 text-[#F0A83B] border border-[#F0A83B]/30">
                    DEMO
                  </span>
                )}
              </div>
              <p className="text-xs text-[#94A3B8]">{relative}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1E2D44] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            title="Close receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Amount Card */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="p-4 rounded-xl bg-[#121D30] border border-[#263750] text-center">
            <div className="text-xs text-[#94A3B8] font-medium">
              {isOut ? "Amount sent" : "Amount received"}
            </div>
            <div
              className={`text-3xl font-extrabold font-mono tracking-tight mt-1 tabular-nums ${
                isOut ? "text-[#F8FAFC]" : "text-[#20B486]"
              }`}
            >
              {isOut ? "-" : "+"}
              {receipt.amountNear.toFixed(2)} {receipt.assetSymbol || "NEAR"}
            </div>
            <div className="text-xs text-[#94A3B8] mt-0.5 font-medium">
              ≈ ${(receipt.amountNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
            </div>

            <div className="inline-flex items-center space-x-1.5 mt-2.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[#18243A] border-[#263750]">
              {receipt.status === "SUCCESS" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#20B486]" />
                  <span className="text-[#20B486] font-semibold">Completed</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                  <span className="text-[#EF4444] font-semibold">Failed on-chain</span>
                </>
              )}
            </div>
          </div>

          {/* Simple Transaction Details */}
          <div className="divide-y divide-[#1E2D44] text-sm">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#94A3B8] text-xs">Action type</span>
              <span className="font-semibold text-xs text-[#F8FAFC]">
                {receipt.evidence?.inferences?.purposeTitle || receipt.actionType}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#94A3B8] text-xs">Date & time</span>
              <span className="text-xs text-[#F8FAFC] font-medium">{formatted}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#94A3B8] text-xs">Sender (From)</span>
              <span className="text-xs font-mono font-medium text-[#F8FAFC] truncate max-w-[200px]" title={receipt.predecessorId}>
                {receipt.predecessorId || receipt.signerId}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#94A3B8] text-xs">Recipient (To)</span>
              <span className="text-xs font-mono font-medium text-[#F8FAFC] truncate max-w-[200px]" title={receipt.receiverId}>
                {receipt.receiverId}
              </span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <span className="text-[#94A3B8] text-xs">Network fee</span>
                {receipt.feeIsExactBurnt && (
                  <span className="text-[9px] px-1 rounded bg-[#20B486]/15 text-[#20B486] font-mono">
                    exact
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-medium text-[#F8FAFC]">
                {receipt.networkFeeNear === null
                  ? "Unavailable"
                  : `${receipt.networkFeeNear.toFixed(12)} NEAR`}
                {receipt.networkFeeNear !== null && (
                  <span className="text-[#94A3B8] font-normal">
                    (≈ ${(receipt.networkFeeNear * NEAR_USD_ESTIMATE).toFixed(6)})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Agent Task Attribution Section */}
          <div className="p-3.5 rounded-xl bg-[#142034] border border-[#263750] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-semibold text-[#F8FAFC]">
                <Cpu className="w-3.5 h-3.5 text-[#3978F6]" />
                <span>Agent Task Attribution</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  receipt.attribution?.status === "CONFIRMED"
                    ? "bg-[#20B486]/15 text-[#20B486] border-[#20B486]/30"
                    : "bg-[#F0A83B]/15 text-[#F0A83B] border-[#F0A83B]/30"
                }`}
              >
                {receipt.attribution?.status === "CONFIRMED"
                  ? "CONFIRMED"
                  : receipt.attribution?.status || "UNKNOWN"}
              </span>
            </div>

            {receipt.attribution?.agentId && (
              <div className="text-[11px] text-[#F8FAFC] flex items-center flex-wrap gap-1.5">
                <strong className="text-[#3978F6]">Agent ID:</strong>
                <span className="font-mono">{receipt.attribution.agentId}</span>
              </div>
            )}
            {receipt.attribution?.taskId && (
              <div className="text-[11px] text-[#F8FAFC] flex items-center flex-wrap gap-1.5">
                <strong className="text-[#3978F6]">Task ID:</strong>
                <span className="font-mono bg-[#20B486]/15 px-1.5 py-0.5 rounded text-[11px] font-bold text-[#20B486]">
                  {receipt.attribution.taskId}
                </span>
                {receipt.attribution.agentName && (
                  <span className="text-[#94A3B8]">
                    via <strong className="text-[#F8FAFC]">{receipt.attribution.agentName}</strong>
                  </span>
                )}
              </div>
            )}

            {receipt.attribution?.proposalId && (
              <div className="text-[11px] text-[#F8FAFC] flex items-center flex-wrap gap-1.5">
                <strong className="text-[#3978F6]">Proposal ID:</strong>
                <span className="font-mono">{receipt.attribution.proposalId}</span>
              </div>
            )}

            {receipt.attribution?.promptSnippet && (
              <div className="p-2.5 rounded-lg bg-[#101827] border border-[#263750] text-[11px] text-[#F8FAFC] italic">
                &ldquo;{receipt.attribution.promptSnippet}&rdquo;
              </div>
            )}

            <div className="text-[11px] text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F8FAFC]">Category:</strong> {receipt.attribution?.category || "Uncategorized"}
            </div>
            <div className="text-[11px] text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F8FAFC]">Attribution Reasoning:</strong> {receipt.attribution?.reasoning}
            </div>

            {/* Explicit Notice about Agent Log Integration */}
            <div className="mt-2 pt-2 border-t border-[#1E2D44] text-[10px] text-[#94A3B8] leading-normal flex items-start space-x-1.5">
              <Info className="w-3.5 h-3.5 text-[#3978F6] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#3978F6]">Audit Verification: </strong>
                <span>{receipt.attribution?.integrationNotice}</span>
              </div>
            </div>
          </div>

          {/* "How We Calculated This" Section */}
          <div className="border border-[#263750] rounded-xl overflow-hidden bg-[#142034]">
            <button
              onClick={() => setShowCalculationDetails(!showCalculationDetails)}
              className="w-full p-3 flex items-center justify-between text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-[#3978F6]" />
                <span>How we calculated this</span>
              </div>
              {showCalculationDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showCalculationDetails && (
              <div className="p-3.5 pt-0 space-y-2 border-t border-[#1E2D44] text-xs text-[#F8FAFC] bg-[#121D30] text-[11px] leading-relaxed">
                <div>
                  <strong className="text-[#3978F6]">Transfer Amount: </strong>
                  <span>Converted from raw on-chain deposit ({receipt.amountYocto || "0"} yoctoNEAR) divided by 10^24.</span>
                </div>
                <div>
                  <strong className="text-[#3978F6]">Network Gas Fee: </strong>
                  <span>{receipt.evidence?.calculatedFields?.calculationFormula}</span>
                </div>
                <div>
                  <strong className="text-[#3978F6]">Unavailable Information: </strong>
                  <span className="text-[#94A3B8]">
                    {receipt.evidence?.unavailableFields?.join(", ") || "None"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Expandable Technical Details */}
          <div className="border border-[#263750] rounded-xl overflow-hidden bg-[#142034]">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full p-3 flex items-center justify-between text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <span>Technical details (on-chain raw data)</span>
              {showTechnicalDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="p-3.5 pt-0 space-y-2.5 border-t border-[#1E2D44] text-xs text-[#F8FAFC] bg-[#121D30]">
                <div className="pt-2">
                  <span className="text-[11px] text-[#94A3B8] block mb-0.5">Transaction hash</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono text-[11px] text-[#F8FAFC] bg-[#101827] px-2 py-1 rounded border border-[#263750] truncate max-w-[240px] select-all">
                      {receipt.hash}
                    </span>
                    <button
                      onClick={handleCopyHash}
                      className="p-1 rounded bg-[#18243A] hover:bg-[#1E2D44] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#263750] transition-colors cursor-pointer"
                      title="Copy hash"
                    >
                      {copiedHash ? (
                        <Check className="w-3.5 h-3.5 text-[#20B486]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#94A3B8] block">Block height</span>
                    <span className="font-mono font-medium">#{receipt.blockHeight.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block">Network fee (yoctoNEAR)</span>
                    <span className="font-mono font-medium">{receipt.networkFeeYocto || "Unavailable"}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block">Gas burnt (transaction outcome)</span>
                    <span className="font-mono font-medium">{receipt.gasBurntTgas} Tgas</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block">Contract method</span>
                    <span className="font-mono font-medium">{receipt.methodName ? `${receipt.methodName}()` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block">Consensus Status</span>
                    <span className="font-mono font-medium text-[#20B486]">{receipt.status}</span>
                  </div>
                </div>

                {/* External Explorer Links */}
                <div className="pt-2 border-t border-[#1E2D44] flex items-center space-x-2">
                  <a
                    href={receipt.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#20B486]/15 text-[#20B486] hover:bg-[#20B486]/25 text-xs font-medium transition-colors border border-[#20B486]/30"
                  >
                    <span>View on NearBlocks</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <a
                    href={`https://pikespeak.ai/transaction/${receipt.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#18243A] text-[#94A3B8] hover:bg-[#1E2D44] text-xs font-medium transition-colors border border-[#263750]"
                  >
                    <span>Pikespeak</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#142034] border-t border-[#1E2D44] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyJson}
              className="px-2.5 py-1 rounded-lg bg-[#18243A] hover:bg-[#1E2D44] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-medium border border-[#263750] flex items-center space-x-1 transition-colors cursor-pointer"
            >
              {copiedJson ? <Check className="w-3 h-3 text-[#20B486]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedJson ? "Copied JSON" : "Copy JSON"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-2.5 py-1 rounded-lg bg-[#18243A] hover:bg-[#1E2D44] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-medium border border-[#263750] flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <Printer className="w-3 h-3" />
              <span>Print</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

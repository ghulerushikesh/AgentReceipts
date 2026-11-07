"use client";

import React, { useState, useMemo } from "react";
import { AgentReceipt } from "@/types/receipt";
import { truncateHash, formatTimestamp, NEAR_USD_ESTIMATE } from "@/lib/near";
import { exportReceiptsToCSV } from "@/lib/csv";
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  FileText,
  FileCheck2,
} from "lucide-react";

interface TransactionTableProps {
  receipts: AgentReceipt[];
  accountId: string;
  onSelectReceipt: (receipt: AgentReceipt) => void;
  onOpenAuditReport?: () => void;
  onOpenProposals?: () => void;
  pendingProposalsCount?: number;
  isLoading?: boolean;
}

export default function TransactionTable({
  receipts,
  accountId,
  onSelectReceipt,
  onOpenAuditReport,
  onOpenProposals,
  pendingProposalsCount = 0,
  isLoading = false,
}: TransactionTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "OUTGOING" | "INCOMING">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (directionFilter !== "ALL" && r.direction !== directionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesHash = r.hash.toLowerCase().includes(q);
        const matchesPredecessor = r.predecessorId.toLowerCase().includes(q);
        const matchesReceiver = r.receiverId.toLowerCase().includes(q);
        const purpose = r.evidence?.inferences?.purposeTitle || r.actionType;
        const matchesPurpose = purpose.toLowerCase().includes(q);
        const category = r.attribution?.category || "";
        const matchesCategory = category.toLowerCase().includes(q);
        return matchesHash || matchesPredecessor || matchesReceiver || matchesPurpose || matchesCategory;
      }
      return true;
    });
  }, [receipts, directionFilter, searchQuery]);

  const totalPages = Math.ceil(filteredReceipts.length / pageSize) || 1;
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(start, start + pageSize);
  }, [filteredReceipts, currentPage, pageSize]);

  const handleExportCSV = () => {
    exportReceiptsToCSV(filteredReceipts, accountId);
  };

  // Helper for friendly plain-English description
  const getFriendlyTitle = (receipt: AgentReceipt): string => {
    if (receipt.direction === "INCOMING") {
      return receipt.amountNear > 0 ? "Deposit received" : "Incoming transaction";
    }
    const purpose = receipt.evidence?.inferences?.purposeTitle;
    if (purpose) {
      if (purpose.includes("DEX") || purpose.includes("Token swap")) return "Token swap";
      if (purpose.includes("Storage") || purpose.includes("storage")) return "Account storage deposit";
      if (purpose.includes("Validator") || purpose.includes("Staking")) return "Staking deposit";
      if (purpose.includes("Transfer")) return "Direct payment";
      return purpose.replace(/\(\)/g, "");
    }
    return receipt.amountNear > 0 ? "Payment sent" : "Smart contract interaction";
  };

  return (
    <div className="rounded-2xl bg-[#0D1627]/85 backdrop-blur-sm border border-[#1A2840] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06] relative">
      {/* Pending Proposals Highlight when awaiting authorization */}
      {pendingProposalsCount > 0 && onOpenProposals && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#F0A83B]/10 via-[#0D1627] to-[#0D1627] border-b border-[#F0A83B]/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F0A83B]/15 border border-[#F0A83B]/30 flex items-center justify-center text-[#F0A83B] shrink-0 shadow-[0_0_10px_rgba(240,168,59,0.2)]">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-[#F8FAFC]">
                  Pending Agent Payment Proposals
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F0A83B] text-[#101827]">
                  {pendingProposalsCount} Awaiting
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5 truncate">
                External AI agents have proposed micro-payments awaiting human authorization in Meteor Wallet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenProposals}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#F0A83B] hover:bg-[#D9932B] text-[#101827] text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer active:scale-[0.98]"
          >
            Review &amp; Approve
          </button>
        </div>
      )}

      {/* Table Action & Filter Toolbar */}
      <div className="p-4 sm:p-6 border-b border-[#162338] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-[#090F1C]/70">
        <div>
          <h3 className="text-lg font-bold text-[#F8FAFC] tracking-tight">Payment activity</h3>
          <p className="text-xs text-[#94A3B8] mt-1">
            Recent payments, agent micro-transfers, and settlement activity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direction Filter Tabs */}
          <div className="inline-flex rounded-xl bg-[#080E1C] p-1 border border-[#162338] text-xs">
            <button
              onClick={() => {
                setDirectionFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                directionFilter === "ALL" ? "bg-[#142036] text-[#F8FAFC] shadow-sm font-semibold" : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setDirectionFilter("OUTGOING");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                directionFilter === "OUTGOING" ? "bg-[#142036] text-[#F8FAFC] shadow-sm font-semibold" : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              Spent
            </button>
            <button
              onClick={() => {
                setDirectionFilter("INCOMING");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                directionFilter === "INCOMING" ? "bg-[#142036] text-[#20B486] shadow-sm font-semibold" : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              Received
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-40 sm:w-48 pl-8 pr-7 py-1.5 rounded-xl bg-[#080E1C] border border-[#162338] text-[#F8FAFC] placeholder-[#64748B] text-xs focus:outline-none focus:border-[#3978F6] focus:bg-[#070B16] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Compact Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredReceipts.length === 0}
            className="px-3 py-1.5 rounded-xl bg-[#111C31] hover:bg-[#162542] text-[#F8FAFC] text-xs font-medium border border-[#1A2840] flex items-center space-x-1.5 transition-colors disabled:opacity-40 cursor-pointer"
            title="Download CSV Statement"
          >
            <Download className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>Export CSV</span>
          </button>

          {/* Audit Report Button */}
          {onOpenAuditReport && (
            <button
              onClick={onOpenAuditReport}
              className="px-3 py-1.5 rounded-xl bg-[#20B486]/15 hover:bg-[#20B486]/25 text-[#20B486] text-xs font-semibold border border-[#20B486]/30 flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
              title="Open verifiable financial audit report"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Audit report</span>
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-[#162338]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#1E2D44]" />
                <div className="space-y-1.5">
                  <div className="h-4 bg-[#1E2D44] rounded w-32" />
                  <div className="h-3 bg-[#1E2D44] rounded w-20" />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <div className="h-4 bg-[#1E2D44] rounded w-20 ml-auto" />
                <div className="h-3 bg-[#1E2D44] rounded w-16 ml-auto" />
              </div>
            </div>
          ))
        ) : paginatedReceipts.length === 0 ? (
          <div className="py-12 text-center text-[#94A3B8]">
            <FileText className="w-8 h-8 text-[#64748B] mx-auto stroke-[1.5] mb-2" />
            <div className="text-sm font-semibold text-[#F8FAFC]">
              No transactions found for this account yet.
            </div>
            {searchQuery || directionFilter !== "ALL" ? (
              <p className="text-xs text-[#94A3B8] mt-0.5 max-w-sm mx-auto">
                Try clearing your search query or filters to see all transactions.
              </p>
            ) : null}
            {(searchQuery || directionFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDirectionFilter("ALL");
                }}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#1E2D44] text-[#3978F6] text-xs font-medium hover:bg-[#263750] transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          paginatedReceipts.map((receipt) => {
            const isOut = receipt.direction === "OUTGOING";
            const { formatted, relative } = formatTimestamp(receipt.blockTimestamp);
            const friendlyTitle = getFriendlyTitle(receipt);
            const counterparty = isOut ? receipt.receiverId : receipt.predecessorId;

            return (
              <div
                key={receipt.id}
                onClick={() => onSelectReceipt(receipt)}
                className="p-4 sm:px-6 flex items-center justify-between hover:bg-[#111C31]/60 transition-colors cursor-pointer group"
              >
                {/* Left: Icon & Description */}
                <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-[1.04] ${
                      isOut
                        ? "bg-[#080E1C] border-[#162338] text-[#94A3B8]"
                        : "bg-[#20B486]/15 border-[#20B486]/30 text-[#20B486]"
                    }`}
                  >
                    {isOut ? (
                      <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-[#F8FAFC] truncate group-hover:text-[#3978F6] transition-colors">
                        {receipt.attribution?.agentName ? `${receipt.attribution.agentName}` : friendlyTitle}
                      </span>
                      {receipt.attribution?.agentName && (
                        <span className="text-xs text-[#64748B] hidden md:inline">
                          ({friendlyTitle})
                        </span>
                      )}
                      {receipt.attribution?.status === "CONFIRMED" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#20B486]/15 text-[#20B486] border border-[#20B486]/30">
                          ✓ {receipt.attribution.taskId ? `Task #${receipt.attribution.taskId}` : "Verified Event"}
                        </span>
                      ) : receipt.status === "FAILURE" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                          Failed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#20B486]/10 text-[#20B486] border border-[#20B486]/20">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#94A3B8] truncate flex items-center space-x-1.5 mt-0.5">
                      <span>{isOut ? "To" : "From"}:</span>
                      <span className="font-mono text-[#F8FAFC] font-medium">{truncateHash(counterparty, 6, 4)}</span>
                      <span>•</span>
                      <span>{relative}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Action */}
                <div className="flex items-center space-x-4 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                        isOut ? "text-[#F8FAFC]" : "text-[#20B486]"
                      }`}
                    >
                      {receipt.amountNear === 0
                        ? "0.00 NEAR"
                        : `${isOut ? "-" : "+"}${
                            receipt.amountNear < 0.01
                              ? receipt.amountNear.toFixed(4)
                              : receipt.amountNear.toFixed(2)
                          } NEAR`}
                    </div>
                    <div className="text-[11px] text-[#64748B] tabular-nums">
                      ≈ ${(receipt.amountNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReceipt(receipt);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#111C31] group-hover:bg-[#162542] text-[#94A3B8] group-hover:text-[#F8FAFC] text-xs font-medium border border-[#1A2840] transition-colors hidden sm:block cursor-pointer"
                  >
                    View receipt
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {!isLoading && filteredReceipts.length > 0 && (
        <div className="p-3.5 sm:px-6 border-t border-[#162338] bg-[#090F1C]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#94A3B8]">
          <div>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredReceipts.length)} of{" "}
            {filteredReceipts.length} transactions
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#080E1C] border border-[#162338] rounded-lg px-2 py-1 text-[#F8FAFC] text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-[#111C31] hover:bg-[#162542] text-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[#1A2840] cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-[#F8FAFC]">
                {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-[#111C31] hover:bg-[#162542] text-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[#1A2840] cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

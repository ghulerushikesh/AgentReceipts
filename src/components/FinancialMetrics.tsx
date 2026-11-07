"use client";

import React, { useState } from "react";
import { AccountFinancialSummary } from "@/types/receipt";
import {
  ArrowUpRight,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Fuel,
  Wallet,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

interface FinancialMetricsProps {
  summary: AccountFinancialSummary;
  pendingProposalsCount?: number;
  dailyBudget?: number;
  spentTodayNear?: number;
  onOpenProposals?: () => void;
  onOpenBudget?: () => void;
}

export default function FinancialMetrics({
  summary,
  pendingProposalsCount = 0,
  dailyBudget = 10,
  spentTodayNear = 0,
  onOpenProposals,
  onOpenBudget,
}: FinancialMetricsProps) {
  const [showCalculationInfo, setShowCalculationInfo] = useState(false);

  const remainingNear = Math.max(0, dailyBudget - spentTodayNear);
  const isBreached = spentTodayNear >= dailyBudget;
  const isWarning = dailyBudget > 0 && spentTodayNear / dailyBudget >= 0.8 && !isBreached;
  const percentUsed = dailyBudget > 0 ? (spentTodayNear / dailyBudget) * 100 : 0;

  const standardCardClass =
    "group relative overflow-hidden p-5 rounded-2xl bg-[#0D1627]/85 backdrop-blur-sm border border-[#1A2840] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardHover hover:border-[#273B5E] hover:bg-[#111C31]/90 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06]";

  return (
    <div className="space-y-4">
      {/* 4 Primary Compact Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* 1. Total Agent Spending (Hero Metric Card) */}
        <div className="group relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[#121E36] via-[#0E1628] to-[#080D19] border border-[#233758] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardHover hover:border-[#355280] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#3978F6] before:to-transparent after:absolute after:-top-12 after:-right-12 after:w-32 after:h-32 after:rounded-full after:bg-[#3978F6]/10 after:blur-2xl after:pointer-events-none">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#93C5FD]">
                Total Agent Spending
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#3978F6]/20 border border-[#3978F6]/40 flex items-center justify-center text-[#60A5FA] shadow-[0_0_12px_rgba(57,120,246,0.25)] group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>

          <div>
            <div className="mt-2 text-[1.75rem] leading-none font-extrabold text-white font-mono tracking-tight tabular-nums flex items-baseline space-x-1.5">
              <span>{summary.totalOutgoingNear.toFixed(2)}</span>
              <span className="text-xs font-sans font-medium text-[#93C5FD]">NEAR</span>
            </div>
            <div className="text-[11px] leading-4 text-[#8BA3C7] mt-2.5 font-sans truncate flex items-center space-x-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3978F6]" />
              <span>
                Completed outlays ({summary.failureCount > 0 ? `${summary.failureCount} failed excluded` : "all verified"})
              </span>
            </div>
          </div>
        </div>

        {/* 2. Remaining Daily Budget */}
        <div
          className={`${standardCardClass} ${onOpenBudget ? "cursor-pointer" : ""}`}
          onClick={onOpenBudget}
          title={onOpenBudget ? "Click to configure daily budget" : undefined}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
              Remaining Daily Budget
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${
                isBreached
                  ? "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                  : isWarning
                  ? "bg-[#F0A83B]/15 border-[#F0A83B]/30 text-[#F0A83B] shadow-[0_0_10px_rgba(240,168,59,0.2)]"
                  : "bg-[#20B486]/15 border-[#20B486]/30 text-[#20B486] shadow-[0_0_10px_rgba(32,180,134,0.2)]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>

          <div>
            <div
              className={`mt-2 text-[1.75rem] leading-none font-bold font-mono tracking-tight tabular-nums flex items-baseline space-x-1.5 ${
                isBreached ? "text-[#EF4444]" : "text-[#20B486]"
              }`}
            >
              <span>{isBreached ? "0.00" : remainingNear.toFixed(2)}</span>
              <span className="text-xs font-sans font-medium text-[#94A3B8]">NEAR</span>
            </div>
            <div className="text-[11px] leading-4 text-[#64748B] mt-2.5 font-sans truncate flex items-center space-x-1.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  isBreached ? "bg-[#EF4444]" : isWarning ? "bg-[#F0A83B]" : "bg-[#20B486]"
                }`}
              />
              <span>
                {percentUsed.toFixed(0)}% of {dailyBudget.toFixed(2)} NEAR limit used
              </span>
            </div>
          </div>
        </div>

        {/* 3. Verified Payments */}
        <div className={standardCardClass}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
              Verified Payments
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#20B486]/15 border border-[#20B486]/30 flex items-center justify-center text-[#20B486] shadow-[0_0_10px_rgba(32,180,134,0.15)] group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>

          <div>
            <div className="mt-2 text-[1.75rem] leading-none font-bold text-white font-mono tracking-tight tabular-nums flex items-baseline space-x-1.5">
              <span>{summary.totalTransactions}</span>
              <span className="text-xs font-sans font-medium text-[#20B486]">Verified</span>
            </div>
            <div className="text-[11px] leading-4 text-[#64748B] mt-2.5 font-sans truncate flex items-center space-x-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#20B486]" />
              <span>+{summary.totalIncomingNear.toFixed(2)} NEAR received in deposits</span>
            </div>
          </div>
        </div>

        {/* 4. Pending Approvals */}
        <div
          className={`${standardCardClass} ${
            pendingProposalsCount > 0 ? "border-[#F0A83B]/35 bg-[#171D2D]/90" : ""
          } ${onOpenProposals ? "cursor-pointer" : ""}`}
          onClick={onOpenProposals}
          title={onOpenProposals ? "Click to view payment proposals" : undefined}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
              Pending Approvals
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center group-hover:scale-105 transition-transform ${
                pendingProposalsCount > 0
                  ? "bg-[#F0A83B]/20 border-[#F0A83B]/40 text-[#F0A83B] shadow-[0_0_12px_rgba(240,168,59,0.25)]"
                  : "bg-[#1E2D44]/80 border-[#263750] text-[#64748B]"
              }`}
            >
              <Clock className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>

          <div>
            <div
              className={`mt-2 text-[1.75rem] leading-none font-bold font-mono tracking-tight tabular-nums flex items-baseline space-x-1.5 ${
                pendingProposalsCount > 0 ? "text-[#F0A83B]" : "text-white"
              }`}
            >
              <span>{pendingProposalsCount}</span>
              <span className="text-xs font-sans font-medium text-[#94A3B8]">
                {pendingProposalsCount === 1 ? "Proposal" : "Proposals"}
              </span>
            </div>
            <div className="text-[11px] leading-4 text-[#64748B] mt-2.5 font-sans truncate flex items-center space-x-1.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  pendingProposalsCount > 0 ? "bg-[#F0A83B] animate-pulse" : "bg-[#64748B]"
                }`}
              />
              <span>
                {pendingProposalsCount > 0 ? "Action required in Meteor Wallet" : "All agent requests resolved"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Financial Ledger Details: Network Fees & Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-xl bg-[#0B1220]/80 border border-[#162338] flex items-center justify-between hover:border-[#233758] transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#3978F6]/15 border border-[#3978F6]/30 flex items-center justify-center text-[#3978F6]">
              <Fuel className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">
                Protocol Network Fees
              </span>
              <span className="font-mono text-sm font-bold text-[#F8FAFC] tabular-nums">
                {summary.totalNetworkFeeNear.toFixed(12)} NEAR
              </span>
            </div>
          </div>
          <span className="text-[10px] text-[#64748B] font-mono px-2 py-0.5 rounded-md bg-[#080E1C] border border-[#162338]">
            {summary.networkFeeUnavailableCount > 0
              ? `${summary.networkFeeUnavailableCount} unavailable`
              : "Exact burnt"}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0B1220]/80 border border-[#162338] flex items-center justify-between hover:border-[#233758] transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#20B486]/15 border border-[#20B486]/30 flex items-center justify-center text-[#20B486]">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">
                Live Account Balance
              </span>
              <span className="font-mono text-sm font-bold text-[#F8FAFC] tabular-nums">
                {summary.liveBalanceNear.toFixed(2)} NEAR
              </span>
            </div>
          </div>
          <span className="text-[10px] text-[#20B486] font-medium px-2 py-0.5 rounded-md bg-[#20B486]/10 border border-[#20B486]/20">
            Available
          </span>
        </div>
      </div>

      {/* "How we calculated this" Collapsible Explanation */}
      <div className="rounded-2xl border border-[#1A2840] bg-[#0D1627]/85 shadow-card overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowCalculationInfo(!showCalculationInfo)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111C31] transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-[#3978F6]" />
            <span>Calculation details &amp; Accounting standard</span>
          </div>
          {showCalculationInfo ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#64748B]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          )}
        </button>

        {showCalculationInfo && (
          <div className="px-4 py-3 border-t border-[#162338] bg-[#070C17] grid grid-cols-1 md:grid-cols-2 gap-3.5 text-[11px] text-[#94A3B8] leading-relaxed">
            <div className="p-2.5 rounded-lg bg-[#0A101D] border border-[#162338]">
              <strong className="text-[#F8FAFC] block mb-0.5 font-semibold">Money Spent Formula:</strong>
              {summary.howWeCalculatedThis.completedSpending}
            </div>
            <div className="p-2.5 rounded-lg bg-[#0A101D] border border-[#162338]">
              <strong className="text-[#F8FAFC] block mb-0.5 font-semibold">Network Fees Isolation:</strong>
              {summary.howWeCalculatedThis.networkFees}
            </div>
            <div className="p-2.5 rounded-lg bg-[#0A101D] border border-[#162338]">
              <strong className="text-[#F8FAFC] block mb-0.5 font-semibold">Daily Budget Window:</strong>
              {summary.howWeCalculatedThis.dailyBudgetWindow}
            </div>
            <div className="p-2.5 rounded-lg bg-[#0A101D] border border-[#162338]">
              <strong className="text-[#F8FAFC] block mb-0.5 font-semibold">Attribution &amp; Data Limits:</strong>
              {summary.howWeCalculatedThis.dataLimitations}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

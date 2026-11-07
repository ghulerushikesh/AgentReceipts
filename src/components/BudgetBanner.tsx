"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  SlidersHorizontal,
  X,
  Check,
} from "lucide-react";
import { AgentReceipt } from "@/types/receipt";
import { NEAR_USD_ESTIMATE } from "@/lib/near";

interface BudgetBannerProps {
  receipts: AgentReceipt[];
  totalOutgoingNear: number;
  onBudgetChange?: (newBudget: number) => void;
}

const STORAGE_KEY = "agent_receipts_daily_budget_near";
const DEFAULT_BUDGET_NEAR = 10;

export default function BudgetBanner({
  receipts,
  totalOutgoingNear,
  onBudgetChange,
}: BudgetBannerProps) {
  const [dailyBudget, setDailyBudget] = useState<number>(DEFAULT_BUDGET_NEAR);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState(DEFAULT_BUDGET_NEAR.toString());
  const [inputError, setInputError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed > 0) {
          setDailyBudget(parsed);
          setInputValue(parsed.toString());
        }
      }
    }
  }, []);

  const handleOpenModal = () => {
    setInputValue(dailyBudget.toString());
    setInputError(null);
    setIsModalOpen(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) {
      setInputError("Please enter a valid daily amount greater than 0");
      return;
    }
    setDailyBudget(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, val.toString());
    }
    setIsModalOpen(false);
    if (onBudgetChange) onBudgetChange(val);
  };

  // Compute spending within today's local calendar day (from 00:00:00 local time)
  const spentTodayNear = useMemo(() => {
    const now = new Date();
    const startOfTodayLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    ).getTime();

    const filtered = receipts.filter(
      (r) => r.direction === "OUTGOING" && r.status === "SUCCESS" && r.blockTimestamp >= startOfTodayLocal
    );
    const sum = filtered.reduce((acc, curr) => acc + curr.amountNear, 0);
    return Number(sum.toFixed(4));
  }, [receipts]);

  const percentUsed = dailyBudget > 0 ? (spentTodayNear / dailyBudget) * 100 : 0;
  const isBreached = percentUsed >= 100;
  const isWarning = percentUsed >= 80 && !isBreached;
  const remainingNear = Math.max(0, dailyBudget - spentTodayNear);
  const exceededNear = Math.max(0, spentTodayNear - dailyBudget);

  return (
    <div className="w-full space-y-3">
      {/* Critical Overspend Alert */}
      {isBreached && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#F8FAFC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-card"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#EF4444]/20 text-[#EF4444] flex items-center justify-center shrink-0 border border-[#EF4444]/35">
              <AlertOctagon className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#F87171]">
                Budget exceeded
              </div>
              <p className="text-sm text-[#F8FAFC] font-medium mt-0.5">
                Your agent has spent <span className="font-semibold text-white">{spentTodayNear.toFixed(2)} NEAR</span> today, which is{" "}
                <span className="font-bold text-[#F87171]">{exceededNear.toFixed(2)} NEAR</span> over your{" "}
                <span className="font-semibold text-white">{dailyBudget.toFixed(2)} NEAR</span> daily budget.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenModal}
            className="px-3.5 py-1.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Change budget
          </button>
        </div>
      )}

      {/* 80% Gentle Warning Banner */}
      {isWarning && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#F0A83B]/15 border border-[#F0A83B]/30 text-[#F8FAFC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-card"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#F0A83B]/20 text-[#F0A83B] flex items-center justify-center shrink-0 border border-[#F0A83B]/35">
              <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#F0A83B]">
                Approaching daily budget
              </div>
              <p className="text-sm text-[#F8FAFC] font-medium mt-0.5">
                Your agent has used <span className="font-semibold text-[#F0A83B]">{percentUsed.toFixed(0)}%</span> of its daily budget (
                {spentTodayNear.toFixed(2)} of {dailyBudget.toFixed(2)} NEAR). Only{" "}
                <span className="font-semibold text-white">{remainingNear.toFixed(2)} NEAR</span> left today.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenModal}
            className="px-3.5 py-1.5 rounded-lg bg-[#F0A83B] hover:bg-[#D9942E] text-[#101827] text-xs font-bold shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            Change budget
          </button>
        </div>
      )}

      {/* Main Hero Budget Card */}
      <div className="relative isolate overflow-hidden p-5 sm:p-7 rounded-2xl bg-[#0D1627]/85 backdrop-blur-sm border border-[#1A2840] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06] transition-all duration-200 hover:border-[#273B5E]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-[#3978F6]/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute right-20 top-0 -z-10 h-36 w-36 rounded-full border border-[#162338]/60" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3978F6]">
              Daily allowance
            </span>
            <h2 className="text-2xl sm:text-[1.75rem] font-extrabold text-[#F8FAFC] tracking-tight mt-1">
              Today&apos;s spending
            </h2>
          </div>

          <button
            type="button"
            onClick={handleOpenModal}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-[#111C31] hover:bg-[#162542] text-[#F8FAFC] text-xs font-medium border border-[#1A2840] hover:border-[#273B5E] flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#3978F6]" />
            <span>Change budget</span>
          </button>
        </div>

        {/* Primary figures */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-0 py-5 border-y border-[#162338] my-4">
          <div>
            <div className="text-xs text-[#94A3B8]">Spent today</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] font-mono tracking-tight mt-0.5 tabular-nums">
              {spentTodayNear.toFixed(2)} <span className="text-sm font-sans font-medium text-[#94A3B8]">NEAR</span>
            </div>
            <div className="text-xs text-[#64748B] mt-0.5">
              ≈ ${(spentTodayNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
            </div>
          </div>

          <div className="sm:border-l sm:border-[#162338] sm:pl-6">
            <div className="text-xs text-[#94A3B8]">Daily limit</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono tracking-tight mt-0.5 tabular-nums">
              {dailyBudget.toFixed(2)} <span className="text-sm font-sans font-medium text-[#94A3B8]">NEAR</span>
            </div>
            <div className="text-xs text-[#64748B] mt-0.5">
              Configured maximum
            </div>
          </div>

          <div className="sm:border-l sm:border-[#162338] sm:pl-6">
            <div className="text-xs text-[#94A3B8]">
              {isBreached ? "Exceeded by" : "Remaining today"}
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight mt-0.5 tabular-nums ${
                isBreached ? "text-[#EF4444]" : "text-[#20B486]"
              }`}
            >
              {isBreached ? `+${exceededNear.toFixed(2)}` : remainingNear.toFixed(2)}{" "}
              <span className="text-sm font-sans font-medium text-[#94A3B8]">NEAR</span>
            </div>
            <div className="text-xs text-[#64748B] mt-0.5">
              {isBreached ? "Over allocation" : "Safe to spend"}
            </div>
          </div>
        </div>

        {/* Clean Progress Bar */}
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>
              <strong className="text-[#F8FAFC] font-semibold">{spentTodayNear.toFixed(2)} NEAR</strong> spent of{" "}
              <strong className="text-[#F8FAFC] font-semibold">{dailyBudget.toFixed(2)} NEAR</strong>
            </span>
            <span
              className={`font-semibold ${
                isBreached ? "text-[#EF4444]" : isWarning ? "text-[#F0A83B]" : "text-[#20B486]"
              }`}
            >
              {percentUsed.toFixed(0)}% used
            </span>
          </div>

          <div className="w-full h-3.5 rounded-full bg-[#080E1C] overflow-hidden relative border border-[#162338] shadow-inner p-0.5">
            {/* 80% Warning threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#F0A83B]/70 z-10"
              style={{ left: "80%" }}
              title="80% Warning threshold"
            />

            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isBreached
                  ? "bg-[#EF4444]"
                  : isWarning
                  ? "bg-[#F0A83B]"
                  : "bg-[#20B486]"
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748B]">
            <span>0 NEAR</span>
            <span className="text-[#F0A83B] font-medium">80% warning limit</span>
            <span>{dailyBudget.toFixed(2)} NEAR cap</span>
          </div>
        </div>
      </div>

      {/* Budget Settings Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className="fixed inset-0"
            onClick={() => setIsModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-md bg-[#0F172A] rounded-2xl border border-[#1E2D44] shadow-modal overflow-hidden p-6 z-10 text-[#F8FAFC]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#F8FAFC]">
                  Change daily budget
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Set the maximum amount your agent can spend per day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#141F33] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
                  Daily spending limit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setInputError(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A101D] border border-[#1E2D44] text-[#F8FAFC] text-base font-mono focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/30 transition-colors"
                    placeholder="e.g. 10.0"
                    autoFocus
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#94A3B8]">
                    NEAR
                  </span>
                </div>
                {inputError && (
                  <p className="text-xs text-[#EF4444] mt-1.5 font-medium">{inputError}</p>
                )}
                <p className="text-[11px] text-[#64748B] mt-1.5">
                  Equivalent to ≈ ${(parseFloat(inputValue || "0") * NEAR_USD_ESTIMATE).toFixed(2)} USD
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-xs text-[#94A3B8]">Quick set:</span>
                {[5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setInputValue(preset.toString());
                      setInputError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#141F33] hover:bg-[#1E2D44] text-[#F8FAFC] text-xs font-medium border border-[#1E2D44] transition-colors cursor-pointer"
                  >
                    {preset} NEAR
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#1E2D44]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141F33] hover:bg-[#1E2D44] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs font-semibold transition-colors shadow-md cursor-pointer"
                >
                  Save budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

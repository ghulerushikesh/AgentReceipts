"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FinancialMetrics from "@/components/FinancialMetrics";
import BudgetBanner from "@/components/BudgetBanner";
import SpendingCharts from "@/components/SpendingCharts";
import AgentOverview from "@/components/AgentOverview";
import TransactionTable from "@/components/TransactionTable";
import ReceiptModal from "@/components/ReceiptModal";
import AuditReportModal from "@/components/AuditReportModal";
import AgentConnectionsModal from "@/components/AgentConnectionsModal";
import PaymentProposalsModal from "@/components/PaymentProposalsModal";
import { AgentReceipt, AccountFinancialSummary } from "@/types/receipt";
import {
  AlertCircle,
  RefreshCw,
  Wallet,
  ShieldCheck,
  CreditCard,
  FileCheck2,
  Bot,
  Menu,
  X,
} from "lucide-react";
import { useWalletSelector } from "@/context/WalletSelectorContext";

const BUDGET_STORAGE_KEY = "agent_receipts_daily_budget_near";
const DEFAULT_DAILY_BUDGET = 10;

export default function DashboardPage() {
  const {
    accountId,
    isConnected,
    isLoading: isWalletLoading,
    signIn,
    signOut,
  } = useWalletSelector();

  const [account, setAccount] = useState<string>("");
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [receipts, setReceipts] = useState<AgentReceipt[]>([]);
  const [summary, setSummary] = useState<AccountFinancialSummary | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<AgentReceipt | null>(null);
  const [isAuditReportOpen, setIsAuditReportOpen] = useState<boolean>(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState<boolean>(false);
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState<boolean>(false);
  const [pendingProposalsCount, setPendingProposalsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [dailyBudget, setDailyBudget] = useState<number>(DEFAULT_DAILY_BUDGET);

  // Load configured budget from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed > 0) {
          setDailyBudget(parsed);
        }
      }
    }
  }, []);

  // Compute spending within today's local calendar day from verified outgoing receipts
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
      (r) =>
        r.direction === "OUTGOING" &&
        r.status === "SUCCESS" &&
        r.blockTimestamp >= startOfTodayLocal
    );
    const sum = filtered.reduce((acc, curr) => acc + curr.amountNear, 0);
    return Number(sum.toFixed(4));
  }, [receipts]);

  // Prevent stale asynchronous responses and race conditions
  const activeRequestIdRef = useRef<number>(0);
  const prevAccountIdRef = useRef<string | null>(null);

  const fetchData = useCallback(
    async (targetAccount: string, forceDemo?: boolean) => {
      if (!targetAccount) {
        setReceipts([]);
        setSummary(null);
        setIsLoading(false);
        return;
      }

      const requestId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setError(null);
      const demoMode = forceDemo !== undefined ? forceDemo : isDemo;

      try {
        const queryParams = new URLSearchParams({
          account: targetAccount,
          demo: demoMode ? "true" : "false",
          limit: "50",
        });

        const res = await fetch(`/api/receipts?${queryParams.toString()}`);
        if (requestId !== activeRequestIdRef.current) return;

        if (!res.ok) {
          const errorPayload = await res.json().catch(() => null);
          throw new Error(errorPayload?.error || `API returned HTTP ${res.status}`);
        }

        const data = await res.json();
        if (requestId !== activeRequestIdRef.current) return;

        if (!data.success) {
          throw new Error(data.error || "Failed to load transactions");
        }

        setReceipts(data.receipts || []);
        setSummary(data.summary || null);
        setIsDemo(Boolean(data.isDemo));
      } catch (err: any) {
        if (requestId !== activeRequestIdRef.current) return;
        console.error("Failed to load receipts:", err);
        setError(err.message || "Unable to reach NEAR indexer");
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isDemo]
  );

  const refreshPendingProposals = useCallback(() => {
    fetch("/api/agent/proposals")
      .then((r) => r.json())
      .then((pData) => {
        if (typeof pData?.pendingCount === "number") {
          setPendingProposalsCount(pData.pendingCount);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingProposals();
  }, [refreshPendingProposals]);

  // Synchronize state with WalletSelector: login, account switch, logout
  useEffect(() => {
    // 1. When disconnected / logged out: immediately clear all wallet-specific state
    if (!isConnected || !accountId) {
      activeRequestIdRef.current += 1;
      setAccount("");
      setReceipts([]);
      setSummary(null);
      setSelectedReceipt(null);
      setError(null);
      setIsLoading(false);
      prevAccountIdRef.current = null;
      return;
    }

    // 2. When connected or switching accounts: immediately clear previous before loading new
    if (accountId !== prevAccountIdRef.current) {
      activeRequestIdRef.current += 1;
      setReceipts([]);
      setSummary(null);
      setSelectedReceipt(null);
      setError(null);
      setAccount(accountId);
      prevAccountIdRef.current = accountId;
      fetchData(accountId, isDemo);
    }
  }, [isConnected, accountId, fetchData, isDemo]);

  const handleSearch = (newAccount: string, forceDemo?: boolean) => {
    if (!isConnected || !accountId) {
      signIn();
      return;
    }
    activeRequestIdRef.current += 1;
    setReceipts([]);
    setSummary(null);
    setSelectedReceipt(null);
    setError(null);
    setAccount(newAccount);
    if (forceDemo !== undefined) setIsDemo(forceDemo);
    fetchData(newAccount, forceDemo);
  };

  const handleRefresh = () => {
    refreshPendingProposals();
    if (isConnected && account) {
      fetchData(account, isDemo);
    }
  };

  const handleToggleDemo = () => {
    if (!isConnected || !account) return;
    const nextDemo = !isDemo;
    setIsDemo(nextDemo);
    fetchData(account, nextDemo);
  };

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsMobileSidebarOpen(false);

    if (sectionId === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (sectionId === "agents") {
      setIsConnectionsModalOpen(true);
    } else if (sectionId === "proposals") {
      setIsProposalsModalOpen(true);
    } else if (sectionId === "transactions" || sectionId === "receipts") {
      const el = document.getElementById("activity-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (sectionId === "budget") {
      const el = document.getElementById("budget-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (sectionId === "audit") {
      setIsAuditReportOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D19] text-[#F8FAFC] flex flex-col lg:flex-row font-sans selection:bg-[#3978F6]/30 selection:text-white antialiased relative overflow-x-hidden">
      {/* Ambient Lighting Gradients (Fixed & pointer-events-none so scrolling remains smooth) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Soft radial blue gradient centered behind the top dashboard */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-[radial-gradient(ellipse_at_center,rgba(57,120,246,0.09),transparent_70%)] blur-3xl" />
        {/* Gentle cyan-blue glow near the main financial overview */}
        <div className="absolute top-48 left-[22%] w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.045),transparent_70%)] blur-3xl" />
        {/* Subtle indigo/violet light around selected analytics areas */}
        <div className="absolute top-72 right-[8%] w-[650px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.05),transparent_70%)] blur-3xl" />
        {/* Soft atmospheric violet lighting that adds depth without distracting from content */}
        <div className="absolute bottom-24 left-[35%] w-[800px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.035),transparent_70%)] blur-3xl" />
      </div>

      {/* 1. Left Sidebar Navigation (Desktop) */}
      <div className="relative z-10 hidden lg:block shrink-0 sticky top-0 h-screen overflow-y-auto">
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          pendingProposalsCount={pendingProposalsCount}
          connectionStatus={
            isConnected
              ? summary?.connectionStatus || "ACCOUNT_MONITORED"
              : undefined
          }
          isConnected={isConnected}
          accountId={accountId}
          onOpenProposals={() => setIsProposalsModalOpen(true)}
          onOpenConnections={() => setIsConnectionsModalOpen(true)}
          onOpenAuditReport={() => setIsAuditReportOpen(true)}
          onSignIn={signIn}
          onSignOut={signOut}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-[#050811] h-full shadow-2xl flex flex-col border-r border-[#141E30]">
            <div className="p-4 flex items-center justify-between border-b border-[#141E30]">
              <span className="font-bold text-sm text-[#F8FAFC]">Navigation</span>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                activeSection={activeSection}
                onNavigate={handleNavigate}
                pendingProposalsCount={pendingProposalsCount}
                connectionStatus={
                  isConnected
                    ? summary?.connectionStatus || "ACCOUNT_MONITORED"
                    : undefined
                }
                isConnected={isConnected}
                accountId={accountId}
                onOpenProposals={() => {
                  setIsMobileSidebarOpen(false);
                  setIsProposalsModalOpen(true);
                }}
                onOpenConnections={() => {
                  setIsMobileSidebarOpen(false);
                  setIsConnectionsModalOpen(true);
                }}
                onOpenAuditReport={() => {
                  setIsMobileSidebarOpen(false);
                  setIsAuditReportOpen(true);
                }}
                onSignIn={() => {
                  setIsMobileSidebarOpen(false);
                  signIn();
                }}
                onSignOut={() => {
                  setIsMobileSidebarOpen(false);
                  signOut();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Top Brand Bar with Hamburger Toggle */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#141E30] bg-[#080D19]">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 rounded-lg bg-[#0C1527] border border-[#1C2C47] text-[#94A3B8] hover:text-[#F8FAFC]"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-[#0C1527] border border-[#1C2C47] flex items-center justify-center text-[#3978F6]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-[#F8FAFC]">AgentReceipts</span>
          </div>

          <div className="w-8" />
        </div>

        {/* Top Utility Header (Search, Audit, Signer, Proposals) */}
        <Header
          currentAccount={account}
          isDemo={isDemo}
          isLoading={isLoading}
          connectionStatus={
            isConnected
              ? summary?.connectionStatus || "ACCOUNT_MONITORED"
              : undefined
          }
          pendingProposalsCount={pendingProposalsCount}
          onSearch={handleSearch}
          onRefresh={handleRefresh}
          onToggleDemo={handleToggleDemo}
          onOpenConnections={() => setIsConnectionsModalOpen(true)}
          onOpenProposals={() => setIsProposalsModalOpen(true)}
          onOpenAuditReport={() => setIsAuditReportOpen(true)}
        />

        {/* Dashboard Main Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
          {/* 2. Main Header: "Agent spending at a glance" */}
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 pb-2">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#20B486]">
                <span className="h-2 w-2 rounded-full bg-[#20B486] shadow-[0_0_0_4px_rgba(32,180,134,0.18)]" />
                NEAR Testnet <span className="text-[#64748B]">/</span> Financial control &amp; audit for AI agents
              </div>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F8FAFC] tracking-[-0.04em]">
                Agent spending at a glance
              </h1>
              <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl leading-relaxed mt-2.5">
                Financial control and audit for AI agents.
              </p>
            </div>

            {/* Quick Actions & Proposals Review */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsProposalsModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs sm:text-sm font-semibold flex items-center space-x-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer active:scale-[0.98]"
              >
                <CreditCard className="w-4 h-4" />
                <span>Review Payment Proposals</span>
                {pendingProposalsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F0A83B] text-[#101827] text-[11px] font-extrabold">
                    {pendingProposalsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsAuditReportOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-[#18243A] hover:bg-[#1E2D44] text-[#F8FAFC] text-xs sm:text-sm font-medium border border-[#263750] flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4 text-[#20B486]" />
                <span>Audit Statement</span>
              </button>
            </div>
          </div>

          {/* Error Alert if any */}
          {error && isConnected && (
            <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#F87171] flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444]" />
                <div>
                  <strong className="font-semibold">Notice: </strong>
                  <span>{error}</span>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-lg bg-[#18243A] border border-[#EF4444]/40 hover:bg-[#EF4444]/20 text-[#F87171] text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Main Content Area */}
          {isWalletLoading ? (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#3978F6] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-[#94A3B8]">Checking wallet connection...</p>
            </div>
          ) : !isConnected || !accountId ? (
            /* Clean Logged-Out Empty State */
            <div className="rounded-2xl bg-[#0F172A]/90 border border-[#1E2D44] shadow-card p-8 sm:p-14 text-center flex flex-col items-center justify-center relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06]">
              <div className="w-16 h-16 rounded-2xl bg-[#141F33] border border-[#1E2D44] flex items-center justify-center text-[#3978F6] mb-5 shadow-inner">
                <Wallet className="w-8 h-8 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
                Connect your Meteor Wallet
              </h2>
              <p className="text-sm sm:text-base text-[#94A3B8] mt-2.5 max-w-lg leading-relaxed">
                Connect your Meteor Wallet on NEAR Testnet to view your transactions, receipts, spending metrics, and authorize agent payment proposals.
              </p>
              <button
                type="button"
                onClick={signIn}
                className="mt-6 px-6 py-3 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-sm font-semibold flex items-center space-x-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Wallet className="w-4 h-4 text-white" />
                <span>Connect Wallet</span>
              </button>
            </div>
          ) : (
            <>
              {/* Daily Budget Allowance Hero Banner */}
              <div id="budget-section">
                <BudgetBanner
                  receipts={receipts}
                  totalOutgoingNear={summary?.totalOutgoingNear || 0}
                  onBudgetChange={(newBudget) => setDailyBudget(newBudget)}
                />
              </div>

              {/* 3. Financial Summary (4 Compact Cards) */}
              {summary && (
                <FinancialMetrics
                  summary={summary}
                  pendingProposalsCount={pendingProposalsCount}
                  dailyBudget={dailyBudget}
                  spentTodayNear={spentTodayNear}
                  onOpenProposals={() => setIsProposalsModalOpen(true)}
                  onOpenBudget={() => {
                    const btn = document.querySelector(
                      '[title="Change daily budget"], [title="Change budget"]'
                    ) as HTMLButtonElement | null;
                    if (btn) btn.click();
                  }}
                />
              )}

              {/* 5. Analytics (Two Attractive Chart Cards) */}
              <section id="analytics-section">
                <SpendingCharts receipts={receipts} summary={summary} />
              </section>

              {/* 6. Agent Overview (Top Agents by Spending) */}
              <section id="agents-section">
                <AgentOverview
                  receipts={receipts}
                  summary={summary}
                  onOpenConnections={() => setIsConnectionsModalOpen(true)}
                />
              </section>

              {/* 4. Payment Activity & Recent Transactions */}
              <section id="activity-section">
                <TransactionTable
                  receipts={receipts}
                  accountId={account}
                  onSelectReceipt={(receipt) => setSelectedReceipt(receipt)}
                  onOpenAuditReport={() => setIsAuditReportOpen(true)}
                  onOpenProposals={() => setIsProposalsModalOpen(true)}
                  pendingProposalsCount={pendingProposalsCount}
                  isLoading={isLoading}
                />
              </section>
            </>
          )}
        </main>

        {/* Modals */}
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />

        <AuditReportModal
          isOpen={isAuditReportOpen}
          onClose={() => setIsAuditReportOpen(false)}
          summary={summary}
          receipts={receipts}
          accountId={account}
        />

        <AgentConnectionsModal
          isOpen={isConnectionsModalOpen}
          onClose={() => setIsConnectionsModalOpen(false)}
          currentAccount={account}
          summary={summary}
          recentReceipts={receipts}
          onSelectAccount={(acc) => handleSearch(acc, false)}
        />

        <PaymentProposalsModal
          isOpen={isProposalsModalOpen}
          onClose={() => setIsProposalsModalOpen(false)}
          currentAccount={account}
          onProposalVerified={() => {
            refreshPendingProposals();
            if (isConnected && account) {
              fetchData(account, isDemo);
            }
          }}
        />

        {/* Footer */}
        <footer className="border-t border-[#1E2D44] bg-[#0B111D] py-6 text-xs text-[#64748B] mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="font-bold text-[#F8FAFC]">AgentReceipts</span>
              <span> — </span>
              <span>Financial control and audit for AI agents.</span>
            </div>

            <div className="flex items-center space-x-4 text-xs text-[#64748B]">
              {isConnected && account ? (
                <>
                  <a
                    href={`https://testnet.nearblocks.io/address/${account}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#3978F6] transition-colors"
                  >
                    NearBlocks
                  </a>
                  <span>•</span>
                </>
              ) : null}
              <a
                href="https://docs.near.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#3978F6] transition-colors"
              >
                NEAR Documentation
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

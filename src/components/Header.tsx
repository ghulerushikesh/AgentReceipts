"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Wallet,
  Bot,
  LogOut,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { useWalletSelector } from "@/context/WalletSelectorContext";

interface HeaderProps {
  currentAccount: string;
  isDemo?: boolean;
  isLoading: boolean;
  connectionStatus?: "AGENT_CONNECTED" | "ACCOUNT_MONITORED";
  pendingProposalsCount?: number;
  onSearch: (account: string, forceDemo?: boolean) => void;
  onRefresh: () => void;
  onToggleDemo?: () => void;
  onOpenConnections?: () => void;
  onOpenProposals?: () => void;
  onOpenAuditReport?: () => void;
}

function truncateAccount(id: string | null): string {
  if (!id) return "";
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

export default function Header({
  currentAccount,
  isDemo = false,
  isLoading,
  connectionStatus,
  pendingProposalsCount = 0,
  onSearch,
  onRefresh,
  onToggleDemo,
  onOpenConnections,
  onOpenProposals,
  onOpenAuditReport,
}: HeaderProps) {
  const [inputVal, setInputVal] = useState(currentAccount);
  const {
    accountId,
    isConnected,
    isLoading: isWalletLoading,
    error: walletError,
    signIn,
    signOut,
  } = useWalletSelector();

  useEffect(() => {
    setInputVal(currentAccount);
  }, [currentAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearch(inputVal.trim());
    }
  };

  return (
    <header className="border-b border-[#141E30] bg-[#080D19]/80 backdrop-blur-md sticky top-0 z-40 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Brand & Monitored Account Status */}
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#16233B] to-[#0E172A] flex items-center justify-center text-[#3978F6] shrink-0 border border-[#243554] shadow-card">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-[17px] font-extrabold text-[#F8FAFC] tracking-[-0.035em]">
                  AgentReceipts
                </span>

                {/* Account Monitoring Status Pill */}
                {onOpenConnections && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenConnections();
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center space-x-1.5 transition-all cursor-pointer select-none ${
                      connectionStatus === "AGENT_CONNECTED"
                        ? "bg-[#20B486]/15 text-[#20B486] border-[#20B486]/35 hover:bg-[#20B486]/25"
                        : "bg-[#0D1627] text-[#94A3B8] border-[#1C2B44] hover:bg-[#121E33] hover:text-[#F8FAFC]"
                    }`}
                    title="View Agent Webhook & Connection details"
                    aria-label="View Agent Webhook & Connection details"
                  >
                    <Bot className="w-3 h-3 stroke-[2.2] pointer-events-none" />
                    <span className="pointer-events-none font-semibold">
                      {connectionStatus === "AGENT_CONNECTED"
                        ? "Agent Connected"
                        : "Account Monitored"}
                    </span>
                  </button>
                )}

                {/* Pending Proposal Count Pill */}
                {onOpenProposals && (
                  <button
                    type="button"
                    id="proposals-button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenProposals();
                    }}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-[#0D1627] text-[#F8FAFC] border-[#1C2B44] hover:bg-[#121E33] hover:border-[#2D456E] active:scale-[0.98] flex items-center space-x-1.5 transition-all cursor-pointer select-none"
                    title="View Agent Payment Proposals"
                    aria-label="View Agent Payment Proposals"
                  >
                    <Wallet className="w-3 h-3 stroke-[2.2] text-[#3978F6] pointer-events-none" />
                    <span className="pointer-events-none">Proposals</span>
                    {pendingProposalsCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#F0A83B] text-[#101827] text-[10px] font-extrabold flex items-center justify-center pointer-events-none">
                        {pendingProposalsCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Monitored Account Info Subtitle */}
              <div className="flex items-center space-x-2 text-[11px] text-[#94A3B8] mt-0.5 truncate">
                <span className="text-[#64748B]">Auditing account:</span>
                <span className="font-mono text-[#F8FAFC] font-semibold truncate">
                  {currentAccount || "No account selected"}
                </span>
              </div>
            </div>
          </div>

          {/* Controls: Search, Audit Statement, Signer Wallet, Refresh */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Monitored Account Search Form */}
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Monitored account..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="w-44 sm:w-56 pl-9 pr-3 py-2 rounded-xl bg-[#0A101D] border border-[#1C2B44] text-[#F8FAFC] placeholder-[#64748B] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3978F6]/30 focus:border-[#3978F6] transition-all"
                  title="Monitored NEAR account to audit"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="ml-1.5 px-3.5 py-2 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs font-semibold transition-all shadow-card hover:shadow-cardHover disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                {isLoading ? "..." : "Audit"}
              </button>
            </form>

            {/* Audit Statement Action */}
            {onOpenAuditReport && (
              <button
                type="button"
                onClick={onOpenAuditReport}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#0D1627] hover:bg-[#121E33] text-[#F8FAFC] text-xs font-medium border border-[#1C2B44] hover:border-[#2D456E] transition-colors cursor-pointer"
                title="View and download complete audit statement"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-[#20B486]" />
                <span>Audit Statement</span>
              </button>
            )}

            {/* Signer Wallet Component (Strictly separate from monitored account) */}
            {isConnected ? (
              <div
                className="flex items-center space-x-2 bg-[#0B1220] border border-[#18263E] rounded-xl px-3 py-1.5 text-xs text-[#F8FAFC] shadow-sm"
                title={`Connected Signer Wallet: ${accountId} (NEAR Testnet)`}
              >
                <span className="w-2 h-2 rounded-full bg-[#20B486]" />
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[9px] uppercase tracking-wider text-[#20B486] font-bold">
                    Signer Wallet
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#F8FAFC] mt-0.5">
                    {truncateAccount(accountId)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="ml-1 p-1 rounded-lg hover:bg-[#141E30] text-[#94A3B8] hover:text-[#EF4444] transition-colors cursor-pointer"
                  title="Disconnect wallet"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="px-4 py-2 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer active:scale-[0.98]"
                title="Connect Meteor Wallet on NEAR Testnet"
              >
                <Wallet className="w-3.5 h-3.5 text-white" />
                <span>Connect Wallet</span>
              </button>
            )}

            {/* Refresh Action */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#0D1627] hover:bg-[#121E33] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1C2B44] transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh transactions"
              aria-label="Refresh transactions"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading ? "animate-spin text-[#3978F6]" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Wallet error banner if any */}
        {walletError && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#F87171] text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
              <span>{walletError}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

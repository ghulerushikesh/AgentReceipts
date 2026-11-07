"use client";

import React from "react";
import {
  LayoutDashboard,
  Bot,
  CreditCard,
  Receipt,
  FileText,
  SlidersHorizontal,
  FileCheck2,
  Wallet,
  LogOut,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface SidebarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  pendingProposalsCount?: number;
  connectionStatus?: "AGENT_CONNECTED" | "ACCOUNT_MONITORED";
  isConnected: boolean;
  accountId: string | null;
  onOpenProposals?: () => void;
  onOpenConnections?: () => void;
  onOpenAuditReport?: () => void;
  onOpenBudget?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

function truncateAccount(id: string | null): string {
  if (!id) return "";
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

export default function Sidebar({
  activeSection,
  onNavigate,
  pendingProposalsCount = 0,
  connectionStatus,
  isConnected,
  accountId,
  onOpenProposals,
  onOpenConnections,
  onOpenAuditReport,
  onOpenBudget,
  onSignIn,
  onSignOut,
}: SidebarProps) {
  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      action: () => onNavigate("overview"),
    },
    {
      id: "agents",
      label: "Agents",
      icon: Bot,
      badge: connectionStatus === "AGENT_CONNECTED" ? "Connected" : undefined,
      badgeColor: "bg-[#20B486]/15 text-[#20B486] border-[#20B486]/30 font-semibold",
      action: () => {
        if (onOpenConnections) onOpenConnections();
        else onNavigate("agents");
      },
    },
    {
      id: "proposals",
      label: "Payment Proposals",
      icon: CreditCard,
      badge: pendingProposalsCount > 0 ? `${pendingProposalsCount}` : undefined,
      badgeColor: "bg-[#F0A83B] text-[#0B0F19] font-extrabold shadow-sm",
      action: () => {
        if (onOpenProposals) onOpenProposals();
        else onNavigate("proposals");
      },
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: Receipt,
      action: () => onNavigate("transactions"),
    },
    {
      id: "receipts",
      label: "Receipts",
      icon: FileText,
      action: () => onNavigate("receipts"),
    },
    {
      id: "spending-policies",
      label: "Spending Policies",
      icon: SlidersHorizontal,
      action: () => {
        if (onOpenBudget) onOpenBudget();
        else onNavigate("spending-policies");
      },
    },
    {
      id: "audit-report",
      label: "Audit Statement",
      icon: FileCheck2,
      action: () => {
        if (onOpenAuditReport) onOpenAuditReport();
        else onNavigate("audit-report");
      },
    },
  ];

  return (
    <aside className="w-64 xl:w-72 bg-[#050811] border-r border-[#141E30] flex flex-col justify-between shrink-0 select-none min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-[#141E30] bg-gradient-to-b from-[#090F1C] to-[#050811]">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#16233B] via-[#0E172A] to-[#070B16] border border-[#243554] flex items-center justify-center text-[#3978F6] shadow-[0_0_16px_rgba(57,120,246,0.2)] shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-[17px] text-[#F8FAFC] tracking-[-0.035em] truncate">
                  AgentReceipts
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-[#3978F6]/15 text-[#60A5FA] border border-[#3978F6]/30">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] font-medium tracking-tight mt-0.5">
                Financial control &amp; audit
              </p>
            </div>
          </div>
        </div>

        {/* Primary Navigation Menu */}
        <nav className="p-3.5 space-y-1.5">
          <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Platform Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer group ${
                  isActive
                    ? "bg-[#0C1527] text-[#F8FAFC] font-semibold border border-[#1C2C47] shadow-[0_2px_12px_rgba(0,0,0,0.3)] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-r before:bg-[#3978F6] before:shadow-[0_0_8px_#3978F6]"
                    : "text-[#8899AC] hover:text-[#F8FAFC] hover:bg-[#0B1220]"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive
                        ? "text-[#3978F6]"
                        : "text-[#64748B] group-hover:text-[#94A3B8]"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center justify-center leading-none ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Network & Signer Status */}
      <div className="p-4 border-t border-[#141E30] bg-[#04060E] space-y-3">
        {/* Network status indicator */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#080E1C] border border-[#141E30] text-[11px]">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#20B486] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#20B486]" />
            </span>
            <span className="font-semibold text-[#F8FAFC]">NEAR Testnet</span>
          </div>
          <span className="font-mono text-[10px] text-[#20B486] bg-[#20B486]/10 px-2 py-0.5 rounded-full border border-[#20B486]/25 font-bold">
            Live
          </span>
        </div>

        {/* Connected Signer Wallet or Connect CTA */}
        {isConnected && accountId ? (
          <div className="p-2.5 rounded-xl bg-[#0B1220] border border-[#18263E] flex items-center justify-between gap-2 shadow-sm">
            <div className="min-w-0 flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#0C1A18] border border-[#16362D] flex items-center justify-center text-[#20B486] shrink-0">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-bold text-[#20B486] block leading-none">
                  Signer Wallet
                </span>
                <span
                  className="font-mono text-[11px] font-semibold text-[#F8FAFC] truncate block mt-0.5"
                  title={accountId}
                >
                  {truncateAccount(accountId)}
                </span>
              </div>
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="p-1.5 rounded-lg hover:bg-[#141E30] text-[#94A3B8] hover:text-[#EF4444] transition-colors cursor-pointer shrink-0"
                title="Disconnect wallet"
                aria-label="Disconnect wallet"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : onSignIn ? (
          <button
            type="button"
            onClick={onSignIn}
            className="w-full py-2.5 px-3 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs font-semibold flex items-center justify-center space-x-2 shadow-[0_0_18px_rgba(57,120,246,0.3)] transition-all cursor-pointer active:scale-[0.98]"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Connect Wallet</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}

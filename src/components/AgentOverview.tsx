"use client";

import React, { useMemo } from "react";
import { AgentReceipt, AccountFinancialSummary } from "@/types/receipt";
import { NEAR_USD_ESTIMATE } from "@/lib/near";
import { Bot, ShieldCheck, ArrowUpRight } from "lucide-react";

interface AgentOverviewProps {
  receipts: AgentReceipt[];
  summary: AccountFinancialSummary | null;
  onOpenConnections?: () => void;
}

export default function AgentOverview({
  receipts,
  summary,
  onOpenConnections,
}: AgentOverviewProps) {
  // Aggregate real spending by agent
  const agentRanking = useMemo(() => {
    const outgoing = receipts.filter(
      (r) => r.direction === "OUTGOING" && r.status === "SUCCESS"
    );

    const grouped: Record<
      string,
      {
        agentId: string;
        agentName: string;
        totalNear: number;
        executions: number;
        status: "AGENT_CONNECTED" | "ACCOUNT_MONITORED";
        category?: string;
        lastActiveTimestamp?: number;
      }
    > = {};

    outgoing.forEach((r) => {
      const agentId = r.attribution?.agentId || r.predecessorId || "oracle-agent.testnet";
      const agentName =
        r.attribution?.agentName ||
        (r.attribution?.agentId ? "External Oracle Data Agent" : "Monitored Agent Runner");

      if (!grouped[agentId]) {
        grouped[agentId] = {
          agentId,
          agentName,
          totalNear: 0,
          executions: 0,
          status:
            r.attribution?.status === "CONFIRMED"
              ? "AGENT_CONNECTED"
              : summary?.connectionStatus || "ACCOUNT_MONITORED",
          category: r.attribution?.category || "Data Oracle & Micro-tasks",
          lastActiveTimestamp: r.blockTimestamp,
        };
      }

      grouped[agentId].totalNear += r.amountNear;
      grouped[agentId].executions += 1;
      if (r.blockTimestamp > (grouped[agentId].lastActiveTimestamp || 0)) {
        grouped[agentId].lastActiveTimestamp = r.blockTimestamp;
      }
    });

    const list = Object.values(grouped).sort((a, b) => b.totalNear - a.totalNear);

    // If no outgoing transactions with agents exist, fallback to registered external agent if connected
    if (list.length === 0 && summary) {
      return [
        {
          agentId: "oracle-agent.testnet",
          agentName: summary.connectedAgentName || "External Oracle Data Agent",
          totalNear: 0,
          executions: 0,
          status: summary.connectionStatus || "ACCOUNT_MONITORED",
          category: "External Oracle Feed",
          lastActiveTimestamp: Date.now(),
        },
      ];
    }

    return list;
  }, [receipts, summary]);

  return (
    <div className="rounded-2xl bg-[#0D1627]/85 backdrop-blur-sm border border-[#1A2840] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06] relative">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-[#162338] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#090F1C]/70">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-[#3978F6]/15 border border-[#3978F6]/30 flex items-center justify-center text-[#3978F6]">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">Top Agents by Spending</h3>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Verified micro-payments and autonomous task execution allocation
          </p>
        </div>

        {onOpenConnections && (
          <button
            type="button"
            onClick={onOpenConnections}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-[#111C31] hover:bg-[#162542] text-[#60A5FA] hover:text-white text-xs font-semibold border border-[#1A2840] hover:border-[#3978F6]/40 flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#3978F6]" />
            <span>Manage Agent Connections</span>
          </button>
        )}
      </div>

      {/* Agents List / Grid */}
      <div className="divide-y divide-[#162338]">
        {agentRanking.map((agent, index) => {
          const isConnected = agent.status === "AGENT_CONNECTED";
          const isFirst = index === 0;
          return (
            <div
              key={agent.agentId}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#111C31]/60 transition-colors"
            >
              {/* Agent Meta */}
              <div className="flex items-center space-x-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-sm ${
                    isFirst
                      ? "bg-gradient-to-br from-[#3978F6]/25 to-[#121E36] border border-[#3978F6]/40 text-[#60A5FA] shadow-[0_0_10px_rgba(57,120,246,0.2)]"
                      : "bg-[#080E1C] border border-[#162338] text-[#94A3B8]"
                  }`}
                >
                  #{index + 1}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-[#F8FAFC] truncate">
                      {agent.agentName}
                    </span>
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isConnected
                          ? "bg-[#20B486]/10 text-[#20B486] border-[#20B486]/30"
                          : "bg-[#0E172A] text-[#94A3B8] border-[#162338]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isConnected ? "bg-[#20B486]" : "bg-[#64748B]"
                        }`}
                      />
                      <span>{isConnected ? "Agent Connected" : "Account Monitored"}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-[#94A3B8] mt-0.5 font-mono truncate">
                    <span className="text-[#94A3B8]">{agent.agentId}</span>
                    <span className="text-[#475569]">•</span>
                    <span className="font-sans text-[#64748B]">{agent.category}</span>
                  </div>
                </div>
              </div>

              {/* Spending Figures & Executions */}
              <div className="flex items-center justify-between sm:justify-end space-x-6 shrink-0">
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-[#64748B] block">Executions</span>
                  <span className="font-semibold text-xs text-[#F8FAFC]">
                    {agent.executions} verified task{agent.executions === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-mono font-extrabold text-sm sm:text-base text-[#F8FAFC] block tabular-nums">
                    {agent.totalNear < 0.01 ? agent.totalNear.toFixed(4) : agent.totalNear.toFixed(2)}{" "}
                    NEAR
                  </span>
                  <span className="text-[11px] text-[#64748B] block tabular-nums">
                    ≈ ${(agent.totalNear * NEAR_USD_ESTIMATE).toFixed(2)} USD
                  </span>
                </div>

                {onOpenConnections && (
                  <button
                    type="button"
                    onClick={onOpenConnections}
                    className="p-2 rounded-xl bg-[#080E1C] hover:bg-[#162338] text-[#94A3B8] hover:text-[#3978F6] border border-[#162338] transition-colors cursor-pointer hidden sm:block"
                    title="Inspect agent details and webhook"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

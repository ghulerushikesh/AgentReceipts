"use client";

import React, { useState } from "react";
import {
  X,
  Bot,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { AgentReceipt, AccountFinancialSummary } from "@/types/receipt";

interface AgentConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: string;
  summary: AccountFinancialSummary | null;
  recentReceipts: AgentReceipt[];
  onSelectAccount?: (account: string) => void;
}

export default function AgentConnectionsModal({
  isOpen,
  onClose,
  currentAccount,
  summary,
  recentReceipts,
  onSelectAccount,
}: AgentConnectionsModalProps) {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isTokenMasked, setIsTokenMasked] = useState(true);
  const [connectionsList, setConnectionsList] = useState<any[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      fetch("/api/agent/connections")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.connections)) {
            setConnectionsList(d.connections);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConnected = summary?.connectionStatus === "AGENT_CONNECTED";
  const agentName = summary?.connectedAgentName || (isConnected ? "Autonomous Agent" : "No agent connected");
  const sampleTxHash = recentReceipts[0]?.hash || "<ON_CHAIN_TX_HASH>";

  const tokenDisplay = isTokenMasked
    ? "••••••••••••••••••••••••••••••••"
    : "<YOUR_AGENT_WEBHOOK_SECRET>";

  const curlDisplaySnippet = `curl -X POST http://localhost:3000/api/agent/events \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenDisplay}" \\
  -d '{
    "eventId": "evt_${Date.now()}",
    "agentId": "oracle-agent.testnet",
    "agentName": "Oracle Service Agent",
    "accountId": "${currentAccount || "your-account.testnet"}",
    "txHash": "${sampleTxHash}",
    "taskId": "TASK-8942",
    "promptSnippet": "Fetch decentralized oracle price feed and settle query fee",
    "actionDescription": "Oracle Query Fee Settlement"
  }'`;

  // Safe template copy: never embeds or exposes actual server-side secrets
  const curlCopySnippet = `curl -X POST http://localhost:3000/api/agent/events \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_AGENT_WEBHOOK_SECRET>" \\
  -d '{
    "eventId": "evt_${Date.now()}",
    "agentId": "oracle-agent.testnet",
    "agentName": "Oracle Service Agent",
    "accountId": "${currentAccount || "your-account.testnet"}",
    "txHash": "${sampleTxHash}",
    "taskId": "TASK-8942",
    "promptSnippet": "Fetch decentralized oracle price feed and settle query fee",
    "actionDescription": "Oracle Query Fee Settlement"
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCopySnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#18243A] border border-[#263750] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-modal flex flex-col text-[#F8FAFC]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1E2D44] bg-[#142034]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E2D44] flex items-center justify-center text-[#3978F6] border border-[#263750]">
              <Bot className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F8FAFC] tracking-tight">
                Agent Connections & Verification
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Bridge on-chain NEAR transactions with authenticated AI agent execution logs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2D44] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Status Indicator Card */}
          <div
            className={`p-4 rounded-xl border ${
              isConnected
                ? "bg-[#20B486]/15 border-[#20B486]/30"
                : "bg-[#F0A83B]/15 border-[#F0A83B]/30"
            }`}
          >
            <div className="flex items-start space-x-3">
              {isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-[#20B486] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#F0A83B] shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-[#F8FAFC]">
                    {isConnected ? "Agent Connected & Verified" : "Account Monitored (Read-Only)"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isConnected
                        ? "bg-[#20B486] text-[#101827]"
                        : "bg-[#F0A83B] text-[#101827]"
                    }`}
                  >
                    {isConnected ? "LIVE INTEGRATION" : "ON-CHAIN LEDGER"}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  {isConnected
                    ? `Agent '${agentName}' is streaming task IDs and prompt snippets for NEAR account '${currentAccount}'. On-chain transactions matching reported hashes are cryptographically verified.`
                    : `Viewing verified on-chain ledger records for '${currentAccount}'. To attribute transfers to specific agent prompts or mission IDs, your agent runner can report execution events.`}
                </p>
              </div>
            </div>
          </div>

          {/* Connection Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#121D30] p-4 rounded-xl border border-[#263750]">
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Agent Name</span>
              <span className="text-xs font-semibold text-[#F8FAFC] truncate block">
                {agentName}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Public Account</span>
              <span className="text-xs font-mono font-medium text-[#F8FAFC] truncate block">
                {currentAccount}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Network</span>
              <span className="text-xs font-semibold text-[#20B486] block">NEAR Testnet</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Last Sync</span>
              <span className="text-xs font-medium text-[#F8FAFC] block">
                {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleTimeString() : "Just now"}
              </span>
            </div>
          </div>

          {/* Registered Genuinely Connected Agents */}
          {connectionsList.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                Genuinely Connected Agents
              </h3>
              <div className="space-y-2">
                {connectionsList.map((conn) => {
                  const isCurrent =
                    conn.accountId?.toLowerCase() === currentAccount.toLowerCase();
                  return (
                    <div
                      key={conn.accountId}
                      className="p-3 rounded-xl bg-[#121D30] border border-[#263750] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-[#F8FAFC]">{conn.agentName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#20B486]/15 text-[#20B486] border border-[#20B486]/30">
                            {conn.network || "NEAR Testnet"}
                          </span>
                        </div>
                        <span className="font-mono text-[#94A3B8] text-[11px] block mt-0.5">
                          {conn.accountId}
                        </span>
                      </div>
                      {isCurrent ? (
                        <span className="px-2.5 py-1 rounded-lg bg-[#20B486]/15 text-[#20B486] text-xs font-semibold border border-[#20B486]/30">
                          Currently Monitored
                        </span>
                      ) : onSelectAccount ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectAccount(conn.accountId);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#18243A] hover:bg-[#1E2D44] text-[#3978F6] border border-[#263750] font-medium transition-colors cursor-pointer"
                        >
                          Audit This Agent
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#121D30] border border-[#263750] text-center space-y-1">
              <span className="text-xs font-semibold text-[#F8FAFC] block">No External Agents Registered</span>
              <p className="text-[11px] text-[#94A3B8]">
                External AI agents register automatically upon reporting authenticated execution events via the webhook specification below.
              </p>
            </div>
          )}

          {/* Secure Webhook Endpoint Documentation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#3978F6]" />
                <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                  Agent Webhook Specification (cURL)
                </h3>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsTokenMasked(!isTokenMasked)}
                  className="text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] flex items-center space-x-1 transition-colors cursor-pointer"
                  title={isTokenMasked ? "Reveal token placeholder" : "Mask token"}
                  aria-label={isTokenMasked ? "Reveal token placeholder" : "Mask token"}
                >
                  {isTokenMasked ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal placeholder</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Mask token</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="text-xs font-medium text-[#3978F6] hover:text-[#60A5FA] flex items-center space-x-1 cursor-pointer"
                >
                  {copiedCurl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#20B486]" />
                      <span className="text-[#20B486]">Copied template!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy cURL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-[#101827] text-[#94A3B8] font-mono text-[11px] leading-relaxed overflow-x-auto border border-[#263750]">
                {curlDisplaySnippet}
              </pre>
            </div>
            <div className="flex items-start space-x-2 text-[11px] text-[#94A3B8] leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-[#3978F6] shrink-0 mt-0.5" />
              <p>
                Credentials are masked by default. Replace <code className="font-mono text-[#F8FAFC] bg-[#121D30] border border-[#263750] px-1 py-0.5 rounded">&lt;YOUR_AGENT_WEBHOOK_SECRET&gt;</code> with the secret configured in your server environment (<code className="font-mono text-[#F8FAFC] bg-[#121D30] border border-[#263750] px-1 py-0.5 rounded">.env.local</code>). Actual secrets are never exposed in browser or frontend code.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1E2D44] bg-[#142034] rounded-b-2xl flex items-center justify-between">
          <span className="text-xs text-[#64748B]">
            Complies with NEAR Hackathon Evidence-First Accounting Standard
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#18243A] border border-[#263750] text-xs font-semibold text-[#F8FAFC] hover:bg-[#1E2D44] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

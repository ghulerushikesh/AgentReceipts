"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Bot,
  Wallet,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
  FileCheck2,
} from "lucide-react";
import { PaymentProposal, AgentTaskRecord } from "@/agent/types";
import { useWalletSelector } from "@/context/WalletSelectorContext";

interface PaymentProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: string;
  onProposalVerified?: () => void;
}

type ConfirmationStage =
  | "WALLET_SIGNING"
  | "TRANSACTION_SUBMITTED"
  | "CONFIRMING_ON_CHAIN"
  | "VERIFIED";

/**
 * Visual 4-Step Progress Indicator:
 * Awaiting Approval → Wallet Confirmation → Payment Submitted → Verified
 */
function ProposalStatusStepper({
  status,
  isApproving,
  isVerifying,
}: {
  status: string;
  isApproving: boolean;
  isVerifying: boolean;
}) {
  const steps = [
    { key: "awaiting", label: "Awaiting Approval" },
    { key: "wallet", label: "Wallet Confirmation" },
    { key: "submitted", label: "Payment Submitted" },
    { key: "verified", label: "Verified" },
  ];

  let currentStep = 0;
  if (status === "PROPOSED") {
    currentStep = isApproving ? 1 : 0;
  } else if (status === "APPROVED") {
    currentStep = 1;
  } else if (status === "SUBMITTED") {
    currentStep = 2;
  } else if (status === "VERIFIED") {
    currentStep = 3;
  } else if (status === "REJECTED" || status === "FAILED") {
    currentStep = -1;
  }

  if (status === "REJECTED") {
    return (
      <div className="flex items-center space-x-2 py-2 px-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs font-semibold text-[#F87171]">
        <X className="w-4 h-4 shrink-0 text-[#EF4444]" />
        <span>Payment Rejected — No funds were transferred</span>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="flex items-center space-x-2 py-2 px-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs font-semibold text-[#F87171]">
        <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
        <span>Transaction Failed on NEAR Testnet</span>
      </div>
    );
  }

  return (
    <div className="py-2.5 px-3 bg-[#121D30] rounded-xl border border-[#263750]">
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center z-10 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isDone
                      ? "bg-[#20B486] text-[#101827]"
                      : isCurrent
                      ? "bg-[#3978F6] text-white ring-4 ring-[#3978F6]/25"
                      : "bg-[#1E2D44] text-[#64748B]"
                  }`}
                >
                  {isDone ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium text-center ${
                    isCurrent
                      ? "text-[#F8FAFC] font-bold"
                      : isDone
                      ? "text-[#20B486]"
                      : "text-[#64748B]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-6 sm:w-12 h-[2px] transition-all -mt-3.5 ${
                    idx < currentStep ? "bg-[#20B486]" : "bg-[#1E2D44]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function PaymentProposalsModal({
  isOpen,
  onClose,
  currentAccount,
  onProposalVerified,
}: PaymentProposalsModalProps) {
  const [proposals, setProposals] = useState<PaymentProposal[]>([]);
  const [activeTab, setActiveTab] = useState<"PENDING" | "ALL">("PENDING");
  const [isLoading, setIsLoading] = useState(false);
  const [verifyingProposalId, setVerifyingProposalId] = useState<string | null>(null);
  const [approvingProposalId, setApprovingProposalId] = useState<string | null>(null);
  const [rejectingProposalId, setRejectingProposalId] = useState<string | null>(null);
  const [liveConfirmationProposalId, setLiveConfirmationProposalId] = useState<string | null>(null);
  const [liveConfirmationStage, setLiveConfirmationStage] = useState<ConfirmationStage | null>(null);
  const [recentApprovedHash, setRecentApprovedHash] = useState<string | null>(null);
  const [txHashInputs, setTxHashInputs] = useState<Record<string, string>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const { accountId, isConnected, signIn, sendPayment } = useWalletSelector();
  const pollingRef = useRef<boolean>(false);

  const fetchProposals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/agent/proposals");
      const data = await res.json();
      if (data.success && Array.isArray(data.proposals)) {
        setProposals(data.proposals);
      }
    } catch (e) {
      console.warn("Failed to fetch proposals:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProposals();
      setFeedback(null);
    }
  }, [isOpen, fetchProposals]);

  // Automated background polling for submitted proposals awaiting finality
  useEffect(() => {
    if (!isOpen) return;

    // Check if any proposal in store is in SUBMITTED state with a txHash and needs on-chain verification
    const submittedProposal = proposals.find(
      (p) => p.status === "SUBMITTED" && Boolean(p.txHash)
    );

    if (
      submittedProposal &&
      submittedProposal.txHash &&
      !verifyingProposalId &&
      !approvingProposalId
    ) {
      handleVerifyTxHash(submittedProposal.proposalId, submittedProposal.txHash);
    }

    const hasSubmitted = proposals.some(
      (p) => p.status === "SUBMITTED" || p.proposalId === liveConfirmationProposalId
    );

    if (!hasSubmitted && !verifyingProposalId) return;

    const interval = setInterval(() => {
      fetchProposals();
    }, 2500);

    return () => clearInterval(interval);
  }, [
    isOpen,
    proposals,
    liveConfirmationProposalId,
    verifyingProposalId,
    approvingProposalId,
    fetchProposals,
  ]);

  if (!isOpen) return null;

  const pendingProposals = proposals.filter(
    (p) =>
      p.status === "PROPOSED" ||
      p.status === "SUBMITTED" ||
      p.proposalId === liveConfirmationProposalId
  );
  const displayedProposals = activeTab === "PENDING" ? pendingProposals : proposals;

  // Safe server-side trigger handler (does not expose webhook secret to client)
  const handleTriggerTask = async (taskType: "ORACLE_PRICE_FETCH" | "SERVICE_HEALTH_PING") => {
    try {
      const prompt =
        taskType === "ORACLE_PRICE_FETCH"
          ? "Retrieve latest NEAR/USD price feed and settle 0.01 NEAR oracle computation fee."
          : "Ping NEAR Testnet RPC node health and latency. Zero payment required.";
      const effectivePayer =
        accountId ||
        (currentAccount.includes(".testnet") ? currentAccount : "agent-operator.testnet");
      await fetch("/api/agent/proposals/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          payerAccount: effectivePayer,
          amountNear: 0.01,
          prompt,
        }),
      });
      await fetchProposals();
    } catch (e) {
      console.warn("Trigger task error:", e);
    }
  };

  /**
   * Progressive, resilient verification with automated polling.
   * Does not block the UI while NEAR Testnet finalizes block receipts.
   */
  const handleVerifyTxHash = async (
    proposalId: string,
    directHash?: string,
    maxAttempts = 15,
    delayMs = 1500,
    payerAccount?: string
  ) => {
    const inputHash = (directHash || txHashInputs[proposalId] || "").trim();
    if (!inputHash) {
      setFeedback({
        type: "error",
        text: "Please enter a valid NEAR Testnet transaction hash.",
      });
      return;
    }

    const effectivePayer = payerAccount || (accountId && accountId.endsWith(".testnet") ? accountId : undefined);

    setVerifyingProposalId(proposalId);
    setLiveConfirmationProposalId(proposalId);
    setLiveConfirmationStage("CONFIRMING_ON_CHAIN");
    setRecentApprovedHash(inputHash);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`/api/agent/proposals/${proposalId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: inputHash,
            payerAccount: effectivePayer,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setLiveConfirmationStage("VERIFIED");
          setFeedback({
            type: "success",
            text: `Payment verified on NEAR Testnet! Block #${data.verificationDetails?.blockHeight || "final"}. Evidence-backed receipt created in AgentReceipts.`,
          });
          await fetchProposals();
          if (onProposalVerified) {
            onProposalVerified();
          }
          setVerifyingProposalId(null);
          return;
        }

        const errorMsg: string = (data.error || "").toLowerCase();
        const rawError: string = data.error || "";
        const isPending =
          errorMsg.includes("pending") ||
          errorMsg.includes("not found") ||
          errorMsg.includes("doesn't exist") ||
          errorMsg.includes("does not exist") ||
          errorMsg.includes("unknown_transaction") ||
          errorMsg.includes("UNKNOWN_TRANSACTION") ||
          errorMsg.includes("timeout") ||
          errorMsg.includes("TIMEOUT") ||
          errorMsg.includes("db not found") ||
          errorMsg.includes("not ready") ||
          errorMsg.includes("status 422");

        if (isPending && attempt < maxAttempts) {
          setFeedback({
            type: "info",
            text: `Confirming on NEAR Testnet (attempt ${attempt}/${maxAttempts})... Finalizing block receipts.`,
          });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // Definite failure or unrecoverable error
        throw new Error(data.error || "Transaction verification failed on NEAR Testnet");
      } catch (err: any) {
        if (attempt < maxAttempts) {
          // Keep polling through transient errors, indexing delays, and pending blocks
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        if (attempt >= maxAttempts) {
          setFeedback({
            type: "info",
            text: `Transaction submitted (${inputHash.slice(0, 10)}...). NEAR Testnet is finalizing block receipts. The status will update automatically.`,
          });
          await fetchProposals();
          setVerifyingProposalId(null);
          return;
        }
        setFeedback({
          type: "error",
          text: err.message || "Failed to verify on NEAR Testnet RPC",
        });
        setVerifyingProposalId(null);
        return;
      }
    }
    setVerifyingProposalId(null);
  };

  // Reject a proposal without creating or broadcasting a transaction
  const handleRejectProposal = async (proposalId: string) => {
    if (approvingProposalId || verifyingProposalId || rejectingProposalId) return;

    setRejectingProposalId(proposalId);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/agent/proposals/${encodeURIComponent(proposalId)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Rejected by wallet owner" }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject proposal");
      }
      setFeedback({
        type: "success",
        text: `Payment proposal #${proposalId} rejected. No transaction was signed or broadcast.`,
      });
      await fetchProposals();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to reject proposal.",
      });
    } finally {
      setRejectingProposalId(null);
    }
  };

  // Human approval via Meteor Wallet with dynamic payer support and duplicate-click protection
  const handleApproveViaMeteor = async (proposal: PaymentProposal) => {
    // Prevent duplicate clicks if already processing
    if (approvingProposalId || verifyingProposalId || rejectingProposalId) {
      return;
    }

    if (!isConnected || !accountId) {
      signIn();
      return;
    }

    // Safety check 1: Enforce valid NEAR Testnet connected wallet
    const cleanConnectedSigner = accountId.trim().toLowerCase();
    if (!cleanConnectedSigner.endsWith(".testnet")) {
      setFeedback({
        type: "error",
        text: `Connected wallet (${accountId}) is not a valid NEAR Testnet account. Please connect a valid Testnet account.`,
      });
      return;
    }

    // Safety check 2: Prevent approval of proposals that failed policy or were rejected
    if (!proposal.policyCheck.passed || proposal.status === "REJECTED") {
      setFeedback({
        type: "error",
        text: `Policy violation: This proposal failed spending limits (${proposal.policyCheck.reason}) and cannot be submitted.`,
      });
      return;
    }

    // Safety check 3: Proposal must still be PROPOSED
    if (proposal.status !== "PROPOSED") {
      setFeedback({
        type: "error",
        text: `Proposal #${proposal.proposalId} is ${proposal.status} and cannot be submitted for payment.`,
      });
      return;
    }

    setApprovingProposalId(proposal.proposalId);
    setLiveConfirmationProposalId(proposal.proposalId);
    setLiveConfirmationStage("WALLET_SIGNING");
    setRecentApprovedHash(null);
    setFeedback(null);

    try {
      // Server-side policy validation immediately before opening the Meteor Wallet approval popup
      // Rechecks against connected signer's daily allowance and spending policy
      const validateRes = await fetch(
        `/api/agent/proposals/${encodeURIComponent(proposal.proposalId)}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signerAccount: cleanConnectedSigner }),
        }
      );
      const validateData = await validateRes.json();
      if (!validateRes.ok || !validateData.success) {
        await fetchProposals();
        throw new Error(
          validateData.error ||
            "Proposal failed server-side validation before wallet approval."
        );
      }

      // Check for unintended wallet switch during pre-flight validation
      if (accountId && accountId.trim().toLowerCase() !== cleanConnectedSigner) {
        throw new Error(
          "Wallet account changed during pre-approval validation. Payment aborted."
        );
      }

      // 1. Explicit human approval prompt inside Meteor Wallet on NEAR Testnet
      const { txHash } = await sendPayment({
        recipientId: proposal.recipientAccount,
        amountYocto: proposal.amountYocto,
        amountNear: proposal.amountNear,
      });

      // Check for unintended wallet switch during signing
      if (accountId && accountId.trim().toLowerCase() !== cleanConnectedSigner) {
        throw new Error(
          "Wallet account changed during signing. Verification aborted."
        );
      }

      // Wallet approval received & transaction submitted
      setRecentApprovedHash(txHash);
      setLiveConfirmationStage("TRANSACTION_SUBMITTED");

      // 2. Independently verify on NEAR Testnet RPC through our backend with automated polling
      await handleVerifyTxHash(proposal.proposalId, txHash, 15, 1500, cleanConnectedSigner);
    } catch (err: any) {
      console.warn("Meteor Wallet payment approval error:", err);
      const isCancellation =
        err?.message?.includes("rejected") ||
        err?.message?.includes("reject") ||
        err?.message?.includes("cancelled") ||
        err?.message?.includes("cancel") ||
        err?.message?.includes("User rejected");

      setFeedback({
        type: "error",
        text: isCancellation
          ? "Payment was rejected or cancelled in Meteor Wallet. No funds were transferred."
          : err?.message || "Payment approval failed in Meteor Wallet.",
      });
      setLiveConfirmationStage(null);
      setLiveConfirmationProposalId(null);
    } finally {
      setApprovingProposalId(null);
    }
  };

  const toggleDetails = (proposalId: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [proposalId]: !prev[proposalId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-[#18243A] border border-[#263750] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-modal flex flex-col text-[#F8FAFC]">
        {/* Header */}
        <div className="p-5 border-b border-[#1E2D44] flex items-center justify-between bg-[#142034]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E2D44] flex items-center justify-center text-[#20B486] border border-[#263750] shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-[#F8FAFC] tracking-tight">
                  Agent Payment Proposals & Approvals
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#20B486]/15 text-[#20B486] border border-[#20B486]/30">
                  NEAR Testnet
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Review and approve micro-payments requested by your external AI agents.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2D44] transition-colors cursor-pointer"
            aria-label="Close proposals modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clear Security Explanation Banner */}
        <div className="px-5 py-3 bg-[#20B486]/10 border-b border-[#20B486]/25 text-xs text-[#20B486] flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#20B486] shrink-0" />
            <span className="font-medium">
              <strong>Human Authorization Required:</strong> Your payment will only happen after you approve it in Meteor Wallet.
            </span>
          </div>
          <span className="hidden sm:inline-block text-[11px] text-[#20B486]/80 font-medium shrink-0">
            No autonomous signing
          </span>
        </div>

        {/* Tabs & Refresh Bar */}
        <div className="p-3.5 sm:px-5 border-b border-[#1E2D44] bg-[#101827]/60 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-[#121D30] p-1 text-xs border border-[#263750]">
            <button
              type="button"
              onClick={() => setActiveTab("PENDING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "PENDING"
                  ? "bg-[#1E2D44] text-[#F8FAFC] shadow-sm"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              Pending Approval ({pendingProposals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-[#1E2D44] text-[#F8FAFC] shadow-sm"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              All Proposals ({proposals.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchProposals()}
            disabled={isLoading || Boolean(verifyingProposalId)}
            className="px-3 py-1.5 rounded-xl bg-[#142034] border border-[#263750] hover:bg-[#1E2D44] text-[#F8FAFC] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh payment proposals"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#3978F6] ${
                isLoading || Boolean(verifyingProposalId) ? "animate-spin" : ""
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-5 mt-4 p-3.5 rounded-xl text-xs font-medium flex items-start space-x-2.5 shadow-sm ${
              feedback.type === "success"
                ? "bg-[#20B486]/15 text-[#20B486] border border-[#20B486]/30"
                : feedback.type === "info"
                ? "bg-[#3978F6]/15 text-[#60A5FA] border border-[#3978F6]/30"
                : "bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#20B486] shrink-0 mt-0.5" />
            ) : feedback.type === "info" ? (
              <RefreshCw className="w-4 h-4 text-[#3978F6] animate-spin shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {/* Proposals List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {isLoading && proposals.length === 0 ? (
            <div className="py-14 text-center text-[#94A3B8] text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#3978F6]" />
              <span>Loading payment proposals...</span>
            </div>
          ) : displayedProposals.length === 0 ? (
            <div className="py-14 text-center text-[#94A3B8] space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-[#142034] border border-[#263750] flex items-center justify-center mx-auto text-[#64748B]">
                <Bot className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="text-sm font-bold text-[#F8FAFC]">
                {proposals.length === 0
                  ? "No payment proposals yet."
                  : activeTab === "PENDING"
                  ? "No proposals awaiting approval"
                  : "No payment proposals yet."}
              </div>
              <p className="text-xs max-w-sm mx-auto text-[#94A3B8] leading-relaxed">
                {proposals.length === 0
                  ? "Payment proposals created by authenticated agents will appear here for human authorization and verification."
                  : "All proposals have been reviewed or finalized. New proposals will appear here."}
              </p>
            </div>
          ) : (
            displayedProposals.map((proposal) => {
              const isVerified =
                proposal.status === "VERIFIED" ||
                (liveConfirmationProposalId === proposal.proposalId &&
                  liveConfirmationStage === "VERIFIED");
              const isSubmitted =
                (proposal.status === "SUBMITTED" ||
                  (liveConfirmationProposalId === proposal.proposalId &&
                    liveConfirmationStage === "CONFIRMING_ON_CHAIN")) &&
                !isVerified;
              const isRejected = proposal.status === "REJECTED";
              const isFailed = proposal.status === "FAILED";
              const isApproving = approvingProposalId === proposal.proposalId;
              const isVerifying =
                verifyingProposalId === proposal.proposalId ||
                (isSubmitted && !isVerified && !isFailed);
              const isPending =
                proposal.status === "PROPOSED" &&
                !isVerified &&
                !isSubmitted &&
                !isApproving &&
                liveConfirmationProposalId !== proposal.proposalId;
              const isRejecting = rejectingProposalId === proposal.proposalId;
              const isExpanded = Boolean(expandedDetails[proposal.proposalId]);
              const policyPassed = Boolean(proposal.policyCheck?.passed);

              const isLiveTracking =
                (liveConfirmationProposalId === proposal.proposalId || isSubmitted) &&
                !isVerified &&
                !isRejected &&
                !isFailed;

              const displayedTxHash =
                proposal.txHash ||
                (liveConfirmationProposalId === proposal.proposalId
                  ? recentApprovedHash
                  : null);

              const effectiveStatus = isVerified
                ? "VERIFIED"
                : isSubmitted
                ? "SUBMITTED"
                : proposal.status;

              return (
                <div
                  key={proposal.proposalId}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isPending
                      ? "bg-[#142034] border-[#3978F6]/50 shadow-card ring-1 ring-[#3978F6]/30"
                      : isSubmitted
                      ? "bg-[#142034] border-[#F0A83B]/50 shadow-card ring-1 ring-[#F0A83B]/30"
                      : isVerified
                      ? "bg-[#142034] border-[#20B486]/40 shadow-card"
                      : "bg-[#142034] border-[#EF4444]/30 shadow-card"
                  }`}
                >
                  {/* Card Content */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Hero Amount & Policy Status Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#1E2D44]">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] block">
                          Requested Payment
                        </span>
                        <div className="flex items-baseline space-x-2 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#F8FAFC] tracking-tight">
                            {proposal.amountNear} NEAR
                          </span>
                          <span className="text-xs font-medium text-[#94A3B8]">
                            ≈ ${(proposal.amountNear * 4.2).toFixed(2)} USD
                          </span>
                        </div>
                      </div>

                      {/* Policy Status Badge */}
                      <div className="flex items-center space-x-2 self-start sm:self-auto">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            policyPassed
                              ? "bg-[#20B486]/15 text-[#20B486] border-[#20B486]/30"
                              : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30"
                          }`}
                        >
                          {policyPassed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Policy Passed</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Policy Rejected</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Clear Summary Grid: Recipient, Agent, Network, Purpose */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Recipient */}
                      <div className="p-3 rounded-xl bg-[#121D30] border border-[#263750]">
                        <span className="text-[11px] text-[#94A3B8] font-medium block">
                          Recipient Account
                        </span>
                        <div className="font-mono font-bold text-[#F8FAFC] mt-0.5 truncate flex items-center space-x-1">
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#20B486] shrink-0" />
                          <span>{proposal.recipientAccount}</span>
                        </div>
                      </div>

                      {/* Requesting Agent */}
                      <div className="p-3 rounded-xl bg-[#121D30] border border-[#263750]">
                        <span className="text-[11px] text-[#94A3B8] font-medium block">
                          Requesting Agent
                        </span>
                        <div className="font-semibold text-[#F8FAFC] mt-0.5 truncate flex items-center space-x-1">
                          <Bot className="w-3.5 h-3.5 text-[#3978F6] shrink-0" />
                          <span>{proposal.agentName || proposal.agentId}</span>
                        </div>
                      </div>

                      {/* Network */}
                      <div className="p-3 rounded-xl bg-[#121D30] border border-[#263750]">
                        <span className="text-[11px] text-[#94A3B8] font-medium block">
                          Network
                        </span>
                        <div className="font-semibold text-[#20B486] mt-0.5 flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-[#20B486]" />
                          <span>NEAR Testnet</span>
                        </div>
                      </div>

                      {/* Purpose */}
                      <div className="p-3 rounded-xl bg-[#121D30] border border-[#263750]">
                        <span className="text-[11px] text-[#94A3B8] font-medium block">
                          Purpose
                        </span>
                        <div className="font-medium text-[#F8FAFC] mt-0.5 truncate">
                          {proposal.purpose || "Agent task payment"}
                        </div>
                      </div>
                    </div>

                    {/* Progressive Confirmation Tracker when active */}
                    {isLiveTracking && (
                      <div className="p-4 rounded-xl bg-[#101827] border border-[#263750] space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <RefreshCw className="w-4 h-4 text-[#3978F6] animate-spin" />
                            <span className="text-xs font-bold text-[#F8FAFC]">
                              Blockchain Confirmation in Progress
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18243A] text-[#3978F6] border border-[#263750] font-bold">
                            NEAR TESTNET
                          </span>
                        </div>

                        {/* 4 Milestones */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {/* 1. Wallet approval received */}
                          <div className="flex items-center space-x-2 text-[#F8FAFC]">
                            <span className="w-4 h-4 rounded-full bg-[#20B486] text-[#101827] text-[10px] flex items-center justify-center font-bold shrink-0">
                              ✓
                            </span>
                            <span className="font-medium">Wallet approval received</span>
                          </div>

                          {/* 2. Transaction submitted */}
                          <div className="flex items-center space-x-2 text-[#F8FAFC]">
                            <span className="w-4 h-4 rounded-full bg-[#20B486] text-[#101827] text-[10px] flex items-center justify-center font-bold shrink-0">
                              ✓
                            </span>
                            <span className="font-medium truncate">
                              Transaction submitted{" "}
                              {displayedTxHash && `(${displayedTxHash.slice(0, 8)}...)`}
                            </span>
                          </div>

                          {/* 3. Confirming on NEAR */}
                          <div className="flex items-center space-x-2">
                            {isVerified ? (
                              <span className="w-4 h-4 rounded-full bg-[#20B486] text-[#101827] text-[10px] flex items-center justify-center font-bold shrink-0">
                                ✓
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full border-2 border-[#3978F6] border-t-transparent animate-spin shrink-0" />
                            )}
                            <span
                              className={
                                !isVerified
                                  ? "font-bold text-[#3978F6]"
                                  : "font-medium text-[#F8FAFC]"
                              }
                            >
                              Confirming on NEAR
                            </span>
                          </div>

                          {/* 4. Payment verified */}
                          <div className="flex items-center space-x-2">
                            {isVerified ? (
                              <span className="w-4 h-4 rounded-full bg-[#20B486] text-[#101827] text-[10px] flex items-center justify-center font-bold shrink-0">
                                ✓
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-[#1E2D44] text-[#64748B] text-[10px] flex items-center justify-center font-bold shrink-0">
                                4
                              </span>
                            )}
                            <span
                              className={
                                isVerified
                                  ? "font-bold text-[#20B486]"
                                  : "text-[#64748B]"
                              }
                            >
                              Payment verified
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                          Meteor Wallet approved the transaction. NEAR Testnet is currently finalizing block receipts. This usually takes 2–4 seconds and updates automatically.
                        </p>
                      </div>
                    )}

                    {/* Status Stepper Indicator */}
                    <div className="pt-1">
                      <ProposalStatusStepper
                        status={effectiveStatus}
                        isApproving={isApproving}
                        isVerifying={isVerifying}
                      />
                    </div>

                    {/* Pending Actions: Approve & Reject (Duplicate Click Protected) */}
                    {isPending && (
                      <div className="pt-2 space-y-2.5">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          {isConnected ? (
                            <button
                              type="button"
                              onClick={() => handleApproveViaMeteor(proposal)}
                              disabled={isApproving || isVerifying || isRejecting || !policyPassed}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-[#20B486] hover:bg-[#199B72] text-[#101827] text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 hover:shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                              title={policyPassed ? "Approve via Meteor Wallet" : "Policy check failed - cannot approve"}
                            >
                              {isApproving ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin text-[#101827]" />
                                  <span>Opening Meteor Wallet...</span>
                                </>
                              ) : isVerifying ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin text-[#101827]" />
                                  <span>Confirming on NEAR...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-4 h-4" />
                                  <span>Approve with Meteor Wallet</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={signIn}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                              title="Connect Meteor Wallet"
                            >
                              <Wallet className="w-4 h-4 text-white" />
                              <span>Connect Meteor Wallet</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRejectProposal(proposal.proposalId)}
                            disabled={isApproving || isVerifying || isRejecting}
                            className="py-2.5 px-4 rounded-xl bg-[#18243A] hover:bg-[#EF4444]/15 text-[#F87171] hover:text-[#EF4444] border border-[#263750] hover:border-[#EF4444]/40 text-xs sm:text-sm font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                            title="Reject Payment"
                          >
                            {isRejecting ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Rejecting...</span>
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4" />
                                <span>Reject Payment</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-[11px] text-[#64748B] text-center">
                          Rejecting cancels the proposal without sending any transaction.
                        </p>
                      </div>
                    )}

                    {/* Submitted Status Retry / Background Status */}
                    {isSubmitted && !isLiveTracking && (
                      <div className="p-3.5 rounded-xl bg-[#F0A83B]/10 border border-[#F0A83B]/30 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center space-x-2 text-[#F0A83B]">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>
                            Submitted to NEAR. Awaiting final execution confirmation.
                          </span>
                        </div>
                        {proposal.txHash && (
                          <button
                            type="button"
                            onClick={() =>
                              handleVerifyTxHash(proposal.proposalId, proposal.txHash)
                            }
                            disabled={Boolean(verifyingProposalId)}
                            className="px-3 py-1.5 rounded-lg bg-[#18243A] border border-[#263750] hover:bg-[#1E2D44] font-semibold text-[#F8FAFC] transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
                          >
                            {verifyingProposalId === proposal.proposalId
                              ? "Checking..."
                              : "Check Finality"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Verified Transaction Confirmation & Direct Receipt Link */}
                    {isVerified && (proposal.txHash || displayedTxHash) && (
                      <div className="p-4 rounded-xl bg-[#20B486]/15 border border-[#20B486]/30 space-y-2.5 text-xs text-[#F8FAFC] shadow-card">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-[#20B486]" />
                            <span className="font-bold text-sm text-[#20B486]">
                              Payment Verified &amp; Settled
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18243A] text-[#20B486] border border-[#20B486]/30 font-bold">
                            {proposal.blockHeight ? `Block #${proposal.blockHeight}` : "FINAL"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-[#94A3B8]">On-Chain Transaction:</span>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${displayedTxHash || proposal.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[#20B486] hover:underline flex items-center space-x-1 font-semibold"
                          >
                            <span>{(displayedTxHash || proposal.txHash || "").slice(0, 16)}...</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="pt-2 border-t border-[#20B486]/25 flex items-center justify-between">
                          <span className="text-[11px] text-[#94A3B8]">
                            Evidence-backed receipt generated in dashboard.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              if (onProposalVerified) onProposalVerified();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#20B486] hover:bg-[#199B72] text-[#101827] text-xs font-bold flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>View Generated Receipt</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rejection / Failure Notice */}
                    {(isRejected || isFailed) && (
                      <div className="p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs text-[#F87171] space-y-1">
                        <div className="font-bold flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {isRejected ? "Proposal Rejected" : "Transaction Failed"}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {proposal.rejectionReason ||
                            "Payment was halted and did not complete."}
                        </p>
                      </div>
                    )}

                    {/* Collapsed Advanced Details Toggle */}
                    <div className="pt-1 border-t border-[#1E2D44]">
                      <button
                        type="button"
                        onClick={() => toggleDetails(proposal.proposalId)}
                        className="text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] flex items-center space-x-1.5 transition-colors cursor-pointer py-1"
                        aria-expanded={isExpanded}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#3978F6]" />
                        <span>{isExpanded ? "Hide Advanced Details" : "Show Advanced Details"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Expandable Advanced Section */}
                      {isExpanded && (
                        <div className="mt-3 p-3.5 rounded-xl bg-[#121D30] border border-[#263750] space-y-3 text-xs animate-in fade-in duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[#94A3B8] block font-medium">Proposal ID</span>
                              <span className="font-mono font-semibold text-[#F8FAFC]">
                                {proposal.proposalId}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#94A3B8] block font-medium">Task ID</span>
                              <span className="font-mono font-semibold text-[#F8FAFC]">
                                {proposal.taskId}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#94A3B8] block font-medium">
                                {proposal.status === "VERIFIED" ? "Actual Payer" : "Authorized Payer"}
                              </span>
                              <span className="font-mono text-[#F8FAFC]">
                                {proposal.payerAccount}
                              </span>
                              {accountId && proposal.status === "PROPOSED" && accountId.toLowerCase() !== proposal.payerAccount.toLowerCase() && (
                                <span className="block text-[10px] text-[#20B486] font-sans mt-0.5">
                                  Will be paid by connected: {accountId}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-[#94A3B8] block font-medium">YoctoNEAR Amount</span>
                              <span className="font-mono text-[#F8FAFC] truncate block">
                                {proposal.amountYocto}
                              </span>
                            </div>
                          </div>

                          {proposal.promptSnippet && (
                            <div className="text-[11px] pt-1 border-t border-[#1E2D44]">
                              <span className="text-[#94A3B8] block font-medium">Agent Context &amp; Prompt</span>
                              <p className="text-[#F8FAFC] italic mt-0.5 leading-relaxed">
                                &ldquo;{proposal.promptSnippet}&rdquo;
                              </p>
                            </div>
                          )}

                          {proposal.policyCheck?.reason && (
                            <div className="text-[11px] pt-1 border-t border-[#1E2D44]">
                              <span className="text-[#94A3B8] block font-medium">Spending Guardrail Rule</span>
                              <p className="text-[#F8FAFC] mt-0.5">
                                {proposal.policyCheck.reason}
                              </p>
                            </div>
                          )}

                          {/* Manual Transaction Hash Verification Controls */}
                          {isPending && (
                            <div className="pt-2 border-t border-[#1E2D44] space-y-2">
                              <span className="text-[11px] font-semibold text-[#F8FAFC] block">
                                Manual Transaction Verification
                              </span>
                              <p className="text-[10px] text-[#94A3B8]">
                                If you broadcasted this payment outside the automated flow, enter the NEAR Testnet txHash:
                              </p>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  placeholder="Paste NEAR Testnet txHash (e.g. 8kP...)"
                                  value={txHashInputs[proposal.proposalId] || ""}
                                  onChange={(e) =>
                                    setTxHashInputs({
                                      ...txHashInputs,
                                      [proposal.proposalId]: e.target.value,
                                    })
                                  }
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#101827] border border-[#263750] text-xs font-mono text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#3978F6]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVerifyTxHash(proposal.proposalId)}
                                  disabled={Boolean(verifyingProposalId)}
                                  className="px-3.5 py-1.5 rounded-lg bg-[#3978F6] hover:bg-[#2B68E0] text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center space-x-1.5 shrink-0 cursor-pointer"
                                >
                                  {verifyingProposalId === proposal.proposalId ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Verifying...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Verify on Chain</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#1E2D44]">
                            Proposals can also be created via internal endpoint: <code className="font-mono text-[#F8FAFC]">/api/agent/proposals/trigger</code>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1E2D44] bg-[#142034] rounded-b-2xl flex items-center justify-between text-xs text-[#94A3B8]">
          <span>
            Non-custodial: Your private keys never leave Meteor Wallet.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#18243A] border border-[#263750] text-xs font-semibold text-[#F8FAFC] hover:bg-[#1E2D44] transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

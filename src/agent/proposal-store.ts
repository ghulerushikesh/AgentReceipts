import fs from "fs";
import path from "path";
import { PaymentProposal, AgentTaskRecord, ProposalStatus } from "./types";

interface AgentProposalStoreState {
  proposals: Record<string, PaymentProposal>;
  tasks: Record<string, AgentTaskRecord>;
}

const DATA_FILE = path.join(process.cwd(), "data", "agent-proposals.json");

declare global {
  // eslint-disable-next-line no-var
  var __agentProposalStore: AgentProposalStoreState | undefined;
}

function loadState(): AgentProposalStoreState {
  if (globalThis.__agentProposalStore) {
    return globalThis.__agentProposalStore;
  }

  const state: AgentProposalStoreState = {
    proposals: {},
    tasks: {},
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.proposals) state.proposals = parsed.proposals;
      if (parsed.tasks) state.tasks = parsed.tasks;
    }
  } catch (err) {
    console.warn("Could not read agent-proposals.json, initializing in-memory:", err);
  }

  globalThis.__agentProposalStore = state;
  return state;
}

function persistState(state: AgentProposalStoreState) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write agent-proposals.json (read-only environment?):", err);
  }
}

/**
 * Calculates total NEAR spent or approved within the last 24 hours for an account
 */
export function getDailySpentNear(payerAccount: string, excludeProposalId?: string): number {
  const state = loadState();
  const cleanAccount = payerAccount.trim().toLowerCase();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  return Object.values(state.proposals)
    .filter((p) => {
      if (excludeProposalId && p.proposalId === excludeProposalId) return false;
      if (p.payerAccount.toLowerCase() !== cleanAccount) return false;
      if (p.status !== "VERIFIED" && p.status !== "SUBMITTED" && p.status !== "APPROVED") {
        return false;
      }
      const createdAtMs = new Date(p.createdAt).getTime();
      return createdAtMs >= oneDayAgo;
    })
    .reduce((sum, p) => sum + p.amountNear, 0);
}

/**
 * Store a new payment proposal
 */
export function storeProposal(proposal: PaymentProposal): PaymentProposal {
  const state = loadState();
  if (!proposal.proposedPayerAccount) {
    proposal.proposedPayerAccount = proposal.payerAccount;
  }
  state.proposals[proposal.proposalId] = proposal;
  persistState(state);
  return proposal;
}

/**
 * Checks if a transaction hash has already been used by an existing proposal.
 * Prevents transaction hash reuse (replay attack).
 */
export function isTxHashUsedByProposal(txHash: string, excludeProposalId?: string): boolean {
  const state = loadState();
  const cleanHash = txHash.trim();
  if (!cleanHash) return false;

  return Object.values(state.proposals).some((p) => {
    if (excludeProposalId && p.proposalId === excludeProposalId) return false;
    if (p.status !== "VERIFIED" && p.status !== "SUBMITTED" && p.status !== "APPROVED") {
      return false;
    }
    return p.txHash?.trim() === cleanHash;
  });
}

/**
 * Get proposal by ID
 */
export function getProposalById(proposalId: string): PaymentProposal | null {
  const state = loadState();
  return state.proposals[proposalId] || null;
}

/**
 * Get all proposals, optionally filtered by payer account or status
 */
export function getAllProposals(filters?: {
  payerAccount?: string;
  status?: ProposalStatus;
}): PaymentProposal[] {
  const state = loadState();
  let list = Object.values(state.proposals);

  if (filters?.payerAccount) {
    const clean = filters.payerAccount.trim().toLowerCase();
    list = list.filter((p) => p.payerAccount.toLowerCase() === clean);
  }

  if (filters?.status) {
    list = list.filter((p) => p.status === filters.status);
  }

  // Sort descending by creation date
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Update proposal status and metadata
 */
export function updateProposalStatus(
  proposalId: string,
  status: ProposalStatus,
  details?: {
    txHash?: string;
    blockHeight?: number;
    rejectionReason?: string | null;
    payerAccount?: string;
  }
): PaymentProposal | null {
  const state = loadState();
  const proposal = state.proposals[proposalId];
  if (!proposal) return null;

  proposal.status = status;
  if (details?.txHash) {
    proposal.txHash = details.txHash.trim();
  }
  if (details?.blockHeight) {
    proposal.blockHeight = details.blockHeight;
  }
  if (details?.rejectionReason !== undefined) {
    if (details.rejectionReason) {
      proposal.rejectionReason = details.rejectionReason;
    } else {
      delete proposal.rejectionReason;
    }
  }
  if (details?.payerAccount) {
    const cleanPayer = details.payerAccount.trim().toLowerCase();
    if (!proposal.proposedPayerAccount) {
      proposal.proposedPayerAccount = proposal.payerAccount;
    }
    proposal.payerAccount = cleanPayer;
    proposal.actualPayerAccount = cleanPayer;
  }

  if (status === "SUBMITTED") {
    proposal.submittedAt = new Date().toISOString();
  } else if (status === "VERIFIED") {
    proposal.verifiedAt = new Date().toISOString();
  }

  persistState(state);
  return proposal;
}

/**
 * Store a task record
 */
export function storeTaskRecord(task: AgentTaskRecord): AgentTaskRecord {
  const state = loadState();
  state.tasks[task.taskId] = task;
  persistState(state);
  return task;
}

/**
 * Get task by ID
 */
export function getTaskById(taskId: string): AgentTaskRecord | null {
  const state = loadState();
  return state.tasks[taskId] || null;
}

/**
 * Get all task records
 */
export function getAllTasks(): AgentTaskRecord[] {
  const state = loadState();
  return Object.values(state.tasks).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Resolve a verified proposal and its completed task by the exact Testnet
 * transaction hash and payer account. Reject incomplete or inconsistent links.
 */
export function getVerifiedProposalAttributionByTxHash(
  accountId: string,
  txHash: string
): { proposal: PaymentProposal; task: AgentTaskRecord } | null {
  const state = loadState();
  const cleanAccount = accountId.trim().toLowerCase();
  const cleanHash = txHash.trim();
  if (!cleanAccount || !cleanHash) return null;

  const proposal = Object.values(state.proposals).find((candidate) =>
    candidate.status === "VERIFIED" &&
    candidate.network === "testnet" &&
    candidate.txHash?.trim() === cleanHash &&
    candidate.payerAccount.trim().toLowerCase() === cleanAccount
  );
  if (!proposal) return null;

  const task = state.tasks[proposal.taskId];
  if (
    !task ||
    task.status !== "COMPLETED" ||
    task.proposalId !== proposal.proposalId ||
    task.agentId !== proposal.agentId ||
    task.agentName !== proposal.agentName
  ) return null;

  return { proposal, task };
}

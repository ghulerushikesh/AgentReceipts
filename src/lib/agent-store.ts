import fs from "fs";
import path from "path";

export interface AgentConnection {
  agentId: string;
  agentName: string;
  accountId: string; // The public NEAR account associated with this agent
  network: "NEAR Testnet";
  status: "CONNECTED" | "MONITORED_ONLY";
  lastSyncAt: string | null;
  registeredAt: string;
  totalReportedEvents: number;
  description?: string;
}

export interface AgentExecutionEvent {
  eventId: string;
  agentId: string;
  agentName: string;
  accountId: string;
  txHash: string;
  taskId: string;
  promptSnippet?: string;
  actionDescription?: string;
  category?: string;
  timestamp: number; // Unix timestamp in ms
  receivedAt: string;
}

interface AgentStoreState {
  connections: Record<string, AgentConnection>; // key: accountId
  eventsByHash: Record<string, AgentExecutionEvent>; // key: txHash
  eventsById: Record<string, AgentExecutionEvent>; // key: eventId
  eventsByAccount: Record<string, string[]>; // accountId -> array of txHashes
}

const DATA_FILE = path.join(process.cwd(), "data", "agent-events.json");

// Default initial agent connections (empty in production/hackathon; populated via authenticated webhook)
const DEFAULT_CONNECTIONS: Record<string, AgentConnection> = {};

// Global singleton to preserve state across Next.js module reloads in dev/runtime
declare global {
  // eslint-disable-next-line no-var
  var __agentReceiptsStore: AgentStoreState | undefined;
}

function loadInitialState(): AgentStoreState {
  if (globalThis.__agentReceiptsStore) {
    return globalThis.__agentReceiptsStore;
  }

  const state: AgentStoreState = {
    connections: { ...DEFAULT_CONNECTIONS },
    eventsByHash: {},
    eventsById: {},
    eventsByAccount: {},
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.connections) state.connections = { ...state.connections, ...parsed.connections };
      if (parsed.eventsByHash) state.eventsByHash = parsed.eventsByHash;
      if (parsed.eventsById) state.eventsById = parsed.eventsById;
      if (parsed.eventsByAccount) state.eventsByAccount = parsed.eventsByAccount;
    }
  } catch (err) {
    console.warn("Could not read agent-events.json; initializing with defaults in-memory:", err);
  }

  globalThis.__agentReceiptsStore = state;
  return state;
}

function persistState(state: AgentStoreState) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write to agent-events.json (running in read-only environment?):", err);
  }
}

/**
 * Get all registered agent connections
 */
export function getAllAgentConnections(): AgentConnection[] {
  const state = loadInitialState();
  return Object.values(state.connections);
}

/**
 * Get the connection status for a specific NEAR account.
 * Note: If no agent is explicitly registered, status will be null or "MONITORED_ONLY".
 */
export function getAgentConnectionForAccount(accountId: string): AgentConnection | null {
  const state = loadInitialState();
  const clean = accountId.trim().toLowerCase();
  return state.connections[clean] || null;
}

/**
 * Register or update an agent connection
 */
export function registerAgentConnection(
  conn: Omit<AgentConnection, "registeredAt" | "totalReportedEvents">
): AgentConnection {
  const state = loadInitialState();
  const cleanAccount = conn.accountId.trim().toLowerCase();

  const existing = state.connections[cleanAccount];
  const updated: AgentConnection = {
    ...conn,
    accountId: cleanAccount,
    registeredAt: existing ? existing.registeredAt : new Date().toISOString(),
    totalReportedEvents: existing ? existing.totalReportedEvents : 0,
    lastSyncAt: new Date().toISOString(),
  };

  state.connections[cleanAccount] = updated;
  persistState(state);
  return updated;
}

/**
 * Record an authenticated event emitted by an AI agent runner
 */
export interface RecordEventInput {
  eventId: string;
  agentId: string;
  agentName?: string;
  accountId: string;
  txHash: string;
  taskId: string;
  promptSnippet?: string;
  actionDescription?: string;
  category?: string;
  timestamp?: number;
}

export function recordAgentExecutionEvent(input: RecordEventInput): {
  event: AgentExecutionEvent;
  isDuplicate: boolean;
} {
  const state = loadInitialState();
  const cleanAccount = input.accountId.trim().toLowerCase();
  const cleanHash = input.txHash.trim();
  const cleanEventId = input.eventId.trim();

  // Deduplication check: by eventId or txHash
  if (state.eventsById[cleanEventId]) {
    return {
      event: state.eventsById[cleanEventId],
      isDuplicate: true,
    };
  }

  if (state.eventsByHash[cleanHash]) {
    return {
      event: state.eventsByHash[cleanHash],
      isDuplicate: true,
    };
  }

  const agentName =
    input.agentName ||
    state.connections[cleanAccount]?.agentName ||
    `Agent (${input.agentId})`;

  const event: AgentExecutionEvent = {
    eventId: cleanEventId,
    agentId: input.agentId.trim(),
    agentName,
    accountId: cleanAccount,
    txHash: cleanHash,
    taskId: input.taskId.trim(),
    promptSnippet: input.promptSnippet?.trim(),
    actionDescription: input.actionDescription?.trim(),
    category: input.category?.trim(),
    timestamp: input.timestamp || Date.now(),
    receivedAt: new Date().toISOString(),
  };

  state.eventsById[cleanEventId] = event;
  state.eventsByHash[cleanHash] = event;

  if (!state.eventsByAccount[cleanAccount]) {
    state.eventsByAccount[cleanAccount] = [];
  }
  state.eventsByAccount[cleanAccount].push(cleanHash);

  // Update connection status
  if (!state.connections[cleanAccount]) {
    state.connections[cleanAccount] = {
      agentId: input.agentId.trim(),
      agentName,
      accountId: cleanAccount,
      network: "NEAR Testnet",
      status: "CONNECTED",
      lastSyncAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      totalReportedEvents: 1,
    };
  } else {
    state.connections[cleanAccount].status = "CONNECTED";
    state.connections[cleanAccount].lastSyncAt = new Date().toISOString();
    state.connections[cleanAccount].totalReportedEvents += 1;
  }

  persistState(state);

  return {
    event,
    isDuplicate: false,
  };
}

/**
 * Checks whether an agent execution event has already been recorded for a transaction hash.
 */
export function hasAgentEventForTxHash(txHash: string): boolean {
  const state = loadInitialState();
  const cleanHash = txHash.trim();
  if (!cleanHash) return false;
  return Boolean(state.eventsByHash[cleanHash]);
}

/**
 * Retrieve verified agent execution event by transaction hash
 */
export function getAgentEventByTxHash(
  accountId: string,
  txHash: string
): AgentExecutionEvent | null {
  const state = loadInitialState();
  const cleanHash = txHash.trim();
  const event = state.eventsByHash[cleanHash];
  if (!event) return null;

  // Account must match
  if (event.accountId.toLowerCase() !== accountId.trim().toLowerCase()) {
    return null;
  }

  return event;
}

/**
 * Get all execution events reported for an account
 */
export function getAgentEventsForAccount(accountId: string): AgentExecutionEvent[] {
  const state = loadInitialState();
  const cleanAccount = accountId.trim().toLowerCase();
  const hashes = state.eventsByAccount[cleanAccount] || [];
  return hashes
    .map((h) => state.eventsByHash[h])
    .filter((e): e is AgentExecutionEvent => Boolean(e));
}

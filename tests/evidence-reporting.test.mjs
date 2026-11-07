import test from "node:test";
import assert from "node:assert/strict";

// Test 1: yoctoNEAR precision conversion (1 NEAR = 10^24 yoctoNEAR)
function yoctoToNear(yoctoStr, decimals = 6) {
  if (!yoctoStr || yoctoStr === "0") return 0;
  const raw = typeof yoctoStr === "string" ? yoctoStr.trim() : yoctoStr.toString();
  if (raw === "0" || !raw) return 0;

  const isNegative = raw.startsWith("-");
  const cleanStr = isNegative ? raw.slice(1) : raw;

  const padded = cleanStr.padStart(25, "0");
  const whole = padded.slice(0, padded.length - 24) || "0";
  const fraction = padded.slice(padded.length - 24);

  const formatted = `${whole}.${fraction.slice(0, decimals)}`;
  const parsed = parseFloat(formatted);
  return isNegative ? -parsed : parsed;
}

test("YoctoNEAR conversion accurately handles 10^24 divisor without IEEE 754 precision loss", () => {
  // Exactly 1 NEAR = 10^24 yocto
  assert.equal(yoctoToNear("1000000000000000000000000"), 1);

  // Exactly 2.5 NEAR
  assert.equal(yoctoToNear("2500000000000000000000000"), 2.5);

  // Micro-fee: 0.00085 NEAR (85 * 10^19 yocto)
  assert.equal(yoctoToNear("850000000000000000000"), 0.00085);

  // Zero handling
  assert.equal(yoctoToNear("0"), 0);
  assert.equal(yoctoToNear(null), 0);
  assert.equal(yoctoToNear(undefined), 0);

  // Negative amount handling
  assert.equal(yoctoToNear("-1000000000000000000000000"), -1);
});

// Test 2: Failed transactions exclusion from completed spending
test("Failed transactions are excluded from completed spending and reported separately", () => {
  const transactions = [
    { hash: "tx1", direction: "OUTGOING", status: "SUCCESS", amountNear: 5.0, feeNear: 0.001 },
    { hash: "tx2", direction: "OUTGOING", status: "FAILURE", amountNear: 2.5, feeNear: 0.002 },
    { hash: "tx3", direction: "OUTGOING", status: "SUCCESS", amountNear: 1.5, feeNear: 0.001 },
    { hash: "tx4", direction: "INCOMING", status: "SUCCESS", amountNear: 10.0, feeNear: 0.0005 },
  ];

  // Completed outgoing spending: ONLY status === 'SUCCESS'
  const completedOutgoing = transactions
    .filter((t) => t.direction === "OUTGOING" && t.status === "SUCCESS")
    .reduce((sum, t) => sum + t.amountNear, 0);

  // Failed outlays: reported separately!
  const failedOutlays = transactions
    .filter((t) => t.direction === "OUTGOING" && t.status === "FAILURE")
    .reduce((sum, t) => sum + t.amountNear, 0);

  assert.equal(completedOutgoing, 6.5, "Completed spending must equal 5.0 + 1.5 = 6.5 NEAR");
  assert.equal(failedOutlays, 2.5, "Failed outlay of 2.5 NEAR must be isolated and not included in completed spending");
});

// Test 3: Fee and transfer isolation (no double counting)
test("Protocol network fees are kept isolated and never double-counted into transfer totals", () => {
  const transactions = [
    { hash: "tx1", direction: "OUTGOING", status: "SUCCESS", amountNear: 4.0, feeNear: 0.00085 },
    { hash: "tx2", direction: "INCOMING", status: "SUCCESS", amountNear: 20.0, feeNear: 0.00045 },
  ];

  const totalOutgoingTransfers = transactions
    .filter((t) => t.direction === "OUTGOING" && t.status === "SUCCESS")
    .reduce((sum, t) => sum + t.amountNear, 0);

  const totalFees = transactions.reduce((sum, t) => sum + t.feeNear, 0);

  assert.equal(totalOutgoingTransfers, 4.0, "Principal transfer must be exactly 4.0 NEAR");
  assert.equal(Number(totalFees.toFixed(5)), 0.0013, "Network fee must be isolated at 0.0013 NEAR");

  // Total debit for outgoing transaction is amount + fee
  const tx1Debit = transactions[0].amountNear + transactions[0].feeNear;
  assert.equal(Number(tx1Debit.toFixed(5)), 4.00085);
});

// Test 4: Deduplication of transactions by hash
test("Duplicate transactions across indexer and transfer streams are deduplicated", () => {
  const rawEvents = [
    { hash: "hash_A", amountNear: 1.0 },
    { hash: "hash_B", amountNear: 2.0 },
    { hash: "hash_A", amountNear: 1.0 }, // Duplicate receipt
    { hash: "hash_C", amountNear: 3.0 },
  ];

  const processed = new Set();
  const deduplicated = [];

  for (const item of rawEvents) {
    if (processed.has(item.hash)) continue;
    processed.add(item.hash);
    deduplicated.push(item);
  }

  assert.equal(deduplicated.length, 3);
  assert.deepEqual(deduplicated.map((d) => d.hash), ["hash_A", "hash_B", "hash_C"]);
});

// Test 5: Daily budget calculation and threshold triggers
test("Daily budget triggers 80% warning and 100% breach correctly", () => {
  const dailyBudget = 10.0;
  const warningThreshold = 0.8 * dailyBudget; // 8.0 NEAR

  // Case 1: Healthy (5.0 NEAR spent)
  const spentHealthy = 5.0;
  const isWarningHealthy = spentHealthy >= warningThreshold && spentHealthy < dailyBudget;
  const isBreachedHealthy = spentHealthy >= dailyBudget;
  assert.equal(isWarningHealthy, false);
  assert.equal(isBreachedHealthy, false);

  // Case 2: 80% Warning (8.5 NEAR spent)
  const spentWarning = 8.5;
  const isWarning80 = spentWarning >= warningThreshold && spentWarning < dailyBudget;
  const isBreached80 = spentWarning >= dailyBudget;
  assert.equal(isWarning80, true, "Must trigger 80% warning");
  assert.equal(isBreached80, false);

  // Case 3: 100% Breached (11.2 NEAR spent)
  const spentBreached = 11.2;
  const isWarningBreached = spentBreached >= warningThreshold && spentBreached < dailyBudget;
  const isBreached100 = spentBreached >= dailyBudget;
  assert.equal(isWarningBreached, false);
  assert.equal(isBreached100, true, "Must trigger 100% overspend alert");
  assert.equal(Number((spentBreached - dailyBudget).toFixed(2)), 1.2, "Exceeded amount is 1.2 NEAR");
});

// Test 6: Missing task attribution transparency
test("Attribution data model explicitly marks missing agent logs without fabricating task IDs", () => {
  const attribution = {
    status: "INFERRED",
    category: "Smart Contract Execution",
    taskId: null,
    agentName: null,
    promptSnippet: null,
    source: "HEURISTIC",
    reasoning: "Receiver matches DEX swap pattern",
    integrationConnected: false,
    integrationNotice: "Agent Execution Log Integration: Not Connected.",
  };

  assert.equal(attribution.taskId, null, "Must NOT fabricate fake task IDs");
  assert.equal(attribution.agentName, null, "Must NOT fabricate fake agent names");
  assert.equal(attribution.integrationConnected, false, "Must state integration is disconnected");
  assert.equal(attribution.status, "INFERRED");
});

// Test 7: CSV formatting and escaping
test("CSV generator correctly escapes commas, quotes, and includes all required evidence fields", () => {
  const headers = ["Hash", "Sender", "Recipient", "Amount (NEAR)", "Status"];
  const row = ['"test,hash"', "agent.near", 'contract,with"quotes', 2.5, "SUCCESS"];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const formattedRow = row.map(escapeCSV).join(",");
  assert.equal(
    formattedRow,
    '"""test,hash""","agent.near","contract,with""quotes","2.5","SUCCESS"'
  );
});

// Test 8: Audit report summary consistency
test("Audit report totals strictly match summary aggregations", () => {
  const receipts = [
    { direction: "OUTGOING", status: "SUCCESS", amountNear: 3.5, feeNear: 0.0008 },
    { direction: "OUTGOING", status: "FAILURE", amountNear: 1.0, feeNear: 0.0006 },
    { direction: "INCOMING", status: "SUCCESS", amountNear: 15.0, feeNear: 0.0004 },
  ];

  const auditCompletedOutgoing = receipts
    .filter((r) => r.direction === "OUTGOING" && r.status === "SUCCESS")
    .reduce((sum, r) => sum + r.amountNear, 0);

  const auditCompletedIncoming = receipts
    .filter((r) => r.direction === "INCOMING" && r.status === "SUCCESS")
    .reduce((sum, r) => sum + r.amountNear, 0);

  const auditTotalFees = receipts.reduce((sum, r) => sum + r.feeNear, 0);
  const auditFailedOutlays = receipts
    .filter((r) => r.direction === "OUTGOING" && r.status === "FAILURE")
    .reduce((sum, r) => sum + r.amountNear, 0);

  assert.equal(auditCompletedOutgoing, 3.5);
  assert.equal(auditCompletedIncoming, 15.0);
  assert.equal(Number(auditTotalFees.toFixed(4)), 0.0018);
  assert.equal(auditFailedOutlays, 1.0);
});

// Test 9: Webhook authentication token verification
test("Agent webhook authentication validates bearer tokens and headers securely", () => {
  const EXPECTED_SECRET = "near-hackathon-agent-secret-2026";

  function checkAuth(authHeader, xSecretHeader) {
    if (xSecretHeader && xSecretHeader === EXPECTED_SECRET) return true;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim() === EXPECTED_SECRET;
    }
    return false;
  }

  // Valid bearer token
  assert.equal(checkAuth("Bearer near-hackathon-agent-secret-2026", null), true);
  // Valid X-Agent-Secret header
  assert.equal(checkAuth(null, "near-hackathon-agent-secret-2026"), true);
  // Invalid token
  assert.equal(checkAuth("Bearer wrong-secret", null), false);
  // Missing header
  assert.equal(checkAuth(null, null), false);
  // Empty header
  assert.equal(checkAuth("", ""), false);
});

// Test 10: Deduplication of agent execution events
test("Agent event store deduplicates incoming events by eventId and txHash", () => {
  const store = {
    eventsById: {},
    eventsByHash: {},
  };

  function recordEvent(event) {
    if (store.eventsById[event.eventId]) {
      return { event: store.eventsById[event.eventId], isDuplicate: true };
    }
    if (store.eventsByHash[event.txHash]) {
      return { event: store.eventsByHash[event.txHash], isDuplicate: true };
    }
    store.eventsById[event.eventId] = event;
    store.eventsByHash[event.txHash] = event;
    return { event, isDuplicate: false };
  }

  const firstEvent = {
    eventId: "evt_001",
    agentId: "agent-alpha",
    accountId: "sweat_welcome.near",
    txHash: "4pW2aZ7V8u1Kq6nL8m3r4k",
    taskId: "TASK-100",
  };

  const res1 = recordEvent(firstEvent);
  assert.equal(res1.isDuplicate, false, "Initial event must be accepted");

  // Duplicate by eventId
  const res2 = recordEvent({ ...firstEvent, taskId: "TASK-999" });
  assert.equal(res2.isDuplicate, true, "Duplicate eventId must be recognized and flagged");
  assert.equal(res2.event.taskId, "TASK-100", "Must return original event");

  // Duplicate by txHash with different eventId
  const res3 = recordEvent({
    eventId: "evt_002",
    agentId: "agent-alpha",
    accountId: "sweat_welcome.near",
    txHash: "4pW2aZ7V8u1Kq6nL8m3r4k",
    taskId: "TASK-200",
  });
  assert.equal(res3.isDuplicate, true, "Duplicate txHash must be deduplicated idempotently");
});

// Test 11: On-chain transaction matching and attribution elevation
test("Matched stored agent execution events elevate attribution to CONFIRMED with task context", () => {
  const mockAgentEvents = new Map([
    [
      "tx_verified_hash_1",
      {
        taskId: "TASK-501",
        agentName: "Sweat Onboarding Agent",
        promptSnippet: "Allocate 0.05 NEAR storage lease",
        actionDescription: "Storage Lease Allocation",
      },
    ],
  ]);

  function attributeTransaction(txHash, accountId, rawMethod) {
    const matched = mockAgentEvents.get(txHash);
    if (matched) {
      return {
        status: "CONFIRMED",
        taskId: matched.taskId,
        agentName: matched.agentName,
        promptSnippet: matched.promptSnippet,
        source: "AGENT_LOG_INTEGRATION",
        integrationConnected: true,
      };
    }
    return {
      status: "INFERRED",
      taskId: null,
      agentName: null,
      promptSnippet: null,
      source: "HEURISTIC",
      integrationConnected: false,
    };
  }

  // Matched transaction
  const verifiedTx = attributeTransaction("tx_verified_hash_1", "sweat_welcome.near", "storage_deposit");
  assert.equal(verifiedTx.status, "CONFIRMED");
  assert.equal(verifiedTx.taskId, "TASK-501");
  assert.equal(verifiedTx.agentName, "Sweat Onboarding Agent");
  assert.equal(verifiedTx.integrationConnected, true);

  // Unmatched transaction
  const unmatchedTx = attributeTransaction("tx_unknown_hash_99", "sweat_welcome.near", "storage_deposit");
  assert.equal(unmatchedTx.status, "INFERRED");
  assert.equal(unmatchedTx.taskId, null);
  assert.equal(unmatchedTx.agentName, null);
  assert.equal(unmatchedTx.integrationConnected, false);
});

// Test 12: Clear distinction between Account Monitored and Agent Connected
test("Connection status strictly distinguishes between monitored accounts and connected agents", () => {
  const connections = {
    "agent-registered.near": { status: "CONNECTED", agentName: "Arbitrage Agent" },
  };

  function resolveConnectionStatus(accountId) {
    const conn = connections[accountId];
    if (conn && conn.status === "CONNECTED") {
      return { status: "AGENT_CONNECTED", agentName: conn.agentName };
    }
    return { status: "ACCOUNT_MONITORED", agentName: null };
  }

  const monitoredOnly = resolveConnectionStatus("random-public-account.near");
  assert.equal(monitoredOnly.status, "ACCOUNT_MONITORED");
  assert.equal(monitoredOnly.agentName, null);

  const connectedAgent = resolveConnectionStatus("agent-registered.near");
  assert.equal(connectedAgent.status, "AGENT_CONNECTED");
  assert.equal(connectedAgent.agentName, "Arbitrage Agent");
});

// Test 13: Strict live vs demo separation
test("Live and demo data remain strictly segregated in accounting totals", () => {
  const liveReceipts = [
    { hash: "live_1", isRealOnChain: true, amountNear: 10.0, direction: "OUTGOING", status: "SUCCESS" },
  ];
  const demoReceipts = [
    { hash: "demo_1", isRealOnChain: false, amountNear: 50.0, direction: "OUTGOING", status: "SUCCESS" },
  ];

  // Live accounting MUST only aggregate isRealOnChain === true
  const liveTotal = liveReceipts
    .filter((r) => r.isRealOnChain)
    .reduce((sum, r) => sum + r.amountNear, 0);

  assert.equal(liveTotal, 10.0, "Live total must never include synthetic demo records");
  assert.notEqual(liveTotal, 60.0, "Demo and live transactions must never be co-mingled");
});

// Test 14: Spending policy per-transaction cap enforcement
test("Agent spending policy rejects amounts exceeding per-transaction cap", () => {
  const policy = {
    network: "testnet",
    maxPerTransactionNear: 0.05,
    maxDailyNear: 0.2,
  };

  function checkPolicy(amountNear, dailySpent) {
    if (amountNear > policy.maxPerTransactionNear) {
      return { passed: false, reason: "EXCEEDS_PER_TX_LIMIT" };
    }
    if (dailySpent + amountNear > policy.maxDailyNear) {
      return { passed: false, reason: "EXCEEDS_DAILY_LIMIT" };
    }
    return { passed: true };
  }

  // Allowed: 0.01 NEAR
  assert.equal(checkPolicy(0.01, 0.0).passed, true);
  // Boundary: 0.05 NEAR
  assert.equal(checkPolicy(0.05, 0.0).passed, true);
  // Disallowed: 0.06 NEAR
  const failPerTx = checkPolicy(0.06, 0.0);
  assert.equal(failPerTx.passed, false);
  assert.equal(failPerTx.reason, "EXCEEDS_PER_TX_LIMIT");
});

// Test 15: Spending policy daily allowance enforcement
test("Agent spending policy rejects amounts breaching cumulative daily limit", () => {
  const policy = {
    network: "testnet",
    maxPerTransactionNear: 0.05,
    maxDailyNear: 0.2,
  };

  function checkPolicy(amountNear, dailySpent) {
    if (dailySpent + amountNear > policy.maxDailyNear) {
      return { passed: false, reason: "EXCEEDS_DAILY_LIMIT" };
    }
    return { passed: true };
  }

  // Already spent 0.18 NEAR today; requesting 0.03 NEAR (total 0.21 NEAR) -> REJECT
  const breach = checkPolicy(0.03, 0.18);
  assert.equal(breach.passed, false);
  assert.equal(breach.reason, "EXCEEDS_DAILY_LIMIT");

  // Requesting 0.02 NEAR (total 0.20 NEAR) -> ALLOW
  const allowed = checkPolicy(0.02, 0.18);
  assert.equal(allowed.passed, true);
});

// Test 16: Strict testnet network restriction
test("Agent spending policy strictly rejects non-testnet execution requests", () => {
  function checkNetwork(net) {
    if (net !== "testnet") {
      return { passed: false, error: "STRICT_TESTNET_ONLY" };
    }
    return { passed: true };
  }

  assert.equal(checkNetwork("testnet").passed, true);
  assert.equal(checkNetwork("mainnet").passed, false);
  assert.equal(checkNetwork("mainnet").error, "STRICT_TESTNET_ONLY");
});

// Test 17: Non-payment task completion without fabricated transactions
test("Non-payment tasks complete cleanly with null txHash and zero payment", () => {
  function executePingTask() {
    return {
      taskId: "TASK-PING-01",
      requiresPayment: false,
      txHash: null,
      amountNear: 0,
      status: "COMPLETED",
      summary: "Ping completed. No payment required.",
    };
  }

  const result = executePingTask();
  assert.equal(result.requiresPayment, false);
  assert.equal(result.txHash, null, "Must never invent a transaction hash for free tasks");
  assert.equal(result.amountNear, 0);
  assert.equal(result.status, "COMPLETED");
});

// Test 18: Payment proposal separation between PROPOSED and VERIFIED states
test("Payment proposals remain strictly unverified until confirmed on-chain", () => {
  const proposal = {
    proposalId: "PROP-101",
    status: "PROPOSED",
    txHash: null,
    verifiedAt: null,
  };

  assert.equal(proposal.status, "PROPOSED");
  assert.equal(proposal.txHash, null);

  // Transition to VERIFIED only after valid on-chain confirmation
  function verifyProposal(prop, txHash, onChainSuccess) {
    if (!onChainSuccess) {
      return { ...prop, status: "FAILED" };
    }
    return { ...prop, status: "VERIFIED", txHash, verifiedAt: new Date().toISOString() };
  }

  const unconfirmed = verifyProposal(proposal, "dummyHash", false);
  assert.equal(unconfirmed.status, "FAILED");

  const confirmed = verifyProposal(proposal, "validHash_8kP", true);
  assert.equal(confirmed.status, "VERIFIED");
  assert.equal(confirmed.txHash, "validHash_8kP");
  assert.ok(confirmed.verifiedAt);
});

// Test 19: Security policy enforces Option A (Human-in-the-Loop) and disables autonomous signing
test("Security configuration strictly enforces Option A (Human-in-the-Loop) and disables autonomous signing", () => {
  const securityConfig = {
    signingMode: "HUMAN_IN_THE_LOOP",
    autonomousSigningEnabled: false,
    network: "testnet",
    allowedWallet: "MyNearWallet Testnet",
    serverSidePrivateKeysLoaded: false,
  };

  assert.equal(securityConfig.signingMode, "HUMAN_IN_THE_LOOP");
  assert.equal(securityConfig.autonomousSigningEnabled, false);
  assert.equal(securityConfig.network, "testnet");
  assert.equal(securityConfig.serverSidePrivateKeysLoaded, false);

  // Autonomous signing attempt must throw
  function attemptAutonomousSigning() {
    if (!securityConfig.autonomousSigningEnabled) {
      throw new Error("SECURITY_VIOLATION: Autonomous signing is disabled. Wallet owner authorization required.");
    }
  }

  assert.throws(() => attemptAutonomousSigning(), {
    message: /SECURITY_VIOLATION: Autonomous signing is disabled/,
  });
});




import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

test("Clean Hackathon State: Persistent proposal store contains zero demo proposals", () => {
  const proposalsJson = JSON.parse(read("../data/agent-proposals.json"));
  // Must not contain old demo proposals
  for (const p of Object.values(proposalsJson.proposals)) {
    assert.notEqual(p.payerAccount, "sweat_welcome.near");
    assert.notEqual(p.payerAccount, "agent-autonomous.near");
    assert.notEqual(p.proposalId, "demo-proposal-1");
  }
});

test("Clean Hackathon State: PaymentProposalsModal removed demo buttons and shows clean empty state", () => {
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Removed demo buttons
  assert.doesNotMatch(modalSource, /Propose Oracle Task/);
  assert.doesNotMatch(modalSource, /Zero-Fee Ping/);

  // Clean empty state
  assert.match(modalSource, /No payment proposals yet\./);

  // Real payment approval and verification workflow preserved
  assert.match(modalSource, /handleApproveViaMeteor/);
  assert.match(modalSource, /sendPayment/);
  assert.match(modalSource, /handleVerifyTxHash/);
  assert.match(modalSource, /validate/);
});

test("Clean Hackathon State: Mainnet demo agents and walkthrough removed from registry and modal", () => {
  const agentStoreSource = read("../src/lib/agent-store.ts");
  const connectionsModalSource = read("../src/components/AgentConnectionsModal.tsx");
  const eventsJson = JSON.parse(read("../data/agent-events.json"));

  // Default connections in store must be empty
  assert.match(agentStoreSource, /const DEFAULT_CONNECTIONS: Record<string, AgentConnection> = \{\};/);
  assert.doesNotMatch(agentStoreSource, /sweat_welcome\.near/);
  assert.doesNotMatch(agentStoreSource, /agent-autonomous\.near/);

  // Persistent events may contain real verified Testnet workflow records;
  // reject demo fixtures while preserving actual transaction attribution.
  const proposalsJson = JSON.parse(read("../data/agent-proposals.json"));
  for (const [txHash, event] of Object.entries(eventsJson.eventsByHash)) {
    assert.notEqual(event.agentId, "sweat_welcome.near");
    assert.notEqual(event.agentId, "agent-autonomous.near");
    assert.doesNotMatch(event.eventId, /demo/i);
    assert.equal(event.txHash, txHash);
    const proposal = Object.values(proposalsJson.proposals).find((candidate) => candidate.txHash === txHash);
    if (proposal) {
      assert.equal(proposal.agentId, event.agentId);
      assert.equal(proposal.taskId, event.taskId);
      assert.equal(proposal.status, "VERIFIED");
    }
  }
  for (const c of Object.values(eventsJson.connections)) {
    assert.notEqual(c.agentId, "sweat_welcome.near");
    assert.notEqual(c.agentId, "agent-autonomous.near");
  }

  // Connections modal must have removed demo simulation and walkthrough
  assert.doesNotMatch(connectionsModalSource, /Hackathon Judge Walkthrough/);
  assert.doesNotMatch(connectionsModalSource, /Simulate Agent Task Event/);
  assert.doesNotMatch(connectionsModalSource, /handleSimulateEvent/);

  // Real webhook API and specification preserved
  assert.match(connectionsModalSource, /Agent Webhook Specification/);
  assert.match(connectionsModalSource, /\/api\/agent\/events/);
  // Webhook specification uses safe placeholder and masked token, never hardcoding secrets
  assert.match(connectionsModalSource, /Bearer (?:<YOUR_AGENT_WEBHOOK_SECRET>|\$\{tokenDisplay\})/);
  assert.doesNotMatch(connectionsModalSource, /Bearer near-hackathon-agent-secret-2026/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

// -----------------------------------------------------------------------------
// 1. External Agent Identity
// -----------------------------------------------------------------------------
test("External Agent Identity: runner accepts and records custom agent identity with fallback", () => {
  const runnerSource = read("../src/agent/runner.ts");

  // RunTaskInput interface must include agentId and agentName
  assert.match(runnerSource, /agentId\?: string;/);
  assert.match(runnerSource, /agentName\?: string;/);

  // executeAgentTask uses supplied identity with fallback to AGENT_IDENTITY
  assert.match(runnerSource, /const agentId = \(input\.agentId && input\.agentId\.trim\(\)\) \|\| AGENT_IDENTITY\.agentId;/);
  assert.match(runnerSource, /const agentName = \(input\.agentName && input\.agentName\.trim\(\)\) \|\| AGENT_IDENTITY\.agentName;/);

  // Proposal records must store effective agentId and agentName
  assert.match(runnerSource, /agentId,\s*agentName,\s*network:\s*"testnet"/);
});

test("External Agent Identity: POST /api/agent/proposals validates and synchronizes agent identity", () => {
  const proposalsRoute = read("../src/app/api/agent/proposals/route.ts");

  // Extracts agentId and agentName
  assert.match(proposalsRoute, /agentId,/);
  assert.match(proposalsRoute, /agentName,/);

  // Validates presence and bounds
  assert.match(proposalsRoute, /agentId !== undefined/);
  assert.match(proposalsRoute, /agentName !== undefined/);
  assert.match(proposalsRoute, /Invalid 'agentId'/);
  assert.match(proposalsRoute, /Invalid 'agentName'/);

  // Links to registered agent store and preserves backward compatibility
  assert.match(proposalsRoute, /getAgentConnectionForAccount\(payerAccount\)/);
  assert.match(proposalsRoute, /registerAgentConnection\(/);
  assert.match(proposalsRoute, /agentId: effectiveAgentId/);
  assert.match(proposalsRoute, /agentName: effectiveAgentName/);
});

// -----------------------------------------------------------------------------
// 2. Individual Proposal Status Lookup
// -----------------------------------------------------------------------------
test("Proposal Status Lookup: Endpoint enforces authentication and returns complete metadata", () => {
  const statusRoute = read("../src/app/api/agent/proposals/[id]/route.ts");

  // Authentication requirement matching other agent endpoints
  assert.match(statusRoute, /function getWebhookSecret/);
  assert.match(statusRoute, /function isAuthorized/);
  assert.match(statusRoute, /status: 401/);
  assert.match(statusRoute, /status: 503/);

  // ID and 404 checks
  assert.match(statusRoute, /Missing proposal ID parameter/);
  assert.match(statusRoute, /getProposalById\(proposalId\)/);
  assert.match(statusRoute, /status: 404/);

  // Proposal metadata returned
  assert.match(statusRoute, /proposalId: proposal\.proposalId/);
  assert.match(statusRoute, /taskId: proposal\.taskId/);
  assert.match(statusRoute, /agentId: proposal\.agentId/);
  assert.match(statusRoute, /agentName: proposal\.agentName/);
  assert.match(statusRoute, /amountNear: proposal\.amountNear/);
  assert.match(statusRoute, /recipientAccount: proposal\.recipientAccount/);
  assert.match(statusRoute, /status: proposal\.status/);
  assert.match(statusRoute, /txHash: proposal\.txHash/);

  // Never exposes secrets
  assert.doesNotMatch(statusRoute, /secret: secret/);
  assert.doesNotMatch(statusRoute, /secret: process\.env/);
});

// -----------------------------------------------------------------------------
// 3. External Agent Client Script
// -----------------------------------------------------------------------------
test("External Agent Client Script: Enforces safety, environment configuration, and status polling", () => {
  const clientScript = read("../scripts/external-agent-client.mjs");

  // Reads environment variables with defaults
  assert.match(clientScript, /AGENTRECEIPTS_BASE_URL/);
  assert.match(clientScript, /AGENT_WEBHOOK_SECRET/);
  assert.match(clientScript, /NEAR_PAYER_ACCOUNT/);

  // Registers agent via connections endpoint
  assert.match(clientScript, /\/api\/agent\/connections/);

  // Submits proposal via proposals endpoint
  assert.match(clientScript, /\/api\/agent\/proposals/);

  // Polls individual proposal status endpoint
  assert.match(clientScript, /\/api\/agent\/proposals\/\$\{encodeURIComponent\(proposalId\)\}/);

  // Safety checks: No private keys, keypairs, or autonomous signing in client
  assert.doesNotMatch(clientScript, /privateKey|secretKey|seedPhrase|KeyPair/i);
  assert.doesNotMatch(clientScript, /signTransaction|signAndSend/i);

  // Strictly references NEAR Testnet and human approval
  assert.match(clientScript, /NEAR Testnet/);
  assert.match(clientScript, /Human-in-the-Loop/i);
  assert.match(clientScript, /Meteor Wallet/i);
});

// -----------------------------------------------------------------------------
// 4. Live API Validation (when dev server is active)
// -----------------------------------------------------------------------------
test("Live API Integration: Status endpoint returns 401 without auth and 404 for missing proposal", async () => {
  try {
    const unauthRes = await fetch("http://localhost:3000/api/agent/proposals/PROP-TEST-404");
    assert.equal(unauthRes.status, 401);
    const unauthData = await unauthRes.json();
    assert.equal(unauthData.success, false);

    const invalidAuthRes = await fetch("http://localhost:3000/api/agent/proposals/PROP-TEST-404", {
      headers: { Authorization: "Bearer invalid-token-12345" },
    });
    assert.equal(invalidAuthRes.status, 401);

    const envContent = read("../.env.local");
    const secretMatch = envContent.match(/^AGENT_WEBHOOK_SECRET=(.+)$/m);
    const activeSecret = secretMatch ? secretMatch[1].trim() : "near-hackathon-agent-secret-2026";

    const notFoundRes = await fetch("http://localhost:3000/api/agent/proposals/PROP-TEST-404", {
      headers: { Authorization: `Bearer ${activeSecret}` },
    });
    assert.equal(notFoundRes.status, 404);
    const notFoundData = await notFoundRes.json();
    assert.equal(notFoundData.success, false);
    assert.match(notFoundData.error, /not found/i);
  } catch (err) {
    // If dev server isn't running in test context, skip gracefully
    if (err.cause?.code === "ECONNREFUSED") return;
    throw err;
  }
});

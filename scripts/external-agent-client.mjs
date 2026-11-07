#!/usr/bin/env node
/**
 * External AI Agent Client for AgentReceipts
 *
 * Demonstrates how an autonomous external AI agent:
 * 1. Registers its identity with the AgentReceipts dashboard.
 * 2. Submits a policy-bounded micro-payment proposal.
 * 3. Polls the individual proposal status endpoint awaiting human approval in Meteor Wallet.
 *
 * Safety Guarantees:
 * - NEAR Testnet only.
 * - Human-in-the-Loop: No autonomous signing. No private keys or seed phrases.
 * - Transactions must be approved by a human inside Meteor Wallet and verified on-chain.
 */

import fs from "node:fs";
import path from "node:path";

// Auto-load webhook secret from .env.local if not supplied in environment
if (!process.env.AGENT_WEBHOOK_SECRET) {
  try {
    const envFile = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envFile)) {
      const match = fs.readFileSync(envFile, "utf8").match(/^AGENT_WEBHOOK_SECRET=(.+)$/m);
      if (match) process.env.AGENT_WEBHOOK_SECRET = match[1].trim();
    }
  } catch {}
}

const BASE_URL = (process.env.AGENTRECEIPTS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.AGENT_WEBHOOK_SECRET || "";
const PAYER_ACCOUNT = process.env.NEAR_PAYER_ACCOUNT || "reddish2675.testnet";
const RECIPIENT_ACCOUNT = process.env.NEAR_RECIPIENT_ACCOUNT || "oracle.testnet";
const AMOUNT_NEAR = parseFloat(process.env.PAYMENT_AMOUNT_NEAR || "0.01");
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "3000", 10);
const MAX_POLL_ATTEMPTS = parseInt(process.env.MAX_POLL_ATTEMPTS || "20", 10);

const args = process.argv.slice(2);
const shouldPoll = !args.includes("--no-poll");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
AgentReceipts External AI Agent Client
======================================
Usage:
  node scripts/external-agent-client.mjs [options]

Options:
  --no-poll    Submit the proposal and exit immediately without polling for approval
  --help, -h   Show this help message

Environment Variables:
  AGENTRECEIPTS_BASE_URL    Base URL of AgentReceipts (default: http://localhost:3000)
  AGENT_WEBHOOK_SECRET      Shared webhook authentication secret (>= 32 chars)
  NEAR_PAYER_ACCOUNT        Authorized payer account (default: reddish2675.testnet)
  NEAR_RECIPIENT_ACCOUNT    Payment recipient account (default: oracle.testnet)
  PAYMENT_AMOUNT_NEAR       Proposal amount in NEAR (default: 0.01)
  POLL_INTERVAL_MS          Polling interval in milliseconds (default: 3000)
  MAX_POLL_ATTEMPTS         Maximum poll attempts before timing out (default: 20)
`);
  process.exit(0);
}

const AGENT_IDENTITY = {
  agentId: "external-oracle-agent.testnet",
  agentName: "External Oracle Data Agent",
  description: "External AI Agent requesting micro-payment for verified oracle data feed on NEAR Testnet",
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("============================================================");
  console.log("🤖 AgentReceipts External AI Agent Integration Client");
  console.log("============================================================");
  console.log(`🌐 Base URL:      ${BASE_URL}`);
  console.log(`🆔 Agent Identity: ${AGENT_IDENTITY.agentName} (${AGENT_IDENTITY.agentId})`);
  console.log(`💳 Payer Account: ${PAYER_ACCOUNT}`);
  console.log(`🎯 Recipient:     ${RECIPIENT_ACCOUNT}`);
  console.log(`💰 Amount:        ${AMOUNT_NEAR} NEAR (Testnet)`);
  console.log("🛡️  Safety Mode:   Human-in-the-Loop (Option A — No Autonomous Signing)");
  console.log("------------------------------------------------------------\n");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
  };

  // --------------------------------------------------------------------------
  // STEP 1: Connect & register the agent identity
  // --------------------------------------------------------------------------
  console.log("📡 [Step 1/3] Registering external agent connection with AgentReceipts...");
  try {
    const connRes = await fetch(`${BASE_URL}/api/agent/connections`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        agentId: AGENT_IDENTITY.agentId,
        agentName: AGENT_IDENTITY.agentName,
        accountId: PAYER_ACCOUNT,
        network: "NEAR Testnet",
        description: AGENT_IDENTITY.description,
      }),
    });

    let connData;
    try {
      connData = await connRes.json();
    } catch {
      throw new Error(`Server returned HTTP ${connRes.status} (non-JSON response). Please verify AGENTRECEIPTS_BASE_URL and that the dev server is running.`);
    }

    if (!connRes.ok || !connData.success) {
      if (connRes.status === 401) {
        throw new Error(`Unauthorized (HTTP 401). AGENT_WEBHOOK_SECRET does not match the server's configured secret in .env.local.`);
      }
      throw new Error(connData.error || `HTTP ${connRes.status}`);
    }

    console.log(`✅ Agent successfully registered and linked to '${PAYER_ACCOUNT}'.`);
    console.log(`   Status: ${connData.connection?.status || "CONNECTED"}\n`);
  } catch (err) {
    console.error(`❌ Failed to register agent connection: ${err.message}`);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // STEP 2: Submit a policy-bounded payment proposal
  // --------------------------------------------------------------------------
  console.log("📝 [Step 2/3] Submitting payment proposal to AgentReceipts API...");
  let proposalId = null;

  try {
    const propRes = await fetch(`${BASE_URL}/api/agent/proposals`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        agentId: AGENT_IDENTITY.agentId,
        agentName: AGENT_IDENTITY.agentName,
        taskType: "ORACLE_PRICE_FETCH",
        payerAccount: PAYER_ACCOUNT,
        recipientAccount: RECIPIENT_ACCOUNT,
        amountNear: AMOUNT_NEAR,
        prompt: "External agent scheduled task: retrieve latest NEAR/USD price index and settle data fee",
        network: "testnet",
      }),
    });

    let propData;
    try {
      propData = await propRes.json();
    } catch {
      throw new Error(`Server returned HTTP ${propRes.status} (non-JSON response).`);
    }

    if (!propRes.ok || !propData.success) {
      if (propRes.status === 422) {
        console.error(`⚠️  Proposal rejected by spending guardrails: ${propData.message || propData.error}`);
        process.exit(1);
      }
      if (propRes.status === 401) {
        throw new Error(`Unauthorized (HTTP 401). Invalid AGENT_WEBHOOK_SECRET.`);
      }
      throw new Error(propData.error || `HTTP ${propRes.status}`);
    }

    proposalId = propData.proposal?.proposalId;
    const taskId = propData.task?.taskId || propData.proposal?.taskId;

    console.log(`✅ Proposal created successfully!`);
    console.log(`   Proposal ID: ${proposalId}`);
    console.log(`   Task ID:     ${taskId}`);
    console.log(`   Amount:      ${propData.proposal?.amountNear} NEAR`);
    console.log(`   Recipient:   ${propData.proposal?.recipientAccount}`);
    console.log(`   Status:      ${propData.proposal?.status} (Awaiting human approval)\n`);

    console.log("👉 NEXT STEP FOR HUMAN OPERATOR:");
    console.log(`   1. Open the AgentReceipts dashboard: ${BASE_URL}`);
    console.log(`   2. In the header, click the 'Proposals' button.`);
    console.log(`   3. Review Proposal #${proposalId} and click 'Approve via Meteor Wallet'.`);
    console.log(`   4. Confirm the transaction in the Meteor Wallet popup.\n`);
  } catch (err) {
    console.error(`❌ Failed to submit payment proposal: ${err.message}`);
    process.exit(1);
  }

  if (!shouldPoll) {
    console.log("ℹ️  Flag '--no-poll' detected. Exiting. Check proposal status later via:");
    console.log(`   curl -H "Authorization: Bearer <AGENT_WEBHOOK_SECRET>" ${BASE_URL}/api/agent/proposals/${proposalId}`);
    process.exit(0);
  }

  // --------------------------------------------------------------------------
  // STEP 3: Poll individual proposal status endpoint
  // --------------------------------------------------------------------------
  console.log(`⏳ [Step 3/3] Polling status for proposal #${proposalId}...`);
  console.log(`   (Checking ${BASE_URL}/api/agent/proposals/${proposalId} every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_POLL_ATTEMPTS} attempts)\n`);

  let attempts = 0;
  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    await sleep(POLL_INTERVAL_MS);

    try {
      const pollRes = await fetch(`${BASE_URL}/api/agent/proposals/${encodeURIComponent(proposalId)}`, {
        method: "GET",
        headers: authHeaders,
      });

      const pollData = await pollRes.json();
      if (!pollRes.ok || !pollData.success) {
        console.warn(`   [Attempt ${attempts}/${MAX_POLL_ATTEMPTS}] Status check failed: ${pollData.error || pollRes.status}`);
        continue;
      }

      const p = pollData.proposal;
      const status = p?.status;

      if (status === "VERIFIED") {
        console.log("\n============================================================");
        console.log("🎉 SUCCESS: Proposal verified on NEAR Testnet!");
        console.log("============================================================");
        console.log(`   Proposal ID:       ${p.proposalId}`);
        console.log(`   Status:            ${p.status}`);
        console.log(`   Transaction Hash:  ${p.txHash}`);
        console.log(`   Block Height:      ${p.blockHeight || "final"}`);
        console.log(`   Explorer Link:     https://testnet.nearblocks.io/txns/${p.txHash}`);
        console.log(`   Evidence Receipt:  Evidence-backed receipt created in AgentReceipts.`);
        console.log("============================================================\n");
        process.exit(0);
      }

      if (status === "REJECTED" || status === "FAILED") {
        console.log("\n============================================================");
        console.log(`❌ TERMINAL STATE: Proposal #${proposalId} ended with status: ${status}`);
        console.log("============================================================");
        console.log(`   Reason: ${p.rejectionReason || "No details provided"}`);
        console.log("============================================================\n");
        process.exit(1);
      }

      console.log(`   [Attempt ${attempts}/${MAX_POLL_ATTEMPTS}] Status: ${status} (awaiting Meteor Wallet approval)...`);
    } catch (pollErr) {
      console.warn(`   [Attempt ${attempts}/${MAX_POLL_ATTEMPTS}] Network error: ${pollErr.message}`);
    }
  }

  console.log("\nℹ️  Polling timeout reached after " + (MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000) + " seconds.");
  console.log(`   Proposal #${proposalId} is still queued as PROPOSED.`);
  console.log(`   You can approve it at any time on the AgentReceipts dashboard.`);
  console.log(`   To check status again anytime:`);
  console.log(`   curl -H "Authorization: Bearer ${SECRET}" ${BASE_URL}/api/agent/proposals/${proposalId}\n`);
  process.exit(0);
}

main().catch((fatal) => {
  console.error("Fatal error:", fatal);
  process.exit(1);
});

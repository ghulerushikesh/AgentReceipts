import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

// Mirror the core policy logic for pure invariant unit testing
const TEST_POLICY = {
  network: "testnet",
  maxPerTransactionNear: 0.05, // 0.05 NEAR cap per task
  maxDailyNear: 0.2, // 0.20 NEAR cap per 24h window
  allowedRecipients: ["oracle.testnet", "compute-node.testnet", "storage-provider.testnet"],
  enforceRecipientWhitelist: false,
};

function isValidNearAccountId(accountId) {
  if (!accountId || typeof accountId !== "string") return false;
  const clean = accountId.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 64) return false;
  if (/^[0-9a-f]{64}$/.test(clean)) return true;
  return /^([a-z0-9_-]+\.)*[a-z0-9_-]+$/.test(clean);
}

function evaluateSpendingPolicy(amountNear, recipient, currentDailySpentNear, policy = TEST_POLICY) {
  const cleanRecipient = (recipient || "").trim().toLowerCase();

  if (policy.network !== "testnet") {
    return { passed: false, reason: "POLICY VIOLATION: Agent is strictly restricted to NEAR testnet." };
  }
  if (!isValidNearAccountId(cleanRecipient)) {
    return { passed: false, reason: `POLICY VIOLATION: Recipient '${cleanRecipient}' is not a valid NEAR account address.` };
  }
  if (amountNear > policy.maxPerTransactionNear) {
    return {
      passed: false,
      reason: `POLICY VIOLATION: Requested payment (${amountNear} NEAR) exceeds the per-transaction cap (${policy.maxPerTransactionNear} NEAR).`,
    };
  }
  if (amountNear <= 0) {
    return { passed: false, reason: "POLICY VIOLATION: Payment amount must be greater than 0 NEAR." };
  }
  const projectedDailyTotal = currentDailySpentNear + amountNear;
  if (projectedDailyTotal > policy.maxDailyNear) {
    return {
      passed: false,
      reason: `POLICY VIOLATION: Projected daily spending (${projectedDailyTotal.toFixed(
        4
      )} NEAR) exceeds daily allowance (${policy.maxDailyNear} NEAR). Daily spent so far: ${currentDailySpentNear.toFixed(
        4
      )} NEAR.`,
    };
  }
  return {
    passed: true,
    reason: `Complies with agent policy: ${amountNear} NEAR <= ${policy.maxPerTransactionNear} NEAR limit.`,
  };
}

// -----------------------------------------------------------------------------
// Test 1: Human Rejection & Wallet Cancellation
// -----------------------------------------------------------------------------
test("Test 1.1: Human explicitly rejects payment proposal via Reject action", () => {
  const rejectRoute = read("../src/app/api/agent/proposals/[id]/reject/route.ts");
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Route updates status to REJECTED with rejectionReason
  assert.match(rejectRoute, /updateProposalStatus\(proposalId, "REJECTED"/);
  assert.match(rejectRoute, /Cannot reject a verified on-chain payment/);
  // Route never touches wallet, broadcast, or sends funds
  assert.doesNotMatch(rejectRoute, /sendPayment|signAndSendTransaction|broadcast|transfer/i);

  // UI modal calls reject endpoint and provides clear user feedback
  assert.match(modal, /\/api\/agent\/proposals\/.*\/reject/);
  assert.match(modal, /Payment proposal #.* rejected\. No transaction was signed or broadcast\./);
  assert.match(modal, /Rejecting cancels the proposal without sending any transaction\./);
});

test("Test 1.2: Human cancels/rejects inside Meteor Wallet popup without signing", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Approval function wraps wallet sendPayment in try/catch and identifies cancellations
  assert.match(modal, /handleApproveViaMeteor/);
  assert.match(modal, /const \{ txHash \} = await sendPayment\(/);
  assert.match(modal, /isCancellation =/);
  assert.match(modal, /err\?\.message\?\.includes\("rejected"\)/);
  assert.match(modal, /err\?\.message\?\.includes\("cancelled"\)/);
  assert.match(modal, /err\?\.message\?\.includes\("User rejected"\)/);

  // UI clearly communicates cancellation without funds moving
  assert.match(modal, /Payment was rejected or cancelled in Meteor Wallet\. No funds were transferred\./);

  // In catch block: no transaction hash is stored, no status advance to SUBMITTED or VERIFIED
  const catchBlock = modal.slice(
    modal.indexOf("} catch (err: any) {", modal.indexOf("const { txHash } = await sendPayment")),
    modal.indexOf("} finally {", modal.indexOf("const { txHash } = await sendPayment"))
  );
  assert.doesNotMatch(catchBlock, /updateProposalStatus/);
  assert.doesNotMatch(catchBlock, /handleVerifyTxHash/);
  assert.doesNotMatch(catchBlock, /VERIFIED/);
  assert.doesNotMatch(catchBlock, /SUBMITTED/);
});

test("Test 1.3: Rejected proposals never count toward 24h daily spent allowance", () => {
  const store = read("../src/agent/proposal-store.ts");

  // getDailySpentNear only counts VERIFIED, SUBMITTED, and APPROVED
  assert.match(store, /getDailySpentNear/);
  assert.match(store, /p\.status !== "VERIFIED" && p\.status !== "SUBMITTED" && p\.status !== "APPROVED"/);
  // Confirms REJECTED and FAILED proposals return false (excluded)
  const filterBlock = store.slice(store.indexOf(".filter((p) => {"), store.indexOf(".reduce((sum, p) => sum + p.amountNear"));
  assert.match(filterBlock, /return false/);
});

test("Test 1.4: Rejected proposals cannot be re-validated or verified for settlement", () => {
  const validateRoute = read("../src/app/api/agent/proposals/[id]/validate/route.ts");
  const verifyRoute = read("../src/app/api/agent/proposals/[id]/verify/route.ts");

  // Validate endpoint strictly requires PROPOSED status
  assert.match(validateRoute, /proposal\.status !== "PROPOSED"/);
  assert.match(validateRoute, /cannot be validated for payment/);

  // Verify route requires PROPOSED or SUBMITTED, rejecting REJECTED proposals
  assert.match(verifyRoute, /proposal\.status !== "PROPOSED" &&/);
  assert.match(verifyRoute, /proposal\.status !== "SUBMITTED"/);
});

// -----------------------------------------------------------------------------
// Test 2: Per-Transaction Spending Limit (0.05 NEAR Cap)
// -----------------------------------------------------------------------------
test("Test 2.1: Proposal for 0.06 NEAR is rejected by policy engine", () => {
  const check = evaluateSpendingPolicy(0.06, "oracle.testnet", 0.0);
  assert.equal(check.passed, false);
  assert.match(check.reason, /Requested payment \(0\.06 NEAR\) exceeds the per-transaction cap \(0\.05 NEAR\)/);
});

test("Test 2.2: Proposals within 0.05 NEAR cap pass per-transaction evaluation", () => {
  const checkMax = evaluateSpendingPolicy(0.05, "oracle.testnet", 0.0);
  assert.equal(checkMax.passed, true);

  const checkSmall = evaluateSpendingPolicy(0.01, "oracle.testnet", 0.0);
  assert.equal(checkSmall.passed, true);
});

test("Test 2.3: Runner records proposals exceeding 0.05 NEAR as REJECTED with failed task", () => {
  const runner = read("../src/agent/runner.ts");

  // Policy failure branch in executeAgentTask
  assert.match(runner, /if \(!policyCheck\.passed\) \{/);
  assert.match(runner, /status: "REJECTED"/);
  assert.match(runner, /rejectionReason: policyCheck\.reason/);
  assert.match(runner, /status:\s*"FAILED"/);
  assert.match(runner, /Spending policy rejected proposed payment/);
  assert.match(runner, /storeProposal\(rejectedProposal\)/);
  assert.match(runner, /storeTaskRecord\(task\)/);
});

test("Test 2.4: UI and server-side validate endpoint block 0.06 NEAR before Meteor Wallet opens", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");
  const validateRoute = read("../src/app/api/agent/proposals/[id]/validate/route.ts");

  // Client-side guard prevents opening wallet if policy failed
  assert.match(modal, /if \(!proposal\.policyCheck\.passed \|\| proposal\.status === "REJECTED"\)/);
  assert.match(modal, /Policy violation: This proposal failed spending limits/);

  // Server-side validate endpoint rechecks policy before wallet popup
  assert.match(validateRoute, /evaluateSpendingPolicy/);
  assert.match(validateRoute, /if \(!policyCheck\.passed\)/);
  assert.match(validateRoute, /status: 422/);
});

// -----------------------------------------------------------------------------
// Test 3: Daily Spending Limit (0.20 NEAR Cap)
// -----------------------------------------------------------------------------
test("Test 3.1: Proposal breaching cumulative daily allowance is rejected", () => {
  // Existing daily spent = 0.18 NEAR, proposed = 0.03 NEAR (projected = 0.21 > 0.20)
  const check = evaluateSpendingPolicy(0.03, "oracle.testnet", 0.18);
  assert.equal(check.passed, false);
  assert.match(check.reason, /Projected daily spending \(0\.2100 NEAR\) exceeds daily allowance \(0\.2 NEAR\)/);
});

test("Test 3.2: Proposal meeting exact 0.20 NEAR cumulative boundary is permitted", () => {
  // Existing daily spent = 0.18 NEAR, proposed = 0.02 NEAR (projected = 0.20 <= 0.20)
  const check = evaluateSpendingPolicy(0.02, "oracle.testnet", 0.18);
  assert.equal(check.passed, true);
  assert.match(check.reason, /Complies with agent policy/);
});

test("Test 3.3: Pre-approval validate endpoint rechecks daily spending limit before wallet signature", () => {
  const validateRoute = read("../src/app/api/agent/proposals/[id]/validate/route.ts");

  assert.match(validateRoute, /const currentDailySpent = getDailySpentNear\(proposal\.payerAccount, proposalId\)/);
  assert.match(validateRoute, /const policyCheck = evaluateSpendingPolicy\(/);
  assert.match(validateRoute, /if \(!policyCheck\.passed\)/);
  assert.match(validateRoute, /Policy validation failed/);
  assert.match(validateRoute, /status: 422/);
});

test("Test 3.4: Settlement re-evaluates 24h window spending against active policy", () => {
  const runner = read("../src/agent/runner.ts");

  // Step 4 in verifyAndFinalizeProposal
  assert.match(runner, /4\. Re-check spending policy limits/);
  assert.match(runner, /getDailySpentNear\(proposal\.payerAccount, proposalId\)/);
  assert.match(runner, /evaluateSpendingPolicy/);
  assert.match(runner, /Settlement rejected by spending policy/);
  assert.match(runner, /updateProposalStatus\(proposalId, "FAILED"/);
});

// -----------------------------------------------------------------------------
// Test 4: Safeguards & Non-Bypass Invariants
// -----------------------------------------------------------------------------
test("Test 4.1: Human approval is mandatory - policy check pass NEVER auto-approves", () => {
  const runner = read("../src/agent/runner.ts");
  const validateRoute = read("../src/app/api/agent/proposals/[id]/validate/route.ts");

  // Proposals that pass policy remain PROPOSED awaiting human signature
  assert.match(runner, /status: "PROPOSED"/);
  assert.doesNotMatch(runner, /status: "APPROVED"/);

  // Validate endpoint explicitly leaves status unchanged
  assert.match(validateRoute, /\/\/ Leave the proposal PROPOSED until a wallet submission returns a real hash\./);
  assert.doesNotMatch(validateRoute, /updateProposalStatus/);
});

test("Test 4.2: No simulated or dummy hashes are permitted", () => {
  const verifyRoute = read("../src/app/api/agent/proposals/[id]/verify/route.ts");

  // Hash must match NEAR Base58 format (40-55 alphanumeric characters)
  assert.match(verifyRoute, /const BASE58_REGEX = \/\^\[1-9A-HJ-NP-Za-km-z\]\{40,55\}\$\//);
  assert.match(verifyRoute, /Invalid transaction hash format/);
});

test("Test 4.3: Anti-replay protection prevents reusing transaction hashes across proposals", () => {
  const store = read("../src/agent/proposal-store.ts");
  const runner = read("../src/agent/runner.ts");

  assert.match(store, /isTxHashUsedByProposal/);
  assert.match(runner, /isTxHashUsedByProposal\(cleanTxHash, proposalId\)/);
  assert.match(runner, /replay/i);
});

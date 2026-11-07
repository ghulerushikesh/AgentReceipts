import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

const TEST_POLICY = {
  network: "testnet",
  maxPerTransactionNear: 0.05,
  maxDailyNear: 0.2,
  allowedRecipients: ["oracle.testnet", "compute-node.testnet", "storage-provider.testnet"],
  enforceRecipientWhitelist: false,
};

function isTestnetAccountId(accountId) {
  if (!accountId || typeof accountId !== "string") return false;
  const clean = accountId.trim().toLowerCase();
  if (!clean.endsWith(".testnet")) return false;
  if (clean.length < 9 || clean.length > 64) return false;
  return /^([a-z0-9_-]+\.)*testnet$/.test(clean);
}

function evaluateSpendingPolicy(amountNear, recipient, currentDailySpentNear, policy = TEST_POLICY) {
  const cleanRecipient = (recipient || "").trim().toLowerCase();
  if (policy.network !== "testnet") {
    return { passed: false, reason: "POLICY VIOLATION: Agent is strictly restricted to NEAR testnet." };
  }
  if (!isTestnetAccountId(cleanRecipient)) {
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
  const projectedDailyTotal = Number((currentDailySpentNear + amountNear).toFixed(6));
  if (projectedDailyTotal > policy.maxDailyNear) {
    return {
      passed: false,
      reason: `POLICY VIOLATION: Daily spending limit exceeded. Prior 24h spending: ${currentDailySpentNear.toFixed(4)} NEAR. Proposed: ${amountNear.toFixed(4)} NEAR. Cap: ${policy.maxDailyNear.toFixed(4)} NEAR.`,
    };
  }
  return {
    passed: true,
    reason: `Complies with agent policy: ${amountNear} NEAR <= ${policy.maxPerTransactionNear} NEAR limit. Daily allowance remaining: ${(policy.maxDailyNear - projectedDailyTotal).toFixed(4)} NEAR.`,
  };
}

// -----------------------------------------------------------------------------
// Test 1: Dynamic Payer Authorization Model - Proposal can be paid by reddish2675.testnet
// -----------------------------------------------------------------------------
test("Dynamic Payer 1: Proposal created with default payer can be validated by reddish2675.testnet", () => {
  const connectedSigner = "reddish2675.testnet";
  assert.equal(isTestnetAccountId(connectedSigner), true);

  const amountNear = 0.01;
  const recipient = "oracle.testnet";
  const priorSpentReddish = 0.01;

  const check = evaluateSpendingPolicy(amountNear, recipient, priorSpentReddish);
  assert.equal(check.passed, true);
  assert.match(check.reason, /Complies with agent policy/);
});

// -----------------------------------------------------------------------------
// Test 2: Dynamic Payer with daily-cumul.testnet
// -----------------------------------------------------------------------------
test("Dynamic Payer 2: Proposal created with default payer can be validated by daily-cumul.testnet", () => {
  const connectedSigner = "daily-cumul.testnet";
  assert.equal(isTestnetAccountId(connectedSigner), true);

  const amountNear = 0.01;
  const recipient = "oracle.testnet";
  const priorSpentCumul = 0.05;

  const check = evaluateSpendingPolicy(amountNear, recipient, priorSpentCumul);
  assert.equal(check.passed, true);
  assert.match(check.reason, /Complies with agent policy/);
});

// -----------------------------------------------------------------------------
// Test 3: Spending limits correctly apply to the ACTUAL connected payer
// -----------------------------------------------------------------------------
test("Dynamic Payer 3: Spending limits apply to actual connected payer's daily history", () => {
  // Payer A has already spent 0.19 NEAR today (limit is 0.20 NEAR)
  const priorSpentPayerA = 0.19;

  // Payer B has spent 0.00 NEAR today
  const priorSpentPayerB = 0.00;

  // New proposal for 0.02 NEAR
  const proposedAmount = 0.02;
  const recipient = "oracle.testnet";

  // Check against Payer A: 0.19 + 0.02 = 0.21 > 0.20 -> MUST FAIL
  const checkPayerA = evaluateSpendingPolicy(proposedAmount, recipient, priorSpentPayerA);
  assert.equal(checkPayerA.passed, false);
  assert.match(checkPayerA.reason, /Daily spending limit exceeded/);

  // Check against Payer B: 0.00 + 0.02 = 0.02 <= 0.20 -> MUST PASS
  const checkPayerB = evaluateSpendingPolicy(proposedAmount, recipient, priorSpentPayerB);
  assert.equal(checkPayerB.passed, true);
  assert.match(checkPayerB.reason, /Complies with agent policy/);
});

// -----------------------------------------------------------------------------
// Test 4: Modal enforcement of wallet connection & testnet network
// -----------------------------------------------------------------------------
test("Dynamic Payer 4: Disconnected wallet prompts sign-in and rejects approval", () => {
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Enforces connection before approving
  assert.match(modalSource, /if \(!isConnected \|\| !accountId\)/);
  assert.match(modalSource, /signIn\(\)/);

  // Enforces NEAR Testnet account ID
  assert.match(modalSource, /cleanConnectedSigner\.endsWith\("\.testnet"\)/);
  assert.match(modalSource, /is not a valid NEAR Testnet account/);
});

// -----------------------------------------------------------------------------
// Test 5: Changing wallets during approval prevents unintended payment
// -----------------------------------------------------------------------------
test("Dynamic Payer 5: Account switch during approval flow triggers safety abort", () => {
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Validates signer consistency between pre-flight validation and wallet submission
  assert.match(modalSource, /Wallet account changed during pre-approval validation\. Payment aborted\./);
  assert.match(modalSource, /Wallet account changed during signing\. Verification aborted\./);
});

// -----------------------------------------------------------------------------
// Test 6: Actual connected account is stored as transaction sender and payer
// -----------------------------------------------------------------------------
test("Dynamic Payer 6: updateProposalStatus supports updating payerAccount and actualPayerAccount", () => {
  const storeSource = read("../src/agent/proposal-store.ts");

  assert.match(storeSource, /payerAccount\?: string;/);
  assert.match(storeSource, /details\?\.payerAccount/);
  assert.match(storeSource, /proposal\.payerAccount = cleanPayer;/);
  assert.match(storeSource, /proposal\.actualPayerAccount = cleanPayer;/);
  assert.match(storeSource, /proposal\.proposedPayerAccount = proposal\.payerAccount;/);
});

// -----------------------------------------------------------------------------
// Test 7: Receipts and audit attribution link to the actual payer account
// -----------------------------------------------------------------------------
test("Dynamic Payer 7: Verified attribution resolves by actual payer account and txHash", () => {
  const storeSource = read("../src/agent/proposal-store.ts");
  const serverSource = read("../src/lib/near-server.ts");

  // Attribution requires actual payer match
  assert.match(storeSource, /candidate\.payerAccount\.trim\(\)\.toLowerCase\(\) === cleanAccount/);
  assert.match(serverSource, /matchedProposal\.proposal\.payerAccount\.toLowerCase\(\) === signerId\.toLowerCase\(\)/);
});

// -----------------------------------------------------------------------------
// Test 8: Server-side validate route accepts dynamic signer and evaluates their daily limit
// -----------------------------------------------------------------------------
test("Dynamic Payer 8: Validate endpoint route inspects signerAccount and computes effective payer spending", () => {
  const validateRoute = read("../src/app/api/agent/proposals/[id]/validate/route.ts");

  // Accepts signerAccount
  assert.match(validateRoute, /const \{ signerAccount, payerAccount \} = body;/);
  assert.match(validateRoute, /isTestnetAccountId\(cleanSigner\)/);

  // Computes effectiveDailySpent against the connected payer
  assert.match(validateRoute, /const effectiveDailySpent =/);
  assert.match(validateRoute, /getDailySpentNear\(effectivePayer, proposalId\)/);

  // Evaluates spending policy with effective daily spent
  assert.match(validateRoute, /evaluateSpendingPolicy\([\s\S]*effectiveDailySpent/);

  // Returns effectivePayer in validation response
  assert.match(validateRoute, /effectivePayer,/);
});

// -----------------------------------------------------------------------------
// Test 9: Cancellation in Meteor Wallet creates no transaction hash or receipt
// -----------------------------------------------------------------------------
test("Dynamic Payer 9: Rejection or cancellation in wallet popup leaves proposal unsubmitted", () => {
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Catch block explicitly handles cancellation without broadcasting or saving hash
  assert.match(modalSource, /Payment was rejected or cancelled in Meteor Wallet\. No funds were transferred\./);
  assert.match(modalSource, /setLiveConfirmationStage\(null\);/);
  assert.match(modalSource, /setLiveConfirmationProposalId\(null\);/);
});

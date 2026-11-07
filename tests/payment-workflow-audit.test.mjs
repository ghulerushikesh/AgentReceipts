import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

// Mirror policy engine logic to test pure algorithm invariants in Node test runner
const DEFAULT_POLICY = {
  network: "testnet",
  maxPerTransactionNear: 0.05,
  maxDailyNear: 0.2,
  allowedRecipients: [
    "oracle.testnet",
    "compute-node.testnet",
    "storage-provider.testnet",
    "agent-escrow.testnet",
  ],
  enforceRecipientWhitelist: false,
};

function isValidNearAccountId(accountId) {
  if (!accountId || typeof accountId !== "string") return false;
  const clean = accountId.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 64) return false;
  if (/^[0-9a-f]{64}$/.test(clean)) return true;
  return /^([a-z0-9_-]+\.)*[a-z0-9_-]+$/.test(clean);
}

function evaluateSpendingPolicy(amountNear, recipient, currentDailySpentNear, policy = DEFAULT_POLICY) {
  const cleanRecipient = (recipient || "").trim().toLowerCase();

  if (policy.network !== "testnet") {
    return { passed: false, reason: "POLICY VIOLATION: Agent is strictly restricted to NEAR testnet." };
  }
  if (!isValidNearAccountId(cleanRecipient)) {
    return { passed: false, reason: `POLICY VIOLATION: Recipient '${cleanRecipient}' is not a valid NEAR account address.` };
  }
  if (policy.enforceRecipientWhitelist && policy.allowedRecipients && !policy.allowedRecipients.includes(cleanRecipient)) {
    return { passed: false, reason: `POLICY VIOLATION: Recipient '${cleanRecipient}' is not in the approved agent counterparty whitelist.` };
  }
  if (amountNear > policy.maxPerTransactionNear) {
    return { passed: false, reason: `POLICY VIOLATION: Requested payment (${amountNear} NEAR) exceeds the per-transaction cap (${policy.maxPerTransactionNear} NEAR).` };
  }
  if (amountNear <= 0) {
    return { passed: false, reason: "POLICY VIOLATION: Payment amount must be greater than 0 NEAR." };
  }
  const projectedDailyTotal = currentDailySpentNear + amountNear;
  if (projectedDailyTotal > policy.maxDailyNear) {
    return { passed: false, reason: `POLICY VIOLATION: Projected daily spending exceeds daily allowance (${policy.maxDailyNear} NEAR).` };
  }
  return { passed: true, reason: "Complies with agent policy" };
}

test("Policy rejects per-transaction payment exceeding cap", () => {
  const result = evaluateSpendingPolicy(0.06, "oracle.testnet", 0.0);
  assert.equal(result.passed, false);
  assert.match(result.reason, /exceeds the per-transaction cap/);
});

test("Policy approves per-transaction payment within cap", () => {
  const result = evaluateSpendingPolicy(0.01, "oracle.testnet", 0.0);
  assert.equal(result.passed, true);
  assert.match(result.reason, /Complies with agent policy/);
});

test("Policy rejects payment breaching cumulative daily limit", () => {
  const result = evaluateSpendingPolicy(0.03, "oracle.testnet", 0.18);
  assert.equal(result.passed, false);
  assert.match(result.reason, /exceeds daily allowance/);
});

test("Policy permits payment meeting exact daily limit boundary", () => {
  const result = evaluateSpendingPolicy(0.02, "oracle.testnet", 0.18);
  assert.equal(result.passed, true);
});

test("Policy rejects zero or negative payments", () => {
  const zeroResult = evaluateSpendingPolicy(0, "oracle.testnet", 0.0);
  assert.equal(zeroResult.passed, false);
  assert.match(zeroResult.reason, /must be greater than 0 NEAR/);

  const negResult = evaluateSpendingPolicy(-0.01, "oracle.testnet", 0.0);
  assert.equal(negResult.passed, false);
  assert.match(negResult.reason, /must be greater than 0 NEAR/);
});

test("Policy rejects invalid NEAR recipient account address format", () => {
  const invalidResult = evaluateSpendingPolicy(0.01, "invalid account with spaces!!", 0.0);
  assert.equal(invalidResult.passed, false);
  assert.match(invalidResult.reason, /not a valid NEAR account address/);
});

test("Policy strictly rejects non-testnet execution requests", () => {
  const mainnetPolicy = { ...DEFAULT_POLICY, network: "mainnet" };
  const result = evaluateSpendingPolicy(0.01, "oracle.testnet", 0.0, mainnetPolicy);
  assert.equal(result.passed, false);
  assert.match(result.reason, /strictly restricted to NEAR testnet/);
});

test("Verifier outcome parsing correctly identifies success vs failure statuses", () => {
  const successStatus1 = { SuccessValue: "" };
  const successStatus2 = { SuccessReceiptId: "ABC123xyz" };
  const failureStatus = { Failure: { ActionError: { index: 0, kind: "FunctionCallError" } } };

  function isOutcomeSuccess(finalStatus, outcomeStatus) {
    return Boolean(
      (finalStatus && (finalStatus.SuccessValue !== undefined || finalStatus.SuccessReceiptId !== undefined)) ||
      (outcomeStatus && (outcomeStatus.SuccessValue !== undefined || outcomeStatus.SuccessReceiptId !== undefined))
    );
  }

  assert.equal(isOutcomeSuccess(successStatus1, null), true);
  assert.equal(isOutcomeSuccess(null, successStatus2), true);
  assert.equal(isOutcomeSuccess(failureStatus, null), false);
  assert.equal(isOutcomeSuccess(null, null), false);
});


test("Policy validation never approves or mutates a proposal", () => {
  const route = read("../src/app/api/agent/proposals/[id]/validate/route.ts");
  assert.doesNotMatch(route, /updateProposalStatus/);
  assert.match(route, /proposal\.status !== "PROPOSED"/);
  assert.match(route, /success: true,[\s\S]*proposal,[\s\S]*policyCheck/);
});

test("Failed policy validation leaves the proposal status unchanged", () => {
  const route = read("../src/app/api/agent/proposals/[id]/validate/route.ts");
  const failureBranch = route.slice(route.indexOf("if (!policyCheck.passed)"), route.indexOf("// Leave the proposal"));
  assert.doesNotMatch(failureBranch, /updateProposalStatus/);
  assert.match(failureBranch, /proposal,/);
});

test("Only a real transaction hash advances a proposal to SUBMITTED", () => {
  const route = read("../src/app/api/agent/proposals/[id]/verify/route.ts");
  const hashValidation = route.indexOf("if (!cleanHash || !BASE58_REGEX.test(cleanHash))");
  const submittedUpdate = route.indexOf('updateProposalStatus(proposalId, "SUBMITTED", { txHash: cleanHash })');
  assert.ok(hashValidation >= 0 && submittedUpdate > hashValidation);
  assert.match(route, /status === "PROPOSED"/);
  assert.match(route, /txHash: cleanHash/);
});

test("Wallet cancellation does not record a hash or mark a proposal submitted", () => {
  const ui = read("../src/components/PaymentProposalsModal.tsx");
  const catchBlock = ui.slice(ui.indexOf("} catch (err: any) {", ui.indexOf("const { txHash } = await sendPayment")), ui.indexOf("} finally {", ui.indexOf("const { txHash } = await sendPayment")));
  assert.match(catchBlock, /rejected|cancel/i);
  assert.doesNotMatch(catchBlock, /txHash|SUBMITTED|APPROVED/);
});


test("Settlement policy excludes the proposal being settled from prior daily spending", () => {
  const runner = read("../src/agent/runner.ts");
  assert.match(runner, /getDailySpentNear\(proposal\.payerAccount, proposalId\)/);
});


test("Pending finality remains SUBMITTED and can be retried with the same hash", () => {
  const runner = read("../src/agent/runner.ts");
  const route = read("../src/app/api/agent/proposals/[id]/verify/route.ts");
  assert.match(runner, /isPendingFinality \? "SUBMITTED" : "FAILED"/);
  assert.match(route, /proposal\.txHash === cleanHash/);
  assert.match(route, /proposal\.rejectionReason\?\.startsWith\("Transaction pending:"\)/);
});

test("Successful re-verification clears the old pending-finality error", () => {
  const runner = read("../src/agent/runner.ts");
  assert.match(runner, /updateProposalStatus\(proposalId, "VERIFIED", \{[\s\S]*rejectionReason: null/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

// -----------------------------------------------------------------------------
// IMPROVEMENT 1: Authenticate Agent Proposals
// -----------------------------------------------------------------------------
test("Improvement 1: POST /api/agent/proposals requires Bearer AGENT_WEBHOOK_SECRET and protects secrets", () => {
  const proposalRoute = read("../src/app/api/agent/proposals/route.ts");
  const triggerRoute = read("../src/app/api/agent/proposals/trigger/route.ts");
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Route requires webhook secret configuration and validates Authorization header
  assert.match(proposalRoute, /function getWebhookSecret/);
  assert.match(proposalRoute, /secret\.trim\(\)\.length >= 32/);
  assert.match(proposalRoute, /function isAuthorized/);
  assert.match(proposalRoute, /authHeader\.startsWith\("Bearer "\)/);
  assert.match(proposalRoute, /status: 401/);
  assert.match(proposalRoute, /status: 503/);

  // Frontend UI calls the safe server-side trigger route instead of exposing secrets
  assert.match(triggerRoute, /Internal dashboard route for triggering agent task proposals/);
  assert.match(triggerRoute, /executeAgentTask/);
  assert.match(modalSource, /\/api\/agent\/proposals\/trigger/);
  assert.doesNotMatch(modalSource, /AGENT_WEBHOOK_SECRET/);
});

// -----------------------------------------------------------------------------
// IMPROVEMENT 2: Server-side Policy Check Before Approval
// -----------------------------------------------------------------------------
test("Improvement 2: Server-side pre-approval validation endpoint verifies limits before wallet popup", () => {
  const validateRoute = read("../src/app/api/agent/proposals/[id]/validate/route.ts");
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Validate endpoint checks proposal status, payer, recipient, amount, and spending policy
  assert.match(validateRoute, /getProposalById\(proposalId\)/);
  assert.match(validateRoute, /proposal\.status !== "PROPOSED"/);
  assert.doesNotMatch(validateRoute, /updateProposalStatus/);
  assert.match(validateRoute, /proposal\.network !== "testnet"/);
  assert.match(validateRoute, /isTestnetAccountId\(proposal\.payerAccount\)/);
  assert.match(validateRoute, /isTestnetAccountId\(proposal\.recipientAccount\)/);
  assert.match(validateRoute, /proposal\.amountNear <= 0/);
  assert.match(validateRoute, /evaluateSpendingPolicy/);
  assert.match(validateRoute, /getDailySpentNear\(proposal\.payerAccount, proposalId\)/);
  assert.match(validateRoute, /Leave the proposal PROPOSED/);

  // Modal invokes validate endpoint BEFORE sendPayment()
  const validateIndex = modalSource.indexOf("/api/agent/proposals/${encodeURIComponent(proposal.proposalId)}/validate");
  const sendPaymentIndex = modalSource.indexOf("await sendPayment(");

  assert.ok(validateIndex > 0, "Modal must call validate endpoint");
  assert.ok(sendPaymentIndex > 0, "Modal must call sendPayment");
  assert.ok(validateIndex < sendPaymentIndex, "Validation must execute before Meteor Wallet popup");
});

// -----------------------------------------------------------------------------
// IMPROVEMENT 3: Exact Payment Amount (BigInt)
// -----------------------------------------------------------------------------
test("Improvement 3: Exact yoctoNEAR equality rejects both underpayments and overpayments using BigInt", () => {
  const runnerSource = read("../src/agent/runner.ts");

  // Runner enforces exact BigInt equality
  assert.match(runnerSource, /const onChainDepositYocto = BigInt\(verification\.depositYocto/);
  assert.match(runnerSource, /const requiredDepositYocto = BigInt\(proposal\.amountYocto/);
  assert.match(runnerSource, /if \(onChainDepositYocto !== requiredDepositYocto\)/);
  assert.match(runnerSource, /onChainDepositYocto < requiredDepositYocto \? "underpayment" : "overpayment"/);

  // Pure logic verification
  function verifyPaymentAmount(onChainYoctoStr, proposedYoctoStr) {
    const onChain = BigInt(onChainYoctoStr);
    const required = BigInt(proposedYoctoStr);
    if (onChain !== required) {
      return {
        matched: false,
        diff: onChain < required ? "underpayment" : "overpayment",
      };
    }
    return { matched: true, diff: null };
  }

  const expectedAmount = "50000000000000000000000"; // 0.05 NEAR

  // Exact match
  assert.deepEqual(verifyPaymentAmount(expectedAmount, expectedAmount), {
    matched: true,
    diff: null,
  });

  // Underpayment (even by 1 yocto)
  const underpayment = (BigInt(expectedAmount) - 1n).toString();
  assert.deepEqual(verifyPaymentAmount(underpayment, expectedAmount), {
    matched: false,
    diff: "underpayment",
  });

  // Overpayment (even by 1 yocto)
  const overpayment = (BigInt(expectedAmount) + 1n).toString();
  assert.deepEqual(verifyPaymentAmount(overpayment, expectedAmount), {
    matched: false,
    diff: "overpayment",
  });
});

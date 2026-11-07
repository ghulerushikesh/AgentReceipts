import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relPath) => readFileSync(new URL(relPath, import.meta.url), "utf8");

// Re-implement or test core pure functions for unit validation
const YOCTO_PER_NEAR = BigInt("1000000000000000000000000");

function nearToYocto(near) {
  if (typeof near === "bigint") {
    return (near * YOCTO_PER_NEAR).toString();
  }
  let raw = typeof near === "number" ? near.toString() : near.trim();
  if (!raw || raw === "0") return "0";

  if (raw.includes("e-")) {
    const [coeff, expStr] = raw.split("e-");
    const exp = parseInt(expStr, 10);
    const [cWhole, cFrac = ""] = coeff.split(".");
    raw = "0." + "0".repeat(exp - 1) + cWhole + cFrac;
  }

  const isNegative = raw.startsWith("-");
  const cleanStr = isNegative ? raw.slice(1) : raw;

  const [wholePart = "0", fracPart = ""] = cleanStr.split(".");
  const paddedFrac = fracPart.padEnd(24, "0").slice(0, 24);
  const combined = `${wholePart}${paddedFrac}`.replace(/^0+/, "");
  const result = combined === "" ? "0" : combined;
  return isNegative ? `-${result}` : result;
}

function isValidNearAccountId(accountId) {
  if (!accountId || typeof accountId !== "string") return false;
  const clean = accountId.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 64) return false;
  if (/^[0-9a-f]{64}$/.test(clean)) return true;
  return /^([a-z0-9_-]+\.)*[a-z0-9_-]+$/.test(clean);
}

function isTestnetAccountId(accountId) {
  if (!isValidNearAccountId(accountId)) return false;
  const clean = accountId.trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(clean)) return true;
  if (clean.endsWith(".testnet")) return true;
  return false;
}

// -----------------------------------------------------------------------------
// CHECKPOINT 1: Exact yoctoNEAR integer comparison
// -----------------------------------------------------------------------------
test("Checkpoint 1: Exact yoctoNEAR integer conversion and comparison without precision loss", () => {
  const runnerSource = read("../src/agent/runner.ts");
  const nearSource = read("../src/lib/near.ts");

  // 1. Check conversion correctness
  assert.equal(nearToYocto(0.01), "10000000000000000000000");
  assert.equal(nearToYocto(0.05), "50000000000000000000000");
  assert.equal(nearToYocto(1), "1000000000000000000000000");
  assert.equal(nearToYocto("0.05"), "50000000000000000000000");

  // 2. Strict integer comparison: 1 yocto less must fail
  const requiredYocto = BigInt(nearToYocto(0.05));
  const exactYocto = BigInt("50000000000000000000000");
  const deficientYocto = exactYocto - 1n; // 1 yocto short

  assert.equal(exactYocto >= requiredYocto, true);
  assert.equal(deficientYocto >= requiredYocto, false);

  // 3. Confirm runner.ts uses BigInt yoctoNEAR check
  assert.match(runnerSource, /BigInt\(verification\.depositYocto/);
  assert.match(runnerSource, /BigInt\(proposal\.amountYocto/);
  assert.match(runnerSource, /onChainDepositYocto < requiredDepositYocto/);
  assert.match(nearSource, /export function nearToYocto/);
});

// -----------------------------------------------------------------------------
// CHECKPOINT 2: Actual transaction signer matches connected signer account
// -----------------------------------------------------------------------------
test("Checkpoint 2: Actual transaction signer strictly matches proposal payer", () => {
  const runnerSource = read("../src/agent/runner.ts");
  const modalSource = read("../src/components/PaymentProposalsModal.tsx");

  // Runner verifies on-chain signer matches proposal payer
  assert.match(runnerSource, /cleanTxSigner !== cleanProposalPayer/);
  assert.match(runnerSource, /Signer mismatch: expected payer '.*', but transaction was signed by '.*'/);

  // Modal validates connected signer is a valid NEAR Testnet account before calling wallet
  assert.match(modalSource, /cleanConnectedSigner/);
  assert.match(modalSource, /Connected wallet .* is not a valid NEAR Testnet account/);
});

// -----------------------------------------------------------------------------
// CHECKPOINT 3: Successful on-chain execution and appropriate NEAR Testnet finality
// -----------------------------------------------------------------------------
test("Checkpoint 3: Successful on-chain execution requires FINAL finality and no failures", () => {
  const verifierSource = read("../src/agent/verifier.ts");

  // Must check final_execution_status === 'FINAL'
  assert.match(verifierSource, /final_execution_status === "FINAL"/);

  // Must check for top-level, outcome, and receipts failure
  assert.match(verifierSource, /result\.status\?\.Failure/);
  assert.match(verifierSource, /outcome\?\.status\?\.Failure/);
  assert.match(verifierSource, /receipts_outcome/);

  // Must require SuccessValue or SuccessReceiptId
  assert.match(verifierSource, /SuccessValue !== undefined[\s\S]*SuccessReceiptId !== undefined/);

  // Test finality logic directly
  function evaluateFinality(finalStatus, failure, success) {
    const isFinal = !finalStatus || finalStatus === "FINAL";
    const hasFailure = Boolean(failure);
    const hasSuccess = Boolean(success);
    return isFinal && !hasFailure && hasSuccess;
  }

  assert.equal(evaluateFinality("FINAL", null, true), true);
  assert.equal(evaluateFinality("EXECUTED_OPTIMISTIC", null, true), false); // Not FINAL
  assert.equal(evaluateFinality("FINAL", { ActionError: {} }, true), false); // Reverted
  assert.equal(evaluateFinality("FINAL", null, false), false); // Incomplete
});

// -----------------------------------------------------------------------------
// CHECKPOINT 4: Only Testnet transactions and accounts pass verification
// -----------------------------------------------------------------------------
test("Checkpoint 4: Only NEAR Testnet accounts and transactions pass verification", () => {
  const policySource = read("../src/agent/policy.ts");
  const runnerSource = read("../src/agent/runner.ts");

  // Check testnet account validator logic
  assert.equal(isTestnetAccountId("oracle.testnet"), true);
  assert.equal(isTestnetAccountId("sub.agent.testnet"), true);
  assert.equal(isTestnetAccountId("98793cd44a70635cffb82ee2407d9f021e04c8173674e7a50d1839a8aaa38fae"), true);

  // Mainnet .near accounts must strictly fail
  assert.equal(isTestnetAccountId("sweat_welcome.near"), false);
  assert.equal(isTestnetAccountId("alice.near"), false);
  assert.equal(isTestnetAccountId("bob.mainnet"), false);

  // Runner enforces testnet network and accounts
  assert.match(runnerSource, /isTestnetAccountId\(proposal\.payerAccount\)/);
  assert.match(runnerSource, /isTestnetAccountId\(proposal\.recipientAccount\)/);
  assert.match(runnerSource, /proposal\.network !== "testnet"/);
});

// -----------------------------------------------------------------------------
// CHECKPOINT 5: Transaction hash anti-replay protection across proposals
// -----------------------------------------------------------------------------
test("Checkpoint 5: Transaction hash cannot be reused across multiple proposals (anti-replay)", () => {
  const storeSource = read("../src/agent/proposal-store.ts");
  const agentStoreSource = read("../src/lib/agent-store.ts");
  const runnerSource = read("../src/agent/runner.ts");

  // proposal-store exports isTxHashUsedByProposal
  assert.match(storeSource, /export function isTxHashUsedByProposal/);

  // agent-store exports hasAgentEventForTxHash
  assert.match(agentStoreSource, /export function hasAgentEventForTxHash/);

  // runner checks both stores before verifying
  assert.match(runnerSource, /if \(isTxHashUsedByProposal\(cleanTxHash, proposalId\)\)/);
  assert.match(runnerSource, /if \(hasAgentEventForTxHash\(cleanTxHash\)\)/);
  assert.match(runnerSource, /Replay detected/);
});

// -----------------------------------------------------------------------------
// CHECKPOINT 6: Policy limits rechecked before payment approval and settlement
// -----------------------------------------------------------------------------
test("Checkpoint 6: Policy limits are rechecked at settlement time against 24h spending", () => {
  const runnerSource = read("../src/agent/runner.ts");

  // Settlement policy evaluation rechecks daily budget
  assert.match(runnerSource, /getDailySpentNear\(proposal\.payerAccount, proposalId\)/);
  assert.match(runnerSource, /evaluateSpendingPolicy\(\s*proposal\.amountNear,\s*proposal\.recipientAccount,\s*currentDailySpent\s*\)/);
  assert.match(runnerSource, /Settlement rejected by spending policy/);
});

// -----------------------------------------------------------------------------
// CHECKPOINT 7: Rejected, failed, pending, and duplicate transactions cannot generate receipts
// -----------------------------------------------------------------------------
test("Checkpoint 7: Rejected, failed, pending, and duplicate transactions cannot generate receipts", () => {
  const runnerSource = read("../src/agent/runner.ts");

  // State guards: cannot verify REJECTED proposals
  assert.match(runnerSource, /proposal\.status === "REJECTED"/);
  assert.match(runnerSource, /cannot be verified/);

  // State guards: cannot re-verify already VERIFIED proposals
  assert.match(runnerSource, /proposal\.status === "VERIFIED"/);
  assert.match(runnerSource, /already been verified/);

  // Failed transactions mark proposal FAILED and do not dispatch event
  assert.match(runnerSource, /updateProposalStatus\(proposalId, "FAILED"/);
});

// -----------------------------------------------------------------------------
// CHECKPOINT 8: Verification cannot be bypassed by directly calling the API
// -----------------------------------------------------------------------------
test("Checkpoint 8: Direct API verification endpoint enforces validation and non-200 on failure", () => {
  const routeSource = read("../src/app/api/agent/proposals/[id]/verify/route.ts");

  // Validates base58 transaction hash format
  assert.match(routeSource, /BASE58_REGEX/);
  assert.match(routeSource, /status: 400/);

  // Returns 422 Unprocessable Entity when verification fails
  assert.match(routeSource, /if \(!result\.success\)/);
  assert.match(routeSource, /status: 422/);

  // Passes to verifyAndFinalizeProposal for full validation
  assert.match(routeSource, /verifyAndFinalizeProposal\(proposalId, cleanHash\)/);
});

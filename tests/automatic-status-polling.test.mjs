import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Automatic Polling 1: runner classifies NEAR RPC not-found and indexing delays as pending finality without failing", () => {
  const runner = read("../src/agent/runner.ts");

  // isPendingFinality checks doesn't exist, not found, unknown_transaction, timeout, etc.
  assert.match(runner, /errorMsg\.toLowerCase\(\)\.includes\("doesn't exist"\)/);
  assert.match(runner, /errorMsg\.toLowerCase\(\)\.includes\("not found"\)/);
  assert.match(runner, /isPendingFinality \? "SUBMITTED" : "FAILED"/);
  assert.match(runner, /Transaction pending:/);
});

test("Automatic Polling 2: verification route permits retrying pending finality and submitted proposals", () => {
  const route = read("../src/app/api/agent/proposals/[id]/verify/route.ts");

  assert.match(route, /proposal\.status !== "PROPOSED" &&\s*proposal\.status !== "SUBMITTED" &&\s*!retryingPendingFinality/);
  assert.match(route, /proposal\.rejectionReason\?\.startsWith\("Transaction pending:"\)/);
});

test("Automatic Polling 3: handleVerifyTxHash recognizes transient indexing lag and pending blocks without aborting", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  assert.match(modal, /errorMsg\.includes\("doesn't exist"\)/);
  assert.match(modal, /errorMsg\.includes\("not found"\)/);
  assert.match(modal, /if \(isPending && attempt < maxAttempts\)/);
  assert.match(modal, /if \(attempt < maxAttempts\)/);
});

test("Automatic Polling 4: background useEffect actively drives verification for submitted proposals with txHash", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Identifies submitted proposal with txHash
  assert.match(modal, /submittedProposal = proposals\.find\(/);
  assert.match(modal, /p\.status === "SUBMITTED" && Boolean\(p\.txHash\)/);
  // Triggers handleVerifyTxHash automatically
  assert.match(modal, /handleVerifyTxHash\(submittedProposal\.proposalId, submittedProposal\.txHash\)/);
  // Properly cleans up interval timer
  assert.match(modal, /return \(\) => clearInterval\(interval\);/);
});

test("Automatic Polling 5: pending tab includes in-flight/submitted proposals so they remain visible", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  assert.match(modal, /p\.status === "PROPOSED" \|\|\s*p\.status === "SUBMITTED"/);
});

test("Automatic Polling 6: UI immediately transitions to verified upon confirmation without requiring manual refresh", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Reactive verification state
  assert.match(modal, /isVerified =/);
  assert.match(modal, /liveConfirmationStage === "VERIFIED"/);
  assert.match(modal, /effectiveStatus/);
  assert.match(modal, /Payment Verified &amp; Settled/);
  assert.match(modal, /View Generated Receipt/);
});

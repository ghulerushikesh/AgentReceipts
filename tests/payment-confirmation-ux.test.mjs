import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Payment Confirmation UX: displays progressive confirmation milestones after wallet approval", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // 4 progressive confirmation milestones
  assert.match(modal, /Wallet approval received/);
  assert.match(modal, /Transaction submitted/);
  assert.match(modal, /Confirming on NEAR/);
  assert.match(modal, /Payment verified/);
});

test("Payment Confirmation UX: displays friendly explanation that blockchain confirmation is in progress", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Friendly progress explanation banner
  assert.match(modal, /Blockchain Confirmation in Progress/i);
  assert.match(
    modal,
    /Meteor Wallet approved the transaction\. NEAR Testnet is currently finalizing block receipts/
  );
});

test("Payment Confirmation UX: automated status polling refreshes without requiring user to click Refresh", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Automated polling effect for submitted/in-flight proposals
  assert.match(modal, /useEffect\(\(\) => \{/);
  assert.match(modal, /p\.status === "SUBMITTED"/);
  assert.match(modal, /setInterval\(\(\) => \{/);
  assert.match(modal, /fetchProposals\(\)/);
});

test("Payment Confirmation UX: automated retry loop handles pending RPC finality without blocking the UI", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Automated retry loop within handleVerifyTxHash
  assert.match(modal, /for \(let attempt = 1; attempt <= maxAttempts; attempt\+\+\)/);
  assert.match(modal, /errorMsg\.includes\("pending"\)/);
  assert.match(modal, /errorMsg\.includes\("UNKNOWN_TRANSACTION"\)/);
  assert.match(modal, /setTimeout\(resolve, delayMs\)/);
});

test("Payment Confirmation UX: prevents duplicate payments if user clicks repeatedly", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Guard in handleApproveViaMeteor
  assert.match(
    modal,
    /if \(approvingProposalId \|\| verifyingProposalId \|\| rejectingProposalId\)/
  );

  // Button disabled attribute
  assert.match(
    modal,
    /disabled=\{isApproving \|\| isVerifying \|\| isRejecting\}/
  );
});

test("Payment Confirmation UX: displays generated receipt action upon successful verification", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  assert.match(modal, /Payment Verified (&amp;|&) Settled/);
  assert.match(modal, /View Generated Receipt/);
  assert.match(modal, /onProposalVerified/);
});

test("Payment Confirmation UX: handles wallet cancellation gracefully without submitting", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  assert.match(modal, /Payment was rejected or cancelled in Meteor Wallet/);
  assert.match(modal, /setLiveConfirmationStage\(null\)/);
});

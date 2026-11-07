import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Redesigned Modal: displays prominent amount, recipient, agent, network, and policy status", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Prominent amount display
  assert.match(modal, /proposal\.amountNear/);
  assert.match(modal, /NEAR/);

  // Clear labels
  assert.match(modal, /Recipient Account/);
  assert.match(modal, /proposal\.recipientAccount/);
  assert.match(modal, /Requesting Agent/);
  assert.match(modal, /proposal\.agentName/);
  assert.match(modal, /NEAR Testnet/);

  // Policy status indicator
  assert.match(modal, /Policy Passed/);
  assert.match(modal, /Policy Rejected/);
});

test("Redesigned Modal: includes clear human authorization explanation", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Explicit simple explanation
  assert.match(
    modal,
    /Your payment will only happen after you approve it in Meteor Wallet\./
  );
  assert.match(modal, /Human Authorization Required/);
});

test("Redesigned Modal: includes both Approve and Reject Payment actions", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Clear primary and secondary actions
  assert.match(modal, /Approve with Meteor Wallet/);
  assert.match(modal, /Reject Payment/);

  // Reject triggers handleRejectProposal and does not call sendPayment
  assert.match(modal, /handleRejectProposal/);
  assert.match(modal, /\/api\/agent\/proposals\/.*\/reject/);
});

test("Redesigned Modal: contains 4-step status stepper indicator", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  assert.match(modal, /ProposalStatusStepper/);
  assert.match(modal, /Awaiting Approval/);
  assert.match(modal, /Wallet Confirmation/);
  assert.match(modal, /Payment Submitted/);
  assert.match(modal, /Verified/);
});

test("Redesigned Modal: provides collapsible Advanced Details section", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Collapsible toggle
  assert.match(modal, /Show Advanced Details/);
  assert.match(modal, /Hide Advanced Details/);
  assert.match(modal, /toggleDetails/);

  // Advanced metadata moved inside
  assert.match(modal, /proposal\.proposalId/);
  assert.match(modal, /proposal\.taskId/);
  assert.match(modal, /proposal\.payerAccount/);
  assert.match(modal, /Manual Transaction Verification/);
});

test("Reject API endpoint: updates proposal status without blockchain broadcast", async () => {
  const rejectRoute = read("../src/app/api/agent/proposals/[id]/reject/route.ts");

  assert.match(rejectRoute, /updateProposalStatus\(proposalId, "REJECTED"/);
  assert.doesNotMatch(rejectRoute, /sendPayment|broadcast|signTransaction/);
});

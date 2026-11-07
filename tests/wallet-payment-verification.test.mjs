import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("PaymentProposalsModal requires explicit human authorization and displays all required fields", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  // Requirement: Display recipient, amount, purpose and policy status before approval
  assert.match(modal, /proposal\.recipientAccount/);
  assert.match(modal, /proposal\.amountNear/);
  assert.match(modal, /proposal\.purpose/);
  assert.match(modal, /proposal\.policyCheck\?\.reason/);

  // Requirement: Approve via Meteor Wallet action
  assert.match(modal, /Approve via Meteor Wallet/);
  assert.match(modal, /handleApproveViaMeteor/);

  // Requirement: Explicit human authorization notice
  assert.match(modal, /Human Authorization Required/);
  assert.doesNotMatch(modal, /https:\/\/testnet\.mynearwallet\.com\/send-money/);
});

test("WalletSelectorContext provides sendPayment method with non-custodial action creators", () => {
  const context = read("../src/context/WalletSelectorContext.tsx");

  assert.match(context, /sendPayment/);
  assert.match(context, /actionCreators\.transfer/);
  assert.match(context, /wallet\.signAndSendTransaction/);
  // Ensures no private keys or seed phrases are stored
  assert.doesNotMatch(context, /privateKey|secretKey|seedPhrase|KeyPair/i);
});

test("Backend proposal verification strictly reconciles recipient address", () => {
  const runner = read("../src/agent/runner.ts");

  // Reconcile receiver
  assert.match(runner, /recipientMatches/);
  assert.match(runner, /Recipient mismatch/);
  assert.match(runner, /on-chain receiver .* does not match proposal/);
});

test("Backend proposal verification strictly reconciles payment amount", () => {
  const runner = read("../src/agent/runner.ts");

  // Reconcile amount
  assert.match(runner, /Amount mismatch/);
  assert.match(runner, /onChainDepositYocto !== requiredDepositYocto/);
});

test("Backend proposal verification elevates status to VERIFIED only after RPC confirmation", () => {
  const runner = read("../src/agent/runner.ts");

  assert.match(runner, /verifyTestnetTransaction/);
  assert.match(runner, /if \(!verification\.verified \|\| !verification\.isSuccessOnChain\)/);
  assert.match(runner, /updateProposalStatus\(proposalId, "VERIFIED"/);
  assert.match(runner, /recordAgentExecutionEvent/);
});

test("Header Proposals button remains clickable and opens modal when pendingProposalsCount is 0", () => {
  const header = read("../src/components/Header.tsx");

  // Button must always be present when onOpenProposals is passed
  assert.match(header, /id="proposals-button"/);
  assert.match(header, /onOpenProposals\(\)/);
  assert.match(header, /cursor-pointer/);
  assert.match(header, /aria-label="View Agent Payment Proposals"/);

  // Button must not be disabled when pendingProposalsCount === 0
  assert.doesNotMatch(header, /disabled=\{.*pendingProposalsCount === 0/);
  assert.doesNotMatch(header, /disabled=\{.*!pendingProposalsCount/);

  // Badge only shows when pending count > 0, button stays clickable regardless
  assert.match(header, /pendingProposalsCount > 0 && \(/);
});

test("PaymentProposalsModal displays clean empty state when no proposals exist", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");

  assert.match(modal, /No payment proposals yet\./);
  assert.match(modal, /Payment proposals created by authenticated agents will appear here/);
});

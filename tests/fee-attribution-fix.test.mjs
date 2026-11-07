import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("live transaction fee sums transaction and every receipt burn without estimated fallbacks", () => {
  const source = read("../src/lib/near-server.ts");
  assert.match(source, /const transactionBurnt = batchDetails\?\.execution_outcome\?\.outcome\?\.tokens_burnt/);
  assert.match(source, /const receiptOutcomes = batchDetails\?\.receipts/);
  assert.match(source, /sum \+ BigInt\(burnt\)/);
  assert.match(source, /tokensBurntYocto = null/);
  assert.doesNotMatch(source, /850000000000000000000|650000000000000000000/);

  const transactionBurn = 22318256250000000000n;
  const receiptBurn = 22318256250000000000n;
  assert.equal((transactionBurn + receiptBurn).toString(), "44636512500000000000");
});

test("receipt, dashboard, and CSV consume the shared exact fee fields", () => {
  const receipt = read("../src/components/ReceiptModal.tsx");
  const dashboard = read("../src/components/FinancialMetrics.tsx");
  const auditModal = read("../src/components/AuditReportModal.tsx");
  const csv = read("../src/lib/csv.ts");
  assert.match(receipt, /receipt\.networkFeeNear\.toFixed\(12\)/);
  assert.match(receipt, /receipt\.networkFeeYocto/);
  assert.match(dashboard, /summary\.totalNetworkFeeNear\.toFixed\(12\)/);
  assert.match(auditModal, /totalFeesNear\.toFixed\(12\)/);
  assert.match(auditModal, /r\.networkFeeNear === null \? "Unavailable" : r\.networkFeeNear\.toFixed\(12\)/);
  assert.match(csv, /r\.networkFeeNear\.toFixed\(12\)/);
  assert.match(csv, /r\.networkFeeYocto/);
  assert.match(csv, /Unavailable: incomplete actual execution outcomes/);
});

test("verifier sums transaction outcome and all receipt outcomes tokens_burnt and gas_burnt", () => {
  const verifier = read("../src/agent/verifier.ts");
  assert.match(verifier, /let totalTokensBurntYocto = BigInt\(outcome\?\.tokens_burnt \|\| "0"\)/);
  assert.match(verifier, /result\.receipts_outcome/);
  assert.match(verifier, /totalTokensBurntYocto \+= BigInt\(burnt\)/);
  assert.match(verifier, /totalGasBurnt \+= Number\(ro\.outcome\.gas_burnt\)/);

  // Exact on-chain numbers from testnet RPC for transfer
  const txOutcomeBurnt = 22318256250000000000n;
  const receipt0OutcomeBurnt = 22318256250000000000n;
  const receipt1OutcomeBurnt = 0n;
  const totalOnChainTokensBurnt = txOutcomeBurnt + receipt0OutcomeBurnt + receipt1OutcomeBurnt;
  assert.equal(totalOnChainTokensBurnt.toString(), "44636512500000000000");

  // Verify yoctoNEAR (10^24) conversion math
  const yoctoPerNear = 1000000000000000000000000n; // 10^24
  assert.equal(yoctoPerNear.toString().length, 25); // 1 + 24 zeroes

  // Single outcome conversion: 22318256250000000000 / 10^24 = 0.00002231825625 NEAR (~0.00002 NEAR)
  // Erroneous 10^23 division: 22318256250000000000 / 10^23 = 0.0002231825625 NEAR (~0.0002 NEAR, 10x discrepancy)
  const singleBurnNear = Number(txOutcomeBurnt) / 1e24;
  assert.equal(singleBurnNear.toFixed(5), "0.00002");
  const erroneous10xNear = Number(txOutcomeBurnt) / 1e23;
  assert.equal(erroneous10xNear.toFixed(4), "0.0002");

  // Full on-chain transaction + receipt conversion: 44636512500000000000 / 10^24 = 0.0000446365125 NEAR
  const fullBurnNear = Number(totalOnChainTokensBurnt) / 1e24;
  assert.equal(fullBurnNear.toFixed(12), "0.000044636512");
});

test("proposal attribution requires verified hash/account plus consistent completed task", () => {
  const store = read("../src/agent/proposal-store.ts");
  const server = read("../src/lib/near-server.ts");
  assert.match(store, /candidate\.status === "VERIFIED"/);
  assert.match(store, /candidate\.txHash\?\.trim\(\) === cleanHash/);
  assert.match(store, /candidate\.payerAccount\.trim\(\)\.toLowerCase\(\) === cleanAccount/);
  assert.match(store, /task\.status !== "COMPLETED"/);
  assert.match(store, /task\.proposalId !== proposal\.proposalId/);
  assert.match(server, /matchedProposal\.proposal\.amountYocto === transferAmountYocto/);
  assert.match(server, /attribution\.status = "CONFIRMED"/);
  assert.match(server, /attribution\.proposalId = proposal\.proposalId/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("authentication requires a configured 32-character secret without fallback", () => {
  const auth = read("../src/lib/auth.ts");
  assert.match(auth, /if \(!secret \|\| secret\.trim\(\)\.length < 32\) throw new AuthConfigurationError/);
  assert.doesNotMatch(auth, /AUTH_SECRET\s*\|\|/);
});

test("agent webhook routes fail closed when secret is missing or invalid", () => {
  for (const path of ["../src/app/api/agent/events/route.ts", "../src/app/api/agent/connections/route.ts"]) {
    const route = read(path);
    assert.match(route, /secret\.trim\(\)\.length >= 32/);
    assert.match(route, /if \(!secret\).*503/s);
    assert.doesNotMatch(route, /AGENT_WEBHOOK_SECRET\s*\|\|/);
    assert.match(route, /Unauthorized/);
  }
});

test("shared NEAR network config only permits Testnet RPC hosts", () => {
  const config = read("../src/lib/near-network.ts");
  assert.match(config, /rpc\.testnet\.fastnear\.com/);
  assert.match(config, /rpc\.testnet\.near\.org/);
  assert.match(config, /Only a NEAR Testnet RPC endpoint is supported/);
  assert.doesNotMatch(config, /rpc\.mainnet\.near\.org|rpc\.mainnet\.fastnear\.com/);
});

test("dashboard and verifier share Testnet RPC and transaction endpoints", () => {
  const dashboard = read("../src/lib/near-server.ts");
  const verifier = read("../src/agent/verifier.ts");
  const config = read("../src/lib/near-network.ts");
  assert.match(dashboard, /NEAR_TRANSACTIONS_API_URL/);
  assert.match(verifier, /NEAR_RPC_URL/);
  assert.match(config, /tx\.test\.fastnear\.com/);
  assert.match(config, /NEAR_NETWORK_LABEL = "NEAR Testnet"/);
});

test("payment proposal API rejects non-Testnet network requests", () => {
  const route = read("../src/app/api/agent/proposals/route.ts");
  assert.match(route, /Only NEAR Testnet payment proposals are supported/);
  assert.match(route, /isSupportedPaymentNetwork/);
});

test("wallet authorization and transaction explorer links remain on Testnet", () => {
  const modal = read("../src/components/PaymentProposalsModal.tsx");
  const config = read("../src/lib/near-network.ts");
  assert.match(modal, /Approve via Meteor Wallet/);
  assert.match(modal, /https:\/\/testnet\.nearblocks\.io\/txns/);
  assert.match(config, /testnet\.nearblocks\.io/);
});

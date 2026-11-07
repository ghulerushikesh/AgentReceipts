import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("WalletSelectorContext is strictly configured for NEAR Testnet only", () => {
  const content = read("../src/context/WalletSelectorContext.tsx");
  assert.match(content, /network:\s*"testnet"/);
  assert.doesNotMatch(content, /network:\s*"mainnet"/);
  assert.match(content, /setupMeteorWallet/);
  assert.doesNotMatch(content, /privateKey|secretKey|seedPhrase/i);
});

test("Header distinguishes connected signer wallet from monitored account", () => {
  const content = read("../src/components/Header.tsx");
  assert.match(content, /Connect Wallet/);
  assert.match(content, /Signer Wallet/);
  assert.match(content, /Disconnect wallet/);
  assert.match(content, /Monitored account/);
});

test("RootLayout wraps the application with WalletSelectorProvider and imports modal styles", () => {
  const content = read("../src/app/layout.tsx");
  assert.match(content, /WalletSelectorProvider/);
  assert.match(content, /@near-wallet-selector\/modal-ui\/styles\.css/);
});

test("Header is cleaned up without secondary preset row or Demo toggle button", () => {
  const content = read("../src/components/Header.tsx");
  assert.doesNotMatch(content, /PRESET_ACCOUNTS/);
  assert.doesNotMatch(content, /Monitored:/);
  assert.doesNotMatch(content, /relay\.tg/);
  assert.doesNotMatch(content, /aurora/);
  assert.doesNotMatch(content, /Demo Agent/);
  assert.match(content, /Audit/);
  assert.match(content, /placeholder="Monitored account\.\.\."/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Wallet Logout: page.tsx consumes WalletSelectorContext and checks connection state", () => {
  const pageSource = read("../src/app/page.tsx");

  // Must import and call useWalletSelector
  assert.match(pageSource, /useWalletSelector/);
  assert.match(pageSource, /accountId/);
  assert.match(pageSource, /isConnected/);
  assert.match(pageSource, /isWalletLoading/);
  assert.match(pageSource, /signIn/);

  // Must not have fallback to NEXT_PUBLIC_DEFAULT_NEAR_ACCOUNT or hardcoded agent-operator
  assert.doesNotMatch(pageSource, /process\.env\.NEXT_PUBLIC_DEFAULT_NEAR_ACCOUNT/);
  assert.doesNotMatch(pageSource, /"agent-operator\.testnet"/);
});

test("Wallet Logout: Hides financial metrics, budget, and transaction table when disconnected", () => {
  const pageSource = read("../src/app/page.tsx");

  // When disconnected or accountId unavailable, shows empty state instead of financial components
  assert.match(pageSource, /!isConnected\s*\|\|\s*!accountId/);
  assert.match(pageSource, /Connect your Meteor Wallet/);
  assert.match(pageSource, /Connect Wallet/);

  // Ensure BudgetBanner, FinancialMetrics, TransactionTable are wrapped inside connected branch
  assert.match(pageSource, /<BudgetBanner[\s\S]*<FinancialMetrics[\s\S]*<TransactionTable/);
});

test("Wallet Logout: Immediately clears client-side state on logout and account switch", () => {
  const pageSource = read("../src/app/page.tsx");

  // State cleared when !isConnected or !accountId
  assert.match(pageSource, /if\s*\(!isConnected\s*\|\|\s*!accountId\)\s*\{[\s\S]*setAccount\(""\);[\s\S]*setReceipts\(\[\]\);[\s\S]*setSummary\(null\);/);

  // State cleared immediately before fetching on account switch
  assert.match(pageSource, /if\s*\(accountId\s*!==\s*prevAccountIdRef\.current\)\s*\{[\s\S]*setReceipts\(\[\]\);[\s\S]*setSummary\(null\);/);

  // Stale async response prevention using request tracking
  assert.match(pageSource, /activeRequestIdRef/);
  assert.match(pageSource, /requestId\s*!==\s*activeRequestIdRef\.current/);
});

test("Wallet Logout: WalletSelectorContext.tsx immediately clears accounts on signOut", () => {
  const contextSource = read("../src/context/WalletSelectorContext.tsx");

  // signOut must immediately clear accounts before/during async logout
  assert.match(contextSource, /const signOut = useCallback\(async \(\) => \{[\s\S]*setAccounts\(\[\]\);/);
});

test("Wallet Logout: /api/receipts requires account parameter and eliminates automatic fallback", () => {
  const routeSource = read("../src/app/api/receipts/route.ts");

  // Requires account parameter
  assert.match(routeSource, /searchParams\.get\("account"\)/);
  assert.match(routeSource, /if\s*\(!rawAccount\s*\|\|\s*!rawAccount\.trim\(\)\)/);
  assert.match(routeSource, /Account parameter is required/);

  // Must not fall back to NEXT_PUBLIC_DEFAULT_NEAR_ACCOUNT
  assert.doesNotMatch(routeSource, /process\.env\.NEXT_PUBLIC_DEFAULT_NEAR_ACCOUNT/);
  assert.doesNotMatch(routeSource, /"agent-operator\.testnet"/);
});

test("Agent Connections Modal: masks token by default and replaces hardcoded secrets with safe placeholder", () => {
  const modalSource = read("../src/components/AgentConnectionsModal.tsx");

  // Never contains old hardcoded pseudo-secret
  assert.doesNotMatch(modalSource, /near-hackathon-agent-secret-2026/);

  // Masks token by default
  assert.match(modalSource, /isTokenMasked/);
  assert.match(modalSource, /••••••••••••••••••••••••••••••••/);

  // Uses safe placeholder template
  assert.match(modalSource, /<YOUR_AGENT_WEBHOOK_SECRET>/);

  // Copy mechanism copies safe placeholder without revealing server secrets
  assert.match(modalSource, /curlCopySnippet[\s\S]*<YOUR_AGENT_WEBHOOK_SECRET>/);
  assert.match(modalSource, /navigator\.clipboard\.writeText\(curlCopySnippet\)/);
});


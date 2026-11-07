/** Single source of truth for the prototype's NEAR network. */
export const NEAR_NETWORK = "testnet" as const;
export const NEAR_NETWORK_LABEL = "NEAR Testnet" as const;
function configuredTestnetRpc(): string {
  const configured = process.env.NEAR_RPC_URL || process.env.NEAR_TESTNET_RPC_URL;
  if (!configured) return "https://rpc.testnet.fastnear.com";
  const url = new URL(configured);
  if (url.hostname !== "rpc.testnet.fastnear.com" && url.hostname !== "rpc.testnet.near.org") {
    throw new Error("Only a NEAR Testnet RPC endpoint is supported.");
  }
  return url.toString();
}
export const NEAR_RPC_URL = configuredTestnetRpc();
export const NEAR_TRANSACTIONS_API_URL = "https://tx.test.fastnear.com";
export const NEAR_ACCOUNT_API_URL = "https://test.api.fastnear.com";
export const NEAR_EXPLORER_URL = "https://testnet.nearblocks.io";
export const NEAR_WALLET_URL = "https://testnet.mynearwallet.com";

export function isSupportedPaymentNetwork(value: unknown): value is "testnet" {
  return value === "testnet";
}

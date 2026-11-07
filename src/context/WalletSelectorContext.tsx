"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type {
  WalletSelector,
  AccountState,
} from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupWalletSelector, actionCreators } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";

export interface SendPaymentParams {
  recipientId: string;
  amountYocto?: string;
  amountNear?: number;
}

export interface SendPaymentResult {
  txHash: string;
}

interface WalletSelectorContextValue {
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  accounts: AccountState[];
  accountId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  sendPayment: (params: SendPaymentParams) => Promise<SendPaymentResult>;
}

const WalletSelectorContext = createContext<WalletSelectorContextValue>({
  selector: null,
  modal: null,
  accounts: [],
  accountId: null,
  isConnected: false,
  isLoading: true,
  error: null,
  signIn: () => {},
  signOut: async () => {},
  sendPayment: async () => {
    throw new Error("WalletSelectorContext not initialized");
  },
});

function nearToYoctoString(amountNear: number): string {
  const cleanNearStr = amountNear.toFixed(6);
  const [whole, frac = ""] = cleanNearStr.split(".");
  const paddedFrac = frac.padEnd(24, "0");
  return (
    BigInt(whole) * BigInt("1000000000000000000000000") +
    BigInt(paddedFrac)
  ).toString();
}

function extractTxHashFromOutcome(outcome: any): string | null {
  if (!outcome) return null;
  if (typeof outcome === "string") return outcome;
  if (typeof outcome.transaction?.hash === "string") return outcome.transaction.hash;
  if (typeof outcome.transaction_outcome?.id === "string") return outcome.transaction_outcome.id;
  if (Array.isArray(outcome) && outcome.length > 0) {
    return extractTxHashFromOutcome(outcome[0]);
  }
  if (typeof outcome.txHash === "string") return outcome.txHash;
  if (typeof outcome.hash === "string") return outcome.hash;
  return null;
}

export function WalletSelectorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accounts, setAccounts] = useState<AccountState[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const initWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Strictly configure for NEAR Testnet only
      const _selector = await setupWalletSelector({
        network: "testnet",
        debug: false,
        modules: [setupMeteorWallet()],
      });

      const _modal = setupModal(_selector, {
        theme: "light",
        description:
          "Connect your Meteor Wallet on NEAR Testnet to authorize agent payments.",
      });

      const state = _selector.store.getState();
      setAccounts(state.accounts);
      setSelector(_selector);
      setModal(_modal);

      // Subscribe to reactive account updates (logins, switches, logouts)
      const subscription = _selector.store.observable.subscribe((nextState) => {
        setAccounts(nextState.accounts);
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (err: any) {
      console.error("Failed to initialize NEAR Wallet Selector:", err);
      setError(err?.message || "Failed to initialize wallet connection");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initWallet().then((unsub) => {
      if (typeof unsub === "function") {
        cleanup = unsub;
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [initWallet]);

  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.active) || accounts[0] || null;
  }, [accounts]);

  const accountId = activeAccount ? activeAccount.accountId : null;
  const isConnected = Boolean(accountId);

  const signIn = useCallback(() => {
    if (!modal) {
      console.warn("Wallet selector modal not ready yet");
      return;
    }
    try {
      modal.show();
    } catch (err: any) {
      console.error("Error showing wallet modal:", err);
      setError(err?.message || "Failed to open wallet selection modal");
    }
  }, [modal]);

  const signOut = useCallback(async () => {
    // Immediately clear local account state for responsive UI teardown
    setAccounts([]);
    if (!selector) return;
    try {
      const wallet = await selector.wallet();
      await wallet.signOut();
    } catch (err: any) {
      console.error("Error signing out from wallet:", err);
      setError(err?.message || "Failed to disconnect wallet");
    } finally {
      setAccounts([]);
    }
  }, [selector]);

  /**
   * Prompts the user to explicitly approve a payment inside Meteor Wallet.
   * Non-custodial: private key remains protected inside Meteor Wallet.
   * Returns the broadcasted on-chain transaction hash upon human signature approval.
   */
  const sendPayment = useCallback(
    async ({
      recipientId,
      amountYocto,
      amountNear,
    }: SendPaymentParams): Promise<SendPaymentResult> => {
      if (!selector) {
        throw new Error("Wallet selector is not initialized yet.");
      }
      const wallet = await selector.wallet();
      if (!wallet) {
        throw new Error(
          "No active wallet connected. Please connect Meteor Wallet first."
        );
      }

      const cleanRecipient = recipientId.trim().toLowerCase();
      const finalYocto =
        amountYocto ||
        (amountNear !== undefined ? nearToYoctoString(amountNear) : "0");

      if (!finalYocto || finalYocto === "0") {
        throw new Error("Payment amount must be greater than 0 yoctoNEAR.");
      }

      // Prompt human authorization inside Meteor Wallet popup
      const outcome = await wallet.signAndSendTransaction({
        receiverId: cleanRecipient,
        actions: [actionCreators.transfer(BigInt(finalYocto))],
      });

      const txHash = extractTxHashFromOutcome(outcome);
      if (!txHash) {
        throw new Error(
          "Transaction was submitted in Meteor Wallet, but no transaction hash was returned. Please verify the transaction hash manually."
        );
      }

      return { txHash };
    },
    [selector]
  );

  const value = useMemo<WalletSelectorContextValue>(() => {
    return {
      selector,
      modal,
      accounts,
      accountId,
      isConnected,
      isLoading,
      error,
      signIn,
      signOut,
      sendPayment,
    };
  }, [
    selector,
    modal,
    accounts,
    accountId,
    isConnected,
    isLoading,
    error,
    signIn,
    signOut,
    sendPayment,
  ]);

  return (
    <WalletSelectorContext.Provider value={value}>
      {children}
    </WalletSelectorContext.Provider>
  );
}

export function useWalletSelector() {
  const context = useContext(WalletSelectorContext);
  if (!context) {
    throw new Error(
      "useWalletSelector must be used within a WalletSelectorProvider"
    );
  }
  return context;
}

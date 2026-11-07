import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { WalletSelectorProvider } from "@/context/WalletSelectorContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AgentReceipts — Your AI agent's money, made clear.",
  description:
    "See what your agent spends, track its budget, and understand every transaction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#080D19] text-[#F8FAFC] antialiased min-h-screen selection:bg-[#3978F6]/30 selection:text-white`}
      >
        <WalletSelectorProvider>{children}</WalletSelectorProvider>
      </body>
    </html>
  );
}

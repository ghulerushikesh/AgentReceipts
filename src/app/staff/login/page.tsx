"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Phone, ArrowRight, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/staff";

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Verify your staff credentials.");
      } else {
        router.push(redirectPath);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoStaff = () => {
    setEmailOrPhone("staff@cueclub.com");
    setPassword("CueClub@Staff2026");
  };

  return (
    <div className="card-elevated p-8 sm:p-10 rounded-2xl relative overflow-hidden space-y-6">
      {/* Decorative top ambient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-gold-400 to-emerald-600" />

      {/* Access badge */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-border-subtle">
        <div className="inline-flex items-center gap-2 text-gold-400 font-medium">
          <Shield className="w-4 h-4 text-gold-400" />
          <span className="tracking-wide uppercase text-[10px] font-bold">Authorized Operations Access</span>
        </div>
        <span className="text-[10px] text-ivory-muted font-mono">v2.4 Production</span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-900/80 bg-rose-950/40 p-4 text-xs text-rose-300 flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold block text-rose-200">Authentication Failed</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ivory-warm tracking-wide mb-2">
            Staff Email or Phone
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="e.g. staff@cueclub.com"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-4 py-3 text-sm text-ivory-warm placeholder-ivory-muted/40 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-semibold text-ivory-warm tracking-wide">
              Access Code / Password
            </label>
          </div>
          <div className="relative">
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-4 py-3 text-sm text-ivory-warm placeholder-ivory-muted/40 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30 transition tracking-widest"
            />
          </div>
        </div>

        {/* Quick Demo Credentials Autofill Pill */}
        <div className="pt-1">
          <button
            type="button"
            onClick={fillDemoStaff}
            className="w-full py-2 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center justify-center gap-1.5 transition group"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span>Autofill Staff Credentials (<code>staff@cueclub.com</code> • <code>CueClub@Staff2026</code>)</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 disabled:opacity-50 text-ivory-warm font-bold text-sm tracking-wide shadow-luxury-emerald transition flex items-center justify-center gap-2 group cursor-pointer"
        >
          {loading ? (
            <span>Authenticating Operator...</span>
          ) : (
            <>
              <span>Sign In to Console</span>
              <ArrowRight className="w-4 h-4 text-gold-300 group-hover:translate-x-0.5 transition" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-border-subtle flex items-center justify-between text-xs">
        <Link
          href="/"
          className="text-ivory-muted hover:text-gold-400 transition flex items-center gap-1"
        >
          ← Return to Club Lounge
        </Link>
        <span className="text-[10px] text-ivory-muted/60">Strict 256-bit Audit Active</span>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <div className="min-h-screen bg-charcoal-deep flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      {/* Subtle ambient lighting orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-gold-400/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center space-x-3 group">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-gold-400/30 flex items-center justify-center shadow-luxury-gold group-hover:border-gold-400 transition">
              <span className="text-2xl font-display font-black text-gold-400 tracking-tighter">CC</span>
            </div>
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ivory-warm">
              Cue<span className="text-gold-gradient">Club</span>
            </h1>
            <p className="text-xs uppercase tracking-[0.25em] text-gold-400/80 font-medium mt-1">
              Operations & Table Management Console
            </p>
          </div>
          <p className="text-xs text-ivory-muted max-w-xs mx-auto">
            Restricted portal for arena marshals, table session controllers, and club management.
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-xs text-ivory-muted">Loading console...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[11px] text-ivory-muted/50 tracking-wider">
          CueClub Snooker & Pool Club Management System • All rights reserved
        </p>
      </div>
    </div>
  );
}

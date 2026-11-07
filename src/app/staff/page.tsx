"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Table, Booking, Session, Payment, Profile } from "@/types/database";
import {
  Shield,
  Clock,
  Calendar,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Plus,
  RotateCcw,
  Receipt,
  Search,
  LogOut,
  Sparkles,
  Timer,
  ChevronRight,
  TrendingUp,
  Percent,
  Layers,
  QrCode,
} from "lucide-react";

export default function StaffDashboardPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Walk-in form state
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInTableId, setWalkInTableId] = useState("");
  const [walkInDuration, setWalkInDuration] = useState(60);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);

  // Extend session modal
  const [extendBooking, setExtendBooking] = useState<Booking | null>(null);
  const [extendMinutes, setExtendMinutes] = useState(30);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendLoading, setExtendLoading] = useState(false);

  // Billing & Payment modal
  const [billSession, setBillSession] = useState<any | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">("upi");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState("");
  const [addonAmount, setAddonAmount] = useState<number>(0);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  // Customer search & history modal
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedCustomers, setSearchedCustomers] = useState<Profile[]>([]);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<any | null>(null);

  // No-show notification
  const [noShowMessage, setNoShowMessage] = useState<string | null>(null);

  // Bookings list filter
  const [bookingTab, setBookingTab] = useState<string>("confirmed");

  const handleRestoreBooking = async (bookingId: string) => {
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", bookingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Cannot restore this booking because the time slot has already been reserved.");
      } else {
        fetchStaffData();
      }
    } catch (e: any) {
      alert(e.message || "Failed to communicate with server.");
    }
  };

  const fetchStaffData = async () => {
    try {
      const [tRes, bRes] = await Promise.all([fetch("/api/tables"), fetch("/api/bookings")]);
      const tData = await tRes.json();
      const bData = await bRes.json();
      if (tData.tables) setTables(tData.tables);
      if (bData.bookings) setBookings(bData.bookings);
    } catch (e) {
      console.error("Error loading staff data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
    const interval = setInterval(fetchStaffData, 5000); // 5-second polling for active sessions
    return () => clearInterval(interval);
  }, []);

  // Handle Walk-in Creation
  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInSubmitting(true);
    setWalkInError(null);

    const startTime = new Date().toISOString();

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: walkInName,
          customerPhone: walkInPhone,
          tableId: walkInTableId,
          startTime,
          durationMinutes: walkInDuration,
          bookingType: "walk_in",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWalkInError(data.error || "Failed to create walk-in session");
      } else {
        // Immediately check in the walk-in booking
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check_in",
            bookingId: data.booking.id,
          }),
        });

        setShowWalkInModal(false);
        setWalkInName("");
        setWalkInPhone("");
        fetchStaffData();
      }
    } catch (err: any) {
      setWalkInError(err.message || "Network error");
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Handle Check-in
  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_in", bookingId }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchStaffData();
      } else {
        alert(data.error || "Check-in failed");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Handle Pause / Resume
  const handleTogglePause = async (sessionId: string) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_pause", sessionId }),
      });
      fetchStaffData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Handle Extend Session
  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendBooking) return;
    setExtendLoading(true);
    setExtendError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend",
          bookingId: extendBooking.id,
          additionalMinutes: extendMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtendError(data.error || "Failed to extend session");
      } else {
        setExtendBooking(null);
        fetchStaffData();
      }
    } catch (e: any) {
      setExtendError(e.message);
    } finally {
      setExtendLoading(false);
    }
  };

  // Handle End Session & Open Billing
  const handleEndSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBillSession({
          session: data.session,
          payment: data.payment,
        });
        setPaidAmount(data.payment.due_amount);
        fetchStaffData();
      } else {
        alert(data.error || "Failed to end session");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Handle Settle Payment
  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billSession?.payment) return;

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: billSession.payment.id,
          paidAmount,
          paymentMode,
          discountAmount,
          discountReason,
          addonAmount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveReceipt(data.payment);
        setBillSession(null);
        fetchStaffData();
      } else {
        alert(data.error || "Payment recording failed");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Trigger Automatic No-Show Release
  const handleProcessNoShows = async () => {
    try {
      const res = await fetch("/api/cron/no-show", { method: "POST" });
      const data = await res.json();
      setNoShowMessage(data.message);
      fetchStaffData();
      setTimeout(() => setNoShowMessage(null), 6000);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Search Customers
  const handleSearchCustomers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchedCustomers(data.customers || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Load customer full history
  const handleViewCustomerHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/customers?id=${id}`);
      const data = await res.json();
      setSelectedCustomerHistory(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Staff Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/staff-logout", { method: "POST" });
      window.location.href = "/staff/login";
    } catch {
      window.location.href = "/staff/login";
    }
  };

  // Key Dashboard Metrics
  const activeSessions = bookings.filter((b) => b.status === "in_play");
  const confirmedReservations = bookings.filter((b) => b.status === "confirmed");
  const completedToday = bookings.filter((b) => b.status === "completed");
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.payment?.paid_amount || 0), 0);
  const totalDues = bookings.reduce((sum, b) => sum + (b.payment?.due_amount || 0), 0);
  const occupancyRate = tables.length > 0 ? Math.round((activeSessions.length / tables.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-charcoal-deep text-ivory-warm selection:bg-emerald-600/30 selection:text-gold-300">
      {/* Top Navbar */}
      <header className="border-b border-border-subtle bg-charcoal-deep/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-surface border border-gold-400/40 flex items-center justify-center shadow-luxury-gold group-hover:border-gold-400 transition">
                <span className="font-display text-lg font-black text-gold-400 tracking-tighter">CC</span>
              </div>
              <span className="font-display text-xl font-bold text-ivory-warm">
                Cue<span className="text-gold-gradient">Club</span>
              </span>
            </Link>
            <span className="text-border-subtle font-light hidden sm:inline">|</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-400 bg-surface border border-gold-400/30 px-3 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5 shadow">
              <Shield className="w-3.5 h-3.5 text-gold-400" />
              <span>Operations Console</span>
            </span>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button
              onClick={handleProcessNoShows}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-xs font-semibold tracking-wide transition flex items-center gap-1.5 cursor-pointer"
              title="Release tables whose 10-minute grace period has elapsed"
            >
              <Timer className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Run No-Show Audit</span>
              <span className="sm:hidden">Audit</span>
            </button>

            <Link
              href="/staff/qr-codes"
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle hover:border-gold-400/40 text-ivory-muted hover:text-ivory-warm text-xs font-semibold tracking-wide transition flex items-center gap-1.5"
              title="Generate & print QR codes for table self-check-in"
            >
              <QrCode className="w-3.5 h-3.5 text-gold-400" />
              <span className="hidden sm:inline">QR Codes</span>
            </Link>

            <button
              onClick={() => {
                const firstAvail = tables.find((t) => t.status === "available");
                if (firstAvail) setWalkInTableId(firstAvail.id);
                setShowWalkInModal(true);
              }}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-ivory-warm text-xs font-bold tracking-wide shadow-luxury-emerald transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-gold-300" />
              <span>New Walk-in</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-ivory-muted hover:text-ivory-warm text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* No Show Alert Banner */}
      {noShowMessage && (
        <div className="bg-surface border-b border-gold-400/40 px-4 py-3 text-xs text-gold-300 text-center font-medium flex items-center justify-center gap-2 animate-fadeIn">
          <Clock className="w-4 h-4 text-gold-400" />
          <span>{noShowMessage}</span>
        </div>
      )}

      {/* Main Operations Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="card-elevated rounded-2xl p-4 border border-border-subtle space-y-1">
            <span className="text-[10px] text-ivory-muted uppercase tracking-wider font-semibold block">
              Active Sessions
            </span>
            <div className="font-display text-2xl font-bold text-cyan-300 flex items-center gap-1.5">
              <span>{activeSessions.length}</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <span className="text-[10px] text-ivory-muted/70 block">Live on tables</span>
          </div>

          <div className="card-elevated rounded-2xl p-4 border border-border-subtle space-y-1">
            <span className="text-[10px] text-ivory-muted uppercase tracking-wider font-semibold block">
              Upcoming Reserved
            </span>
            <div className="font-display text-2xl font-bold text-amber-300">
              {confirmedReservations.length}
            </div>
            <span className="text-[10px] text-ivory-muted/70 block">Awaiting check-in</span>
          </div>

          <div className="card-elevated rounded-2xl p-4 border border-border-subtle space-y-1">
            <span className="text-[10px] text-ivory-muted uppercase tracking-wider font-semibold block">
              Club Occupancy
            </span>
            <div className="font-display text-2xl font-bold text-gold-400">
              {occupancyRate}%
            </div>
            <span className="text-[10px] text-ivory-muted/70 block">{activeSessions.length} of {tables.length} tables</span>
          </div>

          <div className="card-elevated rounded-2xl p-4 border border-border-subtle space-y-1">
            <span className="text-[10px] text-ivory-muted uppercase tracking-wider font-semibold block">
              Completed Today
            </span>
            <div className="font-display text-2xl font-bold text-accent">
              {completedToday.length}
            </div>
            <span className="text-[10px] text-ivory-muted/70 block">Sessions billed</span>
          </div>

          <div className="card-elevated rounded-2xl p-4 border border-border-subtle space-y-1">
            <span className="text-[10px] text-ivory-muted uppercase tracking-wider font-semibold block">
              Revenue Collected
            </span>
            <div className="font-display text-2xl font-bold text-gold-400">
              ₹{totalRevenue}
            </div>
            <span className="text-[10px] text-ivory-muted/70 block">Cash / UPI / Card</span>
          </div>

          <div className="card-elevated rounded-2xl p-4 border border-border-subtle space-y-1">
            <span className="text-[10px] text-ivory-muted uppercase tracking-wider font-semibold block">
              Pending Dues
            </span>
            <div className={`font-display text-2xl font-bold ${totalDues > 0 ? "text-rose-400" : "text-accent"}`}>
              ₹{totalDues}
            </div>
            <span className="text-[10px] text-ivory-muted/70 block">Player balance</span>
          </div>
        </div>

        {/* Live Table Controls & Digital Timers */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-ivory-warm flex items-center gap-2">
                <span>Live Table Operations & Match Clocks</span>
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              </h2>
              <p className="text-xs text-ivory-muted">
                Control active table sessions, digital pause/resumes, playing extensions, and POS checkout settlements.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table) => {
              const activeBooking = bookings.find(
                (b) => b.table_id === table.id && b.status === "in_play"
              );
              const upcomingBooking = bookings
                .filter((b) => b.table_id === table.id && b.status === "confirmed")
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

              return (
                <div
                  key={table.id}
                  className={`card-elevated rounded-2xl p-5 flex flex-col justify-between border transition-all duration-300 ${
                    activeBooking
                      ? "border-cyan-800/80 shadow-luxury"
                      : upcomingBooking
                      ? "border-amber-800/80"
                      : table.status === "maintenance"
                      ? "border-rose-950/80 opacity-70"
                      : "border-border-subtle hover:border-emerald-700/80"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-ivory-muted px-2 py-0.5 rounded bg-charcoal-deep border border-border-subtle">
                          {table.table_type} • ₹{table.hourly_rate}/hr
                        </span>
                        <h3 className="font-display text-lg font-bold text-ivory-warm mt-2">{table.name}</h3>
                      </div>

                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 ${
                          activeBooking
                            ? "status-badge-inplay"
                            : upcomingBooking
                            ? "status-badge-reserved"
                            : table.status === "maintenance"
                            ? "status-badge-maintenance"
                            : "status-badge-available"
                        }`}
                      >
                        {activeBooking
                          ? "IN PLAY"
                          : upcomingBooking
                          ? "RESERVED"
                          : table.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Active Session details & Live Timer State */}
                    {activeBooking && activeBooking.session && (
                      <div className="mt-4 p-3.5 bg-charcoal-deep rounded-xl border border-cyan-950 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-ivory-muted">Player:</span>
                          <span className="font-bold text-ivory-warm">{activeBooking.customer?.full_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ivory-muted">Scheduled Slot:</span>
                          <span className="font-mono text-ivory-muted">
                            {activeBooking.duration_minutes}m (Ends{" "}
                            {new Date(activeBooking.end_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            )
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ivory-muted">Timer Status:</span>
                          <span
                            className={`font-bold flex items-center gap-1.5 ${
                              activeBooking.session.is_paused ? "text-amber-400" : "text-accent"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                activeBooking.session.is_paused ? "bg-amber-400" : "bg-accent animate-ping"
                              }`}
                            />
                            {activeBooking.session.is_paused ? "PAUSED" : "ACTIVE PLAY"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Upcoming booking details & Grace deadline */}
                    {!activeBooking && upcomingBooking && (
                      <div className="mt-4 p-3.5 bg-charcoal-deep rounded-xl border border-amber-950 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-ivory-muted">Reserved For:</span>
                          <span className="font-bold text-ivory-warm">{upcomingBooking.customer?.full_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ivory-muted">Start Slot:</span>
                          <span className="font-mono text-amber-300 font-semibold">
                            {new Date(upcomingBooking.start_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-rose-400 font-medium">Grace Deadline:</span>
                          <span className="font-mono text-rose-300 font-bold">
                            {new Date(upcomingBooking.grace_deadline!).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-4 border-t border-border-subtle flex flex-wrap gap-2">
                    {activeBooking && activeBooking.session && (
                      <>
                        <button
                          onClick={() => handleTogglePause(activeBooking.session!.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeBooking.session.is_paused
                              ? "bg-emerald-700 hover:bg-emerald-600 text-ivory-warm shadow"
                              : "bg-amber-700 hover:bg-amber-600 text-ivory-warm"
                          }`}
                        >
                          {activeBooking.session.is_paused ? (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setExtendBooking(activeBooking);
                            setExtendError(null);
                          }}
                          className="py-2 px-3.5 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-ivory-warm text-xs font-semibold transition cursor-pointer"
                        >
                          + Extend
                        </button>

                        <button
                          onClick={() => handleEndSession(activeBooking.session!.id)}
                          className="py-2 px-3.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-ivory-warm text-xs font-bold transition shadow cursor-pointer"
                        >
                          End & Bill
                        </button>
                      </>
                    )}

                    {!activeBooking && upcomingBooking && (
                      <button
                        onClick={() => handleCheckIn(upcomingBooking.id)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-ivory-warm font-bold text-xs tracking-wide shadow-luxury-emerald transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-gold-300" />
                        <span>Check-In & Start Match</span>
                      </button>
                    )}

                    {!activeBooking && !upcomingBooking && table.status === "available" && (
                      <button
                        onClick={() => {
                          setWalkInTableId(table.id);
                          setShowWalkInModal(true);
                        }}
                        className="w-full py-2.5 rounded-xl bg-surface hover:bg-surface-elevated border border-emerald-800/60 text-emerald-300 hover:text-emerald-200 font-semibold text-xs tracking-wide transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign Walk-In Session</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Master Reservations & Bookings Schedule */}
        <section className="card-elevated rounded-3xl p-6 sm:p-8 border border-border-subtle space-y-6">
          <div className="border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-ivory-warm flex items-center gap-2">
                <span>Master Bookings & Reservation Log</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-accent border border-emerald-800 font-semibold">
                  {bookings.filter((b) => b.status === "confirmed").length} Upcoming Confirmed
                </span>
              </h2>
              <p className="text-xs text-ivory-muted mt-0.5">
                Authoritative chronological record of all customer reservations, walk-ins, and session statuses.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: "confirmed", label: "Confirmed" },
                { id: "all", label: "All Bookings" },
                { id: "in_play", label: "In Play" },
                { id: "completed", label: "Completed" },
                { id: "no_show", label: "No-Shows" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBookingTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                    bookingTab === tab.id
                      ? "bg-gold-400 text-charcoal-deep shadow font-bold"
                      : "bg-surface text-ivory-muted hover:text-ivory-warm border border-border-subtle"
                  }`}
                >
                  {tab.label} (
                  {tab.id === "all"
                    ? bookings.length
                    : bookings.filter((b) => b.status === tab.id).length}
                  )
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-border-subtle rounded-2xl">
            <table className="w-full text-left text-xs text-ivory-muted">
              <thead className="bg-charcoal-deep text-ivory-warm uppercase text-[10px] tracking-wider border-b border-border-subtle">
                <tr>
                  <th className="p-3.5">Booking ID</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Table</th>
                  <th className="p-3.5">Scheduled Slot</th>
                  <th className="p-3.5">Duration & Bill</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {bookings
                  .filter((b) => (bookingTab === "all" ? true : b.status === bookingTab))
                  .sort(
                    (a, b) =>
                      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                  )
                  .map((b) => (
                    <tr key={b.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="p-3.5 font-mono text-[11px] text-gold-400/90 font-semibold">{b.id}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-ivory-warm">{b.customer?.full_name || "Guest"}</div>
                        <div className="text-[10px] text-ivory-muted font-mono">{b.customer?.phone}</div>
                      </td>
                      <td className="p-3.5 font-semibold text-ivory-warm">{b.table?.name || "Table"}</td>
                      <td className="p-3.5">
                        <div className="text-ivory-warm font-medium">
                          {new Date(b.start_time).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-[11px] text-gold-400 font-mono">
                          {new Date(b.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {new Date(b.end_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div>{b.duration_minutes} Mins</div>
                        <div className="font-bold text-gold-400">₹{b.estimated_price}</div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            b.status === "confirmed"
                              ? "status-badge-reserved"
                              : b.status === "in_play"
                              ? "status-badge-inplay"
                              : b.status === "completed"
                              ? "status-badge-available"
                              : "status-badge-maintenance"
                          }`}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {b.status === "confirmed" && (
                          <button
                            onClick={() => handleCheckIn(b.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-ivory-warm font-bold text-xs tracking-wide shadow transition cursor-pointer"
                          >
                            ✓ Check-In
                          </button>
                        )}
                        {b.status === "no_show" && (
                          <button
                            onClick={() => handleRestoreBooking(b.id)}
                            className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated border border-gold-400/40 text-gold-300 text-xs font-semibold transition cursor-pointer"
                            title="Restore booking after verifying slot availability"
                          >
                            ↺ Restore Booking
                          </button>
                        )}
                        {b.status === "in_play" && (
                          <span className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            Active on Table
                          </span>
                        )}
                        {b.status === "completed" && (
                          <span className="text-[11px] text-ivory-muted/70">Finished & Billed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {bookings.filter((b) => (bookingTab === "all" ? true : b.status === bookingTab)).length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-ivory-muted">
                      No bookings found under &quot;{bookingTab}&quot; category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Customer Directory & Full Visit Audit */}
        <section className="card-elevated rounded-3xl p-6 sm:p-8 border border-border-subtle space-y-6">
          <div className="border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-ivory-warm">
                Customer Database & Session Audit
              </h2>
              <p className="text-xs text-ivory-muted mt-0.5">
                Search customer profiles by name or phone to audit lifetime visits, playing hours, and outstanding dues.
              </p>
            </div>

            <form onSubmit={handleSearchCustomers} className="flex gap-2">
              <input
                type="text"
                placeholder="Search name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-ivory-warm placeholder-ivory-muted/40 focus:outline-none focus:border-gold-400 w-52 sm:w-64 transition"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gold-400 hover:bg-gold-300 text-charcoal-deep font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          {searchedCustomers.length > 0 && (
            <div className="overflow-x-auto border border-border-subtle rounded-2xl animate-fadeIn">
              <table className="w-full text-left text-xs text-ivory-muted">
                <thead className="bg-charcoal-deep text-ivory-warm uppercase text-[10px] tracking-wider border-b border-border-subtle">
                  <tr>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Phone</th>
                    <th className="p-3.5">Visits</th>
                    <th className="p-3.5">Total Play Time</th>
                    <th className="p-3.5">Total Spend</th>
                    <th className="p-3.5">Dues</th>
                    <th className="p-3.5">No-Shows</th>
                    <th className="p-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {searchedCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="p-3.5 font-bold text-ivory-warm">{c.full_name}</td>
                      <td className="p-3.5 font-mono">{c.phone}</td>
                      <td className="p-3.5 text-accent font-bold">{c.visit_count}</td>
                      <td className="p-3.5">{Math.round(c.total_playing_minutes / 60)} hrs</td>
                      <td className="p-3.5 font-bold text-gold-400">₹{c.total_spend}</td>
                      <td className="p-3.5">
                        <span className={`font-bold ${c.pending_dues > 0 ? "text-rose-400" : "text-ivory-muted"}`}>
                          ₹{c.pending_dues}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`font-semibold ${c.no_show_count > 0 ? "text-rose-400" : "text-ivory-muted"}`}>
                          {c.no_show_count}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleViewCustomerHistory(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated border border-gold-400/40 text-gold-300 text-xs font-semibold transition cursor-pointer"
                        >
                          View Full History →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedCustomerHistory && (
            <div className="rounded-2xl border border-gold-400/40 bg-surface p-6 space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-border-subtle pb-3">
                <h3 className="font-display text-base font-bold text-gold-300">
                  Session Log for {selectedCustomerHistory.customer?.full_name}
                </h3>
                <button
                  onClick={() => setSelectedCustomerHistory(null)}
                  className="text-xs text-ivory-muted hover:text-ivory-warm transition"
                >
                  ✕ Close Audit
                </button>
              </div>

              <div className="overflow-x-auto border border-border-subtle rounded-xl">
                <table className="w-full text-left text-xs text-ivory-muted">
                  <thead className="bg-charcoal-deep text-ivory-warm uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Table</th>
                      <th className="p-3">Booked / Actual</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Total Bill</th>
                      <th className="p-3">Receipt #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {selectedCustomerHistory.visits.map((v: any) => (
                      <tr key={v.booking.id} className="hover:bg-surface-elevated/40">
                        <td className="p-3">{new Date(v.booking.start_time).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold text-ivory-warm">{v.table?.name}</td>
                        <td className="p-3 font-mono">
                          {v.booking.duration_minutes}m / {v.session ? `${v.session.actual_minutes}m` : "--"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-charcoal-deep border border-border-subtle text-ivory-warm">
                            {v.booking.status}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-gold-400">
                          ₹{v.payment?.total_amount || v.booking.estimated_price}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-ivory-muted">
                          {v.payment?.receipt_id || "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Walk-in Creation Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 bg-charcoal-deep/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-elevated border border-border-subtle rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-luxury-gold animate-fadeIn">
            <div className="flex justify-between items-center border-b border-border-subtle pb-4">
              <div>
                <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider block">Direct Counter Desk</span>
                <h3 className="font-display text-lg font-bold text-ivory-warm">Immediate Walk-In Session</h3>
              </div>
              <button onClick={() => setShowWalkInModal(false)} className="text-ivory-muted hover:text-ivory-warm cursor-pointer">✕</button>
            </div>

            {walkInError && (
              <div className="p-3 text-xs text-rose-300 bg-rose-950/60 rounded-xl border border-rose-900/80">
                {walkInError}
              </div>
            )}

            <form onSubmit={handleCreateWalkIn} className="space-y-4 text-xs">
              <div>
                <label className="block text-ivory-warm font-semibold mb-1.5">Player Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sameer Kapoor"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2.5 text-ivory-warm focus:outline-none focus:border-gold-400 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-ivory-warm font-semibold mb-1.5">Player Mobile Number *</label>
                <input
                  type="tel"
                  placeholder="10-digit phone"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2.5 text-ivory-warm focus:outline-none focus:border-gold-400 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-ivory-warm font-semibold mb-1.5">Select Table Arena *</label>
                <select
                  value={walkInTableId}
                  onChange={(e) => setWalkInTableId(e.target.value)}
                  className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2.5 text-ivory-warm focus:outline-none focus:border-gold-400 transition cursor-pointer"
                  required
                >
                  <option value="">-- Choose Available Table --</option>
                  {tables
                    .filter((t) => t.status === "available")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.table_type.toUpperCase()}) — ₹{t.hourly_rate}/hr
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-ivory-warm font-semibold mb-1.5">Initial Duration</label>
                <select
                  value={walkInDuration}
                  onChange={(e) => setWalkInDuration(Number(e.target.value))}
                  className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2.5 text-ivory-warm focus:outline-none focus:border-gold-400 transition cursor-pointer"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes (1.5 Hours)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                </select>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="flex-1 py-3 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-ivory-muted hover:text-ivory-warm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkInSubmitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-ivory-warm font-bold tracking-wide shadow-luxury-emerald transition cursor-pointer"
                >
                  {walkInSubmitting ? "Starting..." : "Start Session Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Session Modal */}
      {extendBooking && (
        <div className="fixed inset-0 z-50 bg-charcoal-deep/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-elevated border border-border-subtle rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-luxury-gold animate-fadeIn">
            <div className="flex justify-between items-center border-b border-border-subtle pb-4">
              <h3 className="font-display text-base font-bold text-ivory-warm">Extend Playing Match Time</h3>
              <button onClick={() => setExtendBooking(null)} className="text-ivory-muted hover:text-ivory-warm cursor-pointer">✕</button>
            </div>

            {extendError && (
              <div className="p-3 text-xs text-rose-300 bg-rose-950/60 rounded-xl border border-rose-900/80">
                {extendError}
              </div>
            )}

            <form onSubmit={handleExtend} className="space-y-4 text-xs">
              <p className="text-ivory-muted">
                Extending arena table: <span className="font-bold text-ivory-warm">{extendBooking.table?.name}</span>
              </p>
              <div>
                <label className="block text-ivory-warm font-semibold mb-1.5">Additional Minutes</label>
                <select
                  value={extendMinutes}
                  onChange={(e) => setExtendMinutes(Number(e.target.value))}
                  className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2.5 text-ivory-warm focus:outline-none focus:border-gold-400 transition cursor-pointer"
                >
                  <option value={15}>+15 Minutes</option>
                  <option value={30}>+30 Minutes</option>
                  <option value={45}>+45 Minutes</option>
                  <option value={60}>+60 Minutes</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendBooking(null)}
                  className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-ivory-muted font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extendLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gold-400 hover:bg-gold-300 text-charcoal-deep font-bold transition cursor-pointer"
                >
                  {extendLoading ? "Checking..." : "Confirm Extension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill & POS Payment Settlement Modal */}
      {billSession && (
        <div className="fixed inset-0 z-50 bg-charcoal-deep/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-elevated border border-border-subtle rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-luxury-gold animate-fadeIn">
            <div className="flex justify-between items-center border-b border-border-subtle pb-4">
              <div>
                <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider block">POS Billing Desk</span>
                <h3 className="font-display text-lg font-bold text-ivory-warm">Itemized Match Checkout</h3>
              </div>
              <button onClick={() => setBillSession(null)} className="text-ivory-muted hover:text-ivory-warm cursor-pointer">✕</button>
            </div>

            {/* Bill Details */}
            <div className="bg-charcoal-deep rounded-2xl p-4 border border-border-subtle space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ivory-muted">Actual Time Played:</span>
                <span className="text-ivory-warm font-bold">{billSession.session.actual_minutes} Mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ivory-muted">Base Subtotal:</span>
                <span className="text-ivory-warm font-bold">₹{billSession.payment.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ivory-muted">GST (5%):</span>
                <span className="text-ivory-warm">₹{billSession.payment.tax_amount}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border-subtle text-sm">
                <span className="text-ivory-warm font-bold">Total Bill:</span>
                <span className="text-gold-400 font-display font-bold text-lg">₹{billSession.payment.total_amount}</span>
              </div>
            </div>

            <form onSubmit={handleSettlePayment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ivory-warm font-semibold mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3 py-2 text-ivory-warm"
                  />
                </div>
                <div>
                  <label className="block text-ivory-warm font-semibold mb-1">Add-ons / Food (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={addonAmount}
                    onChange={(e) => setAddonAmount(Number(e.target.value))}
                    className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3 py-2 text-ivory-warm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ivory-warm font-semibold mb-1.5">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["upi", "cash", "card"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 rounded-xl border font-bold uppercase text-[11px] transition cursor-pointer ${
                        paymentMode === mode
                          ? "bg-gold-400 text-charcoal-deep border-gold-400 shadow"
                          : "bg-charcoal-deep text-ivory-muted border-border-subtle hover:text-ivory-warm"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-ivory-warm font-semibold mb-1">Amount to Collect (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-full bg-charcoal-deep border border-border-subtle rounded-xl px-3.5 py-2.5 text-gold-400 font-bold text-base"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBillSession(null)}
                  className="flex-1 py-3 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-ivory-muted font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-ivory-warm font-bold tracking-wide shadow-luxury-emerald transition cursor-pointer"
                >
                  Collect & Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Printable Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-charcoal-deep/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-elevated border border-gold-400/50 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-luxury-gold animate-fadeIn">
            <div className="text-center space-y-1 border-b border-border-subtle pb-4">
              <div className="w-10 h-10 rounded-xl bg-charcoal-deep border border-gold-400/40 flex items-center justify-center mx-auto text-gold-400 font-display font-black text-sm">
                CC
              </div>
              <h3 className="font-display text-lg font-bold text-ivory-warm">CueClub Official Receipt</h3>
              <p className="text-[10px] uppercase tracking-widest text-gold-400/80">Grand Snooker & Pool Lounge</p>
              <div className="font-mono text-gold-400 text-xs font-bold pt-1">
                Receipt #{activeReceipt.receipt_id}
              </div>
            </div>

            <div className="text-xs space-y-2 text-ivory-muted">
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span className="text-ivory-warm">{new Date(activeReceipt.paid_at || Date.now()).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="uppercase font-bold text-ivory-warm">{activeReceipt.payment_mode}</span>
              </div>
              <div className="flex justify-between">
                <span>Session Subtotal:</span>
                <span>₹{activeReceipt.subtotal}</span>
              </div>
              {activeReceipt.discount_amount > 0 && (
                <div className="flex justify-between text-accent">
                  <span>Discount:</span>
                  <span>-₹{activeReceipt.discount_amount}</span>
                </div>
              )}
              {activeReceipt.addon_amount > 0 && (
                <div className="flex justify-between text-gold-400">
                  <span>Add-ons / Food:</span>
                  <span>+₹{activeReceipt.addon_amount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (5%):</span>
                <span>₹{activeReceipt.tax_amount}</span>
              </div>
              <div className="flex justify-between font-bold text-ivory-warm border-t border-border-subtle pt-2 text-sm">
                <span>Total Amount:</span>
                <span className="text-gold-400 font-display font-bold">₹{activeReceipt.total_amount}</span>
              </div>
              <div className="flex justify-between font-bold text-accent">
                <span>Amount Paid:</span>
                <span>₹{activeReceipt.paid_amount}</span>
              </div>
              {activeReceipt.due_amount > 0 && (
                <div className="flex justify-between font-bold text-rose-400">
                  <span>Remaining Due:</span>
                  <span>₹{activeReceipt.due_amount}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t border-border-subtle">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-ivory-warm font-semibold text-xs transition cursor-pointer"
              >
                🖨️ Print Receipt
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-ivory-warm font-bold text-xs tracking-wide shadow-luxury-emerald transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Phone,
  Hash,
  User,
  Timer,
  Smartphone,
  UserPlus,
} from "lucide-react";

// ─── Types ───
interface TableInfo {
  id: string;
  name: string;
  table_type: string;
  status: string;
  hourly_rate: number;
}

interface CheckInSession {
  id: string;
  actual_start: string;
  table_name: string;
  table_type: string;
  booking_end_time: string;
  duration_minutes: number;
}

// ─── Check-In Mode ───
type CheckInMode = "select" | "reservation" | "walkin";

// ─── Elapsed Timer ───
function ElapsedTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    function update() {
      const start = new Date(startTime).getTime();
      const diff = Math.max(0, Date.now() - start);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  return <span className="tabular-nums font-semibold">{elapsed}</span>;
}

// ─── Main Check-In Page ───
export default function CheckInPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableId = params.tableId as string;

  // ─── State ───
  const [mode, setMode] = useState<CheckInMode>("select");
  const [table, setTable] = useState<TableInfo | null>(null);
  const [clubName, setClubName] = useState("CueClub");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [session, setSession] = useState<CheckInSession | null>(null);
  const [customerName, setCustomerName] = useState("");

  // Reservation form
  const [bookingId, setBookingId] = useState(searchParams.get("bookingId") || "");
  const [phone, setPhone] = useState("");

  // Walk-in form
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInDuration, setWalkInDuration] = useState(60);

  // ─── Fetch table info ───
  const fetchTableInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin?tableId=${encodeURIComponent(tableId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load table information.");
        return;
      }
      setTable(data.table);
      setClubName(data.clubName || "CueClub");
      setPendingCount(data.pendingBookingCount || 0);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchTableInfo();
  }, [fetchTableInfo]);

  // ─── Reservation check-in ───
  async function handleReservationCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          bookingId: bookingId.trim(),
          customerPhone: phone.trim(),
          tableId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Check-in failed.");
        return;
      }

      setSession(data.session);
      setCustomerName(data.customerName || "");
      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Walk-in check-in ───
  async function handleWalkInCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "walk_in",
          tableId,
          customerName: walkInName.trim(),
          customerPhone: walkInPhone.trim(),
          durationMinutes: walkInDuration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Walk-in check-in failed.");
        return;
      }

      setSession(data.session);
      setCustomerName(data.customerName || walkInName);
      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0E0C]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#D7BC83] animate-spin mx-auto mb-4" />
          <p className="text-[#A7AEA6] text-sm">Loading table information…</p>
        </div>
      </div>
    );
  }

  // ─── Error State (no table found) ───
  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0E0C] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#19221B] border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="font-display text-xl text-[#F4F0E6] mb-2">Invalid Table</h1>
          <p className="text-[#A7AEA6] text-sm leading-relaxed">{error || "This QR code doesn't match any table."}</p>
        </div>
      </div>
    );
  }

  // ─── Success State ───
  if (success && session) {
    return (
      <div className="min-h-screen bg-[#0B0E0C] px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#0C7049]/20 border-2 border-[#30BD83]/50 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#30BD83]" />
            </div>
            <h1 className="font-display text-2xl text-[#F4F0E6] mb-2">Check-In Successful</h1>
            <p className="text-[#A7AEA6] text-sm">Your session is now active</p>
          </div>

          {/* Session Card */}
          <div className="bg-[#19221B] border border-[#303A31] rounded-lg overflow-hidden">
            {/* Club Header */}
            <div className="px-5 py-4 border-b border-[#303A31] bg-[#111A14]">
              <p className="font-display text-xs tracking-[0.2em] text-[#D7BC83] uppercase">{clubName}</p>
            </div>

            {/* Session Details */}
            <div className="p-5 space-y-4">
              {customerName && (
                <div className="flex items-center justify-between">
                  <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Guest</span>
                  <span className="text-[#F4F0E6] text-sm font-medium">{customerName}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Table</span>
                <span className="text-[#F4F0E6] text-sm font-medium">{session.table_name}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Type</span>
                <span className="text-[#F4F0E6] text-sm font-medium capitalize">{session.table_type}</span>
              </div>

              <div className="hairline-separator" />

              <div className="flex items-center justify-between">
                <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Started At</span>
                <span className="text-[#F4F0E6] text-sm font-medium tabular-nums">
                  {new Date(session.actual_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Ends At</span>
                <span className="text-[#F4F0E6] text-sm font-medium tabular-nums">
                  {new Date(session.booking_end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Duration</span>
                <span className="text-[#F4F0E6] text-sm font-medium">{session.duration_minutes} min</span>
              </div>

              <div className="hairline-separator" />

              {/* Live Timer */}
              <div className="bg-[#111A14] rounded-lg p-4 text-center border border-[#303A31]">
                <p className="text-[#A7AEA6] text-xs uppercase tracking-wider mb-2">Session Elapsed</p>
                <div className="text-3xl text-[#30BD83] font-display">
                  <ElapsedTimer startTime={session.actual_start} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#303A31] bg-[#111A14]">
              <p className="text-[#A7AEA6] text-xs text-center leading-relaxed">
                Enjoy your game! Session timing is managed by the club.
                <br />Please see staff when you finish.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Mode Selection ───
  if (mode === "select") {
    return (
      <div className="min-h-screen bg-[#0B0E0C] px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="font-display text-xs tracking-[0.25em] text-[#D7BC83] uppercase mb-3">{clubName}</p>
            <h1 className="font-display text-2xl text-[#F4F0E6] mb-2">Self Check-In</h1>
            <div className="hairline-separator my-4 max-w-[120px] mx-auto" />
          </div>

          {/* Table Info Card */}
          <div className="bg-[#19221B] border border-[#303A31] rounded-lg p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${table.table_type === "snooker" ? "felt-snooker" : "felt-pool"}`}>
                <span className="text-white text-xs font-bold uppercase">{table.table_type === "snooker" ? "SNK" : "POL"}</span>
              </div>
              <div>
                <h2 className="text-[#F4F0E6] font-medium text-base">{table.name}</h2>
                <p className="text-[#A7AEA6] text-xs capitalize">
                  {table.table_type} · ₹{table.hourly_rate}/hr
                </p>
              </div>
            </div>

            {table.status === "in_play" && (
              <div className="mt-3 px-3 py-2 bg-[#3D2913]/40 border border-[#D99B43]/30 rounded text-xs text-[#E2AB59]">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                This table is currently in use.
              </div>
            )}

            {table.status === "maintenance" && (
              <div className="mt-3 px-3 py-2 bg-[#232624]/50 border border-[#6B756E]/30 rounded text-xs text-[#9AA39C]">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                This table is under maintenance.
              </div>
            )}
          </div>

          {/* Check-In Options */}
          <div className="space-y-3">
            <button
              onClick={() => setMode("reservation")}
              className="w-full bg-[#19221B] hover:bg-[#1E2A20] border border-[#303A31] hover:border-[#0C7049]/50 rounded-lg p-5 text-left transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-[#0C7049]/15 border border-[#0C7049]/30 flex items-center justify-center group-hover:bg-[#0C7049]/25 transition-colors">
                  <Smartphone className="w-5 h-5 text-[#30BD83]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#F4F0E6] font-medium text-sm mb-0.5">I Have a Reservation</h3>
                  <p className="text-[#A7AEA6] text-xs">Check in with your booking reference</p>
                </div>
              </div>
              {pendingCount > 0 && (
                <div className="mt-3 text-xs text-[#30BD83]">
                  {pendingCount} pending reservation{pendingCount > 1 ? "s" : ""} for this table
                </div>
              )}
            </button>

            <button
              onClick={() => setMode("walkin")}
              disabled={table.status === "in_play" || table.status === "maintenance"}
              className="w-full bg-[#19221B] hover:bg-[#1E2A20] border border-[#303A31] hover:border-[#D7BC83]/30 rounded-lg p-5 text-left transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#19221B] disabled:hover:border-[#303A31]"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-[#D7BC83]/10 border border-[#D7BC83]/20 flex items-center justify-center group-hover:bg-[#D7BC83]/15 transition-colors">
                  <UserPlus className="w-5 h-5 text-[#D7BC83]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#F4F0E6] font-medium text-sm mb-0.5">Walk-In</h3>
                  <p className="text-[#A7AEA6] text-xs">Start playing without a reservation</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Reservation Check-In Form ───
  if (mode === "reservation") {
    return (
      <div className="min-h-screen bg-[#0B0E0C] px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <button
            onClick={() => { setMode("select"); setError(""); }}
            className="flex items-center gap-2 text-[#A7AEA6] hover:text-[#F4F0E6] text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center mb-6">
            <p className="font-display text-xs tracking-[0.25em] text-[#D7BC83] uppercase mb-2">{clubName}</p>
            <h1 className="font-display text-xl text-[#F4F0E6] mb-1">Reservation Check-In</h1>
            <p className="text-[#A7AEA6] text-xs">{table.name}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleReservationCheckIn} className="space-y-4">
            {/* Booking Reference */}
            <div>
              <label className="block text-[#A7AEA6] text-xs uppercase tracking-wider mb-2">
                Booking Reference
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7AEA6]" />
                <input
                  type="text"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="e.g. book-1729250400000-ab12"
                  required
                  autoFocus
                  className="w-full bg-[#111A14] border border-[#303A31] rounded-lg pl-10 pr-4 py-3 text-[#F4F0E6] text-sm placeholder:text-[#4A5550] focus:border-[#0C7049] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-[#A7AEA6] text-xs uppercase tracking-wider mb-2">
                Registered Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7AEA6]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  className="w-full bg-[#111A14] border border-[#303A31] rounded-lg pl-10 pr-4 py-3 text-[#F4F0E6] text-sm placeholder:text-[#4A5550] focus:border-[#0C7049] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#0C7049] hover:bg-[#0A5F3E] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Verify & Check In
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-[#A7AEA6] text-xs text-center leading-relaxed">
            Your booking reference was provided when you made the reservation.
            <br />
            Can&apos;t find it? Ask the staff for assistance.
          </p>
        </div>
      </div>
    );
  }

  // ─── Walk-In Form ───
  return (
    <div className="min-h-screen bg-[#0B0E0C] px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <button
          onClick={() => { setMode("select"); setError(""); }}
          className="flex items-center gap-2 text-[#A7AEA6] hover:text-[#F4F0E6] text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-center mb-6">
          <p className="font-display text-xs tracking-[0.25em] text-[#D7BC83] uppercase mb-2">{clubName}</p>
          <h1 className="font-display text-xl text-[#F4F0E6] mb-1">Walk-In Check-In</h1>
          <p className="text-[#A7AEA6] text-xs">{table.name}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleWalkInCheckIn} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[#A7AEA6] text-xs uppercase tracking-wider mb-2">
              Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7AEA6]" />
              <input
                type="text"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Full name"
                required
                autoFocus
                className="w-full bg-[#111A14] border border-[#303A31] rounded-lg pl-10 pr-4 py-3 text-[#F4F0E6] text-sm placeholder:text-[#4A5550] focus:border-[#0C7049] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[#A7AEA6] text-xs uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7AEA6]" />
              <input
                type="tel"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                placeholder="10-digit mobile number"
                required
                pattern="[0-9]{10}"
                maxLength={10}
                className="w-full bg-[#111A14] border border-[#303A31] rounded-lg pl-10 pr-4 py-3 text-[#F4F0E6] text-sm placeholder:text-[#4A5550] focus:border-[#0C7049] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[#A7AEA6] text-xs uppercase tracking-wider mb-2">
              Playing Time
            </label>
            <div className="relative">
              <Timer className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7AEA6]" />
              <select
                value={walkInDuration}
                onChange={(e) => setWalkInDuration(Number(e.target.value))}
                className="w-full bg-[#111A14] border border-[#303A31] rounded-lg pl-10 pr-4 py-3 text-[#F4F0E6] text-sm focus:border-[#0C7049] focus:outline-none transition-colors appearance-none"
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>4 hours</option>
              </select>
            </div>
          </div>

          {/* Pricing estimate */}
          <div className="bg-[#111A14] border border-[#303A31] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[#A7AEA6] text-xs uppercase tracking-wider">Estimated Cost</span>
              <span className="text-[#D7BC83] text-lg font-medium tabular-nums">
                ₹{Math.round((table.hourly_rate * walkInDuration) / 60)}
              </span>
            </div>
            <p className="text-[#A7AEA6] text-xs mt-1">
              ₹{table.hourly_rate}/hr · Final bill based on actual playing time
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#D7BC83] hover:bg-[#C4A870] text-[#0B0E0C] font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Session…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Start Playing
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-[#A7AEA6] text-xs text-center leading-relaxed">
          Walk-in bookings are subject to table availability.
          <br />
          Payment is settled at the end of your session.
        </p>
      </div>
    </div>
  );
}

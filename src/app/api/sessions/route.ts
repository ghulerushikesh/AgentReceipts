import { NextResponse } from "next/server";
import { CueClubStore } from "@/lib/store";
import { getStaffSessionFromCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // Require authenticated staff or owner session
    const staffSession = getStaffSessionFromCookie(req.headers.get("cookie"));
    if (!staffSession) {
      return NextResponse.json({ error: "Unauthorized: Staff login required for session management" }, { status: 401 });
    }

    const body = await req.json();
    const { action, bookingId, sessionId, additionalMinutes } = body;

    if (action === "check_in") {
      if (!bookingId) return NextResponse.json({ error: "bookingId required for check-in" }, { status: 400 });
      const res = CueClubStore.checkInBooking(bookingId);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ session: res.session });
    }

    if (action === "toggle_pause") {
      if (!sessionId) return NextResponse.json({ error: "sessionId required for toggle_pause" }, { status: 400 });
      const res = CueClubStore.togglePauseSession(sessionId);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ session: res.session });
    }

    if (action === "extend") {
      if (!bookingId || !additionalMinutes) {
        return NextResponse.json({ error: "bookingId and additionalMinutes required for extend" }, { status: 400 });
      }
      const res = CueClubStore.extendSession(bookingId, Number(additionalMinutes));
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 409 });
      return NextResponse.json({ success: true });
    }

    if (action === "end") {
      if (!sessionId) return NextResponse.json({ error: "sessionId required for end" }, { status: 400 });
      const res = CueClubStore.endSession(sessionId);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ session: res.session, payment: res.payment });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

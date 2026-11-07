import { NextResponse } from "next/server";
import { CueClubStore } from "@/lib/store";

export async function GET() {
  try {
    const bookings = CueClubStore.getBookings();
    return NextResponse.json({ bookings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, customerEmail, tableId, startTime, durationMinutes, bookingType, notes } = body;

    if (!customerName || !customerPhone || !tableId || !startTime || !durationMinutes) {
      return NextResponse.json(
        { error: "Missing required fields: customerName, customerPhone, tableId, startTime, durationMinutes" },
        { status: 400 }
      );
    }

    const result = CueClubStore.createBooking({
      customerName,
      customerPhone,
      customerEmail,
      tableId,
      startTime,
      durationMinutes: Number(durationMinutes),
      bookingType: bookingType || "reservation",
      notes,
    });

    if (!result.success) {
      // 409 Conflict status code for booking collision
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ booking: result.booking }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { getStaffSessionFromCookie } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const staffSession = getStaffSessionFromCookie(req.headers.get("cookie"));
    if (!staffSession) {
      return NextResponse.json({ error: "Unauthorized: Staff login required to modify bookings" }, { status: 401 });
    }

    const body = await req.json();
    const { action, bookingId } = body;

    if (action === "restore" || action === "reinstate") {
      const res = CueClubStore.restoreBooking(bookingId);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 409 });
      return NextResponse.json({ booking: res.booking });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

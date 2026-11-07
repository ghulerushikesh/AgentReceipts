import { NextResponse, NextRequest } from "next/server";
import { CueClubStore } from "@/lib/store";

/**
 * GET /api/checkin?tableId=table-s1
 * Public endpoint: returns table info and count of pending bookings.
 * Does NOT expose customer PII.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get("tableId");

    if (!tableId) {
      return NextResponse.json({ error: "tableId query parameter is required." }, { status: 400 });
    }

    const tables = CueClubStore.getTables();
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      return NextResponse.json({ error: "Table not found." }, { status: 404 });
    }

    const settings = CueClubStore.getSettings();

    // Count pending bookings for this table (confirmed, not yet checked in)
    const bookings = CueClubStore.getBookings();
    const now = new Date();
    const pendingBookings = bookings.filter(
      (b) =>
        b.table_id === tableId &&
        b.status === "confirmed" &&
        new Date(b.end_time) > now
    );

    return NextResponse.json({
      table: {
        id: table.id,
        name: table.name,
        table_type: table.table_type,
        status: table.status,
        hourly_rate: table.hourly_rate,
      },
      pendingBookingCount: pendingBookings.length,
      clubName: settings.club_name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/checkin
 * Public endpoint for QR self-check-in.
 *
 * Actions:
 *   "verify" — Verify booking ownership and check in
 *   "walk_in" — Create a walk-in booking and immediately check in
 *
 * SECURITY NOTE (Development):
 * Customer identity is verified using booking reference + phone number.
 * This is a reasonable development solution. A production system should use
 * proper authentication (OTP, OAuth, etc.) for stronger identity verification.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "verify") {
      return handleVerifyAndCheckIn(body);
    }

    if (action === "walk_in") {
      return handleWalkInCheckIn(body);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Verify booking ownership and perform check-in.
 */
function handleVerifyAndCheckIn(body: {
  bookingId?: string;
  customerPhone?: string;
  tableId?: string;
}) {
  const { bookingId, customerPhone, tableId } = body;

  if (!bookingId || !customerPhone || !tableId) {
    return NextResponse.json(
      { error: "bookingId, customerPhone, and tableId are all required." },
      { status: 400 }
    );
  }

  const data = CueClubStore.getData();

  // 1. Find booking
  const booking = data.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found. Please check your booking reference." },
      { status: 404 }
    );
  }

  // 2. Verify customer phone matches
  const cleanInputPhone = customerPhone.trim().replace(/\D/g, "").slice(-10);
  const customer = data.profiles.find((p) => p.id === booking.customer_id);
  if (!customer) {
    return NextResponse.json(
      { error: "Customer record not found." },
      { status: 404 }
    );
  }

  const customerCleanPhone = customer.phone.trim().replace(/\D/g, "").slice(-10);
  if (cleanInputPhone !== customerCleanPhone) {
    return NextResponse.json(
      { error: "Phone number does not match the booking. Please verify your details." },
      { status: 403 }
    );
  }

  // 3. Verify table matches the scanned QR
  if (booking.table_id !== tableId) {
    const bookingTable = data.tables.find((t) => t.id === booking.table_id);
    return NextResponse.json(
      {
        error: `This booking is for ${bookingTable?.name || "a different table"}. Please scan the correct table's QR code.`,
      },
      { status: 400 }
    );
  }

  // 4. Validate booking status
  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "This booking has been cancelled." },
      { status: 400 }
    );
  }
  if (booking.status === "no_show") {
    return NextResponse.json(
      { error: "This booking was marked as a no-show. Please contact the staff." },
      { status: 400 }
    );
  }
  if (booking.status === "completed") {
    return NextResponse.json(
      { error: "This booking has already been completed." },
      { status: 400 }
    );
  }
  if (booking.status === "in_play" || booking.status === "checked_in") {
    return NextResponse.json(
      { error: "You have already checked in for this booking." },
      { status: 409 }
    );
  }

  // 5. Validate grace deadline
  const now = new Date();
  if (booking.grace_deadline && new Date(booking.grace_deadline) < now) {
    return NextResponse.json(
      { error: "The check-in window for this booking has expired. Please contact the staff." },
      { status: 400 }
    );
  }

  // 6. Perform check-in using existing store logic
  const result = CueClubStore.checkInBooking(bookingId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 7. Return success with safe info (no full customer details)
  const table = data.tables.find((t) => t.id === tableId);
  return NextResponse.json({
    success: true,
    message: "Check-in successful! Your session has started.",
    session: {
      id: result.session!.id,
      actual_start: result.session!.actual_start,
      table_name: table?.name || "",
      table_type: table?.table_type || "",
      booking_end_time: booking.end_time,
      duration_minutes: booking.duration_minutes,
    },
    customerName: customer.full_name,
  });
}

/**
 * Walk-in QR Check-In:
 * Customer scans QR, has no booking, creates a walk-in and immediately checks in.
 */
function handleWalkInCheckIn(body: {
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
  durationMinutes?: number;
}) {
  const { tableId, customerName, customerPhone, durationMinutes } = body;

  if (!tableId || !customerName || !customerPhone) {
    return NextResponse.json(
      { error: "tableId, customerName, and customerPhone are required for walk-in." },
      { status: 400 }
    );
  }

  const duration = durationMinutes || 60; // Default 1 hour

  // Create walk-in booking
  const bookingResult = CueClubStore.createBooking({
    customerName,
    customerPhone,
    tableId,
    startTime: new Date().toISOString(),
    durationMinutes: duration,
    bookingType: "walk_in",
    notes: "Walk-in via QR self-check-in",
  });

  if (!bookingResult.success) {
    return NextResponse.json({ error: bookingResult.error }, { status: 400 });
  }

  // Immediately check in
  const checkInResult = CueClubStore.checkInBooking(bookingResult.booking!.id);
  if (!checkInResult.success) {
    return NextResponse.json({ error: checkInResult.error }, { status: 400 });
  }

  const data = CueClubStore.getData();
  const table = data.tables.find((t) => t.id === tableId);

  return NextResponse.json({
    success: true,
    message: "Walk-in check-in successful! Your session has started.",
    bookingId: bookingResult.booking!.id,
    session: {
      id: checkInResult.session!.id,
      actual_start: checkInResult.session!.actual_start,
      table_name: table?.name || "",
      table_type: table?.table_type || "",
      booking_end_time: bookingResult.booking!.end_time,
      duration_minutes: duration,
    },
    customerName,
  });
}

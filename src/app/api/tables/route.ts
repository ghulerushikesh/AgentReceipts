import { NextResponse } from "next/server";
import { CueClubStore } from "@/lib/store";

export async function GET() {
  try {
    const tables = CueClubStore.getTables();
    const settings = CueClubStore.getSettings();
    const bookings = CueClubStore.getBookings();

    // Compute next available time for each table
    const now = new Date();
    const enrichedTables = tables.map((t) => {
      // Find active or upcoming booking
      const upcoming = bookings
        .filter((b) => b.table_id === t.id && !["cancelled", "no_show", "completed"].includes(b.status))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const current = upcoming.find((b) => {
        const s = new Date(b.start_time);
        const e = new Date(b.end_time);
        return now >= s && now < e;
      });

      let calculatedStatus = t.status;
      let nextAvailable = "Now";

      if (t.status === "maintenance") {
        nextAvailable = "Under Maintenance";
      } else if (current) {
        calculatedStatus = current.status === "in_play" ? "in_play" : "reserved";
        nextAvailable = new Date(current.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (upcoming.length > 0) {
        nextAvailable = `Until ${new Date(upcoming[0].start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }

      return {
        ...t,
        status: calculatedStatus,
        next_available: nextAvailable,
        current_booking: current || null,
        upcoming_count: upcoming.length,
      };
    });

    return NextResponse.json({ tables: enrichedTables, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { getStaffSessionFromCookie } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const staffSession = getStaffSessionFromCookie(req.headers.get("cookie"));
    if (!staffSession) {
      return NextResponse.json({ error: "Unauthorized: Staff login required to modify table configuration" }, { status: 401 });
    }

    const body = await req.json();
    const { tableId, status } = body;
    if (!tableId || !status) {
      return NextResponse.json({ error: "tableId and status are required" }, { status: 400 });
    }

    const updated = CueClubStore.updateTableStatus(tableId, status);
    return NextResponse.json({ table: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

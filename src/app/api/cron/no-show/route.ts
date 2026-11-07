import { NextResponse } from "next/server";
import { CueClubStore } from "@/lib/store";

export async function POST() {
  try {
    const result = CueClubStore.processNoShows();
    return NextResponse.json({
      success: true,
      processed_count: result.count,
      booking_ids: result.processed,
      message:
        result.count > 0
          ? `Processed ${result.count} no-show booking(s). Tables released immediately.`
          : "No expired grace periods found.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}

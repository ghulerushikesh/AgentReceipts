import { NextResponse } from "next/server";
import { CueClubStore } from "@/lib/store";
import { getStaffSessionFromCookie } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("id");
    const query = searchParams.get("q")?.toLowerCase();

    // Browsing the entire customer directory requires staff authorization
    if (!customerId && !query) {
      const staffSession = getStaffSessionFromCookie(req.headers.get("cookie"));
      if (!staffSession) {
        return NextResponse.json({ error: "Unauthorized: Staff login required to browse customer directory" }, { status: 401 });
      }
    }

    if (customerId) {
      const history = CueClubStore.getCustomerHistory(customerId);
      return NextResponse.json(history);
    }

    const profiles = CueClubStore.getProfiles();
    let filtered = profiles.filter((p) => p.role === "customer");

    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(query) ||
          p.phone.includes(query) ||
          (p.email && p.email.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({ customers: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

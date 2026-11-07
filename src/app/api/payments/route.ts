import { NextResponse } from "next/server";
import { CueClubStore } from "@/lib/store";
import { getStaffSessionFromCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const staffSession = getStaffSessionFromCookie(req.headers.get("cookie"));
    if (!staffSession) {
      return NextResponse.json({ error: "Unauthorized: Staff login required for billing and payment recording" }, { status: 401 });
    }

    const body = await req.json();
    const { paymentId, paidAmount, paymentMode, discountAmount, discountReason, addonAmount, notes } = body;

    if (!paymentId || paidAmount === undefined || !paymentMode) {
      return NextResponse.json({ error: "paymentId, paidAmount, paymentMode are required" }, { status: 400 });
    }

    const res = CueClubStore.recordPayment({
      paymentId,
      paidAmount: Number(paidAmount),
      paymentMode,
      discountAmount: discountAmount ? Number(discountAmount) : 0,
      discountReason,
      addonAmount: addonAmount ? Number(addonAmount) : 0,
      notes,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ payment: res.payment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

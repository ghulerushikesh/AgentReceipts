import { NextResponse } from "next/server";
import { getStaffSessionFromCookie, AuthConfigurationError } from "@/lib/auth";

export async function GET(req: Request) {
  let session;
  try {
    session = getStaffSessionFromCookie(req.headers.get("cookie"));
  } catch (err) {
    if (err instanceof AuthConfigurationError) return NextResponse.json({ authenticated: false, error: err.message }, { status: 503 });
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}

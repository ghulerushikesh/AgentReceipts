import { NextResponse } from "next/server";
import { authenticateStaff, signSession, COOKIE_NAME, AuthConfigurationError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emailOrPhone, password } = body;

    if (!emailOrPhone || !password) {
      return NextResponse.json({ error: "Email/Phone and password are required" }, { status: 400 });
    }

    const user = authenticateStaff(emailOrPhone, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials or unauthorized account" }, { status: 401 });
    }

    // Issue 24-hour signed session token
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const token = signSession({
      userId: user.id,
      email: user.email || "",
      name: user.full_name,
      role: user.role as "staff" | "owner",
      issuedAt: now,
      expiresAt,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });

    // Set secure HTTP-only cookie (secure on production HTTPS, false on local HTTP)
    const isLocalhost = req.url.includes("localhost") || req.url.includes("127.0.0.1");
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !isLocalhost,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (err: any) {
    if (err instanceof AuthConfigurationError) return NextResponse.json({ error: err.message }, { status: 503 });
    console.error("Staff login failed due to a server error.");
    return NextResponse.json({ error: "Unable to authenticate at this time." }, { status: 500 });
  }
}

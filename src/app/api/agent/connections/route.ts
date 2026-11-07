import { NextRequest, NextResponse } from "next/server";
import {
  getAllAgentConnections,
  getAgentConnectionForAccount,
  registerAgentConnection,
  getAgentEventsForAccount,
} from "@/lib/agent-store";

export const dynamic = "force-dynamic";

function getWebhookSecret(): string | null {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  return secret && secret.trim().length >= 32 ? secret : null;
}

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authHeader = request.headers.get("authorization");
  const xSecret = request.headers.get("x-agent-secret");

  if (xSecret && xSecret === secret) return true;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim() === secret;
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const secret = getWebhookSecret();
    if (!secret) return NextResponse.json({ success: false, error: "Agent webhook authentication is not configured." }, { status: 503 });
    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account");

    const allConnections = getAllAgentConnections();

    if (account) {
      const cleanAccount = account.trim().toLowerCase();
      const connection = getAgentConnectionForAccount(cleanAccount);
      const events = getAgentEventsForAccount(cleanAccount);

      return NextResponse.json({
        success: true,
        account: cleanAccount,
        connectionStatus: connection ? "AGENT_CONNECTED" : "ACCOUNT_MONITORED",
        connection: connection || {
          agentId: "unconnected",
          agentName: "No agent connected",
          accountId: cleanAccount,
          network: "NEAR Testnet",
          status: "MONITORED_ONLY",
          lastSyncAt: null,
          registeredAt: null,
          totalReportedEvents: 0,
          description: "This public NEAR account is monitored from on-chain indexer records, but has not connected an agent runner runtime log integration.",
        },
        reportedEventsCount: events.length,
      });
    }

    return NextResponse.json({
      success: true,
      connections: allConnections,
      webhookConfig: {
        endpoint: "/api/agent/events",
        expectedHeader: "Authorization: Bearer <AGENT_WEBHOOK_SECRET> or X-Agent-Secret",
        authConfigured: true,
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/agent/connections:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load agent connections" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = getWebhookSecret();
    if (!secret) return NextResponse.json({ success: false, error: "Agent webhook authentication is not configured." }, { status: 503 });
    if (!isAuthorized(request, secret)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid secret required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { agentId, agentName, accountId, network = "NEAR Testnet", description } = body;
    if (network !== "NEAR Testnet" && network !== "testnet") return NextResponse.json({ success: false, error: "Only NEAR Testnet connections are supported." }, { status: 400 });

    if (!agentId || !agentName || !accountId) {
      return NextResponse.json(
        { success: false, error: "Fields 'agentId', 'agentName', and 'accountId' are required." },
        { status: 400 }
      );
    }

    const updated = registerAgentConnection({
      agentId,
      agentName,
      accountId,
      network,
      status: "CONNECTED",
      lastSyncAt: new Date().toISOString(),
      description,
    });

    return NextResponse.json({
      success: true,
      connection: updated,
    });
  } catch (err: any) {
    console.error("Error in POST /api/agent/connections:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to register connection" },
      { status: 500 }
    );
  }
}

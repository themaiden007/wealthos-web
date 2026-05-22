import { NextRequest, NextResponse } from "next/server";
import { getPlaidClient, getPlaidCountryCodes, getPlaidProducts } from "@/lib/plaid";
import { createAuthSupabaseClient } from "@/lib/serverSupabase";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 }
      );
    }

    const authSupabase = createAuthSupabaseClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unable to authenticate user." },
        { status: 401 }
      );
    }

    const plaidClient = getPlaidClient();

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user.id,
      },
      client_name: process.env.PLAID_CLIENT_NAME || "WealthOS",
      products: getPlaidProducts(),
      country_codes: getPlaidCountryCodes(),
      language: "en",
    });

    return NextResponse.json({
      link_token: response.data.link_token,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create link token.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
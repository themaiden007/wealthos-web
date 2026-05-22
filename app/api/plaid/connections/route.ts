import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/serverSupabase";

export async function GET(request: NextRequest) {
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

    const serverSupabase = createServerSupabaseClient();

    const { data: items, error: itemsError } = await serverSupabase
      .from("plaid_items")
      .select(
        "id, plaid_item_id, institution_id, institution_name, products, is_active, last_synced_at, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const { data: accounts, error: accountsError } = await serverSupabase
      .from("plaid_accounts")
      .select("plaid_item_id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (accountsError) {
      return NextResponse.json(
        { error: accountsError.message },
        { status: 500 }
      );
    }

    const accountCounts = new Map<string, number>();

    (accounts || []).forEach((account) => {
      const itemId = String(account.plaid_item_id);
      accountCounts.set(itemId, (accountCounts.get(itemId) || 0) + 1);
    });

    return NextResponse.json({
      connections: (items || []).map((item) => ({
        id: item.id,
        plaid_item_id: item.plaid_item_id,
        institution_id: item.institution_id,
        institution_name: item.institution_name || "Connected Institution",
        products: item.products || [],
        account_count: accountCounts.get(String(item.id)) || 0,
        last_synced_at: item.last_synced_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load connections.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
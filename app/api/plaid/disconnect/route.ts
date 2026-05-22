import { NextRequest, NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import {
  createAuthSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/serverSupabase";

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

    const body = await request.json();
    const plaidItemUuid = body.plaid_item_uuid;

    if (!plaidItemUuid) {
      return NextResponse.json(
        { error: "Missing plaid_item_uuid." },
        { status: 400 }
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

    const { data: plaidItem, error: itemError } = await serverSupabase
      .from("plaid_items")
      .select("*")
      .eq("id", plaidItemUuid)
      .eq("user_id", user.id)
      .maybeSingle();

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    if (!plaidItem) {
      return NextResponse.json(
        { error: "Plaid connection not found." },
        { status: 404 }
      );
    }

    try {
      const plaidClient = getPlaidClient();

      await plaidClient.itemRemove({
        access_token: plaidItem.access_token,
      });
    } catch (error) {
      console.warn(
        "Plaid item remove failed, continuing local disconnect:",
        error
      );
    }

    const now = new Date().toISOString();

    const { data: plaidAccounts, error: plaidAccountsError } =
      await serverSupabase
        .from("plaid_accounts")
        .select("wealthos_account_id")
        .eq("user_id", user.id)
        .eq("plaid_item_id", plaidItemUuid);

    if (plaidAccountsError) {
      return NextResponse.json(
        { error: plaidAccountsError.message },
        { status: 500 }
      );
    }

    const wealthAccountIds = (plaidAccounts || [])
      .map((account) => account.wealthos_account_id)
      .filter(Boolean);

    const { error: itemUpdateError } = await serverSupabase
      .from("plaid_items")
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq("id", plaidItemUuid)
      .eq("user_id", user.id);

    if (itemUpdateError) {
      return NextResponse.json(
        { error: itemUpdateError.message },
        { status: 500 }
      );
    }

    const { error: accountUpdateError } = await serverSupabase
      .from("plaid_accounts")
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("plaid_item_id", plaidItemUuid);

    if (accountUpdateError) {
      return NextResponse.json(
        { error: accountUpdateError.message },
        { status: 500 }
      );
    }

    if (wealthAccountIds.length > 0) {
      const { error: wealthAccountUpdateError } = await serverSupabase
        .from("accounts")
        .update({
          is_active: false,
          updated_at: now,
        })
        .eq("user_id", user.id)
        .in("id", wealthAccountIds);

      if (wealthAccountUpdateError) {
        return NextResponse.json(
          { error: wealthAccountUpdateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      disconnected_accounts: wealthAccountIds.length,
    });
  } catch (error: any) {
    const message =
      error?.response?.data?.error_message ||
      error?.message ||
      "Failed to disconnect Plaid institution.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
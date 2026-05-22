import { NextRequest, NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import {
  createAuthSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/serverSupabase";

function mapPlaidAccountType(type: string, subtype?: string | null) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedSubtype = String(subtype || "").toLowerCase();

  if (normalizedType === "credit") return "credit_card";
  if (normalizedType === "loan") return "loan";
  if (normalizedSubtype.includes("checking")) return "checking";
  if (normalizedSubtype.includes("savings")) return "savings";
  if (normalizedType === "investment") return "investment";

  return "other_asset";
}

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
    const publicToken = body.public_token;
    const metadata = body.metadata || {};

    if (!publicToken) {
      return NextResponse.json(
        { error: "Missing public_token." },
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

    const plaidClient = getPlaidClient();
    const serverSupabase = createServerSupabaseClient();

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const plaidAccessToken = exchangeResponse.data.access_token;
    const plaidItemId = exchangeResponse.data.item_id;

    const institution = metadata.institution || {};
    const institutionName = institution.name || "Connected Institution";

    const { data: plaidItem, error: plaidItemError } = await serverSupabase
      .from("plaid_items")
      .upsert(
        {
          user_id: user.id,
          plaid_item_id: plaidItemId,
          access_token: plaidAccessToken,
          institution_id: institution.institution_id || null,
          institution_name: institutionName,
          products: ["transactions"],
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,plaid_item_id",
        }
      )
      .select()
      .single();

    if (plaidItemError || !plaidItem) {
      return NextResponse.json(
        { error: plaidItemError?.message || "Failed to save Plaid item." },
        { status: 500 }
      );
    }

    const accountsResponse = await plaidClient.accountsGet({
      access_token: plaidAccessToken,
    });

    const createdAccounts = [];

    for (const plaidAccount of accountsResponse.data.accounts) {
      const accountType = mapPlaidAccountType(
        String(plaidAccount.type || ""),
        plaidAccount.subtype || null
      );

      const accountBalance = Number(plaidAccount.balances.current || 0);
      const currency = plaidAccount.balances.iso_currency_code || "USD";

      const { data: wealthAccount, error: wealthAccountError } =
        await serverSupabase
          .from("accounts")
          .insert({
            user_id: user.id,
            name: plaidAccount.name,
            institution_name: institutionName,
            account_type: accountType,
            balance: accountBalance,
            currency,
            source: "plaid",
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

      if (wealthAccountError || !wealthAccount) {
        console.warn("Failed to create WealthOS account:", wealthAccountError);
        continue;
      }

      const { error: plaidAccountError } = await serverSupabase
        .from("plaid_accounts")
        .upsert(
          {
            user_id: user.id,
            plaid_item_id: plaidItem.id,
            plaid_account_id: plaidAccount.account_id,
            wealthos_account_id: wealthAccount.id,
            name: plaidAccount.name,
            official_name: plaidAccount.official_name || null,
            type: plaidAccount.type || null,
            subtype: plaidAccount.subtype || null,
            mask: plaidAccount.mask || null,
            current_balance: accountBalance,
            available_balance: plaidAccount.balances.available,
            iso_currency_code: currency,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,plaid_account_id",
          }
        );

      if (plaidAccountError) {
        console.warn("Failed to save Plaid account:", plaidAccountError);
      }

      createdAccounts.push(wealthAccount);
    }

    return NextResponse.json({
      success: true,
      item_id: plaidItemId,
      accounts_created: createdAccounts.length,
    });
  } catch (error: any) {
    const message =
      error?.response?.data?.error_message ||
      error?.message ||
      "Failed to exchange Plaid token.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
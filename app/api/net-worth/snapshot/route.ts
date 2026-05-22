import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/serverSupabase";

type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "cash"
  | "investment"
  | "loan"
  | "vehicle"
  | "real_estate"
  | "other_asset"
  | "other_liability";

const ASSET_TYPES: AccountType[] = [
  "checking",
  "savings",
  "cash",
  "investment",
  "vehicle",
  "real_estate",
  "other_asset",
];

const LIABILITY_TYPES: AccountType[] = [
  "credit_card",
  "loan",
  "other_liability",
];

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

    const body = await request.json().catch(() => ({}));
    const source = body.source || "manual";

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

    const { data: accounts, error: accountsError } = await serverSupabase
      .from("accounts")
      .select("account_type, balance, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    const assets = (accounts || [])
      .filter((account) =>
        ASSET_TYPES.includes(account.account_type as AccountType)
      )
      .reduce((sum, account) => sum + Number(account.balance || 0), 0);

    const liabilities = (accounts || [])
      .filter((account) =>
        LIABILITY_TYPES.includes(account.account_type as AccountType)
      )
      .reduce((sum, account) => sum + Math.abs(Number(account.balance || 0)), 0);

    const netWorth = assets - liabilities;

    const today = new Date().toISOString().slice(0, 10);

    const { data: snapshot, error: snapshotError } = await serverSupabase
      .from("net_worth_snapshots")
      .upsert(
        {
          user_id: user.id,
          snapshot_date: today,
          assets,
          liabilities,
          net_worth: netWorth,
          source,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,snapshot_date",
        }
      )
      .select()
      .single();

    if (snapshotError) {
      return NextResponse.json({ error: snapshotError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create snapshot.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
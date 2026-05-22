import { NextRequest, NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import {
  createAuthSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/serverSupabase";

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name?: string | null;
  amount: number;
  pending?: boolean | null;
  category?: string[] | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
};

function mapPlaidTransactionType(amount: number) {
  if (amount < 0) return "income";
  return "expense";
}

function mapPlaidCategory(transaction: PlaidTransaction) {
  const primary = transaction.personal_finance_category?.primary || "";
  const detailed = transaction.personal_finance_category?.detailed || "";
  const legacyCategory = transaction.category?.[0] || "";

  const normalized = `${primary} ${detailed} ${legacyCategory}`.toLowerCase();

  if (normalized.includes("income") || normalized.includes("payroll")) {
    return "Salary";
  }

  if (
    normalized.includes("food") ||
    normalized.includes("restaurant") ||
    normalized.includes("dining")
  ) {
    return "Restaurants";
  }

  if (
    normalized.includes("grocery") ||
    normalized.includes("supermarket")
  ) {
    return "Groceries";
  }

  if (
    normalized.includes("general_merchandise") ||
    normalized.includes("shopping") ||
    normalized.includes("merchandise")
  ) {
    return "Shopping";
  }

  if (
    normalized.includes("transportation") ||
    normalized.includes("taxi") ||
    normalized.includes("parking")
  ) {
    return "Transportation";
  }

  if (
    normalized.includes("gas") ||
    normalized.includes("fuel")
  ) {
    return "Fuel";
  }

  if (
    normalized.includes("rent") ||
    normalized.includes("mortgage")
  ) {
    return "Rent/Mortgage";
  }

  if (
    normalized.includes("loan")
  ) {
    return "Loan Payment";
  }

  if (
    normalized.includes("credit card")
  ) {
    return "Credit Card Payment";
  }

  if (
    normalized.includes("transfer")
  ) {
    return "Transfer";
  }

  if (
    normalized.includes("insurance")
  ) {
    return "Insurance";
  }

  if (
    normalized.includes("subscription")
  ) {
    return "Subscriptions";
  }

  if (
    normalized.includes("entertainment")
  ) {
    return "Entertainment";
  }

  if (
    normalized.includes("travel")
  ) {
    return "Travel";
  }

  return legacyCategory || "Other";
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

    const { data: plaidItems, error: itemsError } = await serverSupabase
      .from("plaid_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;
    let totalInsertedOrUpdated = 0;

    for (const item of plaidItems || []) {
      let cursor = item.transactions_cursor || null;
      let hasMore = true;

      const added: PlaidTransaction[] = [];
      const modified: PlaidTransaction[] = [];
      const removed: Array<{ transaction_id: string }> = [];

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor: cursor || undefined,
          count: 500,
        });

        added.push(...(response.data.added as PlaidTransaction[]));
        modified.push(...(response.data.modified as PlaidTransaction[]));
        removed.push(...response.data.removed);

        hasMore = response.data.has_more;
        cursor = response.data.next_cursor;
      }

      const { data: plaidAccounts, error: plaidAccountsError } =
        await serverSupabase
          .from("plaid_accounts")
          .select("*")
          .eq("user_id", user.id)
          .eq("plaid_item_id", item.id);

      if (plaidAccountsError) {
        return NextResponse.json(
          { error: plaidAccountsError.message },
          { status: 500 }
        );
      }

      const accountMap = new Map<string, string>();

      (plaidAccounts || []).forEach((account) => {
        if (account.wealthos_account_id) {
          accountMap.set(
            String(account.plaid_account_id),
            String(account.wealthos_account_id)
          );
        }
      });

      const now = new Date().toISOString();

      const upsertTransactions = [...added, ...modified].flatMap(
        (transaction) => {
          const wealthosAccountId = accountMap.get(transaction.account_id);

          if (!wealthosAccountId) return [];

          return [
            {
              user_id: user.id,
              account_id: wealthosAccountId,
              plaid_transaction_id: transaction.transaction_id,
              plaid_account_id: transaction.account_id,
              date: transaction.date,
              name: transaction.name,
              merchant_name: transaction.merchant_name || transaction.name,
              amount: Math.abs(Number(transaction.amount || 0)),
              transaction_type: mapPlaidTransactionType(
                Number(transaction.amount || 0)
              ),
              category: mapPlaidCategory(transaction),
              notes: "Synced from Plaid",
              source: "plaid",
              pending: Boolean(transaction.pending),
              updated_at: now,
            },
          ];
        }
      );

      if (upsertTransactions.length > 0) {
        const { error: upsertError } = await serverSupabase
          .from("transactions")
          .upsert(upsertTransactions, {
            onConflict: "user_id,plaid_transaction_id",
          });

        if (upsertError) {
          return NextResponse.json(
            { error: upsertError.message },
            { status: 500 }
          );
        }
      }

      if (removed.length > 0) {
        const removedIds = removed.map(
          (transaction) => transaction.transaction_id
        );

        const { error: removeError } = await serverSupabase
          .from("transactions")
          .delete()
          .eq("user_id", user.id)
          .in("plaid_transaction_id", removedIds);

        if (removeError) {
          return NextResponse.json(
            { error: removeError.message },
            { status: 500 }
          );
        }
      }

      const { error: cursorError } = await serverSupabase
        .from("plaid_items")
        .update({
          transactions_cursor: cursor,
          updated_at: now,
        })
        .eq("id", item.id);

      if (cursorError) {
        return NextResponse.json(
          { error: cursorError.message },
          { status: 500 }
        );
      }

      totalAdded += added.length;
      totalModified += modified.length;
      totalRemoved += removed.length;
      totalInsertedOrUpdated += upsertTransactions.length;
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      inserted_or_updated: totalInsertedOrUpdated,
    });
  } catch (error: any) {
    const message =
      error?.response?.data?.error_message ||
      error?.message ||
      "Failed to sync Plaid transactions.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
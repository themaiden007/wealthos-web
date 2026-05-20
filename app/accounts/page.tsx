"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

type Account = {
  id: string;
  user_id: string;
  name: string;
  institution_name: string | null;
  account_type: AccountType;
  balance: number;
  currency: string;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const OLD_LOCAL_ACCOUNTS_KEY = "wealthos_accounts_v1";

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

const ACCOUNT_TYPE_OPTIONS: { label: string; value: AccountType }[] = [
  { label: "Checking", value: "checking" },
  { label: "Savings", value: "savings" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Cash", value: "cash" },
  { label: "Investment", value: "investment" },
  { label: "Loan", value: "loan" },
  { label: "Vehicle", value: "vehicle" },
  { label: "Real Estate", value: "real_estate" },
  { label: "Other Asset", value: "other_asset" },
  { label: "Other Liability", value: "other_liability" },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [name, setName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("");

  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");

      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load accounts:", error);
        alert(error.message);
      } else {
        setAccounts((data || []) as Account[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, []);

  const totals = useMemo(() => {
    const activeAccounts = accounts.filter((account) => account.is_active);

    const assets = activeAccounts
      .filter((account) => ASSET_TYPES.includes(account.account_type))
      .reduce((sum, account) => sum + Number(account.balance || 0), 0);

    const liabilities = activeAccounts
      .filter((account) => LIABILITY_TYPES.includes(account.account_type))
      .reduce((sum, account) => sum + Math.abs(Number(account.balance || 0)), 0);

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  }, [accounts]);

  async function addAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    if (!name.trim()) {
      alert("Please enter an account name.");
      return;
    }

    const parsedBalance = Number(balance);

    if (Number.isNaN(parsedBalance)) {
      alert("Please enter a valid balance.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: userId,
      name: name.trim(),
      institution_name: institutionName.trim() || "Manual",
      account_type: accountType,
      balance: parsedBalance,
      currency: "USD",
      source: "manual",
      is_active: true,
    };

    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Failed to add account:", error);
      alert(error.message);
      return;
    }

    setAccounts((current) => [data as Account, ...current]);

    setName("");
    setInstitutionName("");
    setAccountType("checking");
    setBalance("");
  }

  async function importOldLocalAccounts() {
    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    const saved = window.localStorage.getItem(OLD_LOCAL_ACCOUNTS_KEY);

    if (!saved) {
      alert("No old local accounts found.");
      return;
    }

    let parsed: any[];

    try {
      parsed = JSON.parse(saved);
    } catch {
      alert("Old local accounts data is not valid JSON.");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      alert("No old local accounts found.");
      return;
    }

    const confirmed = confirm(
      `Import ${parsed.length} old local account(s) into Supabase? Only click this once to avoid duplicates.`
    );

    if (!confirmed) return;

    setImporting(true);

    const existingNames = new Set(
      accounts.map((account) =>
        `${account.name}-${account.account_type}-${Number(account.balance)}`
      )
    );

    const payload = parsed
      .filter((account) => {
        const key = `${account.name}-${account.accountType}-${Number(
          account.balance || 0
        )}`;

        return !existingNames.has(key);
      })
      .map((account) => ({
        user_id: userId,
        name: account.name || "Imported Account",
        institution_name: account.institutionName || "Manual",
        account_type: account.accountType || "checking",
        balance: Number(account.balance || 0),
        currency: account.currency || "USD",
        source: "manual",
        is_active: account.isActive ?? true,
      }));

    if (payload.length === 0) {
      setImporting(false);
      alert("No new accounts to import. They may already exist in Supabase.");
      return;
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select();

    setImporting(false);

    if (error) {
      console.error("Failed to import old local accounts:", error);
      alert(error.message);
      return;
    }

    setAccounts((current) => [...((data || []) as Account[]), ...current]);

    alert(`Imported ${data?.length || 0} old local account(s) into Supabase.`);
  }

  async function deleteAccount(id: string) {
    const confirmed = confirm("Delete this account?");

    if (!confirmed) return;

    const { error } = await supabase.from("accounts").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setAccounts((current) => current.filter((account) => account.id !== id));
  }

  async function toggleAccountStatus(account: Account) {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        is_active: !account.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setAccounts((current) =>
      current.map((item) => (item.id === account.id ? (data as Account) : item))
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading accounts...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">WealthOS MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Accounts</h1>
            {userEmail && (
              <p className="mt-1 text-xs text-slate-600">
                Logged in as {userEmail}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={importOldLocalAccounts}
              disabled={importing}
              className="rounded-xl border border-blue-900 px-4 py-2 text-sm text-blue-300 hover:bg-blue-950 disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Old Local Accounts"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard title="Assets" value={formatCurrency(totals.assets)} />
          <SummaryCard
            title="Liabilities"
            value={formatCurrency(totals.liabilities)}
          />
          <SummaryCard
            title="Net Worth"
            value={formatCurrency(totals.netWorth)}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Add Manual Account</h2>
            <p className="mt-1 text-sm text-slate-400">
              These accounts are stored in Supabase.
            </p>

            <form onSubmit={addAccount} className="mt-5 space-y-4">
              <div>
                <label className="text-sm text-slate-300">Account Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: Chase Checking"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Institution</label>
                <input
                  value={institutionName}
                  onChange={(event) => setInstitutionName(event.target.value)}
                  placeholder="Example: Chase, Amex, Robinhood"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Account Type</label>
                <select
                  value={accountType}
                  onChange={(event) =>
                    setAccountType(event.target.value as AccountType)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300">Balance</label>
                <input
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  placeholder="Example: 5000"
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  For credit cards/loans, enter the balance as a positive number.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Account"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium">Account List</h2>
              <p className="text-sm text-slate-400">
                {accounts.length} account{accounts.length === 1 ? "" : "s"} added
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-xs text-slate-500">
                            {account.institution_name || "Manual"}
                            {!account.is_active ? " • inactive" : ""}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3 capitalize text-slate-300">
                        {account.account_type.replaceAll("_", " ")}
                      </td>

                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(Number(account.balance))}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAccountStatus(account)}
                            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                          >
                            {account.is_active ? "Archive" : "Restore"}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteAccount(account.id)}
                            className="rounded-lg border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {accounts.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No Supabase accounts yet. Add your first manual account
                        or import old local accounts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
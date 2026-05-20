"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";

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
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [name, setName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editInstitutionName, setEditInstitutionName] = useState("");
  const [editAccountType, setEditAccountType] =
    useState<AccountType>("checking");
  const [editBalance, setEditBalance] = useState("");

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
        showToast({
          type: "error",
          title: "Failed to load accounts",
          message: error.message,
        });
      } else {
        setAccounts((data || []) as Account[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, [showToast]);

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
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before adding an account.",
      });
      return;
    }

    if (!name.trim()) {
      showToast({
        type: "warning",
        title: "Account name required",
        message: "Please enter an account name.",
      });
      return;
    }

    const parsedBalance = Number(balance);

    if (Number.isNaN(parsedBalance)) {
      showToast({
        type: "warning",
        title: "Invalid balance",
        message: "Please enter a valid number for the balance.",
      });
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
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Failed to add account:", error);
      showToast({
        type: "error",
        title: "Failed to add account",
        message: error.message,
      });
      return;
    }

    setAccounts((current) => [data as Account, ...current]);

    setName("");
    setInstitutionName("");
    setAccountType("checking");
    setBalance("");

    showToast({
      type: "success",
      title: "Account added",
      message: `${payload.name} was added successfully.`,
    });
  }

  function startEditing(account: Account) {
    setEditingId(account.id);
    setEditName(account.name);
    setEditInstitutionName(account.institution_name || "");
    setEditAccountType(account.account_type);
    setEditBalance(String(Number(account.balance || 0)));
  }

  function cancelEditing() {
    setEditingId("");
    setEditName("");
    setEditInstitutionName("");
    setEditAccountType("checking");
    setEditBalance("");
  }

  async function saveAccountEdit(accountId: string) {
    if (!editName.trim()) {
      showToast({
        type: "warning",
        title: "Account name required",
        message: "Please enter an account name.",
      });
      return;
    }

    const parsedBalance = Number(editBalance);

    if (Number.isNaN(parsedBalance)) {
      showToast({
        type: "warning",
        title: "Invalid balance",
        message: "Please enter a valid number for the balance.",
      });
      return;
    }

    setUpdatingId(accountId);

    const { data, error } = await supabase
      .from("accounts")
      .update({
        name: editName.trim(),
        institution_name: editInstitutionName.trim() || "Manual",
        account_type: editAccountType,
        balance: parsedBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select()
      .single();

    setUpdatingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Failed to update account",
        message: error.message,
      });
      return;
    }

    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId ? (data as Account) : account
      )
    );

    cancelEditing();

    showToast({
      type: "success",
      title: "Account updated",
      message: `${editName.trim()} was saved successfully.`,
    });
  }

  async function deleteAccount(account: Account) {
    const confirmed = confirm(
      `Delete "${account.name}"?\n\nThis will permanently remove the account from Supabase. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(account.id);

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id);

    setDeletingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Failed to delete account",
        message: error.message,
      });
      return;
    }

    setAccounts((current) => current.filter((item) => item.id !== account.id));

    showToast({
      type: "success",
      title: "Account deleted",
      message: `${account.name} was removed.`,
    });
  }

  async function toggleAccountStatus(account: Account) {
    setUpdatingId(account.id);

    const { data, error } = await supabase
      .from("accounts")
      .update({
        is_active: !account.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select()
      .single();

    setUpdatingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Failed to update account",
        message: error.message,
      });
      return;
    }

    setAccounts((current) =>
      current.map((item) => (item.id === account.id ? (data as Account) : item))
    );

    showToast({
      type: "success",
      title: account.is_active ? "Account archived" : "Account restored",
      message: `${account.name} is now ${
        account.is_active ? "inactive" : "active"
      }.`,
    });
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            Loading accounts...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white md:flex">
      <AppNav userEmail={userEmail} />

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-sm text-slate-400">WealthOS</p>
            <h1 className="mt-2 text-3xl font-semibold">Accounts</h1>
            <p className="mt-1 text-sm text-slate-500">
              Add, edit, archive, and manage your financial accounts.
            </p>
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

          <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">Add Manual Account</h2>
              <p className="mt-1 text-sm text-slate-400">
                Add checking, savings, credit cards, loans, investments, and
                assets.
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
                    onChange={(event) =>
                      setInstitutionName(event.target.value)
                    }
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
                    For credit cards/loans, enter the balance as a positive
                    number.
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
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Account List</h2>
                  <p className="text-sm text-slate-400">
                    {accounts.length} account
                    {accounts.length === 1 ? "" : "s"} added
                  </p>
                </div>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                  No accounts yet. Add your first manual account.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {accounts.map((account) => {
                    const isEditing = editingId === account.id;
                    const isBusy =
                      updatingId === account.id || deletingId === account.id;

                    return (
                      <div
                        key={account.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-slate-400">
                                Account Name
                              </label>
                              <input
                                value={editName}
                                onChange={(event) =>
                                  setEditName(event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">
                                Institution
                              </label>
                              <input
                                value={editInstitutionName}
                                onChange={(event) =>
                                  setEditInstitutionName(event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">
                                Type
                              </label>
                              <select
                                value={editAccountType}
                                onChange={(event) =>
                                  setEditAccountType(
                                    event.target.value as AccountType
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              >
                                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">
                                Balance
                              </label>
                              <input
                                value={editBalance}
                                onChange={(event) =>
                                  setEditBalance(event.target.value)
                                }
                                type="number"
                                step="0.01"
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => saveAccountEdit(account.id)}
                                disabled={isBusy}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                              >
                                {updatingId === account.id
                                  ? "Saving..."
                                  : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={isBusy}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {account.name}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500">
                                  {account.institution_name || "Manual"}
                                </p>
                              </div>

                              <span
                                className={
                                  account.is_active
                                    ? "shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                                    : "shrink-0 rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300"
                                }
                              >
                                {account.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <div className="mt-5">
                              <p className="text-xs text-slate-500">Balance</p>
                              <p className="mt-1 break-words text-2xl font-semibold">
                                {formatCurrency(Number(account.balance))}
                              </p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs capitalize text-slate-300">
                                {account.account_type.replaceAll("_", " ")}
                              </span>
                              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                                {account.currency || "USD"}
                              </span>
                            </div>

                            <div className="mt-5 grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => startEditing(account)}
                                disabled={isBusy}
                                className="rounded-lg border border-blue-900 px-3 py-2 text-xs text-blue-300 hover:bg-blue-950 disabled:opacity-60"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleAccountStatus(account)}
                                disabled={isBusy}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                              >
                                {updatingId === account.id
                                  ? "..."
                                  : account.is_active
                                  ? "Archive"
                                  : "Restore"}
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteAccount(account)}
                                disabled={isBusy}
                                className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 disabled:opacity-60"
                              >
                                {deletingId === account.id ? "..." : "Delete"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
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
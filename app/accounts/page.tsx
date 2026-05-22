"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import PlaidConnectButton from "@/components/PlaidConnectButton";
import PlaidSyncButton from "@/components/PlaidSyncButton";
import PlaidConnectionsPanel from "@/components/PlaidConnectionsPanel";

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

const ACCOUNT_GROUPS: Array<{
  title: string;
  types: AccountType[];
  tone: "asset" | "liability";
}> = [
  {
    title: "Cash",
    types: ["checking", "savings", "cash"],
    tone: "asset",
  },
  {
    title: "Investments",
    types: ["investment"],
    tone: "asset",
  },
  {
    title: "Real Estate",
    types: ["real_estate"],
    tone: "asset",
  },
  {
    title: "Vehicles",
    types: ["vehicle"],
    tone: "asset",
  },
  {
    title: "Other Assets",
    types: ["other_asset"],
    tone: "asset",
  },
  {
    title: "Credit Cards",
    types: ["credit_card"],
    tone: "liability",
  },
  {
    title: "Loans",
    types: ["loan"],
    tone: "liability",
  },
  {
    title: "Other Liabilities",
    types: ["other_liability"],
    tone: "liability",
  },
];

export default function AccountsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [showManualForm, setShowManualForm] = useState(false);
  const [showConnectedBanks, setShowConnectedBanks] = useState(true);

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

  async function loadAccountsForUser(nextUserId: string) {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", nextUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load accounts:", error);
      showToast({
        type: "error",
        title: "Failed to load accounts",
        message: error.message,
      });
      return;
    }

    setAccounts((data || []) as Account[]);
  }

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

      await loadAccountsForUser(user.id);

      setHasLoaded(true);
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAccounts = useMemo(() => {
    return accounts.filter((account) => account.is_active);
  }, [accounts]);

  const totals = useMemo(() => {
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
  }, [activeAccounts]);

  const groupedAccounts = useMemo(() => {
    return ACCOUNT_GROUPS.map((group) => {
      const groupAccounts = activeAccounts.filter((account) =>
        group.types.includes(account.account_type)
      );

      const total = groupAccounts.reduce(
        (sum, account) => sum + Math.abs(Number(account.balance || 0)),
        0
      );

      return {
        ...group,
        accounts: groupAccounts,
        total,
      };
    }).filter((group) => group.accounts.length > 0);
  }, [activeAccounts]);

  const assetBreakdown = useMemo(() => {
    return groupedAccounts.filter((group) => group.tone === "asset");
  }, [groupedAccounts]);

  const liabilityBreakdown = useMemo(() => {
    return groupedAccounts.filter((group) => group.tone === "liability");
  }, [groupedAccounts]);

  const netWorthTrend = useMemo(() => {
    const now = new Date();
    const current = totals.netWorth;

    const previousBase = Math.max(
      current - Math.max(Math.abs(current) * 0.08, 500),
      0
    );

    return Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (5 - index));

      const progress = index / 5;
      const value =
        previousBase + (current - previousBase) * progress + index * 50;

      return {
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: Math.round(index === 5 ? current : value),
      };
    });
  }, [totals.netWorth]);

  const oneMonthChange = useMemo(() => {
    const first = netWorthTrend[0]?.value || 0;
    const last = netWorthTrend[netWorthTrend.length - 1]?.value || 0;
    return last - first;
  }, [netWorthTrend]);

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
    setShowManualForm(false);

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
    const isPlaidAccount = account.source === "plaid";

    const confirmed = await confirm({
      title: isPlaidAccount
        ? `Archive Plaid account "${account.name}"?`
        : `Delete ${account.name}?`,
      message: isPlaidAccount
        ? "This account was created by Plaid. Deleting it manually can break bank sync. We recommend disconnecting the bank instead.\n\nThis action will remove the account from WealthOS, but Plaid may recreate it on the next sync."
        : "This will permanently remove the account from Supabase.\n\nThis action cannot be undone.",
      confirmLabel: isPlaidAccount ? "Archive Anyway" : "Delete Account",
      cancelLabel: "Cancel",
      variant: "danger",
    });

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
      title: isPlaidAccount ? "Plaid account archived" : "Account deleted",
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
          <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-6">
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
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">WealthOS</p>
              <h1 className="mt-1 text-3xl font-semibold">Accounts</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowConnectedBanks((current) => !current)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                Connected Banks
              </button>

              <PlaidSyncButton
                label="Refresh all"
                onComplete={() => {
                  if (userId) {
                    loadAccountsForUser(userId);
                  }
                }}
              />

              <PlaidConnectButton
                onComplete={() => {
                  if (userId) {
                    loadAccountsForUser(userId);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => setShowManualForm((current) => !current)}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              >
                + Add account
              </button>
            </div>
          </div>

          {showConnectedBanks && (
            <div className="mb-6">
              <PlaidConnectionsPanel
                onChanged={() => {
                  if (userId) {
                    loadAccountsForUser(userId);
                  }
                }}
              />
            </div>
          )}

          {showManualForm && (
            <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Add Manual Account</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Add accounts that are not connected through Plaid.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={addAccount}
                noValidate
                className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <div>
                  <label className="text-sm text-slate-300">Account Name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Chase Checking"
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
                    placeholder="Chase"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-300">Type</label>
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
                    placeholder="5000"
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Net Worth
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatCurrency(totals.netWorth)}
                </p>
                <p
                  className={
                    oneMonthChange >= 0
                      ? "mt-1 text-sm font-medium text-emerald-300"
                      : "mt-1 text-sm font-medium text-red-300"
                  }
                >
                  {oneMonthChange >= 0 ? "↗" : "↘"}{" "}
                  {formatCurrency(Math.abs(oneMonthChange))} estimated recent
                  change
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <select className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none">
                  <option>Net worth performance</option>
                </select>

                <select className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none">
                  <option>1 month</option>
                </select>
              </div>
            </div>

            <div className="mt-6 h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthTrend}>
                  <defs>
                    <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(value) => compactCurrency(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#06b6d4"
                    strokeWidth={4}
                    fill="url(#netWorthFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              {groupedAccounts.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
                  No active accounts yet. Connect a bank or add a manual
                  account.
                </div>
              ) : (
                groupedAccounts.map((group) => (
                  <AccountGroupCard
                    key={group.title}
                    group={group}
                    editingId={editingId}
                    updatingId={updatingId}
                    deletingId={deletingId}
                    editName={editName}
                    setEditName={setEditName}
                    editInstitutionName={editInstitutionName}
                    setEditInstitutionName={setEditInstitutionName}
                    editAccountType={editAccountType}
                    setEditAccountType={setEditAccountType}
                    editBalance={editBalance}
                    setEditBalance={setEditBalance}
                    startEditing={startEditing}
                    cancelEditing={cancelEditing}
                    saveAccountEdit={saveAccountEdit}
                    toggleAccountStatus={toggleAccountStatus}
                    deleteAccount={deleteAccount}
                  />
                ))
              )}
            </section>

            <aside className="space-y-6">
              <SummaryPanel
                assets={totals.assets}
                liabilities={totals.liabilities}
                assetBreakdown={assetBreakdown}
                liabilityBreakdown={liabilityBreakdown}
              />

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Account Health</h2>
                <div className="mt-4 space-y-3">
                  <MiniStatus
                    label="Active accounts"
                    value={String(activeAccounts.length)}
                  />
                  <MiniStatus
                    label="Connected by Plaid"
                    value={String(
                      activeAccounts.filter((account) => account.source === "plaid")
                        .length
                    )}
                  />
                  <MiniStatus
                    label="Manual accounts"
                    value={String(
                      activeAccounts.filter(
                        (account) => account.source !== "plaid"
                      ).length
                    )}
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function AccountGroupCard({
  group,
  editingId,
  updatingId,
  deletingId,
  editName,
  setEditName,
  editInstitutionName,
  setEditInstitutionName,
  editAccountType,
  setEditAccountType,
  editBalance,
  setEditBalance,
  startEditing,
  cancelEditing,
  saveAccountEdit,
  toggleAccountStatus,
  deleteAccount,
}: {
  group: {
    title: string;
    tone: "asset" | "liability";
    total: number;
    accounts: Account[];
  };
  editingId: string;
  updatingId: string;
  deletingId: string;
  editName: string;
  setEditName: (value: string) => void;
  editInstitutionName: string;
  setEditInstitutionName: (value: string) => void;
  editAccountType: AccountType;
  setEditAccountType: (value: AccountType) => void;
  editBalance: string;
  setEditBalance: (value: string) => void;
  startEditing: (account: Account) => void;
  cancelEditing: () => void;
  saveAccountEdit: (accountId: string) => void;
  toggleAccountStatus: (account: Account) => void;
  deleteAccount: (account: Account) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{group.title}</h2>
          <p
            className={
              group.tone === "asset"
                ? "mt-1 text-sm font-medium text-emerald-300"
                : "mt-1 text-sm font-medium text-red-300"
            }
          >
            {group.tone === "asset" ? "↗" : "↘"}{" "}
            {formatCurrency(group.total)}
          </p>
        </div>

        <p className="shrink-0 text-lg font-semibold">
          {formatCurrency(group.total)}
        </p>
      </div>

      <div className="divide-y divide-slate-800 border-t border-slate-800">
        {group.accounts.map((account) => {
          const isEditing = editingId === account.id;
          const isBusy =
            updatingId === account.id || deletingId === account.id;

          return (
            <div key={account.id} className="px-5 py-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />

                    <input
                      value={editInstitutionName}
                      onChange={(event) =>
                        setEditInstitutionName(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />

                    <select
                      value={editAccountType}
                      onChange={(event) =>
                        setEditAccountType(event.target.value as AccountType)
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                      {ACCOUNT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <input
                      value={editBalance}
                      onChange={(event) => setEditBalance(event.target.value)}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveAccountEdit(account.id)}
                      disabled={isBusy}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {updatingId === account.id ? "Saving..." : "Save"}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-100">
                        {account.name}
                      </p>
                      <span
                        className={
                          account.source === "plaid"
                            ? "rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300"
                            : "rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-400"
                        }
                      >
                        {account.source === "plaid" ? "Plaid" : "Manual"}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {account.institution_name || "Manual"} ·{" "}
                      {account.account_type.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-right text-lg font-semibold">
                      {formatCurrency(Math.abs(Number(account.balance || 0)))}
                    </p>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(account)}
                        disabled={isBusy}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-60"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAccountStatus(account)}
                        disabled={isBusy}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-60"
                      >
                        {updatingId === account.id ? "..." : "Archive"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteAccount(account)}
                        disabled={isBusy}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-red-900 hover:bg-red-950 hover:text-red-300 disabled:opacity-60"
                      >
                        {deletingId === account.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryPanel({
  assets,
  liabilities,
  assetBreakdown,
  liabilityBreakdown,
}: {
  assets: number;
  liabilities: number;
  assetBreakdown: Array<{ title: string; total: number }>;
  liabilityBreakdown: Array<{ title: string; total: number }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Summary</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
          Totals
        </span>
      </div>

      <div className="mt-6 space-y-6">
        <BreakdownSection
          title="Assets"
          total={assets}
          rows={assetBreakdown}
          tone="asset"
        />

        <BreakdownSection
          title="Liabilities"
          total={liabilities}
          rows={liabilityBreakdown}
          tone="liability"
        />
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  total,
  rows,
  tone,
}: {
  title: string;
  total: number;
  rows: Array<{ title: string; total: number }>;
  tone: "asset" | "liability";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-sm font-semibold text-slate-300">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-800">
        {rows.map((row, index) => {
          const width = total > 0 ? (row.total / total) * 100 : 0;

          return (
            <div
              key={row.title}
              className={
                tone === "asset"
                  ? index % 2 === 0
                    ? "bg-cyan-400"
                    : "bg-emerald-500"
                  : index % 2 === 0
                  ? "bg-amber-400"
                  : "bg-red-500"
              }
              style={{ width: `${Math.max(width, rows.length > 0 ? 4 : 0)}%` }}
            />
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No {title.toLowerCase()}.</p>
        ) : (
          rows.map((row, index) => (
            <div key={row.title} className="flex justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    tone === "asset"
                      ? index % 2 === 0
                        ? "h-2 w-2 rounded-full bg-cyan-400"
                        : "h-2 w-2 rounded-full bg-emerald-500"
                      : index % 2 === 0
                      ? "h-2 w-2 rounded-full bg-amber-400"
                      : "h-2 w-2 rounded-full bg-red-500"
                  }
                />
                <span className="truncate text-sm text-slate-400">
                  {row.title}
                </span>
              </div>

              <span className="shrink-0 text-sm text-slate-200">
                {formatCurrency(row.total)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-100">{value}</span>
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

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
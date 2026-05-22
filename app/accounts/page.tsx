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
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import ActionButton from "@/components/ui/ActionButton";
import StatusPill from "@/components/ui/StatusPill";

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

type NetWorthSnapshot = {
  id: string;
  user_id: string;
  snapshot_date: string;
  assets: number;
  liabilities: number;
  net_worth: number;
  source: string;
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
  { title: "Cash", types: ["checking", "savings", "cash"], tone: "asset" },
  { title: "Investments", types: ["investment"], tone: "asset" },
  { title: "Real Estate", types: ["real_estate"], tone: "asset" },
  { title: "Vehicles", types: ["vehicle"], tone: "asset" },
  { title: "Other Assets", types: ["other_asset"], tone: "asset" },
  { title: "Credit Cards", types: ["credit_card"], tone: "liability" },
  { title: "Loans", types: ["loan"], tone: "liability" },
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
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
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

  async function loadNetWorthSnapshots(nextUserId: string) {
    const { data, error } = await supabase
      .from("net_worth_snapshots")
      .select("*")
      .eq("user_id", nextUserId)
      .order("snapshot_date", { ascending: true });

    if (error) {
      console.warn("Failed to load net worth snapshots:", error.message);
      return;
    }

    setSnapshots((data || []) as NetWorthSnapshot[]);
  }

  async function createNetWorthSnapshot(source = "manual") {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token;

    if (!authToken || !userId) return;

    const response = await fetch("/api/net-worth/snapshot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ source }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn("Snapshot failed:", data.error || "Unknown snapshot error");
      return;
    }

    await loadNetWorthSnapshots(userId);
  }

  async function refreshAccountsAndSnapshots(source = "manual_refresh") {
    if (!userId) return;

    await loadAccountsForUser(userId);
    await createNetWorthSnapshot(source);
    await loadNetWorthSnapshots(userId);
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
      await loadNetWorthSnapshots(user.id);

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
    if (snapshots.length > 0) {
      return snapshots.map((snapshot) => ({
        label: new Date(snapshot.snapshot_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: Math.round(Number(snapshot.net_worth || 0)),
      }));
    }

    const today = new Date();

    return [
      {
        label: today.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: Math.round(totals.netWorth),
      },
    ];
  }, [snapshots, totals.netWorth]);

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

    await createNetWorthSnapshot("manual_account_add");
    await loadNetWorthSnapshots(userId);

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

    await createNetWorthSnapshot("manual_account_edit");
    await loadNetWorthSnapshots(userId);

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

    await createNetWorthSnapshot(
      account.source === "plaid"
        ? "plaid_account_delete"
        : "manual_account_delete"
    );
    await loadNetWorthSnapshots(userId);

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

    await createNetWorthSnapshot("account_status_change");
    await loadNetWorthSnapshots(userId);

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
          <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-6">
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
        <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
          <PageHeader
            title="Accounts"
            description="Connect banks, manage manual accounts, and track net worth."
            actions={
              <>
                <ActionButton
                  onClick={() =>
                    setShowConnectedBanks((current) => !current)
                  }
                >
                  Connected Banks
                </ActionButton>

                <PlaidSyncButton
                  label="Refresh all"
                  onComplete={async () => {
                    await refreshAccountsAndSnapshots("plaid_sync");
                  }}
                />

                <PlaidConnectButton
                  onComplete={async () => {
                    await refreshAccountsAndSnapshots("plaid_connect");
                  }}
                />

                <ActionButton
                  variant="primary"
                  onClick={() => setShowManualForm((current) => !current)}
                  className="bg-orange-600 hover:bg-orange-500"
                >
                  + Add account
                </ActionButton>
              </>
            }
          />

          {showConnectedBanks && (
            <div className="mb-6">
              <PlaidConnectionsPanel
                onChanged={async () => {
                  await refreshAccountsAndSnapshots("plaid_connections_change");
                }}
              />
            </div>
          )}

          {showManualForm && (
            <Panel className="mb-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-medium">Add Manual Account</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Add accounts that are not connected through Plaid.
                  </p>
                </div>

                <ActionButton
                  onClick={() => setShowManualForm(false)}
                  className="rounded-lg px-3 py-2 text-xs"
                >
                  Close
                </ActionButton>
              </div>

              <form
                onSubmit={addAccount}
                noValidate
                className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <FormField label="Account Name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Chase Checking"
                    className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Institution">
                  <input
                    value={institutionName}
                    onChange={(event) =>
                      setInstitutionName(event.target.value)
                    }
                    placeholder="Chase"
                    className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Type">
                  <select
                    value={accountType}
                    onChange={(event) =>
                      setAccountType(event.target.value as AccountType)
                    }
                    className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Balance">
                  <input
                    value={balance}
                    onChange={(event) => setBalance(event.target.value)}
                    placeholder="5000"
                    type="number"
                    step="0.01"
                    className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </FormField>

                <div className="flex items-end">
                  <ActionButton
                    type="submit"
                    variant="primary"
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? "Saving..." : "Save"}
                  </ActionButton>
                </div>
              </form>
            </Panel>
          )}

          <Panel variant="hero">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Net Worth
                </p>
                <p className="mt-2 break-words text-3xl font-semibold">
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
                  {formatCurrency(Math.abs(oneMonthChange))} net worth change
                </p>
              </div>

              <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <select className="shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none">
                  <option>Net worth performance</option>
                </select>

                <select className="shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none">
                  <option>All snapshots</option>
                </select>
              </div>
            </div>

            <div className="mt-6 h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthTrend}>
                  <defs>
                    <linearGradient
                      id="netWorthFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#06b6d4"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#06b6d4"
                        stopOpacity={0.02}
                      />
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
          </Panel>

          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
              {groupedAccounts.length === 0 ? (
                <Panel>
                  <div className="p-4 text-center text-slate-500">
                    No active accounts yet. Connect a bank or add a manual
                    account.
                  </div>
                </Panel>
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

            <aside className="min-w-0 space-y-6">
              <SummaryPanel
                assets={totals.assets}
                liabilities={totals.liabilities}
                assetBreakdown={assetBreakdown}
                liabilityBreakdown={liabilityBreakdown}
              />

              <Panel>
                <h2 className="text-lg font-medium">Account Health</h2>
                <div className="mt-4 space-y-3">
                  <MiniStatus
                    label="Active accounts"
                    value={String(activeAccounts.length)}
                  />
                  <MiniStatus
                    label="Connected by Plaid"
                    value={String(
                      activeAccounts.filter(
                        (account) => account.source === "plaid"
                      ).length
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
                  <MiniStatus
                    label="Snapshot records"
                    value={String(snapshots.length)}
                  />
                </div>
              </Panel>
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
    <Panel className="overflow-hidden p-0 sm:p-0">
      <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-4">
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
            <div key={account.id} className="min-w-0 px-5 py-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />

                    <input
                      value={editInstitutionName}
                      onChange={(event) =>
                        setEditInstitutionName(event.target.value)
                      }
                      className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />

                    <select
                      value={editAccountType}
                      onChange={(event) =>
                        setEditAccountType(event.target.value as AccountType)
                      }
                      className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                      className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      variant="primary"
                      onClick={() => saveAccountEdit(account.id)}
                      disabled={isBusy}
                      className="rounded-lg px-3 py-2 text-xs"
                    >
                      {updatingId === account.id ? "Saving..." : "Save"}
                    </ActionButton>

                    <ActionButton
                      onClick={cancelEditing}
                      disabled={isBusy}
                      className="rounded-lg px-3 py-2 text-xs"
                    >
                      Cancel
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-100">
                        {account.name}
                      </p>

                      <StatusPill
                        tone={account.source === "plaid" ? "good" : "neutral"}
                      >
                        {account.source === "plaid" ? "Plaid" : "Manual"}
                      </StatusPill>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {account.institution_name || "Manual"} ·{" "}
                      {account.account_type.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center sm:gap-3">
                    <p className="text-left text-lg font-semibold sm:text-right">
                      {formatCurrency(Math.abs(Number(account.balance || 0)))}
                    </p>

                    <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-1">
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
    </Panel>
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
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Summary</h2>
        <StatusPill>Totals</StatusPill>
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
    </Panel>
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
                        ? "h-2 w-2 shrink-0 rounded-full bg-cyan-400"
                        : "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                      : index % 2 === 0
                      ? "h-2 w-2 shrink-0 rounded-full bg-amber-400"
                      : "h-2 w-2 shrink-0 rounded-full bg-red-500"
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
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <span className="min-w-0 text-sm text-slate-400">{label}</span>
      <span className="shrink-0 text-sm font-medium text-slate-100">
        {value}
      </span>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="text-sm text-slate-300">{label}</label>
      {children}
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
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

type TransactionType = "income" | "expense" | "transfer";

type Transaction = {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  transaction_type: TransactionType;
  category: string;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

type BudgetItem = {
  id: string;
  user_id: string;
  category: string;
  planned_amount: number;
  created_at: string;
  updated_at: string;
};

type LocalBudgetItem = {
  category: string;
  plannedAmount: number;
};

const OLD_LOCAL_BUDGET_KEY = "wealthos_budget_v1";

const DEFAULT_BUDGET_CATEGORIES = [
  "Groceries",
  "Restaurants",
  "Coffee",
  "Rent/Mortgage",
  "Utilities",
  "Internet",
  "Transportation",
  "Fuel",
  "Car Payment",
  "Insurance",
  "Shopping",
  "Entertainment",
  "Subscriptions",
  "Travel",
  "Healthcare",
  "Fitness",
  "Investment",
  "Loan Payment",
  "Other",
];

export default function BudgetPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [savingCategory, setSavingCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [autofilling, setAutofilling] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

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

      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (transactionError) {
        alert(transactionError.message);
        setHasLoaded(true);
        return;
      }

      const { data: budgetData, error: budgetError } = await supabase
        .from("budget_items")
        .select("*")
        .eq("user_id", user.id)
        .order("category", { ascending: true });

      if (budgetError) {
        alert(budgetError.message);
        setHasLoaded(true);
        return;
      }

      setTransactions((transactionData || []) as Transaction[]);

      if (!budgetData || budgetData.length === 0) {
        const starterRows = DEFAULT_BUDGET_CATEGORIES.map((category) => ({
          user_id: user.id,
          category,
          planned_amount: 0,
          updated_at: new Date().toISOString(),
        }));

        const { data: inserted, error: insertError } = await supabase
          .from("budget_items")
          .upsert(starterRows, {
            onConflict: "user_id,category",
          })
          .select();

        if (insertError) {
          alert(insertError.message);
        } else {
          setBudgetItems((inserted || []) as BudgetItem[]);
        }
      } else {
        setBudgetItems(budgetData as BudgetItem[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, []);

  const budgetRows = useMemo(() => {
    const monthTransactions = transactions.filter(
      (transaction) =>
        transaction.date.startsWith(selectedMonth) &&
        transaction.transaction_type === "expense"
    );

    return budgetItems.map((item) => {
      const actualAmount = monthTransactions
        .filter((transaction) => transaction.category === item.category)
        .reduce(
          (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
          0
        );

      const plannedAmount = Number(item.planned_amount || 0);
      const remaining = plannedAmount - actualAmount;
      const percentUsed =
        plannedAmount > 0
          ? Math.min((actualAmount / plannedAmount) * 100, 999)
          : actualAmount > 0
          ? 999
          : 0;

      return {
        id: item.id,
        category: item.category,
        plannedAmount,
        actualAmount,
        remaining,
        percentUsed,
        status:
          plannedAmount === 0 && actualAmount > 0
            ? "unplanned"
            : remaining < 0
            ? "over"
            : percentUsed >= 80
            ? "warning"
            : "good",
      };
    });
  }, [transactions, budgetItems, selectedMonth]);

  const summary = useMemo(() => {
    const totalPlanned = budgetRows.reduce(
      (sum, row) => sum + row.plannedAmount,
      0
    );

    const totalActual = budgetRows.reduce(
      (sum, row) => sum + row.actualAmount,
      0
    );

    const totalRemaining = totalPlanned - totalActual;
    const overBudgetCount = budgetRows.filter((row) => row.remaining < 0).length;

    const unplannedSpending = budgetRows
      .filter((row) => row.status === "unplanned")
      .reduce((sum, row) => sum + row.actualAmount, 0);

    return {
      totalPlanned,
      totalActual,
      totalRemaining,
      overBudgetCount,
      unplannedSpending,
    };
  }, [budgetRows]);

  async function updateBudget(rowId: string, value: string) {
    const parsed = Number(value);
    const plannedAmount = Number.isNaN(parsed) ? 0 : parsed;

    setBudgetItems((current) =>
      current.map((item) =>
        item.id === rowId ? { ...item, planned_amount: plannedAmount } : item
      )
    );

    setSavingCategory(rowId);

    const { error } = await supabase
      .from("budget_items")
      .update({
        planned_amount: plannedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    setSavingCategory("");

    if (error) {
      alert(error.message);
    }
  }

  async function resetBudget() {
    const confirmed = confirm(
      "Reset all planned budget amounts to $0?\n\nThis will update your Supabase budget rows."
    );

    if (!confirmed) return;

    setResetting(true);

    const { error } = await supabase
      .from("budget_items")
      .update({
        planned_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    setResetting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setBudgetItems((current) =>
      current.map((item) => ({ ...item, planned_amount: 0 }))
    );
  }

  async function autoFillBudgetFromActuals() {
    const confirmed = confirm(
      "Set planned budget amounts equal to actual spending for the selected month?"
    );

    if (!confirmed) return;

    setAutofilling(true);

    const updated = budgetItems.map((item) => {
      const row = budgetRows.find((budgetRow) => budgetRow.id === item.id);

      return {
        ...item,
        planned_amount: row?.actualAmount || 0,
      };
    });

    setBudgetItems(updated);

    const updates = updated.map((item) =>
      supabase
        .from("budget_items")
        .update({
          planned_amount: item.planned_amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
    );

    const results = await Promise.all(updates);
    setAutofilling(false);

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      alert(failed.error.message);
    }
  }

  async function importOldLocalBudget() {
    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    const saved = window.localStorage.getItem(OLD_LOCAL_BUDGET_KEY);

    if (!saved) {
      alert("No old local budget found.");
      return;
    }

    let parsed: LocalBudgetItem[];

    try {
      parsed = JSON.parse(saved);
    } catch {
      alert("Old local budget is not valid JSON.");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      alert("No old local budget found.");
      return;
    }

    const confirmed = confirm(
      `Import ${parsed.length} old local budget row(s) into Supabase?\n\nThis will overwrite matching categories.`
    );

    if (!confirmed) return;

    setImporting(true);

    const payload = parsed.map((item) => ({
      user_id: userId,
      category: item.category,
      planned_amount: Number(item.plannedAmount || 0),
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("budget_items")
      .upsert(payload, {
        onConflict: "user_id,category",
      })
      .select();

    setImporting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setBudgetItems((data || []) as BudgetItem[]);
    alert(`Imported ${data?.length || 0} budget row(s).`);
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            Loading budgets...
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
            <p className="text-sm text-slate-400">WealthOS MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Budgets</h1>
            <p className="mt-1 text-sm text-slate-500">
              Plan monthly category spending and compare it against actual
              Supabase transactions.
            </p>
            {userEmail && (
              <p className="mt-1 text-xs text-slate-600">
                Logged in as {userEmail}
              </p>
            )}
          </div>

          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <label className="text-sm text-slate-300">Budget Month</label>
              <input
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                type="month"
                className="mt-1 block rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={autoFillBudgetFromActuals}
                disabled={autofilling}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
              >
                {autofilling ? "Autofilling..." : "Autofill from Actuals"}
              </button>

              <button
                type="button"
                onClick={resetBudget}
                disabled={resetting}
                className="rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-60"
              >
                {resetting ? "Resetting..." : "Reset Budget"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <SummaryCard
              title="Planned"
              value={formatCurrency(summary.totalPlanned)}
            />
            <SummaryCard
              title="Actual"
              value={formatCurrency(summary.totalActual)}
            />
            <SummaryCard
              title="Remaining"
              value={formatCurrency(summary.totalRemaining)}
            />
            <SummaryCard
              title="Over Budget"
              value={String(summary.overBudgetCount)}
            />
            <SummaryCard
              title="Unplanned"
              value={formatCurrency(summary.unplannedSpending)}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium">Category Budget</h2>
                <p className="text-sm text-slate-400">
                  Planned amounts save directly to Supabase.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Planned</th>
                      <th className="px-4 py-3 text-right">Actual</th>
                      <th className="px-4 py-3 text-right">Remaining</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {budgetRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-800 text-slate-200"
                      >
                        <td className="px-4 py-3 font-medium">
                          {row.category}
                        </td>

                        <td className="px-4 py-3 text-right align-top">
                          <input
                            value={row.plannedAmount}
                            onChange={(event) =>
                              updateBudget(row.id, event.target.value)
                            }
                            type="number"
                            step="1"
                            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-sm outline-none focus:border-blue-500"
                          />
                          {savingCategory === row.id && (
                            <p className="mt-1 text-xs text-blue-300">
                              Saving...
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatCurrency(row.actualAmount)}
                        </td>

                        <td
                          className={
                            row.remaining < 0
                              ? "px-4 py-3 text-right font-medium text-red-300"
                              : "px-4 py-3 text-right font-medium text-emerald-300"
                          }
                        >
                          {formatCurrency(row.remaining)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="h-2 w-full rounded-full bg-slate-800">
                            <div
                              className={getProgressClass(row.status)}
                              style={{
                                width: `${Math.min(row.percentUsed, 100)}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {Math.round(row.percentUsed)}% used
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Budget Insights</h2>

                <div className="mt-5 space-y-4">
                  <InsightCard
                    title="Monthly budget status"
                    text={getBudgetSummaryText(summary)}
                  />

                  <InsightCard
                    title="Overspending risk"
                    text={
                      summary.overBudgetCount > 0
                        ? `You are over budget in ${
                            summary.overBudgetCount
                          } categor${
                            summary.overBudgetCount === 1 ? "y" : "ies"
                          }. Review those categories first.`
                        : "No categories are over budget right now."
                    }
                  />

                  <InsightCard
                    title="Next recommendation"
                    text={
                      summary.totalPlanned === 0
                        ? "Start by entering planned amounts for your major categories."
                        : "Keep reviewing budgets weekly and adjust categories as spending changes."
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Migration Utility</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Use only if you still need to import old browser-stored budget
                  rows.
                </p>

                <button
                  type="button"
                  onClick={importOldLocalBudget}
                  disabled={importing}
                  className="mt-4 w-full rounded-xl border border-blue-900 px-4 py-2 text-sm text-blue-300 hover:bg-blue-950 disabled:opacity-60"
                >
                  {importing ? "Importing..." : "Import Old Local Budget"}
                </button>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function getBudgetSummaryText(summary: {
  totalPlanned: number;
  totalActual: number;
  totalRemaining: number;
}) {
  if (summary.totalPlanned === 0) {
    return "You have not planned a monthly budget yet.";
  }

  if (summary.totalRemaining >= 0) {
    return `You have ${formatCurrency(
      summary.totalRemaining
    )} remaining from your planned budget.`;
  }

  return `You are ${formatCurrency(
    Math.abs(summary.totalRemaining)
  )} over your planned budget.`;
}

function getProgressClass(status: string) {
  const base = "h-2 rounded-full ";

  if (status === "over" || status === "unplanned") return base + "bg-red-500";
  if (status === "warning") return base + "bg-amber-500";
  return base + "bg-emerald-500";
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "over" || status === "unplanned"
      ? "bg-red-500/10 text-red-300"
      : status === "warning"
      ? "bg-amber-500/10 text-amber-300"
      : "bg-emerald-500/10 text-emerald-300";

  const label =
    status === "over"
      ? "Over"
      : status === "unplanned"
      ? "Unplanned"
      : status === "warning"
      ? "Watch"
      : "Good";

  return (
    <span className={`rounded-full px-2 py-1 text-xs ${styles}`}>{label}</span>
  );
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
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
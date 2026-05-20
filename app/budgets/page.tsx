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
  const [deletingCategory, setDeletingCategory] = useState("");
  const [resetting, setResetting] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryBudget, setNewCategoryBudget] = useState("");

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

    return budgetItems
      .map((item) => {
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
      })
      .sort((a, b) => {
        if (a.actualAmount !== b.actualAmount) {
          return b.actualAmount - a.actualAmount;
        }

        return a.category.localeCompare(b.category);
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
    const plannedAmount = Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);

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

  async function addCustomCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    const category = newCategoryName.trim();

    if (!category) {
      alert("Please enter a category name.");
      return;
    }

    const alreadyExists = budgetItems.some(
      (item) => item.category.toLowerCase() === category.toLowerCase()
    );

    if (alreadyExists) {
      alert("That category already exists.");
      return;
    }

    const parsedBudget = Number(newCategoryBudget || 0);

    if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
      alert("Please enter a valid planned amount.");
      return;
    }

    setAddingCategory(true);

    const { data, error } = await supabase
      .from("budget_items")
      .insert({
        user_id: userId,
        category,
        planned_amount: parsedBudget,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    setAddingCategory(false);

    if (error) {
      alert(error.message);
      return;
    }

    setBudgetItems((current) =>
      [...current, data as BudgetItem].sort((a, b) =>
        a.category.localeCompare(b.category)
      )
    );

    setNewCategoryName("");
    setNewCategoryBudget("");
  }

  async function deleteBudgetCategory(row: {
    id: string;
    category: string;
    plannedAmount: number;
    actualAmount: number;
  }) {
    const confirmed = confirm(
      `Delete budget category "${row.category}"?\n\nThis removes the planned budget row only. It does not delete transactions in this category.`
    );

    if (!confirmed) return;

    setDeletingCategory(row.id);

    const { error } = await supabase
      .from("budget_items")
      .delete()
      .eq("id", row.id);

    setDeletingCategory("");

    if (error) {
      alert(error.message);
      return;
    }

    setBudgetItems((current) => current.filter((item) => item.id !== row.id));
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

          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">Add Budget Category</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create custom categories and set monthly planned amounts.
              </p>

              <form onSubmit={addCustomCategory} className="mt-5 space-y-4">
                <div>
                  <label className="text-sm text-slate-300">
                    Category Name
                  </label>
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Example: Motorcycle Fund"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-300">
                    Planned Monthly Amount
                  </label>
                  <input
                    value={newCategoryBudget}
                    onChange={(event) =>
                      setNewCategoryBudget(event.target.value)
                    }
                    type="number"
                    step="1"
                    placeholder="Example: 300"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingCategory}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
                >
                  {addingCategory ? "Adding..." : "Add Category"}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-medium text-slate-200">
                  Budget Insights
                </p>

                <div className="mt-4 space-y-4">
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
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Category Budget</h2>
                  <p className="text-sm text-slate-400">
                    {budgetRows.length} categor
                    {budgetRows.length === 1 ? "y" : "ies"} tracked
                  </p>
                </div>
              </div>

              {budgetRows.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                  No budget categories yet. Add your first category.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {budgetRows.map((row) => (
                    <div
                      key={row.id}
                      className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {row.category}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {Math.round(row.percentUsed)}% used
                          </p>
                        </div>

                        <StatusBadge status={row.status} />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <MiniStat
                          label="Planned"
                          value={formatCurrency(row.plannedAmount)}
                        />
                        <MiniStat
                          label="Actual"
                          value={formatCurrency(row.actualAmount)}
                        />
                        <MiniStat
                          label="Remaining"
                          value={formatCurrency(row.remaining)}
                          valueClass={
                            row.remaining < 0
                              ? "text-red-300"
                              : "text-emerald-300"
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <div className="h-2 w-full rounded-full bg-slate-800">
                          <div
                            className={getProgressClass(row.status)}
                            style={{
                              width: `${Math.min(row.percentUsed, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-xs text-slate-400">
                          Planned Amount
                        </label>
                        <input
                          value={row.plannedAmount}
                          onChange={(event) =>
                            updateBudget(row.id, event.target.value)
                          }
                          type="number"
                          step="1"
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                        {savingCategory === row.id && (
                          <p className="mt-1 text-xs text-blue-300">
                            Saving...
                          </p>
                        )}
                      </div>

                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => deleteBudgetCategory(row)}
                          disabled={deletingCategory === row.id}
                          className="w-full rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-60"
                        >
                          {deletingCategory === row.id
                            ? "Deleting..."
                            : "Delete Category"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
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
    <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${styles}`}>
      {label}
    </span>
  );
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  valueClass = "text-slate-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-medium ${valueClass}`}>
        {value}
      </p>
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
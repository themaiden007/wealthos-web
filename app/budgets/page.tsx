"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import MetricCard from "@/components/ui/MetricCard";
import ActionButton from "@/components/ui/ActionButton";
import StatusPill from "@/components/ui/StatusPill";
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

type BudgetRowStatus = "good" | "warning" | "over" | "unplanned";

type BudgetRow = {
  id: string;
  category: string;
  plannedAmount: number;
  actualAmount: number;
  remaining: number;
  percentUsed: number;
  status: BudgetRowStatus;
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
  const { showToast } = useToast();
  const { confirm } = useConfirm();

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

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "over" | "warning" | "good" | "unplanned"
  >("all");

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
        showToast({
          type: "error",
          title: "Failed to load transactions",
          message: transactionError.message,
        });
        setHasLoaded(true);
        return;
      }

      const { data: budgetData, error: budgetError } = await supabase
        .from("budget_items")
        .select("*")
        .eq("user_id", user.id)
        .order("category", { ascending: true });

      if (budgetError) {
        showToast({
          type: "error",
          title: "Failed to load budget",
          message: budgetError.message,
        });
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
          showToast({
            type: "error",
            title: "Failed to create starter budget",
            message: insertError.message,
          });
        } else {
          setBudgetItems((inserted || []) as BudgetItem[]);
        }
      } else {
        setBudgetItems(budgetData as BudgetItem[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, [showToast]);

  const budgetRows = useMemo<BudgetRow[]>(() => {
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

        const status: BudgetRowStatus =
          plannedAmount === 0 && actualAmount > 0
            ? "unplanned"
            : remaining < 0
            ? "over"
            : percentUsed >= 80
            ? "warning"
            : "good";

        return {
          id: item.id,
          category: item.category,
          plannedAmount,
          actualAmount,
          remaining,
          percentUsed,
          status,
        };
      })
      .sort((a, b) => {
        const statusRank: Record<BudgetRowStatus, number> = {
          over: 0,
          unplanned: 1,
          warning: 2,
          good: 3,
        };

        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
        }

        if (a.actualAmount !== b.actualAmount) {
          return b.actualAmount - a.actualAmount;
        }

        return a.category.localeCompare(b.category);
      });
  }, [transactions, budgetItems, selectedMonth]);

  const filteredBudgetRows = useMemo(() => {
    if (statusFilter === "all") return budgetRows;

    return budgetRows.filter((row) => row.status === statusFilter);
  }, [budgetRows, statusFilter]);

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
    const percentUsed =
      totalPlanned > 0 ? Math.min((totalActual / totalPlanned) * 100, 999) : 0;

    const overBudgetCount = budgetRows.filter((row) => row.status === "over")
      .length;

    const warningCount = budgetRows.filter((row) => row.status === "warning")
      .length;

    const unplannedSpending = budgetRows
      .filter((row) => row.status === "unplanned")
      .reduce((sum, row) => sum + row.actualAmount, 0);

    return {
      totalPlanned,
      totalActual,
      totalRemaining,
      percentUsed,
      overBudgetCount,
      warningCount,
      unplannedSpending,
    };
  }, [budgetRows]);

  const topRiskRows = useMemo(() => {
    return budgetRows
      .filter((row) => row.status === "over" || row.status === "warning")
      .slice(0, 5);
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
      showToast({
        type: "error",
        title: "Failed to update budget",
        message: error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: "Budget updated",
      message: "Planned amount was saved.",
    });
  }

  async function addCustomCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before adding a budget category.",
      });
      return;
    }

    const category = newCategoryName.trim();

    if (!category) {
      showToast({
        type: "warning",
        title: "Category name required",
        message: "Please enter a category name.",
      });
      return;
    }

    const alreadyExists = budgetItems.some(
      (item) => item.category.toLowerCase() === category.toLowerCase()
    );

    if (alreadyExists) {
      showToast({
        type: "warning",
        title: "Category already exists",
        message: "Choose a different category name.",
      });
      return;
    }

    const parsedBudget = Number(newCategoryBudget || 0);

    if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
      showToast({
        type: "warning",
        title: "Invalid planned amount",
        message: "Please enter a valid planned amount.",
      });
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
      showToast({
        type: "error",
        title: "Failed to add category",
        message: error.message,
      });
      return;
    }

    setBudgetItems((current) =>
      [...current, data as BudgetItem].sort((a, b) =>
        a.category.localeCompare(b.category)
      )
    );

    setNewCategoryName("");
    setNewCategoryBudget("");
    setShowAddCategory(false);

    showToast({
      type: "success",
      title: "Category added",
      message: `${category} was added to your budget.`,
    });
  }

  async function deleteBudgetCategory(row: BudgetRow) {
    const confirmed = await confirm({
      title: `Delete ${row.category}?`,
      message:
        "This removes the planned budget row only.\n\nIt does not delete transactions in this category.",
      confirmLabel: "Delete Category",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingCategory(row.id);

    const { error } = await supabase
      .from("budget_items")
      .delete()
      .eq("id", row.id);

    setDeletingCategory("");

    if (error) {
      showToast({
        type: "error",
        title: "Failed to delete category",
        message: error.message,
      });
      return;
    }

    setBudgetItems((current) => current.filter((item) => item.id !== row.id));

    showToast({
      type: "success",
      title: "Category deleted",
      message: `${row.category} was removed from your budget.`,
    });
  }

  async function resetBudget() {
    const confirmed = await confirm({
      title: "Reset budget?",
      message:
        "This will reset all planned budget amounts to $0 and update your Supabase budget rows.",
      confirmLabel: "Reset Budget",
      cancelLabel: "Cancel",
      variant: "warning",
    });

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
      showToast({
        type: "error",
        title: "Failed to reset budget",
        message: error.message,
      });
      return;
    }

    setBudgetItems((current) =>
      current.map((item) => ({ ...item, planned_amount: 0 }))
    );

    showToast({
      type: "success",
      title: "Budget reset",
      message: "All planned amounts were reset to $0.",
    });
  }

  async function autoFillBudgetFromActuals() {
    const confirmed = await confirm({
      title: "Autofill budget?",
      message:
        "This will set planned budget amounts equal to actual spending for the selected month.",
      confirmLabel: "Autofill",
      cancelLabel: "Cancel",
      variant: "info",
    });

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

    const results = await Promise.all(
      updated.map((item) =>
        supabase
          .from("budget_items")
          .update({
            planned_amount: item.planned_amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)
      )
    );

    setAutofilling(false);

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      showToast({
        type: "error",
        title: "Autofill failed",
        message: failed.error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: "Budget autofilled",
      message: "Planned amounts were set from actual spending.",
    });
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-6">
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
        <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
          <PageHeader
  title="Budgets"
  description="Plan monthly spending, compare actuals, and catch budget risk early."
  actions={
    <>
      <input
        value={selectedMonth}
        onChange={(event) => setSelectedMonth(event.target.value)}
        type="month"
        className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
      />

      <ActionButton
        onClick={autoFillBudgetFromActuals}
        disabled={autofilling}
      >
        {autofilling ? "Autofilling..." : "Autofill"}
      </ActionButton>

      <ActionButton
        variant="primary"
        onClick={() => setShowAddCategory((current) => !current)}
        className="bg-orange-600 hover:bg-orange-500"
      >
        + Add Category
      </ActionButton>
    </>
  }
/>

          <Panel variant="hero">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Monthly Budget Control
                </p>

                <p
                  className={
                    summary.totalRemaining >= 0
                      ? "mt-2 break-words text-4xl font-semibold text-emerald-300"
                      : "mt-2 break-words text-4xl font-semibold text-red-300"
                  }
                >
                  {formatCurrency(summary.totalRemaining)}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {formatCurrency(summary.totalActual)} spent of{" "}
                  {formatCurrency(summary.totalPlanned)} planned
                </p>

                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Actual spending</span>
                    <span>Planned budget</span>
                  </div>

                  <div className="mt-2 h-4 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={
                        summary.totalPlanned === 0 && summary.totalActual > 0
                          ? "h-full rounded-full bg-red-500"
                          : summary.totalRemaining < 0
                          ? "h-full rounded-full bg-red-500"
                          : summary.percentUsed >= 80
                          ? "h-full rounded-full bg-amber-500"
                          : "h-full rounded-full bg-emerald-500"
                      }
                      style={{
                        width: `${Math.max(
                          Math.min(summary.percentUsed, 100),
                          summary.totalActual > 0 ? 4 : 0
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {summary.totalPlanned === 0
                      ? "No planned budget yet. Add planned amounts or autofill from actuals."
                      : `${Math.round(
                          summary.percentUsed
                        )}% of planned budget used.`}
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <MetricCard
  title="Planned"
  value={formatCurrency(summary.totalPlanned)}
  tone="muted"
/>
<MetricCard
  title="Actual"
  value={formatCurrency(summary.totalActual)}
  tone="bad"
/>
<MetricCard
  title="Over Budget"
  value={String(summary.overBudgetCount)}
  tone={summary.overBudgetCount > 0 ? "warning" : "good"}
/>
              </div>
            </div>
          </Panel>

          {showAddCategory && (
            <Panel className="mt-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-medium">Add Budget Category</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Create custom categories and set monthly planned amounts.
                  </p>
                </div>

                <ActionButton
  onClick={() => setShowAddCategory(false)}
  className="rounded-lg px-3 py-2 text-xs"
>
  Close
</ActionButton>
              </div>

              <form
                onSubmit={addCustomCategory}
                noValidate
                className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <label className="text-sm text-slate-300">
                    Category Name
                  </label>
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Example: Motorcycle Fund"
                    className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="min-w-0">
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
                    className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <ActionButton
  type="submit"
  variant="primary"
  disabled={addingCategory}
  className="w-full"
>
  {addingCategory ? "Adding..." : "Save"}
</ActionButton>
                </div>
              </form>
            </Panel>
          )}

          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel>
              <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-medium">Category Budgets</h2>
                  <p className="text-sm text-slate-400">
                    {filteredBudgetRows.length} categor
                    {filteredBudgetRows.length === 1 ? "y" : "ies"} shown
                  </p>
                </div>

                <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {(["all", "over", "warning", "unplanned", "good"] as const).map(
                    (filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStatusFilter(filter)}
                        className={
                          statusFilter === filter
                            ? "shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium capitalize text-white"
                            : "shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs capitalize text-slate-400 hover:bg-slate-800"
                        }
                      >
                        {filter}
                      </button>
                    )
                  )}
                </div>
              </div>

              {filteredBudgetRows.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                  No budget categories match this filter.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                  {filteredBudgetRows.map((row) => (
                    <BudgetFeedRow
                      key={row.id}
                      row={row}
                      savingCategory={savingCategory}
                      deletingCategory={deletingCategory}
                      updateBudget={updateBudget}
                      deleteBudgetCategory={deleteBudgetCategory}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <aside className="min-w-0 space-y-6">
              <Panel>
                <h2 className="text-lg font-medium">Budget Health</h2>

                <div className="mt-5 space-y-4">
                  <SideMetric
                    label="Remaining"
                    value={formatCurrency(summary.totalRemaining)}
                    valueClass={
                      summary.totalRemaining < 0
                        ? "text-red-300"
                        : "text-emerald-300"
                    }
                  />
                  <SideMetric
                    label="Over-budget categories"
                    value={String(summary.overBudgetCount)}
                  />
                  <SideMetric
                    label="Watchlist categories"
                    value={String(summary.warningCount)}
                  />
                  <SideMetric
                    label="Unplanned spending"
                    value={formatCurrency(summary.unplannedSpending)}
                  />
                </div>

                <ActionButton
  variant="danger"
  onClick={resetBudget}
  disabled={resetting}
  className="mt-5 w-full"
>
  {resetting ? "Resetting..." : "Reset Budget"}
</ActionButton>
              </Panel>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Priority Review</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Categories needing attention first.
                </p>

                <div className="mt-5 space-y-3">
                  {topRiskRows.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No risky categories right now.
                    </p>
                  ) : (
                    topRiskRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {row.category}
                          </p>
                          <StatusBadge status={row.status} />
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          {formatCurrency(row.actualAmount)} spent of{" "}
                          {formatCurrency(row.plannedAmount)} planned
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Budget Insights</h2>

                <div className="mt-5 space-y-3">
                  <InsightCard
                    title="Monthly status"
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
                          }. Review those first.`
                        : "No categories are over budget right now."
                    }
                  />

                  <InsightCard
                    title="Next recommendation"
                    text={
                      summary.totalPlanned === 0
                        ? "Start by entering planned amounts for your biggest categories."
                        : "Review budgets weekly and adjust categories as spending changes."
                    }
                  />
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function BudgetFeedRow({
  row,
  savingCategory,
  deletingCategory,
  updateBudget,
  deleteBudgetCategory,
}: {
  row: BudgetRow;
  savingCategory: string;
  deletingCategory: string;
  updateBudget: (rowId: string, value: string) => void;
  deleteBudgetCategory: (row: BudgetRow) => void;
}) {
  const isOver = row.remaining < 0;

  return (
    <div className="min-w-0 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-lg font-semibold text-slate-100">
              {row.category}
            </p>
            <StatusBadge status={row.status} />
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {Math.round(row.percentUsed)}% used ·{" "}
            {isOver
              ? `${formatCurrency(Math.abs(row.remaining))} over`
              : `${formatCurrency(row.remaining)} remaining`}
          </p>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className={getProgressClass(row.status)}
              style={{
                width: `${Math.max(
                  Math.min(row.percentUsed, 100),
                  row.actualAmount > 0 ? 4 : 0
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start lg:shrink-0">
          <div className="w-full sm:w-40">
            <label className="text-xs text-slate-500">Planned</label>
            <input
              value={row.plannedAmount}
              onChange={(event) => updateBudget(row.id, event.target.value)}
              type="number"
              step="1"
              className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 outline-none focus:border-blue-500"
            />
            {savingCategory === row.id && (
              <p className="mt-1 text-xs text-blue-300">Saving...</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => deleteBudgetCategory(row)}
            disabled={deletingCategory === row.id}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:border-red-900 hover:bg-red-950 hover:text-red-300 disabled:opacity-60 sm:mt-5"
          >
            {deletingCategory === row.id ? "..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
        <BudgetMiniStat
          label="Planned"
          value={formatCurrency(row.plannedAmount)}
        />
        <BudgetMiniStat
          label="Actual"
          value={formatCurrency(row.actualAmount)}
        />
        <BudgetMiniStat
          label="Remaining"
          value={formatCurrency(row.remaining)}
          valueClass={isOver ? "text-red-300" : "text-emerald-300"}
        />
      </div>
    </div>
  );
}

// function BudgetMetricTile({
//   title,
//   value,
//   tone,
// }: {
//   title: string;
//   value: string;
//   tone: "good" | "expense" | "danger" | "neutral";
// }) {
//   return (
//     <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
//       <p className="text-sm text-slate-500">{title}</p>
//       <p
//         className={
//           tone === "good"
//             ? "mt-2 break-words text-2xl font-semibold text-emerald-300"
//             : tone === "expense"
//             ? "mt-2 break-words text-2xl font-semibold text-red-300"
//             : tone === "danger"
//             ? "mt-2 break-words text-2xl font-semibold text-amber-300"
//             : "mt-2 break-words text-2xl font-semibold text-slate-200"
//         }
//       >
//         {value}
//       </p>
//     </div>
//   );
// }

function BudgetMiniStat({
  label,
  value,
  valueClass = "text-slate-100",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 break-words text-lg font-semibold ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function SideMetric({
  label,
  value,
  valueClass = "text-slate-100",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <span className="min-w-0 text-sm text-slate-400">{label}</span>
      <span className={`shrink-0 text-sm font-medium ${valueClass}`}>
        {value}
      </span>
    </div>
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

function getProgressClass(status: BudgetRowStatus) {
  const base = "h-3 rounded-full ";

  if (status === "over" || status === "unplanned") return base + "bg-red-500";
  if (status === "warning") return base + "bg-amber-500";
  return base + "bg-emerald-500";
}

function StatusBadge({ status }: { status: BudgetRowStatus }) {
  const tone =
    status === "over" || status === "unplanned"
      ? "bad"
      : status === "warning"
      ? "warning"
      : "good";

  const label =
    status === "over"
      ? "Over"
      : status === "unplanned"
      ? "Unplanned"
      : status === "warning"
      ? "Watch"
      : "Good";

  return <StatusPill tone={tone}>{label}</StatusPill>;
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
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
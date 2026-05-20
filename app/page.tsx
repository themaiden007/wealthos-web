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
  category: string;
  plannedAmount: number;
};

type GoalType =
  | "emergency_fund"
  | "debt_payoff"
  | "investment"
  | "large_purchase"
  | "savings"
  | "other";

type Goal = {
  id: string;
  name: string;
  goalType: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  monthlyContribution: number;
  notes: string;
  createdAt: string;
};

const BUDGET_STORAGE_KEY = "wealthos_budget_v1";
const GOALS_STORAGE_KEY = "wealthos_goals_v1";

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

export default function HomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        setUserEmail(user.email || "");

        const { data: accountData, error: accountError } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (accountError) {
          console.error("Failed to load accounts:", accountError);
          alert(accountError.message);
          return;
        }

        const { data: transactionData, error: transactionError } =
          await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });

        if (transactionError) {
          console.error("Failed to load transactions:", transactionError);
          alert(transactionError.message);
          return;
        }

        setAccounts((accountData || []) as Account[]);
        setTransactions((transactionData || []) as Transaction[]);

        const savedBudget = window.localStorage.getItem(BUDGET_STORAGE_KEY);
        const savedGoals = window.localStorage.getItem(GOALS_STORAGE_KEY);

        if (savedBudget) {
          const parsedBudget = JSON.parse(savedBudget);

          if (Array.isArray(parsedBudget)) {
            setBudgetItems(parsedBudget);
          }
        }

        if (savedGoals) {
          const parsedGoals = JSON.parse(savedGoals);

          if (Array.isArray(parsedGoals)) {
            setGoals(parsedGoals);
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setHasLoaded(true);
      }
    }

    loadDashboard();
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const accountTotals = useMemo(() => {
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

  const monthlySummary = useMemo(() => {
    const monthTransactions = transactions.filter((transaction) =>
      transaction.date.startsWith(currentMonth)
    );

    const income = monthTransactions
      .filter((transaction) => transaction.transaction_type === "income")
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);

    const spending = monthTransactions
      .filter((transaction) => transaction.transaction_type === "expense")
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);

    return {
      income,
      spending,
      cashFlow: income - spending,
    };
  }, [transactions, currentMonth]);

  const budgetSummary = useMemo(() => {
    const monthTransactions = transactions.filter(
      (transaction) =>
        transaction.date.startsWith(currentMonth) &&
        transaction.transaction_type === "expense"
    );

    const totalPlanned = budgetItems.reduce(
      (sum, item) => sum + Number(item.plannedAmount || 0),
      0
    );

    const totalActual = monthTransactions.reduce(
      (sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)),
      0
    );

    return {
      totalPlanned,
      totalActual,
      remaining: totalPlanned - totalActual,
    };
  }, [transactions, budgetItems, currentMonth]);

  const goalSummary = useMemo(() => {
    const totalTarget = goals.reduce(
      (sum, goal) => sum + Number(goal.targetAmount || 0),
      0
    );

    const totalCurrent = goals.reduce(
      (sum, goal) => sum + Number(goal.currentAmount || 0),
      0
    );

    const progress =
      totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;

    const activeGoals = goals.filter(
      (goal) => Number(goal.currentAmount) < Number(goal.targetAmount)
    ).length;

    const completedGoals = goals.filter(
      (goal) => Number(goal.currentAmount) >= Number(goal.targetAmount)
    ).length;

    return {
      totalTarget,
      totalCurrent,
      remaining: Math.max(totalTarget - totalCurrent, 0),
      progress,
      activeGoals,
      completedGoals,
    };
  }, [goals]);

  function getAccountName(id: string) {
    return accounts.find((account) => account.id === id)?.name || "Unknown";
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading dashboard...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">WealthOS MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">
              Financial Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Supabase-backed finance tracker with accounts, transactions,
              budgets, goals, cash flow, and net worth.
            </p>
            {userEmail && (
              <p className="mt-1 text-xs text-slate-600">
                Logged in as {userEmail}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/accounts"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Manage Accounts
            </Link>

            <Link
              href="/transactions"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Add Transactions
            </Link>

            <Link
              href="/budgets"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Budget
            </Link>

            <Link
              href="/goals"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Goals
            </Link>

            <Link
              href="/insights"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Insights
            </Link>

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
          <DashboardCard
            title="Net Worth"
            value={formatCurrency(accountTotals.netWorth)}
            subtitle="Assets minus liabilities"
          />

          <DashboardCard
            title="Assets"
            value={formatCurrency(accountTotals.assets)}
            subtitle="Cash, investments, property"
          />

          <DashboardCard
            title="Liabilities"
            value={formatCurrency(accountTotals.liabilities)}
            subtitle="Credit cards, loans, debt"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Monthly Income"
            value={formatCurrency(monthlySummary.income)}
            subtitle={`Income in ${currentMonth}`}
          />

          <DashboardCard
            title="Monthly Spending"
            value={formatCurrency(monthlySummary.spending)}
            subtitle={`Expenses in ${currentMonth}`}
          />

          <DashboardCard
            title="Monthly Cash Flow"
            value={formatCurrency(monthlySummary.cashFlow)}
            subtitle="Income minus spending"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Budget Remaining"
            value={formatCurrency(budgetSummary.remaining)}
            subtitle={`${formatCurrency(
              budgetSummary.totalActual
            )} spent of ${formatCurrency(budgetSummary.totalPlanned)} planned`}
          />

          <DashboardCard
            title="Goal Progress"
            value={`${Math.round(goalSummary.progress)}%`}
            subtitle={`${formatCurrency(
              goalSummary.totalCurrent
            )} saved of ${formatCurrency(goalSummary.totalTarget)}`}
          />

          <DashboardCard
            title="Active Goals"
            value={String(goalSummary.activeGoals)}
            subtitle={`${formatCurrency(goalSummary.remaining)} remaining`}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-medium">Recent Transactions</h2>
                <p className="text-sm text-slate-400">
                  Latest Supabase income, expenses, and transfers.
                </p>
              </div>

              <Link
                href="/transactions"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View all →
              </Link>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.slice(0, 8).map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{transaction.name}</p>
                          <p className="text-xs text-slate-500">
                            {transaction.date} • {transaction.transaction_type}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {getAccountName(transaction.account_id)}
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {transaction.category}
                      </td>

                      <td className="px-4 py-3 text-right font-medium">
                        <span
                          className={
                            transaction.transaction_type === "income"
                              ? "text-emerald-300"
                              : transaction.transaction_type === "expense"
                              ? "text-red-300"
                              : "text-slate-300"
                          }
                        >
                          {transaction.transaction_type === "income"
                            ? "+"
                            : transaction.transaction_type === "expense"
                            ? "-"
                            : ""}
                          {formatCurrency(Number(transaction.amount))}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No Supabase transactions yet. Add your first transaction
                        or import CSV data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Budget Snapshot</h2>
                <Link
                  href="/budget"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Edit →
                </Link>
              </div>

              <div className="space-y-4">
                <MiniMetric
                  label="Planned Budget"
                  value={formatCurrency(budgetSummary.totalPlanned)}
                />
                <MiniMetric
                  label="Actual Spending"
                  value={formatCurrency(budgetSummary.totalActual)}
                />
                <MiniMetric
                  label="Remaining"
                  value={formatCurrency(budgetSummary.remaining)}
                  valueClass={
                    budgetSummary.remaining < 0
                      ? "text-red-300"
                      : "text-emerald-300"
                  }
                />
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-300">
                  {budgetSummary.totalPlanned === 0
                    ? "Set planned budget amounts to activate budget tracking."
                    : budgetSummary.remaining >= 0
                    ? `You have ${formatCurrency(
                        budgetSummary.remaining
                      )} left in your monthly budget.`
                    : `You are ${formatCurrency(
                        Math.abs(budgetSummary.remaining)
                      )} over your monthly budget.`}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Goal Snapshot</h2>
                <Link
                  href="/goals"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Edit →
                </Link>
              </div>

              <div className="space-y-4">
                <MiniMetric
                  label="Total Target"
                  value={formatCurrency(goalSummary.totalTarget)}
                />
                <MiniMetric
                  label="Current Progress"
                  value={formatCurrency(goalSummary.totalCurrent)}
                />
                <MiniMetric
                  label="Remaining"
                  value={formatCurrency(goalSummary.remaining)}
                />
                <MiniMetric
                  label="Completed Goals"
                  value={String(goalSummary.completedGoals)}
                />
              </div>

              <div className="mt-5">
                <div className="h-3 w-full rounded-full bg-slate-800">
                  <div
                    className="h-3 rounded-full bg-blue-500"
                    style={{ width: `${goalSummary.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {Math.round(goalSummary.progress)}% complete across all goals
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">Build Progress</h2>

              <div className="mt-5 space-y-4">
                <ProgressItem done label="Project created" />
                <ProgressItem done label="Auth" />
                <ProgressItem done label="Supabase accounts" />
                <ProgressItem done label="Supabase transactions" />
                <ProgressItem done label="CSV import" />
                <ProgressItem done label="Budgets" />
                <ProgressItem done label="Goals" />
                <ProgressItem done label="Insights" />
                <ProgressItem label="Supabase budgets" />
                <ProgressItem label="Supabase goals" />
                <ProgressItem label="Plaid sandbox" />
              </div>

              <div className="mt-6 rounded-xl border border-blue-900 bg-blue-950/30 p-4">
                <p className="text-sm font-medium text-blue-200">
                  Recommended next step
                </p>
                <p className="mt-1 text-sm text-blue-100/80">
                  Migrate Budget and Goals to Supabase so every major module is
                  cloud-backed.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  valueClass = "text-slate-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function ProgressItem({
  label,
  done = false,
}: {
  label: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span
        className={
          done
            ? "rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
            : "rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400"
        }
      >
        {done ? "Done" : "Next"}
      </span>
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
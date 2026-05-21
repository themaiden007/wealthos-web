"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type GoalType =
  | "emergency_fund"
  | "debt_payoff"
  | "investment"
  | "large_purchase"
  | "savings"
  | "other";

type Goal = {
  id: string;
  user_id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  monthly_contribution: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AiInsightResponse = {
  summary: string;
  insights: Array<{
    title: string;
    detail: string;
    severity: "good" | "warning" | "danger" | "info";
  }>;
  actionPlan: Array<{
    title: string;
    detail: string;
  }>;
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

export default function InsightsPage() {
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [aiInsights, setAiInsights] = useState<AiInsightResponse | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserEmail(user.email || "");

      const [
        accountsResponse,
        transactionsResponse,
        budgetResponse,
        goalsResponse,
      ] = await Promise.all([
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("budget_items")
          .select("*")
          .eq("user_id", user.id)
          .order("category", { ascending: true }),

        supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (accountsResponse.error) {
        showToast({
          type: "error",
          title: "Failed to load accounts",
          message: accountsResponse.error.message,
        });
      } else {
        setAccounts((accountsResponse.data || []) as Account[]);
      }

      if (transactionsResponse.error) {
        showToast({
          type: "error",
          title: "Failed to load transactions",
          message: transactionsResponse.error.message,
        });
      } else {
        setTransactions((transactionsResponse.data || []) as Transaction[]);
      }

      if (budgetResponse.error) {
        showToast({
          type: "error",
          title: "Failed to load budget",
          message: budgetResponse.error.message,
        });
      } else {
        setBudgetItems((budgetResponse.data || []) as BudgetItem[]);
      }

      if (goalsResponse.error) {
        showToast({
          type: "error",
          title: "Failed to load goals",
          message: goalsResponse.error.message,
        });
      } else {
        setGoals((goalsResponse.data || []) as Goal[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, [showToast]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const accountSummary = useMemo(() => {
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
      activeAccounts: activeAccounts.length,
    };
  }, [accounts]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter((transaction) =>
      transaction.date.startsWith(currentMonth)
    );
  }, [transactions, currentMonth]);

  const monthlySummary = useMemo(() => {
    const income = monthlyTransactions
      .filter((transaction) => transaction.transaction_type === "income")
      .reduce(
        (sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)),
        0
      );

    const spending = monthlyTransactions
      .filter((transaction) => transaction.transaction_type === "expense")
      .reduce(
        (sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)),
        0
      );

    const transfers = monthlyTransactions
      .filter((transaction) => transaction.transaction_type === "transfer")
      .reduce(
        (sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)),
        0
      );

    const cashFlow = income - spending;
    const savingsRate = income > 0 ? (cashFlow / income) * 100 : 0;

    return {
      income,
      spending,
      transfers,
      cashFlow,
      savingsRate,
      transactionCount: monthlyTransactions.length,
    };
  }, [monthlyTransactions]);

  const topSpendingCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    monthlyTransactions
      .filter((transaction) => transaction.transaction_type === "expense")
      .forEach((transaction) => {
        categoryMap.set(
          transaction.category,
          (categoryMap.get(transaction.category) || 0) +
            Math.abs(Number(transaction.amount || 0))
        );
      });

    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [monthlyTransactions]);

  const budgetSummary = useMemo(() => {
    const expenseTransactions = monthlyTransactions.filter(
      (transaction) => transaction.transaction_type === "expense"
    );

    const spendingByCategory = new Map<string, number>();

    expenseTransactions.forEach((transaction) => {
      spendingByCategory.set(
        transaction.category,
        (spendingByCategory.get(transaction.category) || 0) +
          Math.abs(Number(transaction.amount || 0))
      );
    });

    const totalPlanned = budgetItems.reduce(
      (sum, item) => sum + Number(item.planned_amount || 0),
      0
    );

    const totalActual = expenseTransactions.reduce(
      (sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)),
      0
    );

    const overBudgetCategories = budgetItems
      .map((item) => {
        const planned = Number(item.planned_amount || 0);
        const actual = spendingByCategory.get(item.category) || 0;

        return {
          category: item.category,
          planned,
          actual,
          overBy: Math.max(actual - planned, 0),
        };
      })
      .filter((item) => item.planned > 0 && item.actual > item.planned)
      .sort((a, b) => b.overBy - a.overBy);

    return {
      totalPlanned,
      totalActual,
      totalRemaining: totalPlanned - totalActual,
      overBudgetCategories,
    };
  }, [monthlyTransactions, budgetItems]);

  const goalSummary = useMemo(() => {
    const preparedGoals = goals.map((goal) => ({
      name: goal.name,
      targetAmount: Number(goal.target_amount || 0),
      currentAmount: Number(goal.current_amount || 0),
      remaining: Math.max(
        Number(goal.target_amount || 0) - Number(goal.current_amount || 0),
        0
      ),
      targetDate: goal.target_date,
      monthlyContribution: Number(goal.monthly_contribution || 0),
    }));

    const totalTarget = preparedGoals.reduce(
      (sum, goal) => sum + goal.targetAmount,
      0
    );

    const totalCurrent = preparedGoals.reduce(
      (sum, goal) => sum + goal.currentAmount,
      0
    );

    return {
      goals: preparedGoals,
      totalTarget,
      totalCurrent,
      remaining: Math.max(totalTarget - totalCurrent, 0),
      progress:
        totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0,
    };
  }, [goals]);

  const ruleBasedInsights = useMemo(() => {
    const insights: Array<{
      title: string;
      detail: string;
      severity: "good" | "warning" | "danger" | "info";
    }> = [];

    if (monthlySummary.cashFlow >= 0) {
      insights.push({
        title: "Positive monthly cash flow",
        detail: `You are cash-flow positive by ${formatCurrency(
          monthlySummary.cashFlow
        )} this month.`,
        severity: "good",
      });
    } else {
      insights.push({
        title: "Negative monthly cash flow",
        detail: `You are cash-flow negative by ${formatCurrency(
          Math.abs(monthlySummary.cashFlow)
        )} this month. Review flexible spending first.`,
        severity: "danger",
      });
    }

    if (budgetSummary.totalPlanned === 0) {
      insights.push({
        title: "Budget setup needed",
        detail:
          "You have not set planned budget amounts yet. Add planned amounts to unlock better budget insights.",
        severity: "warning",
      });
    } else if (budgetSummary.totalRemaining >= 0) {
      insights.push({
        title: "Budget is currently under control",
        detail: `You have ${formatCurrency(
          budgetSummary.totalRemaining
        )} remaining against your planned budget.`,
        severity: "good",
      });
    } else {
      insights.push({
        title: "Budget is over plan",
        detail: `You are ${formatCurrency(
          Math.abs(budgetSummary.totalRemaining)
        )} over your planned budget.`,
        severity: "warning",
      });
    }

    if (topSpendingCategories.length > 0) {
      insights.push({
        title: "Largest spending category",
        detail: `${topSpendingCategories[0].category} is your largest spending category this month at ${formatCurrency(
          topSpendingCategories[0].amount
        )}.`,
        severity: "info",
      });
    }

    if (goalSummary.goals.length === 0) {
      insights.push({
        title: "No goals yet",
        detail:
          "Add at least one financial goal so WealthOS can track progress and recommend next actions.",
        severity: "info",
      });
    } else {
      insights.push({
        title: "Goal progress",
        detail: `You are ${Math.round(
          goalSummary.progress
        )}% complete across all tracked goals.`,
        severity: goalSummary.progress >= 50 ? "good" : "info",
      });
    }

    return insights;
  }, [monthlySummary, budgetSummary, topSpendingCategories, goalSummary]);

  async function generateAiInsights() {
    setGenerating(true);

    const payload = {
      netWorth: accountSummary.netWorth,
      assets: accountSummary.assets,
      liabilities: accountSummary.liabilities,
      monthlyIncome: monthlySummary.income,
      monthlySpending: monthlySummary.spending,
      monthlyCashFlow: monthlySummary.cashFlow,
      budgetPlanned: budgetSummary.totalPlanned,
      budgetActual: budgetSummary.totalActual,
      budgetRemaining: budgetSummary.totalRemaining,
      overBudgetCategories: budgetSummary.overBudgetCategories.slice(0, 5),
      topSpendingCategories,
      goals: goalSummary.goals.slice(0, 8),
      transactionCount: monthlySummary.transactionCount,
    };

    try {
      const response = await fetch("/api/ai-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as AiInsightResponse;

      setAiInsights(data);

      showToast({
        type: "success",
        title: "AI insights generated",
        message: "Your latest WealthOS analysis is ready.",
      });
    } catch (error) {
      console.error("Failed to generate AI insights:", error);

      showToast({
        type: "error",
        title: "AI insights failed",
        message: "Could not generate AI insights right now.",
      });
    } finally {
      setGenerating(false);
    }
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            Loading insights...
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
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/50 p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm text-blue-300">WealthOS Intelligence</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                  Insights
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Review your financial snapshot, rule-based insights, and
                  AI-generated analysis from your Supabase data.
                </p>
              </div>

              <button
                type="button"
                onClick={generateAiInsights}
                disabled={generating}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {generating ? "Generating..." : "Generate AI Insights"}
              </button>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Net Worth"
              value={formatCurrency(accountSummary.netWorth)}
              subtitle={`${formatCurrency(accountSummary.assets)} assets`}
              tone={accountSummary.netWorth >= 0 ? "good" : "danger"}
            />

            <MetricCard
              title="Monthly Cash Flow"
              value={formatCurrency(monthlySummary.cashFlow)}
              subtitle={`${formatCurrency(monthlySummary.income)} income`}
              tone={monthlySummary.cashFlow >= 0 ? "good" : "danger"}
            />

            <MetricCard
              title="Budget Remaining"
              value={formatCurrency(budgetSummary.totalRemaining)}
              subtitle={`${formatCurrency(
                budgetSummary.totalActual
              )} actual spending`}
              tone={budgetSummary.totalRemaining >= 0 ? "good" : "warning"}
            />

            <MetricCard
              title="Goal Progress"
              value={`${Math.round(goalSummary.progress)}%`}
              subtitle={`${formatCurrency(goalSummary.remaining)} remaining`}
              tone={goalSummary.progress >= 50 ? "good" : "info"}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium">AI Analysis</h2>
                    <p className="text-sm text-slate-400">
                      Generated from your current accounts, transactions,
                      budgets, and goals.
                    </p>
                  </div>

                  {aiInsights && (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                      Generated
                    </span>
                  )}
                </div>

                {!aiInsights ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center">
                    <p className="text-sm font-medium text-slate-200">
                      No AI insights generated yet
                    </p>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                      Click Generate AI Insights to create a concise analysis.
                      If no OpenAI key is configured, WealthOS will return a
                      safe rule-based fallback.
                    </p>

                    <button
                      type="button"
                      onClick={generateAiInsights}
                      disabled={generating}
                      className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {generating ? "Generating..." : "Generate AI Insights"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-blue-900 bg-blue-950/30 p-5">
                      <p className="text-sm font-medium text-blue-200">
                        Summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-blue-100/80">
                        {aiInsights.summary}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {aiInsights.insights.map((insight) => (
                        <InsightCard
                          key={insight.title}
                          title={insight.title}
                          detail={insight.detail}
                          severity={insight.severity}
                        />
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                      <h3 className="text-sm font-medium text-slate-200">
                        Action Plan
                      </h3>

                      <div className="mt-4 space-y-3">
                        {aiInsights.actionPlan.map((action, index) => (
                          <div
                            key={`${action.title}-${index}`}
                            className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                          >
                            <p className="text-sm font-medium text-slate-200">
                              {index + 1}. {action.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-400">
                              {action.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Rule-Based Insights</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Always available, even without an AI API key.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {ruleBasedInsights.map((insight) => (
                    <InsightCard
                      key={insight.title}
                      title={insight.title}
                      detail={insight.detail}
                      severity={insight.severity}
                    />
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Data Readiness</h2>
                <p className="mt-1 text-sm text-slate-400">
                  More complete data creates better insights.
                </p>

                <div className="mt-5 space-y-4">
                  <ReadinessRow
                    label="Accounts"
                    value={`${accountSummary.activeAccounts} active`}
                    complete={accountSummary.activeAccounts > 0}
                    href="/accounts"
                  />
                  <ReadinessRow
                    label="Transactions"
                    value={`${monthlySummary.transactionCount} this month`}
                    complete={monthlySummary.transactionCount > 0}
                    href="/transactions"
                  />
                  <ReadinessRow
                    label="Budgets"
                    value={`${budgetItems.length} categories`}
                    complete={budgetItems.length > 0}
                    href="/budgets"
                  />
                  <ReadinessRow
                    label="Goals"
                    value={`${goals.length} tracked`}
                    complete={goals.length > 0}
                    href="/goals"
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Top Spending</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Largest expense categories this month.
                </p>

                {topSpendingCategories.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-500">
                    No expense transactions this month yet.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {topSpendingCategories.map((row) => (
                      <div key={row.category}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="break-words text-slate-300">
                            {row.category}
                          </span>
                          <span className="shrink-0 font-medium text-slate-200">
                            {formatCurrency(row.amount)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{
                              width: `${getCategoryPercent(
                                row.amount,
                                monthlySummary.spending
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h2 className="text-lg font-medium">Quick Actions</h2>

                <div className="mt-5 grid gap-3">
                  <QuickAction href="/accounts" label="Update Accounts" />
                  <QuickAction
                    href="/transactions"
                    label="Add Transactions"
                  />
                  <QuickAction href="/budgets" label="Review Budgets" />
                  <QuickAction href="/goals" label="Update Goals" />
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone = "info",
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "good" | "warning" | "danger" | "info";
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${toneClass(tone)}`} />
      </div>
    </div>
  );
}

function InsightCard({
  title,
  detail,
  severity,
}: {
  title: string;
  detail: string;
  severity: "good" | "warning" | "danger" | "info";
}) {
  return (
    <div className={`rounded-2xl border p-5 ${insightClass(severity)}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 opacity-85">{detail}</p>
    </div>
  );
}

function ReadinessRow({
  label,
  value,
  complete,
  href,
}: {
  label: string;
  value: string;
  complete: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:bg-slate-900"
    >
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{value}</p>
      </div>

      <span
        className={
          complete
            ? "rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
            : "rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-300"
        }
      >
        {complete ? "Ready" : "Needs data"}
      </span>
    </Link>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}

function toneClass(tone: "good" | "warning" | "danger" | "info") {
  if (tone === "good") return "bg-emerald-400";
  if (tone === "warning") return "bg-amber-400";
  if (tone === "danger") return "bg-red-400";
  return "bg-blue-400";
}

function insightClass(severity: "good" | "warning" | "danger" | "info") {
  if (severity === "good") {
    return "border-emerald-900 bg-emerald-950/30 text-emerald-100";
  }

  if (severity === "warning") {
    return "border-amber-900 bg-amber-950/30 text-amber-100";
  }

  if (severity === "danger") {
    return "border-red-900 bg-red-950/30 text-red-100";
  }

  return "border-blue-900 bg-blue-950/30 text-blue-100";
}

function getCategoryPercent(amount: number, total: number) {
  if (total <= 0) return 0;
  return Math.min((amount / total) * 100, 100);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
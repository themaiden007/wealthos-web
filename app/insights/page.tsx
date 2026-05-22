"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";
import {
  BudgetPlannedActualChart,
  CashFlowBreakdownChart,
  GoalProgressChart,
  MoneyFlowSankey,
  TopSpendingChart,
} from "@/components/WealthCharts";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import MetricCard from "@/components/ui/MetricCard";
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
    const categoryMap = new Map<
      string,
      {
        amount: number;
        children: Map<string, number>;
      }
    >();

    monthlyTransactions
      .filter((transaction) => transaction.transaction_type === "expense")
      .forEach((transaction) => {
        const category = transaction.category || "Uncategorized";
        const merchant =
          transaction.merchant_name ||
          transaction.name ||
          "Other Transactions";

        const amount = Math.abs(Number(transaction.amount || 0));

        const existing = categoryMap.get(category) || {
          amount: 0,
          children: new Map<string, number>(),
        };

        existing.amount += amount;
        existing.children.set(
          merchant,
          (existing.children.get(merchant) || 0) + amount
        );

        categoryMap.set(category, existing);
      });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        children: Array.from(data.children.entries())
          .map(([name, amount]) => ({
            name,
            amount,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
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

  const budgetChartRows = useMemo(() => {
    return budgetItems.map((item) => {
      const actual =
        monthlyTransactions
          .filter(
            (transaction) =>
              transaction.transaction_type === "expense" &&
              transaction.category === item.category
          )
          .reduce(
            (sum, transaction) =>
              sum + Math.abs(Number(transaction.amount || 0)),
            0
          ) || 0;

      return {
        category: item.category,
        planned: Number(item.planned_amount || 0),
        actual,
      };
    });
  }, [budgetItems, monthlyTransactions]);

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

  const goalsChartRows = useMemo(() => {
    return goals.map((goal) => ({
      name: goal.name,
      targetAmount: Number(goal.target_amount || 0),
      currentAmount: Number(goal.current_amount || 0),
    }));
  }, [goals]);

  const estimatedGoalsContribution = useMemo(() => {
    return goals.reduce(
      (sum, goal) => sum + Number(goal.monthly_contribution || 0),
      0
    );
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
        detail: `${
          topSpendingCategories[0].category
        } is your largest spending category this month at ${formatCurrency(
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
          <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-6">
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
        <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
          <PageHeader
            eyebrow="WealthOS Intelligence"
            title="Insights"
            description="Review your financial snapshot, visual trends, money flow, and AI-generated analysis from your Supabase data."
            actions={
              <ActionButton
                variant="primary"
                onClick={generateAiInsights}
                disabled={generating}
              >
                {generating ? "Generating..." : "Generate AI Insights"}
              </ActionButton>
            }
          />

          <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Net Worth"
              value={formatCurrency(accountSummary.netWorth)}
              subtitle={`${formatCurrency(accountSummary.assets)} assets`}
              tone={accountSummary.netWorth >= 0 ? "good" : "bad"}
            />

            <MetricCard
              title="Monthly Cash Flow"
              value={formatCurrency(monthlySummary.cashFlow)}
              subtitle={`${formatCurrency(monthlySummary.income)} income`}
              tone={monthlySummary.cashFlow >= 0 ? "good" : "bad"}
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
              tone={goalSummary.progress >= 50 ? "good" : "muted"}
            />
          </section>

          <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
            <div className="min-w-0 overflow-hidden">
              <CashFlowBreakdownChart
                data={{
                  income: monthlySummary.income,
                  spending: monthlySummary.spending,
                  cashFlow: monthlySummary.cashFlow,
                }}
              />
            </div>

            <div className="min-w-0 overflow-hidden">
              <TopSpendingChart data={topSpendingCategories} />
            </div>

            <div className="min-w-0 overflow-hidden">
              <BudgetPlannedActualChart data={budgetChartRows} />
            </div>

            <div className="min-w-0 overflow-hidden">
              <GoalProgressChart data={goalsChartRows} />
            </div>
          </section>

          <section className="mt-6 min-w-0 overflow-hidden">
            <div className="min-w-0 max-w-full overflow-hidden [&_*]:max-w-full [&_svg]:max-w-full">
              <MoneyFlowSankey
                income={monthlySummary.income}
                spendingCategories={topSpendingCategories}
                remainingCashFlow={monthlySummary.cashFlow}
                goalsContribution={estimatedGoalsContribution}
              />
            </div>
          </section>

          <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 space-y-6">
              <Panel className="rounded-3xl">
                <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-lg font-medium">AI Analysis</h2>

                    <p className="text-sm text-slate-400">
                      Generated from your current accounts, transactions,
                      budgets, and goals.
                    </p>
                  </div>

                  {aiInsights && <StatusPill tone="good">Generated</StatusPill>}
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

                    <ActionButton
                      variant="primary"
                      onClick={generateAiInsights}
                      disabled={generating}
                      className="mt-5"
                    >
                      {generating ? "Generating..." : "Generate AI Insights"}
                    </ActionButton>
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

                    <div className="grid min-w-0 gap-4 md:grid-cols-2">
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
              </Panel>

              <Panel className="rounded-3xl">
                <h2 className="text-lg font-medium">Rule-Based Insights</h2>

                <p className="mt-1 text-sm text-slate-400">
                  Always available, even without an AI API key.
                </p>

                <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
                  {ruleBasedInsights.map((insight) => (
                    <InsightCard
                      key={insight.title}
                      title={insight.title}
                      detail={insight.detail}
                      severity={insight.severity}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <aside className="min-w-0 space-y-6">
              <Panel className="rounded-3xl">
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
              </Panel>

              <Panel className="rounded-3xl">
                <h2 className="text-lg font-medium">Quick Actions</h2>

                <div className="mt-5 grid gap-3">
                  <QuickAction href="/accounts" label="Update Accounts" />

                  <QuickAction href="/transactions" label="Add Transactions" />

                  <QuickAction href="/budgets" label="Review Budgets" />

                  <QuickAction href="/goals" label="Update Goals" />
                </div>
              </Panel>
            </aside>
          </section>
        </div>
      </div>
    </main>
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
    <div className={`min-w-0 rounded-2xl border p-5 ${insightClass(severity)}`}>
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
      className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:bg-slate-900"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>

        <p className="mt-1 text-xs text-slate-500">{value}</p>
      </div>

      <StatusPill tone={complete ? "good" : "warning"}>
        {complete ? "Ready" : "Needs data"}
      </StatusPill>
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
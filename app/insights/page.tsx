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

type Insight = {
  title: string;
  severity: "good" | "warning" | "danger" | "info";
  message: string;
  action: string;
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

const QUICK_QUESTIONS = [
  "Where did my money go this month?",
  "Am I over budget?",
  "How is my cash flow?",
  "What are my top spending categories?",
  "Am I on track with my goals?",
  "What should I fix first?",
];

export default function InsightsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    async function initialize() {
      try {
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
          alert(accountsResponse.error.message);
          return;
        }

        if (transactionsResponse.error) {
          alert(transactionsResponse.error.message);
          return;
        }

        if (budgetResponse.error) {
          alert(budgetResponse.error.message);
          return;
        }

        if (goalsResponse.error) {
          alert(goalsResponse.error.message);
          return;
        }

        setAccounts((accountsResponse.data || []) as Account[]);
        setTransactions((transactionsResponse.data || []) as Transaction[]);
        setBudgetItems((budgetResponse.data || []) as BudgetItem[]);
        setGoals((goalsResponse.data || []) as Goal[]);
      } catch (error) {
        console.error("Failed to load insights data:", error);
      } finally {
        setHasLoaded(true);
      }
    }

    initialize();
  }, []);

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

  const monthlySummary = useMemo(() => {
    const monthTransactions = transactions.filter((transaction) =>
      transaction.date.startsWith(currentMonth)
    );

    const income = monthTransactions
      .filter((transaction) => transaction.transaction_type === "income")
      .reduce(
        (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
        0
      );

    const spending = monthTransactions
      .filter((transaction) => transaction.transaction_type === "expense")
      .reduce(
        (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
        0
      );

    const transfers = monthTransactions
      .filter((transaction) => transaction.transaction_type === "transfer")
      .reduce(
        (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
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
      transactionCount: monthTransactions.length,
    };
  }, [transactions, currentMonth]);

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();

    transactions
      .filter(
        (transaction) =>
          transaction.date.startsWith(currentMonth) &&
          transaction.transaction_type === "expense"
      )
      .forEach((transaction) => {
        map.set(
          transaction.category,
          (map.get(transaction.category) || 0) +
            Math.abs(Number(transaction.amount))
        );
      });

    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, currentMonth]);

  const budgetSummary = useMemo(() => {
    const totalPlanned = budgetItems.reduce(
      (sum, item) => sum + Number(item.planned_amount || 0),
      0
    );

    const totalActual = monthlySummary.spending;

    const overBudgetCategories = budgetItems
      .map((item) => {
        const actual =
          spendingByCategory.find((row) => row.category === item.category)
            ?.amount || 0;

        return {
          category: item.category,
          planned: Number(item.planned_amount || 0),
          actual,
          difference: Number(item.planned_amount || 0) - actual,
        };
      })
      .filter((row) => row.planned > 0 && row.actual > row.planned)
      .sort((a, b) => a.difference - b.difference);

    return {
      totalPlanned,
      totalActual,
      remaining: totalPlanned - totalActual,
      overBudgetCategories,
    };
  }, [budgetItems, spendingByCategory, monthlySummary.spending]);

  const goalSummary = useMemo(() => {
    const totalTarget = goals.reduce(
      (sum, goal) => sum + Number(goal.target_amount || 0),
      0
    );

    const totalCurrent = goals.reduce(
      (sum, goal) => sum + Number(goal.current_amount || 0),
      0
    );

    const activeGoals = goals.filter(
      (goal) => Number(goal.current_amount) < Number(goal.target_amount)
    );

    const progress =
      totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;

    return {
      totalTarget,
      totalCurrent,
      remaining: Math.max(totalTarget - totalCurrent, 0),
      activeGoals,
      progress,
    };
  }, [goals]);

  const insights = useMemo(() => {
    return generateInsights({
      accountSummary,
      monthlySummary,
      budgetSummary,
      goalSummary,
      spendingByCategory,
    });
  }, [
    accountSummary,
    monthlySummary,
    budgetSummary,
    goalSummary,
    spendingByCategory,
  ]);

  function askQuestion(customQuestion?: string) {
    const q = customQuestion || question;

    if (!q.trim()) {
      setAnswer("Ask a question first, or use one of the quick prompts.");
      return;
    }

    const response = generateAnswer(q, {
      accountSummary,
      monthlySummary,
      budgetSummary,
      goalSummary,
      spendingByCategory,
      currentMonth,
    });

    setAnswer(response);
    setQuestion(q);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading insights...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">WealthOS MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Insights</h1>
            <p className="mt-1 text-sm text-slate-500">
              Supabase-backed finance assistant using accounts, transactions,
              budgets, and goals.
            </p>
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

            <Link
              href="/budgets"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Budgets
            </Link>

            <Link
              href="/goals"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Goals
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

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            title="Net Worth"
            value={formatCurrency(accountSummary.netWorth)}
          />
          <SummaryCard
            title="Monthly Cash Flow"
            value={formatCurrency(monthlySummary.cashFlow)}
          />
          <SummaryCard
            title="Savings Rate"
            value={`${Math.round(monthlySummary.savingsRate)}%`}
          />
          <SummaryCard
            title="Budget Remaining"
            value={formatCurrency(budgetSummary.remaining)}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_420px]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">AI-Style Ask</h2>
            <p className="mt-1 text-sm text-slate-400">
              This uses a local rules engine over your Supabase data. Later we
              can connect it to an AI API endpoint.
            </p>

            <div className="mt-5">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
                placeholder="Ask something like: Where did my money go this month?"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => askQuestion()}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
                >
                  Ask
                </button>

                {QUICK_QUESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => askQuestion(item)}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {answer && (
              <div className="mt-6 rounded-2xl border border-blue-900 bg-blue-950/30 p-5">
                <p className="text-sm font-medium text-blue-200">Answer</p>
                <div className="mt-3 whitespace-pre-line text-sm leading-6 text-blue-50/90">
                  {answer}
                </div>
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-medium">Generated Insights</h2>
              <p className="mt-1 text-sm text-slate-400">
                Automatically generated from your current Supabase data.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {insights.map((insight) => (
                  <InsightCard key={insight.title} insight={insight} />
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">Top Spending</h2>

              <div className="mt-5 space-y-4">
                {spendingByCategory.slice(0, 6).map((row) => (
                  <div key={row.category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-300">{row.category}</span>
                      <span className="font-medium">
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

                {spendingByCategory.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No spending data for this month yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">Financial Snapshot</h2>

              <div className="mt-5 space-y-4">
                <MiniMetric
                  label="Income"
                  value={formatCurrency(monthlySummary.income)}
                />
                <MiniMetric
                  label="Spending"
                  value={formatCurrency(monthlySummary.spending)}
                />
                <MiniMetric
                  label="Cash Flow"
                  value={formatCurrency(monthlySummary.cashFlow)}
                  valueClass={
                    monthlySummary.cashFlow >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                />
                <MiniMetric
                  label="Budget Planned"
                  value={formatCurrency(budgetSummary.totalPlanned)}
                />
                <MiniMetric
                  label="Goal Remaining"
                  value={formatCurrency(goalSummary.remaining)}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">MVP Status</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <StatusRow label="Auth" />
                <StatusRow label="Accounts" />
                <StatusRow label="Transactions" />
                <StatusRow label="Budgets" />
                <StatusRow label="Goals" />
                <StatusRow label="Insights" />
              </div>

              <div className="mt-6 rounded-xl border border-blue-900 bg-blue-950/30 p-4">
                <p className="text-sm font-medium text-blue-200">
                  Recommended next step
                </p>
                <p className="mt-1 text-sm text-blue-100/80">
                  Add real AI API insights and then Plaid Sandbox account sync.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function generateInsights({
  accountSummary,
  monthlySummary,
  budgetSummary,
  goalSummary,
  spendingByCategory,
}: {
  accountSummary: {
    assets: number;
    liabilities: number;
    netWorth: number;
    activeAccounts: number;
  };
  monthlySummary: {
    income: number;
    spending: number;
    cashFlow: number;
    savingsRate: number;
    transactionCount: number;
  };
  budgetSummary: {
    totalPlanned: number;
    totalActual: number;
    remaining: number;
    overBudgetCategories: {
      category: string;
      planned: number;
      actual: number;
      difference: number;
    }[];
  };
  goalSummary: {
    totalTarget: number;
    totalCurrent: number;
    remaining: number;
    activeGoals: Goal[];
    progress: number;
  };
  spendingByCategory: { category: string; amount: number }[];
}): Insight[] {
  const insights: Insight[] = [];

  if (monthlySummary.income === 0) {
    insights.push({
      title: "No income recorded",
      severity: "warning",
      message:
        "There is no income transaction recorded for this month, so savings rate and cash flow may be incomplete.",
      action: "Add your paycheck or income transactions.",
    });
  }

  if (monthlySummary.cashFlow < 0) {
    insights.push({
      title: "Negative cash flow",
      severity: "danger",
      message: `You spent ${formatCurrency(
        Math.abs(monthlySummary.cashFlow)
      )} more than your income this month.`,
      action: "Review top spending categories and reduce flexible expenses.",
    });
  } else if (monthlySummary.savingsRate >= 20) {
    insights.push({
      title: "Strong savings rate",
      severity: "good",
      message: `Your estimated savings rate is ${Math.round(
        monthlySummary.savingsRate
      )}%, which is strong.`,
      action: "Consider directing extra cash flow toward goals or investments.",
    });
  } else if (monthlySummary.income > 0) {
    insights.push({
      title: "Low savings rate",
      severity: "warning",
      message: `Your estimated savings rate is ${Math.round(
        monthlySummary.savingsRate
      )}%.`,
      action: "Try to push savings rate toward 15–25% over time.",
    });
  }

  if (budgetSummary.totalPlanned === 0) {
    insights.push({
      title: "Budget not planned",
      severity: "info",
      message: "You have not entered planned budget amounts yet.",
      action: "Go to Budgets and set targets for major categories.",
    });
  } else if (budgetSummary.remaining < 0) {
    insights.push({
      title: "Budget exceeded",
      severity: "danger",
      message: `You are ${formatCurrency(
        Math.abs(budgetSummary.remaining)
      )} over your planned monthly budget.`,
      action: "Check over-budget categories and reduce spending this week.",
    });
  } else {
    insights.push({
      title: "Budget has room",
      severity: "good",
      message: `You have ${formatCurrency(
        budgetSummary.remaining
      )} remaining in your planned monthly budget.`,
      action: "Keep tracking spending before making large purchases.",
    });
  }

  if (budgetSummary.overBudgetCategories.length > 0) {
    const top = budgetSummary.overBudgetCategories[0];

    insights.push({
      title: "Top over-budget category",
      severity: "warning",
      message: `${top.category} is over budget by ${formatCurrency(
        Math.abs(top.difference)
      )}.`,
      action: `Review recent ${top.category} transactions.`,
    });
  }

  if (spendingByCategory.length > 0) {
    const top = spendingByCategory[0];

    insights.push({
      title: "Largest spending category",
      severity: "info",
      message: `${top.category} is your largest spending category this month at ${formatCurrency(
        top.amount
      )}.`,
      action: "Decide whether this category is intentional or needs a cap.",
    });
  }

  if (goalSummary.totalTarget === 0) {
    insights.push({
      title: "No goals created",
      severity: "info",
      message: "You have not created any financial goals yet.",
      action: "Create an emergency fund, debt payoff, investment, or purchase goal.",
    });
  } else if (goalSummary.progress >= 50) {
    insights.push({
      title: "Goals progressing well",
      severity: "good",
      message: `You are ${Math.round(
        goalSummary.progress
      )}% complete across your goals.`,
      action: "Keep monthly contributions consistent.",
    });
  } else {
    insights.push({
      title: "Goals need funding",
      severity: "warning",
      message: `You are ${Math.round(
        goalSummary.progress
      )}% complete across your goals.`,
      action: "Link goal contributions to your monthly cash flow plan.",
    });
  }

  if (accountSummary.liabilities > accountSummary.assets * 0.5) {
    insights.push({
      title: "Debt load looks high",
      severity: "warning",
      message: `Liabilities are ${formatCurrency(
        accountSummary.liabilities
      )}, compared with assets of ${formatCurrency(accountSummary.assets)}.`,
      action: "Prioritize high-interest debt payoff before lifestyle upgrades.",
    });
  }

  return insights;
}

function generateAnswer(
  question: string,
  data: {
    accountSummary: {
      assets: number;
      liabilities: number;
      netWorth: number;
      activeAccounts: number;
    };
    monthlySummary: {
      income: number;
      spending: number;
      cashFlow: number;
      savingsRate: number;
      transactionCount: number;
    };
    budgetSummary: {
      totalPlanned: number;
      totalActual: number;
      remaining: number;
      overBudgetCategories: {
        category: string;
        planned: number;
        actual: number;
        difference: number;
      }[];
    };
    goalSummary: {
      totalTarget: number;
      totalCurrent: number;
      remaining: number;
      activeGoals: Goal[];
      progress: number;
    };
    spendingByCategory: { category: string; amount: number }[];
    currentMonth: string;
  }
) {
  const q = question.toLowerCase();

  if (q.includes("where") || q.includes("money") || q.includes("spending")) {
    const topCategories = data.spendingByCategory
      .slice(0, 5)
      .map(
        (row, index) =>
          `${index + 1}. ${row.category}: ${formatCurrency(row.amount)}`
      )
      .join("\n");

    return `For ${data.currentMonth}, your spending is ${formatCurrency(
      data.monthlySummary.spending
    )}.\n\nTop categories:\n${
      topCategories || "No spending categories yet."
    }\n\nYour income is ${formatCurrency(
      data.monthlySummary.income
    )}, so your current cash flow is ${formatCurrency(
      data.monthlySummary.cashFlow
    )}.\n\nRecommended action: focus on the top 1–2 flexible categories first.`;
  }

  if (q.includes("budget")) {
    if (data.budgetSummary.totalPlanned === 0) {
      return "You have not set a planned budget yet. Go to Budgets and enter planned amounts for major categories like rent, groceries, restaurants, fuel, subscriptions, shopping, and insurance.";
    }

    const overBudgetText =
      data.budgetSummary.overBudgetCategories.length > 0
        ? data.budgetSummary.overBudgetCategories
            .slice(0, 3)
            .map(
              (row) =>
                `${row.category}: over by ${formatCurrency(
                  Math.abs(row.difference)
                )}`
            )
            .join("\n")
        : "No categories are over budget.";

    return `Your planned budget is ${formatCurrency(
      data.budgetSummary.totalPlanned
    )} and actual spending is ${formatCurrency(
      data.budgetSummary.totalActual
    )}.\n\nRemaining budget: ${formatCurrency(
      data.budgetSummary.remaining
    )}\n\nOver-budget categories:\n${overBudgetText}`;
  }

  if (q.includes("cash flow") || q.includes("cashflow")) {
    return `Your monthly income is ${formatCurrency(
      data.monthlySummary.income
    )} and spending is ${formatCurrency(
      data.monthlySummary.spending
    )}.\n\nYour cash flow is ${formatCurrency(
      data.monthlySummary.cashFlow
    )}.\n\nEstimated savings rate: ${Math.round(
      data.monthlySummary.savingsRate
    )}%.\n\n${
      data.monthlySummary.cashFlow >= 0
        ? "You are cash-flow positive. Consider directing surplus toward goals, debt payoff, or investments."
        : "You are cash-flow negative. Reduce flexible spending or increase income before taking on new commitments."
    }`;
  }

  if (q.includes("goal")) {
    if (data.goalSummary.totalTarget === 0) {
      return "You have not created goals yet. Start with an emergency fund, then add debt payoff, investment, or large purchase goals.";
    }

    return `Your total goal target is ${formatCurrency(
      data.goalSummary.totalTarget
    )}.\n\nCurrent progress: ${formatCurrency(
      data.goalSummary.totalCurrent
    )}\nRemaining: ${formatCurrency(
      data.goalSummary.remaining
    )}\nOverall progress: ${Math.round(
      data.goalSummary.progress
    )}%.\n\nRecommended action: use positive monthly cash flow to fund the highest-priority goal first.`;
  }

  if (q.includes("fix") || q.includes("first") || q.includes("priority")) {
    if (data.monthlySummary.cashFlow < 0) {
      return `First priority: fix negative cash flow. You are currently at ${formatCurrency(
        data.monthlySummary.cashFlow
      )} for the month.\n\nAction: reduce top flexible spending categories before adding new goals or purchases.`;
    }

    if (data.budgetSummary.remaining < 0) {
      return `First priority: fix budget overrun. You are over budget by ${formatCurrency(
        Math.abs(data.budgetSummary.remaining)
      )}.\n\nAction: review over-budget categories and adjust spending.`;
    }

    if (data.goalSummary.totalTarget === 0) {
      return "First priority: create goals. You have cash-flow/budget visibility, but no goal system yet. Add emergency fund and investment goals.";
    }

    return "First priority: keep the system updated weekly. Your cash flow and budget are the control center; goals should be funded from your monthly surplus.";
  }

  return `Based on your current Supabase data:\n\nNet worth: ${formatCurrency(
    data.accountSummary.netWorth
  )}\nMonthly income: ${formatCurrency(
    data.monthlySummary.income
  )}\nMonthly spending: ${formatCurrency(
    data.monthlySummary.spending
  )}\nCash flow: ${formatCurrency(
    data.monthlySummary.cashFlow
  )}\nBudget remaining: ${formatCurrency(
    data.budgetSummary.remaining
  )}\nGoal progress: ${Math.round(
    data.goalSummary.progress
  )}%\n\nAsk a more specific question like “Am I over budget?” or “What should I fix first?”`;
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className={`rounded-2xl border p-5 ${getInsightClass(insight.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{insight.title}</p>
          <p className="mt-2 text-sm opacity-90">{insight.message}</p>
        </div>
        <span className="rounded-full bg-black/20 px-2 py-1 text-xs capitalize">
          {insight.severity}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium">Action: {insight.action}</p>
    </div>
  );
}

function getInsightClass(severity: Insight["severity"]) {
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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
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

function StatusRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
      <span>{label}</span>
      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
        Done
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
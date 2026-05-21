import { NextResponse } from "next/server";

type InsightInput = {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlyCashFlow: number;
  budgetPlanned: number;
  budgetActual: number;
  budgetRemaining: number;
  overBudgetCategories: Array<{
    category: string;
    planned: number;
    actual: number;
    overBy: number;
  }>;
  topSpendingCategories: Array<{
    category: string;
    amount: number;
  }>;
  goals: Array<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    remaining: number;
    targetDate: string | null;
    monthlyContribution: number;
  }>;
  transactionCount: number;
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

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as InsightInput;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(generateFallbackInsights(input));
    }

    const prompt = buildPrompt(input);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are a practical personal finance analyst inside a budgeting app. Give concise, useful, non-judgmental insights. Do not provide investment, tax, legal, or debt advice as certainty. Use the user's supplied app data only. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "wealthos_insights",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: {
                  type: "string",
                },
                insights: {
                  type: "array",
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      severity: {
                        type: "string",
                        enum: ["good", "warning", "danger", "info"],
                      },
                    },
                    required: ["title", "detail", "severity"],
                  },
                },
                actionPlan: {
                  type: "array",
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                    },
                    required: ["title", "detail"],
                  },
                },
              },
              required: ["summary", "insights", "actionPlan"],
            },
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("OpenAI insights error:", errorText);

      return NextResponse.json(generateFallbackInsights(input), {
        status: 200,
      });
    }

    const data = await response.json();
    const outputText = extractOutputText(data);

    if (!outputText) {
      return NextResponse.json(generateFallbackInsights(input));
    }

    const parsed = JSON.parse(outputText) as AiInsightResponse;

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI insights route failed:", error);

    return NextResponse.json(
      {
        summary: "AI insights could not be generated right now.",
        insights: [
          {
            title: "Insights unavailable",
            detail:
              "The app could not generate AI insights at this moment. Try again after checking your API key and deployment settings.",
            severity: "warning",
          },
        ],
        actionPlan: [
          {
            title: "Retry later",
            detail:
              "Confirm your environment variables are configured, then try generating insights again.",
          },
        ],
      },
      { status: 200 }
    );
  }
}

function buildPrompt(input: InsightInput) {
  return `
Analyze this WealthOS user's personal finance dashboard.

Return concise JSON only.

Data:
${JSON.stringify(input, null, 2)}

What to produce:
1. A short overall summary.
2. 3-5 insights about cash flow, spending, budget discipline, debt/liabilities, and goals.
3. 3-5 specific next actions the user can take this week.

Rules:
- Be specific using the numbers provided.
- Do not invent missing data.
- Avoid generic advice.
- Do not say you are a financial advisor.
- Do not recommend specific investments.
- Use plain language.
`;
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const output = data?.output;

  if (!Array.isArray(output)) return "";

  for (const item of output) {
    const content = item?.content;

    if (!Array.isArray(content)) continue;

    for (const contentItem of content) {
      if (typeof contentItem?.text === "string") {
        return contentItem.text;
      }
    }
  }

  return "";
}

function generateFallbackInsights(input: InsightInput): AiInsightResponse {
  const savingsRate =
    input.monthlyIncome > 0
      ? Math.round((input.monthlyCashFlow / input.monthlyIncome) * 100)
      : 0;

  const insights: AiInsightResponse["insights"] = [];

  insights.push({
    title: "Monthly cash flow",
    detail:
      input.monthlyCashFlow >= 0
        ? `You are cash-flow positive by ${formatCurrency(
            input.monthlyCashFlow
          )} this month. Your estimated savings rate is ${savingsRate}%.`
        : `You are cash-flow negative by ${formatCurrency(
            Math.abs(input.monthlyCashFlow)
          )} this month. This should be the first area to review.`,
    severity: input.monthlyCashFlow >= 0 ? "good" : "danger",
  });

  insights.push({
    title: "Budget position",
    detail:
      input.budgetRemaining >= 0
        ? `You have ${formatCurrency(
            input.budgetRemaining
          )} remaining against your planned budget.`
        : `You are ${formatCurrency(
            Math.abs(input.budgetRemaining)
          )} over your planned budget.`,
    severity: input.budgetRemaining >= 0 ? "good" : "warning",
  });

  if (input.overBudgetCategories.length > 0) {
    const top = input.overBudgetCategories[0];

    insights.push({
      title: "Top budget pressure",
      detail: `${top.category} is over budget by ${formatCurrency(
        top.overBy
      )}. This category deserves the first review.`,
      severity: "warning",
    });
  } else {
    insights.push({
      title: "Category control",
      detail: "No budget categories are currently over plan.",
      severity: "good",
    });
  }

  if (input.topSpendingCategories.length > 0) {
    const topSpend = input.topSpendingCategories[0];

    insights.push({
      title: "Largest spending category",
      detail: `${topSpend.category} is your largest spending category this month at ${formatCurrency(
        topSpend.amount
      )}.`,
      severity: "info",
    });
  }

  if (input.goals.length > 0) {
    const unfinished = input.goals.find((goal) => goal.remaining > 0);

    if (unfinished) {
      insights.push({
        title: "Goal progress",
        detail: `${unfinished.name} still needs ${formatCurrency(
          unfinished.remaining
        )} to reach the target.`,
        severity: "info",
      });
    }
  }

  return {
    summary:
      input.transactionCount === 0
        ? "Add transactions to unlock stronger cash flow, budget, and spending insights."
        : `You have ${input.transactionCount} transactions analyzed this month with net cash flow of ${formatCurrency(
            input.monthlyCashFlow
          )}.`,
    insights: insights.slice(0, 5),
    actionPlan: [
      {
        title: "Review top spending",
        detail:
          input.topSpendingCategories.length > 0
            ? `Start with ${input.topSpendingCategories[0].category}, your largest spending category.`
            : "Add or import transactions so top spending can be analyzed.",
      },
      {
        title: "Update budgets weekly",
        detail:
          "Review planned versus actual spending once per week and adjust categories that consistently run over.",
      },
      {
        title: "Prioritize cash flow",
        detail:
          input.monthlyCashFlow >= 0
            ? "Keep your monthly cash flow positive and direct surplus toward the highest-priority goal."
            : "Identify one flexible category to reduce this week to move cash flow closer to positive.",
      },
    ],
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
"use client";

import { useMemo, type ReactNode } from "react";
import {
  sankey,
  sankeyCenter,
  sankeyLinkHorizontal,
  type SankeyLink,
  type SankeyNode,
} from "d3-sankey";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CashFlowData = {
  income: number;
  spending: number;
  cashFlow: number;
};

type SpendingCategory = {
  category: string;
  amount: number;
};

type BudgetRow = {
  category: string;
  planned: number;
  actual: number;
};

type GoalRow = {
  name: string;
  targetAmount: number;
  currentAmount: number;
};

type TrendRow = {
  month: string;
  income: number;
  spending: number;
  cashFlow: number;
};

type SankeyNodeDatum = {
  id: string;
  name: string;
  color: string;
  emoji?: string;
};

type SankeyLinkDatum = {
  source: string;
  target: string;
  value: number;
};

const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export function CashFlowBreakdownChart({ data }: { data: CashFlowData }) {
  const rows = [
    { name: "Income", value: data.income, type: "income" },
    { name: "Spending", value: data.spending, type: "spending" },
    { name: "Cash Flow", value: data.cashFlow, type: "cashFlow" },
  ];

  return (
    <ChartCard
      title="Cash Flow Breakdown"
      subtitle="Income, spending, and net monthly cash flow."
    >
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows}>
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickFormatter={(value) => shortCurrency(Number(value))}
            />
            <Tooltip content={<MoneyTooltip />} />
            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.name} fill={getBarColor(row.type)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function TopSpendingChart({ data }: { data: SpendingCategory[] }) {
  const rows = data.slice(0, 6);

  return (
    <ChartCard
      title="Top Spending Categories"
      subtitle="Your biggest expense categories this month."
    >
      {rows.length === 0 ? (
        <EmptyChart text="No spending data yet." />
      ) : (
        <div className="h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
              <XAxis
                type="number"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickFormatter={(value) => shortCurrency(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={100}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function BudgetPlannedActualChart({ data }: { data: BudgetRow[] }) {
  const rows = data
    .filter((row) => row.planned > 0 || row.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 8);

  return (
    <ChartCard
      title="Budget: Planned vs Actual"
      subtitle="Compare planned budget against actual spending."
    >
      {rows.length === 0 ? (
        <EmptyChart text="No budget/spending comparison available yet." />
      ) : (
        <div className="h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows}>
              <XAxis
                dataKey="category"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickFormatter={(value) => shortCurrency(Number(value))}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Bar dataKey="planned" fill="#64748b" radius={[8, 8, 0, 0]} />
              <Bar dataKey="actual" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function GoalProgressChart({ data }: { data: GoalRow[] }) {
  const rows = data.map((goal) => ({
    name: goal.name,
    progress:
      goal.targetAmount > 0
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
        : 0,
  }));

  return (
    <ChartCard
      title="Goal Progress"
      subtitle="Progress percentage across your tracked goals."
    >
      {rows.length === 0 ? (
        <EmptyChart text="No goals added yet." />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="break-words text-slate-300">{row.name}</span>
                <span className="shrink-0 text-slate-400">
                  {Math.round(row.progress)}%
                </span>
              </div>

              <div className="h-3 rounded-full bg-slate-800">
                <div
                  className="h-3 rounded-full bg-blue-500"
                  style={{ width: `${row.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

export function MoneyFlowSankey({
  income,
  spendingCategories,
  remainingCashFlow,
  goalsContribution,
}: {
  income: number;
  spendingCategories: SpendingCategory[];
  remainingCashFlow: number;
  goalsContribution: number;
}) {
  const chartWidth = 1180;
  const chartHeight = 620;

  const safeIncome = Math.max(Number(income || 0), 0);
  const safeGoalsContribution = Math.max(Number(goalsContribution || 0), 0);
  const safeRemainingCashFlow = Number(remainingCashFlow || 0);

  const preparedData = useMemo(() => {
    const spendingRows = spendingCategories
      .filter((item) => Number(item.amount || 0) > 0)
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

    const visibleSpending = spendingRows.slice(0, 6);
    const otherSpending = spendingRows
      .slice(6)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const spendingDestinationRows = visibleSpending.map((item, index) => ({
      id: `spending-${sanitizeId(item.category)}-${index}`,
      name: item.category,
      value: Number(item.amount || 0),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      emoji: getCategoryEmoji(item.category),
      group: "spending" as const,
    }));

    if (otherSpending > 0) {
      spendingDestinationRows.push({
        id: "other-spending",
        name: "Other Spending",
        value: otherSpending,
        color: "#64748b",
        emoji: "•",
        group: "spending",
      });
    }

    const spendingTotal = spendingDestinationRows.reduce(
      (sum, row) => sum + row.value,
      0
    );

    const positiveRemaining = Math.max(safeRemainingCashFlow, 0);
    const cashFlowGap = Math.max(-safeRemainingCashFlow, 0);

    const destinationRows = [
      ...spendingDestinationRows,
      ...(safeGoalsContribution > 0
        ? [
            {
              id: "goals",
              name: "Goals",
              value: safeGoalsContribution,
              color: "#3b82f6",
              emoji: "🎯",
              group: "goal" as const,
            },
          ]
        : []),
      ...(positiveRemaining > 0
        ? [
            {
              id: "remaining-cash",
              name: "Remaining Cash",
              value: positiveRemaining,
              color: "#10b981",
              emoji: "💵",
              group: "remaining" as const,
            },
          ]
        : []),
      ...(cashFlowGap > 0
        ? [
            {
              id: "cash-flow-gap",
              name: "Cash Flow Gap",
              value: cashFlowGap,
              color: "#f97316",
              emoji: "⚠️",
              group: "gap" as const,
            },
          ]
        : []),
    ];

    const estimatedFlow =
      spendingTotal + safeGoalsContribution + positiveRemaining + cashFlowGap;

    const displayIncome = safeIncome > 0 ? safeIncome : estimatedFlow;

    const nodes: SankeyNodeDatum[] = [
      {
        id: "source",
        name: "Income",
        color: "#16a34a",
        emoji: "💰",
      },
      {
        id: "spending-group",
        name: "Spending",
        color: "#ef4444",
        emoji: "",
      },
      ...(safeGoalsContribution > 0
        ? [
            {
              id: "goal-group",
              name: "Goals",
              color: "#3b82f6",
              emoji: "",
            },
          ]
        : []),
      ...(positiveRemaining > 0
        ? [
            {
              id: "remaining-group",
              name: "Remaining",
              color: "#10b981",
              emoji: "",
            },
          ]
        : []),
      ...(cashFlowGap > 0
        ? [
            {
              id: "gap-group",
              name: "Gap",
              color: "#f97316",
              emoji: "",
            },
          ]
        : []),
      ...destinationRows.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        emoji: row.emoji,
      })),
    ];

    const links: SankeyLinkDatum[] = [];

    if (displayIncome > 0 && spendingTotal > 0) {
      links.push({
        source: "source",
        target: "spending-group",
        value: spendingTotal,
      });
    }

    if (displayIncome > 0 && safeGoalsContribution > 0) {
      links.push({
        source: "source",
        target: "goal-group",
        value: safeGoalsContribution,
      });
    }

    if (displayIncome > 0 && positiveRemaining > 0) {
      links.push({
        source: "source",
        target: "remaining-group",
        value: positiveRemaining,
      });
    }

    if (displayIncome > 0 && cashFlowGap > 0) {
      links.push({
        source: "source",
        target: "gap-group",
        value: cashFlowGap,
      });
    }

    destinationRows.forEach((row) => {
      if (row.group === "spending") {
        links.push({
          source: "spending-group",
          target: row.id,
          value: row.value,
        });
      }

      if (row.group === "goal") {
        links.push({
          source: "goal-group",
          target: row.id,
          value: row.value,
        });
      }

      if (row.group === "remaining") {
        links.push({
          source: "remaining-group",
          target: row.id,
          value: row.value,
        });
      }

      if (row.group === "gap") {
        links.push({
          source: "gap-group",
          target: row.id,
          value: row.value,
        });
      }
    });

    return {
      nodes,
      links: links.filter((link) => link.value > 0),
      destinationRows,
      displayIncome,
      spendingTotal,
      positiveRemaining,
      cashFlowGap,
      totalFlow: Math.max(displayIncome, estimatedFlow, 1),
    };
  }, [
    spendingCategories,
    safeIncome,
    safeGoalsContribution,
    safeRemainingCashFlow,
  ]);

  const graph = useMemo(() => {
    const generator = sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeId((node) => node.id)
      .nodeWidth(16)
      .nodePadding(34)
      .nodeAlign(sankeyCenter)
      .extent([
        [36, 32],
        [chartWidth - 36, chartHeight - 32],
      ]);

    return generator({
      nodes: preparedData.nodes.map((node) => ({ ...node })),
      links: preparedData.links.map((link) => ({ ...link })),
    });
  }, [preparedData.nodes, preparedData.links]);

  const linkPath = sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>();

  function getPercent(value: number) {
    if (preparedData.totalFlow <= 0) return "0.0%";
    return `${((value / preparedData.totalFlow) * 100).toFixed(1)}%`;
  }

  const hasData = preparedData.links.length > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-100">Money Flow</h2>
          <p className="mt-1 text-sm text-slate-400">
            Connected weighted flow of income into spending, goals, and
            remaining cash.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
          <p className="text-xs text-slate-500">Monthly Income</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">
            {formatCurrency(preparedData.displayIncome)}
          </p>
        </div>
      </div>

      {!hasData ? (
        <EmptyChart text="Add income, expense, or goal data to visualize money flow." />
      ) : (
        <>
          <div className="hidden w-full overflow-hidden rounded-3xl border border-slate-800 bg-[#f8f5ef] text-zinc-950 shadow-sm xl:block">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Cash Flow
                </p>

                <h3 className="mt-1 text-xl font-semibold text-zinc-950">
                  Current Month Money Movement
                </h3>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm">
                By category & group
              </div>
            </div>

            <div className="w-full overflow-x-auto px-4 py-8">
              <svg
                width={chartWidth}
                height={chartHeight}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="min-w-[1000px]"
              >
                <defs>
                  {graph.links.map((link, index) => {
                    const source = link.source as SankeyNode<
                      SankeyNodeDatum,
                      SankeyLinkDatum
                    >;
                    const target = link.target as SankeyNode<
                      SankeyNodeDatum,
                      SankeyLinkDatum
                    >;

                    return (
                      <linearGradient
                        key={`gradient-${index}`}
                        id={`money-flow-gradient-${sanitizeId(
                          source.id
                        )}-${sanitizeId(target.id)}`}
                        gradientUnits="userSpaceOnUse"
                        x1={source.x1}
                        x2={target.x0}
                      >
                        <stop
                          offset="0%"
                          stopColor={source.color}
                          stopOpacity={source.id === "source" ? 0.22 : 0.3}
                        />
                        <stop
                          offset="50%"
                          stopColor={target.color}
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor={target.color}
                          stopOpacity={0.38}
                        />
                      </linearGradient>
                    );
                  })}
                </defs>

                <g>
                  {graph.links.map((link, index) => {
                    const source = link.source as SankeyNode<
                      SankeyNodeDatum,
                      SankeyLinkDatum
                    >;
                    const target = link.target as SankeyNode<
                      SankeyNodeDatum,
                      SankeyLinkDatum
                    >;

                    return (
                      <path
                        key={`link-${index}`}
                        d={
                          linkPath(
                            link as SankeyLink<
                              SankeyNodeDatum,
                              SankeyLinkDatum
                            >
                          ) || ""
                        }
                        fill="none"
                        stroke={`url(#money-flow-gradient-${sanitizeId(
                          source.id
                        )}-${sanitizeId(target.id)})`}
                        strokeWidth={Math.max(1, link.width || 1)}
                        strokeLinecap="butt"
                        strokeOpacity={1}
                      />
                    );
                  })}
                </g>

                <g>
                  {graph.nodes.map((node) => {
                    const value = Number(node.value || 0);
                    const centerY = ((node.y0 || 0) + (node.y1 || 0)) / 2;

                    const isSource = node.id === "source";
                    const isMiddle =
                      node.id === "spending-group" ||
                      node.id === "goal-group" ||
                      node.id === "remaining-group" ||
                      node.id === "gap-group";
                    const isRightSide = (node.x0 || 0) > chartWidth * 0.64;

                    const labelX =
                      isSource && !isRightSide
                        ? (node.x1 || 0) + 12
                        : (node.x0 || 0) - 12;

                    const textAnchor =
                      isSource && !isRightSide ? "start" : "end";

                    return (
                      <g key={node.id}>
                        <rect
                          x={node.x0}
                          y={node.y0}
                          width={(node.x1 || 0) - (node.x0 || 0)}
                          height={Math.max(
                            5,
                            (node.y1 || 0) - (node.y0 || 0)
                          )}
                          rx={3}
                          fill={node.color}
                        />

                        <text
                          x={labelX}
                          y={centerY - 10}
                          textAnchor={textAnchor}
                          className="fill-zinc-900 text-[15px] font-medium"
                        >
                          {node.emoji ? `${node.emoji} ` : ""}
                          {node.name}
                        </text>

                        <text
                          x={labelX}
                          y={centerY + 13}
                          textAnchor={textAnchor}
                          className="fill-zinc-950 text-[15px] font-semibold"
                        >
                          {isSource
                            ? `${formatCurrency(value)}`
                            : `${formatCurrency(value)} (${getPercent(value)})`}
                        </text>

                        {isMiddle && (
                          <text
                            x={labelX}
                            y={centerY + 34}
                            textAnchor={textAnchor}
                            className="fill-zinc-500 text-[12px]"
                          >
                            Group
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 xl:hidden">
            <div className="rounded-2xl border border-emerald-900 bg-emerald-950/30 p-4">
              <p className="text-xs text-emerald-300">Income</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-100">
                {formatCurrency(preparedData.displayIncome)}
              </p>
              <p className="mt-1 text-xs text-slate-500">100%</p>
            </div>

            <div className="mx-auto my-4 h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-blue-500" />

            <div className="space-y-3">
              {preparedData.destinationRows.map((row) => {
                const rowPercent = Math.max(
                  (row.value / preparedData.totalFlow) * 100,
                  4
                );

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="mb-2 flex justify-between gap-3 text-sm">
                      <span className="break-words text-slate-300">
                        {row.emoji} {row.name}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-100">
                        {formatCurrency(row.value)}
                      </span>
                    </div>

                    <div className="mb-2 flex justify-between text-xs text-slate-500">
                      <span>Flow weight</span>
                      <span>{getPercent(row.value)}</span>
                    </div>

                    <div className="h-3 rounded-full bg-slate-800">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          width: `${Math.min(rowPercent, 100)}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <FlowMetric
              title="Spending Flow"
              value={formatCurrency(preparedData.spendingTotal)}
              subtitle="Money going to expense categories"
              tone="spending"
            />

            <FlowMetric
              title="Goal Flow"
              value={formatCurrency(safeGoalsContribution)}
              subtitle="Planned goal contribution"
              tone="goal"
            />

            <FlowMetric
              title={safeRemainingCashFlow >= 0 ? "Remaining Flow" : "Cash Gap"}
              value={formatCurrency(Math.abs(safeRemainingCashFlow))}
              subtitle={
                safeRemainingCashFlow >= 0
                  ? "Money left after spending"
                  : "Spending is above income"
              }
              tone={safeRemainingCashFlow >= 0 ? "remaining" : "danger"}
            />
          </div>
        </>
      )}
    </section>
  );
}

function FlowMetric({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "spending" | "goal" | "remaining" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-1 text-lg font-semibold ${flowTextClass(tone)}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

export function SpendingTrendMiniChart({ data }: { data: TrendRow[] }) {
  return (
    <MiniChartCard title="Spending Trend">
      <div className="h-36 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data}>
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip content={<MoneyTooltip />} />
            <Line
              type="monotone"
              dataKey="spending"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MiniChartCard>
  );
}

export function BudgetUsageMiniChart({
  planned,
  actual,
}: {
  planned: number;
  actual: number;
}) {
  const percent = planned > 0 ? Math.min((actual / planned) * 100, 150) : 0;

  return (
    <MiniChartCard title="Budget Usage">
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Used</span>
          <span className={percent > 100 ? "text-red-300" : "text-slate-200"}>
            {Math.round(percent)}%
          </span>
        </div>

        <div className="mt-3 h-4 rounded-full bg-slate-800">
          <div
            className={
              percent > 100
                ? "h-4 rounded-full bg-red-500"
                : percent > 80
                  ? "h-4 rounded-full bg-amber-500"
                  : "h-4 rounded-full bg-emerald-500"
            }
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {formatCurrency(actual)} used of {formatCurrency(planned)} planned.
        </p>
      </div>
    </MiniChartCard>
  );
}

export function GoalProgressStrip({
  current,
  target,
}: {
  current: number;
  target: number;
}) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <MiniChartCard title="Goal Progress">
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Complete</span>
          <span className="text-slate-200">{Math.round(percent)}%</span>
        </div>

        <div className="mt-3 h-4 rounded-full bg-slate-800">
          <div
            className="h-4 rounded-full bg-blue-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {formatCurrency(current)} saved of {formatCurrency(target)} target.
        </p>
      </div>
    </MiniChartCard>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-medium text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      {children}
    </section>
  );
}

function MiniChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {children}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 px-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm shadow-xl">
      {label && <p className="mb-1 text-slate-300">{label}</p>}
      {payload.map((item: any) => (
        <p key={item.dataKey} className="text-slate-400">
          {item.name || item.dataKey}:{" "}
          <span className="font-medium text-slate-100">
            {formatCurrency(Number(item.value || 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

function getBarColor(type: string) {
  if (type === "income") return "#10b981";
  if (type === "spending") return "#ef4444";
  if (type === "cashFlow") return "#3b82f6";
  return "#64748b";
}

function flowTextClass(tone: "spending" | "goal" | "remaining" | "danger") {
  if (tone === "spending") return "text-red-300";
  if (tone === "goal") return "text-blue-300";
  if (tone === "remaining") return "text-emerald-300";
  return "text-amber-300";
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function getCategoryEmoji(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes("rent") || normalized.includes("housing")) return "🏠";
  if (normalized.includes("food") || normalized.includes("restaurant")) {
    return "🍽️";
  }
  if (normalized.includes("grocery")) return "🍏";
  if (normalized.includes("gas") || normalized.includes("fuel")) return "⛽";
  if (normalized.includes("transport") || normalized.includes("car")) return "🚗";
  if (normalized.includes("health") || normalized.includes("fitness")) return "💪";
  if (normalized.includes("shopping")) return "🛍️";
  if (normalized.includes("travel")) return "✈️";
  if (normalized.includes("loan") || normalized.includes("debt")) return "🏦";
  if (normalized.includes("insurance")) return "🛡️";
  if (normalized.includes("entertainment")) return "🎬";
  if (normalized.includes("coffee")) return "☕";
  if (normalized.includes("subscription")) return "🔁";

  return "•";
}

function shortCurrency(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;

  return `$${Math.round(value)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
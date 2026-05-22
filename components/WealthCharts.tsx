"use client";

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
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
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
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
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
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
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
  const spendingTotal = spendingCategories.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const positiveRemaining = Math.max(remainingCashFlow, 0);
  const cashFlowGap = Math.max(Math.abs(Math.min(remainingCashFlow, 0)), 0);

  const flowRows = [
    ...spendingCategories.slice(0, 5).map((item, index) => ({
      id: `spending-${item.category}`,
      label: item.category,
      value: Number(item.amount || 0),
      type: "spending" as const,
      color: ["#ef4444", "#f97316", "#f59e0b", "#ec4899", "#a855f7"][index],
    })),
    ...(goalsContribution > 0
      ? [
          {
            id: "goals",
            label: "Goals",
            value: goalsContribution,
            type: "goal" as const,
            color: "#3b82f6",
          },
        ]
      : []),
    ...(positiveRemaining > 0
      ? [
          {
            id: "remaining",
            label: "Remaining",
            value: positiveRemaining,
            type: "remaining" as const,
            color: "#10b981",
          },
        ]
      : []),
    ...(cashFlowGap > 0
      ? [
          {
            id: "gap",
            label: "Cash Flow Gap",
            value: cashFlowGap,
            type: "danger" as const,
            color: "#f59e0b",
          },
        ]
      : []),
  ].filter((row) => row.value > 0);

  const totalFlow = Math.max(
    income,
    spendingTotal + goalsContribution + positiveRemaining + cashFlowGap,
    1
  );

  const incomeWidth = Math.max((income / totalFlow) * 100, income > 0 ? 12 : 0);
  const spendingPercent = totalFlow > 0 ? (spendingTotal / totalFlow) * 100 : 0;
  const remainingPercent =
    totalFlow > 0 ? (positiveRemaining / totalFlow) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-100">Money Flow</h2>
          <p className="mt-1 text-sm text-slate-400">
            Income flowing into spending categories, goals, and remaining cash.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
          <p className="text-xs text-slate-500">Monthly Income</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">
            {formatCurrency(income)}
          </p>
        </div>
      </div>

      {flowRows.length === 0 || income <= 0 ? (
        <EmptyChart text="Add income and expense transactions to visualize money flow." />
      ) : (
        <>
          <div className="hidden lg:block">
            <DesktopSankey
              income={income}
              incomeWidth={incomeWidth}
              flowRows={flowRows}
              totalFlow={totalFlow}
            />
          </div>

          <div className="lg:hidden">
            <MobileSankey
              income={income}
              flowRows={flowRows}
              totalFlow={totalFlow}
            />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <FlowMetric
              title="Spending Flow"
              value={formatCurrency(spendingTotal)}
              subtitle={`${Math.round(spendingPercent)}% of income flow`}
              tone="spending"
            />
            <FlowMetric
              title="Goal Flow"
              value={formatCurrency(goalsContribution)}
              subtitle="Planned goal contribution"
              tone="goal"
            />
            <FlowMetric
              title={remainingCashFlow >= 0 ? "Remaining Flow" : "Gap"}
              value={formatCurrency(Math.abs(remainingCashFlow))}
              subtitle={
                remainingCashFlow >= 0
                  ? `${Math.round(remainingPercent)}% left over`
                  : "Spending is above income"
              }
              tone={remainingCashFlow >= 0 ? "remaining" : "danger"}
            />
          </div>
        </>
      )}
    </section>
  );
}

function DesktopSankey({
  income,
  incomeWidth,
  flowRows,
  totalFlow,
}: {
  income: number;
  incomeWidth: number;
  flowRows: Array<{
    id: string;
    label: string;
    value: number;
    type: "spending" | "goal" | "remaining" | "danger";
    color: string;
  }>;
  totalFlow: number;
}) {
  const height = Math.max(360, flowRows.length * 74);
  const sourceX = 85;
  const targetX = 720;
  const sourceY = height / 2;
  const targetStartY = 54;
  const targetGap = flowRows.length > 5 ? 58 : 66;

  const maxStroke = 38;
  const minStroke = 8;

  return (
    <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-5">
      <svg
        viewBox={`0 0 860 ${height}`}
        className="h-[420px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="sankeyGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {flowRows.map((row) => (
            <linearGradient
              key={`gradient-${row.id}`}
              id={`gradient-${sanitizeId(row.id)}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="100%" stopColor={row.color} stopOpacity="0.85" />
            </linearGradient>
          ))}
        </defs>

        <rect
          x={sourceX - 46}
          y={sourceY - 72}
          width="120"
          height="144"
          rx="24"
          fill="#064e3b"
          opacity="0.26"
          stroke="#059669"
          strokeOpacity="0.45"
        />

        <text
          x={sourceX + 14}
          y={sourceY - 20}
          textAnchor="middle"
          fill="#a7f3d0"
          fontSize="15"
          fontWeight="600"
        >
          Income
        </text>

        <text
          x={sourceX + 14}
          y={sourceY + 10}
          textAnchor="middle"
          fill="#ecfdf5"
          fontSize="21"
          fontWeight="700"
        >
          {shortCurrency(income)}
        </text>

        <rect
          x={sourceX - 28}
          y={sourceY + 34}
          width={`${Math.min(incomeWidth, 100)}`}
          height="8"
          rx="4"
          fill="#10b981"
          opacity="0.9"
        />

        {flowRows.map((row, index) => {
          const targetY = targetStartY + index * targetGap;
          const strokeWidth = Math.max(
            minStroke,
            Math.min(maxStroke, (row.value / totalFlow) * 85)
          );

          const controlOneX = sourceX + 230;
          const controlTwoX = targetX - 230;

          const path = `M ${sourceX + 76} ${sourceY} C ${controlOneX} ${sourceY}, ${controlTwoX} ${targetY}, ${targetX - 32} ${targetY}`;

          return (
            <g key={row.id}>
              <path
                d={path}
                fill="none"
                stroke={`url(#gradient-${sanitizeId(row.id)})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity="0.74"
                filter="url(#sankeyGlow)"
              />

              <circle
                cx={targetX - 32}
                cy={targetY}
                r={Math.max(7, strokeWidth / 2.8)}
                fill={row.color}
                opacity="0.95"
              />

              <rect
                x={targetX}
                y={targetY - 26}
                width="130"
                height="52"
                rx="16"
                fill="#020617"
                stroke="#1e293b"
              />

              <text
                x={targetX + 16}
                y={targetY - 5}
                fill="#cbd5e1"
                fontSize="12"
                fontWeight="600"
              >
                {truncateLabel(row.label, 15)}
              </text>

              <text
                x={targetX + 16}
                y={targetY + 16}
                fill="#f8fafc"
                fontSize="14"
                fontWeight="700"
              >
                {shortCurrency(row.value)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute left-8 top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-8 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
    </div>
  );
}

function MobileSankey({
  income,
  flowRows,
  totalFlow,
}: {
  income: number;
  flowRows: Array<{
    id: string;
    label: string;
    value: number;
    type: "spending" | "goal" | "remaining" | "danger";
    color: string;
  }>;
  totalFlow: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4">
        <p className="text-xs text-emerald-300">Income</p>
        <p className="mt-1 text-2xl font-semibold text-emerald-100">
          {formatCurrency(income)}
        </p>
      </div>

      <div className="mx-auto my-3 h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-blue-500" />

      <div className="space-y-3">
        {flowRows.map((row) => {
          const percent = Math.max((row.value / totalFlow) * 100, 4);

          return (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="mb-2 flex justify-between gap-3 text-sm">
                <span className="break-words text-slate-300">{row.label}</span>
                <span className="shrink-0 font-semibold text-slate-100">
                  {formatCurrency(row.value)}
                </span>
              </div>

              <div className="h-3 rounded-full bg-slate-800">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
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
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
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
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
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

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
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
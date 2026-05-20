"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

type LocalGoal = {
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

const OLD_LOCAL_GOALS_KEY = "wealthos_goals_v1";

const GOAL_TYPE_OPTIONS: { label: string; value: GoalType }[] = [
  { label: "Emergency Fund", value: "emergency_fund" },
  { label: "Debt Payoff", value: "debt_payoff" },
  { label: "Investment", value: "investment" },
  { label: "Large Purchase", value: "large_purchase" },
  { label: "Savings", value: "savings" },
  { label: "Other", value: "other" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [notes, setNotes] = useState("");

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

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
      } else {
        setGoals((data || []) as Goal[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, []);

  const summary = useMemo(() => {
    const totalTarget = goals.reduce(
      (sum, goal) => sum + Number(goal.target_amount || 0),
      0
    );

    const totalCurrent = goals.reduce(
      (sum, goal) => sum + Number(goal.current_amount || 0),
      0
    );

    const totalRemaining = Math.max(totalTarget - totalCurrent, 0);

    const activeGoals = goals.filter(
      (goal) => Number(goal.current_amount) < Number(goal.target_amount)
    ).length;

    const completedGoals = goals.filter(
      (goal) => Number(goal.current_amount) >= Number(goal.target_amount)
    ).length;

    return {
      totalTarget,
      totalCurrent,
      totalRemaining,
      activeGoals,
      completedGoals,
      progress:
        totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0,
    };
  }, [goals]);

  async function addGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    if (!name.trim()) {
      alert("Please enter a goal name.");
      return;
    }

    const parsedTarget = Number(targetAmount);
    const parsedCurrent = Number(currentAmount || 0);
    const parsedMonthlyContribution = Number(monthlyContribution || 0);

    if (Number.isNaN(parsedTarget) || parsedTarget <= 0) {
      alert("Please enter a valid target amount.");
      return;
    }

    if (Number.isNaN(parsedCurrent) || parsedCurrent < 0) {
      alert("Please enter a valid current amount.");
      return;
    }

    if (
      monthlyContribution &&
      (Number.isNaN(parsedMonthlyContribution) || parsedMonthlyContribution < 0)
    ) {
      alert("Please enter a valid monthly contribution.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: userId,
      name: name.trim(),
      goal_type: goalType,
      target_amount: parsedTarget,
      current_amount: parsedCurrent,
      target_date: targetDate || null,
      monthly_contribution: parsedMonthlyContribution,
      notes: notes.trim() || null,
    };

    const { data, error } = await supabase
      .from("goals")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setGoals((current) => [data as Goal, ...current]);

    setName("");
    setGoalType("savings");
    setTargetAmount("");
    setCurrentAmount("");
    setTargetDate("");
    setMonthlyContribution("");
    setNotes("");
  }

  async function importOldLocalGoals() {
    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    const saved = window.localStorage.getItem(OLD_LOCAL_GOALS_KEY);

    if (!saved) {
      alert("No old local goals found.");
      return;
    }

    let parsed: LocalGoal[];

    try {
      parsed = JSON.parse(saved);
    } catch {
      alert("Old local goals data is not valid JSON.");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      alert("No old local goals found.");
      return;
    }

    const confirmed = confirm(
      `Import ${parsed.length} old local goal(s) into Supabase? Only click this once to avoid duplicates.`
    );

    if (!confirmed) return;

    const existingKeys = new Set(
      goals.map(
        (goal) =>
          `${goal.name}-${goal.goal_type}-${Number(goal.target_amount)}-${Number(
            goal.current_amount
          )}`
      )
    );

    const payload = parsed
      .filter((goal) => {
        const key = `${goal.name}-${goal.goalType}-${Number(
          goal.targetAmount || 0
        )}-${Number(goal.currentAmount || 0)}`;

        return !existingKeys.has(key);
      })
      .map((goal) => ({
        user_id: userId,
        name: goal.name || "Imported Goal",
        goal_type: goal.goalType || "savings",
        target_amount: Number(goal.targetAmount || 0),
        current_amount: Number(goal.currentAmount || 0),
        target_date: goal.targetDate || null,
        monthly_contribution: Number(goal.monthlyContribution || 0),
        notes: goal.notes || "Imported from old localStorage",
      }))
      .filter((goal) => goal.target_amount > 0);

    if (payload.length === 0) {
      alert("No new goals to import. They may already exist in Supabase.");
      return;
    }

    setImporting(true);

    const { data, error } = await supabase.from("goals").insert(payload).select();

    setImporting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setGoals((current) => [...((data || []) as Goal[]), ...current]);

    alert(`Imported ${data?.length || 0} old local goal(s) into Supabase.`);
  }

  async function deleteGoal(id: string) {
    const confirmed = confirm("Delete this goal?");

    if (!confirmed) return;

    const { error } = await supabase.from("goals").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setGoals((current) => current.filter((goal) => goal.id !== id));
  }

  async function updateGoalProgress(id: string, value: string) {
    const parsed = Number(value);

    if (Number.isNaN(parsed) || parsed < 0) return;

    setGoals((current) =>
      current.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              current_amount: parsed,
            }
          : goal
      )
    );

    const { error } = await supabase
      .from("goals")
      .update({
        current_amount: parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
    }
  }

  async function addContribution(goal: Goal, amount: number) {
    if (amount <= 0) return;

    const updatedAmount = Math.min(
      Number(goal.current_amount || 0) + amount,
      Number(goal.target_amount || 0)
    );

    setGoals((current) =>
      current.map((item) =>
        item.id === goal.id
          ? {
              ...item,
              current_amount: updatedAmount,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("goals")
      .update({
        current_amount: updatedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal.id);

    if (error) {
      alert(error.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading goals...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">WealthOS MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Goals</h1>
            <p className="mt-1 text-sm text-slate-500">
              Supabase-backed savings, debt payoff, investment, and purchase
              goals.
            </p>
            {userEmail && (
              <p className="mt-1 text-xs text-slate-600">
                Logged in as {userEmail}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/budgets"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Budgets
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={importOldLocalGoals}
              disabled={importing}
              className="rounded-xl border border-blue-900 px-4 py-2 text-sm text-blue-300 hover:bg-blue-950 disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Old Local Goals"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard
            title="Goal Target"
            value={formatCurrency(summary.totalTarget)}
          />
          <SummaryCard
            title="Saved / Paid"
            value={formatCurrency(summary.totalCurrent)}
          />
          <SummaryCard
            title="Remaining"
            value={formatCurrency(summary.totalRemaining)}
          />
          <SummaryCard title="Active Goals" value={String(summary.activeGoals)} />
          <SummaryCard
            title="Completed"
            value={String(summary.completedGoals)}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Add Goal</h2>
            <p className="mt-1 text-sm text-slate-400">
              Goals are now saved to Supabase.
            </p>

            <form onSubmit={addGoal} className="mt-5 space-y-4">
              <div>
                <label className="text-sm text-slate-300">Goal Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: Emergency Fund"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Goal Type</label>
                <select
                  value={goalType}
                  onChange={(event) =>
                    setGoalType(event.target.value as GoalType)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {GOAL_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300">Target Amount</label>
                <input
                  value={targetAmount}
                  onChange={(event) => setTargetAmount(event.target.value)}
                  type="number"
                  step="0.01"
                  placeholder="Example: 10000"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Current Amount</label>
                <input
                  value={currentAmount}
                  onChange={(event) => setCurrentAmount(event.target.value)}
                  type="number"
                  step="0.01"
                  placeholder="Example: 2500"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Target Date</label>
                <input
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">
                  Planned Monthly Contribution
                </label>
                <input
                  value={monthlyContribution}
                  onChange={(event) =>
                    setMonthlyContribution(event.target.value)
                  }
                  type="number"
                  step="0.01"
                  placeholder="Example: 500"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional notes"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Goal"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4">
              <h2 className="text-lg font-medium">Goal List</h2>
              <p className="text-sm text-slate-400">
                {goals.length} goal{goals.length === 1 ? "" : "s"} added
              </p>
            </div>

            <div className="space-y-4">
              {goals.map((goal) => {
                const progress =
                  Number(goal.target_amount) > 0
                    ? Math.min(
                        (Number(goal.current_amount) /
                          Number(goal.target_amount)) *
                          100,
                        100
                      )
                    : 0;

                const remaining = Math.max(
                  Number(goal.target_amount) - Number(goal.current_amount),
                  0
                );

                const monthsLeft = calculateMonthsLeft(goal.target_date || "");
                const requiredMonthly =
                  monthsLeft > 0 ? remaining / monthsLeft : remaining;

                const isComplete =
                  Number(goal.current_amount) >= Number(goal.target_amount);

                return (
                  <div
                    key={goal.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-medium">{goal.name}</h3>
                          <GoalTypeBadge type={goal.goal_type} />
                          {isComplete && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                              Complete
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-400">
                          {formatCurrency(Number(goal.current_amount))} of{" "}
                          {formatCurrency(Number(goal.target_amount))}
                        </p>

                        {goal.target_date && (
                          <p className="mt-1 text-xs text-slate-500">
                            Target date: {goal.target_date}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteGoal(goal.id)}
                        className="rounded-lg border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-4">
                      <div className="h-3 w-full rounded-full bg-slate-800">
                        <div
                          className={
                            isComplete
                              ? "h-3 rounded-full bg-emerald-500"
                              : "h-3 rounded-full bg-blue-500"
                          }
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-xs text-slate-500">
                        <span>{Math.round(progress)}% complete</span>
                        <span>{formatCurrency(remaining)} remaining</span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <MiniStat
                        label="Monthly Needed"
                        value={formatCurrency(requiredMonthly)}
                      />
                      <MiniStat
                        label="Your Monthly Plan"
                        value={formatCurrency(
                          Number(goal.monthly_contribution || 0)
                        )}
                      />
                      <MiniStat
                        label="Months Left"
                        value={monthsLeft > 0 ? String(monthsLeft) : "N/A"}
                      />
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <input
                        value={goal.current_amount}
                        onChange={(event) =>
                          updateGoalProgress(goal.id, event.target.value)
                        }
                        type="number"
                        step="0.01"
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          addContribution(
                            goal,
                            Number(goal.monthly_contribution || 0)
                          )
                        }
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        Add Monthly
                      </button>

                      <button
                        type="button"
                        onClick={() => addContribution(goal, 100)}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        +$100
                      </button>
                    </div>

                    {goal.notes && (
                      <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
                        {goal.notes}
                      </p>
                    )}

                    <div className="mt-4 rounded-xl border border-blue-900 bg-blue-950/30 p-3 text-sm text-blue-100/80">
                      {getGoalInsight(goal, requiredMonthly, monthsLeft)}
                    </div>
                  </div>
                );
              })}

              {goals.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-500">
                  No Supabase goals yet. Add your first goal or import old local
                  goals.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}

function GoalTypeBadge({ type }: { type: GoalType }) {
  const label =
    GOAL_TYPE_OPTIONS.find((option) => option.value === type)?.label || "Goal";

  return (
    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
      {label}
    </span>
  );
}

function calculateMonthsLeft(targetDate: string) {
  if (!targetDate) return 0;

  const now = new Date();
  const target = new Date(targetDate);

  if (Number.isNaN(target.getTime()) || target <= now) return 0;

  const years = target.getFullYear() - now.getFullYear();
  const months = target.getMonth() - now.getMonth();

  return Math.max(years * 12 + months, 1);
}

function getGoalInsight(
  goal: Goal,
  requiredMonthly: number,
  monthsLeft: number
) {
  if (Number(goal.current_amount) >= Number(goal.target_amount)) {
    return "Goal complete. You can redirect contributions toward the next priority.";
  }

  if (!goal.target_date) {
    return "Add a target date to calculate the monthly amount needed to finish this goal on time.";
  }

  if (monthsLeft <= 0) {
    return "The target date has passed or is too close. Update the date or increase current progress.";
  }

  if (Number(goal.monthly_contribution || 0) >= requiredMonthly) {
    return `You are on pace. Your planned monthly contribution of ${formatCurrency(
      Number(goal.monthly_contribution || 0)
    )} is enough to meet this goal.`;
  }

  return `You may fall short. You need about ${formatCurrency(
    requiredMonthly
  )}/month, but your current plan is ${formatCurrency(
    Number(goal.monthly_contribution || 0)
  )}/month.`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
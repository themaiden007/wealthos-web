"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

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

const GOAL_TYPE_OPTIONS: { label: string; value: GoalType }[] = [
  { label: "Emergency Fund", value: "emergency_fund" },
  { label: "Debt Payoff", value: "debt_payoff" },
  { label: "Investment", value: "investment" },
  { label: "Large Purchase", value: "large_purchase" },
  { label: "Savings", value: "savings" },
  { label: "Other", value: "other" },
];

export default function GoalsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editGoalType, setEditGoalType] = useState<GoalType>("savings");
  const [editTargetAmount, setEditTargetAmount] = useState("");
  const [editCurrentAmount, setEditCurrentAmount] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editMonthlyContribution, setEditMonthlyContribution] = useState("");
  const [editNotes, setEditNotes] = useState("");

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
        showToast({
        type: "error",
        title: "Something went wrong",
        message: error.message,
      });
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
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before continuing.",
      });
      return;
    }

    if (!name.trim()) {
      showToast({
        type: "warning",
        title: "Goal name required",
        message: "Please enter a goal name.",
      });
      return;
    }

    const parsedTarget = Number(targetAmount);
    const parsedCurrent = Number(currentAmount || 0);
    const parsedMonthlyContribution = Number(monthlyContribution || 0);

    if (Number.isNaN(parsedTarget) || parsedTarget <= 0) {
      showToast({
        type: "warning",
        title: "Invalid target amount",
        message: "Please enter a valid target amount greater than $0.",
      });
      return;
    }

    if (Number.isNaN(parsedCurrent) || parsedCurrent < 0) {
      showToast({
        type: "warning",
        title: "Invalid current amount",
        message: "Please enter a valid current amount.",
      });
      return;
    }

    if (
      monthlyContribution &&
      (Number.isNaN(parsedMonthlyContribution) || parsedMonthlyContribution < 0)
    ) {
      showToast({
        type: "warning",
        title: "Invalid monthly contribution",
        message: "Please enter a valid monthly contribution.",
      });
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
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("goals")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      showToast({
        type: "error",
        title: "Something went wrong",
        message: error.message,
      });
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

  function startEditing(goal: Goal) {
    setEditingId(goal.id);
    setEditName(goal.name);
    setEditGoalType(goal.goal_type);
    setEditTargetAmount(String(Number(goal.target_amount || 0)));
    setEditCurrentAmount(String(Number(goal.current_amount || 0)));
    setEditTargetDate(goal.target_date || "");
    setEditMonthlyContribution(String(Number(goal.monthly_contribution || 0)));
    setEditNotes(goal.notes || "");
  }

  function cancelEditing() {
    setEditingId("");
    setEditName("");
    setEditGoalType("savings");
    setEditTargetAmount("");
    setEditCurrentAmount("");
    setEditTargetDate("");
    setEditMonthlyContribution("");
    setEditNotes("");
  }

  async function saveGoalEdit(goalId: string) {
    if (!editName.trim()) {
      showToast({
        type: "warning",
        title: "Goal name required",
        message: "Please enter a goal name.",
      });
      return;
    }

    const parsedTarget = Number(editTargetAmount);
    const parsedCurrent = Number(editCurrentAmount || 0);
    const parsedMonthlyContribution = Number(editMonthlyContribution || 0);

    if (Number.isNaN(parsedTarget) || parsedTarget <= 0) {
      showToast({
        type: "warning",
        title: "Invalid target amount",
        message: "Please enter a valid target amount greater than $0.",
      });
      return;
    }

    if (Number.isNaN(parsedCurrent) || parsedCurrent < 0) {
      showToast({
        type: "warning",
        title: "Invalid current amount",
        message: "Please enter a valid current amount.",
      });
      return;
    }

    if (
      Number.isNaN(parsedMonthlyContribution) ||
      parsedMonthlyContribution < 0
    ) {
      showToast({
        type: "warning",
        title: "Invalid monthly contribution",
        message: "Please enter a valid monthly contribution.",
      });
      return;
    }

    setUpdatingId(goalId);

    const { data, error } = await supabase
      .from("goals")
      .update({
        name: editName.trim(),
        goal_type: editGoalType,
        target_amount: parsedTarget,
        current_amount: parsedCurrent,
        target_date: editTargetDate || null,
        monthly_contribution: parsedMonthlyContribution,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .select()
      .single();

    setUpdatingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Something went wrong",
        message: error.message,
      });
      return;
    }

    setGoals((current) =>
      current.map((goal) => (goal.id === goalId ? (data as Goal) : goal))
    );

    cancelEditing();
  }

  async function deleteGoal(goal: Goal) {
    const confirmed = await confirm({
      title: `Delete ${goal.name}?`,
      message: `Target: ${formatCurrency(
        Number(goal.target_amount)
      )}\nCurrent: ${formatCurrency(
        Number(goal.current_amount)
      )}\n\nThis will permanently remove the goal from Supabase.\n\nThis action cannot be undone.`,
      confirmLabel: "Delete Goal",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingId(goal.id);

    const { error } = await supabase.from("goals").delete().eq("id", goal.id);

    setDeletingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Something went wrong",
        message: error.message,
      });
      return;
    }

    setGoals((current) => current.filter((item) => item.id !== goal.id));
  }

  async function updateGoalProgress(goal: Goal, value: string) {
    const parsed = Number(value);

    if (Number.isNaN(parsed) || parsed < 0) return;

    const safeAmount = Math.min(parsed, Number(goal.target_amount || 0));

    setGoals((current) =>
      current.map((item) =>
        item.id === goal.id
          ? {
              ...item,
              current_amount: safeAmount,
            }
          : item
      )
    );

    setUpdatingId(goal.id);

    const { error } = await supabase
      .from("goals")
      .update({
        current_amount: safeAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal.id);

    setUpdatingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Something went wrong",
        message: error.message,
      });
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

    setUpdatingId(goal.id);

    const { error } = await supabase
      .from("goals")
      .update({
        current_amount: updatedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal.id);

    setUpdatingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Something went wrong",
        message: error.message,
      });
    }
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            Loading goals...
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
            <h1 className="mt-2 text-3xl font-semibold">Goals</h1>
            <p className="mt-1 text-sm text-slate-500">
              Add, edit, track, and manage Supabase-backed goals.
            </p>
            {userEmail && (
              <p className="mt-1 text-xs text-slate-600">
                Logged in as {userEmail}
              </p>
            )}
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
            <SummaryCard
              title="Active Goals"
              value={String(summary.activeGoals)}
            />
            <SummaryCard
              title="Completed"
              value={String(summary.completedGoals)}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-medium">Add Goal</h2>
              <p className="mt-1 text-sm text-slate-400">
                Goals are saved to Supabase.
              </p>

              <form onSubmit={addGoal} noValidate className="mt-5 space-y-4">
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
                  <label className="text-sm text-slate-300">
                    Current Amount
                  </label>
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
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Goal List</h2>
                  <p className="text-sm text-slate-400">
                    {goals.length} goal{goals.length === 1 ? "" : "s"} added
                  </p>
                </div>
              </div>

              {goals.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-500">
                  No goals yet. Add your first financial goal.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {goals.map((goal) => {
                    const isEditing = editingId === goal.id;
                    const isBusy =
                      updatingId === goal.id || deletingId === goal.id;

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

                    const monthsLeft = calculateMonthsLeft(
                      isEditing ? editTargetDate : goal.target_date || ""
                    );

                    const requiredMonthly =
                      monthsLeft > 0 ? remaining / monthsLeft : remaining;

                    const isComplete =
                      Number(goal.current_amount) >= Number(goal.target_amount);

                    return (
                      <div
                        key={goal.id}
                        className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-5"
                      >
                        {isEditing ? (
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm text-slate-300">
                                Goal Name
                              </label>
                              <input
                                value={editName}
                                onChange={(event) =>
                                  setEditName(event.target.value)
                                }
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-sm text-slate-300">
                                Goal Type
                              </label>
                              <select
                                value={editGoalType}
                                onChange={(event) =>
                                  setEditGoalType(
                                    event.target.value as GoalType
                                  )
                                }
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              >
                                {GOAL_TYPE_OPTIONS.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="text-sm text-slate-300">
                                  Target Amount
                                </label>
                                <input
                                  value={editTargetAmount}
                                  onChange={(event) =>
                                    setEditTargetAmount(event.target.value)
                                  }
                                  type="number"
                                  step="0.01"
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                              </div>

                              <div>
                                <label className="text-sm text-slate-300">
                                  Current Amount
                                </label>
                                <input
                                  value={editCurrentAmount}
                                  onChange={(event) =>
                                    setEditCurrentAmount(event.target.value)
                                  }
                                  type="number"
                                  step="0.01"
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="text-sm text-slate-300">
                                  Target Date
                                </label>
                                <input
                                  value={editTargetDate}
                                  onChange={(event) =>
                                    setEditTargetDate(event.target.value)
                                  }
                                  type="date"
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                              </div>

                              <div>
                                <label className="text-sm text-slate-300">
                                  Monthly Contribution
                                </label>
                                <input
                                  value={editMonthlyContribution}
                                  onChange={(event) =>
                                    setEditMonthlyContribution(
                                      event.target.value
                                    )
                                  }
                                  type="number"
                                  step="0.01"
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-sm text-slate-300">
                                Notes
                              </label>
                              <textarea
                                value={editNotes}
                                onChange={(event) =>
                                  setEditNotes(event.target.value)
                                }
                                rows={3}
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => saveGoalEdit(goal.id)}
                                disabled={isBusy}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                              >
                                {updatingId === goal.id ? "Saving..." : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={isBusy}
                                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="break-words text-lg font-medium">
                                    {goal.name}
                                  </h3>
                                  <GoalTypeBadge type={goal.goal_type} />
                                  {isComplete && (
                                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                                      Complete
                                    </span>
                                  )}
                                </div>

                                {goal.target_date && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    Target date: {goal.target_date}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditing(goal)}
                                  disabled={isBusy}
                                  className="rounded-lg border border-blue-900 px-3 py-2 text-xs text-blue-300 hover:bg-blue-950 disabled:opacity-60"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteGoal(goal)}
                                  disabled={isBusy}
                                  className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 disabled:opacity-60"
                                >
                                  {deletingId === goal.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </div>

                            <div className="mt-5">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                  <p className="text-xs text-slate-500">
                                    Progress
                                  </p>
                                  <p className="mt-1 text-xl font-semibold">
                                    {formatCurrency(
                                      Number(goal.current_amount)
                                    )}{" "}
                                    <span className="text-sm font-normal text-slate-500">
                                      /{" "}
                                      {formatCurrency(
                                        Number(goal.target_amount)
                                      )}
                                    </span>
                                  </p>
                                </div>

                                <p className="text-sm text-slate-400">
                                  {Math.round(progress)}% complete
                                </p>
                              </div>

                              <div className="mt-3 h-3 w-full rounded-full bg-slate-800">
                                <div
                                  className={
                                    isComplete
                                      ? "h-3 rounded-full bg-emerald-500"
                                      : "h-3 rounded-full bg-blue-500"
                                  }
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <MiniStat
                                label="Remaining"
                                value={formatCurrency(remaining)}
                              />
                              <MiniStat
                                label="Monthly Needed"
                                value={formatCurrency(requiredMonthly)}
                              />
                              <MiniStat
                                label="Months Left"
                                value={
                                  monthsLeft > 0 ? String(monthsLeft) : "N/A"
                                }
                              />
                            </div>

                            <div className="mt-5">
                              <label className="text-xs text-slate-400">
                                Update Current Amount
                              </label>
                              <input
                                value={goal.current_amount}
                                onChange={(event) =>
                                  updateGoalProgress(goal, event.target.value)
                                }
                                type="number"
                                step="0.01"
                                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  addContribution(
                                    goal,
                                    Number(goal.monthly_contribution || 0)
                                  )
                                }
                                disabled={isBusy}
                                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                              >
                                {updatingId === goal.id
                                  ? "Updating..."
                                  : "Add Monthly"}
                              </button>

                              <button
                                type="button"
                                onClick={() => addContribution(goal, 100)}
                                disabled={isBusy}
                                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                              >
                                +$100
                              </button>
                            </div>

                            {goal.notes && (
                              <p className="mt-4 break-words rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
                                {goal.notes}
                              </p>
                            )}

                            <div className="mt-4 rounded-xl border border-blue-900 bg-blue-950/30 p-3 text-sm text-blue-100/80">
                              {getGoalInsight(goal, requiredMonthly, monthsLeft)}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
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
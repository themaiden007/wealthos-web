"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

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

const CATEGORY_OPTIONS = [
  "Salary",
  "Bonus",
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
  "Credit Card Payment",
  "Transfer",
  "Other",
];

const SAMPLE_CSV = `date,name,merchant,amount,type,category
2026-05-01,Salary,Company,5000,income,Salary
2026-05-02,Walmart,Walmart,85.25,expense,Groceries
2026-05-03,Chipotle,Chipotle,18.40,expense,Restaurants
2026-05-04,Rent,Apartment,1400,expense,Rent/Mortgage`;

export default function TransactionsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [showCsvImport, setShowCsvImport] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");
  const [category, setCategory] = useState("Other");
  const [notes, setNotes] = useState("");

  const [csvText, setCsvText] = useState("");
  const [csvMessage, setCsvMessage] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editMerchantName, setEditMerchantName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTransactionType, setEditTransactionType] =
    useState<TransactionType>("expense");
  const [editCategory, setEditCategory] = useState("Other");
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

      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (accountError) {
        console.error("Failed to load accounts:", accountError);
        showToast({
          type: "error",
          title: "Failed to load accounts",
          message: accountError.message,
        });
        setHasLoaded(true);
        return;
      }

      const loadedAccounts = (accountData || []) as Account[];
      setAccounts(loadedAccounts);

      if (loadedAccounts.length > 0) {
        setAccountId(loadedAccounts[0].id);
      }

      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (transactionError) {
        console.error("Failed to load transactions:", transactionError);
        showToast({
          type: "error",
          title: "Failed to load transactions",
          message: transactionError.message,
        });
      } else {
        setTransactions((transactionData || []) as Transaction[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, [showToast]);

  const currentMonth = new Date().toISOString().slice(0, 7);

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

    return {
      income,
      spending,
      transfers,
      cashFlow: income - spending,
    };
  }, [transactions, currentMonth]);

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before adding a transaction.",
      });
      return;
    }

    if (!accountId) {
      showToast({
        type: "warning",
        title: "Account required",
        message: "Please select an account first.",
      });
      return;
    }

    if (!name.trim()) {
      showToast({
        type: "warning",
        title: "Transaction name required",
        message: "Please enter a transaction name.",
      });
      return;
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast({
        type: "warning",
        title: "Invalid amount",
        message: "Please enter a valid positive amount.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      user_id: userId,
      account_id: accountId,
      date,
      name: name.trim(),
      merchant_name: merchantName.trim() || name.trim(),
      amount: parsedAmount,
      transaction_type: transactionType,
      category,
      notes: notes.trim() || null,
      source: "manual",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Failed to add transaction:", error);
      showToast({
        type: "error",
        title: "Failed to add transaction",
        message: error.message,
      });
      return;
    }

    setTransactions((current) => [data as Transaction, ...current]);

    setName("");
    setMerchantName("");
    setAmount("");
    setTransactionType("expense");
    setCategory("Other");
    setNotes("");

    showToast({
      type: "success",
      title: "Transaction added",
      message: `${payload.name} was added successfully.`,
    });
  }

  function startEditing(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditAccountId(transaction.account_id);
    setEditDate(transaction.date);
    setEditName(transaction.name);
    setEditMerchantName(transaction.merchant_name || "");
    setEditAmount(String(Number(transaction.amount || 0)));
    setEditTransactionType(transaction.transaction_type);
    setEditCategory(transaction.category || "Other");
    setEditNotes(transaction.notes || "");
  }

  function cancelEditing() {
    setEditingId("");
    setEditAccountId("");
    setEditDate("");
    setEditName("");
    setEditMerchantName("");
    setEditAmount("");
    setEditTransactionType("expense");
    setEditCategory("Other");
    setEditNotes("");
  }

  async function saveTransactionEdit(transactionId: string) {
    if (!editAccountId) {
      showToast({
        type: "warning",
        title: "Account required",
        message: "Please select an account.",
      });
      return;
    }

    if (!editName.trim()) {
      showToast({
        type: "warning",
        title: "Transaction name required",
        message: "Please enter a transaction name.",
      });
      return;
    }

    const parsedAmount = Number(editAmount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast({
        type: "warning",
        title: "Invalid amount",
        message: "Please enter a valid positive amount.",
      });
      return;
    }

    setUpdatingId(transactionId);

    const { data, error } = await supabase
      .from("transactions")
      .update({
        account_id: editAccountId,
        date: editDate,
        name: editName.trim(),
        merchant_name: editMerchantName.trim() || editName.trim(),
        amount: parsedAmount,
        transaction_type: editTransactionType,
        category: editCategory,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .select()
      .single();

    setUpdatingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Failed to update transaction",
        message: error.message,
      });
      return;
    }

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === transactionId ? (data as Transaction) : transaction
      )
    );

    cancelEditing();

    showToast({
      type: "success",
      title: "Transaction updated",
      message: `${editName.trim()} was saved successfully.`,
    });
  }

  async function importCsv() {
    setCsvMessage("");

    if (!userId) {
      setCsvMessage("You must be logged in.");
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before importing CSV data.",
      });
      return;
    }

    if (!accountId) {
      setCsvMessage("Please add/select an account before importing.");
      showToast({
        type: "warning",
        title: "Account required",
        message: "Please add or select an account before importing.",
      });
      return;
    }

    if (!csvText.trim()) {
      setCsvMessage("Paste CSV data first.");
      showToast({
        type: "warning",
        title: "CSV data required",
        message: "Paste CSV data before importing.",
      });
      return;
    }

    const result = parseCsvTransactions(csvText, userId, accountId);

    if (result.transactions.length === 0) {
      const message =
        result.errors.length > 0
          ? result.errors[0]
          : "No valid transactions found.";

      setCsvMessage(`No valid transactions found. ${message}`);

      showToast({
        type: "warning",
        title: "No valid transactions found",
        message,
      });
      return;
    }

    setImporting(true);

    const { data, error } = await supabase
      .from("transactions")
      .insert(result.transactions)
      .select();

    setImporting(false);

    if (error) {
      console.error("CSV import failed:", error);
      setCsvMessage(error.message);
      showToast({
        type: "error",
        title: "CSV import failed",
        message: error.message,
      });
      return;
    }

    setTransactions((current) => [
      ...((data || []) as Transaction[]),
      ...current,
    ]);

    const message = `Imported ${data?.length || 0} transaction${
      data?.length === 1 ? "" : "s"
    }. ${
      result.errors.length > 0 ? `${result.errors.length} row(s) skipped.` : ""
    }`;

    setCsvMessage(message);
    setCsvText("");

    showToast({
      type: "success",
      title: "CSV import complete",
      message,
    });
  }

  async function deleteTransaction(transaction: Transaction) {
    const confirmed = await confirm({
      title: `Delete ${transaction.name}?`,
      message: `Amount: ${formatCurrency(
        Number(transaction.amount)
      )}\n\nThis will permanently remove the transaction from Supabase.\n\nThis action cannot be undone.`,
      confirmLabel: "Delete Transaction",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setDeletingId(transaction.id);

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id);

    setDeletingId("");

    if (error) {
      showToast({
        type: "error",
        title: "Failed to delete transaction",
        message: error.message,
      });
      return;
    }

    setTransactions((current) =>
      current.filter((item) => item.id !== transaction.id)
    );

    showToast({
      type: "success",
      title: "Transaction deleted",
      message: `${transaction.name} was removed.`,
    });
  }

  function getAccountName(id: string) {
    return accounts.find((account) => account.id === id)?.name || "Unknown";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            Loading transactions...
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
            <p className="text-sm text-slate-400">WealthOS</p>
            <h1 className="mt-2 text-3xl font-semibold">Transactions</h1>
            <p className="mt-1 text-sm text-slate-500">
              Add, edit, import, and manage your transactions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              title="Monthly Income"
              value={formatCurrency(monthlySummary.income)}
            />
            <SummaryCard
              title="Monthly Spending"
              value={formatCurrency(monthlySummary.spending)}
            />
            <SummaryCard
              title="Monthly Cash Flow"
              value={formatCurrency(monthlySummary.cashFlow)}
            />
            <SummaryCard
              title="Transfers"
              value={formatCurrency(monthlySummary.transfers)}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Add Transaction</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Add transactions manually or import CSV data.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCsvImport((current) => !current)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  {showCsvImport ? "Hide CSV Import" : "Show CSV Import"}
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
                  You need to add at least one active account first.
                  <div className="mt-3">
                    <Link
                      href="/accounts"
                      className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500"
                    >
                      Add Account
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  <form onSubmit={addTransaction} className="space-y-4">
                    <AccountSelect
                      accounts={accounts}
                      accountId={accountId}
                      setAccountId={setAccountId}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm text-slate-300">Date</label>
                        <input
                          value={date}
                          onChange={(event) => setDate(event.target.value)}
                          type="date"
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-slate-300">Amount</label>
                        <input
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder="Example: 45.99"
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-slate-300">
                        Transaction Name
                      </label>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Example: Walmart, Salary, Rent"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-slate-300">Merchant</label>
                      <input
                        value={merchantName}
                        onChange={(event) =>
                          setMerchantName(event.target.value)
                        }
                        placeholder="Optional"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <TransactionTypeSelect
                        transactionType={transactionType}
                        setTransactionType={setTransactionType}
                      />

                      <CategorySelect
                        category={category}
                        setCategory={setCategory}
                      />
                    </div>

                    <div>
                      <label className="text-sm text-slate-300">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional notes"
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Add Transaction"}
                    </button>
                  </form>

                  {showCsvImport && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <h3 className="text-sm font-medium text-slate-200">
                        CSV Import
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Required columns: date, name, amount. Optional:
                        merchant, type, category.
                      </p>

                      <div className="mt-4">
                        <label className="text-sm text-slate-300">
                          Import Account
                        </label>
                        <select
                          value={accountId}
                          onChange={(event) => setAccountId(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        value={csvText}
                        onChange={(event) => setCsvText(event.target.value)}
                        placeholder={SAMPLE_CSV}
                        rows={8}
                        className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setCsvText(SAMPLE_CSV)}
                          className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                        >
                          Use Sample CSV
                        </button>

                        <button
                          type="button"
                          onClick={importCsv}
                          disabled={importing}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {importing ? "Importing..." : "Import CSV"}
                        </button>
                      </div>

                      {csvMessage && (
                        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">
                          {csvMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Transaction List</h2>
                  <p className="text-sm text-slate-400">
                    {transactions.length} transaction
                    {transactions.length === 1 ? "" : "s"} added
                  </p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                  No transactions yet. Add one manually or import a CSV.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {transactions.map((transaction) => {
                    const isEditing = editingId === transaction.id;
                    const isBusy =
                      updatingId === transaction.id ||
                      deletingId === transaction.id;

                    return (
                      <div
                        key={transaction.id}
                        className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="text-xs text-slate-400">
                                  Date
                                </label>
                                <input
                                  value={editDate}
                                  onChange={(event) =>
                                    setEditDate(event.target.value)
                                  }
                                  type="date"
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-400">
                                  Account
                                </label>
                                <select
                                  value={editAccountId}
                                  onChange={(event) =>
                                    setEditAccountId(event.target.value)
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                >
                                  {accounts.map((account) => (
                                    <option
                                      key={account.id}
                                      value={account.id}
                                    >
                                      {account.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">
                                Transaction Name
                              </label>
                              <input
                                value={editName}
                                onChange={(event) =>
                                  setEditName(event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">
                                Merchant
                              </label>
                              <input
                                value={editMerchantName}
                                onChange={(event) =>
                                  setEditMerchantName(event.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div>
                                <label className="text-xs text-slate-400">
                                  Amount
                                </label>
                                <input
                                  value={editAmount}
                                  onChange={(event) =>
                                    setEditAmount(event.target.value)
                                  }
                                  type="number"
                                  step="0.01"
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-slate-400">
                                  Type
                                </label>
                                <select
                                  value={editTransactionType}
                                  onChange={(event) =>
                                    setEditTransactionType(
                                      event.target.value as TransactionType
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                >
                                  <option value="expense">Expense</option>
                                  <option value="income">Income</option>
                                  <option value="transfer">Transfer</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-xs text-slate-400">
                                  Category
                                </label>
                                <select
                                  value={editCategory}
                                  onChange={(event) =>
                                    setEditCategory(event.target.value)
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                >
                                  {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs text-slate-400">
                                Notes
                              </label>
                              <textarea
                                value={editNotes}
                                onChange={(event) =>
                                  setEditNotes(event.target.value)
                                }
                                rows={2}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  saveTransactionEdit(transaction.id)
                                }
                                disabled={isBusy}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                              >
                                {updatingId === transaction.id
                                  ? "Saving..."
                                  : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={isBusy}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="break-words font-medium">
                                  {transaction.name}
                                </p>
                                <p className="mt-1 break-words text-xs text-slate-500">
                                  {transaction.date} •{" "}
                                  {getAccountName(transaction.account_id)}
                                </p>
                              </div>

                              <p
                                className={
                                  transaction.transaction_type === "income"
                                    ? "shrink-0 text-left text-lg font-semibold text-emerald-300 sm:text-right"
                                    : transaction.transaction_type === "expense"
                                    ? "shrink-0 text-left text-lg font-semibold text-red-300 sm:text-right"
                                    : "shrink-0 text-left text-lg font-semibold text-slate-300 sm:text-right"
                                }
                              >
                                {transaction.transaction_type === "income"
                                  ? "+"
                                  : transaction.transaction_type === "expense"
                                  ? "-"
                                  : ""}
                                {formatCurrency(Number(transaction.amount))}
                              </p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs capitalize text-slate-300">
                                {transaction.transaction_type}
                              </span>
                              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
                                {transaction.category}
                              </span>
                              {transaction.merchant_name && (
                                <span className="max-w-full break-words rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                                  {transaction.merchant_name}
                                </span>
                              )}
                            </div>

                            {transaction.notes && (
                              <p className="mt-4 break-words rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
                                {transaction.notes}
                              </p>
                            )}

                            <div className="mt-5 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => startEditing(transaction)}
                                disabled={isBusy}
                                className="rounded-lg border border-blue-900 px-3 py-2 text-xs text-blue-300 hover:bg-blue-950 disabled:opacity-60"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteTransaction(transaction)}
                                disabled={isBusy}
                                className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 disabled:opacity-60"
                              >
                                {deletingId === transaction.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
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

function AccountSelect({
  accounts,
  accountId,
  setAccountId,
}: {
  accounts: Account[];
  accountId: string;
  setAccountId: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-slate-300">Account</label>
      <select
        value={accountId}
        onChange={(event) => setAccountId(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TransactionTypeSelect({
  transactionType,
  setTransactionType,
}: {
  transactionType: TransactionType;
  setTransactionType: (value: TransactionType) => void;
}) {
  return (
    <div>
      <label className="text-sm text-slate-300">Type</label>
      <select
        value={transactionType}
        onChange={(event) =>
          setTransactionType(event.target.value as TransactionType)
        }
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        <option value="expense">Expense</option>
        <option value="income">Income</option>
        <option value="transfer">Transfer</option>
      </select>
    </div>
  );
}

function CategorySelect({
  category,
  setCategory,
}: {
  category: string;
  setCategory: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-slate-300">Category</label>
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function parseCsvTransactions(csv: string, userId: string, accountId: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const transactions: Array<{
    user_id: string;
    account_id: string;
    date: string;
    name: string;
    merchant_name: string;
    amount: number;
    transaction_type: TransactionType;
    category: string;
    notes: string;
    source: string;
    updated_at: string;
  }> = [];

  const errors: string[] = [];

  if (lines.length < 2) {
    return {
      transactions,
      errors: ["CSV must include a header row and at least one data row."],
    };
  }

  const headers = splitCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase()
  );

  const dateIndex = headers.indexOf("date");
  const nameIndex = headers.indexOf("name");
  const merchantIndex = headers.indexOf("merchant");
  const amountIndex = headers.indexOf("amount");
  const typeIndex = headers.indexOf("type");
  const categoryIndex = headers.indexOf("category");

  if (dateIndex === -1 || nameIndex === -1 || amountIndex === -1) {
    return {
      transactions,
      errors: ["Missing required columns: date, name, amount."],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);

    const date = values[dateIndex]?.trim();
    const name = values[nameIndex]?.trim();
    const merchant = merchantIndex >= 0 ? values[merchantIndex]?.trim() : "";
    const amountRaw = values[amountIndex]?.trim();
    const typeRaw =
      typeIndex >= 0 ? values[typeIndex]?.trim().toLowerCase() : "expense";
    const category =
      categoryIndex >= 0 ? values[categoryIndex]?.trim() || "Other" : "Other";

    const amount = Number(String(amountRaw).replace(/[$,]/g, ""));

    if (!date || !name || Number.isNaN(amount)) {
      errors.push(`Row ${i + 1} skipped due to invalid required fields.`);
      continue;
    }

    transactions.push({
      user_id: userId,
      account_id: accountId,
      date: normalizeDate(date),
      name,
      merchant_name: merchant || name,
      amount: Math.abs(amount),
      transaction_type: normalizeTransactionType(typeRaw),
      category,
      notes: "Imported from CSV",
      source: "csv",
      updated_at: new Date().toISOString(),
    });
  }

  return {
    transactions,
    errors,
  };
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);

  return result;
}

function normalizeDate(value: string) {
  const cleaned = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  const parsed = new Date(cleaned);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function normalizeTransactionType(value: string): TransactionType {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "income") return "income";
  if (normalized === "transfer") return "transfer";
  return "expense";
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
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
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

const OLD_LOCAL_TRANSACTIONS_KEY = "wealthos_transactions_v1";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

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
        alert(accountError.message);
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
        alert(transactionError.message);
      } else {
        setTransactions((transactionData || []) as Transaction[]);
      }

      setHasLoaded(true);
    }

    initialize();
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);

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

    const transfers = monthTransactions
      .filter((transaction) => transaction.transaction_type === "transfer")
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);

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
      alert("You must be logged in.");
      return;
    }

    if (!accountId) {
      alert("Please select an account.");
      return;
    }

    if (!name.trim()) {
      alert("Please enter a transaction name.");
      return;
    }

    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid positive amount.");
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
      notes: notes.trim(),
      source: "manual",
    };

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Failed to add transaction:", error);
      alert(error.message);
      return;
    }

    setTransactions((current) => [data as Transaction, ...current]);

    setName("");
    setMerchantName("");
    setAmount("");
    setTransactionType("expense");
    setCategory("Other");
    setNotes("");
  }

  async function importCsv() {
    setCsvMessage("");

    if (!userId) {
      setCsvMessage("You must be logged in.");
      return;
    }

    if (!accountId) {
      setCsvMessage("Please add/select an account before importing.");
      return;
    }

    if (!csvText.trim()) {
      setCsvMessage("Paste CSV data first.");
      return;
    }

    const result = parseCsvTransactions(csvText, userId, accountId);

    if (result.transactions.length === 0) {
      setCsvMessage(
        `No valid transactions found. ${
          result.errors.length > 0 ? result.errors[0] : ""
        }`
      );
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
      return;
    }

    setTransactions((current) => [...((data || []) as Transaction[]), ...current]);

    setCsvMessage(
      `Imported ${data?.length || 0} transaction${
        data?.length === 1 ? "" : "s"
      }. ${result.errors.length > 0 ? `${result.errors.length} row(s) skipped.` : ""}`
    );

    setCsvText("");
  }

  async function importOldLocalTransactions() {
    if (!userId) {
      alert("You must be logged in.");
      return;
    }

    if (accounts.length === 0) {
      alert("Add or import accounts first before importing old transactions.");
      return;
    }

    const saved = window.localStorage.getItem(OLD_LOCAL_TRANSACTIONS_KEY);

    if (!saved) {
      alert("No old local transactions found.");
      return;
    }

    let parsed: any[];

    try {
      parsed = JSON.parse(saved);
    } catch {
      alert("Old local transactions data is not valid JSON.");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      alert("No old local transactions found.");
      return;
    }

    const confirmed = confirm(
      `Import ${parsed.length} old local transaction(s) into Supabase? Only click this once to avoid duplicates.`
    );

    if (!confirmed) return;

    const fallbackAccountId = accounts[0].id;

    const existingKeys = new Set(
      transactions.map(
        (transaction) =>
          `${transaction.date}-${transaction.name}-${Number(
            transaction.amount
          )}-${transaction.transaction_type}-${transaction.category}`
      )
    );

    const payload = parsed
      .filter((transaction) => {
        const key = `${transaction.date}-${transaction.name}-${Number(
          transaction.amount || 0
        )}-${transaction.transactionType}-${transaction.category}`;

        return !existingKeys.has(key);
      })
      .map((transaction) => ({
        user_id: userId,
        account_id: mapOldAccountIdToSupabase(
          transaction.accountId,
          fallbackAccountId
        ),
        date: transaction.date || new Date().toISOString().slice(0, 10),
        name: transaction.name || "Imported Transaction",
        merchant_name:
          transaction.merchantName || transaction.name || "Imported Transaction",
        amount: Math.abs(Number(transaction.amount || 0)),
        transaction_type: normalizeTransactionType(transaction.transactionType),
        category: transaction.category || "Other",
        notes: transaction.notes || "Imported from old localStorage",
        source: "local_import",
      }))
      .filter((transaction) => transaction.amount > 0);

    if (payload.length === 0) {
      alert("No new transactions to import. They may already exist in Supabase.");
      return;
    }

    setImporting(true);

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select();

    setImporting(false);

    if (error) {
      console.error("Failed to import old local transactions:", error);
      alert(error.message);
      return;
    }

    setTransactions((current) => [...((data || []) as Transaction[]), ...current]);

    alert(`Imported ${data?.length || 0} old local transaction(s) into Supabase.`);
  }

  function mapOldAccountIdToSupabase(
    oldAccountId: string,
    fallbackAccountId: string
  ) {
    // Since old local account IDs do not match new Supabase UUIDs reliably,
    // we attach imported transactions to the first active Supabase account.
    // Later, we can build a mapping screen if needed.
    return fallbackAccountId;
  }

  async function deleteTransaction(id: string) {
    const confirmed = confirm("Delete this transaction?");

    if (!confirmed) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setTransactions((current) =>
      current.filter((transaction) => transaction.id !== id)
    );
  }

  async function clearAllTransactions() {
    const confirmed = confirm(
      "Delete all Supabase transactions for this user? This cannot be undone."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    setTransactions([]);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function getAccountName(id: string) {
    return accounts.find((account) => account.id === id)?.name || "Unknown";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading transactions...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">WealthOS MVP</p>
            <h1 className="mt-2 text-3xl font-semibold">Transactions</h1>
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
              Accounts
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={importOldLocalTransactions}
              disabled={importing}
              className="rounded-xl border border-blue-900 px-4 py-2 text-sm text-blue-300 hover:bg-blue-950 disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Old Local Transactions"}
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[380px_420px_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Add Transaction</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manual transactions are now stored in Supabase.
            </p>

            {accounts.length === 0 ? (
              <div className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
                You need to add at least one Supabase account first.
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
              <form onSubmit={addTransaction} className="mt-5 space-y-4">
                <AccountSelect
                  accounts={accounts}
                  accountId={accountId}
                  setAccountId={setAccountId}
                />

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
                    onChange={(event) => setMerchantName(event.target.value)}
                    placeholder="Optional"
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

                <TransactionTypeSelect
                  transactionType={transactionType}
                  setTransactionType={setTransactionType}
                />

                <CategorySelect category={category} setCategory={setCategory} />

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
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">CSV Import</h2>
            <p className="mt-1 text-sm text-slate-400">
              Paste transactions in CSV format and bulk import to Supabase.
            </p>

            {accounts.length > 0 && (
              <div className="mt-5 space-y-4">
                <AccountSelect
                  accounts={accounts}
                  accountId={accountId}
                  setAccountId={setAccountId}
                />

                <div>
                  <label className="text-sm text-slate-300">CSV Data</label>
                  <textarea
                    value={csvText}
                    onChange={(event) => setCsvText(event.target.value)}
                    placeholder={SAMPLE_CSV}
                    rows={11}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Required columns: date, name, amount. Optional: merchant,
                    type, category.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                    {csvMessage}
                  </div>
                )}
              </div>
            )}

            {accounts.length === 0 && (
              <div className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
                Add a Supabase account first before importing CSV transactions.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Transaction List</h2>
                <p className="text-sm text-slate-400">
                  {transactions.length} transaction
                  {transactions.length === 1 ? "" : "s"} added
                </p>
              </div>

              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllTransactions}
                  className="rounded-lg border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => (
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

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteTransaction(transaction.id)}
                          className="rounded-lg border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No Supabase transactions yet. Add manually, import CSV,
                        or import old local transactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
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
        {accounts
          .filter((account) => account.is_active)
          .map((account) => (
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
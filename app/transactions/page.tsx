"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import PlaidSyncButton from "@/components/PlaidSyncButton";
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

type CategoryRule = {
  id: string;
  user_id: string;
  rule_name: string;
  match_field: string;
  match_type: string;
  match_value: string;
  category: string;
  transaction_type: TransactionType | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ImportMapping = {
  dateColumn: string;
  nameColumn: string;
  merchantColumn: string;
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  categoryColumn: string;
  typeColumn: string;
  notesColumn: string;
};

type RawImportRow = Record<string, string>;

type PreviewStatus = "new" | "duplicate" | "invalid";

type PreviewTransaction = {
  previewId: string;
  selected: boolean;
  status: PreviewStatus;
  duplicateReason: string;
  raw: RawImportRow;
  parsed: {
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
  };
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
2026-05-02,Walmart,Walmart,-85.25,expense,Groceries
2026-05-03,Chipotle,Chipotle,-18.40,expense,Restaurants
2026-05-04,Rent,Apartment,-1400,expense,Rent/Mortgage`;

const DEFAULT_MAPPING: ImportMapping = {
  dateColumn: "",
  nameColumn: "",
  merchantColumn: "",
  amountColumn: "",
  debitColumn: "",
  creditColumn: "",
  categoryColumn: "",
  typeColumn: "",
  notesColumn: "",
};

export default function TransactionsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [showImporter, setShowImporter] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "income" | "expense" | "transfer"
  >("all");

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
  const [importFileName, setImportFileName] = useState("");
  const [importFileType, setImportFileType] = useState("");
  const [sourceName, setSourceName] = useState("Manual Import");
  const [importMessage, setImportMessage] = useState("");
  const [rawImportRows, setRawImportRows] = useState<RawImportRow[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [importMapping, setImportMapping] =
    useState<ImportMapping>(DEFAULT_MAPPING);
  const [previewRows, setPreviewRows] = useState<PreviewTransaction[]>([]);
  const [saveMapping, setSaveMapping] = useState(true);

  const [newRuleMatch, setNewRuleMatch] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("Other");
  const [newRuleType, setNewRuleType] = useState<TransactionType>("expense");
  const [savingRule, setSavingRule] = useState(false);

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

      const [accountsResponse, transactionsResponse, rulesResponse] =
        await Promise.all([
          supabase
            .from("accounts")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase
            .from("category_rules")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("priority", { ascending: true })
            .order("created_at", { ascending: false }),
        ]);

      if (accountsResponse.error) {
        showToast({
          type: "error",
          title: "Failed to load accounts",
          message: accountsResponse.error.message,
        });
        setHasLoaded(true);
        return;
      }

      const loadedAccounts = (accountsResponse.data || []) as Account[];
      setAccounts(loadedAccounts);

      if (loadedAccounts.length > 0) {
        setAccountId(loadedAccounts[0].id);
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

      if (rulesResponse.error) {
        console.warn("Category rules not loaded:", rulesResponse.error.message);
      } else {
        setCategoryRules((rulesResponse.data || []) as CategoryRule[]);
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

  const importStats = useMemo(() => {
    const total = previewRows.length;
    const selected = previewRows.filter((row) => row.selected).length;
    const duplicates = previewRows.filter(
      (row) => row.status === "duplicate"
    ).length;
    const invalid = previewRows.filter((row) => row.status === "invalid").length;
    const ready = previewRows.filter((row) => row.status === "new").length;

    return {
      total,
      selected,
      duplicates,
      invalid,
      ready,
    };
  }, [previewRows]);

  const topCategories = useMemo(() => {
    const monthExpenses = transactions.filter(
      (transaction) =>
        transaction.date.startsWith(currentMonth) &&
        transaction.transaction_type === "expense"
    );

    const totals = new Map<string, number>();

    monthExpenses.forEach((transaction) => {
      const key = transaction.category || "Other";
      totals.set(
        key,
        (totals.get(key) || 0) + Math.abs(Number(transaction.amount || 0))
      );
    });

    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions, currentMonth]);

  const filteredTransactions = useMemo(() => {
    if (activeFilter === "all") return transactions;

    return transactions.filter(
      (transaction) => transaction.transaction_type === activeFilter
    );
  }, [transactions, activeFilter]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();

    filteredTransactions.forEach((transaction) => {
      const key = transaction.date;
      const current = groups.get(key) || [];
      current.push(transaction);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([date, rows]) => ({
      date,
      rows,
      income: rows
        .filter((row) => row.transaction_type === "income")
        .reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0),
      spending: rows
        .filter((row) => row.transaction_type === "expense")
        .reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0),
    }));
  }, [filteredTransactions]);

  const cashFlowPercent = useMemo(() => {
    if (monthlySummary.income <= 0) return 0;

    return Math.max(
      Math.min((monthlySummary.cashFlow / monthlySummary.income) * 100, 100),
      -100
    );
  }, [monthlySummary]);

  async function reloadTransactions() {
    if (!userId) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      showToast({
        type: "error",
        title: "Failed to reload transactions",
        message: error.message,
      });
      return;
    }

    setTransactions((data || []) as Transaction[]);
  }

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
    setShowManualForm(false);

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

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!accountId) {
      showToast({
        type: "warning",
        title: "Account required",
        message: "Please select an import account before uploading a file.",
      });
      return;
    }

    setParsingFile(true);
    setImportMessage("");
    setPreviewRows([]);
    setRawImportRows([]);
    setImportColumns([]);
    setImportFileName(file.name);
    setImportFileType(getFileType(file.name, file.type));

    try {
      const type = getFileType(file.name, file.type);
      let rows: RawImportRow[] = [];

      if (type === "csv") {
        const text = await file.text();
        rows = await parseCsvRows(text);
      } else if (type === "xlsx") {
        rows = await parseXlsxRows(file);
      } else if (type === "pdf") {
        rows = await parsePdfRows(file);
      } else {
        throw new Error(
          "Unsupported file type. Upload CSV, XLSX, or text-based PDF."
        );
      }

      if (rows.length === 0) {
        throw new Error("No transaction-like rows were found in this file.");
      }

      const columns = getColumnsFromRows(rows);
      const mapping = inferMapping(columns);

      setRawImportRows(rows);
      setImportColumns(columns);
      setImportMapping(mapping);

      const source =
        sourceName.trim() ||
        getSourceNameFromFile(file.name) ||
        "Manual Import";

      const preview = buildPreviewRows({
        rows,
        mapping,
        userId,
        accountId,
        sourceName: source,
        existingTransactions: transactions,
        categoryRules,
      });

      setPreviewRows(preview);

      const duplicateCount = preview.filter(
        (row) => row.status === "duplicate"
      ).length;
      const invalidCount = preview.filter((row) => row.status === "invalid")
        .length;

      setImportMessage(
        `Parsed ${preview.length} row${
          preview.length === 1 ? "" : "s"
        }. ${duplicateCount} possible duplicate${
          duplicateCount === 1 ? "" : "s"
        }, ${invalidCount} invalid row${invalidCount === 1 ? "" : "s"}.`
      );

      showToast({
        type: "success",
        title: "File parsed",
        message: `Preview is ready for ${file.name}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse file.";

      setImportMessage(message);

      showToast({
        type: "error",
        title: "Import parsing failed",
        message,
      });
    } finally {
      setParsingFile(false);
      event.target.value = "";
    }
  }

  function rebuildPreview(nextMapping = importMapping) {
    if (rawImportRows.length === 0) return;

    const preview = buildPreviewRows({
      rows: rawImportRows,
      mapping: nextMapping,
      userId,
      accountId,
      sourceName: sourceName.trim() || "Manual Import",
      existingTransactions: transactions,
      categoryRules,
    });

    setPreviewRows(preview);
  }

  function updateMapping(field: keyof ImportMapping, value: string) {
    const nextMapping = {
      ...importMapping,
      [field]: value,
    };

    setImportMapping(nextMapping);
    rebuildPreview(nextMapping);
  }

  function togglePreviewRow(previewId: string) {
    setPreviewRows((current) =>
      current.map((row) =>
        row.previewId === previewId
          ? {
              ...row,
              selected: !row.selected,
            }
          : row
      )
    );
  }

  function selectAllNewRows() {
    setPreviewRows((current) =>
      current.map((row) => ({
        ...row,
        selected: row.status === "new",
      }))
    );
  }

  function clearPreviewSelection() {
    setPreviewRows((current) =>
      current.map((row) => ({
        ...row,
        selected: false,
      }))
    );
  }

  async function importSelectedPreviewRows() {
    if (!userId || !accountId) {
      showToast({
        type: "warning",
        title: "Account required",
        message: "Select an account before importing.",
      });
      return;
    }

    const rowsToImport = previewRows.filter(
      (row) => row.selected && row.status === "new"
    );

    if (rowsToImport.length === 0) {
      showToast({
        type: "warning",
        title: "No rows selected",
        message: "Select at least one new transaction to import.",
      });
      return;
    }

    setImporting(true);

    const payload = rowsToImport.map((row) => row.parsed);

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select();

    if (error) {
      setImporting(false);
      showToast({
        type: "error",
        title: "Import failed",
        message: error.message,
      });
      return;
    }

    if (saveMapping) {
      await saveImportMapping();
    }

    await createImportBatch({
      rowCount: previewRows.length,
      importedCount: data?.length || 0,
      skippedCount: previewRows.filter((row) => !row.selected).length,
      duplicateCount: previewRows.filter((row) => row.status === "duplicate")
        .length,
    });

    setImporting(false);

    setTransactions((current) => [
      ...((data || []) as Transaction[]),
      ...current,
    ]);

    setPreviewRows([]);
    setRawImportRows([]);
    setImportColumns([]);
    setImportFileName("");
    setImportFileType("");
    setImportMessage("");
    setCsvText("");

    showToast({
      type: "success",
      title: "Import complete",
      message: `Imported ${data?.length || 0} transaction${
        data?.length === 1 ? "" : "s"
      }.`,
    });
  }

  async function saveImportMapping() {
    if (!userId || !sourceName.trim() || !importFileType) return;

    await supabase.from("import_mappings").insert({
      user_id: userId,
      source_name: sourceName.trim(),
      file_type: importFileType,
      date_column: importMapping.dateColumn || null,
      name_column: importMapping.nameColumn || null,
      merchant_column: importMapping.merchantColumn || null,
      amount_column: importMapping.amountColumn || null,
      debit_column: importMapping.debitColumn || null,
      credit_column: importMapping.creditColumn || null,
      category_column: importMapping.categoryColumn || null,
      account_column: null,
      notes_column: importMapping.notesColumn || null,
      updated_at: new Date().toISOString(),
    });
  }

  async function createImportBatch({
    rowCount,
    importedCount,
    skippedCount,
    duplicateCount,
  }: {
    rowCount: number;
    importedCount: number;
    skippedCount: number;
    duplicateCount: number;
  }) {
    if (!userId) return;

    await supabase.from("import_batches").insert({
      user_id: userId,
      source_name: sourceName.trim() || "Manual Import",
      file_name: importFileName || null,
      file_type: importFileType || null,
      row_count: rowCount,
      imported_count: importedCount,
      skipped_count: skippedCount,
      duplicate_count: duplicateCount,
      status: "imported",
    });
  }

  async function createCategoryRule() {
    if (!userId) {
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before creating rules.",
      });
      return;
    }

    if (!newRuleMatch.trim()) {
      showToast({
        type: "warning",
        title: "Rule match required",
        message: "Enter text to match, such as Walmart or Payroll.",
      });
      return;
    }

    setSavingRule(true);

    const payload = {
      user_id: userId,
      rule_name: `${newRuleMatch.trim()} → ${newRuleCategory}`,
      match_field: "name",
      match_type: "contains",
      match_value: newRuleMatch.trim().toLowerCase(),
      category: newRuleCategory,
      transaction_type: newRuleType,
      priority: 100,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("category_rules")
      .insert(payload)
      .select()
      .single();

    setSavingRule(false);

    if (error) {
      showToast({
        type: "error",
        title: "Failed to create rule",
        message: error.message,
      });
      return;
    }

    setCategoryRules((current) => [data as CategoryRule, ...current]);
    setNewRuleMatch("");
    setNewRuleCategory("Other");
    setNewRuleType("expense");

    if (rawImportRows.length > 0) {
      const nextRules = [data as CategoryRule, ...categoryRules];
      const preview = buildPreviewRows({
        rows: rawImportRows,
        mapping: importMapping,
        userId,
        accountId,
        sourceName: sourceName.trim() || "Manual Import",
        existingTransactions: transactions,
        categoryRules: nextRules,
      });

      setPreviewRows(preview);
    }

    showToast({
      type: "success",
      title: "Rule created",
      message: `${payload.rule_name} was added.`,
    });
  }

  async function deleteCategoryRule(rule: CategoryRule) {
    const confirmed = await confirm({
      title: `Delete rule "${rule.rule_name}"?`,
      message:
        "This will stop applying this rule to future imports. Existing transactions will not change.",
      confirmLabel: "Delete Rule",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    const { error } = await supabase
      .from("category_rules")
      .delete()
      .eq("id", rule.id);

    if (error) {
      showToast({
        type: "error",
        title: "Failed to delete rule",
        message: error.message,
      });
      return;
    }

    setCategoryRules((current) => current.filter((item) => item.id !== rule.id));

    showToast({
      type: "success",
      title: "Rule deleted",
      message: `${rule.rule_name} was removed.`,
    });
  }

  async function parsePastedCsvPreview() {
    if (!csvText.trim()) {
      showToast({
        type: "warning",
        title: "CSV data required",
        message: "Paste CSV data before parsing.",
      });
      return;
    }

    if (!accountId) {
      showToast({
        type: "warning",
        title: "Account required",
        message: "Select an account before parsing.",
      });
      return;
    }

    setParsingFile(true);

    try {
      const rows = await parseCsvRows(csvText);
      const columns = getColumnsFromRows(rows);
      const mapping = inferMapping(columns);

      setImportFileName("pasted-csv");
      setImportFileType("csv");
      setRawImportRows(rows);
      setImportColumns(columns);
      setImportMapping(mapping);

      const preview = buildPreviewRows({
        rows,
        mapping,
        userId,
        accountId,
        sourceName: sourceName.trim() || "Pasted CSV",
        existingTransactions: transactions,
        categoryRules,
      });

      setPreviewRows(preview);

      setImportMessage(`Parsed ${preview.length} pasted CSV row(s).`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse CSV.";

      setImportMessage(message);

      showToast({
        type: "error",
        title: "CSV parse failed",
        message,
      });
    } finally {
      setParsingFile(false);
    }
  }

  function getAccountName(id: string) {
    return accounts.find((account) => account.id === id)?.name || "Unknown";
  }

  if (!hasLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-white md:flex">
        <AppNav userEmail={userEmail} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-6">
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
        <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
          <PageHeader
            title="Transactions"
            description="Track spending, sync banks, import files, and review cash flow."
            actions={
              <>
                <PlaidSyncButton
                  label="Sync Bank Data"
                  onComplete={reloadTransactions}
                />

                <ActionButton
                  onClick={() => setShowImporter((current) => !current)}
                >
                  Smart Import
                </ActionButton>

                <ActionButton
                  variant="primary"
                  onClick={() => setShowManualForm((current) => !current)}
                  className="bg-orange-600 hover:bg-orange-500"
                >
                  + Add Transaction
                </ActionButton>
              </>
            }
          />

          <Panel variant="hero">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Monthly Cash Flow
                </p>

                <p
                  className={
                    monthlySummary.cashFlow >= 0
                      ? "mt-2 break-words text-4xl font-semibold text-emerald-300"
                      : "mt-2 break-words text-4xl font-semibold text-red-300"
                  }
                >
                  {formatCurrency(monthlySummary.cashFlow)}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {formatCurrency(monthlySummary.income)} income ·{" "}
                  {formatCurrency(monthlySummary.spending)} spending ·{" "}
                  {formatCurrency(monthlySummary.transfers)} transfers
                </p>

                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Spending</span>
                    <span>Income</span>
                  </div>

                  <div className="mt-2 h-4 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={
                        monthlySummary.cashFlow >= 0
                          ? "h-full rounded-full bg-emerald-500"
                          : "h-full rounded-full bg-red-500"
                      }
                      style={{
                        width: `${Math.max(
                          Math.min(
                            monthlySummary.income > 0
                              ? (monthlySummary.spending /
                                  monthlySummary.income) *
                                  100
                              : 0,
                            100
                          ),
                          monthlySummary.spending > 0 ? 4 : 0
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {cashFlowPercent >= 0
                      ? `${Math.round(
                          cashFlowPercent
                        )}% of income remains after expenses.`
                      : `Spending is ${Math.abs(
                          Math.round(cashFlowPercent)
                        )}% above income.`}
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <MetricCard
                  title="Income"
                  value={formatCurrency(monthlySummary.income)}
                  tone="good"
                />
                <MetricCard
                  title="Spending"
                  value={formatCurrency(monthlySummary.spending)}
                  tone="bad"
                />
                <MetricCard
                  title="Transfers"
                  value={formatCurrency(monthlySummary.transfers)}
                  tone="muted"
                />
              </div>
            </div>
          </Panel>

          {showManualForm && (
            <Panel className="mt-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-medium">Add Transaction</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Add a transaction manually when it is not synced or imported.
                  </p>
                </div>

                <ActionButton
                  onClick={() => setShowManualForm(false)}
                  className="rounded-lg px-3 py-2 text-xs"
                >
                  Close
                </ActionButton>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
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
                <form
                  onSubmit={addTransaction}
                  className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr] xl:grid-cols-[1fr_1fr_1fr_1fr_auto]"
                >
                  <AccountSelect
                    accounts={accounts}
                    accountId={accountId}
                    setAccountId={setAccountId}
                  />

                  <div className="min-w-0">
                    <label className="text-sm text-slate-300">Date</label>
                    <input
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      type="date"
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="text-sm text-slate-300">Name</label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Walmart, Salary, Rent"
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="text-sm text-slate-300">Amount</label>
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="45.99"
                      type="number"
                      step="0.01"
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <ActionButton
                      type="submit"
                      variant="primary"
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? "Saving..." : "Save"}
                    </ActionButton>
                  </div>

                  <div className="min-w-0">
                    <label className="text-sm text-slate-300">Merchant</label>
                    <input
                      value={merchantName}
                      onChange={(event) => setMerchantName(event.target.value)}
                      placeholder="Optional"
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <TransactionTypeSelect
                    transactionType={transactionType}
                    setTransactionType={setTransactionType}
                  />

                  <CategorySelect
                    category={category}
                    setCategory={setCategory}
                  />

                  <div className="min-w-0 lg:col-span-2">
                    <label className="text-sm text-slate-300">Notes</label>
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional notes"
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </form>
              )}
            </Panel>
          )}

          {showImporter && (
            <Panel className="mt-6">
              <SmartImporterPanel
                accounts={accounts}
                accountId={accountId}
                setAccountId={setAccountId}
                sourceName={sourceName}
                setSourceName={setSourceName}
                parsingFile={parsingFile}
                importing={importing}
                handleImportFile={handleImportFile}
                csvText={csvText}
                setCsvText={setCsvText}
                parsePastedCsvPreview={parsePastedCsvPreview}
                importMessage={importMessage}
                importColumns={importColumns}
                importMapping={importMapping}
                updateMapping={updateMapping}
                previewRows={previewRows}
                importStats={importStats}
                togglePreviewRow={togglePreviewRow}
                selectAllNewRows={selectAllNewRows}
                clearPreviewSelection={clearPreviewSelection}
                importSelectedPreviewRows={importSelectedPreviewRows}
                saveMapping={saveMapping}
                setSaveMapping={setSaveMapping}
                importFileName={importFileName}
                importFileType={importFileType}
                categoryRules={categoryRules}
                newRuleMatch={newRuleMatch}
                setNewRuleMatch={setNewRuleMatch}
                newRuleCategory={newRuleCategory}
                setNewRuleCategory={setNewRuleCategory}
                newRuleType={newRuleType}
                setNewRuleType={setNewRuleType}
                savingRule={savingRule}
                createCategoryRule={createCategoryRule}
                deleteCategoryRule={deleteCategoryRule}
              />
            </Panel>
          )}

          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel>
              <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-medium">Transaction Feed</h2>
                  <p className="text-sm text-slate-400">
                    {filteredTransactions.length} transaction
                    {filteredTransactions.length === 1 ? "" : "s"} shown
                  </p>
                </div>

                <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {(["all", "income", "expense", "transfer"] as const).map(
                    (filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveFilter(filter)}
                        className={
                          activeFilter === filter
                            ? "shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium capitalize text-white"
                            : "shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs capitalize text-slate-400 hover:bg-slate-800"
                        }
                      >
                        {filter}
                      </button>
                    )
                  )}
                </div>
              </div>

              {groupedTransactions.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                  No transactions yet. Sync Plaid, import a file, or add one
                  manually.
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedTransactions.map((group) => (
                    <div key={group.date} className="min-w-0">
                      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200">
                            {formatDateLabel(group.date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {group.rows.length} transaction
                            {group.rows.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        <div className="shrink-0 text-right text-xs text-slate-500">
                          {group.income > 0 && (
                            <p className="text-emerald-300">
                              +{formatCurrency(group.income)}
                            </p>
                          )}
                          {group.spending > 0 && (
                            <p className="text-red-300">
                              -{formatCurrency(group.spending)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                        {group.rows.map((transaction) => {
                          const isEditing = editingId === transaction.id;
                          const isBusy =
                            updatingId === transaction.id ||
                            deletingId === transaction.id;

                          return (
                            <TransactionFeedRow
                              key={transaction.id}
                              transaction={transaction}
                              accounts={accounts}
                              isEditing={isEditing}
                              isBusy={isBusy}
                              updatingId={updatingId}
                              deletingId={deletingId}
                              editAccountId={editAccountId}
                              setEditAccountId={setEditAccountId}
                              editDate={editDate}
                              setEditDate={setEditDate}
                              editName={editName}
                              setEditName={setEditName}
                              editMerchantName={editMerchantName}
                              setEditMerchantName={setEditMerchantName}
                              editAmount={editAmount}
                              setEditAmount={setEditAmount}
                              editTransactionType={editTransactionType}
                              setEditTransactionType={setEditTransactionType}
                              editCategory={editCategory}
                              setEditCategory={setEditCategory}
                              editNotes={editNotes}
                              setEditNotes={setEditNotes}
                              startEditing={startEditing}
                              cancelEditing={cancelEditing}
                              saveTransactionEdit={saveTransactionEdit}
                              deleteTransaction={deleteTransaction}
                              getAccountName={getAccountName}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <aside className="min-w-0 space-y-6">
              <Panel>
                <h2 className="text-lg font-medium">Top Categories</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Spending this month
                </p>

                <div className="mt-5 space-y-4">
                  {topCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No monthly spending yet.
                    </p>
                  ) : (
                    topCategories.map((row) => {
                      const width =
                        monthlySummary.spending > 0
                          ? (row.amount / monthlySummary.spending) * 100
                          : 0;

                      return (
                        <div key={row.category} className="min-w-0">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <p className="truncate text-sm text-slate-300">
                              {row.category}
                            </p>
                            <p className="shrink-0 text-sm font-medium text-slate-100">
                              {formatCurrency(row.amount)}
                            </p>
                          </div>

                          <div className="mt-2 h-2 rounded-full bg-slate-800">
                            <div
                              className="h-2 rounded-full bg-cyan-400"
                              style={{ width: `${Math.max(width, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>

              <Panel>
                <h2 className="text-lg font-medium">Automation Health</h2>

                <div className="mt-5 space-y-4">
                  <SideMetric
                    label="Smart import preview"
                    value={
                      previewRows.length > 0
                        ? `${importStats.ready} ready`
                        : "No active preview"
                    }
                  />
                  <SideMetric
                    label="Duplicate rows flagged"
                    value={String(importStats.duplicates)}
                  />
                  <SideMetric
                    label="Auto rules"
                    value={String(categoryRules.length)}
                  />
                  <SideMetric
                    label="Synced transactions"
                    value={String(
                      transactions.filter(
                        (transaction) => transaction.source === "plaid"
                      ).length
                    )}
                  />
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function SideMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <span className="min-w-0 text-sm text-slate-400">{label}</span>
      <span className="shrink-0 text-sm font-medium text-slate-100">
        {value}
      </span>
    </div>
  );
}

function TransactionFeedRow({
  transaction,
  accounts,
  isEditing,
  isBusy,
  updatingId,
  deletingId,
  editAccountId,
  setEditAccountId,
  editDate,
  setEditDate,
  editName,
  setEditName,
  editMerchantName,
  setEditMerchantName,
  editAmount,
  setEditAmount,
  editTransactionType,
  setEditTransactionType,
  editCategory,
  setEditCategory,
  editNotes,
  setEditNotes,
  startEditing,
  cancelEditing,
  saveTransactionEdit,
  deleteTransaction,
  getAccountName,
}: {
  transaction: Transaction;
  accounts: Account[];
  isEditing: boolean;
  isBusy: boolean;
  updatingId: string;
  deletingId: string;
  editAccountId: string;
  setEditAccountId: (value: string) => void;
  editDate: string;
  setEditDate: (value: string) => void;
  editName: string;
  setEditName: (value: string) => void;
  editMerchantName: string;
  setEditMerchantName: (value: string) => void;
  editAmount: string;
  setEditAmount: (value: string) => void;
  editTransactionType: TransactionType;
  setEditTransactionType: (value: TransactionType) => void;
  editCategory: string;
  setEditCategory: (value: string) => void;
  editNotes: string;
  setEditNotes: (value: string) => void;
  startEditing: (transaction: Transaction) => void;
  cancelEditing: () => void;
  saveTransactionEdit: (transactionId: string) => void;
  deleteTransaction: (transaction: Transaction) => void;
  getAccountName: (id: string) => string;
}) {
  if (isEditing) {
    return (
      <div className="min-w-0 p-4">
        <TransactionCard
          transaction={transaction}
          accounts={accounts}
          isEditing={isEditing}
          isBusy={isBusy}
          updatingId={updatingId}
          deletingId={deletingId}
          editAccountId={editAccountId}
          setEditAccountId={setEditAccountId}
          editDate={editDate}
          setEditDate={setEditDate}
          editName={editName}
          setEditName={setEditName}
          editMerchantName={editMerchantName}
          setEditMerchantName={setEditMerchantName}
          editAmount={editAmount}
          setEditAmount={setEditAmount}
          editTransactionType={editTransactionType}
          setEditTransactionType={setEditTransactionType}
          editCategory={editCategory}
          setEditCategory={setEditCategory}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          startEditing={startEditing}
          cancelEditing={cancelEditing}
          saveTransactionEdit={saveTransactionEdit}
          deleteTransaction={deleteTransaction}
          getAccountName={getAccountName}
        />
      </div>
    );
  }

  const isIncome = transaction.transaction_type === "income";
  const isExpense = transaction.transaction_type === "expense";

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-medium text-slate-100">
            {transaction.name}
          </p>

          <StatusPill>{transaction.category || "Other"}</StatusPill>

          {transaction.source === "plaid" && (
            <StatusPill tone="good">Plaid</StatusPill>
          )}
        </div>

        <p className="mt-1 truncate text-xs text-slate-500">
          {getAccountName(transaction.account_id)} ·{" "}
          {transaction.merchant_name || transaction.transaction_type}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center sm:gap-3">
        <p
          className={
            isIncome
              ? "text-left text-lg font-semibold text-emerald-300 sm:text-right"
              : isExpense
              ? "text-left text-lg font-semibold text-red-300 sm:text-right"
              : "text-left text-lg font-semibold text-slate-300 sm:text-right"
          }
        >
          {isIncome ? "+" : isExpense ? "-" : ""}
          {formatCurrency(Number(transaction.amount))}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-1">
          <button
            type="button"
            onClick={() => startEditing(transaction)}
            disabled={isBusy}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-60"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => deleteTransaction(transaction)}
            disabled={isBusy}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-red-900 hover:bg-red-950 hover:text-red-300 disabled:opacity-60"
          >
            {deletingId === transaction.id ? "..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmartImporterPanel({
  accounts,
  accountId,
  setAccountId,
  sourceName,
  setSourceName,
  parsingFile,
  importing,
  handleImportFile,
  csvText,
  setCsvText,
  parsePastedCsvPreview,
  importMessage,
  importColumns,
  importMapping,
  updateMapping,
  previewRows,
  importStats,
  togglePreviewRow,
  selectAllNewRows,
  clearPreviewSelection,
  importSelectedPreviewRows,
  saveMapping,
  setSaveMapping,
  importFileName,
  importFileType,
  categoryRules,
  newRuleMatch,
  setNewRuleMatch,
  newRuleCategory,
  setNewRuleCategory,
  newRuleType,
  setNewRuleType,
  savingRule,
  createCategoryRule,
  deleteCategoryRule,
}: {
  accounts: Account[];
  accountId: string;
  setAccountId: (value: string) => void;
  sourceName: string;
  setSourceName: (value: string) => void;
  parsingFile: boolean;
  importing: boolean;
  handleImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  csvText: string;
  setCsvText: (value: string) => void;
  parsePastedCsvPreview: () => void;
  importMessage: string;
  importColumns: string[];
  importMapping: ImportMapping;
  updateMapping: (field: keyof ImportMapping, value: string) => void;
  previewRows: PreviewTransaction[];
  importStats: {
    total: number;
    selected: number;
    duplicates: number;
    invalid: number;
    ready: number;
  };
  togglePreviewRow: (previewId: string) => void;
  selectAllNewRows: () => void;
  clearPreviewSelection: () => void;
  importSelectedPreviewRows: () => void;
  saveMapping: boolean;
  setSaveMapping: (value: boolean) => void;
  importFileName: string;
  importFileType: string;
  categoryRules: CategoryRule[];
  newRuleMatch: string;
  setNewRuleMatch: (value: string) => void;
  newRuleCategory: string;
  setNewRuleCategory: (value: string) => void;
  newRuleType: TransactionType;
  setNewRuleType: (value: TransactionType) => void;
  savingRule: boolean;
  createCategoryRule: () => void;
  deleteCategoryRule: (rule: CategoryRule) => void;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h3 className="text-sm font-medium text-slate-200">
        Smart Import Automation
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Upload CSV, XLSX, or text-based PDF. WealthOS will detect columns,
        preview transactions, flag duplicates, and apply category rules.
      </p>

      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="text-sm text-slate-300">Import Account</label>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="text-sm text-slate-300">Source / Bank Name</label>
          <input
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="Example: Chase, Amex, Fidelity"
            className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="block text-sm text-slate-300">Upload File</label>
        <input
          type="file"
          accept=".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleImportFile}
          disabled={parsingFile}
          className="mt-3 block w-full min-w-0 text-sm text-slate-400 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500 disabled:opacity-60"
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Legacy .xls files are not enabled yet. Export as CSV or XLSX for best
          results. PDFs must be text-based, not scanned images.
        </p>

        {importFileName && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
            File: {importFileName}{" "}
            {importFileType && <span>({importFileType})</span>}
          </div>
        )}
      </div>

      <div className="mt-4 min-w-0">
        <label className="text-sm text-slate-300">Or Paste CSV</label>
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          placeholder={SAMPLE_CSV}
          rows={6}
          className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <ActionButton onClick={() => setCsvText(SAMPLE_CSV)}>
            Use Sample CSV
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={parsePastedCsvPreview}
            disabled={parsingFile}
          >
            {parsingFile ? "Parsing..." : "Preview CSV"}
          </ActionButton>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h4 className="text-sm font-medium text-slate-200">
          Auto-Categorization Rules
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Rules apply during import. Example: name contains Walmart → Groceries.
        </p>

        <div className="mt-4 grid min-w-0 gap-3">
          <input
            value={newRuleMatch}
            onChange={(event) => setNewRuleMatch(event.target.value)}
            placeholder="Text to match, e.g. Walmart"
            className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <select
              value={newRuleCategory}
              onChange={(event) => setNewRuleCategory(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={newRuleType}
              onChange={(event) =>
                setNewRuleType(event.target.value as TransactionType)
              }
              className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <ActionButton
            variant="success"
            onClick={createCategoryRule}
            disabled={savingRule}
          >
            {savingRule ? "Saving Rule..." : "Add Rule"}
          </ActionButton>
        </div>

        {categoryRules.length > 0 && (
          <div className="mt-4 space-y-2">
            {categoryRules.slice(0, 5).map((rule) => (
              <div
                key={rule.id}
                className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-xs font-medium text-slate-300">
                    {rule.rule_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    contains “{rule.match_value}”
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => deleteCategoryRule(rule)}
                  className="shrink-0 text-xs text-red-300 hover:text-red-200"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {importMessage && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">
          {importMessage}
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-slate-200">
                Import Preview
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {importStats.ready} new • {importStats.duplicates} duplicate •{" "}
                {importStats.invalid} invalid • {importStats.selected} selected
              </p>
            </div>

            <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <ActionButton
                onClick={selectAllNewRows}
                className="px-3 py-2 text-xs"
              >
                Select New
              </ActionButton>
              <ActionButton
                onClick={clearPreviewSelection}
                className="px-3 py-2 text-xs"
              >
                Clear
              </ActionButton>
            </div>
          </div>

          {importColumns.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs font-medium text-slate-300">
                Column Mapping
              </p>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                <MappingSelect
                  label="Date"
                  value={importMapping.dateColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("dateColumn", value)}
                />
                <MappingSelect
                  label="Name / Description"
                  value={importMapping.nameColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("nameColumn", value)}
                />
                <MappingSelect
                  label="Merchant"
                  value={importMapping.merchantColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("merchantColumn", value)}
                />
                <MappingSelect
                  label="Amount"
                  value={importMapping.amountColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("amountColumn", value)}
                />
                <MappingSelect
                  label="Debit"
                  value={importMapping.debitColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("debitColumn", value)}
                />
                <MappingSelect
                  label="Credit"
                  value={importMapping.creditColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("creditColumn", value)}
                />
                <MappingSelect
                  label="Category"
                  value={importMapping.categoryColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("categoryColumn", value)}
                />
                <MappingSelect
                  label="Type"
                  value={importMapping.typeColumn}
                  columns={importColumns}
                  onChange={(value) => updateMapping("typeColumn", value)}
                />
              </div>
            </div>
          )}

          <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={saveMapping}
              onChange={(event) => setSaveMapping(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950"
            />
            Save this mapping for future imports from this source
          </label>

          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {previewRows.slice(0, 50).map((row) => (
              <PreviewRowCard
                key={row.previewId}
                row={row}
                togglePreviewRow={togglePreviewRow}
              />
            ))}
          </div>

          {previewRows.length > 50 && (
            <p className="mt-3 text-xs text-slate-500">
              Showing first 50 rows in preview. All selected rows can still be
              imported.
            </p>
          )}

          <ActionButton
            variant="success"
            onClick={importSelectedPreviewRows}
            disabled={importing || importStats.selected === 0}
            className="mt-4 w-full py-3"
          >
            {importing
              ? "Importing..."
              : `Import ${importStats.selected} Selected Transaction${
                  importStats.selected === 1 ? "" : "s"
                }`}
          </ActionButton>
        </div>
      )}
    </div>
  );
}

function MappingSelect({
  label,
  value,
  columns,
  onChange,
}: {
  label: string;
  value: string;
  columns: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="text-xs text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs outline-none focus:border-blue-500"
      >
        <option value="">Not mapped</option>
        {columns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </select>
    </div>
  );
}

function PreviewRowCard({
  row,
  togglePreviewRow,
}: {
  row: PreviewTransaction;
  togglePreviewRow: (previewId: string) => void;
}) {
  const statusClass =
    row.status === "new"
      ? "border-emerald-900 bg-emerald-950/20 text-emerald-200"
      : row.status === "duplicate"
      ? "border-amber-900 bg-amber-950/20 text-amber-200"
      : "border-red-900 bg-red-950/20 text-red-200";

  return (
    <div className={`rounded-2xl border p-3 ${statusClass}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <label className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={row.selected}
            disabled={row.status !== "new"}
            onChange={() => togglePreviewRow(row.previewId)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-950"
          />

          <div className="min-w-0">
            <p className="break-words text-sm font-medium">
              {row.parsed.name}
            </p>
            <p className="mt-1 break-words text-xs opacity-80">
              {row.parsed.date} • {row.parsed.transaction_type} •{" "}
              {row.parsed.category}
            </p>
            {row.duplicateReason && (
              <p className="mt-1 text-xs opacity-80">{row.duplicateReason}</p>
            )}
          </div>
        </label>

        <p className="shrink-0 text-sm font-semibold">
          {formatCurrency(row.parsed.amount)}
        </p>
      </div>
    </div>
  );
}

function TransactionCard({
  transaction,
  accounts,
  isEditing,
  isBusy,
  updatingId,
  deletingId,
  editAccountId,
  setEditAccountId,
  editDate,
  setEditDate,
  editName,
  setEditName,
  editMerchantName,
  setEditMerchantName,
  editAmount,
  setEditAmount,
  editTransactionType,
  setEditTransactionType,
  editCategory,
  setEditCategory,
  editNotes,
  setEditNotes,
  startEditing,
  cancelEditing,
  saveTransactionEdit,
  deleteTransaction,
  getAccountName,
}: {
  transaction: Transaction;
  accounts: Account[];
  isEditing: boolean;
  isBusy: boolean;
  updatingId: string;
  deletingId: string;
  editAccountId: string;
  setEditAccountId: (value: string) => void;
  editDate: string;
  setEditDate: (value: string) => void;
  editName: string;
  setEditName: (value: string) => void;
  editMerchantName: string;
  setEditMerchantName: (value: string) => void;
  editAmount: string;
  setEditAmount: (value: string) => void;
  editTransactionType: TransactionType;
  setEditTransactionType: (value: TransactionType) => void;
  editCategory: string;
  setEditCategory: (value: string) => void;
  editNotes: string;
  setEditNotes: (value: string) => void;
  startEditing: (transaction: Transaction) => void;
  cancelEditing: () => void;
  saveTransactionEdit: (transactionId: string) => void;
  deleteTransaction: (transaction: Transaction) => void;
  getAccountName: (id: string) => string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="text-xs text-slate-400">Date</label>
              <input
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
                type="date"
                className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="min-w-0">
              <label className="text-xs text-slate-400">Account</label>
              <select
                value={editAccountId}
                onChange={(event) => setEditAccountId(event.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <label className="text-xs text-slate-400">Transaction Name</label>
            <input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="min-w-0">
            <label className="text-xs text-slate-400">Merchant</label>
            <input
              value={editMerchantName}
              onChange={(event) => setEditMerchantName(event.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className="text-xs text-slate-400">Amount</label>
              <input
                value={editAmount}
                onChange={(event) => setEditAmount(event.target.value)}
                type="number"
                step="0.01"
                className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="min-w-0">
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={editTransactionType}
                onChange={(event) =>
                  setEditTransactionType(event.target.value as TransactionType)
                }
                className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="text-xs text-slate-400">Category</label>
              <select
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value)}
                className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <label className="text-xs text-slate-400">Notes</label>
            <textarea
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              rows={2}
              className="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <ActionButton
              variant="primary"
              onClick={() => saveTransactionEdit(transaction.id)}
              disabled={isBusy}
              className="rounded-lg px-3 py-2 text-xs"
            >
              {updatingId === transaction.id ? "Saving..." : "Save"}
            </ActionButton>

            <ActionButton
              onClick={cancelEditing}
              disabled={isBusy}
              className="rounded-lg px-3 py-2 text-xs"
            >
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-medium">{transaction.name}</p>
              <p className="mt-1 break-words text-xs text-slate-500">
                {transaction.date} • {getAccountName(transaction.account_id)}
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

          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            <StatusPill>{transaction.transaction_type}</StatusPill>
            <StatusPill>{transaction.category}</StatusPill>
            {transaction.merchant_name && (
              <StatusPill>{transaction.merchant_name}</StatusPill>
            )}
          </div>

          {transaction.notes && (
            <p className="mt-4 break-words rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
              {transaction.notes}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <ActionButton
              onClick={() => startEditing(transaction)}
              disabled={isBusy}
              className="rounded-lg px-3 py-2 text-xs text-blue-300"
            >
              Edit
            </ActionButton>

            <ActionButton
              variant="danger"
              onClick={() => deleteTransaction(transaction)}
              disabled={isBusy}
              className="rounded-lg px-3 py-2 text-xs"
            >
              {deletingId === transaction.id ? "Deleting..." : "Delete"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
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
    <div className="min-w-0">
      <label className="text-sm text-slate-300">Account</label>
      <select
        value={accountId}
        onChange={(event) => setAccountId(event.target.value)}
        className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
    <div className="min-w-0">
      <label className="text-sm text-slate-300">Type</label>
      <select
        value={transactionType}
        onChange={(event) =>
          setTransactionType(event.target.value as TransactionType)
        }
        className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
    <div className="min-w-0">
      <label className="text-sm text-slate-300">Category</label>
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        className="mt-1 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
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

async function parseCsvRows(csv: string) {
  const Papa = await import("papaparse");

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(parsed.errors[0].message);
  }

  return parsed.data
    .filter((row) =>
      Object.values(row).some((value) => String(value || "").trim())
    )
    .map(cleanRawRow);
}

async function parseXlsxRows(file: File) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();

  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("No worksheet found in XLSX file.");
  }

  const headers: string[] = [];

  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    headers[columnNumber - 1] = String(cell.value || "").trim();
  });

  if (headers.length === 0) {
    throw new Error("Could not detect headers in XLSX file.");
  }

  const rows: RawImportRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const item: RawImportRow = {};

    headers.forEach((header, index) => {
      if (!header) return;

      const cell = row.getCell(index + 1);
      item[header] = stringifyExcelCell(cell.value);
    });

    if (Object.values(item).some((value) => String(value || "").trim())) {
      rows.push(cleanRawRow(item));
    }
  });

  return rows;
}

async function parsePdfRows(file: File) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  });

  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const text = content.items
      .map((item: any) => String(item.str || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    lines.push(...text.split(/(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g));
  }

  const rows: RawImportRow[] = [];

  lines.forEach((line) => {
    const cleaned = line.trim();

    if (!cleaned) return;

    const dateMatch = cleaned.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
    const amountMatches = cleaned.match(
      /-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\$?\d+\.\d{2}/g
    );

    if (!dateMatch || !amountMatches || amountMatches.length === 0) return;

    const date = dateMatch[0];
    const amount = amountMatches[amountMatches.length - 1];
    const name = cleaned
      .replace(date, "")
      .replace(amount, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!name) return;

    rows.push({
      Date: date,
      Name: name,
      Amount: amount,
    });
  });

  if (rows.length === 0) {
    throw new Error(
      "No transaction-like rows found. Scanned/image PDFs are not supported yet."
    );
  }

  return rows.map(cleanRawRow);
}

function buildPreviewRows({
  rows,
  mapping,
  userId,
  accountId,
  sourceName,
  existingTransactions,
  categoryRules,
}: {
  rows: RawImportRow[];
  mapping: ImportMapping;
  userId: string;
  accountId: string;
  sourceName: string;
  existingTransactions: Transaction[];
  categoryRules: CategoryRule[];
}) {
  return rows.map((row, index) => {
    const dateRaw = getMappedValue(row, mapping.dateColumn);
    const nameRaw = getMappedValue(row, mapping.nameColumn);
    const merchantRaw = getMappedValue(row, mapping.merchantColumn);
    const amountRaw = getMappedValue(row, mapping.amountColumn);
    const debitRaw = getMappedValue(row, mapping.debitColumn);
    const creditRaw = getMappedValue(row, mapping.creditColumn);
    const categoryRaw = getMappedValue(row, mapping.categoryColumn);
    const typeRaw = getMappedValue(row, mapping.typeColumn);
    const notesRaw = getMappedValue(row, mapping.notesColumn);

    const amountInfo = getAmountAndType({
      amountRaw,
      debitRaw,
      creditRaw,
      typeRaw,
    });

    const parsedDate = normalizeDate(dateRaw);
    const parsedName = String(nameRaw || merchantRaw || "Imported Transaction")
      .trim()
      .slice(0, 160);
    const parsedMerchant = String(merchantRaw || parsedName)
      .trim()
      .slice(0, 160);

    const ruleResult = applyCategoryRules({
      name: parsedName,
      merchant: parsedMerchant,
      categoryRules,
    });

    const category =
      ruleResult.category || String(categoryRaw || "").trim() || "Other";

    const transactionType =
      ruleResult.transactionType || amountInfo.transactionType;

    const parsed = {
      user_id: userId,
      account_id: accountId,
      date: parsedDate,
      name: parsedName,
      merchant_name: parsedMerchant,
      amount: amountInfo.amount,
      transaction_type: transactionType,
      category,
      notes: String(notesRaw || `Imported from ${sourceName}`).trim(),
      source: "smart_import",
      updated_at: new Date().toISOString(),
    };

    const validation = validateParsedTransaction(parsed);
    const duplicateReason = findDuplicateReason(parsed, existingTransactions);

    const status: PreviewStatus = validation
      ? "invalid"
      : duplicateReason
      ? "duplicate"
      : "new";

    return {
      previewId: `preview-${index}-${parsed.date}-${parsed.amount}`,
      selected: status === "new",
      status,
      duplicateReason: validation || duplicateReason,
      raw: row,
      parsed,
    };
  });
}

function validateParsedTransaction(transaction: {
  date: string;
  name: string;
  amount: number;
}) {
  if (!transaction.date) return "Missing date.";
  if (!transaction.name.trim()) return "Missing name.";
  if (Number.isNaN(transaction.amount) || transaction.amount <= 0) {
    return "Invalid amount.";
  }

  return "";
}

function findDuplicateReason(
  transaction: {
    date: string;
    name: string;
    amount: number;
    account_id: string;
  },
  existingTransactions: Transaction[]
) {
  const normalizedName = normalizeForMatch(transaction.name);

  const duplicate = existingTransactions.find((existing) => {
    const sameDate = existing.date === transaction.date;
    const sameAccount = existing.account_id === transaction.account_id;
    const sameAmount =
      Math.abs(Number(existing.amount || 0) - transaction.amount) < 0.01;
    const existingName = normalizeForMatch(existing.name);
    const similarName =
      existingName.includes(normalizedName) ||
      normalizedName.includes(existingName);

    return sameDate && sameAccount && sameAmount && similarName;
  });

  if (!duplicate) return "";

  return `Possible duplicate of "${duplicate.name}" on ${duplicate.date}.`;
}

function applyCategoryRules({
  name,
  merchant,
  categoryRules,
}: {
  name: string;
  merchant: string;
  categoryRules: CategoryRule[];
}) {
  const target = `${name} ${merchant}`.toLowerCase();

  const matchedRule = categoryRules
    .filter((rule) => rule.is_active)
    .sort((a, b) => a.priority - b.priority)
    .find((rule) => {
      const matchValue = String(rule.match_value || "").toLowerCase();

      if (!matchValue) return false;

      if (rule.match_type === "equals") {
        return target === matchValue;
      }

      return target.includes(matchValue);
    });

  return {
    category: matchedRule?.category || "",
    transactionType: matchedRule?.transaction_type || null,
  };
}

function getAmountAndType({
  amountRaw,
  debitRaw,
  creditRaw,
  typeRaw,
}: {
  amountRaw: string;
  debitRaw: string;
  creditRaw: string;
  typeRaw: string;
}) {
  const debit = parseMoney(debitRaw);
  const credit = parseMoney(creditRaw);
  const amount = parseMoney(amountRaw);
  const normalizedType = String(typeRaw || "").toLowerCase();

  if (credit > 0 && debit <= 0) {
    return {
      amount: credit,
      transactionType: "income" as TransactionType,
    };
  }

  if (debit > 0 && credit <= 0) {
    return {
      amount: debit,
      transactionType: "expense" as TransactionType,
    };
  }

  if (amount < 0) {
    return {
      amount: Math.abs(amount),
      transactionType: "expense" as TransactionType,
    };
  }

  if (normalizedType.includes("income") || normalizedType.includes("credit")) {
    return {
      amount: Math.abs(amount),
      transactionType: "income" as TransactionType,
    };
  }

  if (normalizedType.includes("transfer")) {
    return {
      amount: Math.abs(amount),
      transactionType: "transfer" as TransactionType,
    };
  }

  return {
    amount: Math.abs(amount),
    transactionType: "expense" as TransactionType,
  };
}

function inferMapping(columns: string[]): ImportMapping {
  return {
    dateColumn: findColumn(columns, [
      "date",
      "posted",
      "posting date",
      "transaction date",
      "trans date",
    ]),
    nameColumn: findColumn(columns, [
      "name",
      "description",
      "transaction",
      "details",
      "memo",
      "payee",
    ]),
    merchantColumn: findColumn(columns, ["merchant", "vendor", "payee"]),
    amountColumn: findColumn(columns, ["amount", "transaction amount", "value"]),
    debitColumn: findColumn(columns, [
      "debit",
      "withdrawal",
      "spent",
      "outflow",
    ]),
    creditColumn: findColumn(columns, [
      "credit",
      "deposit",
      "received",
      "inflow",
    ]),
    categoryColumn: findColumn(columns, ["category", "type category"]),
    typeColumn: findColumn(columns, ["type", "transaction type"]),
    notesColumn: findColumn(columns, ["notes", "note", "memo"]),
  };
}

function findColumn(columns: string[], candidates: string[]) {
  const normalizedColumns = columns.map((column) => ({
    original: column,
    normalized: normalizeColumnName(column),
  }));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeColumnName(candidate);

    const exact = normalizedColumns.find(
      (column) => column.normalized === normalizedCandidate
    );

    if (exact) return exact.original;

    const partial = normalizedColumns.find((column) =>
      column.normalized.includes(normalizedCandidate)
    );

    if (partial) return partial.original;
  }

  return "";
}

function getColumnsFromRows(rows: RawImportRow[]) {
  const columns = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columns.add(key));
  });

  return Array.from(columns);
}

function getMappedValue(row: RawImportRow, column: string) {
  if (!column) return "";
  return String(row[column] || "").trim();
}

function cleanRawRow(row: RawImportRow) {
  const cleaned: RawImportRow = {};

  Object.entries(row).forEach(([key, value]) => {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return;

    cleaned[cleanKey] = String(value || "").trim();
  });

  return cleaned;
}

function stringifyExcelCell(value: any) {
  if (value == null) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "object") {
    if ("text" in value) return String(value.text || "");
    if ("result" in value) return String(value.result || "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item: any) => item.text || "").join("");
    }
  }

  return String(value);
}

function getFileType(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv") || mimeType.includes("csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";

  return "unsupported";
}

function getSourceNameFromFile(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function normalizeColumnName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeForMatch(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseMoney(value: string) {
  const cleaned = String(value || "")
    .replace(/\((.*)\)/, "-$1")
    .replace(/[$,\s]/g, "")
    .trim();

  const parsed = Number(cleaned);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeDate(value: string) {
  const cleaned = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  const parsed = new Date(cleaned);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}
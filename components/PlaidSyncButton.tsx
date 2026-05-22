"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";

export default function PlaidSyncButton({
  onComplete,
  label = "Sync Transactions",
}: {
  onComplete?: () => void;
  label?: string;
}) {
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function getAuthToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || "";
  }

  async function syncTransactions() {
    setSyncing(true);

    const authToken = await getAuthToken();

    if (!authToken) {
      setSyncing(false);
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before syncing transactions.",
      });
      return;
    }

    const response = await fetch("/api/plaid/sync-transactions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    setSyncing(false);

    if (!response.ok) {
      showToast({
        type: "error",
        title: "Plaid sync failed",
        message: data.error || "Could not sync transactions.",
      });
      return;
    }

    showToast({
      type: "success",
      title: "Plaid sync complete",
      message: `Added ${data.added || 0}, modified ${
        data.modified || 0
      }, removed ${data.removed || 0}.`,
    });

    onComplete?.();
  }

  return (
    <button
      type="button"
      onClick={syncTransactions}
      disabled={syncing}
      className="rounded-xl border border-emerald-800 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950 disabled:opacity-60"
    >
      {syncing ? "Syncing..." : label}
    </button>
  );
}
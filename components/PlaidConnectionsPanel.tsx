"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import PlaidSyncButton from "@/components/PlaidSyncButton";

type PlaidConnection = {
  id: string;
  plaid_item_id: string;
  institution_id: string | null;
  institution_name: string;
  products: string[];
  account_count: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function PlaidConnectionsPanel({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState("");

  async function getAuthToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || "";
  }

  async function loadConnections() {
    setLoading(true);

    const authToken = await getAuthToken();

    if (!authToken) {
      setLoading(false);
      return;
    }

    const response = await fetch("/api/plaid/connections", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      showToast({
        type: "error",
        title: "Failed to load connections",
        message: data.error || "Could not load Plaid connections.",
      });
      return;
    }

    setConnections(data.connections || []);
  }

  async function disconnectConnection(connection: PlaidConnection) {
    const confirmed = await confirm({
      title: `Disconnect ${connection.institution_name}?`,
      message:
        "This disconnects the bank and archives linked WealthOS accounts. Synced transactions will remain unless deleted separately.",
      confirmLabel: "Disconnect",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    setDisconnectingId(connection.id);

    const authToken = await getAuthToken();

    const response = await fetch("/api/plaid/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        plaid_item_uuid: connection.id,
      }),
    });

    const data = await response.json();

    setDisconnectingId("");

    if (!response.ok) {
      showToast({
        type: "error",
        title: "Disconnect failed",
        message: data.error || "Could not disconnect institution.",
      });
      return;
    }

    showToast({
      type: "success",
      title: "Bank disconnected",
      message: `${connection.institution_name} was disconnected.`,
    });

    await loadConnections();
    onChanged?.();
  }

  useEffect(() => {
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">
            Connected Banks
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Sync balances and transactions from linked institutions.
          </p>
        </div>

        {connections.length > 0 && (
          <PlaidSyncButton
            label="Sync"
            onComplete={() => {
              loadConnections();
              onChanged?.();
            }}
          />
        )}
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
          Loading connected banks...
        </div>
      ) : connections.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500">
          No banks connected yet.
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {connection.institution_name}
                  </p>

                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                    Connected
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {connection.account_count} linked account
                  {connection.account_count === 1 ? "" : "s"} ·{" "}
                  {connection.last_synced_at
                    ? `Synced ${formatRelativeTime(connection.last_synced_at)}`
                    : "Not synced yet"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => disconnectConnection(connection)}
                disabled={disconnectingId === connection.id}
                className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-red-900 hover:bg-red-950 hover:text-red-300 disabled:opacity-60"
              >
                {disconnectingId === connection.id
                  ? "Disconnecting..."
                  : "Disconnect"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatRelativeTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "recently";

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}
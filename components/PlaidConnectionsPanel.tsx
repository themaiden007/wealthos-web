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
        "This will disconnect the institution from Plaid and archive linked WealthOS accounts. Existing synced transactions will remain unless deleted separately.",
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
      title: "Institution disconnected",
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-200">
            Connected Institutions
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Manage linked banks and refresh balances/transactions.
          </p>
        </div>

        <PlaidSyncButton
          label="Sync Bank Data"
          onComplete={() => {
            loadConnections();
            onChanged?.();
          }}
        />
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
          Loading Plaid connections...
        </div>
      ) : connections.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
          No connected institutions yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {connection.institution_name}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      {connection.account_count} linked account
                      {connection.account_count === 1 ? "" : "s"}
                    </span>
                    <span>
                      Last synced:{" "}
                      {connection.last_synced_at
                        ? formatDateTime(connection.last_synced_at)
                        : "Not synced yet"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => disconnectConnection(connection)}
                  disabled={disconnectingId === connection.id}
                  className="shrink-0 rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 disabled:opacity-60"
                >
                  {disconnectingId === connection.id
                    ? "Disconnecting..."
                    : "Disconnect"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import PlaidSyncButton from "@/components/PlaidSyncButton";
import Panel from "@/components/ui/Panel";
import ActionButton from "@/components/ui/ActionButton";
import StatusPill from "@/components/ui/StatusPill";

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

  const summary = useMemo(() => {
    const accountCount = connections.reduce(
      (sum, connection) => sum + Number(connection.account_count || 0),
      0
    );

    const syncedCount = connections.filter(
      (connection) => !!connection.last_synced_at
    ).length;

    const mostRecentSync = connections
      .map((connection) => connection.last_synced_at)
      .filter(Boolean)
      .sort((a, b) => {
        return new Date(b || "").getTime() - new Date(a || "").getTime();
      })[0];

    return {
      institutions: connections.length,
      accountCount,
      syncedCount,
      mostRecentSync: mostRecentSync || null,
    };
  }, [connections]);

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

    const data = await response.json().catch(() => ({}));

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

    const data = await response.json().catch(() => ({}));

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
    <Panel className="mb-6">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-100">
              Connected Banks
            </h3>

            {!loading && connections.length > 0 && (
              <StatusPill tone="good">
                {connections.length} connected
              </StatusPill>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Sync balances and transactions from linked institutions.
          </p>
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <ActionButton onClick={loadConnections} disabled={loading}>
            {loading ? "Refreshing..." : "Reload"}
          </ActionButton>

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
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ConnectionMetric
          label="Institutions"
          value={String(summary.institutions)}
        />
        <ConnectionMetric
          label="Linked Accounts"
          value={String(summary.accountCount)}
        />
        <ConnectionMetric
          label="Synced Banks"
          value={`${summary.syncedCount}/${summary.institutions}`}
        />
        <ConnectionMetric
          label="Last Sync"
          value={
            summary.mostRecentSync
              ? formatRelativeTime(summary.mostRecentSync)
              : "Not synced"
          }
        />
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3">
          <LoadingConnectionCard />
          <LoadingConnectionCard />
        </div>
      ) : connections.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-6 text-center">
          <p className="text-sm font-medium text-slate-200">
            No banks connected yet
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Connect a bank to automatically sync accounts, balances, and
            transactions into WealthOS.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid min-w-0 gap-3">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              disconnectingId={disconnectingId}
              disconnectConnection={disconnectConnection}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ConnectionCard({
  connection,
  disconnectingId,
  disconnectConnection,
}: {
  connection: PlaidConnection;
  disconnectingId: string;
  disconnectConnection: (connection: PlaidConnection) => void;
}) {
  const isDisconnecting = disconnectingId === connection.id;
  const products = Array.isArray(connection.products)
    ? connection.products.filter(Boolean)
    : [];

  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200">
              {getInstitutionInitials(connection.institution_name)}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                {connection.institution_name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {connection.account_count} linked account
                {connection.account_count === 1 ? "" : "s"}
              </p>
            </div>

            <StatusPill tone="good">Connected</StatusPill>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            {products.length > 0 ? (
              products.slice(0, 4).map((product) => (
                <StatusPill key={product} tone="neutral">
                  {formatProductLabel(product)}
                </StatusPill>
              ))
            ) : (
              <StatusPill tone="neutral">Transactions</StatusPill>
            )}

            {products.length > 4 && (
              <StatusPill tone="neutral">+{products.length - 4}</StatusPill>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
          <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 sm:min-w-[160px]">
            <p className="text-xs text-slate-500">Last synced</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-200">
              {connection.last_synced_at
                ? formatRelativeTime(connection.last_synced_at)
                : "Not synced yet"}
            </p>
          </div>

          <ActionButton
            variant="danger"
            onClick={() => disconnectConnection(connection)}
            disabled={isDisconnecting}
            className="w-full sm:w-auto"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ConnectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function LoadingConnectionCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-slate-800" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-40 rounded bg-slate-800" />
          <div className="mt-2 h-3 w-28 rounded bg-slate-800" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="h-8 rounded-xl bg-slate-800" />
        <div className="h-8 rounded-xl bg-slate-800" />
        <div className="h-8 rounded-xl bg-slate-800" />
      </div>
    </div>
  );
}

function getInstitutionInitials(value: string) {
  const words = String(value || "Bank")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "B";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatProductLabel(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
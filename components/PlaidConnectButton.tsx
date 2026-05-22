"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";

export default function PlaidConnectButton({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const { showToast } = useToast();

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function getAuthToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || "";
  }

  async function createLinkToken() {
    setLoading(true);

    const authToken = await getAuthToken();

    if (!authToken) {
      setLoading(false);
      showToast({
        type: "error",
        title: "You must be logged in",
        message: "Please log in before connecting a bank.",
      });
      return;
    }

    const response = await fetch("/api/plaid/create-link-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      showToast({
        type: "error",
        title: "Plaid setup failed",
        message: data.error || "Could not create Plaid link token.",
      });
      return;
    }

    setLinkToken(data.link_token);
  }

  useEffect(() => {
    createLinkToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setSyncing(true);

      const authToken = await getAuthToken();

      const exchangeResponse = await fetch(
        "/api/plaid/exchange-public-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            public_token: publicToken,
            metadata,
          }),
        }
      );

      const exchangeData = await exchangeResponse.json();

      if (!exchangeResponse.ok) {
        setSyncing(false);
        showToast({
          type: "error",
          title: "Bank connection failed",
          message: exchangeData.error || "Could not exchange Plaid token.",
        });
        return;
      }

      const syncResponse = await fetch("/api/plaid/sync-transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const syncData = await syncResponse.json();

      setSyncing(false);

      if (!syncResponse.ok) {
        showToast({
          type: "warning",
          title: "Bank connected, sync failed",
          message: syncData.error || "Try syncing again.",
        });
        onComplete?.();
        return;
      }

      showToast({
        type: "success",
        title: "Bank connected",
        message: `Created ${exchangeData.accounts_created || 0} account(s) and synced ${
          syncData.added || 0
        } new transaction(s).`,
      });

      onComplete?.();
    },
    [onComplete, showToast]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={!ready || loading || syncing}
      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
    >
      {loading
        ? "Preparing Plaid..."
        : syncing
        ? "Syncing..."
        : "Connect Bank"}
    </button>
  );
}
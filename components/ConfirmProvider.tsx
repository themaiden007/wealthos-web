"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ConfirmVariant = "danger" | "warning" | "info";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<ConfirmContextValue | undefined>(
  undefined
);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({
        ...options,
        resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback(
    (value: boolean) => {
      if (pendingConfirm) {
        pendingConfirm.resolve(value);
      }

      setPendingConfirm(null);
    },
    [pendingConfirm]
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      {pendingConfirm && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${getIconClass(
                  pendingConfirm.variant || "info"
                )}`}
              >
                {getIcon(pendingConfirm.variant || "info")}
              </div>

              <div className="min-w-0">
                <h2 className="break-words text-lg font-semibold">
                  {pendingConfirm.title}
                </h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-400">
                  {pendingConfirm.message}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                {pendingConfirm.cancelLabel || "Cancel"}
              </button>

              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${getButtonClass(
                  pendingConfirm.variant || "info"
                )}`}
              >
                {pendingConfirm.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }

  return context;
}

function getIconClass(variant: ConfirmVariant) {
  if (variant === "danger") return "bg-red-500/10 text-red-300";
  if (variant === "warning") return "bg-amber-500/10 text-amber-300";
  return "bg-blue-500/10 text-blue-300";
}

function getButtonClass(variant: ConfirmVariant) {
  if (variant === "danger") return "bg-red-600 hover:bg-red-500";
  if (variant === "warning") return "bg-amber-600 hover:bg-amber-500";
  return "bg-blue-600 hover:bg-blue-500";
}

function getIcon(variant: ConfirmVariant) {
  if (variant === "danger") return "!";
  if (variant === "warning") return "!";
  return "?";
}

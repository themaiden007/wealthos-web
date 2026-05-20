"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now());

      const nextToast: Toast = {
        id,
        ...toast,
      };

      setToasts((current) => [nextToast, ...current].slice(0, 4));

      window.setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl border p-4 shadow-2xl backdrop-blur ${getToastClass(
              toast.type
            )}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && (
                  <p className="mt-1 break-words text-sm opacity-85">
                    {toast.message}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs opacity-70 hover:bg-black/20 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    return {
      showToast: (toast: Omit<Toast, "id">) => {
        console.warn("ToastProvider missing:", toast);
      },
    };
  }

  return context;
}

function getToastClass(type: ToastType) {
  if (type === "success") {
    return "border-emerald-900 bg-emerald-950/95 text-emerald-100";
  }

  if (type === "error") {
    return "border-red-900 bg-red-950/95 text-red-100";
  }

  if (type === "warning") {
    return "border-amber-900 bg-amber-950/95 text-amber-100";
  }

  return "border-blue-900 bg-blue-950/95 text-blue-100";
}
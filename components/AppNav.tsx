"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Accounts", href: "/accounts" },
  { label: "Transactions", href: "/transactions" },
  { label: "Budgets", href: "/budgets" },
  { label: "Goals", href: "/goals" },
  { label: "Insights", href: "/insights" },
];

export default function AppNav({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-950 md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-blue-400">
              WealthOS
            </p>
            <h1 className="mt-1 text-lg font-semibold text-white">
              Finance MVP
            </h1>
            {userEmail && (
              <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
                {userEmail}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 md:hidden"
          >
            Logout
          </button>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 md:block md:space-y-2 md:overflow-visible md:px-5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "block whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "block whitespace-nowrap rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden px-5 pb-6 md:block">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
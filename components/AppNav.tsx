"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "⌘" },
  { label: "Accounts", href: "/accounts", icon: "◼" },
  { label: "Transactions", href: "/transactions", icon: "↔" },
  { label: "Budgets", href: "/budgets", icon: "◌" },
  { label: "Goals", href: "/goals", icon: "◎" },
  { label: "Insights", href: "/insights", icon: "✦" },
];

const SIDEBAR_STORAGE_KEY = "wealthos_sidebar_collapsed_v1";

export default function AppNav({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setIsCollapsed(saved === "true");
  }, []);

  const displayName = useMemo(() => {
    if (!userEmail) return "User";

    const namePart = userEmail.split("@")[0] || "User";

    return namePart
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [userEmail]);

  const firstName = useMemo(() => {
    return displayName.split(" ")[0] || "User";
  }, [displayName]);

  const firstInitial = useMemo(() => {
    return firstName.charAt(0).toUpperCase() || "U";
  }, [firstName]);

  function toggleSidebar() {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside
      className={
        isCollapsed
          ? "w-full shrink-0 border-b border-slate-800 bg-slate-950/95 text-white backdrop-blur transition-all duration-200 md:sticky md:top-0 md:h-screen md:w-24 md:border-b-0 md:border-r"
          : "w-full shrink-0 border-b border-slate-800 bg-slate-950/95 text-white backdrop-blur transition-all duration-200 md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r"
      }
    >
      <div className="flex h-full flex-col">
        <div
          className={
            isCollapsed
              ? "flex items-center justify-between px-4 py-4 md:block md:px-3 md:py-6"
              : "flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6"
          }
        >
          <div
            className={
              isCollapsed
                ? "flex items-center gap-3 md:flex-col md:gap-4"
                : "flex items-center gap-3 md:block"
            }
          >
            <Link
              href="/"
              className={
                isCollapsed
                  ? "group flex items-center justify-center md:w-full"
                  : "group block"
              }
              title="WealthOS"
            >
              <div
                className={
                  isCollapsed
                    ? "flex items-center justify-center gap-3 md:flex-col"
                    : "flex items-center gap-3"
                }
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-900 bg-blue-950 text-lg font-semibold text-blue-300 shadow-sm">
                  W
                </div>

                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight text-white">
                      WealthOS
                    </p>
                    <p className="text-xs text-slate-500">
                      Personal finance OS
                    </p>
                  </div>
                )}
              </div>
            </Link>

            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={
                isCollapsed
                  ? "hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white md:flex"
                  : "hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white md:mt-5 md:flex"
              }
            >
              <SidebarToggleIcon collapsed={isCollapsed} />
            </button>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 md:hidden"
          >
            Logout
          </button>
        </div>

        {!isCollapsed && (
          <div className="hidden px-5 md:block">
            {userEmail && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="mt-1 truncate text-sm text-slate-300">
                  {displayName}
                </p>
                <p className="mt-1 truncate text-xs text-slate-600">
                  {userEmail}
                </p>
              </div>
            )}
          </div>
        )}

        <nav
          className={
            isCollapsed
              ? "flex gap-2 overflow-x-auto px-4 pb-4 md:mt-6 md:block md:space-y-2 md:overflow-visible md:px-3"
              : "flex gap-2 overflow-x-auto px-4 pb-4 md:mt-6 md:block md:space-y-1 md:overflow-visible md:px-5"
          }
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={
                  isCollapsed
                    ? isActive
                      ? "flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm md:w-full md:px-0"
                      : "flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-900 hover:text-white md:w-full md:px-0"
                    : isActive
                    ? "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm md:w-full"
                    : "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-900 hover:text-white md:w-full"
                }
              >
                <span
                  className={
                    isActive
                      ? "flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 text-xs"
                      : "flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs text-slate-500"
                  }
                >
                  {item.icon}
                </span>

                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div
          className={
            isCollapsed
              ? "mt-auto hidden px-3 pb-6 md:block"
              : "mt-auto hidden px-5 pb-6 md:block"
          }
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div
                title={firstName}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-sm font-semibold text-blue-300"
              >
                {firstInitial}
              </div>

              <button
                type="button"
                onClick={logout}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-900 text-sm text-red-300 hover:bg-red-950"
                title="Logout"
                aria-label="Logout"
              >
                ⎋
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  {firstInitial}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {firstName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    Private beta
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Manual tracking is active. Bank sync and AI insights come next.
              </p>

              <button
                type="button"
                onClick={logout}
                className="mt-4 w-full rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
      {collapsed ? <path d="M14 9l3 3-3 3" /> : <path d="M17 9l-3 3 3 3" />}
    </svg>
  );
}
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  const { showToast } = useToast();

  const [mode, setMode] = useState<"login" | "signup">(() => {
    if (typeof window === "undefined") return "login";

    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" ? "signup" : "login";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/login?mode=${nextMode}`);
    }
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      showToast({
        type: "warning",
        title: "Email required",
        message: "Please enter your email address.",
      });
      return;
    }

    if (!password.trim()) {
      showToast({
        type: "warning",
        title: "Password required",
        message: "Please enter your password.",
      });
      return;
    }

    if (password.length < 6) {
      showToast({
        type: "warning",
        title: "Password too short",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      setLoading(false);

      if (error) {
        showToast({
          type: "error",
          title: "Login failed",
          message: error.message,
        });
        return;
      }

      showToast({
        type: "success",
        title: "Welcome back",
        message: "You are now signed in.",
      });

      window.location.href = "/";
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined,
      },
    });

    setLoading(false);

    if (error) {
      showToast({
        type: "error",
        title: "Signup failed",
        message: error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: "Check your email",
      message: "Confirm your account using the link Supabase sent you.",
    });
  }

  async function sendMagicLink() {
    if (!email.trim()) {
      showToast({
        type: "warning",
        title: "Email required",
        message: "Enter your email first, then request a magic link.",
      });
      return;
    }

    setMagicLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined,
      },
    });

    setMagicLoading(false);

    if (error) {
      showToast({
        type: "error",
        title: "Magic link failed",
        message: error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: "Magic link sent",
      message: "Check your inbox for the login link.",
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden border-r border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-emerald-600/10 blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-900 bg-blue-950 text-xl font-semibold text-blue-300">
                W
              </div>

              <div>
                <p className="text-lg font-semibold tracking-tight">WealthOS</p>
                <p className="text-sm text-slate-500">Personal finance OS</p>
              </div>
            </div>

            <div className="mt-24 max-w-2xl">
              <p className="text-sm text-blue-300">Private beta</p>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight">
                One dashboard for your money, goals, and financial decisions.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
                Track accounts, transactions, budgets, and goals in one clean
                workspace. Built for manual tracking today, with AI insights and
                bank sync coming next.
              </p>
            </div>

            <div className="mt-12 grid max-w-3xl gap-4 md:grid-cols-3">
              <FeatureCard
                title="Accounts"
                text="Track cash, cards, loans, investments, assets, and net worth."
              />
              <FeatureCard
                title="Budgets"
                text="Compare planned spending against actual transactions."
              />
              <FeatureCard
                title="Goals"
                text="Monitor savings, debt payoff, purchases, and progress."
              />
            </div>
          </div>

          <div className="relative z-10 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur">
            <p className="text-sm font-medium text-slate-200">
              What this beta is built to become
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MiniPoint text="AI-powered money insights" />
              <MiniPoint text="Plaid bank syncing" />
              <MiniPoint text="Portfolio + Indian account tracking" />
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-900 bg-blue-950 text-lg font-semibold text-blue-300">
                  W
                </div>

                <div>
                  <p className="text-lg font-semibold tracking-tight">
                    WealthOS
                  </p>
                  <p className="text-sm text-slate-500">
                    Personal finance OS
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
              <div>
                <p className="text-sm text-blue-300">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  {mode === "login" ? "Sign in to WealthOS" : "Start tracking"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {mode === "login"
                    ? "Access your personal finance dashboard."
                    : "Create your private beta account and begin with manual tracking."}
                </p>
              </div>

              <div className="relative z-20 mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={
                    mode === "login"
                      ? "flex min-h-12 touch-manipulation items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white"
                      : "flex min-h-12 touch-manipulation items-center justify-center rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-slate-900 hover:text-white"
                  }
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={
                    mode === "signup"
                      ? "flex min-h-12 touch-manipulation items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white"
                      : "flex min-h-12 touch-manipulation items-center justify-center rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-slate-900 hover:text-white"
                  }
                >
                  Sign up
                </button>
              </div>

              <form
                onSubmit={handleEmailAuth}
                noValidate
                className="mt-6 space-y-4"
              >
                <div>
                  <label className="text-sm text-slate-300">Email</label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-300">Password</label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="At least 6 characters"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-xs text-slate-600">or</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              <button
                type="button"
                onClick={sendMagicLink}
                disabled={magicLoading}
                className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
              >
                {magicLoading
                  ? "Sending magic link..."
                  : "Email me a magic link"}
              </button>

              <p className="mt-5 text-center text-xs leading-5 text-slate-600">
                By continuing, you agree to use this as a private beta finance
                tracking workspace. Do not enter sensitive production banking
                credentials manually.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <TrustPill text="Supabase auth" />
              <TrustPill text="Manual data first" />
              <TrustPill text="Private beta" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function MiniPoint({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
      {text}
    </div>
  );
}

function TrustPill({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-xs text-slate-500">
      {text}
    </div>
  );
}
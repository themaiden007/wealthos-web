type PanelProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "hero" | "subtle";
};

export default function Panel({
  children,
  className = "",
  variant = "default",
}: PanelProps) {
  const base =
    "min-w-0 border border-slate-800 bg-slate-900 text-white shadow-sm";

  const shape =
    variant === "hero"
      ? "overflow-hidden rounded-3xl p-5"
      : variant === "subtle"
      ? "rounded-2xl bg-slate-950 p-4"
      : "rounded-2xl p-4 sm:p-5";

  return <section className={`${base} ${shape} ${className}`}>{children}</section>;
}

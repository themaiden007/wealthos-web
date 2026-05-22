type StatusTone = "good" | "bad" | "warning" | "neutral" | "info";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
};

function toneClass(tone: StatusTone) {
  if (tone === "good") return "bg-emerald-500/10 text-emerald-300";
  if (tone === "bad") return "bg-red-500/10 text-red-300";
  if (tone === "warning") return "bg-amber-500/10 text-amber-300";
  if (tone === "info") return "bg-blue-500/10 text-blue-300";
  return "bg-slate-800 text-slate-400";
}

export default function StatusPill({
  children,
  tone = "neutral",
  className = "",
}: StatusPillProps) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-xs ${toneClass(
        tone
      )} ${className}`}
    >
      {children}
    </span>
  );
}

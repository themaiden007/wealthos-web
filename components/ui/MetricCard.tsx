type MetricTone = "default" | "good" | "bad" | "warning" | "muted";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  tone?: MetricTone;
};

function toneClass(tone: MetricTone) {
  if (tone === "good") return "text-emerald-300";
  if (tone === "bad") return "text-red-300";
  if (tone === "warning") return "text-amber-300";
  if (tone === "muted") return "text-slate-300";
  return "text-white";
}

export default function MetricCard({
  title,
  value,
  subtitle,
  tone = "default",
}: MetricCardProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-2 break-words text-2xl font-semibold ${toneClass(tone)}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

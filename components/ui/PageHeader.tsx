type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({
  eyebrow = "WealthOS",
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold text-white">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex max-w-full flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}

type ActionButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "warning"
  | "success";

type ActionButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: ActionButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

function variantClass(variant: ActionButtonVariant) {
  if (variant === "primary") {
    return "bg-blue-600 text-white hover:bg-blue-500";
  }

  if (variant === "success") {
    return "bg-emerald-600 text-white hover:bg-emerald-500";
  }

  if (variant === "danger") {
    return "border border-red-900 text-red-300 hover:bg-red-950";
  }

  if (variant === "warning") {
    return "border border-amber-900 text-amber-300 hover:bg-amber-950";
  }

  return "border border-slate-700 text-slate-300 hover:bg-slate-900";
}

export default function ActionButton({
  children,
  type = "button",
  variant = "secondary",
  disabled = false,
  onClick,
  className = "",
}: ActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60 ${variantClass(
        variant
      )} ${className}`}
    >
      {children}
    </button>
  );
}

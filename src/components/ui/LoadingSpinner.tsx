interface LoadingSpinnerProps {
  size?: "sm" | "md";
}

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const dimensions = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <span
      className={`${dimensions} inline-block animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600`}
      aria-label="Loading"
    />
  );
}

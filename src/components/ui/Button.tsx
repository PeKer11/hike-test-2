import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

// The look is defined once, in globals.css ("Round 13 control system"): primary is the terracotta pill with the
// hard dark lip (the Home "Plan my walk" button), secondary is the cream pill with the control edge.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "tk-btn tk-btn-primary",
  secondary: "tk-btn tk-btn-secondary",
  ghost: "tk-btn bg-transparent text-charcoal/70 hover:bg-charcoal/5 disabled:text-charcoal/30",
  danger: "tk-btn tk-btn-secondary !border-rose-600 !text-rose-700",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button className={`${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`} {...props}>
      {children}
    </button>
  );
}

import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", children, ...props }: PropsWithChildren<CardProps>) {
  return (
    <div
      className={`rounded-xl border border-charcoal/10 bg-white p-4 shadow-[0_4px_20px_rgba(30,61,47,0.08)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", children, ...props }: PropsWithChildren<CardProps>) {
  return (
    <div
      className={`rounded-tk-card border border-[#ece1d2] bg-tk-card p-4 shadow-tk-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

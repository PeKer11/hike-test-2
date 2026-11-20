import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", children, ...props }: PropsWithChildren<CardProps>) {
  return (
    <div
      className={`rounded-[14px] border border-tk-hair bg-cream p-4 font-app-sans shadow-tk-soft ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

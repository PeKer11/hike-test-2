/* eslint-disable @next/next/no-img-element */

interface EmptyStateProps {
  /** File name in public/images/traike/. */
  image: string;
  title: string;
  hint?: string;
}

/** Hand-drawn illustration with a short line under it, for empty / signed-out / error panels. */
export function EmptyState({ image, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 text-center">
      <img src={`/images/traike/${image}`} alt="" width={120} height={120} className="h-24 w-24 object-contain" />
      <p className="font-display text-[15px] text-tk-ink">{title}</p>
      {hint && <p className="text-xs text-tk-sage">{hint}</p>}
    </div>
  );
}

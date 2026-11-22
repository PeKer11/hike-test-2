import Image from "next/image";

/**
 * The Traike logo: the app icon (a mountain with a winding trail on terracotta), the same drawing as the
 * favicon. The one mark for every header, the login screen and the live-walk map; no other drawing of it.
 */
export function TraikeMark({ size = 30, className = "" }: { size?: number; className?: string }) {
  return <Image src="/traike-icon.png" alt="" aria-hidden width={size} height={size} className={`rounded-lg ${className}`.trim()} style={{ width: size, height: size }} />;
}

/** The mark and the "Traike" wordmark in the brand serif. Colour and shadow come from the surface it sits on. */
export function TraikeLockup({ className = "", textClassName = "", "data-testid": testId }: { className?: string; textClassName?: string; "data-testid"?: string }) {
  return (
    <span data-testid={testId} className={`flex w-fit items-center gap-2 ${className}`.trim()}>
      <TraikeMark />
      <span className={`font-app-serif text-[24px] font-bold leading-none ${textClassName}`.trim()}>Traike</span>
    </span>
  );
}

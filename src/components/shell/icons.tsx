/* Iconoir-style glyphs, 1.5px stroke, round caps. No icon package (repo rule). */
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
/* The five destination glyphs are the mockup's own (1.75 stroke, 22px). */
const nav = { ...base, strokeWidth: 1.75 } as const;

export const HomeIcon = ({ className = "h-[22px] w-[22px]" }: { className?: string }) => (
  <svg {...nav} className={className}>
    <path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9.5z" />
  </svg>
);

/** Plan: a trail ending in a "now" ring. The ring is filled with the bar colour so the selected tab shows it cut out. */
export const PlanIcon = ({ className = "h-[22px] w-[22px]" }: { className?: string }) => (
  <svg {...nav} className={`${className} rtl:-scale-x-100`}>
    <path d="M4 20c3-5.5 6-6.5 9.5-8 2.4-1 3.5-2.6 4.2-4.2" />
    <circle cx="18" cy="6" r="4.2" fill="var(--tk-nav-fill, var(--tk-cream))" />
    <circle cx="18" cy="6" r="1.9" fill="var(--tk-leather)" stroke="none" />
  </svg>
);

export const WalkIcon = ({ className = "h-[22px] w-[22px]" }: { className?: string }) => (
  <svg {...nav} className={`${className} rtl:-scale-x-100`}>
    <circle cx="12.5" cy="4.8" r="2.2" />
    <path d="M8.5 9.5c-1.8.4-2.5 2-2.2 4.2" />
    <path d="M12 8.2l-1.6 5.6L7.5 20M10.8 13.8l3.7 2.2 1.2 4M10.8 9.8l4.7 2.2M17.5 8.5L16 20.2" />
  </svg>
);

export const WalksIcon = ({ className = "h-[22px] w-[22px]" }: { className?: string }) => (
  <svg {...nav} className={`${className} rtl:-scale-x-100`}>
    <path d="M8.8 6.5h4.7a3.2 3.2 0 0 1 0 6.4h-3a3.2 3.2 0 0 0 0 6.4h4.7" />
    <circle cx="6" cy="6.5" r="2.8" fill="var(--tk-nav-fill, var(--tk-cream))" />
    <circle cx="18" cy="19.3" r="2.8" fill="var(--tk-nav-fill, var(--tk-cream))" />
  </svg>
);

export const PlusIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PeopleIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c.5-3.2 3-5 6-5s5.500 1.800 6 5" />
    <path d="M16 5.200a3.200 3.200 0 0 1 0 5.600M18 14.300c1.800.7 2.800 2.300 3 4.700" />
  </svg>
);

export const PersonIcon = ({ className = "h-[22px] w-[22px]" }: { className?: string }) => (
  <svg {...nav} className={className}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20c1.6-3.8 4.4-5.6 7.5-5.6s5.9 1.8 7.5 5.6" />
  </svg>
);

/** Points to the start side: it mirrors in RTL. */
export const BackIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={`${className} rtl:-scale-x-100`}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const RefreshIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M20 12a8 8 0 1 1-2.600-5.900" />
    <path d="M20 4v5h-5" />
  </svg>
);

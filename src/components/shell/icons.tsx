/* Iconoir-style glyphs, 1.5px stroke, round caps. No icon package (repo rule). */
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const HomeIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);

export const WalksIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16" />
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

export const PersonIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="3.600" />
    <path d="M4.500 20c.6-3.800 3.700-6 7.500-6s6.900 2.200 7.500 6" />
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

/** Shared look of the Walks / Places / Friends panels: flat rows on the cream sheet, hairlines between them. */
export const PANEL = "relative -mx-4 px-4 py-3 font-app-sans text-tk-body";
export const PANEL_TITLE = "font-app-serif text-[22px] font-semibold leading-tight text-tk-ink";
export const PANEL_SUB = "text-[14px] text-tk-sage";
export const ROW = "border-b border-tk-hair py-3 text-[15px] last:border-b-0";
export const BTN_PRIMARY = "inline-flex min-h-11 cursor-pointer items-center rounded-full bg-terra px-4 text-[14px] font-semibold text-on-accent shadow-[0_2px_0_var(--tk-lip)] hover:bg-terra/90 active:translate-y-px";
export const BTN_SOFT = "inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-forest bg-cream px-4 text-[14px] font-semibold text-forest hover:bg-tk-bar";
export const LINK = "inline-flex min-h-11 cursor-pointer items-center text-[14px] font-medium text-tk-check hover:underline";
export const FIELD = "min-w-0 flex-1 rounded-[10px] border-[1.5px] border-forest bg-cream px-3 py-2 text-[16px] text-tk-ink placeholder:text-charcoal/50";

/** Round 13 sheet controls. A section bar is a full-width tinted band with a hairline above and below. */
export const SEC_BAR = "flex min-h-11 items-center justify-between gap-2 border-y border-tk-hair bg-tk-bar px-4 py-2 font-app-sans text-[15px] font-semibold text-tk-ink";
/** Inputs and text areas on the sheet: forest edge, cream fill, 16px so phones do not zoom. */
export const CTRL_BOX = "w-full rounded-[10px] border-[1.5px] border-forest bg-cream px-3 py-2 text-[16px] leading-[1.4] text-tk-ink placeholder:text-charcoal/50 focus:outline-2 focus:outline-offset-1 focus:outline-forest";
/** A connected row of cells (one exclusive choice): forest edge, hairline dividers, the chosen cell filled forest. */
export const SEG_WRAP = "flex overflow-hidden rounded-[10px] border-[1.5px] border-forest bg-cream";
export const segCell = (on: boolean) =>
  `min-h-11 flex-1 border-e border-tk-hair px-3 text-[15px] font-semibold transition-colors last:border-e-0 motion-reduce:transition-none ${on ? "bg-forest text-cream" : "text-forest hover:bg-tk-bar"}`;
/** A separate toggle chip (several can be on): terracotta edge and tint when chosen. */
export const chipCell = (on: boolean) =>
  `rounded-[10px] border-[1.5px] px-3 py-2 text-[14px] font-semibold transition-colors motion-reduce:transition-none ${on ? "border-terra bg-terra/15 text-tk-check" : "border-forest bg-cream text-forest hover:bg-tk-bar"}`;

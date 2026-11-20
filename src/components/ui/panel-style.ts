/**
 * The control vocabulary of every app screen. These strings are only names: the look of each control is defined
 * ONCE in src/app/globals.css (the `.tk-*` classes under "Round 13 control system"). A screen that needs a button,
 * a segmented control, a chip, a section bar or a row takes it from here, and never styles its own.
 */

/** Terracotta pill with the hard dark lip: the Home "Plan my walk" button. */
export const BTN = "tk-btn tk-btn-primary";
/** The same button at 44px, for an action that sits inside a row. */
export const BTN_SM = "tk-btn tk-btn-primary tk-btn-sm";
/** Secondary: cream pill with the control edge. */
export const BTN_ALT = "tk-btn tk-btn-secondary";
export const BTN_ALT_SM = "tk-btn tk-btn-secondary tk-btn-sm";
/** Older names, kept so a panel's imports still read the same: primary and secondary at the row size. */
export const BTN_PRIMARY = BTN_SM;
export const BTN_SOFT = BTN_ALT_SM;

/** A quiet text link inside a row. */
export const LINK = "inline-flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-tk-check hover:underline";

/** The Walks / Places / Friends panels: flat rows on the cream sheet, hairlines between them. */
export const PANEL = "relative -mx-4 px-4 py-3 font-app-sans text-tk-body";
export const PANEL_TITLE = "font-app-serif text-[22px] font-semibold leading-tight text-tk-ink";
export const PANEL_SUB = "text-[14px] text-tk-sage";
export const ROW = "tk-row font-app-sans";

/** A section bar: a full-width tinted band with a hairline above and below. */
export const SEC_BAR = "tk-bar font-app-sans";

/** Inputs and text areas on the sheet: control edge, cream fill, 16px so phones do not zoom. */
export const CTRL_BOX = "w-full rounded-[10px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 py-2 text-[16px] leading-[1.4] text-tk-ink placeholder:text-charcoal/50 focus:outline-2 focus:outline-offset-1 focus:outline-[var(--tk-ctl)]";
export const FIELD = "min-w-0 flex-1 rounded-[10px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 py-2 text-[16px] text-tk-ink placeholder:text-charcoal/50";

/** A connected row of cells (one exclusive choice): control edge, hairline dividers, the chosen cell filled pine. */
export const SEG_WRAP = "tk-seg";
export const segCell = (on: boolean) => `tk-seg-cell${on ? " is-on" : ""}`;
/** A separate toggle chip (several can be on): the chosen chip is filled pine, like a chosen segment. */
export const chipCell = (on: boolean) => `tk-chip${on ? " is-on" : ""}`;

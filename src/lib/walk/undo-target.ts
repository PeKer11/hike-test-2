/**
 * What a notice's Undo goes back to: the plan just before that chat edit when there is one (a second edit in the
 * same walk can still be undone), else the first plan of the re-plan chain.
 */
export function undoTargetFor<T>(previousPlan: T | null, chatEditSnapshot: T | null | undefined): T | null {
  return chatEditSnapshot ?? previousPlan;
}

// Module-level store for a college chosen on the college-select screen.
//
// Returning the selection via route params requires pushing a NEW copy of the
// calling screen, which throws away everything the student had already typed in
// the signup form. `router.back()` returns to the already-mounted screen, and
// the selection is handed over through this store instead (same pattern as
// utils/marketTabStore.ts).
let pendingSelection: {
  collegeId: string;
  collegeName: string;
  collegeShortName: string;
  domains: string[];
  /** Optional prefill, when the student typed an email into the search box. */
  email?: string;
} | null = null;

export const setCollegeSelection = (selection: {
  collegeId: string;
  collegeName: string;
  collegeShortName: string;
  domains: string[];
  email?: string;
}) => {
  pendingSelection = selection;
};

/** Read and clear the pending selection. Returns null if there is none. */
export const consumeCollegeSelection = (): {
  collegeId: string;
  collegeName: string;
  collegeShortName: string;
  domains: string[];
  email?: string;
} | null => {
  const selection = pendingSelection;
  pendingSelection = null;
  return selection;
};

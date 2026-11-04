// A–Z ordering for dropdown lists: ignores upper/lower case and orders numbers naturally ("2" before "10").
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export const compareLabels = (a, b) => collator.compare(String(a ?? '').trim(), String(b ?? '').trim());

/** Returns a sorted copy of `list`, ordered by the text shown in the dropdown. */
export const sortOptions = (list, getLabel = (item) => item) =>
  (Array.isArray(list) ? [...list] : []).sort((a, b) => compareLabels(getLabel(a), getLabel(b)));

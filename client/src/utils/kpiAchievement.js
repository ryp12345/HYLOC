// Shared KPI achievement rule, so every page scores KPIs the same way.

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Achievement % of actual against target: actual / target × 100.
 * The result is not capped; callers cap it where their display needs that.
 * @returns {number|null} null when it cannot be calculated (missing values or a target that is not positive)
 */
export const calculateAchievement = (actual, target) => {
  const a = toNumber(actual);
  const t = toNumber(target);
  if (a === null || t === null || t <= 0) return null;
  return (a / t) * 100;
};

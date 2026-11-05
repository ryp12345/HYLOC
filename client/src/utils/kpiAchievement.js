// Shared KPI achievement rule, so every page scores KPIs the same way.

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Time, day and PPM KPIs (MTTR, setting time, inventory days, rejection PPM...) are better when lower
const LOWER_IS_BETTER_UNITS = new Set(['mins.', 'hrs.', 'days', 'ppm']);
// ...except these, which are measured in those units but are better when higher
const HIGHER_IS_BETTER_NAME = /saving|mtbf|between failures|kaizen/;

/**
 * Whether a lower actual than target is the good result for this KPI.
 * @param {string} name - KPI value name (kpi_values.data)
 * @param {string} unitSymbol - unit symbol from unit_master (e.g. "Mins.", "%")
 */
export const isLowerBetterKpi = (name, unitSymbol) => {
  const text = String(name || '').trim().toLowerCase();
  const unit = String(unitSymbol || '').trim().toLowerCase();
  if (HIGHER_IS_BETTER_NAME.test(text)) return false;
  if (LOWER_IS_BETTER_UNITS.has(unit)) return true;
  if (text.includes('cost of poor quality') || text.includes('absenteeism')) return true;
  return text.includes('consumption') && !text.includes('reduction');
};

/**
 * Achievement % of actual against target.
 * Higher is better: actual / target × 100. Lower is better: target / actual × 100 (an actual of 0 is 100%).
 * The result is not capped; callers cap it where their display needs that.
 * @returns {number|null} null when it cannot be calculated (missing values or a target that is not positive)
 */
export const calculateAchievement = (actual, target, { lowerIsBetter = false } = {}) => {
  const a = toNumber(actual);
  const t = toNumber(target);
  if (a === null || t === null || t <= 0) return null;
  if (lowerIsBetter) return a <= 0 ? 100 : (t / a) * 100;
  return (a / t) * 100;
};

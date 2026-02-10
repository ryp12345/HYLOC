/**
 * Formula Evaluator for KPI Calculations
 * Supports: arithmetic (+,-,*,/), AVERAGE, SUM, MIN, MAX, IF conditions
 * Note: CUMSUM(v<ID>) is preprocessed in KPICalculationService and replaced with a numeric value.
 */

class FormulaEvaluator {
  constructor(kpiValuesMap) {
    // kpiValuesMap: { kpiId: value }
    this.values = kpiValuesMap || {};
  }

  /**
   * Evaluate a formula string
   * @param {string} formula - e.g., "v1*v2+v3" or "AVERAGE(v1,v2,v3)"
   * @returns {number} computed result
   */
  evaluate(formula) {
    if (!formula || typeof formula !== 'string') {
      throw new Error('Invalid formula');
    }

    // Replace KPI references (v1, v2, etc.) with actual values
    let expr = this.replaceKpiReferences(formula);
    
    // Handle Excel-like functions
    expr = this.replaceFunctions(expr);
    
    // Safely evaluate the mathematical expression
    return this.safeEval(expr);
  }

  /**
   * Replace vXX references with actual numeric values
   * Supports: v123, v123:actual, v123:target
   */
  replaceKpiReferences(formula) {
    return formula.replace(/v(\d+)(?::(\w+))?/g, (match, kpiValueId, suffix) => {
      const key = suffix ? `${kpiValueId}:${suffix}` : parseInt(kpiValueId);
      const value = this.values[key];
      
      if (value === undefined || value === null || value === '') {
        console.warn(`KPI Value ${match} not found or empty in values map. Available keys:`, Object.keys(this.values));
        return '0'; // Default to 0 for missing values
      }
      // Handle non-numeric values
      const numValue = parseFloat(value);
      return isNaN(numValue) ? '0' : String(numValue);
    });
  }

  /**
   * Replace Excel-like functions with JavaScript equivalents
   */
  replaceFunctions(expr) {
    // ROUND(value, decimals) -> Math.round(value * 10^decimals) / 10^decimals
    expr = expr.replace(/ROUND\(([^,]+),\s*(\d+)\)/gi, (match, value, decimals) => {
      const multiplier = Math.pow(10, parseInt(decimals));
      return `(Math.round((${value}) * ${multiplier}) / ${multiplier})`;
    });

    // ROUND(value) with no decimals -> Math.round(value)
    expr = expr.replace(/ROUND\(([^)]+)\)/gi, (match, value) => {
      return `Math.round(${value})`;
    });

    // AVERAGE(a,b,c) -> (a+b+c)/3
    expr = expr.replace(/AVERAGE\(([^)]+)\)/gi, (match, args) => {
      const parts = args.split(',').map(s => s.trim());
      const sum = parts.join('+');
      return `((${sum})/${parts.length})`;
    });

    // SUM(a,b,c) -> (a+b+c)
    expr = expr.replace(/SUM\(([^)]+)\)/gi, (match, args) => {
      const parts = args.split(',').map(s => s.trim());
      return `(${parts.join('+')})`;
    });

    // CUMSUM(...) is handled upstream and replaced with a number; no-op here

    // MIN(a,b,c) -> Math.min(a,b,c)
    expr = expr.replace(/MIN\(([^)]+)\)/gi, (match, args) => {
      return `Math.min(${args})`;
    });

    // MAX(a,b,c) -> Math.max(a,b,c)
    expr = expr.replace(/MAX\(([^)]+)\)/gi, (match, args) => {
      return `Math.max(${args})`;
    });

    // ABS(a) -> Math.abs(a)
    expr = expr.replace(/ABS\(([^)]+)\)/gi, (match, arg) => {
      return `Math.abs(${arg})`;
    });

    // IF(condition, trueVal, falseVal) -> (condition ? trueVal : falseVal)
    expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (match, cond, trueVal, falseVal) => {
      return `((${cond}) ? (${trueVal}) : (${falseVal || 0}))`;
    });

    // Handle comparison operators
    expr = expr.replace(/≥/g, '>=');
    expr = expr.replace(/≤/g, '<=');
    // Be careful with = to == conversion - avoid replacing inside existing ==
    expr = expr.replace(/([^=!<>])=([^=])/g, '$1==$2');

    return expr;
  }

  /**
   * Safely evaluate a mathematical expression
   */
  safeEval(expr) {
    try {
      // Remove any non-mathematical characters for safety
      if (!/^[\d\s+\-*/.(),%?:><!=&|]+$/.test(expr.replace(/Math\.(min|max|abs|round)/g, ''))) {
        throw new Error('Formula contains invalid characters');
      }

      // Use Function constructor for safer evaluation than eval
      const result = new Function(`return ${expr}`)();
      
      // Handle division by zero, NaN, Infinity
      if (!isFinite(result)) {
        console.warn('Formula result is not finite, returning 0');
        return 0;
      }
      
      return Number(result);
    } catch (error) {
      console.error('Formula evaluation error:', error);
      console.error('Expression:', expr);
      throw new Error(`Failed to evaluate formula: ${error.message}`);
    }
  }

  /**
   * Extract KPI Value IDs referenced in a formula
   * @param {string} formula
   * @returns {number[]} array of KPI Value IDs
   */
  static extractSourceKpiIds(formula) {
    if (!formula) return [];
    
    // Match v123, v123:actual, v123:target patterns
    const matches = formula.match(/v(\d+)(?::(?:actual|target))?/gi) || [];
    const ids = matches.map(m => {
      const idMatch = /v(\d+)/i.exec(m);
      return idMatch ? parseInt(idMatch[1]) : null;
    }).filter(id => id !== null);
    
    // Return unique IDs
    return [...new Set(ids)];
  }

  /**
   * Validate a formula syntax
   * @param {string} formula
   * @returns {boolean}
   */
  static validateFormula(formula) {
    try {
      if (!formula) return false;

      // Check for balanced parentheses
      let count = 0;
      for (let char of formula) {
        if (char === '(') count++;
        if (char === ')') count--;
        if (count < 0) return false;
      }
      if (count !== 0) return false;

      // Check for valid function names and syntax (added support for :actual and :target)
      const validPattern = /^[v\d\s+\-*/.(),%:AVERAGESUMMINMAXIFROUNDABSCUMSUM≥≤=<>!&|actualtarget]+$/i;
      if (!validPattern.test(formula)) return false;

      // Check for valid variable references (v followed by digits, optionally :actual or :target)
      const varPattern = /v\d+(?::(?:actual|target))?/gi;
      const vars = formula.match(varPattern);
      if (!vars || vars.length === 0) return false;

      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = FormulaEvaluator;

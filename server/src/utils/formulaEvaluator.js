/**
 * Formula Evaluator for KPI Calculations
 * Supports: arithmetic (+,-,*,/,%), comparisons (>,<,>=,<=,=,!=), logical (&,|),
 * parentheses, unary minus, and the functions SUM, AVERAGE, MIN, MAX, ABS, ROUND, IF.
 * Note: CUMSUM(v<ID>) is preprocessed in KPICalculationService and replaced with a numeric value.
 *
 * Formulas are parsed into a syntax tree and evaluated directly (no eval / Function),
 * so nested functions such as ROUND(SUM(v1, v2) / v3, 2) work as written.
 */

const FUNCTION_ARITY = {
  SUM: [1, Infinity],
  AVERAGE: [1, Infinity],
  MIN: [1, Infinity],
  MAX: [1, Infinity],
  ABS: [1, 1],
  ROUND: [1, 2],
  IF: [2, 3],
  CUMSUM: [1, 1]
};

const COMPARISON_OPERATORS = new Set(['>', '<', '>=', '<=', '==', '!=']);

/**
 * Split a formula into tokens.
 * Token types: num, ref, ident, op, lparen, rparen, comma
 */
function tokenize(formula) {
  const tokens = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number: 12, 12.5, .5
    if (/[0-9.]/.test(ch)) {
      const match = /^(\d+\.?\d*|\.\d+)/.exec(formula.slice(i));
      if (!match) throw new Error(`Invalid number at position ${i + 1}`);
      tokens.push({ type: 'num', value: parseFloat(match[0]) });
      i += match[0].length;
      continue;
    }

    // KPI reference: v123, v123:actual, v123:target
    const refMatch = /^v(\d+)(?::(actual|target))?(?![A-Za-z0-9_])/i.exec(formula.slice(i));
    if (refMatch) {
      tokens.push({
        type: 'ref',
        id: parseInt(refMatch[1], 10),
        suffix: refMatch[2] ? refMatch[2].toLowerCase() : null
      });
      i += refMatch[0].length;
      continue;
    }

    // Function name
    const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(formula.slice(i));
    if (identMatch) {
      tokens.push({ type: 'ident', value: identMatch[0].toUpperCase() });
      i += identMatch[0].length;
      continue;
    }

    // Two-character operators first
    const two = formula.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '<>', '&&', '||'].includes(two)) {
      const normalized = two === '<>' ? '!=' : two === '&&' ? '&' : two === '||' ? '|' : two;
      tokens.push({ type: 'op', value: normalized });
      i += 2;
      continue;
    }

    if (ch === '≥') { tokens.push({ type: 'op', value: '>=' }); i++; continue; }
    if (ch === '≤') { tokens.push({ type: 'op', value: '<=' }); i++; continue; }
    if (ch === '=') { tokens.push({ type: 'op', value: '==' }); i++; continue; }
    if ('+-*/%<>&|'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }

    throw new Error(`Invalid character "${ch}" at position ${i + 1}`);
  }

  return tokens;
}

/**
 * Recursive-descent parser producing a syntax tree.
 * Precedence (low → high): | , & , comparison , + - , * / % , unary - +
 */
function parse(formula) {
  const tokens = tokenize(formula);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (value) => peek() && peek().type === 'op' && peek().value === value;

  const parseOr = () => {
    let node = parseAnd();
    while (isOp('|')) {
      next();
      node = { type: 'logical', op: '|', left: node, right: parseAnd() };
    }
    return node;
  };

  const parseAnd = () => {
    let node = parseComparison();
    while (isOp('&')) {
      next();
      node = { type: 'logical', op: '&', left: node, right: parseComparison() };
    }
    return node;
  };

  const parseComparison = () => {
    let node = parseAdditive();
    while (peek() && peek().type === 'op' && COMPARISON_OPERATORS.has(peek().value)) {
      const op = next().value;
      node = { type: 'binary', op, left: node, right: parseAdditive() };
    }
    return node;
  };

  const parseAdditive = () => {
    let node = parseMultiplicative();
    while (isOp('+') || isOp('-')) {
      const op = next().value;
      node = { type: 'binary', op, left: node, right: parseMultiplicative() };
    }
    return node;
  };

  const parseMultiplicative = () => {
    let node = parseUnary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = next().value;
      node = { type: 'binary', op, left: node, right: parseUnary() };
    }
    return node;
  };

  const parseUnary = () => {
    if (isOp('-') || isOp('+')) {
      const op = next().value;
      const operand = parseUnary();
      return op === '-' ? { type: 'negate', operand } : operand;
    }
    return parsePrimary();
  };

  const parsePrimary = () => {
    const token = next();
    if (!token) throw new Error('Unexpected end of formula');

    if (token.type === 'num') return { type: 'num', value: token.value };
    if (token.type === 'ref') return { type: 'ref', id: token.id, suffix: token.suffix };

    if (token.type === 'lparen') {
      const node = parseOr();
      if (!peek() || peek().type !== 'rparen') throw new Error('Missing closing parenthesis');
      next();
      return node;
    }

    if (token.type === 'ident') {
      const name = token.value;
      if (!FUNCTION_ARITY[name]) throw new Error(`Unknown function ${name}`);
      if (!peek() || peek().type !== 'lparen') throw new Error(`Expected "(" after ${name}`);
      next();

      const args = [];
      if (peek() && peek().type !== 'rparen') {
        args.push(parseOr());
        while (peek() && peek().type === 'comma') {
          next();
          args.push(parseOr());
        }
      }
      if (!peek() || peek().type !== 'rparen') throw new Error(`Missing closing parenthesis for ${name}`);
      next();

      const [minArgs, maxArgs] = FUNCTION_ARITY[name];
      if (args.length < minArgs || args.length > maxArgs) {
        throw new Error(`${name} expects ${minArgs === maxArgs ? minArgs : `${minArgs}-${maxArgs === Infinity ? 'n' : maxArgs}`} argument(s), got ${args.length}`);
      }
      if (name === 'CUMSUM' && !(args[0].type === 'ref' || (args[0].type === 'num' && Number.isInteger(args[0].value)))) {
        throw new Error('CUMSUM expects a single KPI reference, e.g. CUMSUM(v123)');
      }
      return { type: 'call', name, args };
    }

    throw new Error('Unexpected token in formula');
  };

  if (tokens.length === 0) throw new Error('Formula is empty');
  const tree = parseOr();
  if (pos < tokens.length) throw new Error('Unexpected content after end of formula');
  return tree;
}

/** Collect KPI references from a syntax tree. */
function collectReferences(node, refs, insideCumsum = false) {
  if (!node) return refs;
  switch (node.type) {
    case 'ref':
      refs.push({ id: node.id, suffix: node.suffix, cumulative: insideCumsum });
      break;
    case 'num':
      // CUMSUM(153) is accepted as shorthand for CUMSUM(v153)
      if (insideCumsum) refs.push({ id: node.value, suffix: null, cumulative: true });
      break;
    case 'negate':
      collectReferences(node.operand, refs, insideCumsum);
      break;
    case 'binary':
    case 'logical':
      collectReferences(node.left, refs, insideCumsum);
      collectReferences(node.right, refs, insideCumsum);
      break;
    case 'call':
      node.args.forEach(arg => collectReferences(arg, refs, insideCumsum || node.name === 'CUMSUM'));
      break;
    default:
      break;
  }
  return refs;
}

class FormulaEvaluator {
  constructor(kpiValuesMap) {
    // kpiValuesMap: { kpiValueId: value, 'kpiValueId:actual': value, 'kpiValueId:target': value }
    this.values = kpiValuesMap || {};
  }

  /**
   * Evaluate a formula string
   * @param {string} formula - e.g., "v1*v2+v3" or "AVERAGE(v1,v2,v3)"
   * @returns {number} computed result
   * @throws if the formula is invalid or the result is not a finite number (e.g. division by zero)
   */
  evaluate(formula) {
    if (!formula || typeof formula !== 'string') {
      throw new Error('Invalid formula');
    }

    let tree;
    try {
      tree = parse(formula);
    } catch (error) {
      throw new Error(`Failed to evaluate formula: ${error.message}`);
    }

    const result = this.evaluateNode(tree);

    if (!Number.isFinite(result)) {
      // Division by zero (or similar) must not be stored as a real value
      throw new Error('Failed to evaluate formula: result is not a finite number (check for division by zero)');
    }

    return Number(result);
  }

  resolveReference(id, suffix) {
    const key = suffix ? `${id}:${suffix}` : id;
    const value = this.values[key];

    if (value === undefined || value === null || value === '') {
      console.warn(`KPI Value v${id}${suffix ? `:${suffix}` : ''} not found or empty in values map. Available keys:`, Object.keys(this.values));
      return 0; // Default to 0 for missing values
    }
    const numValue = parseFloat(value);
    return Number.isNaN(numValue) ? 0 : numValue;
  }

  evaluateNode(node) {
    switch (node.type) {
      case 'num':
        return node.value;

      case 'ref':
        return this.resolveReference(node.id, node.suffix);

      case 'negate':
        return -this.evaluateNode(node.operand);

      case 'logical': {
        const left = this.evaluateNode(node.left);
        if (node.op === '&') return left && this.evaluateNode(node.right) ? 1 : 0;
        return left || this.evaluateNode(node.right) ? 1 : 0;
      }

      case 'binary': {
        const left = this.evaluateNode(node.left);
        const right = this.evaluateNode(node.right);
        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          case '%': return left % right;
          case '>': return left > right ? 1 : 0;
          case '<': return left < right ? 1 : 0;
          case '>=': return left >= right ? 1 : 0;
          case '<=': return left <= right ? 1 : 0;
          case '==': return left === right ? 1 : 0;
          case '!=': return left !== right ? 1 : 0;
          default: throw new Error(`Unsupported operator ${node.op}`);
        }
      }

      case 'call':
        return this.evaluateCall(node);

      default:
        throw new Error('Invalid formula');
    }
  }

  evaluateCall(node) {
    const { name, args } = node;

    // IF evaluates only the branch that is taken, so IF(v2 = 0, 0, v1 / v2) is safe
    if (name === 'IF') {
      const condition = this.evaluateNode(args[0]);
      if (condition) return this.evaluateNode(args[1]);
      return args.length > 2 ? this.evaluateNode(args[2]) : 0;
    }

    if (name === 'CUMSUM') {
      throw new Error('Failed to evaluate formula: CUMSUM must be resolved before evaluation');
    }

    const values = args.map(arg => this.evaluateNode(arg));

    switch (name) {
      case 'SUM':
        return values.reduce((sum, v) => sum + v, 0);
      case 'AVERAGE':
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case 'MIN':
        return Math.min(...values);
      case 'MAX':
        return Math.max(...values);
      case 'ABS':
        return Math.abs(values[0]);
      case 'ROUND': {
        const decimals = values.length > 1 ? Math.trunc(values[1]) : 0;
        const multiplier = Math.pow(10, decimals);
        return Math.round(values[0] * multiplier) / multiplier;
      }
      default:
        throw new Error(`Unknown function ${name}`);
    }
  }

  /**
   * List every KPI reference in a formula.
   * @param {string} formula
   * @returns {{id: number, suffix: ('actual'|'target'|null), cumulative: boolean}[]}
   */
  static extractReferences(formula) {
    if (!formula) return [];
    return collectReferences(parse(formula), []);
  }

  /**
   * Extract KPI Value IDs referenced in a formula
   * @param {string} formula
   * @returns {number[]} array of KPI Value IDs
   */
  static extractSourceKpiIds(formula) {
    if (!formula) return [];

    let ids;
    try {
      ids = FormulaEvaluator.extractReferences(formula).map(ref => ref.id);
    } catch (error) {
      // Fall back to a plain scan for formulas that do not parse
      const matches = formula.match(/v(\d+)/gi) || [];
      ids = matches.map(m => parseInt(m.slice(1), 10));
    }

    // Return unique IDs
    return [...new Set(ids)];
  }

  /**
   * Describe why a formula is invalid.
   * @param {string} formula
   * @returns {string|null} error message, or null when the formula is valid
   */
  static getFormulaError(formula) {
    if (!formula || typeof formula !== 'string') return 'Formula is empty';
    try {
      const refs = collectReferences(parse(formula), []);
      if (refs.length === 0) return 'Formula must reference at least one KPI value (e.g. v123)';
      return null;
    } catch (error) {
      return error.message;
    }
  }

  /**
   * Validate a formula syntax
   * @param {string} formula
   * @returns {boolean}
   */
  static validateFormula(formula) {
    return FormulaEvaluator.getFormulaError(formula) === null;
  }
}

module.exports = FormulaEvaluator;

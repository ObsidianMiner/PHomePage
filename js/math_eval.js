// ======================
// MATH EVAL
// Lazy-loads math.js on first detected math input.
// Exports window.getMathResult(query) → { result, display } | null
// ======================

const MATHJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.3/math.min.js";

// Keywords that signal math intent even without operators
const MATH_KEYWORDS = [
  "floor", "ceil", "round", "sqrt", "abs", "log", "log2", "log10",
  "sin", "cos", "tan", "asin", "acos", "atan", "exp", "mod",
  "pi", "e", "inf", "infinity", "phi",
  // unit conversion signals
  "to", "in",
  // common units — enough to trigger detection
  "feet", "foot", "ft", "inches", "inch", "in", "meters", "meter",
  "km", "miles", "mile", "kg", "lbs", "lb", "celsius", "fahrenheit",
  "gallons", "liters", "litres",
];

const MATH_OPERATOR_RE = /[\+\-\*\/\^%]/;
const HAS_DIGIT_RE     = /\d/;

let mathLoaded   = false;
let mathLoading  = false;
let loadQueue    = [];


// ======================
// DETECTION
// Must contain a digit OR a known math keyword,
// AND contain an operator or function call or unit keyword.
// Bare words and plain searches are excluded.
// ======================

window.looksLikeMath = function(q) {
  const lower = q.trim().toLowerCase();
  if (!lower) return false;

  const hasDigit    = HAS_DIGIT_RE.test(lower);
  const hasOperator = MATH_OPERATOR_RE.test(lower);
  const hasKeyword  = MATH_KEYWORDS.some(k => {
    // match whole word only to avoid "sin" matching "business"
    const re = new RegExp(`\\b${k}\\b`);
    return re.test(lower);
  });

  // Bare number with no operator — not interesting enough to show
  if (hasDigit && !hasOperator && !hasKeyword) return false;

  return (hasDigit || hasKeyword) && (hasOperator || hasKeyword);
};


// ======================
// PARENTHESIS AUTO-PAIRING
// Balances mismatched parens:
//   "floor(3 ^ 7) mod 4 + 2) * 3" → "(floor(3 ^ 7) mod 4 + 2) * 3"
// Prepends missing opens, appends missing closes.
// ======================

function balanceParens(expr) {
  let open = 0;
  let prepend = 0;

  for (const ch of expr) {
    if (ch === "(") {
      open++;
    } else if (ch === ")") {
      if (open === 0) prepend++;
      else open--;
    }
  }

  return "(".repeat(prepend) + expr + ")".repeat(open);
}


// ======================
// RESULT FORMATTING
// Handles plain numbers, math.js unit results, and bignumbers.
// ======================

function formatResult(raw) {
  // Unit result (e.g. "3 feet to inches" returns a Unit object)
  if (raw && typeof raw === "object" && raw.constructor?.name === "Unit") {
    return raw.toString();
  }

  // Round floating point noise (e.g. 0.30000000000000004 → 0.3)
  if (typeof raw === "number") {
    // Use toPrecision to strip float noise, then parseFloat to remove trailing zeros
    const cleaned = parseFloat(raw.toPrecision(12));
    return String(cleaned);
  }

  return String(raw);
}


// ======================
// LAZY LOAD
// ======================

function ensureMathLoaded() {
  return new Promise((resolve, reject) => {
    if (mathLoaded) { resolve(); return; }

    loadQueue.push({ resolve, reject });

    if (mathLoading) return;
    mathLoading = true;

    const script   = document.createElement("script");
    script.src     = MATHJS_CDN;
    script.onload  = () => {
      mathLoaded = true;
      loadQueue.forEach(p => p.resolve());
      loadQueue = [];
    };
    script.onerror = () => {
      const err = new Error("Failed to load math.js");
      loadQueue.forEach(p => p.reject(err));
      loadQueue = [];
    };
    document.head.appendChild(script);
  });
}


// ======================
// EVALUATE
// Returns { result: string, display: string } or null on failure.
// ======================

window.getMathResult = async function(rawQuery) {
  if (!window.looksLikeMath(rawQuery)) return null;

  try {
    await ensureMathLoaded();
  } catch(e) {
    return null;
  }

  const balanced = balanceParens(rawQuery.trim());

  try {
    const raw     = math.evaluate(balanced);
    const result  = formatResult(raw);

    // Suppress results that are just the input restated (e.g. variable assignments)
    if (result === balanced || result === rawQuery.trim()) return null;

    // Detect if it was a unit conversion for richer display
    const isConversion = /\bto\b|\bin\b/i.test(rawQuery);
    const display = isConversion
      ? `${rawQuery.trim()} = ${result}`
      : `= ${result}`;

    return { result, display };

  } catch(e) {
    return null; // Invalid expression — silently ignore
  }
};
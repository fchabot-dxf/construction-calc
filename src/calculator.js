/**
 * Imperial Construction Calculator Logic
 * Refactored for stability, modularity, and separation of concerns.
 */

const PRECISIONS = ['dec', 8, 16, 32];
const MAX_PARTS = 4;          // enough for "5' 6 1/2\"" and a spare

const CalculatorState = {
    stack: [],                // [{val, isMeas}, '+', ...]
    currentInput: "",        // raw string of numbers
    currentParts: [],         // segments ["5'", "6", "1/2\""]
    history: [],
    lastResult: null,
    currentPrecision: 8,      // Default precision: 1/8
    fnActive: false,          // FN shift: right column reads as units
    inputUnit: 'in',          // what a bare typed number means
    historyOpen: false        // history overlays the LCD on demand
};

const mainEl = document.getElementById('main-display');
const topEl = document.getElementById('top-display');
const histEl = document.getElementById('history-display');

function logState(action) {
    console.log(`[ACTION: ${action}]`, {
        currentInput: CalculatorState.currentInput,
        currentParts: CalculatorState.currentParts,
        stack: CalculatorState.stack,
        lastResult: CalculatorState.lastResult,
        precision: CalculatorState.currentPrecision,
        topText: topEl?.innerText,
        mainText: mainEl?.innerText
    });
}

function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
}

function parseNumber(value) {
    if (!value) return 0;
    if (value.includes('/')) {
        const [n, d] = value.split('/');
        return (parseFloat(n) || 0) / (parseFloat(d) || 1);
    }
    return parseFloat(value) || 0;
}

function partsToMeasurement(parts) {
    const raw = parts.join(' ');
    if (parts.length === 0) return { val: 0, isMeas: false, raw };

    const terms = parts.map(part => {
        const { number, unit } = splitUnitSuffix(part);
        return { value: parseNumber(number), unit };
    });

    // A term typed without a unit borrows the next unit to its right, so
    // "5' 6 1/2\"" reads the 6 as inches. Nothing on the right falls back to
    // the selected input unit, which starts as the inch.
    let pending = null;
    for (let i = terms.length - 1; i >= 0; i--) {
        if (terms[i].unit) pending = terms[i].unit;
        else terms[i].unit = pending;
    }

    const fallback = findUnit(CalculatorState.inputUnit).inches;
    const val = terms.reduce((sum, term) => sum + term.value * (term.unit ? term.unit.inches : fallback), 0);
    return { val, isMeas: true, raw };
}

function inputSystem() {
    return findUnit(CalculatorState.inputUnit).system;
}

function isDecimalPrecision() {
    if (inputSystem() === 'metric') return true;
    return CalculatorState.currentPrecision === 'dec';
}

function formatFraction(value, precision) {
    const absValue = Math.abs(value);
    let total = Math.floor(absValue);
    let remainder = absValue - total;
    let numerator = Math.round(remainder * precision);
    let denominator = precision;

    if (numerator === denominator) {
        total += 1;
        numerator = 0;
    }

    [numerator, denominator] = [numerator, denominator].map(Number);
    const g = gcd(numerator, denominator);
    numerator = numerator / (g || 1);
    denominator = denominator / (g || 1);

    const fraction = numerator > 0 ? `${numerator}/${denominator}` : "";
    let main = (value < 0 ? "-" : "") + (total > 0 ? total : (fraction ? "" : "0"));
    if (fraction) main += (total > 0 ? " " : "") + fraction;
    return main;
}

function formatFeetInches(inchValue, precision) {
    const sign = inchValue < 0 ? "-" : "";
    // Snap to the grid before splitting, or 11.99" rounds up to 5' 12".
    const total = precision === 'dec'
        ? Math.round(Math.abs(inchValue) * 1e4) / 1e4
        : Math.round(Math.abs(inchValue) * precision) / precision;

    const feet = Math.floor(total / 12 + 1e-9);
    const inches = total - feet * 12;
    const inchText = precision === 'dec' ? formatDecimal(inches) : formatFraction(inches, precision);
    return `${sign}${feet}' ${inchText}"`;
}

function formatInUnit(inchValue, unit) {
    const precision = CalculatorState.currentPrecision;
    if (unit.fmt === 'ftin') return formatFeetInches(inchValue, precision);

    const value = inchValue / unit.inches;
    if (unit.fmt === 'frac' && precision !== 'dec') return formatFraction(value, precision);
    return formatDecimal(value);
}

function formatValue(value, isMeas, roundResult = false) {
    if (isNaN(value)) return { main: "Error", top: "" };

    if (!isMeas) {
        if (isDecimalPrecision()) {
            const decimal = +value.toPrecision(12);
            return { main: decimal.toString(), top: "" };
        }

        if (!roundResult) {
            return { main: formatFraction(value, CalculatorState.currentPrecision), top: "" };
        }

        const precision = CalculatorState.currentPrecision;
        const step = 1 / precision;
        const roundedValue = Math.round((value + Number.EPSILON) / step) * step;
        return { main: formatFraction(roundedValue, precision), top: "" };
    }

    if (isDecimalPrecision()) {
        const decimal = +value.toPrecision(12);
        return { main: decimal.toString(), top: "" };
    }

    return { main: formatFraction(value, CalculatorState.currentPrecision), top: "" };
}

function getInputDisplay() {
    const parts = [...CalculatorState.currentParts];
    if (CalculatorState.currentInput) parts.push(CalculatorState.currentInput);

    if (parts.length === 0) return "0";
    const text = parts.join(' ');
    return CalculatorState.currentInput ? text : `${text} `;
}

function getStackExpression() {
    return CalculatorState.stack
        .map(item => typeof item === 'string'
            ? item
            : (item.raw || formatValue(item.val, item.isMeas, false).main))
        .join(' ');
}

function updatePrecisionButtons() {
    PRECISIONS.forEach(p => {
        const btn = document.getElementById(`prec-${p}`);
        if (!btn) return;
        if (p === CalculatorState.currentPrecision) {
            btn.classList.add('bg-slate-600', 'text-white');
            btn.classList.remove('bg-slate-700', 'text-slate-400');
        } else {
            btn.classList.remove('bg-slate-600', 'text-white');
            btn.classList.add('bg-slate-700', 'text-slate-400');
        }
    });
}

function applyOperator(result, operator, next) {
    if (!next) return result;
    if (operator === '+') {
        result.val += next.val;
        result.isMeas = result.isMeas || next.isMeas;
    } else if (operator === '-') {
        result.val -= next.val;
        result.isMeas = result.isMeas || next.isMeas;
    } else if (operator === '×' || operator === '*') {
        result.val *= next.val;
        result.isMeas = result.isMeas || next.isMeas;
    } else if (operator === '÷' || operator === '/') {
        result.val /= (next.val || 1);
        if (result.isMeas && next.isMeas) result.isMeas = false;
    }
    return result;
}

function evaluateExpression(items) {
    if (items.length === 0) return { val: 0, isMeas: false };
    let result = { ...items[0] };
    for (let i = 1; i < items.length; i += 2) {
        const operator = items[i];
        const next = items[i + 1];
        result = applyOperator(result, operator, next);
    }
    return result;
}

function getLiveItems() {
    const items = [...CalculatorState.stack];
    const parts = [...CalculatorState.currentParts];
    if (CalculatorState.currentInput) parts.push(CalculatorState.currentInput);
    if (parts.length) items.push(partsToMeasurement(parts));
    return items;
}

function formatExpression(items) {
    return items
        .map(item => {
            if (typeof item === 'string') return item;
            return item.raw ? item.raw : formatValue(item.val, item.isMeas, false).main;
        })
        .join(' ');
}

function evaluateLive() {
    const items = getLiveItems();
    if (items.length === 0) return null;
    if (typeof items[items.length - 1] === 'string') items.pop();
    if (items.length === 0) return null;
    return evaluateExpression(items);
}

function computeLiveResult() {
    const result = evaluateLive();
    return result ? formatValue(result.val, result.isMeas, true).main : null;
}

// Inches to feed the conversion strip: the settled answer if there is one,
// otherwise whatever is being typed right now.
function getConversionValue() {
    if (CalculatorState.lastResult) return CalculatorState.lastResult.val;
    const result = evaluateLive();
    return result ? result.val : null;
}

function renderConversions() {
    const host = document.getElementById('conv-strip');
    if (!host) return;

    const value = getConversionValue() || 0;
    const units = unitsInSystem(oppositeSystem(inputSystem()));

    host.style.gridTemplateColumns = `repeat(${units.length}, minmax(0, 1fr))`;
    host.innerHTML = units.map(unit => `
        <div class="conv-cell">
            <span class="conv-label">${unit.label}</span>
            <span class="conv-value">${formatInUnit(value, unit)}</span>
        </div>`).join('');
}

// Both rows are rebuilt from the declaration: the system segments, then
// the units that live in the selected system.
function renderInputBar() {
    const seg = document.getElementById('system-toggle');
    const chips = document.getElementById('unit-chips');
    if (!seg || !chips) return;

    const active = inputSystem();
    seg.innerHTML = Object.entries(SYSTEMS).map(([id, system]) =>
        `<button onclick="setSystem('${id}')" class="lcd-seg-btn${id === active ? ' on' : ''}">${id}</button>`
    ).join('');

    chips.innerHTML = inputUnits(active).map(unit =>
        `<button onclick="setInputUnit('${unit.id}')" class="lcd-chip${unit.id === CalculatorState.inputUnit ? ' on' : ''}">${unit.legend}</button>`
    ).join('');
}

function adjustTopDisplay() {
    if (!topEl) return;
    topEl.style.fontSize = '';
    const minSize = 10;
    let size = parseFloat(window.getComputedStyle(topEl).fontSize) || 18;
    while (topEl.scrollWidth > topEl.clientWidth && size > minSize) {
        size -= 1;
        topEl.style.fontSize = `${size}px`;
    }
}

function updateScreen() {
    const liveItems = getLiveItems();
    const liveExpression = liveItems.length ? formatExpression(liveItems) : "";
    const liveResult = computeLiveResult();
    topEl.innerText = liveResult ? `${liveExpression} = ${liveResult}` : liveExpression;

    mainEl.innerText = CalculatorState.lastResult
        ? formatValue(CalculatorState.lastResult.val, CalculatorState.lastResult.isMeas, true).main
        : getInputDisplay();

    adjustTopDisplay();
    histEl.innerText = CalculatorState.history.length
        ? CalculatorState.history.join("\n")
        : "no history yet";
    histEl.scrollTop = histEl.scrollHeight;
    document.body.classList.toggle('history-open', CalculatorState.historyOpen);
    updatePrecisionButtons();
    renderInputBar();
    renderConversions();
    document.body.classList.toggle('fn-active', CalculatorState.fnActive);
}

function blurAll() {
    if (document.activeElement) document.activeElement.blur();
    // FN is sticky-shift: any key press spends it, and any key press
    // also puts the history panel away.
    CalculatorState.fnActive = false;
    CalculatorState.historyOpen = false;
}

function resetCalculator() {
    CalculatorState.stack = [];
    CalculatorState.currentInput = "";
    CalculatorState.currentParts = [];
    CalculatorState.lastResult = null;
}

window.handleDigit = (digit) => {
    blurAll();
    if (CalculatorState.lastResult) resetCalculator();
    CalculatorState.currentInput += digit;
    logState(`handleDigit(${digit})`);
    updateScreen();
};

window.handleSpace = () => {
    blurAll();
    CalculatorState.lastResult = null;
    if (CalculatorState.currentInput) {
        if (CalculatorState.currentParts.length < MAX_PARTS) {
            CalculatorState.currentParts.push(CalculatorState.currentInput);
            CalculatorState.currentInput = "";
        } else {
            mainEl.innerText = "ERR";
            setTimeout(updateScreen, 400);
        }
    }
    logState('handleSpace');
    updateScreen();
};

window.handleSlash = () => {
    blurAll();
    CalculatorState.lastResult = null;
    CalculatorState.currentInput += "/";
    logState('handleSlash');
    updateScreen();
};

window.toggleFn = () => {
    const next = !CalculatorState.fnActive;
    blurAll();
    CalculatorState.fnActive = next;
    updateScreen();
};

// A unit closes the term it sits on, so the next digit starts a fresh one
// and "5' 6\"" lands as two terms rather than one nonsense token.
window.handleUnit = (unitId) => {
    blurAll();
    if (CalculatorState.lastResult) resetCalculator();

    CalculatorState.currentInput += findUnit(unitId).aliases[0];
    if (CalculatorState.currentParts.length < MAX_PARTS) {
        CalculatorState.currentParts.push(CalculatorState.currentInput);
        CalculatorState.currentInput = "";
    }

    logState(`handleUnit(${unitId})`);
    updateScreen();
};

// Typed letters build a unit up a character at a time ("m", "mm"), so they
// only append — the parser reads the suffix when the term is evaluated.
window.handleUnitChar = (char) => {
    blurAll();
    if (CalculatorState.lastResult) resetCalculator();
    CalculatorState.currentInput += char;
    updateScreen();
};

window.toggleHistory = () => {
    const next = !CalculatorState.historyOpen;
    blurAll();
    CalculatorState.historyOpen = next;
    updateScreen();
};

window.setSystem = (system) => {
    blurAll();
    CalculatorState.inputUnit = SYSTEMS[system].input;
    updateScreen();
};

window.setInputUnit = (unitId) => {
    blurAll();
    CalculatorState.inputUnit = unitId;
    updateScreen();
};

window.setPrecision = (precision) => {
    blurAll();
    CalculatorState.currentPrecision = precision;
    if (precision === 'dec') {
        console.log('[PRECISION SET TO: decimal]');
    } else {
        console.log(`[PRECISION SET TO: 1/${precision}]`);
    }
    updateScreen();
};

window.handleOperator = (operator) => {
    blurAll();
    const parts = [...CalculatorState.currentParts];
    if (CalculatorState.currentInput) parts.push(CalculatorState.currentInput);

    if (parts.length) {
        CalculatorState.stack.push(partsToMeasurement(parts), operator);
        CalculatorState.currentParts = [];
        CalculatorState.currentInput = "";
    } else if (CalculatorState.lastResult) {
        CalculatorState.stack = [CalculatorState.lastResult, operator];
        CalculatorState.lastResult = null;
    } else if (CalculatorState.stack.length) {
        CalculatorState.stack[CalculatorState.stack.length - 1] = operator;
    }

    logState(`handleOperator(${operator})`);
    updateScreen();
};

window.handleEquals = () => {
    blurAll();
    const parts = [...CalculatorState.currentParts];
    if (CalculatorState.currentInput) parts.push(CalculatorState.currentInput);

    const items = [...CalculatorState.stack];
    if (parts.length) items.push(partsToMeasurement(parts));

    if (items.length === 0) return;
    if (typeof items[items.length - 1] === 'string') items.pop();
    if (items.length === 0) return;

    const result = evaluateExpression(items);
    const resultText = formatValue(result.val, result.isMeas, true);
    const expression = formatExpression(items);

    CalculatorState.history.push(`${expression} = ${resultText.main}`);
    if (CalculatorState.history.length > 30) CalculatorState.history.shift();

    CalculatorState.lastResult = result;
    CalculatorState.stack = [];
    CalculatorState.currentParts = [];
    CalculatorState.currentInput = "";

    logState('handleEquals');
    updateScreen();
};

window.handleClear = () => {
    resetCalculator();
    logState('handleClear');
    updateScreen();
};

window.handleBackspace = () => {
    blurAll();
    if (CalculatorState.lastResult) { window.handleClear(); return; }

    if (CalculatorState.currentInput) {
        CalculatorState.currentInput = CalculatorState.currentInput.slice(0, -1);
    } else if (CalculatorState.currentParts.length) {
        CalculatorState.currentInput = CalculatorState.currentParts.pop();
    } else if (CalculatorState.stack.length) {
        CalculatorState.stack.pop();
        CalculatorState.lastResult = CalculatorState.stack.pop() || null;
    }

    logState('handleBackspace');
    updateScreen();
};

function handleKeyboardEvent(event) {
    const key = event.key;
    if (key >= '0' && key <= '9') { event.preventDefault(); window.handleDigit(key); }
    else if (key === '.') { event.preventDefault(); window.handleDigit('.'); }
    else if (key === '/') { event.preventDefault(); window.handleSlash(); }
    else if (key === ' ') { event.preventDefault(); window.handleSpace(); }
    else if (key === '+') { event.preventDefault(); window.handleOperator('+'); }
    else if (key === '-') { event.preventDefault(); window.handleOperator('-'); }
    else if (key === '*') { event.preventDefault(); window.handleOperator('×'); }
    else if (key === 'Enter' || key === '=') { event.preventDefault(); window.handleEquals(); }
    else if (key === 'Backspace') { event.preventDefault(); window.handleBackspace(); }
    else if (key === 'Escape') { event.preventDefault(); window.handleClear(); }
    else if (key === '"') { event.preventDefault(); window.handleUnit('in'); }
    else if (key === "'") { event.preventDefault(); window.handleUnit('ft'); }
    else if (/^[a-z]$/i.test(key)) { event.preventDefault(); window.handleUnitChar(key.toLowerCase()); }
}

// Print each unit legend on its keypad key and let FN reroute the click,
// leaving the key's own inline handler untouched.
function wireFnKeys() {
    UNIT_KEYS.forEach(unitId => {
        const btn = document.querySelector(`[data-unit="${unitId}"]`);
        if (!btn) return;

        btn.querySelector('.fn-legend').innerText = findUnit(unitId).legend;
        const normalClick = btn.onclick;
        btn.onclick = (event) => {
            if (CalculatorState.fnActive) { window.handleUnit(unitId); return; }
            normalClick.call(btn, event);
        };
    });
}

function initializeCalculator() {
    window.addEventListener('keydown', handleKeyboardEvent);
    window.addEventListener('resize', updateScreen);
    wireFnKeys();
    updateScreen();
}

initializeCalculator();

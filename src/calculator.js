/**
 * Imperial Construction Calculator Logic
 * Refactored for stability, modularity, and separation of concerns.
 */

const PRECISIONS = ['dec', 8, 16, 32];

const CalculatorState = {
    stack: [],                // [{val, isMeas}, '+', ...]
    currentInput: "",        // raw string of numbers
    currentParts: [],         // segments ["5", "6"]
    history: [],
    lastResult: null,
    currentPrecision: 8       // Default precision: 1/8
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
    if (parts.length === 0) return { val: 0, isMeas: false };
    if (parts.length === 1) return { val: parseNumber(parts[0]), isMeas: true };

    const whole = parseNumber(parts[0]);
    const frac = parseNumber(parts[1]);
    return { val: whole + frac, isMeas: true };
}

function isDecimalPrecision() {
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
    if (parts.length === 1) return CalculatorState.currentInput ? parts[0] : `${parts[0]} `;
    return `${parts[0]} ${parts[1]}`;
}

function getStackExpression() {
    return CalculatorState.stack
        .map(item => typeof item === 'string' ? item : formatValue(item.val, item.isMeas, false).main)
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

function formatExpression(items) {
    return items
        .map(item => typeof item === 'string' ? item : formatValue(item.val, item.isMeas, false).main)
        .join(' ');
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
    topEl.innerText = getStackExpression();
    mainEl.innerText = CalculatorState.lastResult
        ? formatValue(CalculatorState.lastResult.val, CalculatorState.lastResult.isMeas, true).main
        : getInputDisplay();

    adjustTopDisplay();
    histEl.innerText = CalculatorState.history.join("\n");
    histEl.scrollTop = histEl.scrollHeight;
    updatePrecisionButtons();
}

function blurAll() {
    if (document.activeElement) document.activeElement.blur();
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
        if (CalculatorState.currentParts.length < 2) {
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
}

function initializeCalculator() {
    window.addEventListener('keydown', handleKeyboardEvent);
    window.addEventListener('resize', updateScreen);
    updateScreen();
}

initializeCalculator();

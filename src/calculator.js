/**
 * Imperial Construction Calculator Logic
 * Refactored for stability, logging, and duplication fixes.
 */

let stack = [];            // [{val, isMeas}, '+', ...]
let currentInput = "";     // raw string of numbers
let currentParts = [];     // segments ["5", "6"]
let history = [];
let lastResult = null;
let currentPrecision = 8; // Default precision: 1/8

const mainEl = document.getElementById('main-display');
const topEl = document.getElementById('top-display');
const histEl = document.getElementById('history-display');

function logState(action) {
    console.log(`[ACTION: ${action}]`, {
        currentInput,
        currentParts,
        stack,
        lastResult,
        topText: topEl.innerText,
        mainText: mainEl.innerText
    });
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function toNum(s) {
    if (!s) return 0;
    if (s.includes('/')) {
        const [n, d] = s.split('/');
        return (parseFloat(n) || 0) / (parseFloat(d) || 1);
    }
    return parseFloat(s) || 0;
}

function partsToMeasurement(parts) {
    if (parts.length === 0) return { val: 0, isMeas: false };
    if (parts.length === 1) return { val: toNum(parts[0]), isMeas: true };

    let whole = toNum(parts[0]);
    let frac = toNum(parts[1]);
    return { val: whole + frac, isMeas: true };
}

function formatValue(val, isMeas, roundResult = false) {
    if (isNaN(val)) return { main: "Error", top: "" };
    const reduce = (n, d) => { let g = gcd(n, d); return [n / g, d / g]; };
    const absVal = Math.abs(val);

    if (!isMeas) {
        if (!roundResult || currentPrecision === 'dec') {
            if (currentPrecision === 'dec') {
                let decimal = +val.toPrecision(12);
                return { main: decimal.toString(), top: "" };
            }
            let total = Math.floor(absVal);
            let rem = absVal - total;
            let n = Math.round(rem * currentPrecision);
            let d = currentPrecision;
            if (n === d) { total += 1; n = 0; }
            [n, d] = reduce(n, d);

            let frac = n > 0 ? n + "/" + d : "";
            let main = (val < 0 ? "-" : "") + (total > 0 ? total : (frac ? "" : "0"));
            if (frac) main += (total > 0 ? " " : "") + frac;
            return { main, top: "" };
        }
        const step = 1 / currentPrecision;
        const rounded = Math.round((val + Number.EPSILON) / step) * step;
        let total = Math.floor(Math.abs(rounded));
        let rem = Math.abs(rounded) - total;
        let n = Math.round(rem * currentPrecision);
        let d = currentPrecision;
        if (n === d) { total += 1; n = 0; }
        [n, d] = reduce(n, d);
        let frac = n > 0 ? n + "/" + d : "";
        let main = (rounded < 0 ? "-" : "") + (total > 0 ? total : (frac ? "" : "0"));
        if (frac) main += (total > 0 ? " " : "") + frac;
        return { main, top: "" };
    }
    if (currentPrecision === 'dec') {
        let decimal = +val.toPrecision(12);
        return { main: String(decimal), top: "" };
    }

    let totalIn = Math.floor(absVal);
    let rem = absVal - totalIn;
    let n = Math.round(rem * currentPrecision);
    let d = currentPrecision;
    if (n === d) { totalIn += 1; n = 0; }
    [n, d] = reduce(n, d);

    let frac = n > 0 ? n + "/" + d : "";
    let main = (val < 0 ? "-" : "") + (totalIn > 0 ? totalIn : (frac ? "" : "0"));
    if (frac) main += (totalIn > 0 ? " " : "") + frac;

    return { main, top: "" };
}

function updateScreen() {
    // TOP DISPLAY (The Pill): Only show finalized tokens from stack.
    // If we are just starting to type a number, the pill stays empty or shows the expression so far.
    let topText = stack.map(i => typeof i === 'string' ? i : formatValue(i.val, i.isMeas, false).main).join(' ');
    
    let mainText = "0";
    if (lastResult) {
        mainText = formatValue(lastResult.val, lastResult.isMeas, true).main;
    } else {
        let p = [...currentParts];
        if (currentInput) p.push(currentInput);
        if (p.length === 0) mainText = "0";
        else if (p.length === 1) {
            mainText = p[0];
            if (!currentInput) mainText += " ";
        } else if (p.length === 2) mainText = p[0] + " " + p[1];
    }

    mainEl.innerText = mainText;
    topEl.innerText = topText;
    adjustTopDisplay();
    histEl.innerText = history.join("\n");
    histEl.scrollTop = histEl.scrollHeight;

    // Highlight active precision
    ['dec', 8, 16, 32].forEach(p => {
        const btn = document.getElementById(`prec-${p}`);
        if (btn) {
            if (p === currentPrecision) {
                btn.classList.add('bg-slate-600', 'text-white');
                btn.classList.remove('bg-slate-700', 'text-slate-400');
            } else {
                btn.classList.remove('bg-slate-600', 'text-white');
                btn.classList.add('bg-slate-700', 'text-slate-400');
            }
        }
    });
}

function adjustTopDisplay() {
    if (!topEl) return;
    topEl.style.fontSize = '';
    const minSize = 10;
    let size = parseFloat(window.getComputedStyle(topEl).fontSize) || 18;
    while (topEl.scrollWidth > topEl.clientWidth && size > minSize) {
        size -= 1;
        topEl.style.fontSize = size + 'px';
    }
}

function blurAll() { if (document.activeElement) document.activeElement.blur(); }

window.handleDigit = (d) => {
    blurAll();
    if (lastResult) {
        // If we have a result and start typing, it's a new calc
        stack = []; currentParts = []; currentInput = ""; lastResult = null;
    }
    currentInput += d;
    logState(`handleDigit(${d})`);
    updateScreen();
};

window.handleSpace = () => {
    blurAll();
    if (lastResult) lastResult = null;
    if (currentInput) {
        if (currentParts.length < 2) {
            currentParts.push(currentInput);
            currentInput = "";
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
    if (lastResult) lastResult = null;
    currentInput += "/";
    logState('handleSlash');
    updateScreen();
};

window.setPrecision = (p) => {
    blurAll();
    currentPrecision = p;
    if (p === 'dec') {
        console.log('[PRECISION SET TO: decimal inches]');
    } else {
        console.log(`[PRECISION SET TO: 1/${p}]`);
    }
    updateScreen();
};

window.handleOperator = (op) => {
    blurAll();
    let p = [...currentParts];
    if (currentInput) p.push(currentInput);

    if (p.length) {
        stack.push(partsToMeasurement(p), op);
        currentParts = []; currentInput = "";
    } else if (lastResult) {
        stack = [lastResult, op];
        lastResult = null;
    } else if (stack.length) {
        stack[stack.length - 1] = op;
    }
    logState(`handleOperator(${op})`);
    updateScreen();
};

window.handleEquals = () => {
    blurAll();
    let p = [...currentParts];
    if (currentInput) p.push(currentInput);
    
    let items = [...stack];
    if (p.length) items.push(partsToMeasurement(p));
    
    if (items.length === 0) return;
    if (typeof items[items.length - 1] === 'string') items.pop();
    if (items.length === 0) return;

    let res = { ...items[0] };
    for (let i = 1; i < items.length; i += 2) {
        let op = items[i];
        let next = items[i + 1];
        if (!next) break;
        if (op === '+') { res.val += next.val; res.isMeas = res.isMeas || next.isMeas; }
        else if (op === '-') { res.val -= next.val; res.isMeas = res.isMeas || next.isMeas; }
        else if (op === '×' || op === '*') { res.val *= next.val; res.isMeas = res.isMeas || next.isMeas; }
        else if (op === '÷' || op === '/') { res.val /= (next.val || 1); if (res.isMeas && next.isMeas) res.isMeas = false; }
    }
    
    let resFormatted = formatValue(res.val, res.isMeas);
    let exprStr = items.map(i => typeof i === 'string' ? i : formatValue(i.val, i.isMeas, false).main).join(' ');
    
    history.push(exprStr + " = " + resFormatted.main);
    if (history.length > 30) history.shift();
    
    lastResult = res;
    stack = []; currentParts = []; currentInput = "";
    logState('handleEquals');
    updateScreen();
};

window.handleClear = () => {
    stack = []; currentInput = ""; currentParts = []; lastResult = null;
    logState('handleClear');
    updateScreen();
};

window.handleBackspace = () => {
    blurAll();
    if (lastResult) { handleClear(); return; }
    if (currentInput) currentInput = currentInput.slice(0, -1);
    else if (currentParts.length) currentInput = currentParts.pop();
    else if (stack.length) { stack.pop(); lastResult = stack.pop(); }
    logState('handleBackspace');
    updateScreen();
};

window.addEventListener('keydown', (e) => {
    const key = e.key;
    if (key >= '0' && key <= '9') { e.preventDefault(); handleDigit(key); }
    else if (key === '.') { e.preventDefault(); handleDigit('.'); }
    else if (key === '/') { e.preventDefault(); handleSlash(); }
    else if (key === ' ') { e.preventDefault(); handleSpace(); }
    else if (key === '+') { e.preventDefault(); handleOperator('+'); }
    else if (key === '-') { e.preventDefault(); handleOperator('-'); }
    else if (key === '*') { e.preventDefault(); handleOperator('×'); }
    else if (key === 'Enter' || key === '=') { e.preventDefault(); handleEquals(); }
    else if (key === 'Backspace') { e.preventDefault(); handleBackspace(); }
    else if (key === 'Escape') { e.preventDefault(); handleClear(); }
});

window.addEventListener('DOMContentLoaded', updateScreen);
window.addEventListener('resize', updateScreen);

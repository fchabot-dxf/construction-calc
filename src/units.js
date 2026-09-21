/**
 * Length units: declaration, parsing and conversion.
 *
 * The calculator's base unit is the inch, so a bare number keeps meaning
 * exactly what it meant before — a unit suffix only scales it.
 *
 *   system   which half of the conversion strip this belongs to
 *   inches   how many inches one of this unit is
 *   fmt      how a value renders here: 'dec' | 'frac' | 'ftin'
 *   label    caption in the conversion strip
 *   legend   FN label on the keypad; omitted = no key
 *   aliases  every spelling accepted in typed input; [] = display only
 *
 * Adding a unit is one row: the strip and the FN legends both build
 * themselves from this list.
 */
const LENGTH_UNITS = [
    { id: 'mm', system: 'metric', inches: 1 / 25.4, fmt: 'dec', label: 'mm', legend: 'mm',
      aliases: ['mm', 'millimetres', 'millimeters', 'millimetre', 'millimeter'] },
    { id: 'cm', system: 'metric', inches: 1 / 2.54, fmt: 'dec', label: 'cm', legend: 'cm',
      aliases: ['cm', 'centimetres', 'centimeters', 'centimetre', 'centimeter'] },
    { id: 'm', system: 'metric', inches: 1 / 0.0254, fmt: 'dec', label: 'm', legend: 'm',
      aliases: ['m', 'metres', 'meters', 'metre', 'meter'] },

    // legend reads "in"/"ft" rather than " and ', which vanish at 10px
    { id: 'in', system: 'imperial', inches: 1, fmt: 'dec', label: 'inch', legend: 'in',
      aliases: ['"', '\u2033', 'inches', 'inch', 'in'] },
    { id: 'ft', system: 'imperial', inches: 12, fmt: 'dec', label: 'feet', legend: 'ft',
      aliases: ["'", '\u2032', 'feet', 'foot', 'ft'] },

    // Display only: same ratio as a unit above, rendered differently.
    { id: 'infr', system: 'imperial', inches: 1, fmt: 'frac', label: 'in frac', aliases: [] },
    { id: 'ftin', system: 'imperial', inches: 12, fmt: 'ftin', label: 'ft-in', aliases: [] },
];

/**
 * The two input systems. `input` is what a bare typed number means while
 * that system is selected, and `label` is the badge on the display.
 */
const SYSTEMS = {
    imperial: { label: 'INCH', input: 'in' },
    metric: { label: 'MM', input: 'mm' },
};

function oppositeSystem(system) {
    return system === 'metric' ? 'imperial' : 'metric';
}

// The FN legends on the right-hand keypad column, top to bottom.
// Each key inserts its unit's aliases[0].
const UNIT_KEYS = ['in', 'ft', 'mm', 'cm', 'm'];

// Longest alias first, so "5mm" never matches the "m" of metres and
// "5inches" never matches the "in" of inch.
const UNIT_ALIASES = LENGTH_UNITS
    .flatMap(unit => unit.aliases.map(alias => ({ alias, unit })))
    .sort((a, b) => b.alias.length - a.alias.length);

function findUnit(id) {
    return LENGTH_UNITS.find(unit => unit.id === id);
}

function unitsInSystem(system) {
    return LENGTH_UNITS.filter(unit => unit.system === system);
}

// Units you can actually type in; the display-only formats have no legend.
function inputUnits(system) {
    return unitsInSystem(system).filter(unit => unit.legend);
}

/**
 * Split a trailing unit off one typed term: "6 1/2\"" -> { number, unit }.
 * A term with no recognised suffix comes back with unit null.
 */
function splitUnitSuffix(text) {
    const lower = text.toLowerCase();
    for (const { alias, unit } of UNIT_ALIASES) {
        if (lower.endsWith(alias)) {
            return { number: text.slice(0, text.length - alias.length), unit };
        }
    }
    return { number: text, unit: null };
}

/**
 * Imperial shorthand: unitless parts fill slots from the RIGHT — a trailing
 * fraction, then inches, then feet. So "5 & 6 & 1/2" is 5' 6 1/2" and
 * "5 & 6" is 5' 6", while "5 & 1/2" stays 5 1/2" as it always has.
 *
 * Returns null when the shorthand does not apply, leaving the caller's
 * normal term-summing to handle it.
 */
function positionalInches(parts, terms, system) {
    if (system !== 'imperial') return null;
    if (parts.length < 2 || parts.length > 3) return null;
    if (terms.some(term => term.unit)) return null;

    const slots = [...parts];
    const tail = slots[slots.length - 1];
    const fraction = tail.includes('/') ? slots.pop() : null;
    const inches = slots.pop() || null;
    const feet = slots.pop() || null;

    const val = (feet ? parseNumber(feet) * 12 : 0)
        + (inches ? parseNumber(inches) : 0)
        + (fraction ? parseNumber(fraction) : 0);

    const raw = [
        feet ? `${feet}'` : null,
        inches || null,
        fraction || null,
    ].filter(Boolean).join(' ') + '"';

    return { val, raw };
}

function formatDecimal(value) {
    return (Math.round(value * 1e4) / 1e4).toString();
}

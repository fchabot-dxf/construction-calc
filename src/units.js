/**
 * Length units: declaration, parsing and conversion.
 *
 * The calculator's base unit is the inch, so a bare number keeps meaning
 * exactly what it meant before — a unit suffix only scales it.
 *
 *   inches   how many inches one of this unit is
 *   fmt      how a value renders here: 'dec' | 'frac' | 'ftin'
 *   label    caption in the conversion strip
 *   aliases  every spelling accepted in typed input; [] = display only
 *   wide     strip cell spans two columns
 *
 * Adding a unit is one row: the strip and the unit drawer both build
 * themselves from this list.
 */
const LENGTH_UNITS = [
    { id: 'mm', inches: 1 / 25.4, fmt: 'dec', label: 'mm',
      aliases: ['mm', 'millimetres', 'millimeters', 'millimetre', 'millimeter'] },
    { id: 'cm', inches: 1 / 2.54, fmt: 'dec', label: 'cm',
      aliases: ['cm', 'centimetres', 'centimeters', 'centimetre', 'centimeter'] },
    { id: 'm', inches: 1 / 0.0254, fmt: 'dec', label: 'm',
      aliases: ['m', 'metres', 'meters', 'metre', 'meter'] },
    { id: 'ft', inches: 12, fmt: 'dec', label: 'feet',
      aliases: ["'", '′', 'feet', 'foot', 'ft'] },
    { id: 'in', inches: 1, fmt: 'dec', label: 'inch',
      aliases: ['"', '″', 'inches', 'inch', 'in'] },

    // Display only: same ratio as a unit above, rendered differently.
    { id: 'infr', inches: 1, fmt: 'frac', label: 'in frac', aliases: [] },
    { id: 'ftin', inches: 12, fmt: 'ftin', label: 'ft-in', aliases: [], wide: true },
];

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

function formatDecimal(value) {
    return (Math.round(value * 1e4) / 1e4).toString();
}

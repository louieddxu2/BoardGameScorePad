export interface RgbaColor {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}

export type ColorVariableResolver = (name: string) => string | undefined;
export type ColorReader = (color: string) => RgbaColor | null;

const clamp = (value: number, max = 1) => Math.min(max, Math.max(0, value));
const numberPattern = /^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?%?$/i;
const namedColors: Record<string, readonly [number, number, number]> = {
    black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128], grey: [128, 128, 128],
    red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
    cyan: [0, 255, 255], aqua: [0, 255, 255], magenta: [255, 0, 255], fuchsia: [255, 0, 255],
    orange: [255, 165, 0], purple: [128, 0, 128], pink: [255, 192, 203], brown: [165, 42, 42],
};

function channel(value: string, max: number): number | null {
    if (!numberPattern.test(value)) return null;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    return clamp(value.endsWith('%') ? parsed * max / 100 : parsed, max);
}

function expandVariables(value: string, resolve?: ColorVariableResolver, chain: string[] = []): string | null {
    if (chain.length > 32) return null;
    let start = value.toLowerCase().indexOf('var(');
    while (start !== -1) {
        let depth = 1;
        let end = start + 4;
        let comma = -1;
        for (; end < value.length && depth; end++) {
            if (value[end] === '(') depth++;
            if (value[end] === ')') depth--;
            if (value[end] === ',' && depth === 1 && comma === -1) comma = end;
        }
        if (depth) return null;
        const name = value.slice(start + 4, comma === -1 ? end - 1 : comma).trim();
        if (!/^--[\w-]+$/.test(name) || chain.includes(name)) return null;
        const fallback = comma === -1 ? undefined : value.slice(comma + 1, end - 1).trim();
        const resolved = resolve?.(name)?.trim() || fallback;
        if (resolved === undefined) return null;
        const replacement = expandVariables(resolved, resolve, [...chain, name]);
        if (replacement === null) return null;
        value = value.slice(0, start) + replacement + value.slice(end);
        start = value.toLowerCase().indexOf('var(');
    }
    return value;
}

/** Pure parser. Unsupported or unresolved colors return null, never a guessed RGB. */
export function parseColor(input: string, resolve?: ColorVariableResolver): RgbaColor | null {
    if (typeof input !== 'string' || !input.trim()) return null;
    const expanded = expandVariables(input.trim(), resolve);
    if (expanded === null) return null;
    let color = expanded.toLowerCase().trim();
    // Legacy callers sometimes pass a bare variable containing RGB channels.
    if (/^var\(/i.test(input.trim()) && /^[\d.\s%/+-]+$/.test(color)) color = `rgb(${color})`;
    if (color === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (Object.prototype.hasOwnProperty.call(namedColors, color)) {
        const [r, g, b] = namedColors[color];
        return { r, g, b, a: 1 };
    }
    const hex = color.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/);
    if (hex) {
        const full = hex[1].length <= 4 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
        return {
            r: Number.parseInt(full.slice(0, 2), 16), g: Number.parseInt(full.slice(2, 4), 16),
            b: Number.parseInt(full.slice(4, 6), 16), a: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
        };
    }
    const fn = color.match(/^(rgba?|hsla?)\(([\s\S]*)\)$/);
    if (!fn) return null;
    const commaSyntax = fn[2].includes(',');
    if (commaSyntax && fn[2].includes('/')) return null;
    const pieces = commaSyntax ? fn[2].split(',').map(part => part.trim()) : fn[2].split('/');
    const values = commaSyntax ? pieces.slice(0, 3) : pieces[0].trim().split(/\s+/);
    if (values.length !== 3 || pieces.length > (commaSyntax ? 4 : 2)) return null;
    const alphaText = commaSyntax ? pieces[3] : pieces[1]?.trim();
    const a = alphaText === undefined ? 1 : channel(alphaText, 1);
    if (a === null) return null;
    if (fn[1].startsWith('rgb')) {
        const [r, g, b] = values.map(value => channel(value, 255));
        return r === null || g === null || b === null ? null : { r, g, b, a };
    }
    const hue = values[0].match(/^([+-]?(?:\d*\.\d+|\d+\.?\d*))(deg|turn|rad|grad)?$/);
    if (!hue || !values[1].endsWith('%') || !values[2].endsWith('%')) return null;
    const s = channel(values[1], 100);
    const l = channel(values[2], 100);
    if (s === null || l === null) return null;
    const units: Record<string, number> = { deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 };
    const unit = units[hue[2] || 'deg'];
    const degrees = Number(hue[1]) * unit;
    if (!Number.isFinite(degrees)) return null;
    const h = ((degrees % 360) + 360) % 360 / 30;
    const light = l / 100;
    const amplitude = s / 100 * Math.min(light, 1 - light);
    const rgb = (offset: number) => (light - amplitude * Math.max(-1, Math.min((offset + h) % 12 - 3, 9 - (offset + h) % 12, 1))) * 255;
    return { r: rgb(0), g: rgb(8), b: rgb(4), a };
}

function createVariableResolver(): ColorVariableResolver {
    let styles: CSSStyleDeclaration | undefined;
    return name => {
        if (typeof document === 'undefined') return undefined;
        styles ??= getComputedStyle(document.documentElement);
        return styles.getPropertyValue(name);
    };
}

/** One synchronous operation/render: at most one computed-style read, no persistent theme cache. */
export function createColorReader(): ColorReader {
    const parsed = new Map<string, RgbaColor | null>();
    const resolve = createVariableResolver();
    return color => {
        if (!parsed.has(color)) parsed.set(color, parseColor(color, resolve));
        return parsed.get(color)!;
    };
}

// Scalar ink/luminance calls do not allocate a per-render cache.
export const readColor: ColorReader = color => parseColor(color, /var\(/i.test(color) ? createVariableResolver() : undefined);
const formatNumber = (number: number) => String(Math.round(number * 1e6) / 1e6);
export const formatColor = ({ r, g, b, a }: RgbaColor): string =>
    `rgba(${formatNumber(r)}, ${formatNumber(g)}, ${formatNumber(b)}, ${formatNumber(a)})`;

/** Multiply opacity. Fixed player channels stay live without DOM reads; arbitrary
 * variables are resolved because their value may already contain an alpha channel. */
export function withColorOpacity(color: string, opacity: number): string | undefined {
    if (typeof color !== 'string' || !Number.isFinite(opacity)) return undefined;
    const variable = color.match(/^rgba?\(\s*(var\(\s*--c-p-[\w-]+\s*\))\s*(?:\/\s*([\d.]+%?))?\s*\)$/i);
    if (variable) {
        const alpha = variable[2] === undefined ? 1 : channel(variable[2], 1);
        return alpha === null ? undefined : `rgb(${variable[1]} / ${formatNumber(alpha * clamp(opacity))})`;
    }
    const parsed = readColor(color);
    return parsed ? formatColor({ ...parsed, a: parsed.a * clamp(opacity) }) : undefined;
}

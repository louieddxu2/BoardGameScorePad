// @ts-nocheck
import { describe, it, expect } from 'vitest';
import fs from 'fs';

/**
 * Token Integrity Check
 * ---------------------
 * Ensures every CSS variable referenced in tailwind.config.js
 * is defined in BOTH dark mode (:root) and light mode (html[data-theme='light'])
 * blocks of index.css.
 *
 * This prevents the "black button" bug where a semantic token is used
 * in a component but the underlying CSS variable doesn't exist,
 * causing rgb() to resolve to black.
 */

describe('Token Integrity: CSS Variable Completeness', () => {
    const tailwindConfig = fs.readFileSync('tailwind.config.js', 'utf-8');
    const indexCss = fs.readFileSync('src/index.css', 'utf-8');

    // Extract all --c-* variable names referenced in tailwind.config.js
    const referencedVariables = new Set<string>();
    const varRefRegex = /var\(--c-([\w-]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = varRefRegex.exec(tailwindConfig)) !== null) {
        referencedVariables.add(`--c-${match[1]}`);
    }

    // Split index.css into dark and light blocks
    const lightModeStart = indexCss.indexOf("html[data-theme='light']");
    const darkBlock = indexCss.slice(0, lightModeStart > 0 ? lightModeStart : indexCss.length);
    const lightBlock = lightModeStart > 0 ? indexCss.slice(lightModeStart) : '';

    // Extract variable definitions from each block
    const extractDefinedVars = (cssBlock: string): Set<string> => {
        const vars = new Set<string>();
        const defRegex = /(--c-[\w-]+)\s*:/g;
        let m: RegExpExecArray | null;
        while ((m = defRegex.exec(cssBlock)) !== null) {
            vars.add(m[1]);
        }
        return vars;
    };

    const darkVars = extractDefinedVars(darkBlock);
    const lightVars = extractDefinedVars(lightBlock);

    // Exclude primitive palette variables (defined once in :root, never change per theme)
    // These are the raw color scales like --c-slate-500, --c-emerald-400, etc.
    const primitivePattern = /^--c-(slate|emerald|indigo|sky|amber|yellow|red|white|black)-?\d*$/;

    const semanticVariables = [...referencedVariables].filter(v => !primitivePattern.test(v));

    semanticVariables.forEach(varName => {
        it(`${varName} should be defined in dark mode (:root)`, () => {
            // Check if defined directly OR via var() reference to a primitive
            const isDefined = darkVars.has(varName) || darkBlock.includes(`${varName}:`);
            expect(isDefined, `Missing in dark mode: ${varName}`).toBe(true);
        });

        it(`${varName} should be defined in light mode (html[data-theme='light'])`, () => {
            const isDefined = lightVars.has(varName) || lightBlock.includes(`${varName}:`);
            expect(isDefined, `Missing in light mode: ${varName}`).toBe(true);
        });
    });
});

import { describe, expect, it } from 'vitest';
import { inspectThemeContract } from '../../scripts/theme-contract';

const css = `
:root {
    --c-white: 255 255 255;
    --c-amber-900: 120 53 15;
    --c-txt-on-color: var(--c-white);
    --c-txt-primary: 248 250 252;
    --c-surface-bg-alt: 23 31 45;
}
html[data-theme='light'] {
    --c-txt-primary: 15 23 42;
    --c-surface-bg-alt: 248 250 252;
}`;
const config = { theme: { extend: { colors: {
    txt: { primary: 'rgb(var(--c-txt-primary) / <alpha-value>)', 'on-color': 'rgb(var(--c-txt-on-color) / <alpha-value>)' },
    surface: { alt: 'rgb(var(--c-surface-bg-alt) / <alpha-value>)' },
    amber: { 900: 'rgb(var(--c-amber-900) / <alpha-value>)' },
} } } };
const file = 'src/components/Example.tsx';
const inspect = (content: string, stylesheet = css) => inspectThemeContract(stylesheet, config, [{ file, content }]);

describe('Semantic theme contract', () => {
    it('accepts semantic roles, opacity modifiers and shared inherited constants', () => {
        expect(inspect('<div className="bg-surface-alt/50 text-txt-primary"><span className="text-txt-on-color" /></div>')).toEqual([]);
    });

    it('finds nonexistent utilities in template branches, even beside an old ignore marker', () => {
        const issues = inspect('const cls = `${selected ? "hover:bg-surface-recessed/50" : "bg-surface-alt"}`; // @ui-ignore');
        expect(issues).toEqual([{ file, line: 1, kind: 'unknown-color', token: 'bg-surface-recessed/50' }]);
    });

    it('keeps light mappings mandatory for theme-dependent roles instead of inheriting a dark surface', () => {
        expect(inspect('', css.replace('--c-surface-bg-alt: 248 250 252;', '')))
            .toContainEqual({ file: 'src/index.css', line: 1, kind: 'missing-light-mapping', token: 'surface-alt: --c-surface-bg-alt' });
    });

    it('finds component-only variables that were never registered with Tailwind', () => {
        expect(inspect('const style = { color: "rgb(var(--c-txt-on-dark))" };')).toEqual([
            { file, line: 1, kind: 'dark', token: 'undefined-variable: --c-txt-on-dark' },
            { file, line: 1, kind: 'light', token: 'undefined-variable: --c-txt-on-dark' },
        ]);
    });

    it('checks primitive definitions instead of skipping their entire palette', () => {
        expect(inspect('', css.replace('--c-amber-900: 120 53 15;', '')).map(issue => issue.token)).toEqual([
            'amber-900: undefined-variable: --c-amber-900', 'amber-900: undefined-variable: --c-amber-900',
        ]);
    });

    it('checks aliases and CSS property references against the effective light theme', () => {
        const issues = inspect('', css.replace('--c-surface-bg-alt: 248 250 252;', '--c-surface-bg-alt: var(--c-missing);')
            + '\n.panel { color: rgb(var(--c-css-only)); }');
        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ file: 'tailwind.config.js', kind: 'light', token: 'surface-alt: undefined-variable: --c-missing' }),
            expect.objectContaining({ file: 'src/index.css', kind: 'dark', token: 'undefined-variable: --c-css-only' }),
        ]));
    });

    it('rejects circular aliases without looping', () => {
        expect(inspect('', css.replace('--c-txt-primary: 248 250 252;', '--c-txt-primary: var(--c-txt-primary);')))
            .toContainEqual(expect.objectContaining({ kind: 'dark', token: 'variable-cycle: --c-txt-primary -> --c-txt-primary' }));
    });

    it('rejects embedded alpha when Tailwind already supplies the alpha', () => {
        expect(inspect('', css.replace('--c-surface-bg-alt: 248 250 252;', '--c-surface-bg-alt: 248 250 252 / 0.4;')))
            .toContainEqual({ file: 'tailwind.config.js', line: 1, kind: 'double-alpha', token: 'light: surface-alt' });
    });

    it.each([
        ['black/white utilities', '<div className="bg-black/20 text-white" />', ['bg-black/20', 'text-white']],
        ['palette utility', '<div className="hover:bg-slate-900" />', ['bg-slate-900']],
        ['literal color', 'const style = { color: "#fff" };', ['#fff']],
        ['inline primitive variable', 'const style = { color: "rgb(var(--c-white))" };', ['--c-white']],
    ])('rejects unreviewed fixed colors: %s', (_label, content, tokens) => {
        expect(inspect(content).map(issue => issue.token)).toEqual(tokens);
    });

    it('scopes exceptions by file and spelling without hiding unknown roles or variables', () => {
        const exceptions = [{ file, tokens: /^bg-white$/, reason: 'QR quiet zone.' }];
        const sources = [
            { file, content: '<div className="bg-white bg-surface-typo" style={{color:"var(--c-typo)"}} />' },
            { file: 'src/components/Other.tsx', content: '<div className="bg-white" />' },
        ];
        expect(inspectThemeContract(css, config, sources, exceptions)).toEqual(expect.arrayContaining([
            expect.objectContaining({ file, kind: 'unknown-color', token: 'bg-surface-typo' }),
            expect.objectContaining({ file, kind: 'dark', token: 'undefined-variable: --c-typo' }),
            expect.objectContaining({ file: 'src/components/Other.tsx', kind: 'fixed-color', token: 'bg-white' }),
        ]));
        expect(inspectThemeContract(css, config, [{ file, content: '<div className="bg-white" />' }], exceptions)).toEqual([]);
    });

    it('ignores comments instead of treating examples or commented definitions as code', () => {
        expect(inspect('// bg-black and var(--c-missing)\nconst cls = "text-txt-primary";')).toEqual([]);
        expect(inspect('', css.replace('--c-amber-900: 120 53 15;', '/* --c-amber-900: 120 53 15; */')))
            .toContainEqual(expect.objectContaining({ file: 'tailwind.config.js', token: 'amber-900: undefined-variable: --c-amber-900' }));
    });
});

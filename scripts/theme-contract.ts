import postcss from 'postcss';
import ts from 'typescript';

export type ThemeSource = { file: string; content: string };
export type ThemeIssue = { file: string; line: number; kind: string; token: string };
export type FixedColorException = { file: string; tokens: RegExp; reason: string };
type ColorTree = { [key: string]: string | ColorTree };
type ThemeConfig = { theme: { extend: { colors: ColorTree } } };

// This is a build-time contract, never imported by application code.
const palettes = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const utilityPattern = new RegExp(`\\b(bg|text|border(?:-[trblxy])?|ring(?:-offset)?|outline|shadow|divide|fill|stroke|from|via|to)-((?:app|surface|modal|txt|brand|status|input|keypad)-[a-z][\\w-]*|(?:${palettes})-\\d+|white|black)(/\\d+(?:\\.\\d+)?|/\\[[^\\]]+\\])?`, 'g');
const primitivePattern = new RegExp(`^(?:${palettes})-\\d+$|^(?:white|black)$`);
const variablePattern = /var\(\s*(--c-[\w-]+)/g;

function flattenColors(tree: ColorTree, prefix = '', result = new Map<string, string>()) {
    for (const [name, value] of Object.entries(tree)) {
        const key = name === 'DEFAULT' ? prefix : [prefix, name].filter(Boolean).join('-');
        if (typeof value === 'string') result.set(key, value);
        else flattenColors(value, key, result);
    }
    return result;
}

function references(value: string) {
    return [...value.matchAll(variablePattern)].map(match => match[1]);
}

export function inspectThemeContract(
    css: string,
    config: ThemeConfig,
    sources: ThemeSource[],
    exceptions: FixedColorException[] = [],
): ThemeIssue[] {
    const issues: ThemeIssue[] = [];
    const rootVars = new Map<string, string>();
    const lightVars = new Map<string, string>();
    let hasLightTheme = false;
    const styles = postcss.parse(css);
    styles.walkRules(rule => {
        const target = rule.selector === ':root' ? rootVars
            : /^html\[data-theme=['"]light['"]\]$/.test(rule.selector) ? lightVars : undefined;
        if (!target) return;
        if (target === lightVars) hasLightTheme = true;
        rule.walkDecls(declaration => {
            if (declaration.prop.startsWith('--')) target.set(declaration.prop, declaration.value);
        });
    });
    if (!hasLightTheme) issues.push({ file: 'src/index.css', line: 1, kind: 'missing-light-theme', token: 'light' });
    const themes = { dark: rootVars, light: new Map([...rootVars, ...lightVars]) };
    const colors = flattenColors(config.theme.extend.colors);
    // Keep the original guarantee for theme-dependent Tailwind roles. Only
    // primitives and the explicitly fixed on-color foreground inherit unchanged.
    for (const [color, value] of colors) {
        for (const token of references(value)) {
            if (!primitivePattern.test(token.slice('--c-'.length)) && token !== '--c-txt-on-color' && !lightVars.has(token)) {
                issues.push({ file: 'src/index.css', line: 1, kind: 'missing-light-mapping', token: `${color}: ${token}` });
            }
        }
    }

    function checkVariable(token: string, variables: Map<string, string>, chain: string[] = []): string | undefined {
        if (!variables.has(token)) return `undefined-variable: ${token}`;
        if (chain.includes(token)) return `variable-cycle: ${[...chain, token].join(' -> ')}`;
        for (const reference of references(variables.get(token)!)) {
            const problem = checkVariable(reference, variables, [...chain, token]);
            if (problem) return problem;
        }
    }

    for (const [theme, variables] of Object.entries(themes)) {
        // Validate primitive definitions too; aliases must eventually resolve to a real value.
        for (const [token] of variables) {
            const problem = checkVariable(token, variables);
            if (problem) issues.push({ file: 'src/index.css', line: 1, kind: theme, token: problem });
        }
        for (const [color, value] of colors) {
            for (const token of references(value)) {
                const problem = checkVariable(token, variables);
                if (problem) issues.push({ file: 'tailwind.config.js', line: 1, kind: theme, token: `${color}: ${problem}` });
                // Tailwind supplies the alpha separately; channels must not already contain one.
                let channels = variables.get(token) || '';
                const seen = new Set<string>();
                while (/^var\(--c-[\w-]+\)$/.test(channels) && !seen.has(channels)) {
                    seen.add(channels);
                    channels = variables.get(references(channels)[0]) || '';
                }
                if (value.includes('<alpha-value>') && channels.includes('/')) {
                    issues.push({ file: 'tailwind.config.js', line: 1, kind: 'double-alpha', token: `${theme}: ${color}` });
                }
            }
        }
    }

    for (const [theme, variables] of Object.entries(themes)) {
        styles.walkDecls(declaration => {
            // Custom properties were checked as an effective graph above. Only inspect
            // actual CSS uses here, and do not apply light-only rules to the dark theme.
            if (declaration.prop.startsWith('--')) return;
            let parent: postcss.AnyNode | undefined = declaration.parent;
            while (parent) {
                if (theme === 'dark' && parent.type === 'rule' && /data-theme=['"]light['"]/.test(parent.selector)) return;
                parent = parent.parent;
            }
            for (const token of references(declaration.value)) {
                const problem = checkVariable(token, variables);
                if (problem) issues.push({ file: 'src/index.css', line: declaration.source?.start?.line || 1, kind: theme, token: problem });
            }
        });
    }

    for (const source of sources) {
        const file = source.file.replace(/\\/g, '/');
        const syntax = ts.createSourceFile(file, source.content, ts.ScriptTarget.Latest, true,
            /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const allowFixed = (token: string) => exceptions.some(exception =>
            exception.file === file && exception.reason.trim() && new RegExp(exception.tokens.source).test(token));
        function add(node: ts.Node, kind: string, token: string) {
            const line = syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1;
            issues.push({ file, line, kind, token });
        }
        function inspect(node: ts.Node) {
            if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
                const text = node.text;
                for (const token of references(text)) {
                    for (const [theme, variables] of Object.entries(themes)) {
                        const problem = checkVariable(token, variables);
                        if (problem) add(node, theme, problem);
                    }
                }
                for (const match of text.matchAll(utilityPattern)) {
                    const [, , color] = match;
                    if (primitivePattern.test(color)) {
                        if (!allowFixed(match[0])) add(node, 'fixed-color', match[0]);
                    } else if (!colors.has(color)) add(node, 'unknown-color', match[0]);
                }
                // Raw UI colors are allowed only for documented media/contrast/brand uses.
                // Calculation utilities and static palettes are not theme surfaces.
                if (/\.[jt]sx$/.test(file)) {
                    const rawColors: string[] = text.match(/#[\da-fA-F]{3,8}\b|\brgba?\(\s*[\d.][^)]*\)/g) || [];
                    if (text === 'white' || text === 'black') rawColors.push(text);
                    for (const token of references(text)) {
                        if (primitivePattern.test(token.slice('--c-'.length))) rawColors.push(token);
                    }
                    for (const token of rawColors) if (!allowFixed(token)) add(node, 'fixed-color', token);
                }
            }
            ts.forEachChild(node, inspect);
        }
        inspect(syntax);
    }
    return issues;
}

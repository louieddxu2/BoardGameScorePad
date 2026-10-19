import fs from 'node:fs';
import path from 'node:path';
import config from '../tailwind.config.js';
import { inspectThemeContract } from './theme-contract.ts';
import { fixedColorExceptions } from './theme-color-exceptions.ts';

const sources = [];
function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            // Skip static datasets (including built-in scoreboards), translations and tests.
            if (!['data', 'i18n', 'test', '__tests__', '__fixtures__'].includes(entry.name)) visit(file);
        } else if (/\.[jt]sx?$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
            sources.push({ file: file.replaceAll('\\', '/'), content: fs.readFileSync(file, 'utf8') });
        }
    }
}
visit('src');
const issues = inspectThemeContract(fs.readFileSync('src/index.css', 'utf8'), config, sources, fixedColorExceptions);
if (issues.length) {
    for (const issue of issues) console.error(`${issue.file}:${issue.line} [${issue.kind}] ${issue.token}`);
    console.error(`Theme contract failed: ${issues.length} issue(s).`);
    process.exitCode = 1;
} else {
    console.log(`Theme contract passed: ${sources.length} production source files; dark/light tokens and UI colors checked.`);
}

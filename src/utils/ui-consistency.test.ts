// @ts-nocheck
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * UI Consistency Check Radar
 * -------------------------
 * This script scans components for hardcoded Tailwind color classes 
 * (e.g., bg-slate-900) that should be replaced with semantic tokens
 * (e.g., bg-modal-bg) to ensure theme compatibility.
 */

// Regex to detect direct palette color usage
const HARDCODED_COLOR_REGEX = /\b(bg|text|border|ring|shadow|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d+)\b/g;

const EXCLUDE_PATHS = [
    'index.css',
    'colors.ts',
    'ui-consistency.test.ts',
    path.join('data', ''), 
    'node_modules',
    'dist'
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith('.tsx')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

describe('UI Consistency: Semantic Color Check', () => {
    const files = getAllFiles('src');    
    files.forEach(file => {
        // Skip if path is in EXCLUDE_PATHS
        if (EXCLUDE_PATHS.some(p => file.includes(p))) return;

        it(`should not have hardcoded colors in ${file}`, () => {
            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            const violations: string[] = [];

            lines.forEach((line, index) => {
                // Ignore comments
                if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
                
                const matches = line.match(HARDCODED_COLOR_REGEX);
                if (matches) {
                    violations.push(`Line ${index + 1}: ${line.trim()} (Found: ${matches.join(', ')})`);
                }
            });

            if (violations.length > 0) {
                const message = `Found ${violations.length} hardcoded color(s) in ${file}:\n` + violations.join('\n');
                expect(violations.length, message).toBe(0);
            }
        });
    });
});

import { jest, describe, test, expect } from '@jest/globals';
import { ESLint } from 'eslint';
import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.vscode/**',
  '**/dist/**',
  '**/coverage/**',
  '**/server/admin/**',
  '**/package-lock.json',
];

describe('Project health checks', () => {
  jest.setTimeout(60_000);

  test('ESLint reports no errors (syntax included) across JS files', async () => {
    const patterns = ['**/*.{js,mjs,cjs}'];
    const paths = await fg(patterns, { cwd: ROOT, absolute: true, ignore: IGNORES });
    const eslint = new ESLint();
    const results = await eslint.lintFiles(paths);

    const errorCount = results.reduce((sum, r) => sum + (r.errorCount || 0), 0);
    const warnCount = results.reduce((sum, r) => sum + (r.warningCount || 0), 0);

    const formatter = await eslint.loadFormatter('stylish');
    const output = formatter.format(results);
    if (output) {
      // Log the report to aid debugging, but only once
      console.log(output);
    }

    expect(errorCount).toBe(0);

    // If you want to enforce zero warnings too, uncomment:
    // expect(warnCount).toBe(0);
  });

  test('All JSON files are valid JSON', async () => {
    const patterns = ['**/*.json'];
    const filePaths = await fg(patterns, { cwd: ROOT, absolute: true, ignore: IGNORES });
    const errors = [];

    for (const fp of filePaths) {
      try {
        const raw = await fs.readFile(fp, 'utf8');
        JSON.parse(raw);
      } catch (e) {
        errors.push({ file: fp, error: e.message });
      }
    }

    if (errors.length) {
      console.error('Invalid JSON files:', errors);
    }
    expect(errors.length).toBe(0);
  });
});

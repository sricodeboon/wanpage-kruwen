import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isStrict, goldenExitCode } from '../../tools/golden-policy.mjs';

describe('golden policy (strict only on linux)', () => {
  it('linux is strict; mac/windows warn-only unless --strict', () => {
    expect(isStrict([], 'linux')).toBe(true);
    expect(isStrict([], 'darwin')).toBe(false);
    expect(isStrict([], 'win32')).toBe(false);
    expect(isStrict(['--strict'], 'darwin')).toBe(true);
  });
  it('differences fail only when strict; render errors always fail', () => {
    expect(goldenExitCode({ failed: 3, errored: 0, strict: false })).toBe(0);
    expect(goldenExitCode({ failed: 3, errored: 0, strict: true })).toBe(1);
    expect(goldenExitCode({ failed: 0, errored: 1, strict: false })).toBe(1);
    expect(goldenExitCode({ failed: 0, errored: 0, strict: true })).toBe(0);
  });
  it('goldens-update workflow regenerates on ubuntu and uploads the expected images', () => {
    const y = readFileSync(new URL('../../.github/workflows/goldens-update.yml', import.meta.url), 'utf8');
    expect(y).toMatch(/workflow_dispatch/);
    expect(y).toMatch(/runs-on: ubuntu-latest/);
    expect(y).toMatch(/npm run goldens:update/);
    expect(y).toMatch(/tests\/golden\/expected/);
  });
});

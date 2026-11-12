import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

it('stamps export file names with the local calendar date, not the UTC date', () => {
  const moduleUrl = pathToFileURL(`${process.cwd()}/src/utils/localDate.ts`).href;
  // 01:30 on 12 November in Taipei is still 11 November in UTC.
  const script = `import {formatLocalDateStamp} from ${JSON.stringify(moduleUrl)};
    const d=new Date('2026-11-11T17:30:00Z');
    console.log(JSON.stringify([formatLocalDateStamp(d),formatLocalDateStamp(d,'')]));`;
  const output = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    env: { ...process.env, TZ: 'Asia/Taipei' }, encoding: 'utf8'
  });
  expect(JSON.parse(output)).toEqual(['2026-11-12', '20261112']);
});

import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

it('uses local calendar midnight across short and long DST days', () => {
  const moduleUrl = pathToFileURL(`${process.cwd()}/src/utils/historyDateFilter.ts`).href;
  const script = `import {resolveHistoryDateFilter} from ${JSON.stringify(moduleUrl)};
    const results=[{year:2026,month:3,day:8},{year:2026,month:11,day:1}].map(start=>{
      const b=resolveHistoryDateFilter({kind:'custom',precision:'day',start,end:start,range:false,startOpen:false,endOpen:false});
      return [new Date(b.start).getHours(),new Date(b.end).getHours(),(b.end-b.start)/3600000];
    });console.log(JSON.stringify(results));`;
  const output = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8'
  });
  expect(JSON.parse(output)).toEqual([[0, 0, 23], [0, 0, 25]]);
});

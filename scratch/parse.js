import fs from 'fs';
let content = fs.readFileSync('scratch/vitest_fail_json.json', 'utf8');
content = content.replace(/^\uFEFF/, '');
const data = JSON.parse(content);
data.testResults.forEach(tr => {
  tr.assertionResults.forEach(ar => {
    if (ar.status === 'failed') {
      console.log('========================================');
      console.log(ar.title || ar.fullName);
      console.log('----------------------------------------');
      console.log(ar.failureMessages.join('\n'));
    }
  });
});

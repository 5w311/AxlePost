// The workflow that makes every other test file matter. Not a test of
// GitHub: a check that CI still runs the WHOLE suite on pull requests. The
// failure mode isn't CI breaking loudly, it's someone narrowing it to one
// file, or to pushes only, and nobody noticing PRs stopped being checked.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const WF = path.join(__dirname, '..', '.github', 'workflows', 'tests.yml');
ok('the workflow exists', fs.existsSync(WF), WF);
if (!fs.existsSync(WF)) { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = 1; return; }
const wf = fs.readFileSync(WF, 'utf8');

console.log('\n=== it runs the whole suite, on pull requests ===');
ok('it runs test/run.js', /run:\s*node test\/run\.js/.test(wf));
ok('the WHOLE suite, not one file', !/node test\/[a-z-]+\.test\.js/.test(wf));
ok('it fires on pull requests', /^on:[\s\S]*?^\s{2}pull_request:/m.test(wf));
ok('and on pushes to main', /^\s{2}push:\s*\n\s+branches:\s*\[main\]/m.test(wf));

console.log('\n=== it stays a zero-dependency run ===');
ok('no npm install / npm ci step', !/npm (install|ci)\b/.test(wf));
ok('and no package.json alongside it', !fs.existsSync(path.join(__dirname, '..', 'package.json')));

console.log('\n=== the run cannot pass by doing nothing ===');
ok('it checks the repo out', /uses: actions\/checkout@v\d/.test(wf));
ok('it pins node rather than taking the runner default', /uses: actions\/setup-node@v\d/.test(wf) && /node-version:\s*'?22/.test(wf));
ok('it is bounded, so a hang fails', /timeout-minutes:\s*\d+/.test(wf));
ok('it asks for no more than read access', /permissions:\s*\n\s+contents:\s*read/.test(wf));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

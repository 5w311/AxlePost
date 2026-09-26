#!/usr/bin/env node
// Runs every test/*.test.js in its own process and reports a combined total.
// Counts PASS/FAIL lines as well as exit codes: a file that throws prints no
// FAIL line, so a crash is counted on its own and can never read as "0 failed".
//
// Usage: node test/run.js

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let totalPass = 0, totalFail = 0, hardFail = false, crashed = 0;

for (const f of files) {
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  } catch (err) {
    out = (err.stdout || '') + (err.stderr || '');
    code = err.status == null ? 1 : err.status;
  }
  const pass = (out.match(/^\s*PASS /gm) || []).length;
  const fail = (out.match(/^\s*FAIL /gm) || []).length;
  totalPass += pass;
  totalFail += fail;
  if (fail || code !== 0) hardFail = true;
  if (code !== 0 && fail === 0) crashed++;
  console.log(`${fail || code ? 'FAIL' : 'ok  '}  ${f.padEnd(24)} ${String(pass).padStart(3)} passed${fail ? `, ${fail} FAILED` : ''}${code ? ` (exit ${code})` : ''}`);
  if (fail || code) console.log(out.split('\n').filter(l => /FAIL|Error/.test(l)).map(l => '      ' + l).join('\n'));
}

console.log(`\n${files.length} files · ${totalPass} passed · ${totalFail} failed${crashed ? ` · ${crashed} CRASHED` : ''}`);
process.exit(hardFail ? 1 : 0);

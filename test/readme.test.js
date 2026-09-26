// The README is part of the release: the current version has an entry, the
// developer file list names every lib, and every KPRA state the app enforces
// is in the driver's table with the point it's measured to.
const fs = require('fs');
const path = require('path');
const { KPRA_STATES } = require('../lib/limits.js');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const ROOT = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appVersion = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];

const history = readme.split(/^# Version history$/m)[1] || '';
ok('there is a version history', history.length > 0);
ok(`it has an entry for v${appVersion}`, new RegExp(`^### v${appVersion.replace(/\./g, '\\.')}$`, 'm').test(history));
ok('the newest entry is the current version', (history.match(/^### v(\S+)$/m) || [])[1] === appVersion);

const dev = readme.split(/^# For developers$/m)[1] || '';
for (const f of fs.readdirSync(path.join(ROOT, 'lib')).filter(f => f.endsWith('.js'))) {
  ok(`the developer file list names lib/${f}`, dev.includes('lib/' + f));
}

const driver = readme.split(/^# For developers$/m)[0];
ok('the driver section uses no lib file names', !/lib\/|\.js\b/.test(driver));
for (const r of Object.values(KPRA_STATES)) {
  const row = driver.split('\n').find(l => l.startsWith('| ' + r.name + ' |')) || '';
  ok(`${r.name} is in the kingpin table`, row.length > 0);
  ok(`  at ${r.lim / 12} ft`, row.includes(`${r.lim / 12} ft`), row);
  ok(`  measured to the ${r.meas === 'rear' ? 'rearmost axle' : 'group center'}`,
     r.meas === 'rear' ? /rearmost axle/.test(row) : /center of the tandem group/.test(row), row);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

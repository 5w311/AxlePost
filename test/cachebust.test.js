// One version, everywhere it's written. APP_VERSION in index.html, every lib
// ?v= stamp, version.txt, and the service worker's cache name all move
// together, or a phone ends up running a build that exists in no commit:
// fresh HTML against a stale cached lib (GitHub Pages serves max-age=600).
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const appVersion = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok('APP_VERSION found in index.html', !!appVersion);
ok('APP_VERSION is a dotted version', /^\d+\.\d+\.\d+$/.test(appVersion || ''), appVersion);

const refs = [...html.matchAll(/src="(lib\/[a-z-]+\.js)(?:\?v=([^"]*))?"/g)].map(m => ({ path: m[1], v: m[2] }));
const libs = fs.readdirSync(path.join(ROOT, 'lib')).filter(f => f.endsWith('.js'));
// Count guard: if the load pattern changes and the regex stops matching, the
// per-ref checks below would pass on nothing.
ok(`every lib/*.js is loaded by index.html (${libs.length} files, ${refs.length} refs)`,
   refs.length === libs.length && libs.every(f => refs.some(r => r.path === 'lib/' + f)),
   JSON.stringify(refs.map(r => r.path)));
ok('every lib reference carries a ?v= stamp', refs.every(r => r.v), JSON.stringify(refs.filter(r => !r.v)));
ok(`every stamp equals APP_VERSION (${appVersion})`, refs.every(r => r.v === appVersion),
   JSON.stringify(refs.filter(r => r.v !== appVersion)));

const vfile = fs.readFileSync(path.join(ROOT, 'version.txt'), 'utf8');
ok('version.txt is one dotted version and nothing else', /^\d+\.\d+\.\d+\n?$/.test(vfile), JSON.stringify(vfile));
ok(`version.txt matches APP_VERSION (${appVersion})`, vfile.trim() === appVersion, vfile.trim());

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

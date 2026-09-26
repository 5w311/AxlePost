// The service worker is what makes the app open at a scale with no bars.
// It fails quietly: a stale cache name means phones never update, and a
// missing or misspelled asset means install fails and nothing is cached.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const appVersion = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];

console.log('\n=== the cache name moves with the version ===');
const cache = (sw.match(/const CACHE = "([^"]+)"/) || [])[1];
ok('CACHE found', !!cache);
ok(`CACHE names APP_VERSION (${appVersion})`, cache === 'axlepost-v' + appVersion, cache);

console.log('\n=== every asset is real, and every lib is cached as the page asks for it ===');
const block = (sw.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1] || '';
const assets = [...block.matchAll(/"([^"]+)"/g)].map(m => m[1]);
ok('ASSETS parsed', assets.length >= 5, assets.length);
for (const a of assets) {
  if (a === './') continue;
  const file = a.replace(/^\.\//, '').replace(/\?.*$/, '');
  ok(`${a} exists`, fs.existsSync(path.join(ROOT, file)));
}
const libRefs = [...html.matchAll(/src="(lib\/[a-z-]+\.js\?v=[^"]*)"/g)].map(m => './' + m[1]);
ok('the page loads at least one lib', libRefs.length > 0);
for (const r of libRefs) ok(`cached with its stamp: ${r}`, assets.includes(r));
ok('index.html and the root are both cached', assets.includes('./') && assets.includes('./index.html'));

console.log('\n=== the page registers it, and the manifest is whole ===');
ok('index.html registers ./sw.js', /serviceWorker\.register\(['"]\.\/sw\.js['"]/.test(html));
ok('  without the HTTP cache in the way', /updateViaCache:\s*['"]none['"]/.test(html));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
ok('manifest is linked', /<link rel="manifest" href="\.\/manifest\.webmanifest">/.test(html));
ok('manifest icons all exist', manifest.icons.every(i => fs.existsSync(path.join(ROOT, i.src.replace(/^\.\//, '')))));
ok('every manifest icon is cached', manifest.icons.every(i => assets.includes(i.src)));
ok('apple-touch-icon exists and is cached',
   fs.existsSync(path.join(ROOT, 'apple-touch-icon.png')) && assets.includes('./apple-touch-icon.png'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

// Things the page must never do, pinned against index.html's source.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('\n=== weights never persist ===');
// A saved ticket from yesterday reading LEGAL on today's open is the one
// screen this app must never show. Only the rig setup is stored.
const sets = [...html.matchAll(/localStorage\.setItem\(([^;]*)\)/g)].map(m => m[1]);
ok('exactly one place writes storage', sets.length === 1, sets.length);
ok('  and it writes the rig and nothing else', /JSON\.stringify\(st\.rig\)/.test(sets[0] || ''), sets[0]);
const defaults = (html.match(/const RIG_DEFAULTS = Object\.freeze\(\{([\s\S]*?)\}\);/) || [])[1] || '';
ok('RIG_DEFAULTS found', defaults.length > 0);
ok('  and holds no ticket weight', !/\b(steer|drive|tandem|gross)\s*:/.test(defaults), defaults);
ok('no sessionStorage or IndexedDB side door', !/sessionStorage|indexedDB/.test(html));
ok('the states on a load are not saved', !/states[^;\n]*setItem|setItem[^;\n]*states/.test(html));

console.log('\n=== nothing typed reaches markup ===');
// Every innerHTML is built from parsed numbers and lib constants. An input's
// .value inside one would be the first path for typed (or, once ticket
// import lands, PDF-sourced) text into markup.
const assigns = [...html.matchAll(/innerHTML\s*=([\s\S]*?);\n/g)].map(m => m[1]);
ok('innerHTML assignments found (the scan isn\'t vacuous)', assigns.length >= 8, assigns.length);
ok('none reads an input value', assigns.every(a => !/\.value\b/.test(a)),
   assigns.filter(a => /\.value\b/.test(a)).join('\n----\n'));
ok('weights go in through the parser, never raw',
   /st\.w\[k\] = Fmt\.parseWholeNumber\(el\.value\)/.test(html));

console.log('\n=== LEGAL has one door ===');
ok('"LEGAL — ROLL" is written in exactly one place', (html.match(/LEGAL (?:\u2014|\\u2014) ROLL/g) || []).length === 1);
ok('  and that place is the legal case', /case 'legal':\s*set\('legal', 'LEGAL (?:\u2014|\\u2014) ROLL'\)/.test(html));
ok('every slide answer says it is a prediction', /Predicted, not weighed\. Re-weigh before you roll\./.test(html));

console.log('\n=== a calibration is used once ===');
// A re-weigh pair left in the fields after it's applied gets offered again
// after the next hole change, labeled for the wrong hole. Found in the v0.1.0
// browser walkthrough before it shipped.
const applyBody = (html.match(/function applyCal\(\) \{([\s\S]*?)\n\}/) || [])[1] || '';
ok('applyCal found', applyBody.length > 0);
ok('  and it clears all three calibration fields',
   /\['c_t1', 'c_t2', 'c_moved'\]\.forEach\(id => \{ \$\(id\)\.value = ''; \}\)/.test(applyBody));
ok('  and drops the pending slide', /st\.rig\.pendingCal = null/.test(applyBody));

console.log('\n=== phones ===');
// iOS Safari zooms the whole page into any focused input under 16px.
const inputFonts = [...html.matchAll(/\.(?:wrow input|srow input,\.srow select)\{[^}]*font-size:(\d+)px/g)].map(m => +m[1]);
ok('input font sizes found', inputFonts.length === 2, inputFonts);
ok('no input under 16px', inputFonts.every(n => n >= 16), inputFonts);
ok('numeric keypad on every ticket field',
   ['steer', 'drive', 'tandem', 'gross'].every(k => new RegExp(`id="w_${k}" inputmode="numeric"`).test(html)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

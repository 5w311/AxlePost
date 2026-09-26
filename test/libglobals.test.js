// THE SHIM LEAKS. Every lib/*.js top-level name is a browser global.
//
// The libs are CommonJS so the same files run under node. The browser loads
// them as classic scripts through a three-line shim, and classic scripts share
// one global lexical scope: `const fmtLb` in a lib and `const fmtLb` in
// index.html is a redeclaration, and it kills the ENTIRE main script at parse
// time. Not the function, the whole page. The node suite can't see that,
// because nothing else here reads index.html the way a browser does.
// (FuelPost shipped exactly this in v2.0.0 with 1,383 assertions passing.)
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Comments and string/template contents blanked, newlines kept. A name inside
// a comment or a string is not a declaration.
function stripped(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } }
    else if (c === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const q = c; out += ' '; i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') { out += ' '; i++; }
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      out += ' '; i++;
    } else { out += c; i++; }
  }
  return out;
}

// Declarations at depth 0 — outside every (), [] and {}.
function topLevelNames(src) {
  const s = stripped(src), names = [];
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '(' || c === '[') { depth++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; continue; }
    if (depth !== 0) continue;
    if (i > 0 && /[\w$.]/.test(s[i - 1])) continue;
    const m = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/.exec(s.slice(i, i + 80));
    if (m) { names.push(m[1]); i += m[0].length - 1; }
  }
  return names;
}

console.log('\n=== what each lib puts in the global scope ===');
const libFiles = fs.readdirSync(path.join(ROOT, 'lib')).filter(f => f.endsWith('.js')).sort();
const owner = new Map();
for (const f of libFiles) {
  const names = topLevelNames(fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8'));
  ok(`${f} declares something (the scan isn't vacuous)`, names.length > 0);
  for (const n of names) {
    ok(`${n} is declared once across lib/`, !owner.has(n), `${f} and ${owner.get(n)}`);
    owner.set(n, f);
  }
}

console.log('\n=== nothing in the page redeclares a lib name ===');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = inline.find(s => /const APP_VERSION/.test(s));
ok('the main script was found', !!main);
const pageNames = inline.flatMap(topLevelNames);
ok('the page scan finds its own declarations (not vacuous)', pageNames.length >= 20, pageNames.length);
ok('the shim globals are seen', ['module', 'Limits', 'Slide', 'Fmt'].every(n => pageNames.includes(n)));
const clashes = pageNames.filter(n => owner.has(n));
ok('no page declaration collides with a lib global', clashes.length === 0,
   clashes.map(n => `${n} (lib/${owner.get(n)})`).join(', '));

console.log('\n=== lib scripts load as plain classic scripts ===');
// `defer` or `async` breaks the shim silently: the capture line after each
// lib runs before the lib does, and the page gets an empty module with no
// console error. type="module" breaks it outright.
const tags = [...html.matchAll(/<script[^>]*src="lib\/[^"]*"[^>]*>/g)].map(m => m[0]);
ok('lib script tags found', tags.length === libFiles.length, tags.length);
ok('no defer, async or type on a lib script', tags.every(t => !/\b(defer|async|type=)/.test(t)), tags.join(' '));
ok('each lib is followed by its capture line',
   libFiles.every(f => new RegExp(`src="lib/${f.replace('.', '\\.')}\\?v=[^"]*"></script>\\s*<script>var \\w+ = module\\.exports; module = \\{ exports: \\{\\} \\};</script>`).test(html)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

// The numbers the verdict is judged against, and where each one comes from.
const { AXLE_LIMITS, KPRA_STATES, kpraRuleFor } = require('../lib/limits.js');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

console.log('\n=== federal limits, 23 CFR 658.17 ===');
ok('gross 80,000 — (b)', AXLE_LIMITS.gross === 80000);
ok('tandem 34,000 — (d)', AXLE_LIMITS.tandem === 34000);
ok('drive tandem 34,000 — (d)', AXLE_LIMITS.drive === 34000);
ok('steer default 12,000, and it is a default, not a "limit"',
   AXLE_LIMITS.steerDefault === 12000 && !('steer' in AXLE_LIMITS));
ok('frozen', Object.isFrozen(AXLE_LIMITS));

console.log('\n=== KPRA rules ===');
const ca = KPRA_STATES.CA, fl = KPRA_STATES.FL;
ok('CA: 40 ft', ca.lim === 480);
ok('CA: measured to the REARMOST axle', ca.meas === 'rear');
ok('CA: cites 35401.5(a)(1)', /35401\.5\(a\)\(1\)/.test(ca.cite), ca.cite);
ok('FL: 41 ft', fl.lim === 492);
ok('FL: measured to the center of the rear axle GROUP', fl.meas === 'group');
ok('FL: cites 316.515(3)(b)2', /316\.515\(3\)\(b\)2/.test(fl.cite), fl.cite);
ok('both only cover trailers over 48 ft', ca.over === 48 && fl.over === 48);

console.log('\n=== every state row is complete ===');
// A state is added only with a primary cite, a measurement point, and the
// edition it was read from. A row missing any of them fails here.
for (const [code, r] of Object.entries(KPRA_STATES)) {
  ok(`${code}: keyed by its own code`, r.code === code);
  ok(`${code}: has a name`, typeof r.name === 'string' && r.name.length > 2);
  ok(`${code}: limit in inches, between 30 and 50 ft`, Number.isFinite(r.lim) && r.lim >= 360 && r.lim <= 600, r.lim);
  ok(`${code}: measurement point is rear or group`, r.meas === 'rear' || r.meas === 'group', r.meas);
  ok(`${code}: applies above a trailer length`, Number.isFinite(r.over));
  ok(`${code}: cites a statute`, typeof r.cite === 'string' && /§/.test(r.cite), r.cite);
  ok(`${code}: records the edition it was checked against`, typeof r.read === 'string' && /\d{4}/.test(r.read), r.read);
  ok(`${code}: frozen`, Object.isFrozen(r));
}
ok('the table itself is frozen', Object.isFrozen(KPRA_STATES));

console.log('\n=== lookup ===');
ok('known state', kpraRuleFor('CA') === ca);
ok('unknown state is null, not a default rule', kpraRuleFor('TX') === null);
ok('prototype keys are not states', kpraRuleFor('toString') === null && kpraRuleFor('__proto__') === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

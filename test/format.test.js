// What the driver reads. Rounding direction is a safety property here.
const F = require('../lib/format.js');
const { AXLE_LIMITS } = require('../lib/limits.js');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

console.log('\n=== pounds ===');
ok('commas', F.fmtLb(74340) === '74,340');
ok('rounds', F.fmtLb(1260.6) === '1,261');
ok('small', F.fmtLb(900) === '900');
ok('negative uses a real minus', F.fmtLb(-1400) === '−1,400');
ok('no region dependence: six digits', F.fmtLb(123456) === '123,456');

console.log('\n=== predicted pounds round UP to the 20 lb step ===');
ok('33,639 → 33,640', F.fmtPredictedLb(33639) === '33,640');
ok('a hair over 34,000 shows as over', F.fmtPredictedLb(34000.4) === '34,020');
ok('exactly 34,000 stays 34,000', F.fmtPredictedLb(34000) === '34,000');
// For every limit: anything over displays over; anything legal displays legal.
for (const lim of [AXLE_LIMITS.drive, AXLE_LIMITS.tandem, AXLE_LIMITS.steerDefault, AXLE_LIMITS.gross]) {
  const shown = x => parseInt(F.fmtPredictedLb(x).replace(/,/g, ''), 10);
  ok(`${lim}: over never displays as legal`, [lim + 0.01, lim + 1, lim + 19.9].every(x => shown(x) > lim));
  ok(`${lim}: legal never displays as over`, [lim, lim - 0.5, lim - 19].every(x => shown(x) <= lim));
}

console.log('\n=== lengths round UP to the inch ===');
ok('480 is 40\'0"', F.fmtFtIn(480) === "40'0\"");
ok('484.5 is 40\'5" (not 40\'4")', F.fmtFtIn(484.5) === "40'5\"");
ok('480.2 shows over 40 ft', F.fmtFtIn(480.2) === "40'1\"");
ok('460 is 38\'4"', F.fmtFtIn(460) === "38'4\"");
ok('float noise on a whole inch does not bump it', F.fmtFtIn(478.00000000000085) === "39'10\"");

console.log('\n=== parsing ===');
ok('commas and units', F.parseWholeNumber('74,340 LB') === 74340);
ok('blank is NaN', Number.isNaN(F.parseWholeNumber('')));
ok('letters only is NaN', Number.isNaN(F.parseWholeNumber('lb')));
ok('null is NaN', Number.isNaN(F.parseWholeNumber(null)));
ok('signed: minus survives', F.parseSignedWholeNumber('-3') === -3);
ok('signed: a typographic minus too', F.parseSignedWholeNumber('−2') === -2);
ok('signed: plain is positive', F.parseSignedWholeNumber('3') === 3);
ok('signed: blank is NaN', Number.isNaN(F.parseSignedWholeNumber('')));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

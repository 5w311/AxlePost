// The slide model: the beam, the verdict modes, and calibration.
const S = require('../lib/slide.js');
const { AXLE_LIMITS, KPRA_STATES } = require('../lib/limits.js');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const LIM = { steer: 12000, drive: AXLE_LIMITS.drive, tandem: AXLE_LIMITS.tandem, gross: AXLE_LIMITS.gross };
// A 53' van, pins in hole 5 of 12 on 6" centers, 460" (38'4") kingpin to tandem center.
const TR = Object.freeze({ hole: 5, holes: 12, spacing: 6, kpToHole1: 436, spread: 49, share: 0.96, lengthFt: 53 });
const W = (steer, drive, tandem, gross) => ({ steer, drive, tandem, gross });
const CA = [KPRA_STATES.CA], FL = [KPRA_STATES.FL];

// The real ticket this app was designed against: CAT scale, Wildwood GA, 6-20-26.
const TICKET = W(10740, 30600, 33000, 74340);

console.log('\n=== the beam: load weight and CG cancel out ===');
// Build a trailer from first principles (load W at distance a from the kingpin)
// and check T' = T·L/(L+Δ) against direct statics, for loads that differ.
for (const [Wt, a] of [[45000, 300], [38000, 280], [52000, 330]]) {
  const L = 460, d = 18;
  const T = Wt * a / L, Tdirect = Wt * a / (L + d);
  ok(`W=${Wt}, a=${a}: model matches statics after an 18" slide`, near(S.tandemAfterSlide(T, L, d), Tdirect));
  const kpBefore = Wt - T, kpAfter = Wt - Tdirect;
  ok(`  and the kingpin gains exactly what the tandems lose`, near(kpAfter - kpBefore, T - Tdirect));
}
ok('a forward slide (negative Δ) loads the tandems', S.tandemAfterSlide(33000, 460, -12) > 33000);
ok('no slide, no change', S.tandemAfterSlide(33000, 460, 0) === 33000);

console.log('\n=== the per-hole rate is not a constant ===');
const r1 = S.firstHoleTransfer(34900, 460, 6), r2 = S.firstHoleTransfer(34900, 520, 6);
ok('first hole off 34,900 at 460" is about 450 lb', near(r1, 34900 * 6 / 466, 1e-9) && r1 > 440 && r1 < 460, r1);
ok('the same hole at a longer lever moves less', r2 < r1, `${r2} vs ${r1}`);
ok('a lighter tandem moves less per hole (why rules of thumb scatter)',
   S.firstHoleTransfer(15000, 460, 6) < S.firstHoleTransfer(33000, 460, 6));

console.log('\n=== geometry ===');
ok('lever at the current hole is 460"', S.leverAtHole(TR, 5) === 460);
ok('each hole back adds one spacing', S.leverAtHole(TR, 8) === 478);
const here = S.predictAtHole(TICKET, TR, 5, LIM, []);
ok('predicting at the current hole returns the ticket unchanged',
   here.steer === 10740 && here.drive === 30600 && here.tandem === 33000, JSON.stringify(here));
const back3 = S.predictAtHole(TICKET, TR, 8, LIM, []);
const moved = TICKET.tandem - back3.tandem;
ok('drives pick up the share of what the tandems drop', near(back3.drive - TICKET.drive, moved * 0.96));
ok('steers pick up the rest', near(back3.steer - TICKET.steer, moved * 0.04));
ok('a slide never changes the total on the axles',
   near(back3.steer + back3.drive + back3.tandem, TICKET.steer + TICKET.drive + TICKET.tandem));
ok('KPRA to the rearmost axle adds half the spread', here.kpRear === 460 + 24.5);
ok('KPRA to the group center is the lever itself', here.kpGroup === 460);
ok('a lever under 10 ft is refused, not predicted',
   S.predictAtHole(TICKET, { ...TR, kpToHole1: 100, hole: 1 }, 1, LIM, []) === null);

console.log('\n=== KPRA: measurement point and trailer length matter ===');
const hCA = S.predictAtHole(TICKET, TR, 5, LIM, CA), hFL = S.predictAtHole(TICKET, TR, 5, LIM, FL);
ok('CA reads 484.5" (rearmost axle) and is over 480', hCA.kpra[0].value === 484.5 && !hCA.kpra[0].ok);
ok('FL reads 460" (group center) at the same hole and is under 492', hFL.kpra[0].value === 460 && hFL.kpra[0].ok);
ok('neither rule applies to a 48\' trailer',
   S.predictAtHole(TICKET, { ...TR, lengthFt: 48 }, 5, LIM, [...CA, ...FL]).kpra.length === 0);
ok('with both states tapped, both rules are checked',
   S.predictAtHole(TICKET, TR, 5, LIM, [...CA, ...FL]).kpra.length === 2);

console.log('\n=== the verdict, mode by mode ===');
const v = (w, tr = TR, rules = []) => S.analyzeTicket(w, tr, LIM, rules);
ok('idle while any weight is missing', v(W(10740, 30600, NaN, 74340)).mode === 'idle');
ok('idle on a zero', v(W(10740, 30600, 0, 74340)).mode === 'idle');
ok('the real ticket is legal, federal only', v(TICKET).mode === 'legal');
ok('the real ticket is legal in FL', v(TICKET, TR, FL).mode === 'legal');
ok('the real ticket is legal in CA on a 48\' trailer', v(TICKET, { ...TR, lengthFt: 48 }, CA).mode === 'legal');

const caFix = v(TICKET, TR, CA);
ok('the real ticket in CA: slide forward one hole for the kingpin law',
   caFix.mode === 'slide' && caFix.target.hole === 4 && caFix.fixesKpra && !caFix.fixesAxles, JSON.stringify(caFix.target));
ok('  and the forward slide keeps every axle legal', caFix.target.axlesOk);

const heavy = v(W(10740, 30600, 34900, 76240));
ok('tandems 900 over: slide back', heavy.mode === 'slide' && heavy.target.hole > TR.hole, heavy.mode);
ok('  to hole 8, three back', heavy.target && heavy.target.hole === 8, heavy.target && heavy.target.hole);
ok('  predicted tandems legal with room', heavy.target.tandem <= 34000 - S.SLIDE_PREFERRED_MARGIN_LB);
ok('  predicted drives legal', heavy.target.drive <= 34000);

const heavyDrive = v(W(10740, 34600, 32000, 77340));
ok('drives over: slide forward', heavyDrive.mode === 'slide' && heavyDrive.target.hole < TR.hole);

ok('gross over 80,000: no slide fix, with the excess',
   (a => a.mode === 'gross' && a.excess === 1400)(v(W(11200, 34800, 35400, 81400))));
const comb = v(W(10200, 34400, 34600, 79200));
ok('drives + tandems over 68,000: combined, not a slide', comb.mode === 'combined' && comb.excess === 1000, comb.mode);
ok('  with the steer room to fix it', comb.steerRoom === 1800);
ok('steers over at every hole: the fifth wheel', v(W(12600, 31000, 33000, 76600)).mode === 'steer');

const caBlock = v(W(10740, 30600, 34900, 76240), TR, CA);
ok('tandems heavy, CA tapped: every axle-legal hole breaks KPRA', caBlock.mode === 'kpra', caBlock.mode);
ok('  and it says how far the freight has to move, and which way',
   caBlock.shift && caBlock.shift.tandemLb > 0, JSON.stringify(caBlock.shift));

const railEnd = v(W(10740, 34600, 32000, 77340), { ...TR, hole: 1, kpToHole1: 460 });
ok('drives over with the pins already at the front: freight moves toward the doors',
   railEnd.mode === 'rework' && railEnd.shift && railEnd.shift.tandemLb < 0, JSON.stringify(railEnd.shift));

ok('a setup that can\'t be a trailer says so',
   v(TICKET, { ...TR, kpToHole1: 50, hole: 1 }).mode === 'setup');

console.log('\n=== picking the hole ===');
const pos = [
  { hole: 6, ok: true, margin: 40 }, { hole: 7, ok: true, margin: 400 },
  { hole: 4, ok: true, margin: 300 }, { hole: 5, ok: true, margin: 900 }
];
ok('never "slide to where you already are"', S.pickSlideTarget(pos, 5).hole !== 5);
ok('a comfortable hole beats a nearer one that squeaks by', S.pickSlideTarget(pos, 5).hole === 4);
ok('with nothing comfortable, the nearest legal hole',
   S.pickSlideTarget([{ hole: 6, ok: true, margin: 40 }, { hole: 8, ok: true, margin: 90 }], 5).hole === 6);
ok('no legal hole, no target', S.pickSlideTarget([{ hole: 6, ok: false, margin: -10 }], 5) === null);

console.log('\n=== axle status bands ===');
ok('over is over', S.axleStatus(34020, 34000) === 'over');
ok('exactly at the limit is legal (tight)', S.axleStatus(34000, 34000) === 'tight');
ok('within 500 is tight', S.axleStatus(33500, 34000) === 'tight');
ok('more than 500 under is ok', S.axleStatus(33480, 34000) === 'ok');

console.log('\n=== calibration from a re-weigh ===');
const T1 = 34900, T2 = 34900 * 460 / 478;       // truth: 460" before, 3 holes back
const cal = S.calibrateFromReweigh(T1, T2, 3, 6);
ok('recovers the lever where the pins are NOW (478")', cal.ok && near(cal.leverNow, 478, 1e-6), JSON.stringify(cal));
ok('  and where they were (460")', near(cal.leverBefore, 460, 1e-6));
const calF = S.calibrateFromReweigh(T2, T1, -3, 6);
ok('a forward slide works the same way (minus holes)', calF.ok && near(calF.leverNow, 460, 1e-6), JSON.stringify(calF));
ok('round trip: the prediction at the calibrated lever reproduces the re-weigh',
   near(S.tandemAfterSlide(T1, cal.leverBefore, 18), T2, 1e-6));
ok('back but the tandems got heavier: refused', S.calibrateFromReweigh(34900, 35500, 3, 6).reason === 'direction');
ok('same reading twice: refused', S.calibrateFromReweigh(34900, 34900, 3, 6).reason === 'direction');
ok('zero holes: nothing to calibrate', S.calibrateFromReweigh(34900, 33600, 0, 6).reason === 'incomplete');
ok('a typo that implies a 90-foot trailer: refused', S.calibrateFromReweigh(34900, 34800, 3, 6).reason === 'range');
ok('blank fields: incomplete', S.calibrateFromReweigh(NaN, 33600, 3, 6).reason === 'incomplete');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

// The slide model and the verdict built on it. Pure functions: no DOM, no
// network, no storage. index.html and the tests call the same code.
//
// THE MODEL
// The trailer is a beam on two supports, the kingpin and the tandems. With
// L = kingpin to tandem center and a = kingpin to the cargo's center of
// gravity, statics gives T = W·a/L. Slide the tandems back by Δ: L grows,
// W and a don't move, so
//
//     T' = T · L / (L + Δ)
//
// W and a cancel out. The tandem reading on the ticket and L are the only
// inputs. The load's weight and where it sits never have to be known.
//
// Whatever leaves the tandems lands on the kingpin, and the fifth wheel splits
// it between drives and steers. `share` is the drives' part, about 0.96 on a
// typical fifth-wheel setting. That's the "tandems don't touch the steers"
// rule of thumb, and it's about 96% true.
//
// Every top-level name in lib/ is a browser global (test/libglobals.test.js),
// so names here are specific on purpose.

const SLIDE_MIN_LEVER_IN = 120;          // shorter than 10 ft is not a semitrailer
const SLIDE_TIGHT_LB = 500;              // within this of a limit reads amber
const SLIDE_PREFERRED_MARGIN_LB = 250;   // prefer a hole predicted at least this far under
const SLIDE_CAL_MIN_IN = 240;            // 20 ft — a calibration outside 20–50 ft
const SLIDE_CAL_MAX_IN = 600;            // 50 ft — is a typo, not a trailer
const SLIDE_SHIFT_STEP_LB = 100;
const SLIDE_SHIFT_MAX_LB = 8000;

// ---- geometry --------------------------------------------------------------

// Kingpin to tandem center with the pins in `hole`. Holes count from the front
// of the rail, so a bigger number is further back and a longer lever.
function leverAtHole(trailer, hole) {
  return trailer.kpToHole1 + (hole - 1) * trailer.spacing;
}

// T' = T·L/(L+Δ). Exact under the beam model; Δ may be negative (forward).
function tandemAfterSlide(tandem, lever, delta) {
  return tandem * lever / (lever + delta);
}

// Pounds the first hole back takes off the tandems. Not a constant: it falls
// as the lever grows, which is why a flat "400 a hole" drifts on long moves.
function firstHoleTransfer(tandem, lever, spacing) {
  return tandem * spacing / (lever + spacing);
}

// ---- one hole --------------------------------------------------------------

function kpraApplies(rule, trailer) {
  return trailer.lengthFt > rule.over;
}

// Every axle group, and every KPRA rule in force, with the tandems at `hole`,
// predicted from a ticket weighed with them at trailer.hole.
function predictAtHole(weights, trailer, hole, limits, rules) {
  const L = leverAtHole(trailer, trailer.hole);
  const L2 = leverAtHole(trailer, hole);
  if (!(L >= SLIDE_MIN_LEVER_IN) || !(L2 >= SLIDE_MIN_LEVER_IN)) return null;

  const tandem = tandemAfterSlide(weights.tandem, L, L2 - L);
  const moved = weights.tandem - tandem;          // + sliding back: off the tandems
  const drive = weights.drive + moved * trailer.share;
  const steer = weights.steer + moved * (1 - trailer.share);

  const kpRear = L2 + trailer.spread / 2;         // to the rearmost axle
  const kpGroup = L2;                             // to the center of the group
  const kpra = (rules || []).filter(r => kpraApplies(r, trailer)).map(r => {
    const value = r.meas === 'rear' ? kpRear : kpGroup;
    return { code: r.code, name: r.name, lim: r.lim, meas: r.meas, value, ok: value <= r.lim };
  });

  const axlesOk = steer <= limits.steer && drive <= limits.drive && tandem <= limits.tandem;
  const kpraOk = kpra.every(k => k.ok);
  const margin = Math.min(limits.steer - steer, limits.drive - drive, limits.tandem - tandem);
  return { hole, lever: L2, steer, drive, tandem, kpRear, kpGroup, kpra,
           margin, axlesOk, kpraOk, ok: axlesOk && kpraOk };
}

function positionsAlongRail(weights, trailer, limits, rules) {
  const out = [];
  for (let h = 1; h <= trailer.holes; h++) {
    const p = predictAtHole(weights, trailer, h, limits, rules);
    if (p) out.push(p);
  }
  return out;
}

// The nearest legal hole to where the pins are now. A hole predicted at least
// SLIDE_PREFERRED_MARGIN_LB under beats a nearer one that squeaks by — the
// prediction is a model, and a re-weigh that fails by 40 lb costs another
// trip across the scale. Ties go to the bigger margin.
function pickSlideTarget(positions, currentHole) {
  const legal = positions.filter(p => p.ok && p.hole !== currentHole);
  if (!legal.length) return null;
  const comfy = legal.filter(p => p.margin >= SLIDE_PREFERRED_MARGIN_LB);
  const pool = comfy.length ? comfy : legal;
  return pool.slice().sort((a, b) =>
    Math.abs(a.hole - currentHole) - Math.abs(b.hole - currentHole) || b.margin - a.margin)[0];
}

// ---- when the rail can't fix it ---------------------------------------------

// How far the freight has to move before some hole works, stated as what the
// scale will show: pounds off the tandems (positive — freight toward the nose)
// or onto them (negative — toward the doors). That is the number a driver can
// hand the dock and then check on the re-weigh; the pallet weight it takes
// depends on how far the pallets move, which the app doesn't know.
function freightShiftNeeded(weights, trailer, limits, rules) {
  for (let mag = SLIDE_SHIFT_STEP_LB; mag <= SLIDE_SHIFT_MAX_LB; mag += SLIDE_SHIFT_STEP_LB) {
    for (const x of [mag, -mag]) {
      const shifted = {
        steer: weights.steer + x * (1 - trailer.share),
        drive: weights.drive + x * trailer.share,
        tandem: weights.tandem - x,
        gross: weights.gross
      };
      const list = positionsAlongRail(shifted, trailer, limits, rules);
      const stay = list.find(p => p.ok && p.hole === trailer.hole);
      const target = stay || pickSlideTarget(list, trailer.hole);
      if (target) return { tandemLb: x, driveLb: x * trailer.share, hole: target.hole };
    }
  }
  return null;
}

// ---- the verdict -----------------------------------------------------------

function axleStatus(weight, limit) {
  if (weight > limit) return 'over';
  if (limit - weight <= SLIDE_TIGHT_LB) return 'tight';
  return 'ok';
}

function weightsComplete(w) {
  return !!w && ['steer', 'drive', 'tandem', 'gross'].every(k => Number.isFinite(w[k]) && w[k] > 0);
}

// One ticket in, one verdict out. `mode` is exactly one of:
//   idle      a weight is missing
//   setup     the trailer setup can't describe a real trailer
//   legal     legal as weighed, on every rule in force
//   slide     a hole on the rail fixes it — `target`
//   gross     over 80,000; nothing on the truck moves that
//   combined  drives + tandems over their joint 68,000; a slide only trades
//   steer     steers over at every hole; that's the fifth wheel, not the tandems
//   kpra      holes that clear the axles all break a KPRA rule in force
//   rework    no hole works; the freight has to move
function analyzeTicket(weights, trailer, limits, rules) {
  if (!weightsComplete(weights)) return { mode: 'idle' };
  const status = {
    steer: axleStatus(weights.steer, limits.steer),
    drive: axleStatus(weights.drive, limits.drive),
    tandem: axleStatus(weights.tandem, limits.tandem),
    gross: axleStatus(weights.gross, limits.gross)
  };
  const here = predictAtHole(weights, trailer, trailer.hole, limits, rules);
  if (!here) return { mode: 'setup', status };

  if (weights.gross > limits.gross) {
    return { mode: 'gross', status, here, excess: weights.gross - limits.gross };
  }

  const positions = positionsAlongRail(weights, trailer, limits, rules);
  if (here.ok) return { mode: 'legal', status, here, positions };

  const target = pickSlideTarget(positions, trailer.hole);
  if (target) {
    return { mode: 'slide', status, here, positions, target,
             fixesAxles: !here.axlesOk, fixesKpra: !here.kpraOk };
  }

  const joint = limits.drive + limits.tandem;
  if (positions.every(p => p.drive + p.tandem > joint)) {
    return { mode: 'combined', status, here, positions,
             excess: weights.drive + weights.tandem - joint,
             steerRoom: Math.max(0, limits.steer - weights.steer) };
  }
  if (positions.every(p => p.steer > limits.steer)) {
    return { mode: 'steer', status, here, positions, excess: weights.steer - limits.steer };
  }
  const shift = freightShiftNeeded(weights, trailer, limits, rules);
  const mode = positions.some(p => p.axlesOk) ? 'kpra' : 'rework';
  return { mode, status, here, positions, shift };
}

// ---- calibration -----------------------------------------------------------

// Two weighs with a known slide between them give the lever exactly — no
// tape measure. From T' = T·L/(L+Δ), the lever where the pins sit NOW (at
// the re-weigh) is
//
//     L + Δ = Δ · T / (T − T')
//
// `holesMovedBack` is negative for a slide forward. Returns the lever at both
// positions; the app applies `leverNow` to the hole the pins are in now.
function calibrateFromReweigh(t1, t2, holesMovedBack, spacing) {
  if (![t1, t2, holesMovedBack, spacing].every(Number.isFinite) ||
      t1 <= 0 || t2 <= 0 || spacing <= 0 || holesMovedBack === 0) {
    return { ok: false, reason: 'incomplete' };
  }
  const delta = holesMovedBack * spacing;
  // Back always lightens the tandems and forward always loads them. Anything
  // else is a mixed-up ticket or a miscounted direction, not a trailer.
  if (t1 === t2 || Math.sign(t1 - t2) !== Math.sign(delta)) {
    return { ok: false, reason: 'direction' };
  }
  const leverNow = delta * t1 / (t1 - t2);
  if (!(leverNow >= SLIDE_CAL_MIN_IN && leverNow <= SLIDE_CAL_MAX_IN)) {
    return { ok: false, reason: 'range', leverNow };
  }
  return { ok: true, leverNow, leverBefore: leverNow - delta };
}

module.exports = {
  SLIDE_MIN_LEVER_IN, SLIDE_TIGHT_LB, SLIDE_PREFERRED_MARGIN_LB,
  SLIDE_CAL_MIN_IN, SLIDE_CAL_MAX_IN, SLIDE_SHIFT_STEP_LB, SLIDE_SHIFT_MAX_LB,
  leverAtHole, tandemAfterSlide, firstHoleTransfer, kpraApplies,
  predictAtHole, positionsAlongRail, pickSlideTarget, freightShiftNeeded,
  axleStatus, weightsComplete, analyzeTicket, calibrateFromReweigh
};

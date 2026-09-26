// Weight and kingpin limits, each with the rule it comes from. Data only —
// no DOM, no logic beyond a lookup.
//
// Every top-level name in lib/ is a browser global (see test/libglobals.test.js),
// so names here are specific on purpose.

// 23 CFR 658.17, Interstate System:
//   (b) 80,000 lb gross   (c) 20,000 lb any one axle   (d) 34,000 lb tandem
//
// The steer axle is NOT a federal number. 12,000 is a common front-axle
// rating, and it's what most drivers work to, but the real ceiling is the
// truck's front GAWR (door-jamb sticker) and its tire load rating. So it is a
// driver setting with this as the default; drive, tandem and gross are fixed.
const AXLE_LIMITS = Object.freeze({
  steerDefault: 12000,
  drive: 34000,
  tandem: 34000,
  gross: 80000
});

// Kingpin-to-rear-axle (KPRA) limits, by state.
//
//   lim   inches
//   meas  'rear'  — kingpin to the center of the REARMOST axle
//         'group' — kingpin to the center of the rear axle GROUP
//   over  the rule only applies to semitrailers longer than this, in feet
//   cite  the section the number comes from
//   read  which edition of the text it was checked against
//
// The measurement point is not a detail. On a 49-inch tandem the two methods
// differ by about two feet, so the same trailer can be over in California and
// comfortably legal in Florida at the same hole.
//
// A state goes in only with its primary citation and measurement point checked
// against the statute text. No forum posts, no secondary summaries.
const KPRA_STATES = Object.freeze({
  CA: Object.freeze({
    code: 'CA', name: 'California', lim: 480, meas: 'rear', over: 48,
    cite: 'Cal. Veh. Code § 35401.5(a)(1)', read: '2025 code'
    // "A semitrailer not more than 53 feet in length shall satisfy this
    //  requirement when configured with two or more rear axles, the rearmost
    //  of which is located 40 feet or less from the kingpin"
  }),
  FL: Object.freeze({
    code: 'FL', name: 'Florida', lim: 492, meas: 'group', over: 48,
    cite: 'Fla. Stat. § 316.515(3)(b)2.a', read: '2025 statutes'
    // "The distance between the kingpin or other peg that locks into the fifth
    //  wheel of a truck tractor and the center of the rear axle or rear group
    //  of axles does not exceed 41 feet"
  })
});

function kpraRuleFor(code) {
  return Object.prototype.hasOwnProperty.call(KPRA_STATES, code) ? KPRA_STATES[code] : null;
}

module.exports = { AXLE_LIMITS, KPRA_STATES, kpraRuleFor };

// Number formatting and parsing for the screen. No DOM.
//
// Every top-level name in lib/ is a browser global (test/libglobals.test.js),
// so names here are specific on purpose.

// 74340 → "74,340". Done by hand rather than toLocaleString so the output
// never depends on the phone's region settings.
function fmtLb(n) {
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return r < 0 ? '−' + s : s;
}

// A predicted weight, rounded UP to the scale's 20 lb step. Up, never to
// nearest: every limit is a multiple of 20, so rounding up keeps "over" on
// screen for anything that is over, and never shows a heavier axle as lighter.
function fmtPredictedLb(n) {
  return fmtLb(Math.ceil(n / 20 - 1e-9) * 20);
}

// 484.5 → 40'5". Rounded UP to the whole inch, never to nearest: a length
// shown shorter than it is could read legal when it isn't (same rule as
// 23 CFR 658.15). The legality check itself uses the unrounded value.
function fmtFtIn(inches) {
  const whole = Math.ceil(inches - 1e-9);
  return Math.floor(whole / 12) + "'" + (whole % 12) + '"';
}

// "74,340 lb" → 74340. Anything without a digit → NaN.
function parseWholeNumber(text) {
  const digits = String(text == null ? '' : text).replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : NaN;
}

// Like parseWholeNumber, but a leading minus survives — for "holes moved",
// where negative means forward.
function parseSignedWholeNumber(text) {
  const s = String(text == null ? '' : text).trim();
  const n = parseWholeNumber(s);
  return /^[-−]/.test(s) ? -n : n;
}

module.exports = { fmtLb, fmtPredictedLb, fmtFtIn, parseWholeNumber, parseSignedWholeNumber };

# AxlePost

A single-page tandem-slide and axle-weight calculator for truck drivers. See
`README.md` for what it does and how it works.

## Before changing the README

Read **For developers → Updating this README** in `README.md`. It's written for
a driver, not a developer: the plain-language guide comes first with no code
identifiers in it, and all technical detail sits in the developer section.

## Before changing behaviour

Read **For developers → Things not to undo** in `README.md` first. The model in
`lib/slide.js` is exact under its assumptions; a change there needs a test that
checks it against direct statics, not just against the old output.

## Adding a KPRA state

Primary statute text only, cited, with the measurement point (rearmost axle or
group center) and the edition read. See **Adding a KPRA state** in the README.

## Shipping

`node test/run.js` must be green. Bump `APP_VERSION`, every lib `?v=` stamp in
`index.html` and in `sw.js` `ASSETS`, the `sw.js` `CACHE` name, and `version.txt`
together, and add a version-history entry. Tests enforce all of it. Logic, limit
or storage changes go through a PR; cosmetic changes may merge direct.

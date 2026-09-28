# AxlePost

**Scale ticket in, slide answer out.**

Type the four weights off your CAT ticket. AxlePost tells you if you're legal,
and if you're not, how many holes to slide the tandems and which way, or that
no slide will fix it and what has to happen instead.

It's a web page, not an app store download. Add it to your home screen and it
works at the scale with no signal.

---

# Using it

## Enter the ticket

Steer, drive, trailer, gross, in the order they're printed. The app checks that
the three axle groups add up to the gross, so a typo gets caught before you act
on it.

Every group gets a bar and the pounds you have left. Green means legal with
room, amber means legal but within 500 lb, red means over.

## If you're over

**A slide fixes it.** You get the direction and the number of holes, plus what
each axle group should weigh after. The predicted numbers matter more than the
instruction: they're how you decide whether pulling the pins is worth it.

The rate isn't a flat 400 a hole. It depends on how heavy the tandems are and
how far back they already sit, and it gets smaller every hole you go back. The
app works it out for your load.

**Predicted isn't weighed.** Re-weigh before you roll.

**No slide fixes it.** The app tells you which kind of problem it is:

- **Over gross.** Weight has to come off the truck. Sliding only moves weight
  between axles.
- **Drives and tandems both heavy.** Together they're over 68,000. A slide
  just trades weight between them. It has to go to the steers (fifth wheel) or
  off the truck.
- **Steers over.** A tandem slide barely touches the steers. That's the fifth
  wheel.
- **No hole works.** The freight has to move inside the trailer. The app tells
  you which way and roughly how many pounds the tandems need to gain or lose,
  which is the number to take to the dock and the one to check on the re-weigh.

## Kingpin law

Tap every state the load runs in. The app checks the kingpin-to-rear-axle
distance at every hole and won't send you to one that breaks it.

| State | Limit | Measured to |
|---|---|---|
| California | 40 ft | the **rearmost axle** |
| Florida | 41 ft | the **center of the tandem group** |

Those measure to different points. On a standard tandem that's about a two-foot
difference, so the same trailer at the same hole can be over in California and
legal in Florida. Both rules only apply to trailers over 48 ft.

Other states aren't loaded yet. A state only goes in once its statute has been
read and cited.

## Rig setup

Set it once per trailer. It's remembered; your ticket weights never are.

- **Pins in hole.** Count from the front of the rail. After you slide, change
  it, and the kingpin distance moves with it.
- **Kingpin to tandem center.** The one number that matters for the math. You
  can tape it, or let the app work it out (below).
- **Steer limit.** 12,000 is a common front-axle rating, not a federal limit.
  Use the rating on your door sticker.

## Let it measure your trailer

When the app tells you to slide, tap **Slid it** after you pull the pins. Then
re-weigh and enter the new ticket. Comparing the two tandem readings gives your
exact kingpin-to-tandem distance, with no tape measure. Tap **Use this distance**
and every answer after that is for your trailer, not a guess.

You can also enter any before-and-after pair by hand under **Calibrate from a
re-weigh**.

## What it doesn't do

- It doesn't read the ticket for you yet. You type four numbers.
- It doesn't check bridge-formula spacing, permits, or any state kingpin law
  besides the two above.
- It isn't a scale. The ticket is the only answer that counts.

---

# For developers

Everything below is implementation detail.

```
index.html            markup, styles, all DOM wiring and state
lib/slide.js          the beam model, the verdict, calibration
lib/limits.js         federal limits + per-state KPRA rules, with citations
lib/format.js         pounds, feet-and-inches, input parsing
sw.js                 service worker: cache-first, offline shell
manifest.webmanifest  home-screen install
icon-*.png            app icons (full-bleed, opaque, as iOS requires)
apple-touch-icon.png  iOS home-screen icon
version.txt           the version, alone, for update checks
design/prototype.html the approved prototype; not shipped (not in sw.js)
test/*.test.js        plain-node tests · test/run.js runs them all
.nojekyll             GitHub Pages serves files as-is; don't delete
```

No build step, no framework, no dependencies. `lib/` is CommonJS so
`node test/run.js` runs under plain Node 22 with no install. The page loads the
same files as classic scripts behind a three-line `module.exports` shim. CI runs
the whole suite on every PR and every push to main.

## The model

The trailer is a beam on two supports, the kingpin and the tandems. With `L` =
kingpin to tandem center, sliding back by `Δ` gives

```
T' = T · L / (L + Δ)
```

The load's weight and center of gravity cancel out. The ticket's tandem reading
and `L` are the only inputs. Whatever leaves the tandems goes onto the kingpin
and splits by `share` (default 0.96) to the drives, with the rest to the steers.

Calibration inverts the same equation. Two weighs with a known slide `Δ` between
them give the lever where the pins are now:

```
L + Δ = Δ · T / (T − T')
```

Trailer geometry is stored as `kpToHole1`, the lever at the front hole. The
driver enters the distance at the current hole and the app converts it. Changing
the hole moves the lever; changing the hole spacing keeps the measured distance.

## Adding a KPRA state

One entry in `KPRA_STATES` in `lib/limits.js`: the limit in inches, the
measurement point (`rear` or `group`), the trailer length it applies above, the
citation, and the edition it was read from. `test/limits.test.js` fails any row
missing one. The chip, the checks and the verdict all come from the table.
Primary statute text only, never a forum or a summary. Add the state to the
table in **Kingpin law** above.

## Things not to undo

- **Ticket weights never persist.** Only `st.rig` is written to storage. A saved
  ticket from yesterday showing LEGAL on today's open is the one screen this app
  must never show. The states on a load don't persist either.
  `test/invariants.test.js` pins both.
- **Nothing typed reaches `innerHTML`.** Every value in markup is a parsed
  number or a `lib/limits.js` constant. Ticket import will bring PDF text in,
  and that text goes through `textContent` or an escape. Pinned.
- **Rounding goes up, never to nearest.** Predicted pounds round up to the
  scale's 20 lb step and lengths round up to the inch, so nothing over ever
  displays as legal. Every limit is a multiple of 20, so legal never displays
  as over either. The checks themselves use unrounded values.
- **The measurement point is per state.** California measures to the rearmost
  axle, Florida to the group center. Collapsing them into one "KPRA" number is
  about a two-foot error.
- **Steer is a setting, not a law.** 23 CFR 658.17 sets 20,000 single, 34,000
  tandem and 80,000 gross. 12,000 on the steers is an axle rating.
- **A comfortable hole beats a nearer one that squeaks by.** The target is the
  nearest hole predicted at least 250 lb under, falling back to the nearest
  legal one. A re-weigh that fails by 40 lb costs another trip across the scale.
- **Calibration applies the lever where the pins are NOW.** The prototype
  applied the first-weigh lever at the re-weigh position, an error of one full
  slide. And a pair is used once: applying it clears the fields, or the next
  hole change offers it again labeled for the wrong hole.
- **No `defer` or `async` on lib scripts.** The capture line after each lib
  would run first, and the page gets an empty module with no console error.
  `test/libglobals.test.js` checks the tags and that no page name collides with
  a lib global.
- **No input under 16px.** iOS Safari zooms the whole page into it. Pinned.
- **One version, five places.** `APP_VERSION`, every lib `?v=` stamp,
  `version.txt`, and the `CACHE` name in `sw.js` move together; tests enforce
  all of it. Every lib URL in `sw.js` carries the same stamp the page requests,
  or the cache never matches.

## Shipping

`node test/run.js` must be green. Bump `APP_VERSION`, the three lib `?v=`
stamps, the matching stamps in `sw.js` `ASSETS`, the `sw.js` `CACHE` name, and
`version.txt` together, and add a version-history entry below. Tests enforce all
of it.

Cosmetic changes can merge direct. Anything touching the model, the verdict,
the limits or storage goes through a PR.

## Custom domain

It serves at `5w311.github.io/AxlePost/` until a domain is set. To move it to
`axlepost.figari.dev`: add the DNS `CNAME` record pointing at `5w311.github.io`
first, then commit a `CNAME` file containing `axlepost.figari.dev`. Doing it in
the other order redirects the live app to an address that doesn't resolve yet.

## Updating this README

Written for a driver first. The sections above **For developers** use no code
identifiers and no file names. Technical detail goes below it.

## Not built yet

- **Ticket import.** Parse a Weigh My Truck PDF in the browser with pdf.js. It
  depends on those PDFs having a selectable text layer; if they're flat images,
  it's OCR, and it's out. Re-weigh tickets carry the original ticket number, so
  import could also pair them for calibration automatically.
- **More KPRA states.** One verified row at a time.
- **Per-trailer profiles**, keyed by trailer number, for drop-and-hook.

---

# Version history

Newest first.

### v0.1.2
New app icon: the slider rail and a pair of tandem wheels in ticket yellow. It's
on the home screen, in the browser tab, and next to the name at the top of the
app.

### v0.1.1
A cleaner truck in the rig diagram: a proper tractor with its frame, fuel tank
and stack, wheels with hubs, and a trailer with landing gear, a rear bumper and
the slider rail with a dot for every hole. The tandems no longer sweep across
the tractor every time the app opens.

### v0.1.0
First release, from the approved prototype. Ticket entry with a sum check,
per-group verdict bars, and a slide answer with predicted weights. Separate
answers for over gross, drives plus tandems over, steers over, and freight that
has to move. California and Florida kingpin rules with their different
measurement points. Rig setup that remembers the trailer and never the ticket,
calibration from a re-weigh, and offline install.

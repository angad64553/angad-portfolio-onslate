# Portfolio design system — v2 "Signal"

An evidence-first engineering portfolio set like a poster: ink, bone, and one hot
orange; condensed heavy type; and a single field of particles that re-forms as you
move through the page. Dark is the default theme; light is a full peer.

## Files

- `index.html` — all page content and structured data.
- `site.css` — the only stylesheet (tokens, components, résumé, print, thank-you page).
- `main.js` — theme, navigation, intro, text effects, the reactive hero name,
  scroll-linked UI, stacking cards, marquee, cursor, tilt, live GitHub data, and
  the Web3Forms contact form.
- `scene.js` — the page-wide WebGL scene (ES module). Uses the vendored
  `assets/vendor/three.r128.min.js`, loaded after the window `load` event.

## Palette

Matches `og-image-generated.png` and `favicon.svg`.

| Token      | Dark      | Light     | Use                                        |
|------------|-----------|-----------|--------------------------------------------|
| `--bg`     | `#0a0a0b` | `#ece7dc` | Page (ink / bone paper)                    |
| `--text`   | `#ece6da` | `#111112` | Text, particles                            |
| `--accent` | `#ff5a1f` | `#bf3600` | Actions, labels, last word of each heading |
| `--green`  | `#86e29b` | `#1c7a3a` | "Live" and "current" states only           |
| `--warm`   | `#f2b84b` | `#8f5800` | "Review" state, soft warnings              |

Orange is the only brand colour. Green and amber carry status meaning and are
never used decoratively.

## Type

- **Archivo** (variable: width 62–125, weight 100–900), self-hosted. Display text
  is condensed (`font-stretch: 62–72%`), weight 800, uppercase. Body text is the
  same family at normal width, weight 400.
- **IBM Plex Mono** for labels, dates, tags, buttons, and code — uppercase with
  wide tracking.

`[data-fit]` text (the hero name, the footer wordmark) is sized by `main.js` to
span its container exactly; the CSS `clamp()` is only the pre-script fallback.

## Section order

Hero → stack marquee → Work (`#projects`) → About → Experience → Skills →
GitHub → Credentials → Contact. Work comes first because it is the evidence.

## Motion

1. **Scene** — one `THREE.Points` cloud (22,000 particles; 9,000 on small
   screens) with four target positions per particle, blended in the vertex shader:
   a ringed globe (hero), stacked layers (Work, Skills), a torus knot (About,
   Experience, GitHub, Credentials), and a rippling disc (Contact). `STAGES` in
   `scene.js` maps each section to a shape, a viewport slot, and an opacity. In
   the hero the cloud follows `[data-scene-anchor]`, so layout stays in CSS, and
   three points on the globe drive the DOM callouts (`[data-scene-label]`).
   The pointer pushes particles aside and steers the rotation. Rendering pauses
   in hidden tabs; under reduced motion one settled frame is drawn per scroll.
   Depth cues: the globe has a solid, lit core (so the ring passes behind it) with
   an atmosphere rim and halo; its particles are shaded from the upper left; the
   camera orbits slightly with the pointer; and a dust field spread through the
   scene's depth drifts with scroll, near specks faster than far ones.
2. **Fallback** — a CSS dotted globe is visible until the first WebGL frame, and
   stays if WebGL, the script, or data-saver mode blocks the scene.
3. **Hero name** — each letter's width and weight axes follow the pointer;
   widths move around the mean so the line keeps its length. An idle wave runs
   when the pointer is elsewhere. The name is an extruded slab (stacked
   `text-shadow`, direction in `--ex`/`--ey`) that turns to face the pointer.
4. **Intro** — a counter and wipe, once per browser session (`sessionStorage`).
5. **Headings** — words flip up on a hinge; the last word is orange. Kickers
   scramble into place. The About lead paragraph lights word by word with scroll.
6. **Project cards** — `position: sticky` stack. A card taller than the viewport
   sticks by its bottom edge (`--stick`), and scales down and dims (`--cover`) as
   the next card slides over it, leaning back as it goes. Mock interfaces are
   tilted windows whose tiles float at different depths (`translateZ`); they
   straighten on scroll (`--p`), turn toward the pointer (`--tx`/`--ty`), and
   their charts grow in.
7. **Marquee** — drifts on its own; speed, direction, and skew follow scroll velocity.
8. **Cards** — `[data-spot]` groups light card borders near the cursor;
   `[data-tilt]` gives bounded tilt with glare, and the card's contents sit at
   different depths so they separate as it turns. Mouse only. Blocks enter by
   standing up from a lean; primary buttons have a solid edge and press down.
9. **Header** — hides while scrolling down, returns on scroll up or focus.
10. **Timeline** — the rail fills with scroll (`--fill`).

All of it is disabled by `prefers-reduced-motion`, and the head script removes
the `motion` and `intro` classes after 4s if `main.js` never runs, so content is
never left hidden.

## Content rules

- No unverifiable metrics or self-awarded badges.
- Mock interfaces are labeled "Concept UI"; project links point to real repos.
- One job title everywhere: **SDE & LMS Associate at AeroBay**.

## Verification

```bash
node --check main.js && node --check scene.js
python3 tests/verify_content.py   # fingerprints of content; regenerate on intentional copy changes
npm run build
python3 -m http.server 8000
```

Check 390, 768, 1024, and 1440px; both themes; the mobile menu; reduced
motion; and contact validation without sending a real message.

# Kindred Co-op — visual thesis

## Direction: a pocket field guide printed in two inks

Kindred Co-op should feel like a small game found between the pages of a family
field guide: warm paper, imperfect halftone ink, clipped labels, and tiny night
creatures passing a signal between two hills. This is a **dithered/halftone
print system**, not pixel-game nostalgia and not a generic card dashboard. The
print metaphor fits a bounded, ownable family game: finite, calm, tactile, and
free of the visual language of feeds, stores, streaks, and engagement loops.

The two players are “Lantern” and “Moth”. Their inks—tomato and teal—identify
their roles, but every state also has a word, shape, or pattern so color is
never the only signal. Paper texture and dot screens create depth; controls
remain large, flat, and precise.

## Palette

This is deliberately a single light, painted-paper treatment. A dark mode would
break the physical two-ink print thesis, so the page always declares its warm
paper background.

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#F5EBCF` | page/background |
| `paper-high` | `#FFF9E8` | raised sheets and inputs |
| `ink` | `#172F2B` | primary text; deep forest printing ink |
| `ink-soft` | `#52635C` | secondary copy (7:1+ on paper) |
| `teal` | `#087A70` | Moth role, links, active controls |
| `teal-dark` | `#07564F` | teal text/button shade |
| `tomato` | `#C8432F` | Lantern role, stamps, emphasis |
| `tomato-dark` | `#8F2D20` | danger and tomato text |
| `gold` | `#D99A24` | success/star moments, always paired with icon/text |
| `night` | `#102A31` | scene blocks and primary buttons |
| `rule` | `#A89879` | printed rules and disabled outlines |

All body text and button combinations target WCAG AA (4.5:1); controls use
icons/patterns plus labels. Focus is a 3 px tomato outline with a paper gap.

## Typography

- **Headlines:** Georgia, `Times New Roman`, serif—editorial, storybook-like,
  already present on every device, with no network font cost.
- **Interface/body:** Atkinson Hyperlegible, system fallback. A self-hosted WOFF2
  may be added only if the file stays under the 120 KB font budget; otherwise
  the stack is `Arial`, `Helvetica`, sans-serif for dependable legibility.
- Scale: 16 px body, 18 px lead, 20 px h3, 25 px h2, fluid 38–64 px h1.
  Body leading is 1.55 and readable measure is capped at 68 characters.
- Small caps are reserved for short printed labels and never carry instructions.

## Spacing and layout

An 8 px rhythm, with 4 px for optical nudges: `4, 8, 16, 24, 32, 48, 64,
96`. Main content maxes at 1120 px. On wide screens the hero and play room use
asymmetric 7/5 and 5/7 columns; at 760 px they stack. At 390 px, decoration is
reduced, actions become full-width, room status stays in flow, and no fixed
toolbar steals safe-area space. Every interactive target is at least 44 px.

Cards are not the default. Independent controls sit on clipped “paper scraps”;
steps and legal copy use open layout separated by proximity and printed rules.
Corners are modest (4–12 px), with offset ink shadows rather than soft SaaS
shadows.

## Interaction grammar

- Primary actions look like dark ink stamps: solid, slightly offset shadow,
  and a 2 px pressed translation.
- Secondary actions are underlined text or paper buttons with hard rules.
- Network state is a labeled postage mark: “Together”, “Waiting”, “Offline”.
- Puzzle feedback arrives as a new printed layer from the element that changed.
- First-run control cards show one physical action each: **Look**, **Say it
  aloud**, **Tap one shape**. They are replayable from “How to play”.
- Invite codes use tabular figures/letters and explicit copy feedback.

## Motion policy

UI transitions last 180–240 ms and animate only transform/opacity. A correct
answer produces one 360 ms stamp-in; scene dots drift once on entrance, never
loop. No flashing. With `prefers-reduced-motion: reduce`, scrolling is instant,
transitions are removed, and stamps appear with a simple opacity change. Game
meaning never depends on motion.

## Asset plan and prompt sheet

Hero asset: one original landscape illustration showing two small camps on
separate hills exchanging a lantern signal, with a moth between them. It
explains remote cooperation without depicting real people. Generate at
1536×1024, crop responsively, export WebP/AVIF under 300 KB, retain PNG source
and prompt sidecar under `assets/src/`.

Master prompt: “A quiet twilight field-guide illustration of two small cozy
camp lanterns on separate rounded hills, a friendly moth carrying a glowing
signal between them, handmade two-color screen print, coarse halftone dots,
visible paper grain, limited deep forest teal, tomato red, ochre and warm cream
palette, naïve botanical shapes, editorial composition, generous negative
space, age-appropriate and tender, no people.”

Negative list: no text, no watermark, no logos, no brands, no gradients, no
photorealism, no glossy 3D, no interface mockup, no copyrighted characters, no
scary insects, no extra limbs, no illegible symbols.

Game symbols (moon, leaf, star, ripple, pine, pebble) are hand-authored inline
SVG with simple geometry, two-ink fills, and visible text labels. The paper dot
texture is CSS, keeping controls crisp and downloads small.

## Provenance

The hero illustration is generated specifically for Kindred Co-op with the
factory Azure OpenAI image deployment (`factory-image`) on 2026-08-27 using the
master prompt above. It is an original product asset; the generated-image
disclosure appears in the footer. Hand-authored SVG game symbols and CSS
textures are original to this repository and MIT-licensed with the code.

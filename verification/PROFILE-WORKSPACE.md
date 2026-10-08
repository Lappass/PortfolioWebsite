# Creator workspace — 2026-10-07

## Controller entrance revision

About now runs a 2.4-second physical terminal sequence: establish the shared
desk, lift and tilt the controller, illuminate its player indicator, display
PLAYER 01 / Shuhang Chen, then expand the profile from the projected monitor
bounds over 480ms. The particle study inside the profile remains intact; the
previous full-screen particle-name entrance is no longer invoked.

The selected case stays closed during this sequence. Background cases fade out
before the controller lifts. Esc cancels the pending reveal and reverses the
workspace movement from its current position. Direct links and reduced motion
show the profile immediately. Selection and project insertion timing are preserved.

The original controller and desk are generated with `art/console_setup.py`;
editable parts are retained in `art/console-setup.blend`. Controller parts are
batched separately from the drive, with the player light kept independent.
The desk now has a matte grey top, recessed graphite frame, metal front inlay,
two sled supports and a rubber controller pad. Monitor height is unchanged.

Edge runtime checks: 1600×900 and 390×844 normal entrances, 320×740 reduced
motion; correct name, live particle canvas, no horizontal overflow, section
navigation, full return and interrupted entrance with no delayed reopening.
Disc insertion regression: 1600×900, 390×844 and 844×390; screen remains inside
the viewport, its top edge stays level, and returning restores the shelf.
These are Chromium viewport checks, not physical iPhone validation.

The original workspace revision used a side view of the existing terminal.
The controller entrance above replaces that side view and its page transition.
Closing or interrupting restores the original scene without changing selection.
Reduced motion skips the camera and page transitions.

The first page pairs a large Shuhang Chen identity with an interactive particle
study. Its supporting signature and metadata stay small. The biography uses
large paragraphs beside section annotations; skills use numbered rows instead
of tag boxes; experience follows a vertical timeline. Existing profile placeholders
are preserved. Personal name, alias and boot identity are unified in
`content/profile.json`; site brand remains LAPPAS.

The native TypeScript canvas adapts the supplied Wix sample's gather/scatter/morph
idea. 720 reused particles form a rotating sphere, ring, HELLO and the profile
name, with local pointer repulsion. Colours follow the site theme. Canvas DPR
is capped at 2, offscreen and hidden-document animation pauses, and closing
disposes observers, listeners and animation frames. Reduced motion renders a
static sphere. No Wix embed, remote script or new model asset is required.

Validation: production build passed. Headless Edge at 1600×900, 390×844 and
320×740 (reduced motion) checked identity, canvas sizing, no horizontal overflow,
workspace camera progress, chapter navigation, Escape and interrupted entry.
No page errors. Screenshots in `verification/profile-workspace/` were inspected.
These are browser viewport checks, not physical mobile-device validation.

## Particle entry follow-up

The entry now runs for 1.5 seconds: central sphere, brief dispersion, particles
forming the exact `Shuhang Chen` heading, then movement to the real heading and
a crossfade into the text. Supporting content reveals at the same time; the
small interactive orb starts after completion. Heading sampling includes font,
letter spacing and wrapping, and caches the mask until its dimensions change.
The entry canvas is removed on completion or interruption. Reduced motion
skips it. Desktop clock-controlled screenshots at 250ms, 750ms and 1600ms
verify the sphere, complete name and final page; viewport/escape checks and
production build passed.

The user's subsequent choice supersedes the particle-name entry: personal
information now opens with an identity card from the prominent creator button.
The particle sphere remains inside the page. Current behaviour and verification
are documented in `PORTFOLIO-HIERARCHY.md`.

Latest correction restores the particle-name entry and original About button;
the identity-card experiment is withdrawn. Four featured projects remain.

# Creator workspace — 2026-10-07

About now enters a side view of the existing terminal rather than playing the
project disc insertion again. Archive HUD fades away, the camera moves toward
the equipment, and the profile comes in from the side after a short delay.
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

# Unified terminal and archive overview — 2026-10-07

The selection view shows the disc archive alone. During insertion, the background
cases dissolve before the terminal appears; cancellation reverses this transition.
The selected case remains the physical source of the disc.

The console now stands upright beside the display, with twin pale panels, a graphite
chassis, vertical drive opening and separate support foot. The reference is the
PS5's upright arrangement (https://www.playstation.com/en-us/support/hardware/ps5-vertical-stand/);
the mesh, marks and materials are original. The monitor and console have 0.68 units
of lateral clearance. A common thin base and amber edge connect the assembly.
The disc rotates into the vertical drive plane before entering its actual opening.
The final camera faces the display squarely, with its stand visibly separated.

Blender generation: `art/console_setup.py`, editable source: `art/console-setup.blend`.
The local Blender script workflow was authorized in this conversation.

The overview reuses the opening's DOM but scopes changes to archive mode: an ID
side rail, smaller title, plain metadata separators, fine rules and an unfilled
text action replace the heavy panel, boxed tags and solid button.

Validation: production TypeScript/Vite/PWA build passed. Actual headless Edge
checks at 1600×900, 390×844 and 844×390 verified terminal hidden before selection,
array visibility zero during insertion, full display inside viewport, horizontal
display edges (NDC tilt <0.00005), opening project route and Escape returning to
the original archive. No page or console errors. Desktop and portrait overview
screenshots inspected; portrait summary stays within the viewport.

Screenshots in `verification/terminal-layout/` document the assembly, reading and
overview states. Browser simulation is not physical iPhone validation.

# Controller and profile entrance — 2026-10-07

The About entrance establishes a level front view of the terminal, lifts the
controller over 540ms, then briefly illuminates its two touchpad light strips.
The pulse starts after pickup, on the same shared cue as camera push-in and
screen wake (workspace progress 0.38). It is a single acknowledgement pulse.

The camera holds during pickup, then aligns with the monitor normal as the light turns on,
then dollies from the overview distance to 7 scene units while reframing the
screen to cover the entire viewport. The controller and desk are outside the
final visible frame. The 3-second physical sequence hands the same deterministic
particle sphere to a full-screen canvas. It forms Shuhang Chen once, then unfolds
back into a sphere as it settles into the profile's particle study. The profile uses the same fully opaque paper
background as project details; the scene stops updating while covered.

The user withdrew the portrait request: no photo or portrait sampling is shipped.
The 3,600 particles remain a slowly rotating sphere on the profile, retaining pointer
repulsion. Both the physical screen and the entry canvas constrain the field on
narrow viewports. Reduced motion displays a static sphere immediately. Direct links
skip the physical sequence. Esc cancels either stage without a late reveal.

Decorative PLAYER, PERSONNEL, PARTICLE FIELD, CREATOR PROFILE and section
numbers are removed from the profile. Navigation and section headings use plain
Chinese labels; the name appears once in the page heading. Required model
attribution remains linked in the footer.

## Model and attribution

The user rejected the procedural controller and explicitly authorized downloaded
models. The replacement is Taohid Animation's PS5 Controller (CC BY 4.0), using
the named-part adaptation distributed by SafaElmali/dualsense-studio. Source GLB,
SHA-256, upstream credit and modification notes live in art/vendor/dualsense/.

art/console_setup.py imports, orients, scales and adjusts the source, then saves
editable parts in art/console-setup.blend. The web GLB batches ordinary controller
parts by material, retains source maps, and keeps light strips independently
animated. Public credit and license links are available through the profile
footer at public/model-credits.html. The desk/monitor proportions are preserved.

Emissive color and intensity are now part of the renderer's reuse-state snapshot,
so a stationary camera cannot freeze the acknowledgement light.

## Verification

- Production TypeScript/Vite/PWA build passes.
- Edge at 1600x900 and 390x844: pickup, active pulse intensity 4, pulse off before
  the end of push-in, projected display covering the viewport, name formation, solid page
  background, no photo elements, and no horizontal overflow.
- 320x740 reduced motion: direct profile with a static particle name.
- Esc during pickup and during particle formation: no orphan canvas or delayed
  reopening; returning restores the shelf.
- Existing disc insertion: 1600x900, 390x844, 844x390. Display remains level and
  within the project shot, and ejection restores array visibility.
- Reviewed screenshots in art/.cache/name-*.png. These are desktop Chromium
  viewport checks, not physical iPhone validation.

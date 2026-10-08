# Imported controller

- Download: https://raw.githubusercontent.com/SafaElmali/dualsense-studio/main/controller/dualsense.glb
- Downloaded 2026-10-07; source SHA-256: `E55E172F3A6704769818954970FDA2D29038A31F85BA7358A36D0549DF4F9D30`.
- Original: PS5 Controller by Taohid Animation, Sketchfab, CC BY 4.0 (see preserved ATTRIBUTION.md).
- User explicitly authorized an external model after rejecting the procedural controller.
- `art/console_setup.py` imports this source, lays the face upward, normalizes width to 3.1 units, adjusts materials, and batches controller surfaces separately from the terminal.
- `art/console-setup.blend` retains the editable imported parts. `public/assets/console-setup.glb` contains the adapted assembly.
- Lighting meshes remain separate under `Controller_Player_Light_*`. Browser retains their source UVs/textures and animates one acknowledgement pulse.
- Public attribution is linked from the profile footer at `public/model-credits.html`.

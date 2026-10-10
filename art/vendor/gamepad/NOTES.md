# Controller

- Source: `source.glb`, Meshy image-to-3D export `Meshy_AI_futuristic_gamepad_3d_1010135851_image-to-3d-texture`, supplied by Shuhang Chen on 2026-10-10.
- Design: `art/controller-design.svg`, shaped after the brand mark. Replaces the earlier CC BY DualSense model.
- `art/console_setup.py` imports it, lays the face upward, reduces it to about 60k triangles, normalises the width to 3.1 units and lifts the home button's faces into `Controller_Player_Light_Home`.
- The site lights the home button through its own texture (emissive map) for the acknowledgement pulse.

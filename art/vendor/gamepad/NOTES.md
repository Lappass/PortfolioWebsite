# Controller

- Source: `source.glb`, Meshy image-to-3D export `Meshy_AI_futuristic_gamepad_3d_1010135851_image-to-3d-texture`, supplied by Shuhang Chen on 2026-10-10.
- Design: `art/controller-design.svg`, shaped after the brand mark. Replaces the earlier CC BY DualSense model.
- `art/console_setup.py` imports it, lays the face upward, normalises the width to 3.1 units, splits the sticks, d-pad, face buttons and home button into their own objects (`Controller_Stick_L/R`, `Controller_Dpad`, `Controller_Button_A/B/X/Y`, `Controller_Player_Light_Home`) at full resolution, then reduces the body to about 56k triangles and each part to about 1.4k.
- The site tilts and presses those parts from live input, and lights the home button and the confirm button through their own textures (emissive map).

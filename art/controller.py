"""Shuhang's desk controller: a retro bar pad (style "retro_dark", chosen 2026-11-22).

Imported by art/console_setup.py; `build(scene, centre, style=...)` adds the Controller_*
objects. A flat rounded bar with fuller ends, white upper shell over a graphite lower
shell; the d-pad and the four round face buttons sit in shallow graphite wells. The brand's
crescent lights the home button and the confirm button (A) has a thin amber ring. The other
STYLES are the options shown while choosing, kept so they can be rendered again.
Built in millimetres (x right, y toward the player), then scaled to 3.1 units wide with
the face up (+Z) and the near edge toward -Y.

Names the site relies on (src/console-setup.ts):
  Controller_Dpad, Controller_Button_A/B/X/Y (and Controller_Stick_L/R in styles with sticks)
  move with input; Controller_Button_A_Ring  the confirm ring, lit on a press, moves with A;
  Controller_Player_Light_*  the home mark (and light strips), lit when the desk wakes.
Every moving part has a single material so it arrives as one mesh.
"""
import re
from math import cos, sin, pi, radians

import bmesh
import bpy
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

WIDTH = 160.0      # design width in mm, scaled to 3.1 units
UNITS = 3.1


def _linear(hex_colour):
    out = []
    for i in (0, 2, 4):
        c = int(hex_colour[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)
    return out


def _material(name, hex_colour, roughness):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*_linear(hex_colour), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


# Top-view outline, right half mirrored: wide shoulders and long, full grips.
_RIGHT = "C 20,-40 36,-44 52,-44 C 68,-44 78,-36 80,-22 C 82,-6 82,12 80,30 C 78,48 74,62 64,66 C 54,70 46,62 42,52 C 38,42 32,32 22,30 C 14,28 8,30 0,30"
BODY = ("M 0,-40 " + _RIGHT + " C -8,30 -14,28 -22,30 C -32,32 -38,42 -42,52 C -46,62 -54,70 -64,66 "
        "C -74,62 -78,48 -80,30 C -82,12 -82,-6 -80,-22 C -78,-36 -68,-44 -52,-44 C -36,-44 -20,-40 0,-40 Z")
BUMPER = "M 26,-44 C 42,-49 62,-49 75,-38"
TRIGGER = "M 34,-42 C 48,-46 62,-44 71,-35"
# Graphite core between the white wings, the touchpad on it, light strips beside the pad.
CORE = ("M -27,-37 L 27,-37 C 30,-18 35,-2 35,12 C 35,22 31,27.5 22,28.3 C 14,28 7,28.6 0,28.6 "
        "C -7,28.6 -14,28 -22,28.3 C -31,27.5 -35,22 -35,12 C -35,-2 -30,-18 -27,-37 Z")
TOUCHPAD = ("M -20,-35 L 20,-35 C 23,-35 24.5,-34 24,-31 L 21.5,-15 C 21,-12.5 20,-12 17.5,-12 "
            "L -17.5,-12 C -20,-12 -21,-12.5 -21.5,-15 L -24,-31 C -24.5,-34 -23,-35 -20,-35 Z")
LIGHT_STRIP = "M 27,-34 C 26.5,-26 25.6,-18 24.2,-11"
# Layout (design mm): d-pad and face buttons on the wings, sticks side by side below the pad.
STICK_L, STICK_R, DPAD_AT, HOME_AT = (-22, 10), (22, 10), (-48, -14), (0, 14)
FACE = {"X": (48, -23.5), "B": (57.5, -14), "Y": (38.5, -14), "A": (48, -4.5)}


def _symmetric(top, segs):
    """Closed outline from its right half: `segs` are (c1, c2, end) cubic steps going
    clockwise from (0, top) round to the centre line again; the left half is mirrored."""
    pts = [(0, top)] + [s[2] for s in segs]
    d = "M 0,%g " % top + " ".join("C %g,%g %g,%g %g,%g" % (*c1, *c2, *e) for c1, c2, e in segs)
    for i in range(len(segs) - 1, -1, -1):
        c1, c2, _ = segs[i]
        a = pts[i]
        d += " C %g,%g %g,%g %g,%g" % (-c2[0], c2[1], -c1[0], c1[1], -a[0], a[1])
    return d + " Z"


# Each style is a complete look; build() takes one by name or as a dict of overrides.
STYLES = {
    # Long full grips, white wings over a graphite core, touchpad with light strips.
    "touchpad": dict(body=BODY, bumper=BUMPER, trigger=TRIGGER, core=CORE, touchpad=TOUCHPAD, strip=LIGHT_STRIP,
                     stick_l=STICK_L, stick_r=STICK_R, dpad=DPAD_AT, home=HOME_AT, face=FACE, menu=(31, -31, -70),
                     shell="eef0f1", dark="23272d", pad="eef0f1", lower=True, droop=18.0, thick=5.5),
}
STYLES["midnight"] = dict(STYLES["touchpad"], shell="2b3036", dark="1b1e22", pad="3a4047")
STYLES["solid"] = dict(STYLES["touchpad"], core=None, pad="e2e5e8")
STYLES["compact"] = dict(STYLES["touchpad"], core=None, touchpad=None, strip=None,
    body=_symmetric(-30, [((30, -30), (52, -32), (66, -26)), ((78, -20), (80, -2), (78, 14)), ((76, 34), (70, 48), (58, 48)),
                          ((48, 48), (44, 38), (38, 32)), ((30, 24), (16, 22), (0, 22))]),
    bumper="M 30,-31 C 44,-35 60,-33 70,-24", trigger="M 36,-31 C 48,-34 60,-32 67,-25",
    stick_l=(-24, 8), stick_r=(24, 8), dpad=(-52, -10), home=(0, -18), face={"X": (52, -18.5), "B": (61.5, -9), "Y": (42.5, -9), "A": (52, .5)},
    menu=(12, -8, -18), droop=10.0, thick=6.5)
STYLES["pebble"] = dict(STYLES["compact"],
    body=_symmetric(-36, [((40, -36), (78, -24), (80, 0)), ((82, 26), (66, 40), (48, 40)), ((32, 40), (20, 32), (0, 32))]),
    bumper="M 34,-36 C 50,-37 66,-30 74,-18", trigger="M 40,-34 C 54,-33 64,-27 70,-18",
    stick_l=(-44, -10), stick_r=(22, 16), dpad=(-22, 16), home=(0, -20), face={"X": (44, -19.5), "B": (53.5, -10), "Y": (34.5, -10), "A": (44, -.5)},
    menu=(12, -6, -18), droop=4.0, thick=8.0, lower=False)
STYLES["retro"] = dict(STYLES["compact"],
    body=_symmetric(-27, [((36, -27), (66, -31), (77, -18)), ((85, -4), (82, 24), (62, 30)), ((46, 34), (22, 25), (0, 25))]),
    bumper="M 46,-29 C 58,-30 68,-27 74,-20", trigger=None,
    stick_l=None, stick_r=None, dpad=(-52, 1), home=(0, -10), face={"X": (52, -9.5), "B": (61.5, 0), "Y": (42.5, 0), "A": (52, 9.5)},
    menu=(6.5, 5, 0), droop=0.0, thick=6.0, dpad_dark=True,
    wells=[(-52, 1, 15.5), (52, 0, 17.5)], well="dfe2e6", rgb=True)
STYLES["retro_dark"] = dict(STYLES["retro"], well="2b3036")
DPAD = "M -3.2,-9 h6.4 v5.8 h5.8 v6.4 h-5.8 v5.8 h-6.4 v-5.8 h-5.8 v-6.4 h5.8 Z"
# Fish crescent and eye of the brand mark, for the home button.
CRESCENT = ("M 638.5 473.0 C 630.8 473.4, 622.5 474.2, 620 474.8 C 617.5 475.3, 612.9 476.1, 609.6 476.5 C 604.3 477.1, 594.7 479.4, 578 484.1 C 551.0 491.6, 524.7 505.8, 495.4 528.5 C 472.7 546.2, 449.0 577.7, 436.5 606.5 C 430.0 621.8, 429.2 623.9, 428.4 628.5 C 428.0 630.7, 427.2 633.6, 426.5 635 C 425.8 636.4, 424.9 640.2, 424.5 643.5 C 424.1 646.8, 423.2 652.0, 422.4 655.0 C 420.6 662.1, 420.6 671.1, 422.5 675.7 C 423.3 677.6, 424.0 680.0, 424.0 680.9 C 424.0 683.4, 431.5 699.5, 435.4 705.4 C 451.9 730.3, 484.6 750.2, 521.5 757.6 C 540.5 761.4, 577.5 761.9, 591.5 758.6 C 594.8 757.8, 600.0 756.9, 603 756.5 C 606.0 756.1, 609.9 755.2, 611.5 754.5 C 613.1 753.9, 616.3 753.0, 618.5 752.6 C 633.0 750.0, 664.6 736.1, 684.8 723.4 C 698.5 714.9, 716.6 702.7, 718.5 700.9 C 721.6 697.9, 719.1 696.2, 714.3 698.2 C 691.0 707.7, 650.2 709.4, 625.5 702.0 C 593.2 692.2, 570.6 669.8, 563.1 640.1 C 560.6 630.0, 560.3 615.0, 562.4 609.3 C 563.2 607.2, 564.1 603.5, 564.5 601.0 C 567.0 583.4, 593.3 548.6, 614.6 534.8 C 633.9 522.3, 669.0 507.3, 685.5 504.5 C 687.7 504.2, 692.4 503.2, 696 502.5 C 714.8 498.4, 746.1 496.3, 757.3 498.4 C 765.4 499.9, 762.7 494.8, 753.9 492.2 C 752.0 491.6, 747.4 489.9, 743.5 488.5 C 739.6 487.0, 734.2 485.2, 731.3 484.5 C 728.5 483.8, 725.7 482.9, 725.2 482.6 C 723.2 481.4, 705.4 477.2, 699.5 476.5 C 696.2 476.1, 690.4 475.2, 686.5 474.5 C 677.1 472.7, 655.7 472.0, 638.5 473.0 "
            "M 657.2 600.0 C 647.6 606.9, 649.9 620.9, 661.5 626.1 C 666.6 628.5, 669.2 628.5, 673.8 626.1 C 681.2 622.3, 684.1 616.1, 682.0 608.6 C 678.9 597.5, 666.5 593.2, 657.2 600.0")
def _parse(d, place=lambda x, y: (x, y)):
    """SVG path (M/L/H/V/C/Z, absolute or relative) -> list of subpaths of cubic segments."""
    tokens = re.findall(r"[MmLlHhVvCcZz]|-?(?:\d+\.?\d*|\.\d+)", d)
    paths, seg, pos, start, cmd, i = [], None, (0.0, 0.0), (0.0, 0.0), None, 0
    num = lambda: float(tokens[i])
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]; i += 1
            if cmd in "Zz":
                if seg and pos != start:
                    seg.append((pos, pos, start, start))
                if seg: paths.append((seg, True))
                seg, pos = None, start
                continue
        rel = cmd.islower()
        c = cmd.upper()
        if c == "M":
            x, y = float(tokens[i]), float(tokens[i + 1]); i += 2
            if rel: x, y = pos[0] + x, pos[1] + y
            if seg: paths.append((seg, False))
            seg, pos, start = [], (x, y), (x, y)
            cmd = "l" if rel else "L"
        elif c in "LHV":
            if c == "L":
                x, y = float(tokens[i]), float(tokens[i + 1]); i += 2
                if rel: x, y = pos[0] + x, pos[1] + y
            elif c == "H":
                x, y = float(tokens[i]) + (pos[0] if rel else 0), pos[1]; i += 1
            else:
                x, y = pos[0], float(tokens[i]) + (pos[1] if rel else 0); i += 1
            seg.append((pos, pos, (x, y), (x, y))); pos = (x, y)
        elif c == "C":
            v = [float(t) for t in tokens[i:i + 6]]; i += 6
            if rel: v = [v[k] + pos[k % 2] for k in range(6)]
            seg.append((pos, (v[0], v[1]), (v[2], v[3]), (v[4], v[5]))); pos = (v[4], v[5])
    if seg: paths.append((seg, False))
    paths = [(segs, closed or (abs(segs[0][0][0] - segs[-1][3][0]) < 1e-6 and abs(segs[0][0][1] - segs[-1][3][1]) < 1e-6))
             for segs, closed in paths]
    out = []
    for segs, closed in paths:
        out.append(([tuple(place(*p) for p in s) for s in segs], closed))
    return out


def _bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return [u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k] for k in (0, 1)]


def _sample(path, n=64):
    segs, _ = path
    pts = []
    for s in segs:
        pts += [_bezier(*s, j / n) for j in range(n)]
    pts.append(list(segs[-1][3]))
    return pts


def _design(x, y):
    """Design millimetres (y toward the grips) -> Blender millimetres (grips toward -Y)."""
    return (x, -y)


def _curve(name, paths, extrude=0.0, bevel=0.0, offset=0.0, fill=True):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "2D"
    data.fill_mode = "BOTH" if fill else "NONE"
    data.extrude, data.bevel_depth, data.offset = extrude, bevel, offset
    data.bevel_resolution, data.resolution_u = 4, 12
    for segs, closed in paths:
        spline = data.splines.new("BEZIER")
        points = [s[0] for s in segs] if closed else [s[0] for s in segs] + [segs[-1][3]]
        spline.bezier_points.add(len(points) - 1)
        for k, bp in enumerate(spline.bezier_points):
            bp.co = (*points[k], 0)
            bp.handle_left_type = bp.handle_right_type = "FREE"
        for k, s in enumerate(segs):
            a = spline.bezier_points[k]
            b = spline.bezier_points[(k + 1) % len(points)]
            a.handle_right = (*s[1], 0)
            b.handle_left = (*s[2], 0)
        if not closed:
            first, last = spline.bezier_points[0], spline.bezier_points[-1]
            first.handle_left = first.co * 2 - first.handle_right
            last.handle_right = last.co * 2 - last.handle_left
        spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _bake(obj, name=None):
    """Apply modifiers / convert curves; returns a plain mesh object in place of `obj`."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    name, matrix, data = name or obj.name, obj.matrix_world.copy(), obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data and data.users == 0:
        (bpy.data.curves if isinstance(data, bpy.types.Curve) else bpy.data.meshes).remove(data)
    out = bpy.data.objects.new(name, mesh)
    out.matrix_world = matrix
    bpy.context.scene.collection.objects.link(out)
    mesh.name = out.name
    return out


def _join(objs, name):
    for o in objs:
        o.data.transform(o.matrix_world); o.matrix_world = Matrix()
    bm = bmesh.new()
    mats = []
    for o in objs:
        lookup = []
        for m in o.data.materials:
            if m not in mats: mats.append(m)
            lookup.append(mats.index(m))
        part = bmesh.new(); part.from_mesh(o.data)
        for f in part.faces:
            if lookup: f.material_index = lookup[f.material_index]
        tmp = bpy.data.meshes.new("tmp"); part.to_mesh(tmp); part.free()
        bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    for m in mats: mesh.materials.append(m)
    for o in objs:
        data = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if data.users == 0: bpy.data.meshes.remove(data)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _smooth(a, b, t):
    t = min(1, max(0, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _round_cylinder(name, radius, height, bevel, mat, segments=40):
    """A puck standing on z = 0 with its top edge rounded."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=height)
    bmesh.ops.translate(bm, vec=(0, 0, height / 2), verts=bm.verts)
    top = [e for e in bm.edges if all(v.co.z > height - 1e-4 for v in e.verts)]
    if bevel:
        bmesh.ops.bevel(bm, geom=top, offset=bevel, segments=3, profile=.5, affect="EDGES")
    mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build(scene, centre, floor=.045, style="retro_dark"):
    st = dict(STYLES[style]) if isinstance(style, str) else dict(STYLES["touchpad"], **style)
    S = UNITS / WIDTH
    SHELL = _material("Controller_Shell", st["shell"], .45)
    DARK = _material("Controller_Dark", st["dark"], .35)
    RUBBER = _material("Controller_Rubber", "33383f", .8)
    AMBER = _material("Controller_Amber", "e0a04a", .4)

    # --- Shell: the top-view outline as a rounded slab, then shaped from the side view.
    RIM = 7.5
    slab = _curve("Controller_Body", _parse(st["body"], _design), extrude=st["thick"], bevel=RIM, offset=-RIM)
    slab.data.bevel_resolution = 8
    slab = _bake(slab)
    remesh = slab.modifiers.new("Even", "REMESH")
    remesh.mode, remesh.voxel_size = "VOXEL", .6
    smooth = slab.modifiers.new("Soften", "SMOOTH")
    smooth.factor, smooth.iterations = .5, 6
    reduce = slab.modifiers.new("Web budget", "DECIMATE")
    reduce.ratio = .2
    body = _bake(slab, "Controller_Body")
    bm = bmesh.new(); bm.from_mesh(body.data)
    # Lower shell and shoulders graphite: an exact parting line a little below the middle,
    # which the shaping below carries down to the grip tips.
    PART = -2.0
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, PART), plane_no=(0, 0, 1))
    for f in bm.faces:
        f.material_index = 1 if st["lower"] and f.calc_center_median().z < PART else 0
        f.smooth = True
    def shape(x, y, z):
        """Side-view shaping of the slab: thinner grips, a crowned face, grips sweeping down."""
        forward = -y
        z *= 1 - .18 * _smooth(18, 62, forward)
        if z > 0:
            z += 4.0 * max(0, 1 - (x / 84) ** 2) * (z / 13) * (1 - .6 * _smooth(10, 50, forward))
        return z - st["droop"] * _smooth(22, 66, forward)

    for v in bm.verts:
        v.co.z = shape(*v.co)
    bm.to_mesh(body.data); bm.free()
    body.data.materials.append(SHELL); body.data.materials.append(DARK)
    print("body faces", len(body.data.polygons))

    depsgraph = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(body, depsgraph)

    def surface(x, y):
        hit = tree.ray_cast(Vector((x, y, 200)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] else 0.0

    def drape(obj, lift, step=None):
        """Lay a flat decal onto the shell, `lift` mm above it; `step` splits it finely
        enough first (mm) that its faces follow the curved shell between vertices."""
        if step:
            bm = bmesh.new(); bm.from_mesh(obj.data)
            bmesh.ops.triangulate(bm, faces=bm.faces[:])
            while True:
                long = [e for e in bm.edges if e.calc_length() > step]
                if not long: break
                bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
                bmesh.ops.triangulate(bm, faces=bm.faces[:])
            bm.to_mesh(obj.data); bm.free()
        for v in obj.data.vertices:
            v.co.z = surface(v.co.x, v.co.y) + lift

    def drape_solid(obj, lift):
        """Lay a thin solid onto the shell, keeping its own thickness."""
        for v in obj.data.vertices:
            v.co.z = surface(v.co.x, v.co.y) + v.co.z + lift

    def disc(name, cx, cy, radius, mat, lift=.3, rings=5, segments=56):
        verts, faces = [(cx, cy, 0)], []
        for r in range(1, rings + 1):
            rr = radius * r / rings
            verts += [(cx + rr * cos(2 * pi * k / segments), cy + rr * sin(2 * pi * k / segments), 0) for k in range(segments)]
        for k in range(segments):
            faces.append((0, 1 + k, 1 + (k + 1) % segments))
        for r in range(rings - 1):
            a, b = 1 + r * segments, 1 + (r + 1) * segments
            for k in range(segments):
                faces.append((a + k, b + k, b + (k + 1) % segments, a + (k + 1) % segments))
        mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh); scene.collection.objects.link(obj)
        drape(obj, lift)
        return obj

    trim = []
    # Shallow round wells under the d-pad and the face buttons, a tone off the shell.
    if st.get("wells"):
        WELL = _material("Controller_Well", st["well"], .55)
        wells = [disc("Controller_Well_Part", *_design(x, y), r, WELL, lift=.25, rings=8, segments=72) for x, y, r in st["wells"]]
        for w in wells:
            for poly in w.data.polygons: poly.use_smooth = True
        bpy.context.view_layer.update()
        _join(wells, "Controller_Well")
    # Graphite core, with the touchpad raised on it.
    if st["core"]:
        core = _bake(_curve("Controller_Core", _parse(st["core"], _design)))
        core.data.materials.append(DARK)
        drape(core, .3, step=4.0)
        for poly in core.data.polygons: poly.use_smooth = True
        trim.append(core)
    if st["touchpad"]:
        PAD = _material("Controller_Pad", st["pad"], .5)
        pad = _bake(_curve("Controller_Touchpad", _parse(st["touchpad"], _design), extrude=.5, bevel=.5))
        pad.data.materials.append(PAD)
        drape_solid(pad, 1.1)
    if st["strip"]:
        strips = []
        for side in (1, -1):
            strip = _bake(_curve("Controller_Player_Light_Strip", _parse(st["strip"], lambda x, y, s=side: _design(s * x, y)), extrude=.3, bevel=.55))
            strip.data.materials.append(AMBER)
            drape_solid(strip, .9)
            strips.append(strip)
        bpy.context.view_layer.update()
        _join(strips, "Controller_Player_Light_Strip")

    # RGB light: a band round the body on the seam and a ring round each well, with
    # u running along each loop so the site can flow a rainbow through them.
    if st.get("rgb"):
        RGB = _material("Controller_Light_RGB", "202428", .3)
        verts, faces, uvs = [], [], []

        def loop(points, ring_z, half):
            """A closed band through `points` (Blender mm, z from ring_z(x, y)), `half` tall."""
            n, base = len(points), len(verts)
            lengths = [0.0]
            for k in range(1, n + 1):
                a, b = points[k - 1], points[k % n]
                lengths.append(lengths[-1] + ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** .5)
            for k in range(n + 1):
                x, y = points[k % n]
                z = ring_z(x, y)
                verts.extend([(x, y, z - half), (x, y, z + half)])
                uvs.append(lengths[k] / lengths[-1])
            for k in range(n):
                a = base + 2 * k
                faces.append((a, a + 2, a + 3, a + 1))

        # Seam band: the outline pushed out a hair, following the shaping at the seam.
        outline = _sample(_parse(st["body"], _design)[0], 24)[:-1]
        cx = sum(p[0] for p in outline) / len(outline); cy = sum(p[1] for p in outline) / len(outline)
        band = []
        for x, y in outline:
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** .5 or 1
            band.append((x + dx / d * .35, y + dy / d * .35))
        loop(band, lambda x, y: shape(x, y, PART + .9), .8)
        # Rings just inside the rim of each well, standing a little proud of it.
        for x, y, r in st.get("wells", []):
            wx, wy = _design(x, y)
            ring = [(wx + (r - .7) * cos(2 * pi * k / 96), wy + (r - .7) * sin(2 * pi * k / 96)) for k in range(96)]
            loop(ring, lambda px, py: surface(px, py) + .55, .3)
        mesh = bpy.data.meshes.new("Controller_Light_RGB")
        mesh.from_pydata(verts, [], faces)
        layer = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                vi = mesh.loops[li].vertex_index
                layer.data[li].uv = (uvs[vi // 2], vi % 2)
        mesh.materials.append(RGB)
        rgb = bpy.data.objects.new("Controller_Light_RGB", mesh); scene.collection.objects.link(rgb)

    # Shoulder bumpers at the back edge, and the triggers under them.
    for side in (1, -1):
        place = lambda x, y, s=side: _design(s * x, y)
        bumper = _bake(_curve("Controller_Bumper", _parse(st["bumper"], place), extrude=.6, bevel=3.4, fill=True))
        bumper.location.z = 6.0
        bumper.data.materials.append(DARK)
        trim.append(bumper)
        if st["trigger"]:
            trigger = _bake(_curve("Controller_Trigger", _parse(st["trigger"], place), extrude=3.5, bevel=3.0))
            trigger.location.z = -5.0
            trigger.data.materials.append(DARK)
            trim.append(trigger)

    # Menu buttons: two small pills either side of the home button.
    for side in (1, -1):
        pill = _bake(_curve("Controller_Menu", _parse("M -2.3,-1.3 L 2.3,-1.3 C 4,-1.3 4,1.3 2.3,1.3 L -2.3,1.3 C -4,1.3 -4,-1.3 -2.3,-1.3 Z"),
                            extrude=.5, bevel=.5))
        pill.rotation_euler.z = radians(st["menu"][2] * side)
        x, y = _design(st["menu"][0] * side, st["menu"][1])
        pill.location = (x, y, surface(x, y) + .4)
        pill.data.materials.append(DARK)
        trim.append(pill)

    # Home button: a dark puck; the crescent and eye on it are the light.
    hx, hy = _design(*st["home"])
    home = _round_cylinder("Controller_Home", 5.5, 2.6, .9, DARK)
    home.location = (hx, hy, surface(hx, hy) - .8)
    trim.append(home)
    top = home.location.z + 2.6
    glyph = _bake(_curve("Controller_Player_Light_Home",
                         _parse(CRESCENT, lambda x, y: _design((x - 593) * .0195, (y - 617) * .0195 + st["home"][1])), extrude=.12))
    glyph.location.z = top + .02
    glyph.data.materials.append(AMBER)

    # Face buttons: four round keys; only confirm (A) has the amber ring.
    for key, (x, y) in st["face"].items():
        bx, by = _design(x, y)
        button = _round_cylinder(f"Controller_Button_{key}", 4.8, 3.4, 1.2, DARK, 32)
        button.location = (bx, by, surface(bx, by) - .9)
        if key == "A":
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=False, segments=40, radius=4.25)
            out = bmesh.ops.extrude_edge_only(bm, edges=list(bm.edges))
            for v in [g for g in out["geom"] if isinstance(g, bmesh.types.BMVert)]:
                v.co *= 3.55 / 4.25
            mesh = bpy.data.meshes.new("Controller_Button_A_Ring"); bm.to_mesh(mesh); bm.free()
            mesh.materials.append(AMBER)
            ring = bpy.data.objects.new("Controller_Button_A_Ring", mesh); scene.collection.objects.link(ring)
            ring.location = (bx, by, button.location.z + 3.4 + .03)

    # D-pad: a plain cross standing on the shell.
    dx, dy = _design(*st["dpad"])
    dpad = _bake(_curve("Controller_Dpad", _parse(DPAD, _design), extrude=.9, bevel=.7))
    dpad.location = (dx, dy, surface(dx, dy) + 1.4)
    dpad.data.materials.append(DARK if st.get("dpad_dark") else RUBBER)

    # Sticks: a domed base on the core, a short stem and a rubber cap with a ring line.
    for name, at in {"Controller_Stick_L": st["stick_l"], "Controller_Stick_R": st["stick_r"]}.items():
        if not at:
            continue
        x, y = at
        sx, sy = _design(x, y)
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=12, radius=8.0)
        bmesh.ops.scale(bm, vec=(1, 1, .45), verts=bm.verts)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.01], context="VERTS")
        stem = bmesh.ops.create_cone(bm, cap_ends=False, segments=20, radius1=3.0, radius2=2.6, depth=6.0)
        bmesh.ops.translate(bm, vec=(0, 0, 5.5), verts=stem["verts"])
        cap = bmesh.new()
        bmesh.ops.create_cone(cap, cap_ends=True, segments=40, radius1=9.0, radius2=9.6, depth=3.2)
        bmesh.ops.bevel(cap, geom=list(cap.edges), offset=.8, segments=3, profile=.5, affect="EDGES")
        bmesh.ops.translate(cap, vec=(0, 0, 9.4), verts=cap.verts)
        # The drawn ring line: a low bead on the cap top.
        bead = bmesh.ops.create_cone(cap, cap_ends=False, segments=40, radius1=6.3, radius2=5.7, depth=.35)
        bmesh.ops.translate(cap, vec=(0, 0, 11.0 + .12), verts=bead["verts"])
        tmp = bpy.data.meshes.new("tmp"); cap.to_mesh(tmp); cap.free(); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
        mesh.materials.append(RUBBER)
        stick = bpy.data.objects.new(name, mesh); scene.collection.objects.link(stick)
        stick.location = (sx, sy, surface(sx, sy) - 1.2)
        for p in mesh.polygons: p.use_smooth = True

    bpy.context.view_layer.update()
    _join(trim, "Controller_Trim")
    bpy.context.view_layer.update()

    # Millimetres -> scene units, centred on `centre` with the lowest point at `floor`.
    parts = [o for o in scene.objects if o.name.startswith("Controller_") and o.type == "MESH"]
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in parts:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    place = Matrix.Translation(Vector((centre.x, centre.y, floor)) - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)) * S) @ Matrix.Scale(S, 4)
    for o in parts:
        o.matrix_world = place @ o.matrix_world
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix()
    for o in parts:
        if o.name.startswith("Controller_Body") or o.name.startswith("Controller_Stick") or o.name.startswith("Controller_Button"):
            for p in o.data.polygons: p.use_smooth = True
    return parts

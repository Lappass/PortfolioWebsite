"""Original clay self-portrait from Shuhang's front/side/back reference photos.
Run: blender --background --factory-startup --python art/clay_portrait.py
Keeps the editable .blend and exports public/assets/clay-portrait.glb.
Front is -Y in Blender (+Z in glTF); no third-party character assets.
"""
from pathlib import Path
from math import sin, cos, pi, sqrt
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, roughness):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    shader = m.node_tree.nodes['Principled BSDF']; shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = .28
    shader.inputs['Coat Roughness'].default_value = .22
    noise = m.node_tree.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 35
    bump = m.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .04; bump.inputs['Distance'].default_value = .012
    m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height']); m.node_tree.links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return m
def clay(name, hex_color, roughness):
    c=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    return material(name,c,roughness)
skin=clay('Warm yellow hand painted clay','EACB8A',.43)
hair=clay('Gloss black clay hair','111416',.24)
blue=clay('Light turquoise sweatshirt','82BDC4',.50)
seam=clay('Painted blue sleeve hems','5798A7',.52)
pants=clay('Warm grey cream trousers','C4BA9F',.58)
white=clay('Ivory round toe shoes','EDE3C3',.35)
black=clay('Dark brown glasses and eyes','40352C',.48)
red=clay('Warm red tiny smile','D9432C',.5)

def ellipsoid(name, pos, scale, mat, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=pos)
    obj=bpy.context.object; obj.name=name; obj.scale=scale; obj.rotation_euler=rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons: face.use_smooth=True
    return obj

def cord(name, points, radius, mat, cyclic=False):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.resolution_u=12; curve.bevel_depth=radius; curve.bevel_resolution=3
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    spline.use_cyclic_u=cyclic; obj=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(obj); obj.data.materials.append(mat)
    return obj


def rounded(name, pos, size, bevel, mat):
    bpy.ops.mesh.primitive_cube_add(location=pos)
    o=bpy.context.object; o.name=name; o.scale=tuple(v/2 for v in size)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft hand formed corners','BEVEL'); mod.width=bevel; mod.segments=6
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat)
    for f in o.data.polygons: f.use_smooth=True
    mod=o.modifiers.new('Clay surface normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    return o

def garment(name, rings, mat):
    # Rounded rectangle cross sections, with broad flat front/back rather than pill shapes.
    verts=[]; faces=[]; n=40
    for z,cx,rx,ry in rings:
        for j in range(n):
            a=2*pi*j/n; c=cos(a); t=sin(a)
            verts.append((cx+rx*(1 if c>=0 else -1)*abs(c)**.55, ry*(1 if t>=0 else -1)*abs(t)**.55,z))
    for k in range(len(rings)-1):
        for j in range(n): faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    faces.append(tuple(reversed(range(n)))); faces.append(tuple((len(rings)-1)*n+j for j in range(n)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(mat)
    for f in mesh.polygons:f.use_smooth=True
    mod=o.modifiers.new('Gentle clay rounding','BEVEL');mod.width=.045;mod.segments=3
    return o

def lock(name, points, width, depth):
    # A flat, curved teardrop ribbon laid against the head, tapering to a rounded point.
    verts=[];faces=[];n=16;steps=20
    p0,p1,p2,p3=[Vector(p) for p in points]
    for k in range(steps+1):
        t=k/steps; p=(1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3
        tangent=3*(1-t)**2*(p1-p0)+6*(1-t)*t*(p2-p1)+3*t*t*(p3-p2)
        side=Vector((tangent.z,0,-tangent.x)).normalized()
        thickness=max(.025,sin(pi*(.12+.87*t))**.7)
        for j in range(n):
            a=2*pi*j/n;v=p+side*(cos(a)*width*thickness)+Vector((0,sin(a)*depth*thickness,0))
            verts.append(tuple(v))
    for k in range(steps):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    faces.extend([tuple(reversed(range(n))),tuple(steps*n+j for j in range(n))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(hair)
    for f in mesh.polygons:f.use_smooth=True


# Coordinates are traced from the supplied front photograph: origin at the shoe
# baseline, 200 image pixels per model unit. Depth is checked against the video.
def photo(p): return ((p[0]-465)/200,(1190-p[1])/200)

def plaque(name, outline, center, y, depth, mat, facing=-1):
    # A hand shaped shallow slab with a rounded edge, not an ellipsoid lock.
    pts=[Vector(photo(p)) for p in outline]; boundary=[]
    for i in range(len(pts)):
        p0,p1,p2,p3=[pts[j%len(pts)] for j in (i-1,i,i+1,i+2)]
        for k in range(6):
            t=k/6
            boundary.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    ctr=Vector(photo(center));n=len(boundary);verts=[];faces=[]
    # Closed lentil cross section: a broad front, rolled rim and thin back.
    for r,h in [(.001,1),(.30,.97),(.60,.86),(.82,.65),(.95,.35),(1,0),(.96,-.18),(.6,-.25),(.001,-.25)]:
        for j,p in enumerate(boundary):
            v=ctr+(p-ctr)*r
            base=y(v.x,v.y) if callable(y) else y
            irregular=0
            verts.append((v.x,base+facing*(h*depth+irregular),v.y))
    for k in range(8):
        for j in range(n): faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(mat)
    for f in mesh.polygons:f.use_smooth=True
    sub=o.modifiers.new('Smooth rolled clay slab','SUBSURF');sub.levels=2
    return o

# Broad, slightly splayed trousers and joined rounded shoes.
for side in [-1,1]:
    garment('Wide cloth trouser leg',[(.29,side*.345,.325,.245),(.36,side*.345,.33,.25),(.72,side*.325,.285,.245),(1.18,side*.285,.245,.23),(1.43,side*.265,.255,.24)],pants)
    ellipsoid('Rounded ivory shoe',(side*.345,-.09,.20),(.355,.39,.205),white)
    # Broad shoe upper merges into the trouser cuff, with no hard square toe.
    # Shoe upper flows into the legs without a separate protruding ledge.
    for dx in [-.060,.066]:ellipsoid('Little shoe face dots',(side*.345+dx,-.478,.22),(.023,.012,.039),black,(0,.12*side,0))
    cord('Pocket diagonal',[(side*.43,-.243,1.31),(side*.37,-.251,1.24),(side*.30,-.252,1.20)],.006,pants)
# More rounded shoulders, soft upright torso, a shallow pocket impression.
garment('Hand shaped blue sweatshirt',[(1.40,0,.55,.255),(1.44,0,.56,.28),(1.64,0,.53,.29),(1.98,0,.41,.265),(2.28,0,.26,.205),(2.49,0,.18,.18)],blue)
ellipsoid('Hood folded on upper back',(0,.16,2.32),(.23,.10,.17),blue)
rounded('Soft collar',(0,0,2.47),(.36,.35,.16),.075,blue)
for side in [-1,1]:
    garment('Long sloped sleeve',[(1.48,side*.65,.145,.22),(1.51,side*.645,.15,.225),(1.75,side*.565,.155,.23),(2.03,side*.445,.15,.215),(2.25,side*.28,.13,.19)],blue)
    cord('Painted cuff line',[(side*.51,-.20,1.50),(side*.65,-.223,1.49),(side*.78,-.18,1.52)],.018,seam)
    ellipsoid('Small mitten hand',(side*.635,-.025,1.31),(.13,.14,.205),skin,(0,-side*.08,0))
    cord('Wide hoodie cord',[(side*.10,-.22,2.41),(side*.14,-.29,2.15),(side*.155,-.315,1.87)],.042,blue)
    plaque('Blue drawstring tip',[(429 if side<0 else 491,817),(448 if side<0 else 511,819),(446 if side<0 else 508,830),(433 if side<0 else 495,829)],(439 if side<0 else 501,823),-.327,.012,seam)
cord('Subtle pouch seam',[(-.26,-.291,1.65),(0,-.301,1.63),(.28,-.291,1.66)],.002,blue)
# A broad oval cheek with very little chin below the glasses.
garment('Soft oval face',[(2.54,0,.16,.16),(2.57,0,.43,.30),(2.64,0,.64,.39),(2.75,0,.76,.455),(2.96,0,.79,.485),(3.22,0,.77,.465),(3.46,0,.64,.41),(3.65,0,.32,.25),(3.69,0,.03,.04)],skin)
for side in [-1,1]:
    ellipsoid('Large low ear',(side*.785,-.005,2.85),(.165,.155,.20),skin,(0,side*.10,0))
    # The slight ear dish is sculpted into the silhouette, with no extra bead.
# Cap has the substantial rear volume visible in the turntable video.
ellipsoid('Black hair under shell',(0,.10,3.36),(.84,.58,.65),hair)
# Each silhouette below follows an individually identifiable clay slab in the photo.
def scalp(x,z): return -.22-.22*sqrt(max(0,1-(x/.98)**2-((z-3.35)/.94)**2))
plaque('Left outer swept slab',[(402,398),(358,405),(311,451),(285,507),(280,553),(299,566),(331,526),(345,482),(380,440)],(332,478),scalp,.075,hair)
plaque('Left long temple slab',[(362,442),(338,463),(318,516),(313,567),(325,610),(355,631),(369,626),(358,593),(357,545),(376,483)],(345,543),lambda x,z:scalp(x,z)-.015,.065,hair)
plaque('Left broad fringe',[(455,399),(422,397),(391,424),(370,472),(353,520),(356,554),(376,565),(406,557),(429,535),(443,495),(451,453)],(402,488),lambda x,z:scalp(x,z)-.055,.070,hair)
plaque('Central bent fringe',[(467,424),(460,449),(462,484),(449,526),(444,560),(463,557),(490,544),(511,522),(515,493),(500,474),(493,450)],(478,506),lambda x,z:scalp(x,z)-.075,.060,hair)
plaque('Right middle broad slab',[(491,400),(528,413),(550,455),(552,498),(549,541),(535,562),(510,559),(514,526),(511,493),(498,455)],(532,491),lambda x,z:scalp(x,z)-.045,.058,hair)
plaque('Right temple slab',[(552,435),(580,458),(594,500),(608,543),(607,589),(593,619),(573,640),(562,628),(565,590),(548,561),(554,526)],(579,548),scalp,.075,hair)
plaque('Upper right sweep',[(480,387),(513,383),(548,394),(578,413),(597,441),(593,470),(580,477),(557,450),(525,429),(489,415)],(548,422),lambda x,z:scalp(x,z)+.08,.095,hair)
plaque('Bent crown tuft',[(454,377),(480,356),(524,350),(553,361),(568,382),(565,399),(545,398),(507,385),(475,385)],(516,374),.02,.095,hair)
# Overlapping broad back plates, uneven lower edge matching the video.
for j,(x,tip) in enumerate([(-.64,2.76),(-.43,2.71),(-.19,2.77),(.08,2.74),(.35,2.80),(.58,2.91)]):
    lock('Back overlapping slab %02d'%j,[(x*.52,.44,3.83),(x*.94,.66,3.59),(x,.63,3.10),(x*.98,.40,tip)],.205 if j<4 else .18,.085)
# Rounded RECTANGULAR frames; eyes deliberately sit toward the bridge.
def glasses(name,cx,z,rx,rz):
    pts=[];r=.085
    for ox,oz,start in [(rx-r,rz-r,0),(-rx+r,rz-r,90),(-rx+r,-rz+r,180),(rx-r,-rz+r,270)]:
        for j in range(7):
            a=(start+j*90/6)*pi/180
            pts.append((cx+ox+r*cos(a),-.515,z+oz+r*sin(a)))
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=.014;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(pts)-1)
    for p,co in zip(spline.points,pts):p.co=(*co,1)
    spline.use_cyclic_u=True;o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);curve.materials.append(black)
for side in [-1,1]:
    glasses('Thin brown rounded rectangle',side*.267,2.985,.244,.156)
    ellipsoid('Inward set long eye',(side*.174,-.500,3.045),(.034,.013,.084),black,(0,side*.10,0))
    cord('Glasses side arm',[(side*.51,-.50,3.11),(side*.73,-.24,3.12),(side*.77,-.005,3.10)],.013,black)
cord('Low glasses bridge',[(-.025,-.522,3.08),(0,-.526,3.10),(.025,-.522,3.08)],.014,black)
plaque('Small curved red smile',[(458,618),(474,620),(491,616),(482,629),(475,633),(466,628)],(475,624),-.473,.013,red)
# Export only the portrait; retain lighting and camera for reproducible studio previews.
portrait=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT')
for obj in portrait: obj.select_set(True)
bpy.context.view_layer.objects.active=portrait[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/clay-portrait.glb'),use_selection=True,export_format='GLB')
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=64
scene.world=bpy.data.worlds.new('Studio'); scene.world.color=(.16,.16,.16)
for pos,power,size in [((-3,-4,7),380,4),((4,-2,4),180,4),((0,3,6),250,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,2))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-11,2.25)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,2))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=5
scene.camera=camera; scene.render.resolution_x=700; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.filepath=str(ROOT/'art/clay-portrait-studio.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/clay-portrait.blend'))
bpy.ops.render.render(write_still=True)


# Consistent side/back inspections from the same editable scene.
for label,pos in [('side',(11,0,2.25)),('back',(0,11,2.25)),('three-quarter',(5,-11,3.4))]:
    camera.location=pos; camera.rotation_euler=(Vector((0,0,2))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/f'art/clay-portrait-{label}.png');bpy.ops.render.render(write_still=True)

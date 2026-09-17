"""Build four original low-poly hull classes and transparent previews."""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
out = Path(parser.parse_args(sys.argv[sys.argv.index('--') + 1:]).output).resolve()
out.mkdir(parents=True, exist_ok=True)

ships = ['quiet-argument', 'the-hypothesis', 'county-line', 'garden-debt']
for ship in ships:
    for suffix in ['.blend', '.glb', '-preview.png', '.json']:
        if (out / (ship + suffix)).exists():
            raise FileExistsError(out / (ship + suffix))


def material(name, color, metal=0, roughness=.68, emission=0):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*rgb, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Emission Color'].default_value = (*rgb, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return result


ivory = material('aged ivory', '#d9d2b7')
steel = material('structural graphite', '#303944', .4, .5)
black = material('engine throat', '#11151b', .3, .4)
glass = material('smoked glass', '#203d49', .25, .3)
warm = material('warm lamp', '#ffc36e', emission=2.2)
mint = material('navigation lamp', '#8be0bd', emission=2.4)

military = material('military / neutral armor', '#777b76', .25, .62)
military_dark = material('military / machinery', '#3e4748', .4, .5)
warning = material('military / identification oxide', '#a34b36')

research = material('research / oxidized cyan', '#3d7f84')
research_pale = material('research / laboratory ceramic', '#b9cac4')
research_gold = material('research / instrument brass', '#b58b42', .45, .5)

institution = material('institution / nicotine grey', '#8b897b')
institution_dark = material('institution / old maroon', '#63383a')
institution_green = material('institution / faded green', '#5d7164')

colony = material('colony / fertile green', '#607b63')
colony_dark = material('colony / soil brown', '#67483c')
colony_ochre = material('colony / machinery ochre', '#b18438')


def empty(name, parent=None, pos=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = pos
    return obj


def finish(obj, name, mat, parent):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def box(name, pos, size, mat, parent, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('broad chamfers', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat, parent)


def cylinder(name, pos, radius, depth, mat, parent, axis='Z', top=None, vertices=12):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=pos)
    obj = bpy.context.object
    if axis == 'X':
        obj.rotation_euler.y = math.pi / 2
    elif axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    return finish(obj, name, mat, parent)


def sphere(name, pos, radius, mat, parent, segments=12, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings,
        radius=radius, location=pos)
    return finish(bpy.context.object, name, mat, parent)


def torus(name, pos, major, minor, mat, parent, rotate=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=16, minor_segments=6, location=pos, rotation=rotate)
    return finish(bpy.context.object, name, mat, parent)


def beam(name, start, end, thickness, mat, parent):
    start = Vector(start)
    end = Vector(end)
    delta = end - start
    obj = cylinder(name, (start + end) / 2, thickness, delta.length,
        mat, parent, vertices=6)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


def profile(name, rings, mats, parent):
    section = [(.72, 1), (-.72, 1), (-1, .55), (-1, -.48),
               (-.62, -1), (.62, -1), (1, -.48), (1, .55)]
    vertices = [(x, y * width, center + z * height)
                for x, width, height, center in rings for y, z in section]
    faces = [tuple(reversed(range(8)))]
    for ring in range(len(rings) - 1):
        for i in range(8):
            faces.append((ring * 8 + i, ring * 8 + (i + 1) % 8,
                (ring + 1) * 8 + (i + 1) % 8, (ring + 1) * 8 + i))
    faces.append(tuple((len(rings) - 1) * 8 + i for i in range(8)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    for mat in mats:
        mesh.materials.append(mat)
    for index, polygon in enumerate(mesh.polygons):
        polygon.material_index = 0 if (index - 1) % 8 in [0, 1, 7] else min(1, len(mats) - 1)
    return obj


def engine(parent, x, y, z, scale=1):
    cylinder('engine jacket', (x, y, z), .55 * scale, .75 * scale, steel, parent, 'X')
    cylinder('engine bell', (x - .58 * scale, y, z), .62 * scale, .42 * scale,
        steel, parent, 'X', top=.32 * scale)
    cylinder('engine throat', (x - .81 * scale, y, z), .4 * scale, .05, black, parent, 'X')
    cylinder('engine core', (x - .84 * scale, y, z), .13 * scale, .06, warm, parent, 'X')


def socket_set(root, values):
    for family, (location, mount) in values.items():
        obj = empty('socket_' + family, root, location)
        obj['family'] = family
        obj['mount'] = mount


def corvette():
    root = empty('quiet_argument')
    root['category'] = 'military'
    root['type'] = 'corvette / interceptor'
    root['history'] = 'patrol hull built around drive, sensors, and ammunition access'
    hull = empty('hull', root)
    profile('armored pressure hull', [(-4.7, .55, .5, 0), (-3.8, 1.2, .75, 0),
        (1.9, 1.18, .72, 0), (3.7, .82, .5, 0), (4.6, .2, .18, 0)],
        [military, military_dark], hull)
    box('armored command blister', (2.1, 0, .82), (1.75, 1.5, .58), military, hull, .16)
    box('sensor slit', (3.0, 0, .84), (.08, 1.05, .2), glass, hull, .03)
    box('ventral armor', (-.2, 0, -.88), (5.4, 1.5, .32), military_dark, hull, .09)
    drive = empty('drive', root)
    for y in [-.72, .72]:
        engine(drive, -4.1, y, 0, .9)
    box('reactor shield', (-3.45, 0, .4), (.4, 2.2, 1.65), military_dark, drive, .12)
    hardpoint = empty('hardpoint', root)
    for x in [-1.5, .2, 1.7]:
        for side in [-1, 1]:
            box('flush weapon door', (x, side * 1.2, .08), (.72, .08, .38), warning, hardpoint, .03)
    beam('dorsal rail mount', (-1.25, 0, .83), (1.25, 0, .83), .11, steel, hardpoint)
    box('rail breech', (-1.05, 0, 1.02), (.75, .55, .38), military_dark, hardpoint, .08)
    comms = empty('comms', root)
    beam('sensor mast', (1.2, .25, 1.08), (1.2, .25, 2.0), .04, steel, comms)
    box('sensor head', (1.2, .25, 2.0), (.5, .42, .3), military, comms, .05)
    for side in [-1, 1]:
        box('shuttered radiator', (-2.3, side * 1.55, -.4), (2.25, .12, .8), military_dark, drive, .03)
        for x in [-3.1, -2.55, -2, -1.45]:
            box('radiator shutter', (x, side * 1.58, -.4), (.42, .07, .68), steel, drive)
    cosmetics = empty('cosmetic', root)
    box('unit marking', (1.4, -1.21, -.35), (1.2, .06, .45), warning, cosmetics, .03)
    socket_set(root, {'power': ((-3.45, 0, .4), 'medium'), 'cruise': ((-4.2, 0, 0), 'medium'),
        'maneuver': ((3.2, 0, -.4), 'medium'), 'hardpoint': ((0, 0, 1), 'medium'),
        'utility': ((1.2, .25, 2), 'light'), 'cosmetic': ((1.4, -1.2, -.35), 'light')})
    return root


def survey():
    root = empty('the_hypothesis')
    root['category'] = 'research'
    root['type'] = 'survey vessel'
    root['history'] = 'long-baseline observatory with a replaceable laboratory cluster'
    hull = empty('hull', root)
    beam('load bearing truss', (-5.2, 0, 0), (4.5, 0, 0), .18, steel, hull)
    for x in [-4, -2, 0, 2, 4]:
        beam('truss brace', (x - .45, -.65, -.45), (x + .45, .65, .45), .06, steel, hull)
        beam('truss brace', (x - .45, .65, -.45), (x + .45, -.65, .45), .06, steel, hull)
    sphere('forward observatory', (4.6, 0, 0), 1.2, research_pale, hull, 16, 8)
    cylinder('observation band', (4.6, 0, 0), 1.23, .32, glass, hull, 'X', vertices=16)
    labs = empty('cargo', root)
    for index, x in enumerate([-2.8, -.9, 1]):
        color = [research, research_pale, research][index]
        box('replaceable laboratory', (x, 0, .05), (1.45, 1.8, 1.35), color, labs, .2)
        for side in [-1, 1]:
            box('laboratory window', (x, side * .91, .15), (.6, .06, .3), warm, labs, .04)
    comms = empty('comms', root)
    dish = empty('long_baseline_dish_pivot', comms, (2.4, 0, 1.25))
    beam('dish boom', (0, 0, 0), (0, 0, 1.15), .06, steel, dish)
    cylinder('survey dish', (0, 0, 1.05), .92, .18, research_pale, dish, top=.12, vertices=16)
    beam('receiver', (0, 0, 1.15), (0, 0, 1.55), .025, research_gold, dish)
    external = empty('external', root)
    for side in [-1, 1]:
        for x in [-2.8, -.9, 1]:
            cylinder('sample canister', (x, side * 1.25, -.25), .27, .8,
                research_gold, external, 'Y', vertices=10)
    drive = empty('drive', root)
    box('reactor instrument block', (-4.15, 0, 0), (1.15, 1.65, 1.5), research, drive, .18)
    for y in [-.72, .72]:
        engine(drive, -5, y, 0, .82)
    socket_set(root, {'power': ((-4.15, 0, 0), 'medium'), 'cruise': ((-5, 0, 0), 'medium'),
        'maneuver': ((4.6, 0, -.7), 'light'), 'cargo': ((-.9, 0, 0), 'medium'),
        'utility': ((2.4, 0, 2.4), 'medium'), 'external': ((0, 1.25, -.25), 'light')})
    return root


def prison():
    root = empty('county_line')
    root['category'] = 'institutional'
    root['type'] = 'prison barge'
    root['history'] = 'obsolete freight frame converted by a provincial corrections authority'
    hull = empty('hull', root)
    box('armored central spine', (-.8, 0, 0), (9.5, .75, .8), institution_dark, hull, .1)
    cargo = empty('cargo', root)
    for row, y in enumerate([-1.25, 1.25]):
        for index, x in enumerate([-3.5, -1.5, .5, 2.5]):
            box('detention module', (x, y, .1), (1.55, 1.6, 1.7), institution, cargo, .12)
            box('service door', (x, y + (-.82 if y < 0 else .82), .05),
                (.65, .06, 1.05), institution_dark, cargo, .05)
            for shift in [-.42, 0, .42]:
                box('narrow cell window', (x + shift, y + (-.86 if y < 0 else .86), .5),
                    (.16, .05, .22), glass, cargo, .02)
    command = empty('command', root)
    profile('escort command hull', [(3.6, .9, .72, .2), (5.25, 1.05, .82, .2),
        (6.2, .55, .4, .15)], [institution_green, institution_dark], command)
    box('guard bridge', (4.8, 0, 1.2), (1.6, 1.6, .65), institution_green, command, .15)
    box('bridge slit', (5.62, 0, 1.22), (.06, 1.08, .22), glass, command)
    hardpoint = empty('hardpoint', root)
    for x in [-2.6, 1.5, 4.2]:
        box('security turret base', (x, 0, 1.05), (.55, .55, .25), steel, hardpoint, .08)
        cylinder('security sensor', (x, 0, 1.35), .16, .35, warning, hardpoint, vertices=8)
    drive = empty('drive', root)
    box('shield wall', (-4.75, 0, 0), (.45, 3.5, 2.2), steel, drive, .14)
    for y in [-1.15, 0, 1.15]:
        engine(drive, -5.35, y, 0, .88)
    external = empty('external', root)
    torus('prisoner transfer collar', (5.0, -1.3, .15), .62, .16, institution_dark,
        external, (math.pi / 2, 0, 0))
    cosmetics = empty('cosmetic', root)
    box('provincial authority stripe', (-.5, -2.08, -.62), (5.8, .06, .18), warning, cosmetics)
    socket_set(root, {'power': ((-4.7, 0, .5), 'heavy'), 'cruise': ((-5.35, 0, 0), 'heavy'),
        'maneuver': ((5.3, 0, -.55), 'medium'), 'cargo': ((-.5, 0, .1), 'heavy'),
        'hardpoint': ((1.5, 0, 1.2), 'light'), 'external': ((5, -1.3, .15), 'medium'),
        'cosmetic': ((-.5, -2.05, -.6), 'light')})
    return root


def ark():
    root = empty('garden_debt')
    root['category'] = 'colony'
    root['type'] = 'terraforming colony ark'
    root['history'] = 'slow planetary works platform carrying atmosphere, soil, water, and settlers'
    hull = empty('hull', root)
    beam('primary spine', (-7.5, 0, 0), (7, 0, 0), .35, steel, hull)
    for x in [-5.5, -2.5, .5, 3.5]:
        torus('habitat wheel', (x, 0, 0), 2.15, .35, colony, hull, (0, math.pi / 2, 0))
        torus('wheel structure', (x, 0, 0), 1.55, .13, steel, hull, (0, math.pi / 2, 0))
        for angle in [0, math.pi / 2, math.pi, math.pi * 1.5]:
            beam('wheel spoke', (x, 0, 0),
                (x, 1.7 * math.cos(angle), 1.7 * math.sin(angle)), .09, steel, hull)
    cargo = empty('cargo', root)
    for x in [-4, -1, 2]:
        for y, z in [(-1.1, -1.1), (1.1, -1.1), (-1.1, 1.1), (1.1, 1.1)]:
            sphere('seed and biome vault', (x, y, z), .62, colony_dark, cargo, 12, 6)
    external = empty('external', root)
    for y in [-1.2, 1.2]:
        cylinder('water reservoir', (5.3, y, 0), .85, 2.3, ivory, external, 'X', vertices=12)
        for shift in [-.75, .75]:
            cylinder('reservoir band', (5.3 + shift, y, 0), .9, .12,
                colony_ochre, external, 'X', vertices=12)
    box('atmosphere works', (5.2, 0, 1.4), (2.6, 1.5, 1.1), colony_ochre, external, .18)
    for x in [4.45, 5.2, 5.95]:
        cylinder('processor stack', (x, 0, 2.25), .18, 1.1, steel, external, top=.12, vertices=8)
    command = empty('command', root)
    sphere('forward command sphere', (7.1, 0, 0), 1.05, colony, command, 12, 6)
    cylinder('command glazing', (7.1, 0, 0), 1.08, .3, glass, command, 'X', vertices=12)
    drive = empty('drive', root)
    box('reactor shield complex', (-6.8, 0, 0), (1.1, 3.8, 3.4), steel, drive, .2)
    for y in [-1.45, -.48, .48, 1.45]:
        engine(drive, -7.55, y, 0, 1.05)
    comms = empty('comms', root)
    beam('colony mast', (6.2, .2, 1.5), (6.2, .2, 3.5), .06, steel, comms)
    cylinder('colony beacon', (6.2, .2, 3.58), .11, .18, mint, comms, vertices=8)
    socket_set(root, {'power': ((-6.8, 0, 0), 'heavy'), 'cruise': ((-7.55, 0, 0), 'heavy'),
        'maneuver': ((7.1, 0, -.75), 'heavy'), 'cargo': ((0, 0, 0), 'heavy'),
        'utility': ((5.2, 0, 1.8), 'heavy'), 'external': ((5.3, 1.2, 0), 'heavy'),
        'cosmetic': ((7.1, -1, 0), 'medium')})
    return root


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def studio(scale):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.look = 'AgX - Medium High Contrast'
    group = empty('preview_only')
    for name, pos, color, energy, size in [
        ('key', (4, -10, 14), (1, .84, .67), 1900, 7),
        ('fill', (9, 6, 8), (.55, .75, 1), 1100, 8),
        ('rim', (-11, 2, 10), (.72, .62, 1), 1700, 6)
    ]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.color, data.size = energy, color, size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location, obj.parent = pos, group
        aim(obj, (0, 0, 0))
    data = bpy.data.cameras.new('orthographic_preview')
    camera = bpy.data.objects.new('orthographic_preview', data)
    bpy.context.collection.objects.link(camera)
    camera.parent = group
    data.type = 'ORTHO'
    data.ortho_scale = scale
    scene.camera = camera
    return camera


manifest = []
builders = [
    ('quiet-argument', 'military/corvette', corvette, 13.5),
    ('the-hypothesis', 'research/survey', survey, 14.5),
    ('county-line', 'institutional/prison-barge', prison, 16.5),
    ('garden-debt', 'colony/terraforming-ark', ark, 20.5)
]
for name, category, builder, scale in builders:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    root = builder()
    root['forward_axis'] = '+x'
    root['export_up_axis'] = '+y'
    camera = studio(scale)
    camera.location = (15, -22, 14)
    aim(camera, (0, 0, .4))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root] + list(root.children_recursive):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(out / (name + '.glb')), export_format='GLB',
        use_selection=True, export_animations=False, export_cameras=False,
        export_lights=False, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / (name + '.blend')))
    bpy.context.scene.render.filepath = str(out / (name + '-preview.png'))
    bpy.ops.render.render(write_still=True)
    meshes = [obj for obj in root.children_recursive if obj.type == 'MESH']
    item = {'name': name, 'category': category, 'mesh_count': len(meshes),
        'triangles': sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes),
        'bytes': (out / (name + '.glb')).stat().st_size}
    (out / (name + '.json')).write_text(json.dumps(item, indent=4) + '\n')
    manifest.append(item)

(out / 'fleet-classes.json').write_text(json.dumps(manifest, indent=4) + '\n')
print(json.dumps(manifest))

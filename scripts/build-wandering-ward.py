"""Build the Wandering Ward inhabited civil vessel.

Run with Blender:
    blender --background --python scripts/build-wandering-ward.py -- --output /tmp/wandering-ward
"""

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

for filename in ['wandering-ward.blend', 'wandering-ward.glb',
                 'wandering-ward-preview.png', 'wandering-ward-reverse.png',
                 'wandering-ward.json']:
    if (out / filename).exists():
        raise FileExistsError(out / filename)


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


ivory = material('aged civic enamel', '#d7d0b2')
blue = material('civil / municipal blue', '#497878')
blue_dark = material('civil / deep petrol', '#284d52')
red = material('market / faded vermilion', '#9a4b3e')
ochre = material('service / ochre', '#b58a3e')
green = material('habitation / old green', '#70846b')
steel = material('structure / graphite', '#343b45', .4, .52)
glass = material('glass / smoked blue', '#203d49', .25, .3)
warm = material('occupied window', '#ffc071', emission=2.2)
mint = material('navigation lamp', '#8be0bd', emission=2.4)
black = material('engine throat', '#11151b', .25, .42)


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


def beam(name, start, end, thickness, mat, parent):
    start = Vector(start)
    end = Vector(end)
    delta = end - start
    obj = cylinder(name, (start + end) / 2, thickness, delta.length,
        mat, parent, vertices=6)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


def profile(name, rings, materials, parent):
    section = [(.72, 1), (-.72, 1), (-1, .58), (-1, -.5),
               (-.62, -1), (.62, -1), (1, -.5), (1, .58)]
    vertices = [(x, y * width, center + z * height)
                for x, width, height, center in rings for y, z in section]
    faces = [tuple(reversed(range(8)))]
    for ring in range(len(rings) - 1):
        for index in range(8):
            faces.append((ring * 8 + index, ring * 8 + (index + 1) % 8,
                (ring + 1) * 8 + (index + 1) % 8, (ring + 1) * 8 + index))
    faces.append(tuple((len(rings) - 1) * 8 + index for index in range(8)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    for mat in materials:
        mesh.materials.append(mat)
    for index, polygon in enumerate(mesh.polygons):
        polygon.material_index = 0 if (index - 1) % 8 in [0, 1, 7] else min(1, len(materials) - 1)
    return obj


def window_row(parent, prefix, xs, y, z, outward, material=warm):
    for index, x in enumerate(xs):
        box(f'{prefix} window {index + 1:02}', (x, y, z), (.34, .07, .28), material, parent, .035)
        box(f'{prefix} hood {index + 1:02}', (x, y + outward * .03, z + .22),
            (.46, .13, .08), ivory, parent, .025)


def railing(parent, x1, x2, y, z):
    beam('terrace rail', (x1, y, z), (x2, y, z), .035, steel, parent)
    for x in [x1, (x1 + x2) / 2, x2]:
        beam('terrace stanchion', (x, y, z - .42), (x, y, z), .025, steel, parent)


def engine(parent, x, y, z):
    cylinder('engine jacket', (x, y, z), .7, .8, steel, parent, 'X')
    cylinder('engine bell', (x - .62, y, z), .75, .48, steel, parent, 'X', top=.42)
    cylinder('engine throat', (x - .88, y, z), .5, .05, black, parent, 'X')
    cylinder('engine marker', (x - .92, y, z), .18, .06, warm, parent, 'X')


def text_mesh(body, pos, size, mat, parent):
    bpy.ops.object.text_add(location=pos, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = 'painted name / ' + body
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = .002
    obj.data.resolution_u = 2
    font = Path('/System/Library/Fonts/Supplemental/Georgia Bold.ttf')
    if font.exists():
        obj.data.font = bpy.data.fonts.load(str(font))
    obj.data.materials.append(mat)
    obj.parent = parent
    bpy.ops.object.convert(target='MESH')


def build():
    root = empty('wandering_ward')
    root['category'] = 'civil'
    root['type'] = 'inhabited liner / market barge'
    root['history'] = 'retired municipal ferry enlarged into a drifting residential district'
    root['forward_axis'] = '+x'
    root['meters_per_unit'] = 12

    hull = empty('hull', root)
    profile('old ferry pressure hull', [(-6.2, .6, .55, 0), (-5.4, 1.8, 1.15, 0),
        (-2.5, 2.45, 1.45, 0), (2.9, 2.35, 1.38, 0), (5.3, 1.65, .98, .08),
        (6.4, .48, .38, .15)], [blue, blue_dark], hull)
    profile('reinforced lower keel', [(-5.1, 1.25, .35, -1.35), (3.8, 1.45, .4, -1.48),
        (5.4, .65, .2, -.95)], [steel], hull)
    for side in [-1, 1]:
        window_row(hull, 'original lower deck', [-3.8, -3, -2.2, -1.4, -.6, .2, 1, 1.8, 2.6, 3.4],
            side * 2.34, .28, side)
        beam('old rubbing strip', (-4.5, side * 2.1, -.62), (4.35, side * 1.72, -.62),
            .07, ochre, hull)
    box('forward bridge', (4.35, 0, 1.3), (2.25, 2.5, 1.0), ivory, hull, .25)
    box('forward glazing', (5.5, 0, 1.37), (.08, 2.05, .48), glass, hull, .04)
    box('bridge brow', (5.42, 0, 1.77), (.35, 2.75, .18), red, hull, .08)

    district = empty('habitation', root)
    box('lower civic deck', (-.6, 0, 1.78), (7.6, 4.35, .34), steel, district, .08)
    box('school and clinic', (-1.4, .38, 2.55), (4.1, 2.8, 1.35), green, district, .18)
    box('old ferry saloon', (1.55, -.25, 2.48), (1.55, 3.5, 1.15), ivory, district, .2)
    for side in [-1, 1]:
        window_row(district, 'clinic', [-2.75, -2.05, -1.35, -.65], side * 1.8, 2.55, side)
        window_row(district, 'saloon', [1.2, 1.75], side * 1.58, 2.5, side, glass)
        railing(district, -4.35, 3.2, side * 2.18, 2.36)

    box('middle terrace', (-1.2, 0, 3.35), (5.7, 3.7, .28), ivory, district, .07)
    box('residential block a', (-2.25, .35, 4.08), (2.55, 2.4, 1.35), red, district, .18)
    box('residential block b', (.45, -.25, 4.0), (2.2, 2.85, 1.2), blue, district, .18)
    for side in [-1, 1]:
        window_row(district, 'upper flats a', [-3, -2.35, -1.7], side * 1.57, 4.08, side)
        window_row(district, 'upper flats b', [-.15, .5, 1.15], side * 1.55, 4.0, side)
        railing(district, -4.05, 2.25, side * 1.86, 3.83)

    box('roof commons', (-1.05, 0, 4.92), (4.1, 2.6, .25), steel, district, .06)
    box('water and heat house', (-1.55, .2, 5.5), (1.65, 1.45, 1.0), ochre, district, .16)
    cylinder('municipal water tank', (.25, -.25, 5.45), .62, 1.5, ivory, district, 'Y')
    for side in [-1, 1]:
        railing(district, -3.05, 1.15, side * 1.31, 5.35)

    market = empty('cargo', root)
    box('public market deck', (-.3, -2.65, 1.82), (5.9, 1.15, .24), ivory, market, .06)
    for index, x in enumerate([-2.35, -1.15, .05, 1.25, 2.45]):
        color = [red, ochre, green, blue, red][index]
        box(f'market kiosk {index + 1:02}', (x, -2.85, 2.3), (.86, .7, .72), color, market, .1)
        box(f'market awning {index + 1:02}', (x, -3.28, 2.42), (1.0, .32, .1), ivory, market, .025)
        box(f'shop lamp {index + 1:02}', (x, -3.4, 2.25), (.14, .06, .14), warm, market, .02)
    railing(market, -3.25, 3.2, -3.25, 2.3)

    external = empty('external', root)
    crane = empty('market_crane_pivot', external, (-3.9, -2.25, 2.05))
    cylinder('crane pedestal', (0, 0, .35), .28, .7, ochre, crane)
    beam('crane boom', (0, 0, .62), (-.55, -.05, 2.35), .12, steel, crane)
    beam('crane jib', (-.55, -.05, 2.35), (1.15, -.05, 2.05), .09, steel, crane)
    beam('crane cable', (1.1, -.05, 2.05), (1.1, -.05, .8), .018, black, crane)
    cylinder('cargo hook', (1.1, -.05, .73), .11, .13, ochre, crane)

    comms = empty('comms', root)
    mast = empty('radio_mast_pivot', comms, (-1.4, .2, 5.95))
    beam('main mast', (0, 0, 0), (0, 0, 2.1), .055, steel, mast)
    beam('mast yard', (-.72, 0, 1.25), (.72, 0, 1.25), .035, steel, mast)
    beam('left aerial', (-.6, 0, 1.25), (-.75, 0, 1.75), .018, steel, mast)
    beam('right aerial', (.6, 0, 1.25), (.75, 0, 1.75), .018, steel, mast)
    cylinder('mast beacon', (0, 0, 2.15), .08, .13, mint, mast, vertices=8)
    dish = empty('radio_dish_pivot', comms, (.45, .1, 5.85))
    dish.rotation_euler = (0, -.18, .28)
    cylinder('dish stem', (0, 0, .25), .06, .5, steel, dish)
    cylinder('radio dish', (0, 0, .68), .72, .18, ivory, dish, top=.13, vertices=16)
    beam('dish receiver', (0, 0, .75), (0, 0, 1.1), .025, steel, dish)

    drive = empty('drive', root)
    box('reactor service wall', (-5.25, 0, .3), (.5, 3.4, 2.5), steel, drive, .16)
    for y in [-1.25, 0, 1.25]:
        engine(drive, -5.8, y, -.2)
    for side in [-1, 1]:
        box('folding radiator', (-4.7, side * 2.55, 2.1), (3.2, .12, 1.35), steel, drive, .04)
        for x in [-5.9, -5.35, -4.8, -4.25, -3.7]:
            box('radiator panel', (x, side * 2.57, 2.1), (.44, .08, 1.18), blue_dark, drive, .02)

    cosmetics = empty('cosmetic', root)
    box('municipal name board', (3.15, -2.28, -.55), (2.9, .1, .65), ivory, cosmetics, .08)
    text_mesh('ward vii', (1.98, -2.35, -.65), .38, blue_dark, cosmetics)
    for pos in [(-4.6, -2.1, .7), (-4.6, 2.1, .7), (5.65, -.7, .55), (5.65, .7, .55)]:
        sphere('navigation light', pos, .1, warm if pos[1] < 0 else mint, cosmetics, 8, 4)

    for family, location in {
        'power': (-5.1, 0, .7), 'cruise': (-5.8, 0, -.2),
        'maneuver': (5.1, 0, -.6), 'cargo': (-.3, -3.25, 2.1),
        'utility': (-1.4, .2, 6.8), 'external': (-3.9, -2.25, 2.3),
        'cosmetic': (3.15, -2.3, -.55)
    }.items():
        socket = empty('socket_' + family, root, location)
        socket['family'] = family
        socket['mount'] = 'heavy' if family in ['power', 'cruise', 'cargo'] else 'medium'
    return root


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def studio():
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
        ('key', (3, -9, 13), (1, .84, .66), 1800, 7),
        ('fill', (8, 5, 8), (.55, .75, 1), 1100, 8),
        ('rim', (-10, 2, 9), (.72, .62, 1), 1700, 6)
    ]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.color, data.size = energy, color, size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location, obj.parent = pos, group
        aim(obj, (0, 0, 1.5))
    data = bpy.data.cameras.new('orthographic_preview')
    camera = bpy.data.objects.new('orthographic_preview', data)
    bpy.context.collection.objects.link(camera)
    camera.parent = group
    data.type = 'ORTHO'
    data.ortho_scale = 18.5
    scene.camera = camera
    return camera


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
root = build()
camera = studio()

bpy.ops.object.select_all(action='DESELECT')
for obj in [root] + list(root.children_recursive):
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=str(out / 'wandering-ward.glb'), export_format='GLB',
    use_selection=True, export_animations=False, export_cameras=False,
    export_lights=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'wandering-ward.blend'))

camera.location = (15, -22, 14)
aim(camera, (0, 0, 2))
bpy.context.scene.render.filepath = str(out / 'wandering-ward-preview.png')
bpy.ops.render.render(write_still=True)
camera.location = (-15, -22, 13)
aim(camera, (0, 0, 2))
bpy.context.scene.render.filepath = str(out / 'wandering-ward-reverse.png')
bpy.ops.render.render(write_still=True)

meshes = [obj for obj in root.children_recursive if obj.type == 'MESH']
manifest = {
    'name': 'wandering-ward',
    'category': 'civil',
    'mesh_count': len(meshes),
    'triangles': sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes),
    'bytes': (out / 'wandering-ward.glb').stat().st_size
}
(out / 'wandering-ward.json').write_text(json.dumps(manifest, indent=4) + '\n')
print(json.dumps(manifest))

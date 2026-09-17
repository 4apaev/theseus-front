"""Original ship studies. Blender: --background --python build-ships.py -- --output DIR."""
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
for name in ['sunday-catch', 'patient-cargo']:
    for suffix in ['.blend', '.glb', '-preview.png', '-reverse.png']:
        if (out / (name + suffix)).exists():
            raise FileExistsError(out / (name + suffix))


def material(name, color, metal=0, emission=0):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [v / 12.92 if v <= 0.04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = .5 if metal else .68
    shader.inputs['Emission Color'].default_value = (*rgb, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return mat


ivory = material('warm enamel', '#dfd5b6')
teal = material('civil / petrol teal', '#387775')
teal_dark = material('civil / deep teal', '#244d52')
red = material('industrial / oxblood', '#7f3c37')
ochre = material('industrial / ochre', '#b78a37')
steel = material('structural graphite', '#353e4e', .35)
brass = material('restored brass', '#b9a06a', .65)
glass = material('blue glass', '#254655', .25)
ceramic = material('tank ceramic', '#adb7b7')
black = material('engine throat', '#141923')
warm = material('warm marker', '#ffca73', emission=2)
mint = material('green navigation light', '#9ce3c0', emission=2)


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
        mod = obj.modifiers.new('broad chamfers', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat, parent)


def cylinder(name, pos, radius, depth, mat, parent, axis='Z', top=None, vertices=12):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=pos)
    obj = bpy.context.object
    if axis == 'X':
        obj.rotation_euler.y = math.pi / 2
    if axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    return finish(obj, name, mat, parent)


def beam(name, start, end, thickness, mat, parent):
    delta = Vector(end) - Vector(start)
    obj = cylinder(name, (Vector(start) + Vector(end)) / 2, thickness, delta.length, mat, parent, vertices=6)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


def profile(name, rings, materials, parent):
    # Eight-sided pressure hull sections, ordered around the x axis.
    section = [(0.72, 1), (-0.72, 1), (-1, .6), (-1, -.5), (-.65, -1), (.65, -1), (1, -.5), (1, .6)]
    vertices = [(x, y * width, center + z * height) for x, width, height, center in rings for y, z in section]
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
    for mat in materials:
        mesh.materials.append(mat)
    for index, poly in enumerate(mesh.polygons):
        edge = (index - 1) % 8
        poly.material_index = 0 if edge in [0, 1, 7] else min(1, len(materials) - 1)
    # Recalculate for clean outward-facing caps and panels.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return obj


def text_mesh(body, pos, size, mat, parent):
    bpy.ops.object.text_add(location=pos, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = 'cast lettering / ' + body
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


def engine(parent, x, y, z, size=1):
    cylinder('engine jacket', (x, y, z), .62 * size, .8 * size, steel, parent, 'X')
    cylinder('nozzle bell', (x - .62 * size, y, z), .66 * size, .55 * size, steel, parent, 'X', top=.38 * size)
    cylinder('nozzle throat', (x - .91 * size, y, z), .52 * size, .04, black, parent, 'X')
    cylinder('combustion core', (x - .94 * size, y, z), .18 * size, .045, warm, parent, 'X')
    cylinder('service collar', (x + .35 * size, y, z), .64 * size, .13 * size, brass, parent, 'X')


def sockets(root, positions):
    for family, location in positions.items():
        obj = empty('socket_' + family, root, location)
        obj['family'] = family
        obj['mount'] = 'medium'


def sunday():
    root = empty('sunday_catch')
    root['category'] = 'civil'
    root['history'] = 'old orbital fishing vessel restored as a private yacht'
    hull = empty('hull', root)
    profile('original pressure hull', [(-3.8, .75, .65, 0), (-3.1, 1.4, .95, 0),
        (-1.5, 1.65, 1.1, 0), (1.4, 1.6, 1.05, 0), (3.2, 1.1, .75, 0), (4, .42, .4, 0)], [ivory, teal], hull)
    profile('lower keel', [(-3.2, .6, .17, -.95), (1.9, .7, .2, -1.03), (3.3, .3, .12, -.7)], [teal_dark], hull)
    profile('sealed panoramic salon', [(-.7, 1.03, .46, 1.25), (1.8, 1.08, .48, 1.3),
        (2.65, .77, .28, 1.12)], [glass], hull)
    profile('salon roof', [(-.85, 1.13, .09, 1.77), (1.8, 1.17, .09, 1.84),
        (2.7, .83, .065, 1.47)], [ivory], hull)
    for x in [-.55, .3, 1.15, 1.85]:
        for side in [-1, 1]:
            beam('window mullion', (x, side * 1.085, 1.04), (x, side * 1.085, 1.76), .035, brass, hull)
    for side in [-1, 1]:
        for a, b in [((-3.05, 1.41, .42), (-1.4, 1.66, .48)), ((-1.4, 1.66, .48), (1.35, 1.62, .45)),
            ((1.35, 1.62, .45), (3.15, 1.12, .27))]:
            beam('restored brass rubbing strip', (a[0], side * a[1], a[2]), (b[0], side * b[1], b[2]), .035, brass, hull)
        for x in [-2.6, -1.95]:
            box('original cabin window', (x, side * 1.54, .05), (.35, .06, .25), glass, hull, .045)
    cargo = empty('cargo', root)
    box('retained cargo hatch frame', (-.2, -1.64, -.2), (1.8, .11, 1.05), steel, cargo, .12)
    box('refinished hatch', (-.2, -1.72, -.2), (1.56, .08, .82), teal_dark, cargo, .08)
    for x in [-.8, .4]:
        box('hatch latch', (x, -1.79, -.2), (.12, .08, .26), brass, cargo, .025)
    drive = empty('drive', root)
    for y in [-.88, .88]:
        engine(drive, -3.55, y, -.12, .92)
        box('drive fairing', (-2.95, y, .28), (.9, .86, .72), teal, drive, .2)
    machinery = empty('external', root)
    cylinder('winch drum', (-1.85, 0, 1.28), .35, 1.35, steel, machinery, 'Y')
    for y in [-.69, .69]:
        cylinder('winch cheek', (-1.85, y, 1.28), .43, .13, ochre, machinery, 'Y')
        box('winch mounting foot', (-1.85, y, 1.0), (.64, .2, .2), teal_dark, machinery)
    for y in [-.4, -.2, 0, .2, .4]:
        cylinder('cable winding', (-1.85, y, 1.28), .37, .04, black, machinery, 'Y')
    crane = empty('crane_pivot', machinery, (-2.9, .5, 1.0))
    cylinder('crane pedestal', (0, 0, .18), .25, .36, ochre, crane)
    beam('folded boom', (0, 0, .3), (-.6, 0, 1.6), .12, ivory, crane)
    beam('boom return', (-.6, 0, 1.6), (.6, 0, 1.0), .09, ivory, crane)
    beam('hydraulic cylinder', (.02, -.16, .35), (-.45, -.16, 1.16), .065, steel, crane)
    cylinder('crane elbow', (-.6, 0, 1.6), .17, .24, brass, crane, 'Y')
    comms = empty('comms', root)
    cylinder('new navigation radome', (.3, .25, 2.05), .32, .35, ivory, comms, top=.18)
    beam('original aerial', (-.45, .55, 1.9), (-.45, .55, 2.9), .03, brass, comms)
    cylinder('aerial collar', (-.45, .55, 2.2), .085, .25, teal, comms)
    cosmetics = empty('cosmetic', root)
    plaque = empty('registry plaque', cosmetics, (2.23, -1.47, -.05))
    plaque.rotation_euler.z = .27
    box('name plaque', (0, 0, 0), (1.3, .08, .5), ivory, plaque, .06)
    text_mesh('sunday', (-.48, -.055, .025), .23, teal_dark, plaque)
    # A retained fish emblem: simple original silhouette, without a texture.
    mesh = bpy.data.meshes.new('fish emblem')
    mesh.from_pydata([(-.24, -.06, -.12), (-.07, -.06, -.05), (.12, -.06, -.12),
        (-.07, -.06, -.19), (.27, -.06, -.035), (.27, -.06, -.205)], [], [(0, 1, 2, 3), (2, 4, 5)])
    obj = bpy.data.objects.new('old fishing registry emblem', mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, obj.name, teal_dark, plaque)
    for y in [-.65, .65]:
        box('bow marker', (3.55, y, .05), (.16, .1, .17), warm, hull, .025)
    sockets(root, {'power': (-2, 0, -.6), 'cruise': (-3.8, 0, 0), 'maneuver': (2.7, 0, -.6),
        'cargo': (-.2, -1.8, -.2), 'utility': (.3, .25, 2.25), 'cosmetic': (2.2, -1.4, -.1), 'external': (-2.9, .5, 1)})
    return root


def tanker():
    root = empty('patient_cargo')
    root['category'] = 'industrial'
    root['history'] = 'orbital tank train; replacement forward tug, original tank racks'
    hull = empty('hull', root)
    box('load bearing spine', (-.8, 0, -.1), (9.3, .65, .7), red, hull, .12)
    cargo = empty('cargo', root)
    for x in [-3.6, -.9, 1.8]:
        for side in [-1, 1]:
            y = side * 1.32
            cylinder('pressure vessel', (x, y, .05), .88, 1.9, ceramic, cargo, 'X')
            for end in [-1, 1]:
                cylinder('dished end', (x + end * 1.02, y, .05), .88 if end > 0 else .4, .25, ceramic, cargo, 'X', top=.4 if end > 0 else .88)
                cylinder('vessel boss', (x + end * 1.19, y, .05), .2, .12, steel, cargo, 'X')
            for shift in [-.68, .68]:
                cylinder('retaining band', (x + shift, y, .05), .915, .13, ochre, cargo, 'X')
                box('saddle', (x + shift, y, -.8), (.22, 1.5, .25), red, cargo, .035)
            beam('valve riser', (x, y, .85), (x, y, 1.16), .085, steel, cargo)
            cylinder('service valve', (x, y, 1.2), .19, .08, ochre, cargo)
        box('cross member', (x, 0, -.94), (.26, 4.65, .24), red, hull, .035)
    external = empty('external', root)
    for side in [-1, 1]:
        y = side * 2.3
        beam('outer protection rail', (-4.9, y, -.75), (3.1, y, -.75), .11, red, external)
        for x in [-4.6, -1.9, .8, 3]:
            beam('tank protection upright', (x, y, -.8), (x, y, .75), .08, red, external)
        beam('main transfer pipe', (-4.5, side * .32, 1.18), (3.4, side * .32, 1.18), .12, ochre, external)
        for x in [-3.6, -.9, 1.8]:
            beam('tank feed pipe', (x, side * .32, 1.18), (x, side * 1.32, 1.18), .075, ochre, external)
    tug = empty('command', root)
    profile('armored tug cabin', [(3.2, .85, .7, .25), (4.9, .98, .78, .25),
        (5.65, .64, .49, .18)], [ochre, red], tug)
    profile('bridge glazing', [(4.2, .73, .18, 1.04), (5.1, .73, .18, 1.04), (5.43, .53, .12, .9)], [glass], tug)
    box('bridge cap', (4.55, 0, 1.29), (1.65, 1.65, .18), ivory, tug, .12)
    for side in [-1, 1]:
        box('boarding hatch', (3.8, side * .88, .1), (.65, .09, .86), steel, tug, .09)
        box('new tug paint patch', (4.65, side * .98, .08), (.75, .07, .55), ivory, tug, .035)
    text_mesh('07', (4.46, -1.025, -.04), .34, red, tug)
    drive = empty('drive', root)
    box('reactor shield', (-5.05, 0, 0), (.38, 3.5, 2.0), steel, drive, .18)
    for y in [-.96, .96]:
        engine(drive, -5.6, y, 0, 1.08)
    box('reactor service block', (-4.65, 0, .6), (.85, 1.2, 1.3), ochre, drive, .1)
    for side in [-1, 1]:
        box('radiator frame', (-5.2, side * 1.4, -1.55), (1.9, .14, .95), steel, drive, .03)
        for x in [-5.9, -5.6, -5.3, -5, -4.7, -4.4]:
            box('radiator fin', (x, side * 1.41, -1.55), (.035, .19, .87), ceramic, drive)
    comms = empty('comms', root)
    beam('utility mast', (3.45, .3, .95), (3.45, .3, 2.3), .055, steel, comms)
    box('sensor head', (3.45, .3, 2.25), (.42, .38, .34), ivory, comms, .07)
    box('sensor aperture', (3.45, .09, 2.25), (.23, .035, .14), glass, comms)
    cylinder('mast light', (3.45, .3, 2.5), .075, .12, mint, comms, vertices=8)
    cosmetics = empty('cosmetic', root)
    box('fleet registry plate', (-.9, -2.34, -.55), (1.9, .08, .5), ivory, cosmetics, .04)
    text_mesh('patient cargo', (-1.73, -2.39, -.61), .18, red, cosmetics)
    sockets(root, {'power': (-4.7, 0, .8), 'cruise': (-5.5, 0, 0), 'maneuver': (4.3, 0, -.6),
        'cargo': (-.9, 0, 0), 'utility': (3.45, .3, 2.3), 'external': (-1, 0, 1.3), 'cosmetic': (-.9, -2.4, -.6)})
    return root


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def studio():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (.32, .3, .42, 1)
    bg.inputs['Strength'].default_value = .35
    group = empty('preview_only')
    for name, pos, color, energy, size in [
        ('key', (1, -7, 11), (1, .9, .73), 1900, 6),
        ('fill', (5, 5, 6), (.58, .75, 1), 1000, 7),
        ('rim', (-8, 1, 7), (.8, .7, 1), 1600, 5)
    ]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.color, data.size = energy, color, size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location, obj.parent = pos, group
        aim(obj, (0, 0, 0))
    data = bpy.data.cameras.new('orthographic_preview')
    cam = bpy.data.objects.new('orthographic_preview', data)
    bpy.context.collection.objects.link(cam)
    cam.parent = group
    data.type = 'ORTHO'
    scene.camera = cam
    return cam


manifest = []
for name, make in [('sunday-catch', sunday), ('patient-cargo', tanker)]:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    root = make()
    root['forward_axis'] = '+x'
    root['scale_note'] = 'prototype units; set physical dimensions before domain integration'
    root['export_up_axis'] = '+y'
    cam = studio()
    cam.location = (12, -18, 11)
    aim(cam, (-.3, 0, .25))
    cam.data.ortho_scale = 13.2 if name == 'sunday-catch' else 16.2
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root] + list(root.children_recursive):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(out / (name + '.glb')), export_format='GLB',
        use_selection=True, export_animations=False, export_cameras=False, export_lights=False, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / (name + '.blend')))
    bpy.context.scene.render.filepath = str(out / (name + '-preview.png'))
    bpy.ops.render.render(write_still=True)
    cam.location = (-13, -17, 10)
    aim(cam, (-.3, 0, .25))
    bpy.context.scene.render.filepath = str(out / (name + '-reverse.png'))
    bpy.ops.render.render(write_still=True)
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    manifest.append({'name': name, 'mesh_count': len(meshes),
        'triangles': sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in meshes),
        'bytes': (out / (name + '.glb')).stat().st_size})
(out / 'ships.json').write_text(json.dumps(manifest, indent=4) + '\n')
print(json.dumps(manifest))

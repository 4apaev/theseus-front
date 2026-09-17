"""Build the remaining low-poly fleet variants for the browser catalog."""

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

specs = [
    ('honest-weight', 'freighter', 'industrial', 0), ('general-delivery', 'freighter', 'industrial', 1), ('long-ton', 'freighter', 'industrial', 2),
    ('amber-reserve', 'tanker', 'industrial', 1), ('borrowed-rain', 'tanker', 'industrial', 2),
    ('small-mercy', 'tug', 'industrial', 0), ('yard-dog', 'tug', 'industrial', 1), ('last-purchase', 'tug', 'industrial', 2),
    ('first-weather', 'colony', 'industrial', 1), ('borrowed-sea', 'colony', 'industrial', 2),
    ('evening-post', 'liner', 'civil', 1), ('continental-service', 'liner', 'civil', 2),
    ('short-notice', 'transport', 'civil', 0), ('local-arrangement', 'transport', 'civil', 1), ('nine-seats', 'transport', 'civil', 2),
    ('blue-hour', 'yacht', 'civil', 1), ('private-weather', 'yacht', 'civil', 2),
    ('discovery-one', 'research', 'research', 0), ('useful-doubt', 'research', 'research', 2),
    ('final-authority', 'battleship', 'security', 0), ('long-memory', 'battleship', 'security', 1), ('public-reason', 'battleship', 'security', 2),
    ('common-defense', 'frigate', 'security', 0), ('patient-vector', 'frigate', 'security', 1), ('iron-clause', 'frigate', 'security', 2),
    ('necessary-force', 'corvette', 'security', 1), ('last-warning', 'corvette', 'security', 2),
    ('due-process', 'prison', 'institutional', 1), ('closed-circuit', 'prison', 'institutional', 2),
]


def mat(name, value, metal=0, emission=0):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*rgb, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = .55 if metal else .7
    shader.inputs['Emission Color'].default_value = (*rgb, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return result


steel = mat('structure / graphite', '#303944', .4)
black = mat('engine throat', '#11151b', .3)
glass = mat('smoked glass', '#203d49', .2)
lamp = mat('warm lamp', '#ffc36e', emission=2)
palettes = {
    'industrial': [mat('industrial / ochre', '#b18438'), mat('industrial / enamel', '#c7bea3'), mat('industrial / oxide', '#744238')],
    'civil': [mat('civil / ivory', '#d9d2b7'), mat('civil / petrol', '#477878'), mat('civil / coral', '#985449')],
    'research': [mat('research / cyan', '#3d7f84'), mat('research / ceramic', '#b9cac4'), mat('research / brass', '#b58b42', .35)],
    'security': [mat('security / armor', '#747a77', .25), mat('security / machinery', '#41494b', .4), mat('security / oxide', '#9a4938')],
    'institutional': [mat('institutional / grey', '#8b897b'), mat('institutional / maroon', '#63383a'), mat('institutional / green', '#5d7164')],
}


def empty(name, parent=None, pos=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = pos
    return obj


def box(name, pos, size, material, parent, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('chamfer', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def cylinder(name, pos, radius, depth, material, parent, axis='Z', top=None, vertices=10):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=pos)
    obj = bpy.context.object
    obj.name = name
    if axis == 'X': obj.rotation_euler.y = math.pi / 2
    if axis == 'Y': obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def sphere(name, pos, radius, material, parent):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def torus(name, pos, major, minor, material, parent):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=16, minor_segments=6, location=pos, rotation=(0, math.pi / 2, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def beam(name, start, end, radius, material, parent):
    start, end = Vector(start), Vector(end)
    delta = end - start
    obj = cylinder(name, (start + end) / 2, radius, delta.length, material, parent, vertices=6)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


def engine(parent, x, y, z, scale=1):
    cylinder('engine jacket', (x, y, z), .48 * scale, .7 * scale, steel, parent, 'X')
    cylinder('engine bell', (x - .52 * scale, y, z), .57 * scale, .38 * scale, steel, parent, 'X', top=.3 * scale)
    cylinder('engine throat', (x - .73 * scale, y, z), .36 * scale, .04, black, parent, 'X')
    cylinder('engine glow', (x - .76 * scale, y, z), .12 * scale, .05, lamp, parent, 'X')


def sockets(root, length, heavy=False):
    size = 'heavy' if heavy else 'medium'
    for family, location in {
        'power': (-length * .36, 0, .35), 'cruise': (-length * .48, 0, 0),
        'maneuver': (length * .42, 0, -.4), 'cargo': (0, 0, .2),
        'utility': (length * .08, .2, 1.5), 'external': (-length * .1, 1.3, .2),
        'cosmetic': (length * .2, -1.1, -.2),
    }.items():
        obj = empty('socket_' + family, root, location)
        obj['family'], obj['mount'] = family, size if family in ['power', 'cruise', 'cargo'] else 'light'


def build(name, kind, category, variant):
    p = palettes[category]
    length = {'corvette': 8, 'frigate': 10, 'battleship': 14, 'tanker': 12,
        'freighter': 11, 'tug': 8, 'colony': 16, 'liner': 12,
        'transport': 8, 'yacht': 8, 'research': 12, 'prison': 12}[kind]
    length *= [1, 1.06, .94][variant]
    root = empty(name.replace('-', '_'))
    root['category'], root['type'], root['variant'] = category, kind, variant + 1
    hull, cargo, drive = empty('hull', root), empty('cargo', root), empty('drive', root)
    comms, external, cosmetic = empty('comms', root), empty('external', root), empty('cosmetic', root)
    box('structural spine', (0, 0, 0), (length, .55, .55), steel, hull, .08)
    box('forward command', (length * .34, 0, .35), (length * .2, 1.55, 1.25), p[0], hull, .2)
    box('bridge glazing', (length * .445, 0, .52), (.06, 1.05, .3), glass, hull, .02)
    engines = 4 if kind in ['battleship', 'colony'] else 3 if kind in ['tanker', 'prison'] else 2
    for index in range(engines):
        y = (index - (engines - 1) / 2) * .82
        engine(drive, -length * .45, y, 0, 1.05 if engines > 2 else .85)
    box('reactor shield', (-length * .39, 0, .25), (.45, max(2, engines * .7), 1.7), p[1], drive, .12)

    if kind == 'freighter':
        for row in [-1, 1]:
            for index, x in enumerate([-2.7, -1, .7, 2.4]):
                box('freight container', (x, row * 1.05, .1), (1.35, 1.25, 1.3), p[(index + variant) % 3], cargo, .1)
        beam('loading crane', (-1.8, -1.8, .5), (-.2, -1.8, 2.1), .09, steel, external)
    elif kind == 'tanker':
        for x in [-3, 0, 3]:
            for y in [-1.15, 1.15]:
                cylinder('pressure tank', (x, y, .05), .74, 1.8, p[1], cargo, 'X')
                cylinder('tank band', (x, y, .05), .79, .12, p[2], cargo, 'X')
        beam('transfer pipe', (-3.8, 0, 1), (3.8, 0, 1), .1, p[2], external)
    elif kind == 'tug':
        box('machinery block', (-.5, 0, .4), (3.2, 2.1, 1.7), p[0], hull, .18)
        for side in [-1, 1]:
            beam('towing arm', (-1.2, side * .7, .4), (-3.3, side * 1.4, 1.2), .13, steel, external)
        cylinder('tow winch', (1.1, 0, 1.25), .45, 1.4, p[2], external, 'Y')
    elif kind == 'colony':
        for x in [-4.5, -1.5, 1.5, 4.5]:
            torus('habitat wheel', (x, 0, 0), 1.65 + variant * .12, .28, p[0], cargo)
            for angle in [0, math.pi / 2, math.pi, math.pi * 1.5]:
                beam('wheel spoke', (x, 0, 0), (x, 1.35 * math.cos(angle), 1.35 * math.sin(angle)), .07, steel, cargo)
        for x in [-3, 0, 3]: sphere('biome vault', (x, 1.15, 1.15), .55, p[2], cargo)
    elif kind == 'liner':
        for tier, z in enumerate([.65, 1.55, 2.35]):
            box('passenger deck', (-.4 - tier * .25, 0, z), (length * (.66 - tier * .08), 2.4 - tier * .25, .65), p[tier], cargo, .18)
            for x in [-2.8, -1.8, -.8, .2, 1.2, 2.2]:
                box('lit cabin', (x, -1.23 + tier * .12, z), (.32, .05, .2), lamp, cargo, .02)
    elif kind == 'transport':
        box('passenger cabin', (-.3, 0, .55), (length * .62, 2.05, 1.45), p[0], cargo, .25)
        for x in [-2, -1.2, -.4, .4, 1.2, 2]:
            box('passenger window', (x, -1.04, .7), (.38, .05, .28), glass, cargo, .04)
        for y in [-1.2, 1.2]: cylinder('docking collar', (-1.8, y, .2), .33, .35, p[2], external, 'Y')
    elif kind == 'yacht':
        box('restored salon', (-1.2, 0, .8), (length * .48, 1.75, 1.25), p[0], cargo, .32)
        box('panoramic glass', (-1.1, -0.9, .92), (length * .37, .05, .52), glass, cargo, .05)
        beam('brightwork', (-2.8, -1, .25), (2.1, -.82, .25), .04, p[2], cosmetic)
        cylinder('old winch', (1.25, 0, 1.3), .34, 1.1, p[2], external, 'Y')
    elif kind == 'research':
        if name == 'discovery-one':
            sphere('command sphere', (length * .39, 0, 0), 1.25, p[1], hull)
            beam('long instrument spine', (-length * .32, 0, 0), (length * .28, 0, 0), .14, steel, hull)
            box('reactor block', (-length * .28, 0, 0), (2.2, 1.7, 1.6), p[0], hull, .2)
        else:
            for x in [-2.7, -.8, 1.1]: box('laboratory', (x, 0, .2), (1.5, 1.8, 1.45), p[(variant + int(x)) % 3], cargo, .18)
            sphere('observatory', (length * .39, 0, 0), 1.05, p[1], hull)
        cylinder('survey dish', (.7, 0, 1.8), .78, .16, p[1], comms, top=.12, vertices=14)
        beam('receiver', (.7, 0, 1.85), (.7, 0, 2.25), .03, p[2], comms)
    elif kind in ['battleship', 'frigate', 'corvette']:
        armor = {'battleship': (length * .7, 2.5, 1.7), 'frigate': (length * .62, 1.9, 1.25), 'corvette': (length * .58, 1.55, .95)}[kind]
        box('armored mission hull', (-.2, 0, .25), armor, p[0], hull, .18)
        hardpoint = empty('hardpoint', root)
        count = {'battleship': 4, 'frigate': 3, 'corvette': 2}[kind]
        for i in range(count):
            x = -length * .24 + i * length * .48 / max(1, count - 1)
            box('weapon access', (x, -armor[1] / 2 - .04, .35), (.65, .08, .4), p[2], hardpoint, .03)
            box('dorsal mount', (x, 0, armor[2] / 2 + .42), (.55, .55, .3), p[1], hardpoint, .06)
        for side in [-1, 1]: box('shuttered radiator', (-length * .2, side * (armor[1] / 2 + .3), -.45), (length * .3, .1, .72), p[1], drive, .03)
    elif kind == 'prison':
        for y in [-1.05, 1.05]:
            for x in [-3, -1, 1, 3]:
                box('detention module', (x, y, .2), (1.55, 1.35, 1.6), p[0], cargo, .1)
                box('secure door', (x, y + (-.7 if y < 0 else .7), .15), (.62, .05, .95), p[1], cargo, .04)
        for x in [-2.2, 1.9]: cylinder('security sensor', (x, 0, 1.35), .16, .35, p[2], external, vertices=8)

    beam('radio mast', (length * .16, .2, 1), (length * .16, .2, 2.05), .04, steel, comms)
    box('sensor head', (length * .16, .2, 2.05), (.38, .32, .28), p[1], comms, .04)
    sockets(root, length, kind in ['battleship', 'colony', 'tanker', 'prison'])
    return root


manifest = []
for name, kind, category, variant in specs:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    root = build(name, kind, category, variant)
    root['forward_axis'], root['export_up_axis'] = '+x', '+y'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root] + list(root.children_recursive): obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(out / (name + '.glb')), export_format='GLB',
        use_selection=True, export_animations=False, export_cameras=False, export_lights=False, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / (name + '.blend')))
    meshes = [obj for obj in root.children_recursive if obj.type == 'MESH']
    manifest.append({'name': name, 'kind': kind, 'category': category,
        'mesh_count': len(meshes),
        'triangles': sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in meshes),
        'bytes': (out / (name + '.glb')).stat().st_size})

(out / 'fleet-expansion.json').write_text(json.dumps(manifest, indent=4) + '\n')
print(json.dumps(manifest))

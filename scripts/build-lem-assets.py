"""Build original low-poly lem station and reactor assets with Blender.

Run: blender --background --python build_lem.py -- --output /absolute/output
Output directory must not already contain these asset files.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(options.output).resolve()
out.mkdir(parents=True, exist_ok=True)
for filename in ['lem-station.blend', 'lem-station.glb', 'reactor-mk02.blend', 'reactor-mk02.glb']:
    if (out / filename).exists():
        raise FileExistsError(out / filename)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0, emission=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    node = result.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = 0.72
    if emission:
        node.inputs['Emission Color'].default_value = (*color, 1)
        node.inputs['Emission Strength'].default_value = emission
    return result


ivory = material('enamel / ivory', (0.72, 0.68, 0.52))
teal = material('enamel / petrol', (0.075, 0.22, 0.23))
red = material('frame / oxblood', (0.27, 0.085, 0.075))
dark = material('structure / charcoal', (0.075, 0.085, 0.12))
gold = material('fittings / ochre', (0.65, 0.37, 0.075), 0.25)
glass = material('glass / midnight', (0.035, 0.095, 0.14), 0.2)
warm = material('window / warm', (1, 0.6, 0.16), emission=1.3)
mint = material('beacon / mint', (0.25, 0.85, 0.63), emission=2)


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    return obj


def finish(obj, name, mat, parent):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def box(name, location, size, mat, parent):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent)


def cylinder(name, location, radius, depth, mat, parent, vertices=12, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=location)
    return finish(bpy.context.object, name, mat, parent)


def beam(name, start, end, radius, mat, parent):
    start, end = Vector(start), Vector(end)
    obj = cylinder(name, (start + end) / 2, radius, (end - start).length, mat, parent, 6)
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    return obj


root = empty('lem_station')
root['meters_per_unit'] = 1
root['description'] = 'original observatory with later market and repair additions'
core = empty('observatory', parent=root)
cylinder('original_pressure_hull', (0, 0, -0.25), 1.45, 5.2, ivory, core)
cylinder('base_collar', (0, 0, -2.85), 1.6, 0.3, red, core)
cylinder('upper_collar', (0, 0, 2.25), 1.52, 0.22, teal, core)
cylinder('observation_glazing', (0, 0, 2.7), 1.34, 0.65, glass, core)
cylinder('roof', (0, 0, 3.25), 1.47, 0.5, ivory, core, top=0.72)
cylinder('roof_cap', (0, 0, 3.6), 0.72, 0.2, teal, core)
beam('observatory_aerial', (0, 0, 3.7), (0, 0, 5.1), 0.045, gold, core)
for index in range(12):
    angle = index * math.tau / 12
    beam('window_mullion', (1.36 * math.cos(angle), 1.36 * math.sin(angle), 2.38),
        (1.36 * math.cos(angle), 1.36 * math.sin(angle), 3.02), 0.045, ivory, core)
for x in [-0.6, 0, 0.6]:
    box('habitation_window', (x, -1.39, 0.15), (0.24, 0.07, 0.38), warm, core)
box('nameplate', (0, -1.48, 1.3), (1.65, 0.12, 0.7), teal, core)
bpy.ops.object.text_add(location=(-0.65, -1.56, 1.06), rotation=(math.pi / 2, 0, 0))
text = bpy.context.object
text.name = 'cast_lettering_lem'
text.data.body = 'LEM'
text.data.size = 0.65
text.data.extrude = 0.008
font_path = Path('/System/Library/Fonts/Supplemental/Georgia Bold.ttf')
if font_path.exists():
    text.data.font = bpy.data.fonts.load(str(font_path))
text.data.materials.append(ivory)
text.parent = core
bpy.ops.object.convert(target='MESH')

market = empty('market', parent=root)
box('market_connector', (-2, 0, -0.6), (2.2, 0.7, 0.7), ivory, market)
box('market_hall', (-3.65, 0, -0.8), (2.15, 2.3, 1.65), teal, market)
box('market_roof', (-3.65, 0, 0.08), (2.3, 2.45, 0.15), ivory, market)
box('freight_annex', (-3.9, 0, -2.05), (1.55, 1.8, 0.8), red, market)
for x in [-4.25, -3.65, -3.05]:
    box('shopfront_light', (x, -1.17, -0.45), (0.4, 0.06, 0.46), warm, market)
for index, x in enumerate([-4.1, -3.25]):
    box('freight_container', (x, 0.1, 0.48), (0.7, 1, 0.65), gold if index else red, market)
empty('socket_market', (-3.65, -1.25, -0.5), root)

comms = empty('comms', parent=root)
box('signals_connector', (1.9, 0.65, 1.35), (1.65, 0.65, 0.65), ivory, comms)
box('signals_office', (3, 0.65, 1.5), (1.65, 1.65, 1.2), teal, comms)
box('signals_roof', (3, 0.65, 2.18), (1.8, 1.8, 0.14), ivory, comms)
for x in [2.55, 3, 3.45]:
    box('signals_window', (x, -0.19, 1.5), (0.25, 0.06, 0.45), warm, comms)
cylinder('ansible_housing', (3, 0.65, 2.65), 0.32, 0.8, ivory, comms)
cylinder('ansible_cap', (3, 0.65, 3.07), 0.34, 0.12, gold, comms)
empty('socket_comms', (3, -0.3, 1.5), root)

rig = empty('rig', parent=root)
box('berth_connector', (2.7, -0.45, -1.3), (3.2, 0.95, 0.95), ivory, rig)
box('berth_collar', (4.1, -0.45, -1.3), (0.3, 1.2, 1.2), gold, rig)
for y in [-1.08, 0.18]:
    beam('berth_rail', (3.8, y, -1.9), (5.4, y, -1.9), 0.095, dark, rig)
    beam('berth_arm', (5.4, y, -1.9), (5.4, y, -0.8), 0.07, gold, rig)
empty('socket_berth', (5.4, -0.45, -1.3), root)

dish_support = empty('dish_support', parent=root)
box('dish_link', (-1.6, 0.65, 1.3), (1.3, 0.55, 0.55), ivory, dish_support)
for y in [0.25, 1.05]:
    beam('dish_strut', (-2.6, y, 0.5), (-2.6, y, 3.6), 0.12, red, dish_support)
    beam('dish_brace', (-2.6, y, 0.5), (-3.6, y, 2.4), 0.09, red, dish_support)
pivot = empty('dish_pivot', (-2.6, 0.65, 3.65), root)
pivot.rotation_euler = (math.radians(62), 0, math.radians(-22))
dish = empty('dish_assembly', parent=pivot)
verts, faces = [(0, 0, 0)], []
segments = 16
for radius in [0.65, 1.3, 2.05]:
    for i in range(segments):
        angle = i * math.tau / segments
        verts.append((radius * math.cos(angle), radius * math.sin(angle), 0.17 * radius * radius))
for i in range(segments):
    j = (i + 1) % segments
    faces.append((0, 1 + i, 1 + j))
for ring in range(2):
    a = 1 + ring * segments
    b = a + segments
    for i in range(segments):
        j = (i + 1) % segments
        faces.append((a + i, b + i, b + j, a + j))
mesh = bpy.data.meshes.new('dish_facets')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('listening_dish', mesh)
bpy.context.collection.objects.link(obj)
finish(obj, 'listening_dish', ivory, dish)
for i in range(3):
    angle = i * math.tau / 3
    beam('feed_support', (1.8 * math.cos(angle), 1.8 * math.sin(angle), 0.55),
        (0, 0, 1.35), 0.035, dark, dish)
cylinder('feed_receiver', (0, 0, 1.38), 0.12, 0.35, gold, dish)
base_angle = pivot.rotation_euler.z
for frame, offset in [(1, 0), (121, math.radians(8)), (241, 0)]:
    pivot.rotation_euler.z = base_angle + offset
    pivot.keyframe_insert(data_path='rotation_euler', frame=frame)

beacons = empty('beacons', parent=root)
for name, pos in [('beacon_port', (-4.7, -1.2, 0.25)), ('beacon_berth', (4.15, -1.08, -0.55))]:
    cylinder(name, pos, 0.085, 0.14, mint, beacons, 8)


def descendants(obj):
    return [obj] + list(obj.children_recursive)


def select_asset(obj):
    bpy.ops.object.select_all(action='DESELECT')
    for child in descendants(obj):
        child.select_set(True)
    bpy.context.view_layer.objects.active = obj


scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 241
scene.render.fps = 24
scene.frame_set(1)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.world.color = (0.19, 0.16, 0.27)
scene.view_settings.view_transform = 'AgX'


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


preview = empty('preview_only')
for name, pos, color, energy, size in [
    ('key', (-7, -10, 14), (1, 0.88, 0.68), 2100, 8),
    ('fill', (6, -2, 5), (0.59, 0.65, 1), 1000, 7),
    ('rim', (2, 8, 9), (0.75, 0.62, 1), 1700, 6)
]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.color = color
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    aim(obj, (0, 0, 0))
    obj.parent = preview
data = bpy.data.cameras.new('preview_camera')
camera = bpy.data.objects.new('preview_camera', data)
bpy.context.collection.objects.link(camera)
camera.parent = preview
camera.location = (12, -20, 12)
aim(camera, (0, 0, 0.85))
data.type = 'ORTHO'
data.ortho_scale = 14
data.lens = 50
scene.camera = camera


def export(obj, name, animations=False):
    select_asset(obj)
    bpy.ops.export_scene.gltf(filepath=str(out / f'{name}.glb'), export_format='GLB',
        use_selection=True, export_animations=animations, export_cameras=False,
        export_lights=False, export_yup=True)


export(root, 'lem-station', True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'lem-station.blend'))
scene.render.filepath = str(out / 'lem-station-preview.png')
bpy.ops.render.render(write_still=True)
for obj in descendants(pivot) + descendants(beacons):
    obj.hide_render = True
scene.render.filepath = str(out / 'lem-station-base.png')
bpy.ops.render.render(write_still=True)
for obj in descendants(pivot) + descendants(beacons):
    obj.hide_render = False

metadata = {
    'coordinates': 'blender z up; glb is y up; glb mapping [x,z,-y]',
    'camera_position_blender': list(camera.location),
    'camera_target_blender': [0, 0, 0.85],
    'orthographic_vertical_span': data.ortho_scale * scene.render.resolution_y / scene.render.resolution_x,
    'image_size': [scene.render.resolution_x, scene.render.resolution_y],
    'hybrid_hidden_groups': ['dish_pivot', 'beacons'],
    'hotspots': ['socket_market', 'socket_comms', 'socket_berth'],
    'animation': 'dish scans 8 degrees and returns over 10 seconds; emission beacons are runtime controlled',
    'station_meshes': sum(obj.type == 'MESH' for obj in descendants(root)),
    'station_triangles': sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        for obj in descendants(root) if obj.type == 'MESH')
}
(out / 'lem-station-camera.json').write_text(json.dumps(metadata, indent=4) + '\n')

# Separate, reusable cargo-scale module. Do not export the station with it.
for obj in descendants(root):
    obj.hide_render = True
reactor = empty('reactor_mk02')
cylinder('reactor_case', (0, 0, 0), 0.55, 1.65, ivory, reactor, 10)
for z in [-0.85, 0.85]:
    cylinder('end_collar', (0, 0, z), 0.56, 0.18, dark, reactor, 10)
    cylinder('connector', (0, 0, z * 1.17), 0.28, 0.15, gold, reactor, 10)
for x in [-0.2, 0.2]:
    box('service_latch', (x, -0.53, 0.25), (0.14, 0.08, 0.26), teal, reactor)
empty('socket_power', (0, 0, -1.08), reactor)
camera.location = (3, -5, 3)
aim(camera, (0, 0, 0))
data.ortho_scale = 3.5
scene.frame_end = 1
export(reactor, 'reactor-mk02')
# Remove unrelated station objects from the reactor source file.
for obj in reversed(descendants(root)):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'reactor-mk02.blend'))
scene.render.filepath = str(out / 'reactor-mk02-preview.png')
bpy.ops.render.render(write_still=True)
print('asset manifest:', json.dumps(metadata))

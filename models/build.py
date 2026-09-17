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

for filename in [ 'lem-station.blend', 'lem-station.glb', 'reactor-mk02.blend', 'reactor-mk02.glb' ]:
    if (out / filename).exists():
        raise FileExistsError(out / filename)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0, emission=0):
    result               = bpy.data.materials.new(name)

    result.use_nodes     = True
    result.diffuse_color = (*color, 1)

    node = result.node_tree.nodes.get('Principled BSDF')

    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = 0.72

    if emission:
        node.inputs['Emission Color'].default_value = (*color, 1)
        node.inputs['Emission Strength'].default_value = emission

    return result

ivory = material('enamel / ivory'       , (0.72  , 0.68  , 0.52))
teal  = material('enamel / petrol'      , (0.075 , 0.22  , 0.23))
red   = material('frame / oxblood'      , (0.27  , 0.085 , 0.075))
dark  = material('structure / charcoal' , (0.075 , 0.085 , 0.12))
gold  = material('fittings / ochre'     , (0.65  , 0.37  , 0.075), 0.25)
glass = material('glass / midnight'     , (0.035 , 0.095 , 0.14) , 0.2)
warm  = material('window / warm'        , (1     , 0.6   , 0.16) , emission=1.3)
mint  = material('beacon / mint'        , (0.25  , 0.85  , 0.63) , emission=2)


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)

    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.parent   = parent

    return obj


def finish(obj, name, mat, parent):
    obj.data.materials.append(mat)
    obj.name   = name
    obj.parent = parent

    return obj


def box(name, location, size, mat, parent):

    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object

    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    return finish(obj, name, mat, parent)


def cylinder(name, location, radius, depth, mat, parent, vertices=12, top=None):
    bpy.ops.mesh.primitive_cone_add(
            vertices=vertices,
            radius1=radius,
            radius2=radius if top is None else top,
            depth=depth,
            location=location)

    return finish(bpy.context.object, name, mat, parent)


def beam(name, start, end, radius, mat, parent):
    end = Vector(end)
    start = Vector(start)

    obj = cylinder(name, (start + end) / 2, radius, (end - start).length, mat, parent, 6)
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()

    return obj


root = empty('lem_station')
root[ 'description' ] = 'original observatory with later market and repair additions'
root[ 'meters_per_unit' ] = 1

core = empty('observatory', parent=root)

cylinder('original_pressure_hull', (0, 0,  0)    ,  1.45, 5.7        , ivory , core)
cylinder('base_collar'           , (0, 0, -2.85) ,  1.6 , 0.3        , red   , core)
cylinder('upper_collar'          , (0, 0,  2.25) ,  1.52, 0.22       , teal  , core)
cylinder('observation_glazing'   , (0, 0,  2.7)  ,  1.34, 0.65       , glass , core)
cylinder('roof'                  , (0, 0,  3.25) ,  1.47, 0.5        , ivory , core, top=0.72)
cylinder('roof_cap'              , (0, 0,  3.6)  ,  0.72, 0.2        , teal  , core)
beam('observatory_aerial'        , (0, 0,  3.7)  , (0, 0, 5.1), 0.045, gold  , core)


for index in range(12):
    angle = index * math.tau / 12
    beam('window_mullion',
        (1.36 * math.cos(angle), 1.36 * math.sin(angle), 2.38),
        (1.36 * math.cos(angle), 1.36 * math.sin(angle), 3.02),
         0.045, ivory, core)

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
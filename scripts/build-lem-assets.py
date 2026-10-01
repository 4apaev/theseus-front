"""Build the lem station and the reactor module with Blender.

Run from the project root:
    blender --background --python scripts/build-lem-assets.py -- --output /absolute/output
The output directory must not already contain these asset files.

The station follows sketches/lem-port-view.png: an observatory hull with a
domed observation deck, a red lattice tower for the listening dish with
module 03 below it, market hall 02 with crate stacks on lattice legs, the
signals office with masts and a relay dish, repair berth 04 with an ochre
gantry, a sphere tank, and the hanging banner. No ship: the player's hull
docks at socket_berth at runtime.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stationkit import *  # noqa: E402,F403

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(options.output).resolve()
out.mkdir(parents=True, exist_ok=True)
refuse_overwrite(out, ['lem-station.blend', 'lem-station.glb', 'reactor-mk02.blend', 'reactor-mk02.glb'])

clear_scene()
m = palette()
FRONT = -math.pi / 2  # the -y face, toward the camera


def on_hull(radius, angle, z, offset=0.02):
    """A point just outside a hull of `radius`, at `angle` from +x."""
    return ((radius + offset) * math.cos(angle), (radius + offset) * math.sin(angle), z)


# ── observatory: the original pressure hull ──────────────────

root = empty('lem_station')
root['meters_per_unit'] = 1
root['description'] = 'original observatory with later market, berth and signals additions'
core = empty('observatory', parent=root)

lattice('keel_truss', (0, 0, -4.6), 1.0, 1.7, m['red'], core, radius=0.045, rungs=2)
beam('probe_mast', (0, 0, -4.6), (0, 0, -6.0), 0.05, m['dark'], core)
cylinder('probe_tip', (0, 0, -6.15), 0.09, 0.4, m['gold'], core, 8)
cylinder('keel_tank', (0, 0, -3.35), 0.55, 0.7, m['ivory'], core, 10)

cylinder('base_collar', (0, 0, -2.85), 1.6, 0.3, m['red'], core, 16)
cylinder('original_pressure_hull', (0, 0, -0.15), 1.45, 5.4, m['ivory'], core, 16)
cylinder('service_band', (0, 0, 1.75), 1.5, 0.14, m['teal'], core, 16)

stripe_angle = math.radians(-109)
box('hull_stripe', on_hull(1.45, stripe_angle, 0.55, 0.03), (0.34, 0.06, 2.9), m['red'], core, chamfer=0,
    rotation=(0, 0, stripe_angle + math.pi / 2))
lettering('cast_lettering_lem', 'LEM', (0.42, -1.49, 0.8), 0.54, m['dark'], core, 'serif')
lettering('cast_lettering_station', 'STATION', (0.42, -1.49, 0.42), 0.24, m['dark'], core, 'sans')
window_band('hull_windows', (0, 0, 0), 1.45, -1.35, 10, (math.radians(-86), math.radians(-38)), (0.09, 0.14), m['warm'], core)
window_band('hull_windows_upper', (0, 0, 0), 1.45, -0.45, 9, (math.radians(-82), math.radians(-42)), (0.09, 0.14), m['warm'], core)

cylinder('upper_collar', (0, 0, 2.66), 1.52, 0.22, m['teal'], core, 16)
cylinder('observation_glazing', (0, 0, 3.12), 1.36, 0.7, m['glass'], core, 16)
for index in range(12):
    angle = index * math.tau / 12
    beam('window_mullion', on_hull(1.36, angle, 2.78, 0.02), on_hull(1.36, angle, 3.46, 0.02), 0.045, m['ivory'], core)
cylinder('observation_deck', (0, 0, 3.55), 1.5, 0.16, m['ivory'], core, 16)
dome('observation_dome', (0, 0, 3.63), 1.42, m['ivory'], core)
cylinder('dome_cap', (0, 0, 5.08), 0.35, 0.12, m['teal'], core, 10)
beam('aerial_mast', (0, 0, 5.1), (0, 0, 6.3), 0.04, m['gold'], core)
beam('aerial_cross', (-0.35, 0, 5.9), (0.35, 0, 5.9), 0.025, m['gold'], core)

sphere('sphere_tank', (1.75, -1.8, -2.4), 0.62, m['ivory'], core, 1)
cylinder('tank_band', (1.75, -1.8, -2.4), 0.64, 0.1, m['red'], core, 12)
beam('tank_strut', (1.25, -0.9, -1.85), (1.6, -1.55, -2.2), 0.05, m['dark'], core)

# ── dish tower: listening array, module 03 ───────────────────

support = empty('dish_support', parent=root)
box('tower_link', (-2.05, 0.9, 1.3), (1.3, 0.55, 0.55), m['ivory'], support)
lattice('dish_tower', (-3.1, 0.9, -0.5), 0.9, 4.5, m['red'], support, radius=0.055, rungs=5)
box('module_03', (-3.1, 0.9, -1.2), (1.15, 1.15, 1.4), m['red'], support, chamfer=0.05)
number_plate('module_03_number', (-3.1, 0.26, -1.1), '03', m['ivory'], m['dark'], support, (0.62, 0.05, 0.46))
box('module_03_hatch', (-3.1, 0.29, -1.65), (0.5, 0.04, 0.22), m['dark'], support, chamfer=0)

pivot = empty('dish_pivot', (-3.1, 0.9, 4.15), root)
pivot.rotation_euler = (math.radians(58), 0, math.radians(-25))
dish('listening_dish', pivot, 2.05, m['ivory'], m['dark'], m['gold'])
scan_animation(pivot)

# ── market hall 02 ───────────────────────────────────────────

market = empty('market', parent=root)
box('market_connector', (-2.35, -0.55, -1.75), (2.0, 0.7, 0.7), m['ivory'], market)
box('market_hall', (-4.35, -0.55, -1.75), (2.3, 2.1, 1.6), m['teal'], market, chamfer=0.05)
box('market_roof', (-4.35, -0.55, -0.9), (2.5, 2.3, 0.14), m['ivory'], market, chamfer=0)
box('market_annex', (-5.85, -0.35, -1.55), (1.1, 1.3, 1.2), m['teal'], market, chamfer=0.05)
box('annex_roof', (-5.85, -0.35, -0.92), (1.25, 1.45, 0.1), m['ivory'], market, chamfer=0)
number_plate('market_number', (-5.85, -1.07, -1.5), '02', m['ivory'], m['dark'], market, (0.55, 0.05, 0.42))
window_row('shopfront_lights', (-5.3, -1.612, -1.75), (-3.4, -1.612, -1.75), 9, (0.15, 0.18), m['warm'], market)
box('market_awning', (-4.35, -1.85, -1.15), (2.4, 0.5, 0.05), m['gold'], market, chamfer=0)
crate_stack('roof_freight', (-4.55, -0.35, -0.83), [m['gold'], m['red'], m['gold'], m['teal'], m['dark']], market, rows=2, cols=3, unit=(0.5, 0.5, 0.42))
for x in [-5.4, -3.3]:
    for y in [-1.5, 0.4]:
        beam('market_leg', (x, y, -2.55), (x, y, -3.4), 0.05, m['dark'], market)
box('market_skid', (-4.35, -0.55, -3.44), (2.2, 2.0, 0.08), m['dark'], market, chamfer=0)
empty('socket_market', (-4.35, -1.7, -1.2), root)

# ── signals office ───────────────────────────────────────────

comms = empty('comms', parent=root)
box('signals_connector', (2.1, 0.55, 1.45), (1.5, 0.6, 0.6), m['ivory'], comms)
box('signals_office', (3.85, 0.65, 1.55), (2.6, 1.3, 1.15), m['teal'], comms, chamfer=0.05)
box('signals_roof', (3.85, 0.65, 2.19), (2.75, 1.45, 0.12), m['ivory'], comms, chamfer=0)
window_row('signals_windows', (2.75, -0.012, 1.55), (4.95, -0.012, 1.55), 11, (0.13, 0.18), m['warm'], comms)
beam('antenna_mast', (3.1, 0.9, 2.25), (3.1, 0.9, 3.9), 0.035, m['gold'], comms)
beam('antenna_mast_short', (4.6, 0.9, 2.25), (4.6, 0.9, 3.3), 0.035, m['gold'], comms)
sphere('antenna_tip', (3.1, 0.9, 3.95), 0.06, m['red'], comms, 1)
cylinder('radar_housing', (3.85, 0.65, 2.5), 0.32, 0.5, m['ivory'], comms, 10)
dome('radar_dome', (3.85, 0.65, 2.75), 0.32, m['cream'], comms, 10, 3)
relay = empty('relay_mount', (4.7, 0.3, 2.7), comms)
relay.rotation_euler = (math.radians(50), 0, math.radians(30))
beam('relay_post', (4.7, 0.3, 2.25), (4.7, 0.3, 2.7), 0.03, m['dark'], comms)
dish('relay_dish', relay, 0.5, m['ivory'], m['dark'], m['gold'], 10)
empty('socket_comms', (3.85, -0.05, 1.55), root)

# ── repair berth 04 ──────────────────────────────────────────

rig = empty('rig', parent=root)
box('berth_connector', (2.5, -0.5, -1.25), (2.3, 0.9, 0.9), m['ivory'], rig)
box('berth_module', (4.3, -0.5, -1.25), (1.35, 1.35, 1.35), m['ivory'], rig, chamfer=0.06)
number_plate('berth_number', (4.3, -1.24, -1.15), '04', m['red'], m['ivory'], rig, (0.6, 0.05, 0.46))
cylinder('berth_collar', (5.1, -0.5, -1.25), 0.7, 0.25, m['gold'], rig, 12, axis='X')
gantry('berth_gantry', (5.2, -0.5, -1.75), (7.6, -0.5, -1.75), 0.9, m['gold'], rig, bays=3)
for y in [-1.05, 0.05]:
    beam('berth_clamp', (7.2, y, -1.75), (7.2, y, -0.55), 0.06, m['gold'], rig)
    box('clamp_pad', (7.2, y, -0.5), (0.3, 0.14, 0.2), m['dark'], rig, chamfer=0)
for x in [2.9, 3.5]:
    beam('banner_rod', (x, -0.98, -1.7), (x, -0.98, -2.1), 0.02, m['dark'], rig)
sign('banner', (3.2, -0.98, -3.05), (0.75, 0.03, 1.9), m['cream'], m['dark'], rig, stripes=5)
empty('socket_berth', (6.9, -0.5, -1.25), root)

# ── beacons: runtime-animated emission ───────────────────────

beacons = empty('beacons', parent=root)
for name, pos in [('beacon_port', (-5.5, -1.6, -0.8)), ('beacon_berth', (7.65, -0.5, -0.78)), ('beacon_mast', (0, 0, 6.36))]:
    cylinder(name, pos, 0.085, 0.14, m['mint'], beacons, 8)

# ── preview, export, metadata ────────────────────────────────

scene = setup_scene()
camera = preview_rig((12, -20, 12), (0.6, 0, 0.2), 19)

export_glb(root, out / 'lem-station.glb', animations=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'lem-station.blend'))
render(out / 'lem-station-preview.png')

counts = stats(root)
metadata = {
    'coordinates': 'blender z up; glb is y up; glb mapping [x,z,-y]',
    'camera_position_blender': list(camera.location),
    'camera_target_blender': [0.6, 0, 0.2],
    'orthographic_vertical_span': camera.data.ortho_scale * scene.render.resolution_y / scene.render.resolution_x,
    'image_size': [scene.render.resolution_x, scene.render.resolution_y],
    'hotspots': ['socket_market', 'socket_comms', 'socket_berth'],
    'animation': 'dish scans 8 degrees and returns over 10 seconds; emission beacons are runtime controlled',
    'station_meshes': counts['meshes'],
    'station_triangles': counts['triangles'],
}
write_json(out / 'lem-station-camera.json', metadata)

# ── reactor: a separate, reusable cargo-scale module ─────────

for obj in descendants(root):
    obj.hide_render = True
reactor = empty('reactor_mk02')
cylinder('reactor_case', (0, 0, 0), 0.55, 1.65, m['ivory'], reactor, 10)
for z in [-0.85, 0.85]:
    cylinder('end_collar', (0, 0, z), 0.56, 0.18, m['dark'], reactor, 10)
    cylinder('connector', (0, 0, z * 1.17), 0.28, 0.15, m['gold'], reactor, 10)
for x in [-0.2, 0.2]:
    box('service_latch', (x, -0.53, 0.25), (0.14, 0.08, 0.26), m['teal'], reactor, chamfer=0)
empty('socket_power', (0, 0, -1.08), reactor)
camera.location = (3, -5, 3)
aim(camera, (0, 0, 0))
camera.data.ortho_scale = 3.5
scene.frame_end = 1
export_glb(reactor, out / 'reactor-mk02.glb')
for obj in reversed(descendants(root)):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'reactor-mk02.blend'))
render(out / 'reactor-mk02-preview.png')
print('asset manifest:', metadata)

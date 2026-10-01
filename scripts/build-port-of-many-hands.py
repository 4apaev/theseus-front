"""Build the port of many hands, the second station, with Blender.

Run from the project root:
    blender --background --python scripts/build-port-of-many-hands.py -- --output /absolute/output
The output directory must not already contain these asset files.

The station follows the concept painting: a wide concourse drum on a red
frame with a keel module below, a mast tower with a scanning dish, the
arrivals arm and habitation towers 03 on the left, the freight spine with
a portal crane on the right, and the research lab, greenhouse and silos
above it. No ships: docked traffic is a runtime concern.

The runtime contract is the lem station's: `rig`, `market`, `comms` groups,
`socket_berth`, `socket_market`, `socket_comms`, `beacons`, `dish_pivot`.
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
refuse_overwrite(out, ['port-of-many-hands.blend', 'port-of-many-hands.glb'])

clear_scene()
m = palette()


def banded_cylinder(name, location, radius, depth, mat_body, mat_band, parent, bands=(-0.35, 0.35), vertices=16):
    """A silo or habitation tower: a cylinder with retaining bands at fractions of its depth."""
    body = cylinder(name, location, radius, depth, mat_body, parent, vertices)
    for k in bands:
        cylinder(f'{name}_band', (location[0], location[1], location[2] + depth * k), radius + 0.03, 0.12, mat_band, parent, vertices)
    return body


# ── concourse: the drum on its frame ─────────────────────────

root = empty('port_of_many_hands')
root['meters_per_unit'] = 1
root['description'] = 'a system gateway: concourse, arrivals, freight, research and habitation'
core = empty('concourse', parent=root)

lattice('frame_truss', (0, 0, -1.9), 3.6, 1.9, m['red'], core, radius=0.06, rungs=2)
cylinder('concourse_drum', (0, 0, 1.05), 2.6, 2.1, m['cream'], core, 24)
cylinder('drum_band_low', (0, 0, 0.1), 2.63, 0.16, m['red'], core, 24)
cylinder('drum_band_high', (0, 0, 2.02), 2.63, 0.14, m['teal'], core, 24)
# the 24-gon drum reaches y = -2.6 at its front vertex. the plate stands clear of it.
box('nameplate', (0, -2.68, 0.78), (3.0, 0.14, 1.15), m['cream'], core, chamfer=0)
lettering('cast_lettering_theseus', 'theseus', (0, -2.77, 0.86), 0.6, m['dark'], core, 'serif')
lettering('cast_lettering_port', 'port of many hands', (0, -2.77, 0.4), 0.22, m['dark'], core, 'sans')
window_band('drum_windows', (0, 0, 0), 2.6, 1.55, 20, (math.radians(-150), math.radians(-30)), (0.11, 0.13), m['warm'], core)
cylinder('concourse_glazing', (0, 0, 2.4), 2.45, 0.55, m['glass'], core, 24)
for index in range(16):
    angle = index * math.tau / 16
    beam('mullion', (2.48 * math.cos(angle), 2.48 * math.sin(angle), 2.13), (2.48 * math.cos(angle), 2.48 * math.sin(angle), 2.67), 0.04, m['ivory'], core)
cylinder('concourse_roof', (0, 0, 2.95), 2.6, 0.55, m['ivory'], core, 24, top=1.5)
cylinder('roof_deck', (0, 0, 3.3), 1.5, 0.16, m['teal'], core, 16)

cylinder('keel_module', (0, 0, -2.75), 1.05, 1.5, m['ivory'], core, 16)
cylinder('keel_collar', (0, 0, -2.0), 1.1, 0.14, m['red'], core, 16)
window_band('keel_windows', (0, 0, 0), 1.05, -2.6, 13, (math.radians(-160), math.radians(-20)), (0.09, 0.12), m['warm'], core)
beam('keel_mast', (0, 0, -3.5), (0, 0, -5.4), 0.06, m['dark'], core)
cylinder('keel_tip', (0, 0, -5.55), 0.1, 0.35, m['gold'], core, 8)

lattice('mast_tower', (0.9, 0.4, 3.35), 0.6, 3.2, m['red'], core, radius=0.045, rungs=4)
beam('tank_post', (-1.1, 0.6, 3.35), (-1.1, 0.6, 4.0), 0.05, m['dark'], core)
sphere('mast_tank', (-1.1, 0.6, 4.4), 0.45, m['cream'], core, 1)
cylinder('mast_tank_band', (-1.1, 0.6, 4.4), 0.47, 0.08, m['red'], core, 12)
for name, pos, rot in [('mast_dish_a', (1.35, 0.05, 4.7), (70, 0, -60)), ('mast_dish_b', (0.5, 0.85, 5.4), (60, 0, 120))]:
    mount = empty(f'{name}_mount', pos, core)
    mount.rotation_euler = tuple(math.radians(v) for v in rot)
    dish(name, mount, 0.38, m['ivory'], m['dark'], m['gold'], 10)

pivot = empty('dish_pivot', (0.9, 0.4, 6.6), root)
pivot.rotation_euler = (math.radians(55), 0, math.radians(-35))
dish('scan_dish', pivot, 1.2, m['ivory'], m['dark'], m['gold'])
scan_animation(pivot)

# ── arrivals: the berth arm, habitation 03 ───────────────────

rig = empty('rig', parent=root)
box('arrivals_corridor', (-3.9, 0.4, 0.8), (2.8, 0.95, 0.95), m['ivory'], rig)
window_row('arrivals_windows', (-5.1, -0.087, 0.8), (-2.7, -0.087, 0.8), 11, (0.12, 0.14), m['warm'], rig)
box('arrivals_hall', (-5.9, 0.4, 0.8), (1.5, 1.5, 1.5), m['red'], rig, chamfer=0.06)
sign('arrivals_sign', (-5.9, -0.41, 0.95), (1.2, 0.05, 0.5), m['teal'], m['cream'], rig, stripes=2)
cylinder('arrivals_collar', (-6.8, 0.4, 0.8), 0.85, 0.3, m['ivory'], rig, 12, axis='X')
cylinder('docking_ring', (-7.0, 0.4, 0.8), 0.9, 0.14, m['gold'], rig, 12, axis='X')
for y in [-0.15, 0.95]:
    beam('docking_arm', (-7.1, y, 0.8), (-7.9, y, 0.8), 0.05, m['gold'], rig)
    box('docking_pad', (-7.95, y, 0.8), (0.14, 0.24, 0.3), m['dark'], rig, chamfer=0)
empty('socket_berth', (-7.6, 0.4, 0.8), root)

hab = empty('habitation', parent=root)
banded_cylinder('hab_03_a', (-5.2, -1.3, -1.6), 0.8, 3.4, m['cream'], m['red'], hab)
window_band('hab_03_a_windows', (-5.2, -1.3, 0), 0.8, -2.5, 12, (math.radians(-170), math.radians(-10)), (0.07, 0.1), m['warm'], hab, rows=3, pitch=0.75)
cylinder('hab_03_a_cap', (-5.2, -1.3, 0.16), 0.82, 0.12, m['teal'], hab, 16)
banded_cylinder('hab_03_b', (-3.8, -1.1, -1.95), 0.65, 2.9, m['cream'], m['red'], hab)
window_band('hab_03_b_windows', (-3.8, -1.1, 0), 0.65, -2.7, 10, (math.radians(-170), math.radians(-10)), (0.07, 0.1), m['warm'], hab, rows=3, pitch=0.7)
cylinder('hab_03_b_cap', (-3.8, -1.1, -0.44), 0.67, 0.12, m['teal'], hab, 16)
box('hab_link', (-4.5, -1.2, -1.3), (1.0, 0.5, 0.5), m['ivory'], hab)
box('hab_to_core', (-2.75, -0.9, -1.4), (1.6, 0.5, 0.5), m['ivory'], hab)
number_plate('hab_number', (-5.2, -2.16, -0.15), '03', m['red'], m['cream'], hab, (0.6, 0.05, 0.44))
beam('solar_boom', (-5.95, -1.3, -1.5), (-6.7, -0.6, -1.5), 0.05, m['dark'], hab)
solar_wing('solar_left', (-7.5, -0.6, -1.5), (0.8, 1.5), m['panel'], m['gold'], hab, panels=2)

# ── freight: the spine, the crane, the tanks ─────────────────

market = empty('market', parent=root)
box('freight_spine', (5.6, -0.5, -0.95), (6.4, 0.75, 0.75), m['gold'], market)
box('freight_hall', (4.1, -0.3, -0.95), (2.2, 1.7, 1.6), m['gold'], market, chamfer=0.05)
sign('freight_sign', (4.1, -1.21, -0.7), (1.4, 0.05, 0.55), m['teal'], m['cream'], market, stripes=2)
box('freight_deck', (6.6, -0.5, -0.52), (5.6, 1.1, 0.1), m['dark'], market, chamfer=0)
crate_stack('freight_crates', (6.2, -0.5, -0.47), [m['red'], m['teal'], m['gold'], m['dark'], m['cream']], market, rows=2, cols=4, unit=(0.5, 0.55, 0.4))
crate_stack('freight_crates_aft', (8.3, -0.5, -0.47), [m['teal'], m['red']], market, rows=1, cols=2, unit=(0.5, 0.55, 0.4))
for y in [-1.35, 0.35]:
    beam('crane_post', (7.0, y, -1.3), (7.0, y, 0.4), 0.06, m['gold'], market)
beam('crane_bridge', (7.0, -1.35, 0.4), (7.0, 0.35, 0.4), 0.06, m['gold'], market)
box('crane_trolley', (7.0, -0.3, 0.3), (0.3, 0.3, 0.2), m['dark'], market, chamfer=0)
beam('crane_cable', (7.0, -0.3, 0.2), (7.0, -0.3, -0.15), 0.015, m['dark'], market)
box('crane_load', (7.0, -0.3, -0.35), (0.5, 0.55, 0.4), m['red'], market, chamfer=0.03)
for y in [-1.6, -0.6]:
    cylinder('fuel_tank', (3.6, y, -2.35), 0.45, 2.0, m['gold'], market, 12, axis='X')
    for x in [2.9, 4.3]:
        cylinder('fuel_band', (x, y, -2.35), 0.47, 0.08, m['red'], market, 12, axis='X')
cylinder('spine_end_collar', (8.9, -0.5, -0.95), 0.45, 0.2, m['red'], market, 10, axis='X')
for y in [-0.9, -0.1]:
    beam('freight_clamp', (9.0, y, -0.95), (9.6, y, -0.95), 0.045, m['gold'], market)
empty('socket_market', (4.1, -1.3, -0.5), root)

# ── research: the lab, the greenhouse, the silos ─────────────

comms = empty('comms', parent=root)
box('research_arm', (3.6, 0.9, 2.15), (2.2, 0.7, 0.7), m['ivory'], comms)
box('research_lab', (6.15, 1.0, 2.25), (3.1, 1.35, 1.25), m['cream'], comms, chamfer=0.07)
sign('research_sign', (6.15, 0.27, 2.0), (1.3, 0.05, 0.42), m['teal'], m['cream'], comms, stripes=2)
window_row('research_windows', (4.9, 0.31, 2.55), (7.4, 0.31, 2.55), 13, (0.11, 0.12), m['warm'], comms)
cylinder('lab_collar', (7.8, 1.0, 2.25), 0.72, 0.2, m['red'], comms, 12, axis='X')
beam('lab_antenna', (5.3, 1.0, 2.88), (5.3, 1.0, 3.9), 0.03, m['gold'], comms)
lab_mount = empty('lab_dish_mount', (6.6, 1.0, 2.95), comms)
lab_mount.rotation_euler = (math.radians(45), 0, math.radians(-20))
dish('lab_dish', lab_mount, 0.45, m['ivory'], m['dark'], m['gold'], 10)

box('greenhouse_link', (3.3, -0.6, 0.75), (1.6, 0.5, 0.5), m['ivory'], comms)
cylinder('greenhouse_base', (4.9, -0.75, 0.75), 0.95, 1.1, m['cream'], comms, 16)
cylinder('greenhouse_band', (4.9, -0.75, 1.28), 0.97, 0.1, m['red'], comms, 16)
sphere('greenhouse_canopy', (4.9, -0.75, 1.55), 0.55, m['leaf'], comms, 1)
dome('greenhouse_dome', (4.9, -0.75, 1.3), 0.95, m['pane'], comms, 12, 4)
for index in range(4):
    angle = index * math.tau / 4 + math.pi / 4
    beam('greenhouse_rib', (4.9 + 0.95 * math.cos(angle), -0.75 + 0.95 * math.sin(angle), 1.3), (4.9, -0.75, 2.26), 0.02, m['ivory'], comms)
box('silo_arm', (6.35, -0.3, 0.6), (1.1, 0.45, 0.45), m['ivory'], comms)
banded_cylinder('silo_a', (7.4, 0.1, 0.5), 0.58, 2.6, m['cream'], m['red'], comms)
cylinder('silo_a_cap', (7.4, 0.1, 1.86), 0.6, 0.12, m['teal'], comms, 16)
box('silo_link', (7.9, 0.35, 0.6), (1.1, 0.4, 0.4), m['ivory'], comms)
banded_cylinder('silo_b', (8.4, 0.6, 0.15), 0.5, 2.3, m['cream'], m['red'], comms)
cylinder('silo_b_cap', (8.4, 0.6, 1.36), 0.52, 0.12, m['teal'], comms, 16)
beam('solar_boom_right', (8.4, 0.6, 1.3), (9.6, 1.1, 1.7), 0.05, m['gold'], comms)
solar_wing('solar_right', (9.8, 1.2, 1.7), (0.8, 1.9), m['panel'], m['gold'], comms, panels=2)
empty('socket_comms', (6.15, 0.2, 2.25), root)

# ── beacons ──────────────────────────────────────────────────

beacons = empty('beacons', parent=root)
for name, pos in [('beacon_arrivals', (-6.8, 0.4, 1.72)), ('beacon_freight', (7.0, -1.35, 0.5)), ('beacon_mast', (-1.1, 0.6, 4.9))]:
    cylinder(name, pos, 0.085, 0.14, m['mint'], beacons, 8)

# ── preview, export, metadata ────────────────────────────────

scene = setup_scene()
camera = preview_rig((14, -24, 14), (0.8, 0, 0.6), 22)
export_glb(root, out / 'port-of-many-hands.glb', animations=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'port-of-many-hands.blend'))
render(out / 'port-of-many-hands-preview.png')

counts = stats(root)
metadata = {
    'coordinates': 'blender z up; glb is y up; glb mapping [x,z,-y]',
    'camera_position_blender': list(camera.location),
    'camera_target_blender': [0.8, 0, 0.6],
    'orthographic_vertical_span': camera.data.ortho_scale * scene.render.resolution_y / scene.render.resolution_x,
    'image_size': [scene.render.resolution_x, scene.render.resolution_y],
    'hotspots': ['socket_market', 'socket_comms', 'socket_berth'],
    'animation': 'mast dish scans 8 degrees and returns over 10 seconds; emission beacons are runtime controlled',
    'station_meshes': counts['meshes'],
    'station_triangles': counts['triangles'],
}
write_json(out / 'port-of-many-hands-camera.json', metadata)
print('asset manifest:', metadata)

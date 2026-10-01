"""Shared helpers for the low-poly station builders.

Import from a sibling build script:

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from stationkit import *

Conventions: blender z up. The camera looks from -y, so a front face is the -y face.
Every helper returns the object it made. Materials are shared and opaque.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

FONTS = {
    'serif': Path('/System/Library/Fonts/Supplemental/Georgia Bold.ttf'),
    'sans' : Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
}


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in [bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.actions]:
        for item in list(block):
            if not item.users:
                block.remove(item)


def refuse_overwrite(out, filenames):
    for filename in filenames:
        if (out / filename).exists():
            raise FileExistsError(out / filename)


# ── materials ────────────────────────────────────────────────

def material(name, color, metallic=0, emission=0, roughness=0.72):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    node = result.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    if emission:
        node.inputs['Emission Color'].default_value = (*color, 1)
        node.inputs['Emission Strength'].default_value = emission
    return result


def glazing(name, color, alpha):
    """See-through glass: alpha blend in the export, transparent in cycles."""
    result = material(name, color, 0.1, roughness=0.15)
    node = result.node_tree.nodes.get('Principled BSDF')
    node.inputs['Alpha'].default_value = alpha
    result.blend_method = 'BLEND'
    result.diffuse_color = (*color, alpha)
    return result


def palette():
    """The station palette from the concept art: cream enamel, oxblood frames,
    petrol offices, ochre freight, charcoal structure."""
    return {
        'ivory': material('enamel / ivory', (0.80, 0.76, 0.62)),
        'cream': material('enamel / cream', (0.88, 0.85, 0.74)),
        'teal' : material('enamel / petrol', (0.075, 0.22, 0.23)),
        'red'  : material('frame / oxblood', (0.30, 0.09, 0.08)),
        'dark' : material('structure / charcoal', (0.075, 0.085, 0.12)),
        'gold' : material('fittings / ochre', (0.70, 0.42, 0.09), 0.25),
        'brass': material('fittings / brass', (0.62, 0.48, 0.20), 0.45, roughness=0.5),
        'glass': material('glass / midnight', (0.035, 0.095, 0.14), 0.2, roughness=0.35),
        'panel': material('solar / indigo', (0.09, 0.12, 0.30), 0.3, roughness=0.4),
        'leaf' : material('greenhouse / leaf', (0.18, 0.42, 0.20)),
        'pane' : glazing('glass / greenhouse', (0.62, 0.80, 0.84), 0.32),
        'warm' : material('window / warm', (1, 0.6, 0.16), emission=1.3),
        'mint' : material('beacon / mint', (0.25, 0.85, 0.63), emission=2),
    }


# ── objects ──────────────────────────────────────────────────

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


def bevel(obj, width):
    modifier = obj.modifiers.new('chamfer', 'BEVEL')
    modifier.width = width
    modifier.segments = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def box(name, location, size, mat, parent, chamfer=0.04, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if chamfer and min(size) > chamfer * 3:
        bevel(obj, chamfer)
    obj.rotation_euler = rotation
    return finish(obj, name, mat, parent)


def cylinder(name, location, radius, depth, mat, parent, vertices=12, top=None, axis='Z'):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=location)
    obj = bpy.context.object
    if axis == 'X':
        obj.rotation_euler.y = math.pi / 2
    if axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    return finish(obj, name, mat, parent)


def ring(name, location, radius, depth, thickness, mat, parent, vertices=16):
    """A short hollow band around a hull: a collar, a retaining band, a rail."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, end_fill_type='NOTHING')
    obj = bpy.context.object
    modifier = obj.modifiers.new('shell', 'SOLIDIFY')
    modifier.thickness = -thickness
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat, parent)


def sphere(name, location, radius, mat, parent, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    return finish(bpy.context.object, name, mat, parent)


def dome(name, location, radius, mat, parent, segments=16, rings=5):
    """A hemisphere, open at the bottom. Sits on a cylinder of the same radius."""
    verts, faces = [], []
    for r in range(rings + 1):
        phi = (math.pi / 2) * r / rings
        z = radius * math.sin(phi)
        rr = radius * math.cos(phi)
        for s in range(segments):
            a = s * math.tau / segments
            verts.append((rr * math.cos(a), rr * math.sin(a), z))
    for r in range(rings):
        for s in range(segments):
            a = r * segments + s
            b = r * segments + (s + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    return mesh_object(name, verts, faces, mat, parent, location)


def mesh_object(name, verts, faces, mat, parent, location=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj, name, mat, parent)


def beam(name, start, end, radius, mat, parent, vertices=6):
    start, end = Vector(start), Vector(end)
    obj = cylinder(name, (start + end) / 2, radius, (end - start).length, mat, parent, vertices)
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    return obj


def lattice(name, base, width, height, mat, parent, radius=0.05, rungs=None, depth=None):
    """A red-frame tower: 4 corner posts, rungs every unit, one diagonal per face.
    `base` is the bottom center. `width` runs along x, `depth` along y."""
    depth = width if depth is None else depth
    group = empty(name, parent=parent)
    x0, y0, z0 = base
    corners = [(x0 - width / 2, y0 - depth / 2), (x0 + width / 2, y0 - depth / 2),
               (x0 + width / 2, y0 + depth / 2), (x0 - width / 2, y0 + depth / 2)]
    for i, (x, y) in enumerate(corners):
        beam(f'{name}_post', (x, y, z0), (x, y, z0 + height), radius, mat, group)
    steps = rungs or max(1, round(height))
    for step in range(steps + 1):
        z = z0 + height * step / steps
        for i in range(4):
            a, b = corners[i], corners[(i + 1) % 4]
            beam(f'{name}_rung', (*a, z), (*b, z), radius * 0.7, mat, group)
            if step < steps:
                z2 = z0 + height * (step + 1) / steps
                lo, hi = (a, b) if step % 2 == 0 else (b, a)
                beam(f'{name}_brace', (*lo, z), (*hi, z2), radius * 0.6, mat, group)
    return group


def gantry(name, start, end, height, mat, parent, radius=0.06, bays=None):
    """A horizontal boom: 2 rails, verticals and a zigzag brace. An ochre crane arm."""
    group = empty(name, parent=parent)
    start, end = Vector(start), Vector(end)
    up = Vector((0, 0, height))
    beam(f'{name}_rail', start, end, radius, mat, group)
    beam(f'{name}_rail', start + up, end + up, radius, mat, group)
    bays = bays or max(1, round((end - start).length))
    for i in range(bays + 1):
        p = start.lerp(end, i / bays)
        beam(f'{name}_upright', p, p + up, radius * 0.8, mat, group)
        if i < bays:
            q = start.lerp(end, (i + 1) / bays)
            lo, hi = (p, q) if i % 2 == 0 else (q, p)
            beam(f'{name}_brace', lo, hi + up, radius * 0.6, mat, group)
    return group


def dish(name, parent, radius, mat_face, mat_struts, mat_feed, segments=16):
    """A faceted paraboloid with 3 feed struts and a receiver. Parent it to a pivot."""
    group = empty(name, parent=parent)
    verts, faces = [(0, 0, 0)], []
    for ring_radius in [radius / 3, radius * 2 / 3, radius]:
        for i in range(segments):
            a = i * math.tau / segments
            verts.append((ring_radius * math.cos(a), ring_radius * math.sin(a), 0.35 * ring_radius ** 2 / radius))
    for i in range(segments):
        faces.append((0, 1 + i, 1 + (i + 1) % segments))
    for r in range(2):
        a, b = 1 + r * segments, 1 + (r + 1) * segments
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((a + i, b + i, b + j, a + j))
    mesh_object(f'{name}_face', verts, faces, mat_face, group)
    focus = radius * 0.66
    for i in range(3):
        a = i * math.tau / 3
        beam(f'{name}_strut', (radius * 0.85 * math.cos(a), radius * 0.85 * math.sin(a), focus * 0.4),
            (0, 0, focus), 0.035, mat_struts, group)
    cylinder(f'{name}_feed', (0, 0, focus + 0.02), radius * 0.06, radius * 0.17, mat_feed, group, 8)
    return group


def scan_animation(pivot, degrees=8, frames=(1, 121, 241)):
    """Scan sideways and return. One clip, loop it at runtime."""
    base = pivot.rotation_euler.z
    for frame, offset in zip(frames, [0, math.radians(degrees), 0]):
        pivot.rotation_euler.z = base + offset
        pivot.keyframe_insert(data_path='rotation_euler', frame=frame)
    pivot.rotation_euler.z = base


def window_band(name, center, radius, z, count, arc, size, mat, parent, rows=1, pitch=0.5):
    """Small lit windows around a cylinder, one mesh. `arc` is (start, end) in
    radians, measured from +x, counter clockwise. -pi/2 faces the camera."""
    verts, faces = [], []
    w, h = size
    for row in range(rows):
        zz = z + row * pitch
        for i in range(count):
            a = arc[0] + (arc[1] - arc[0]) * (i + 0.5) / count
            cx, cy = (radius + 0.02) * math.cos(a), (radius + 0.02) * math.sin(a)
            tx, ty = -math.sin(a) * w / 2, math.cos(a) * w / 2
            n = len(verts)
            verts += [(cx - tx, cy - ty, zz - h / 2), (cx + tx, cy + ty, zz - h / 2),
                      (cx + tx, cy + ty, zz + h / 2), (cx - tx, cy - ty, zz + h / 2)]
            faces.append((n, n + 1, n + 2, n + 3))
    return mesh_object(name, verts, faces, mat, parent, center)


def window_row(name, start, end, count, size, mat, parent, normal='-y'):
    """Lit windows along a flat wall, one mesh. The wall faces -y or +x."""
    start, end = Vector(start), Vector(end)
    w, h = size
    verts, faces = [], []
    for i in range(count):
        p = start.lerp(end, (i + 0.5) / count)
        n = len(verts)
        if normal == '-y':
            verts += [(p.x - w / 2, p.y, p.z - h / 2), (p.x + w / 2, p.y, p.z - h / 2),
                      (p.x + w / 2, p.y, p.z + h / 2), (p.x - w / 2, p.y, p.z + h / 2)]
        else:
            verts += [(p.x, p.y - w / 2, p.z - h / 2), (p.x, p.y + w / 2, p.z - h / 2),
                      (p.x, p.y + w / 2, p.z + h / 2), (p.x, p.y - w / 2, p.z + h / 2)]
        faces.append((n, n + 1, n + 2, n + 3))
    return mesh_object(name, verts, faces, mat, parent)


def lettering(name, body, location, size, mat, parent, font='serif', rotation=(math.pi / 2, 0, 0), align='CENTER'):
    """Cast lettering as flat geometry on a -y face. Low curve resolution keeps it light."""
    bpy.ops.object.text_add(location=location, rotation=rotation)
    text = bpy.context.object
    text.data.body = body
    text.data.size = size
    text.data.extrude = 0.006
    text.data.resolution_u = 4
    text.data.align_x = align
    path = FONTS.get(font)
    if path and path.exists():
        text.data.font = bpy.data.fonts.load(str(path), check_existing=True)
    text.data.materials.append(mat)
    text.parent = parent
    text.name = name
    bpy.ops.object.convert(target='MESH')
    return text


def number_plate(name, location, number, mat_plate, mat_text, parent, size=(0.7, 0.05, 0.5), rotation=(0, 0, 0)):
    """A painted module number, as the concept's 02 / 03 / 04 plates."""
    group = empty(name, location, parent)
    box(f'{name}_plate', (0, 0, 0), size, mat_plate, group, chamfer=0)
    lettering(f'{name}_digits', number, (0, -size[1] / 2 - 0.01, -size[2] * 0.32), size[2] * 0.66, mat_text, group, 'sans')
    group.rotation_euler = rotation
    return group


def sign(name, location, size, mat_plate, mat_text, parent, stripes=3):
    """A signboard with lettering abstracted to stripes. Legible at game scale, cheap."""
    group = empty(name, location, parent)
    box(f'{name}_board', (0, 0, 0), size, mat_plate, group, chamfer=0)
    w, d, h = size
    step = h * 0.7 / max(1, stripes - 1) if stripes > 1 else 0
    for i in range(stripes):
        lw = w * (0.68 - 0.18 * (i % 2))
        z = (h * 0.35 if stripes > 1 else 0) - i * step
        box(f'{name}_line', (-(w * 0.68 - lw) / 2, -d / 2 - 0.01, z), (lw, 0.02, h * 0.1), mat_text, group, chamfer=0)
    return group


def solar_wing(name, location, size, mat_panel, mat_frame, parent, panels=3, rotation=(0, 0, 0)):
    """Photovoltaic panels on a spar. `size` is one panel (width, height)."""
    group = empty(name, location, parent)
    w, h = size
    gap = 0.08
    span = panels * w + (panels - 1) * gap
    beam(f'{name}_spar', (-span / 2 - 0.2, 0, 0), (span / 2 + 0.2, 0, 0), 0.05, mat_frame, group)
    for i in range(panels):
        x = -span / 2 + w / 2 + i * (w + gap)
        box(f'{name}_panel', (x, 0, 0), (w, 0.05, h), mat_panel, group, chamfer=0)
        box(f'{name}_rib', (x, 0.04, 0), (0.04, 0.03, h), mat_frame, group, chamfer=0)
    group.rotation_euler = rotation
    return group


def crate_stack(name, location, mats, parent, rows=2, cols=3, unit=(0.42, 0.42, 0.36), jitter=0.06):
    """Freight containers stacked on a deck. Colors cycle through `mats`."""
    group = empty(name, location, parent)
    w, d, h = unit
    k = 0
    for row in range(rows):
        for col in range(cols - row):
            x = (col - (cols - row - 1) / 2) * (w + 0.05) + jitter * ((k * 7) % 3 - 1) * 0.5
            box(f'{name}_crate', (x, 0, h / 2 + row * h), (w, d, h), mats[k % len(mats)], group, chamfer=0.03)
            k += 1
    return group


# ── trees ────────────────────────────────────────────────────

def descendants(obj):
    return [obj] + list(obj.children_recursive)


def select_asset(obj):
    bpy.ops.object.select_all(action='DESELECT')
    for child in descendants(obj):
        child.select_set(True)
    bpy.context.view_layer.objects.active = obj


def stats(root):
    meshes = [obj for obj in descendants(root) if obj.type == 'MESH']
    return {
        'meshes'   : len(meshes),
        'triangles': sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes),
    }


# ── scene, preview, export ───────────────────────────────────

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def setup_scene(frame_end=241, size=(1200, 1000), samples=32):
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frame_end
    scene.render.fps = 24
    scene.frame_set(1)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.world.color = (0.19, 0.16, 0.27)
    scene.view_settings.view_transform = 'AgX'
    return scene


def preview_rig(camera_position, target, ortho_scale, lights=None):
    """Lights and an orthographic camera under one `preview_only` empty. Never exported."""
    preview = empty('preview_only')
    for name, pos, color, energy, size in lights or [
        ('key', (-7, -10, 14), (1, 0.88, 0.68), 2100, 8),
        ('fill', (6, -2, 5), (0.59, 0.65, 1), 1000, 7),
        ('rim', (2, 8, 9), (0.75, 0.62, 1), 1700, 6),
    ]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.color, data.shape, data.size = energy, color, 'DISK', size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = pos
        aim(obj, (0, 0, 0))
        obj.parent = preview
    data = bpy.data.cameras.new('preview_camera')
    camera = bpy.data.objects.new('preview_camera', data)
    bpy.context.collection.objects.link(camera)
    camera.parent = preview
    camera.location = camera_position
    aim(camera, target)
    data.type = 'ORTHO'
    data.ortho_scale = ortho_scale
    data.lens = 50
    bpy.context.scene.camera = camera
    return camera


def export_glb(root, path, animations=False):
    select_asset(root)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB',
        use_selection=True, export_animations=animations, export_cameras=False,
        export_lights=False, export_yup=True)


def render(path):
    scene = bpy.context.scene
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=4) + '\n')

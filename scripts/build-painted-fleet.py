"""Build the painted fleet: hulls and modules after the painted miniatures.

blender --background --python scripts/build-painted-fleet.py -- --output /tmp/painted-fleet [--only far-treasure] [--no-render]

hulls follow the painted art in ../sketches: far-treasure after parts-2d/ship.1,
tug after painted-parts-v1/ship-02, hauler after painted-parts-v1/ship-01.
each module is its own glb, built around its socket, so the client fits it to
the hull's socket empty of the same slot.
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--only', default='')
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)


# ── materials: flat paint, as the miniatures are painted ──────────

def srgb(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]


MATS = {}


def mat(name, value, emission=0, rough=.72, metal=0):
    if name in MATS: return MATS[name]
    rgb = srgb(value)
    result = bpy.data.materials.new('painted / ' + name)
    result.diffuse_color = (*rgb, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    if emission:
        shader.inputs['Emission Color'].default_value = (*rgb, 1)
        shader.inputs['Emission Strength'].default_value = emission
    result['hex'], result['emissive'] = value, bool(emission)
    MATS[name] = result
    return result


def palette():
    return {
        'cream': mat('cream', '#E4D5B0'), 'shade': mat('cream shade', '#CDBB91'),
        'teal': mat('teal', '#46757A'), 'tealD': mat('teal dark', '#30555A'),
        'mustard': mat('mustard', '#E2A13B'), 'olive': mat('olive', '#6E7C49'),
        'rust': mat('rust', '#94402F'), 'dark': mat('gunmetal', '#3C3F44', rough=.55, metal=.3),
        'black': mat('engine throat', '#17191C', rough=.5), 'glass': mat('smoked glass', '#1F2B35', rough=.2),
        'lamp': mat('warm lamp', '#FFB347', emission=6), 'frost': mat('frost', '#BFE3F2'),
        'white': mat('reefer white', '#E6E4DC'), 'green': mat('green lamp', '#7CE08A', emission=5),
        'red': mat('red lamp', '#FF4A3A', emission=5),
    }


# ── geometry: chunky blocks with rounded edges, prisms, pipes ─────

def link(name, bm, material, parent, bevel=None, at=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    obj.parent = parent
    if at is not None: obj.location = at
    if bevel:
        modifier = obj.modifiers.new('rounded edge', 'BEVEL')
        modifier.width, modifier.segments = bevel
        modifier.limit_method = 'ANGLE'
        modifier.use_clamp_overlap = True
    return obj


def block(name, center, size, material, parent, round_=.06, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    return link(name, bm, material, parent, (min(round_, min(size) * .45), seg) if round_ else None, center)


def chamfered(name, center, size, material, parent, cut=.25, round_=.035):
    """a block with 45° corners along its length, the octagon section of the painted hulls"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    edges = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().x) > .9]
    bmesh.ops.bevel(bm, geom=edges, offset=min(cut, min(size[1], size[2]) * .45), segments=1, affect='EDGES', profile=.5)
    return link(name, bm, material, parent, (round_, 2), center)


def prism(name, points, y0, y1, material, parent, round_=.05):
    """an xz profile extruded along y"""
    bm = bmesh.new()
    a = [bm.verts.new((x, y1, z)) for x, z in points]
    b = [bm.verts.new((x, y0, z)) for x, z in points]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(len(points)):
        j = (i + 1) % len(points)
        bm.faces.new([b[i], b[j], a[j], a[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, material, parent, (round_, 2) if round_ else None)


def barrel(name, center, radius, length, material, parent, axis='X', top=None, sides=16, round_=.03, spin=0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides, radius1=radius,
        radius2=radius if top is None else top, depth=length)
    if spin: bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(spin, 3, 'Z'))
    turn = {'X': Matrix.Rotation(math.pi / 2, 3, 'Y'), 'Y': Matrix.Rotation(-math.pi / 2, 3, 'X'), 'Z': Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=turn)
    return link(name, bm, material, parent, (round_, 2) if round_ else None, center)


def ring(name, center, major, minor, material, parent, axis='X'):
    bm = bmesh.new()
    rings, sides = 24, 6
    grid = []
    for i in range(rings):
        a = i / rings * math.tau
        row = []
        for j in range(sides):
            b = j / sides * math.tau
            r = major + minor * math.cos(b)
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
        grid.append(row)
    for i in range(rings):
        for j in range(sides):
            bm.faces.new([grid[i][j], grid[(i + 1) % rings][j], grid[(i + 1) % rings][(j + 1) % sides], grid[i][(j + 1) % sides]])
    turn = {'X': Matrix.Rotation(math.pi / 2, 3, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 3, 'X'), 'Z': Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=turn)
    return link(name, bm, material, parent, None, center)


def fillet(points, radius, steps=4):
    """round every inner corner of a polyline"""
    pts = [Vector(p) for p in points]
    result = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        u, w = (a - b).normalized(), (c - b).normalized()
        r = min(radius, (a - b).length * .45, (c - b).length * .45)
        p0, p1 = b + u * r, b + w * r
        for k in range(steps + 1):
            t = k / steps
            result.append(p0.lerp(b, t).lerp(b.lerp(p1, t), t))
    result.append(pts[-1])
    return result


def pipe(name, points, radius, material, parent, corner=.12, sides=8):
    path = fillet(points, corner)
    bm = bmesh.new()
    rings = []
    normal = None
    for i, p in enumerate(path):
        tangent = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        if normal is None:
            normal = tangent.cross(Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((1, 0, 0))).normalized()
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        binormal = tangent.cross(normal)
        rings.append([bm.verts.new(p + (normal * math.cos(a) + binormal * math.sin(a)) * radius) for a in (k / sides * math.tau for k in range(sides))])
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new([rings[i][k], rings[i + 1][k], rings[i + 1][(k + 1) % sides], rings[i][(k + 1) % sides]])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, material, parent)


def empty(name, parent=None, pos=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = pos
    return obj


# ── details, as the painter adds them ─────────────────────────────

AXES = {'+x': (0, 1), '-x': (0, -1), '+y': (1, 1), '-y': (1, -1), '+z': (2, 1), '-z': (2, -1)}


def lamp(name, center, size, facing, p, parent):
    """an orange strip in a dark frame, sunk into the paint"""
    axis, sign = AXES[facing]
    frame = list(size); frame[axis] = .06
    glow = [v * .72 for v in size]; glow[axis] = .07
    c = Vector(center)
    block(name + ' frame', c, frame, p['dark'], parent, .02, 1)
    lit = Vector(center); lit[axis] += sign * .02
    block(name, lit, glow, p['lamp'], parent, .015, 1)


def handle(name, a, b, out, p, parent, depth=.16):
    """a c-shaped grab rail from a to b, standing off the plate along `out`"""
    a, b, o = Vector(a), Vector(b), Vector(out) * depth
    pipe(name, [a, a + o, b + o, b], .035, p['mustard'], parent, .07)


def vent(name, center, size, facing, p, parent, slats=4):
    """a dark grille: louvers along its long side"""
    axis, sign = AXES[facing]
    block(name, center, size, p['dark'], parent, .02, 1)
    long, cross = sorted((i for i in range(3) if i != axis), key=lambda i: -size[i])
    for k in range(slats):
        c = Vector(center); c[axis] += sign * size[axis] * .5
        c[cross] += (k - (slats - 1) / 2) * size[cross] / slats
        span = [0, 0, 0]; span[axis], span[long], span[cross] = .02, size[long] * .85, size[cross] / (slats * 2.2)
        block(name + ' slat', c, span, p['black'], parent, 0)


def antenna(name, base, height, p, parent, tip='lamp'):
    barrel(name + ' foot', (base[0], base[1], base[2] + .06), .09, .12, p['dark'], parent, 'Z', sides=8)
    barrel(name, (base[0], base[1], base[2] + height / 2), .025, height, p['dark'], parent, 'Z', sides=6, round_=0)
    barrel(name + ' tip', (base[0], base[1], base[2] + height + .04), .045, .1, p[tip], parent, 'Z', sides=8, round_=0)


def nozzle(name, center, radius, length, p, parent, rim='dark'):
    """a drive bell opening aft, dark in the throat"""
    x, y, z = center
    barrel(name + ' bell', (x, y, z), radius, length, p[rim], parent, 'X', top=radius * .72)
    barrel(name + ' throat', (x - length / 2 - .005, y, z), radius * .78, .03, p['black'], parent, 'X', round_=0)
    s = empty(name + ' plume', parent, (x - length / 2 - .02, y, z))
    s['plume'], s['radius'] = True, radius * .7


def socket(root, name, family, pos, mount='light'):
    obj = empty('socket_' + name, root, pos)
    obj['family'], obj['mount'], obj['slot'] = family, mount, name
    return obj


# ── the far treasure: after parts-2d/ship.1 ───────────────────────
# bow +x, port +y, up +z. the spine runs at z 0.

HW, HH = 2.2, 2.1          # the hull section: width, height
TOP = HH / 2 + .06         # the roof line, where top modules stand
FAR_SOCKETS = {'power1': (-1.75, 0, TOP), 'cruise1': (-3.85, 0, 0), 'maneuver1': (-1.75, 0, -.72), 'cargo1': (.3, 0, 0), 'utility1': (2.3, 0, TOP)}


def plates(name, cx, length, n, p, parent, top='shade', side=None, gap=.06):
    """raised plates on the roof and the flanks of a hull block, a dark seam between each"""
    step = length / n
    for k in range(n):
        x = cx - length / 2 + step * (k + .5)
        block(name + ' roof plate', (x, 0, HH / 2 + .03), (step - gap, HW - .9, .08), p[top], parent, .03)
        if side:
            for s in (-1, 1): block(name + ' flank plate', (x, s * (HW / 2 + .02), .1), (step - gap, .06, HH - 1.0), p[side], parent, .03)


def far_treasure(p, root):
    hull = empty('hull', root)
    H2 = HH / 2
    # the cab: a tall cream wedge over a teal chin, a mustard line between
    prism('cab', [(3.0, 0), (5.05, 0), (5.45, .32), (4.75, H2 + .02), (3.0, H2 + .08)], -HW / 2 + .06, HW / 2 - .06, p['cream'], hull, .08)
    prism('chin', [(3.0, -H2), (4.95, -H2), (6.0, -.55), (5.95, -.32), (5.4, 0), (3.0, 0)], -HW / 2 + .12, HW / 2 - .12, p['teal'], hull, .08)
    block('cab line', (4.3, 0, 0), (2.55, HW - .1, .09), p['mustard'], hull, .03, 1)
    block('bumper', (5.93, 0, -.62), (.14, 1.2, .3), p['dark'], hull, .04)
    slope = math.atan2(H2 + .02 - .32, 4.75 - 5.45)
    for y in (-.5, .5):
        block('windscreen frame', (5.08, y, .68), (1.0, .9, .06), p['cream'], hull, .03, 1).rotation_euler.y = -(slope - math.pi)
        block('windscreen', (5.1, y, .7), (.84, .74, .05), p['glass'], hull, .02, 1).rotation_euler.y = -(slope - math.pi)
    for s in (-1, 1):
        y = s * (HW / 2 - .05)
        prism('side window frame', [(3.45, .34), (4.55, .34), (4.35, .86), (3.45, .9)], y - .03 * s, y + .01 * s, p['cream'], hull, 0)
        prism('side window', [(3.55, .42), (4.45, .42), (4.28, .8), (3.55, .82)], y + .005 * s, y + .025 * s, p['glass'], hull, 0)
        lamp('chin lamp', (5.72, s * .5, -.4), (.04, .26, .14), '+x', p, hull)
        lamp('cab lamp', (3.3, y + .02 * s, .18), (.36, .04, .1), '+y' if s > 0 else '-y', p, hull)
        vent('cheek vent', (4.3, s * (HW / 2 - .1), -.45), (.5, .05, .24), '+y' if s > 0 else '-y', p, hull)
    barrel('probe', (6.18, 0, -.46), .065, .5, p['dark'], hull, 'X', sides=8)
    barrel('probe tip', (6.46, 0, -.46), .045, .08, p['black'], hull, 'X', sides=8, round_=0)
    block('cab hatch', (3.6, .35, H2 + .12), (.5, .5, .12), p['teal'], hull, .04)
    # the spine: forward hull, cargo bay, aft hull, a dark core behind every seam
    chamfered('core', (0, 0, 0), (6.6, HW - .3, HH - .3), p['dark'], hull, .35)
    chamfered('forward hull', (2.28, 0, 0), (1.42, HW, HH), p['cream'], hull, .42)
    chamfered('aft hull', (-1.75, 0, 0), (1.62, HW, HH), p['cream'], hull, .42)
    plates('forward', 2.28, 1.42, 2, p, hull)
    plates('aft', -1.75, 1.62, 2, p, hull, side='shade')
    for s in (-1, 1):
        side = '+y' if s > 0 else '-y'
        y = s * (HW / 2 + .02)
        block('forward band', (2.3, y, -.15), (1.2, .06, 1.1), p['teal'], hull, .04)
        handle('forward handle', (1.9, y + .03 * s, .25), (1.9, y + .03 * s, -.45), (0, s, 0), p, hull)
        vent('forward vent', (2.62, y, -.4), (.42, .05, .26), side, p, hull)
        lamp('forward lamp', (2.7, y + .01 * s, .2), (.3, .04, .09), side, p, hull)
        block('aft panel', (-1.75, y + .02 * s, -.35), (1.2, .06, .7), p['olive'], hull, .04)
        lamp('aft lamp', (-1.3, y + .05 * s, .48), (.3, .04, .09), side, p, hull)
        lamp('keel lamp', (1.0, s * .55, -H2 - .16), (.3, .1, .04), '-z', p, hull)
        pipe('top pipe', [(2.95, s * .82, H2 + .02), (1.7, s * .82, H2 + .02), (1.52, s * .82, H2 + .2), (-.95, s * .82, H2 + .2), (-1.12, s * .82, H2 + .02), (-2.55, s * .82, H2 + .02)], .05, p['mustard'], hull, .14)
    block('keel', (.2, 0, -H2 - .02), (6.4, 1.2, .26), p['dark'], hull, .05)
    for x in (.95, -.2): block('keel crate', (x, .36, -H2 - .3), (.72, .52, .4), p['olive'], hull, .05)
    antenna('cab mast', (3.35, -.45, H2 + .08), .75, p, hull)
    antenna('aft mast', (-2.35, .55, H2 + .06), .5, p, hull, 'red')
    for s in (-1, 1): lamp('nav', (3.02, s * (HW / 2 + .02), .75), (.14, .04, .09), '+y' if s > 0 else '-y', {**p, 'lamp': p['red'] if s > 0 else p['green']}, hull)
    return hull


# ── modules: each built around its own socket at the origin ───────

def m_reactor_mk1(p, g):
    block('reactor bed', (0, 0, .07), (1.3, 1.1, .14), p['dark'], g, .03)
    for y in (-.56, .56):
        block('reactor yoke', (0, y, .46), (.66, .12, .7), p['mustard'], g, .05)
        barrel('reactor hub', (0, y * 1.1, .54), .17, .08, p['dark'], g, 'Y', sides=12)
    barrel('reactor coil core', (0, 0, .54), .25, 1.02, p['dark'], g, 'Y', sides=16)
    for k in range(7): ring('reactor coil', (0, (k - 3) * .13, .54), .31, .05, p['black'], g, 'Y')
    lamp('reactor lamp', (.34, 0, .2), (.04, .32, .08), '+x', p, g)


def m_reactor_mk2(p, g):
    block('reactor bed', (0, 0, .08), (1.5, 1.3, .16), p['dark'], g, .03)
    barrel('reactor casing', (0, 0, .66), .52, 1.3, p['teal'], g, 'X', sides=12)
    for x in (-.45, 0, .45): ring('reactor band', (x, 0, .66), .54, .06, p['mustard'], g, 'X')
    for s in (-1, 1):
        for x in (-.35, 0, .35): block('reactor fin', (x, s * .82, .62), (.14, .32, .62), p['cream'], g, .03)
    barrel('reactor window', (.66, 0, .66), .3, .03, p['lamp'], g, 'X', round_=0)


def m_cruise_mk1(p, g):
    barrel('drive drum', (0, 0, 0), 1.2, 2.0, p['cream'], g, 'X', sides=8, spin=math.pi / 8, round_=.06)
    barrel('drive band', (.4, 0, 0), 1.25, .36, p['rust'], g, 'X', sides=8, spin=math.pi / 8, round_=.03)
    barrel('drive collar', (-.75, 0, 0), 1.16, .22, p['dark'], g, 'X', sides=8, spin=math.pi / 8, round_=.02)
    for s in (-1, 1):
        block('drive panel', (-.25, s * 1.12, .1), (.72, .06, .7), p['teal'], g, .04)
        vent('drive vent', (-.25, s * 1.13, -.5), (.6, .05, .22), '+y' if s > 0 else '-y', p, g)
    for z in (.48, -.48): nozzle('drive nozzle', (-1.25, 0, z), .44, .52, p, g)
    lamp('drive lamp', (.1, 0, 1.14), (.32, .14, .04), '+z', p, g)


def m_cruise_mk2(p, g):
    barrel('drive drum', (-.1, 0, 0), 1.32, 2.3, p['tealD'], g, 'X', sides=8, spin=math.pi / 8, round_=.06)
    barrel('drive band', (.52, 0, 0), 1.37, .38, p['rust'], g, 'X', sides=8, spin=math.pi / 8, round_=.03)
    ring('drive ring', (-.75, 0, 0), 1.3, .09, p['mustard'], g, 'X')
    for s in (-1, 1):
        for z in (-.45, 0, .45): block('drive radiator', (-.2, s * 1.5, z), (1.0, .32, .08), p['cream'], g, .02)
    for y, z in ((.52, .42), (-.52, .42), (0, -.5)): nozzle('drive nozzle', (-1.58, y, z), .4, .62, p, g)
    for s in (-1, 1): lamp('drive lamp', (.2, s * .75, 1.1), (.28, .12, .04), '+z', p, g)


def m_maneuver(p, g, big=False):
    r, length, mat_ = (.36, 1.3, 'teal') if big else (.28, 1.0, 'cream')
    for s in (-1, 1):
        y = s * (1.6 if big else 1.46)
        block('pod strut', (0, s * 1.16, 0), (.36, .34, .18), p['dark'], g, .03)
        barrel('pod', (0, y, 0), r, length, p[mat_], g, 'X', sides=8, spin=math.pi / 8, round_=.05)
        if big: ring('pod band', (.2, y, 0), r + .02, .05, p['mustard'], g, 'X')
        nozzle('pod nozzle', (-length / 2 - .1, y, 0), r * .55, .2, p, g)
        if big: nozzle('pod retro', (length / 2 + .1, y, 0), r * .45, .16, p, g)
        lamp('pod lamp', (.1, y + s * r * .95, .06), (.28, .04, .08), '+y' if s > 0 else '-y', p, g)


def m_cargo_mk1(p, g):
    chamfered('bay', (0, 0, 0), (1.9, HW, HH), p['cream'], g, .42)
    block('bay roof', (0, 0, HH / 2 + .03), (1.4, HW - .9, .08), p['shade'], g, .03)
    for s in (-1, 1):
        side, y = ('+y' if s > 0 else '-y'), s * (HW / 2 + .02)
        block('bay door', (0, y, -.1), (1.3, .07, 1.2), p['teal'], g, .04)
        pipe('bay frame', [(-.72, y + .05 * s, .56), (.72, y + .05 * s, .56), (.72, y + .05 * s, -.76), (-.72, y + .05 * s, -.76), (-.72, y + .05 * s, .56)], .038, p['mustard'], g, .08)
        handle('bay handle', (.4, y + .05 * s, .2), (.4, y + .05 * s, -.25), (0, s, 0), p, g, .1)
        lamp('bay lamp', (-.5, y + .04 * s, .38), (.2, .04, .08), side, p, g)


def m_cargo_mk2(p, g):
    m_cargo_mk1(p, g)
    colors = ['teal', 'rust', 'olive']
    for s in (-1, 1):
        block('rack', (0, s * 1.52, -.82), (1.9, .56, .08), p['mustard'], g, .02)
        for k, x in enumerate((-.62, 0, .62)): block('rack box', (x, s * 1.52, -.46), (.56, .52, .64), p[colors[k]], g, .05)


def m_ansible(p, g):
    block('ansible bed', (0, 0, .05), (.56, .56, .1), p['dark'], g, .02)
    barrel('ansible mast', (0, 0, .42), .05, .7, p['dark'], g, 'Z', sides=8, round_=0)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=.46)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -.22], context='VERTS')
    bmesh.ops.translate(bm, vec=Vector((0, 0, .46)), verts=bm.verts)
    dish = link('ansible dish', bm, p['cream'], g, None, (.1, 0, .5))
    dish.modifiers.new('shell', 'SOLIDIFY').thickness = .03
    dish.rotation_euler = (0, -1.0, 0)
    barrel('ansible feed', (.28, 0, .78), .03, .45, p['dark'], g, 'Z', sides=6, round_=0).rotation_euler = (0, -1.0, 0)
    barrel('ansible tip', (0, 0, .82), .05, .1, p['red'], g, 'Z', sides=8, round_=0)


def m_tank(p, g):
    block('tank bed', (0, 0, -.9), (1.9, 1.9, .16), p['dark'], g, .03)
    for y in (-.52, .52):
        barrel('tank', (0, y, -.15), .56, 1.8, p['shade'], g, 'X', sides=16)
        for x in (-.6, 0, .6): ring('tank strap', (x, y, -.15), .56, .045, p['mustard'], g, 'X')
    block('tank top', (0, 0, .78), (1.8, HW - .2, .5), p['cream'], g, .08)
    for s in (-1, 1): block('tank hazard', (0, s * (HW / 2 - .1), .78), (1.6, .06, .22), p['mustard'], g, .02)


def m_reefer(p, g):
    chamfered('reefer', (0, 0, 0), (1.9, HW, HH), p['white'], g, .42)
    for s in (-1, 1):
        for x in (-.6, -.3, 0, .3, .6): block('reefer fin', (x, s * (HW / 2 + .14), 0), (.08, .3, 1.2), p['frost'], g, .02)
    lamp('reefer lamp', (.7, 0, HH / 2 + .02), (.2, .2, .04), '+z', {**p, 'lamp': p['frost']}, g)


def m_pen(p, g):
    chamfered('pen', (0, 0, 0), (1.9, HW, HH), p['olive'], g, .42)
    for s in (-1, 1):
        y = s * (HW / 2 + .01)
        for x in (-.45, .35):
            barrel('pen window', (x, y, .25), .22, .06, p['lamp'], g, 'Y', round_=0)
            ring('pen rim', (x, y + .02 * s, .25), .22, .04, p['cream'], g, 'Y')
        vent('pen vent', (0, y, -.5), (1.0, .05, .22), '+y' if s > 0 else '-y', p, g)
    antenna('pen mast', (-.6, 0, HH / 2), .3, p, g, 'green')


def m_radar(p, g):
    block('radar bed', (0, 0, .06), (.62, .62, .12), p['dark'], g, .02)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=.32)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.01], context='VERTS')
    link('radar dome', bm, p['cream'], g, None, (0, 0, .12))
    arm = empty('radar arm', g, (0, 0, .58))
    arm['spin'] = 1.6
    block('radar bar', (0, 0, .08), (.1, 1.0, .12), p['shade'], arm, .03)
    barrel('radar post', (0, 0, -.06), .03, .2, p['dark'], arm, 'Z', sides=6, round_=0)


def m_driver(p, g):
    block('driver breech', (-.3, 0, .22), (.8, .62, .44), p['rust'], g, .05)
    for y in (-.15, .15): block('driver rail', (.9, y, .42), (2.6, .08, .08), p['dark'], g, .02)
    for x in (.3, .9, 1.5): ring('driver coil', (x, 0, .42), .26, .05, p['mustard'], g, 'X')
    barrel('driver muzzle', (2.25, 0, .42), .05, .08, p['red'], g, 'X', sides=8, round_=0)


def e_power(p, g):
    block('empty bed', (0, 0, .06), (1.3, 1.1, .12), p['dark'], g, .03)
    for x, y in ((-.5, -.42), (.5, -.42), (-.5, .42), (.5, .42)): barrel('bolt', (x, y, .16), .05, .08, p['mustard'], g, 'Z', sides=8, round_=0)


def e_cruise(p, g):
    for y, z in ((.85, .85), (.85, -.85), (-.85, .85), (-.85, -.85)): block('truss', (0, y, z), (1.9, .14, .14), p['dark'], g, .03)
    for x in (.85, -.85): block('frame', (x, 0, 0), (.14, 1.84, 1.84), p['dark'], g, .03)


def e_maneuver(p, g):
    for s in (-1, 1): block('pod strut', (0, s * 1.16, 0), (.36, .34, .18), p['dark'], g, .03)


def e_cargo(p, g):
    for y, z in ((.92, .88), (.92, -.88), (-.92, .88), (-.92, -.88)): block('bay rail', (0, y, z), (1.9, .12, .12), p['dark'], g, .03)
    for x in (-.8, 0, .8): block('bay rib', (x, 0, 0), (.1, HW - .3, HH - .3), p['black'], g, .02)


def e_utility(p, g):
    block('empty bed', (0, 0, .05), (.56, .56, .1), p['dark'], g, .02)


MODULES = {
    'reactor.mk1': ('power1', m_reactor_mk1), 'reactor.mk2': ('power1', m_reactor_mk2),
    'cruise.mk1': ('cruise1', m_cruise_mk1), 'cruise.mk2': ('cruise1', m_cruise_mk2),
    'maneuver.mk1': ('maneuver1', lambda p, g: m_maneuver(p, g)), 'maneuver.mk2': ('maneuver1', lambda p, g: m_maneuver(p, g, True)),
    'cargo.mk1': ('cargo1', m_cargo_mk1), 'cargo.mk2': ('cargo1', m_cargo_mk2),
    'ansible.mk1': ('utility1', m_ansible),
    'cargo.tank': ('cargo1', m_tank), 'cargo.reefer': ('cargo1', m_reefer), 'cargo.pen': ('cargo1', m_pen),
    'radar.mk1': ('utility1', m_radar), 'driver.mk1': ('utility1', m_driver),
    'empty.power': ('power1', e_power), 'empty.cruise': ('cruise1', e_cruise), 'empty.maneuver': ('maneuver1', e_maneuver),
    'empty.cargo': ('cargo1', e_cargo), 'empty.utility': ('utility1', e_utility),
}
PLANNED = {'cargo.tank', 'cargo.reefer', 'cargo.pen', 'radar.mk1', 'driver.mk1'}
STARTER = {'power1': 'reactor.mk1', 'cruise1': 'cruise.mk1', 'maneuver1': 'maneuver.mk1', 'cargo1': 'cargo.mk1', 'utility1': 'ansible.mk1'}


# ── the tug: after painted-parts-v1/ship-02 ───────────────────────

def tug(p, root):
    hull = empty('hull', root)
    drive = empty('drive', root)
    chamfered('body', (-.2, 0, 0), (2.6, 1.9, 1.6), p['cream'], hull, .4)
    prism('cab', [(1.0, -.78), (2.35, -.78), (2.75, -.35), (2.6, .2), (1.85, .78), (1.0, .8)], -.92, .92, p['cream'], hull, .08)
    slope = math.atan2(.58, -.75)
    for y in (-.44, .44):
        block('windscreen', (2.25, y, .5), (.9, .74, .05), p['glass'], hull, .02, 1).rotation_euler.y = -(slope - math.pi)
    block('mullion', (2.26, 0, .51), (.92, .1, .07), p['cream'], hull, .02, 1).rotation_euler.y = -(slope - math.pi)
    for s in (-1, 1):
        side = '+y' if s > 0 else '-y'
        prism('side window', [(1.25, .1), (1.95, .1), (1.75, .62), (1.25, .64)], s * .92 - .01, s * .92 + .01, p['glass'], hull, 0)
        lamp('cheek lamp', (2.72, s * .66, -.2), (.04, .2, .12), '+x', p, hull)
        lamp('brow lamp', (2.0, s * .5, .82), (.2, .1, .04), '+z', p, hull)
        block('side door', (-.35, s * .96, -.05), (.9, .06, 1.1), p['teal'], hull, .04)
        pipe('door handle', [(-.6, s * 1.0, .28), (-.1, s * 1.0, .28), (-.1, s * 1.0, -.3)], .04, p['mustard'], hull, .06)
        lamp('flank lamp', (.55, s * .99, .1), (.26, .04, .1), side, p, hull)
        # the claw: a jaw on an arm each side, mustard and teal
        block('claw arm', (3.0, s * .6, -.55), (.9, .2, .2), p['dark'], hull, .04)
        barrel('claw piston', (3.0, s * .6, -.32), .07, .8, p['shade'], hull, 'X', sides=8)
        pipe('claw', [(3.3, s * .6, -.12), (3.75, s * .6, -.12), (3.75, s * .98, -.12), (3.75, s * .98, -.95), (3.3, s * .98, -.95)], .13, p['mustard'], hull, .16)
        block('claw pad', (3.78, s * .96, -.54), (.18, .26, .5), p['teal'], hull, .04)
        block('cheek', (2.45, s * .8, -.45), (.5, .3, .5), p['cream'], hull, .08)
        vent('cheek vent', (2.45, s * .96, -.45), (.34, .04, .22), '+y' if s > 0 else '-y', p, hull)
        pipe('pod pipe', [(.3, s * .8, .55), (.3, s * 1.3, .55), (-.7, s * 1.3, .55), (-.7, s * 1.5, .55)], .06, p['mustard'], hull, .12)
        pipe('pod pipe low', [(.0, s * .92, -.35), (-.9, s * .92, -.35), (-.9, s * 1.5, -.25)], .06, p['mustard'], hull, .12)
        # outrigger pods aft, teal and cream, lamps on their faces
        block('outrigger', (-1.2, s * 1.25, .1), (.5, .9, .22), p['dark'], drive, .04)
        chamfered('drive pod', (-1.35, s * 1.9, .1), (2.1, .95, .95), p['teal'], drive, .22)
        block('pod collar', (-.6, s * 1.9, .1), (.34, 1.0, 1.0), p['cream'], drive, .08)
        lamp('pod lamp', (-.25, s * 1.9, .28), (.04, .5, .12), '+x', p, drive)
        lamp('pod lamp low', (-.25, s * 1.9, -.12), (.04, .5, .12), '+x', p, drive)
        vent('pod grille', (-2.42, s * 1.9, .1), (.05, .6, .5), '-x', p, drive)
        nozzle('pod nozzle', (-2.55, s * 1.9, .1), .3, .2, p, drive)
    block('jaw base', (2.55, 0, -.6), (.6, 1.1, .36), p['dark'], hull, .05)
    block('roof hatch', (.9, 0, .86), (.6, .7, .14), p['teal'], hull, .05)
    for x in (.2, -.9): block('roof plate', (x, 0, .84), (.9, 1.0, .08), p['shade'], hull, .03)
    block('mustard band', (-.1, 0, 0), (.3, 1.96, 1.66), p['mustard'], hull, .05)
    vent('roof vent', (-.8, 0, .82), (.6, .5, .05), '+z', p, hull)
    antenna('mast', (.4, -.4, .8), .5, p, hull)
    return hull


# ── shipping containers: iso boxes in shipping colours ─────────────

BW, BH, BHC = .96, 1.0, 1.12          # width, height, high-cube height
BAY = 2.52                             # a 20 ft box and its gap
SHIPPING = ['#9A3B2C', '#2F5D8C', '#2E6F73', '#3E6B45', '#D2702E', '#D9A93A', '#8B8F93', '#E3E1DA', '#6E2B2B', '#24364F', '#B85C38', '#4E7C8A']


def darken(value, k):
    return '#' + ''.join(f'{max(0, min(255, round(int(value[i:i + 2], 16) * k))):02X}' for i in (1, 3, 5))


def wall(name, length, height, depth, pitch, material, parent, at, turn=0):
    """a corrugated wall: trapezoid ridges across its length, closed behind"""
    n = max(3, round(length / pitch))
    step = length / n
    ridge = []
    for k in range(n):
        x0 = -length / 2 + k * step
        ridge += [(x0, 0), (x0 + step * .18, depth), (x0 + step * .62, depth), (x0 + step * .8, 0)]
    poly = ridge + [(length / 2, 0), (length / 2, -.03), (-length / 2, -.03)]
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -height / 2)) for x, y in poly]
    hi = [bm.verts.new((x, y, height / 2)) for x, y in poly]
    bm.faces.new(list(reversed(lo)))
    bm.faces.new(hi)
    for i in range(len(poly)):
        j = (i + 1) % len(poly)
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if turn: bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(turn, 3, 'Z'))
    return link(name, bm, material, parent, None, at)


def container(name, kind, length, value, p, parent, at, high=False, logo=None):
    """an iso box: frame, corner castings, corrugated walls, doors with lock bars"""
    g = empty(name, parent, at)
    h, w = (BHC if high else BH), BW
    body, frame, steel = mat('box ' + value, value), mat('box frame ' + value, darken(value, .72)), p['dark']
    for sx in (-1, 1):
        for sy in (-1, 1):
            block('post', (sx * (length / 2 - .035), sy * (w / 2 - .035), 0), (.07, .07, h), frame, g, 0)
            for sz in (-1, 1): block('casting', (sx * (length / 2 - .04), sy * (w / 2 - .04), sz * (h / 2 - .04)), (.095, .095, .09), steel, g, 0)
        for sz in (-1, 1): block('end rail', (sx * (length / 2 - .035), 0, sz * (h / 2 - .045)), (.06, w - .16, .08), frame, g, 0)
    for sy in (-1, 1):
        for sz in (-1, 1): block('side rail', (0, sy * (w / 2 - .035), sz * (h / 2 - .045)), (length - .16, .06, .08), frame, g, 0)
    if kind == 'tank':
        barrel('tank', (0, 0, 0), h * .42, length - .3, body, g, 'X', sides=18)
        for x in (-length * .32, length * .32): ring('tank saddle', (x, 0, 0), h * .43, .03, frame, g, 'X')
        barrel('manhole', (0, 0, h * .42), .12, .08, steel, g, 'Z', sides=10)
        block('walkway', (0, 0, h / 2 - .02), (length * .6, .22, .03), steel, g, .01, 1)
        return g
    if kind == 'flat':
        block('floor', (0, 0, -h / 2 + .06), (length - .1, w - .1, .06), frame, g, .01, 1)
        for sx in (-1, 1): block('bulkhead', (sx * (length / 2 - .06), 0, 0), (.05, w - .14, h - .16), body, g, .01, 1)
        block('load', (0, 0, -.12), (length * .55, w * .7, h * .55), p['olive'], g, .04)
        for x in (-.25, .25): pipe('lashing', [(x * length, -w * .36, -h / 2 + .1), (x * length, -w * .36, .17), (x * length, w * .36, .17), (x * length, w * .36, -h / 2 + .1)], .015, p['mustard'], g, .04)
        return g
    for sy in (-1, 1): wall('side', length - .16, h - .17, .03, .25, body, g, (0, sy * (w / 2 - .05), 0), 0 if sy > 0 else math.pi)
    if kind == 'open': barrel('tarp', (0, 0, h / 2 - .04), w * .5, length - .18, mat('tarp ' + (logo or '#2F5D8C'), logo or '#2F5D8C'), g, 'X', sides=10).scale = (1, 1, .36)
    else: block('roof', (0, 0, h / 2 - .06), (length - .16, w - .1, .04), body, g, 0)
    if kind == 'reefer':
        block('machinery', (length / 2 - .05, 0, 0), (.05, w - .14, h - .17), p['white'], g, .01, 1)
        vent('reefer grille', (length / 2 - .02, -.15, -.1), (.03, .4, .5), '+x', p, g)
        barrel('reefer fan', (length / 2 - .02, .2, .15), .14, .03, steel, g, 'X', sides=14, round_=0)
        ring('reefer fan rim', (length / 2 - .01, .2, .15), .14, .02, frame, g, 'X')
        block('reefer box', (length / 2 - .02, .22, -.25), (.04, .18, .16), steel, g, .01, 1)
        lamp('reefer lamp', (length / 2 - .01, -.38, .38), (.03, .08, .04), '+x', {**p, 'lamp': p['green']}, g)
    else:
        block('doors', (length / 2 - .05, 0, 0), (.04, w - .14, h - .17), body, g, .008, 1)
        block('door seam', (length / 2 - .028, 0, 0), (.012, .016, h - .19), steel, g, 0)
        for y in (-.36, -.13, .13, .36):
            barrel('lock bar', (length / 2 - .022, y * w, 0), .012, h - .22, steel, g, 'Z', sides=6, round_=0)
            block('lock handle', (length / 2 - .014, y * w + .035, -.12), (.018, .07, .018), steel, g, 0)
    wall('end', w - .16, h - .17, .02, .15, body, g, (-length / 2 + .05, 0, 0), math.pi / 2)
    if logo and kind == 'dry':
        for sy in (-1, 1): block('logo', (0, sy * (w / 2 - .018), .08), (length * .48, .012, h * .3), mat('logo ' + logo, logo), g, 0)
    return g


def containers(p, root):
    """the kit: one of each kind, side by side"""
    kit = [('container 20', 'dry', BAY - .14, '#9A3B2C', False, '#E3E1DA'), ('container 40', 'dry', BAY * 2 - .14, '#2F5D8C', False, None),
        ('container hc', 'dry', BAY * 2 - .14, '#3E6B45', True, '#D9A93A'), ('container reefer', 'reefer', BAY - .14, '#E3E1DA', False, None),
        ('container tank', 'tank', BAY - .14, '#D2702E', False, None), ('container open', 'open', BAY - .14, '#D9A93A', False, '#2F5D8C'),
        ('container flat', 'flat', BAY - .14, '#8B8F93', False, None)]
    for k, (name, kind, length, value, high, logo) in enumerate(kit):
        container(name, kind, length, value, p, root, ((k % 4) * 5.2 - 7.8 + length / 2, -(k // 4) * 1.6 + .8, 0), high, logo)


# ── the hauler: after painted-parts-v1/ship-01, now a container ship ─

def bay_frame(x, p, parent):
    """a mustard square round a stack of 4 boxes"""
    for z in (-1.18, 1.22): block('frame beam', (x, 0, z), (.12, 2.32, .12), p['mustard'], parent, .03)
    for y in (-1.1, 1.1): block('frame post', (x, y, .02), (.12, .12, 2.52), p['mustard'], parent, .03)
    for y in (-1.1, 1.1): lamp('frame lamp', (x, y, 1.3), (.1, .1, .04), '+z', p, parent)


def hauler(p, root):
    hull, cargo, drive = empty('hull', root), empty('cargo', root), empty('drive', root)
    prism('cab', [(4.6, -.85), (6.2, -.85), (6.7, -.35), (6.55, .25), (5.9, .85), (4.6, .9)], -.95, .95, p['cream'], hull, .08)
    block('cab chin', (5.9, 0, -.62), (1.4, 1.94, .5), p['teal'], hull, .08)
    slope = math.atan2(.6, -.65)
    for y in (-.46, .46):
        block('windscreen frame', (6.23, y, .54), (.86, .92, .05), p['teal'], hull, .02, 1).rotation_euler.y = -(slope - math.pi)
        block('windscreen', (6.25, y, .56), (.72, .8, .05), p['glass'], hull, .02, 1).rotation_euler.y = -(slope - math.pi)
    for s in (-1, 1):
        lamp('headlamp', (6.66, s * .6, -.3), (.04, .26, .12), '+x', p, hull)
        lamp('cab lamp', (5.3, s * .96, .3), (.3, .04, .1), '+y' if s > 0 else '-y', p, hull)
        barrel('cab cheek', (5.6, s * .98, -.35), .22, .5, p['teal'], hull, 'X', sides=8)
    bays, x0 = 6, 4.3
    block('spine', (x0 - BAY * bays / 2, 0, 0), (BAY * bays + .6, .34, .34), p['dark'], hull, .04)
    rnd = random.Random(11)
    taken = set()
    for i in range(bays):
        x = x0 - BAY * (i + .5)
        bay_frame(x + BAY / 2, p, hull)
        for y in (-.53, .53):
            for z in (-.56, .56):
                if (i, y, z) in taken: continue
                roll, value = rnd.random(), rnd.choice(SHIPPING)
                logo = rnd.choice([v for v in ('#E3E1DA', '#D9A93A', '#24364F') if v != value]) if rnd.random() < .4 else None
                if roll < .06: continue
                if roll < .32 and i + 1 < bays and (i + 1, y, z) not in taken:
                    taken.add((i + 1, y, z))
                    container('box 40', 'dry', BAY * 2 - .14, value, p, cargo, (x - BAY / 2, y, z + (.06 if z > 0 else 0)), z > 0 and rnd.random() < .4, logo)
                    continue
                kind = 'reefer' if roll > .93 else 'tank' if roll > .87 else 'open' if roll > .82 else 'dry'
                container('box 20', kind, BAY - .14, '#E3E1DA' if kind == 'reefer' else value, p, cargo, (x, y, z), False, logo if kind != 'open' else rnd.choice(['#2F5D8C', '#3E6B45', '#D2702E']))
    xe = x0 - BAY * bays
    bay_frame(xe, p, hull)
    for s in (-1, 1):
        chamfered('engine pod', (xe - 1.0, s * .62, .55), (1.8, 1.1, 1.0), p['teal'], drive, .22)
        chamfered('engine pod low', (xe - 1.0, s * .62, -.55), (1.8, 1.1, 1.0), p['cream'], drive, .22)
        for z in (.55, -.55):
            block('pod band', (xe - .4, s * .62, z), (.2, 1.16, 1.06), p['mustard'], drive, .03)
            nozzle('pod nozzle', (xe - 2.0, s * .62, z), .34, .26, p, drive)
    antenna('mast', (5.2, .4, .9), .7, p, hull)
    antenna('aft mast tip', (xe - .6, 0, 1.08), .4, p, hull, 'red')
    return hull


# ── mr nobody: a raider, built from other ships ───────────────────

def nobody(p, root):
    hull, drive = empty('hull', root), empty('drive', root)
    rust, ox, scorch = mat('raider rust', '#94402F'), mat('raider oxblood', '#5E2620'), mat('scorched', '#2A2422')
    red = mat('raider red', '#FF3B2F', emission=5)
    # a hauler cab, cut down and plated over, a slit to look out of
    prism('cab', [(2.0, -.75), (3.5, -.75), (4.15, -.3), (4.05, .25), (3.3, .8), (2.0, .85)], -.82, .82, rust, hull, .06)
    for s in (-1, 1): block('cab armor', (3.0, s * .87, .05), (1.3, .08, .9), ox, hull, .03).rotation_euler = (s * .12, .06, 0)
    block('visor slit', (3.98, 0, .3), (.08, 1.0, .1), red, hull, .02, 1)
    block('bow ram', (4.25, 0, -.45), (.5, 1.1, .35), scorch, hull, .05)
    # a grapple: an arm and 3 fingers
    block('grapple arm', (4.7, 0, -.6), (.9, .22, .22), p['dark'], hull, .04)
    for a in (-1, 0, 1): pipe('grapple finger', [(5.1, a * .14, -.6), (5.45, a * .3, -.52), (5.7, a * .22, -.82)], .05, p['dark'], hull, .1)
    # the middle: bare girders, a stolen box lashed on, a fuel cell
    for y in (-.62, .62):
        for z in (-.55, .55): block('girder', (.2, y, z), (3.6, .12, .12), p['dark'], hull, .02)
    for k in range(3):
        x = -1.3 + k * 1.2
        for y in (-.62, .62): pipe('brace', [(x, y, -.55), (x + 1.2, y, .55)], .04, p['dark'], hull, 0)
    block('fuel cell', (.2, .25, 0), (2.4, .7, .8), mat('raider olive', '#5F6B40'), hull, .08)
    container('stolen box', 'dry', 2.3, '#2F5D8C', p, hull, (.2, -1.2, -.05), logo='#E3E1DA')
    for x in (-.6, 1.0): pipe('lashing', [(x, -.62, .55), (x, -1.2, .6), (x, -1.72, .2)], .03, p['mustard'], hull, .08)
    # the aft: welded plates and patches from other ships
    chamfered('aft', (-2.5, 0, 0), (2.2, 1.8, 1.7), ox, hull, .3)
    for x, y, z, c, r in ((-2.2, .91, .2, p['cream'], .1), (-2.9, -.91, -.2, p['teal'], -.15), (-1.9, -.91, .35, p['olive'], .2), (-2.8, .91, -.35, p['mustard'], -.08)):
        block('patch', (x, y, z), (.6, .05, .45), c, hull, .02).rotation_euler.x = r
    for k in range(8): block('hazard', (-3.45 + k * .22, 0, .86), (.2, 1.2, .04), p['mustard'] if k % 2 == 0 else scorch, hull, 0)
    for s in (-1, 1):
        block('stern armor', (-2.3, s * .95, -.45), (1.6, .1, .55), rust, hull, .03).rotation_euler.x = s * -.25
        for k in range(4): block('radiator', (-3.1 + k * .28, s * 1.12, .25), (.06, .36, .6), p['dark'], hull, .01, 1)
    barrel('salvaged pod', (1.2, .95, .55), .26, 1.1, p['teal'], hull, 'X', sides=8, spin=math.pi / 8)
    block('pod glass', (1.72, .95, .62), (.06, .3, .16), p['glass'], hull, .02, 1)
    for k in range(3): block('bow spike', (4.3, (k - 1) * .35, .35), (.5, .06, .06), p['dark'], hull, .01, 1).rotation_euler.z = (k - 1) * .3
    # the mass driver: rails, coils, a breech, a red muzzle
    for y in (-.16, .16): block('driver rail', (.7, y, 1.1), (6.2, .1, .1), p['dark'], hull, .02)
    for x in (-1.0, .2, 1.4, 2.6): ring('driver coil', (x, 0, 1.1), .3, .065, p['mustard'], hull, 'X')
    block('driver breech', (-2.4, 0, 1.02), (.9, .7, .5), rust, hull, .06)
    block('driver mount', (-2.4, 0, .82), (.5, .4, .2), p['dark'], hull, .03)
    barrel('driver muzzle tip', (3.85, 0, 1.1), .09, .14, red, hull, 'X', sides=10, round_=0)
    # mismatched drives, a scorch ring round the big one
    nozzle('big drive', (-3.9, .25, .15), .55, .7, p, drive)
    nozzle('small drive', (-3.75, -.45, -.4), .3, .45, p, drive)
    ring('scorch', (-3.58, .25, .15), .57, .05, scorch, drive, 'X')
    # whips and red lights
    for x, y, h_, tilt in ((-1.6, .5, .9, .4), (-2.9, -.4, 1.1, -.3), (2.6, .3, .7, .5)):
        barrel('whip', (x, y, .85 + h_ / 2), .025, h_, p['dark'], hull, 'Z', sides=6, round_=0).rotation_euler.x = tilt
    for k, at in enumerate(((1.0, .63, .62), (-1.4, .91, .7), (2.5, -.82, .45), (-3.4, -.9, .5))):
        barrel(f'red tip {k}', at, .05, .08, red, hull, 'Y', sides=8, round_=0)
    return hull


# ── the patrol cutter: sol outpost authority ──────────────────────

def cutter(p, root):
    hull, drive = empty('hull', root), empty('drive', root)
    navy, white, check = mat('patrol navy', '#24364F'), mat('patrol white', '#E6E4DC'), mat('patrol check', '#E8C33A')
    prism('hull', [(-2.8, -.48), (2.1, -.48), (3.35, -.16), (3.3, .08), (2.1, .5), (-2.8, .56)], -.76, .76, navy, hull, .07)
    prism('deck', [(-2.5, .5), (1.7, .5), (1.05, .92), (-2.3, .95)], -.56, .56, white, hull, .06)
    prism('canopy', [(.75, .5), (2.0, .5), (1.45, .86), (.85, .9)], -.36, .36, p['glass'], hull, .05)
    for s in (-1, 1):
        for k in range(14): block('check', (-2.45 + k * .33, s * .77, .02), (.3, .03, .2), check if k % 2 == 0 else white, hull, 0)
        block('pylon', (-1.6, s * .95, -.05), (.9, .4, .14), navy, hull, .04)
        barrel('nacelle', (-1.5, s * 1.25, -.05), .32, 1.9, white, drive, 'X', sides=12)
        ring('nacelle band', (-1.0, s * 1.25, -.05), .33, .045, navy, drive, 'X')
        ring('intake', (-.55, s * 1.25, -.05), .3, .05, p['dark'], drive, 'X')
        nozzle('nacelle drive', (-2.6, s * 1.25, -.05), .26, .3, p, drive)
        block('wing', (-1.25, s * 1.68, -.12), (1.0, .42, .06), navy, hull, .02).rotation_euler.x = s * .18
        barrel('wing tip', (-1.25, s * 1.9, -.08), .05, .1, mat('check lamp', '#FFD24A', emission=5), hull, 'Y', sides=8, round_=0)
    block('lightbar', (-.4, 0, 1.0), (.3, .92, .12), p['dark'], hull, .03)
    block('lightbar red', (-.4, .24, 1.08), (.22, .34, .08), mat('lightbar red', '#FF4A3A', emission=6), hull, .02, 1)
    block('lightbar blue', (-.4, -.24, 1.08), (.22, .34, .08), mat('lightbar blue', '#4F8BFF', emission=6), hull, .02, 1)
    prism('fin', [(-2.85, .55), (-2.05, .55), (-2.45, 1.35), (-2.9, 1.35)], -.05, .05, white, hull, .03)
    barrel('fin tip', (-2.68, 0, 1.38), .05, .08, p['red'], hull, 'Z', sides=8, round_=0)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=.24)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.01], context='VERTS')
    link('sensor dome', bm, white, hull, None, (-1.45, 0, .95))
    barrel('spotlight', (2.55, 0, -.56), .1, .22, p['dark'], hull, 'X', sides=10)
    barrel('spot lamp', (2.67, 0, -.56), .08, .03, mat('spot white', '#F4F4F0', emission=6), hull, 'X', sides=10, round_=0)
    block('clamp', (.4, 0, -.6), (1.4, .3, .16), p['dark'], hull, .03)
    for y in (-.12, .12): pipe('clamp jaw', [(1.1, y, -.6), (1.35, y, -.6), (1.35, y * 1.6, -.78)], .04, p['mustard'], hull, .06)
    antenna('patrol mast', (-1.95, .32, .95), .6, p, hull)
    return hull


# ── the tug buoy: a float, a beacon, a sign that sells the tow ────

def tug_buoy(p, root):
    body = empty('body', root)
    for k, c in enumerate((p['rust'], p['cream'], p['rust'])):
        barrel('float', (0, 0, -.55 + k * .3), .44, .3, c, body, 'Z', sides=6, round_=.02, spin=math.pi / 6)
    ring('fender', (0, 0, -.25), .46, .05, p['dark'], body, 'Z')
    barrel('cap', (0, 0, .3), .44, .3, p['cream'], body, 'Z', top=.16, sides=6, round_=.02, spin=math.pi / 6)
    barrel('ballast', (0, 0, -.82), .2, .2, p['dark'], body, 'Z', top=.1, sides=8)
    for k in range(6):
        a = k / 6 * math.tau
        block('hazard', (.43 * math.cos(a), .43 * math.sin(a), -.55), (.05, .2, .1), p['mustard'], body, 0).rotation_euler.z = a
    barrel('beacon base', (0, 0, .5), .13, .08, p['dark'], body, 'Z', sides=8)
    barrel('beacon', (0, 0, .62), .08, .16, mat('beacon pink', '#FF4FA0', emission=6), body, 'Z', sides=8, round_=0)
    for k in range(4): barrel('beacon post', (.11 * math.cos(k * math.pi / 2), .11 * math.sin(k * math.pi / 2), .62), .012, .18, p['dark'], body, 'Z', sides=4, round_=0)
    barrel('beacon cap', (0, 0, .73), .12, .04, p['dark'], body, 'Z', sides=8)
    barrel('sign mast', (-.22, 0, 1.0), .035, 1.0, p['dark'], body, 'Z', sides=8, round_=0)
    block('sign arm', (-.22, 0, 1.48), (.12, .3, .08), p['dark'], body, .02)
    block('sign frame', (-.18, 0, 1.9), (.08, 1.75, .85), p['dark'], body, .03)
    block('sign face', (-.13, 0, 1.9), (.02, 1.6, .7), mat('sign black', '#14101C'), body, 0)
    a = empty('sign_anchor', root, (-.1, 0, 1.9)); a['sign'] = True
    for s in (-1, 1):
        block('wing arm', (0, s * .62, 0), (.06, .4, .06), p['dark'], body, .01, 1)
        block('solar', (0, s * 1.08, 0), (.04, .56, .82), p['teal'], body, .02, 1)
        for z in (-.2, .2): block('solar line', (.025, s * 1.08, z), (.01, .56, .02), p['dark'], body, 0)
        nozzle('station keeper', (0, s * .3, -.7), .06, .1, p, body)
    return body


# ── the robots: a deckhand that walks, a porter on wheels ─────────

def head_unit(p, parent, at, scale=1):
    head = empty('head', parent, at)
    head['joint'] = True
    eye = mat('robot eye', '#9FF2FF', emission=6)
    block('skull', (0, 0, .14 * scale), (.46 * scale, .52 * scale, .38 * scale), p['cream'], head, .11 * scale)
    block('visor', (.215 * scale, 0, .12 * scale), (.05, .42 * scale, .26 * scale), p['black'], head, .06 * scale)
    for y in (-.09, .09): block('eye', (.245 * scale, y * scale, .13 * scale), (.02, .05 * scale, .09 * scale), eye, head, .01, 1)
    for s in (-1, 1):
        barrel('ear', (0, s * .27 * scale, .14 * scale), .11 * scale, .05, p['cream'], head, 'Y', sides=14)
        ring('ear rim', (0, s * .29 * scale, .14 * scale), .1 * scale, .02, p['mustard'], head, 'Y')
    lamp('head lamp', (0, 0, .34 * scale), (.2 * scale, .06, .03), '+z', p, head)
    return head


def deckhand(p, root):
    torso = empty('torso', root, (0, 0, .5))
    block('chest', (0, 0, .1), (.3, .36, .32), p['cream'], torso, .07)
    block('chest side', (0, 0, .08), (.22, .38, .2), p['dark'], torso, .03)
    lamp('chest lamp', (.16, 0, .18), (.03, .12, .04), '+x', p, torso)
    block('hip', (0, 0, -.1), (.2, .28, .1), p['dark'], torso, .03)
    barrel('neck', (0, 0, .3), .05, .08, p['dark'], torso, 'Z', sides=8)
    head_unit(p, root, (0, 0, .86))
    for s, n in ((1, 'arm_l'), (-1, 'arm_r')):
        arm = empty(n, root, (0, s * .22, .68)); arm['joint'] = True
        barrel('shoulder', (0, s * .03, 0), .07, .08, p['cream'], arm, 'Y', sides=10)
        block('upper arm', (0, s * .04, -.1), (.08, .07, .16), p['dark'], arm, .02)
        block('forearm', (.02, s * .04, -.22), (.12, .1, .12), p['cream'], arm, .03)
        block('hand', (.04, s * .04, -.31), (.07, .06, .06), p['dark'], arm, .02)
    for s, n in ((1, 'leg_l'), (-1, 'leg_r')):
        leg = empty(n, root, (0, s * .09, .38)); leg['joint'] = True
        barrel('thigh', (0, 0, -.1), .045, .18, p['dark'], leg, 'Z', sides=8)
        block('boot', (.03, 0, -.28), (.2, .12, .13), p['cream'], leg, .04)
        block('sole', (.03, 0, -.355), (.2, .12, .03), p['black'], leg, .01, 1)
        lamp('boot lamp', (.13, 0, -.27), (.02, .05, .03), '+x', p, leg)
    return torso


def porter(p, root):
    torso = empty('torso', root, (0, 0, .42))
    block('body', (0, 0, 0), (.42, .44, .36), p['cream'], torso, .08)
    block('body band', (0, 0, -.05), (.44, .46, .08), p['teal'], torso, .03)
    lamp('body lamp', (.22, 0, .06), (.03, .16, .05), '+x', p, torso)
    block('fork', (.3, 0, .1), (.28, .3, .03), p['dark'], torso, .01, 1)
    block('carried crate', (.32, 0, .23), (.24, .26, .22), p['olive'], torso, .04)
    block('crate band', (.32, 0, .23), (.25, .27, .04), p['mustard'], torso, .01, 1)
    head_unit(p, root, (-.02, 0, .66), .85)
    block('axle', (0, 0, .16), (.12, .5, .08), p['dark'], root, .02)
    for s, n in ((1, 'wheel_l'), (-1, 'wheel_r')):
        wheel = empty(n, root, (0, s * .25, .16)); wheel['joint'] = True
        barrel('tire', (0, 0, 0), .16, .1, p['black'], wheel, 'Y', sides=16)
        barrel('hub', (0, s * .052, 0), .08, .02, p['mustard'], wheel, 'Y', sides=10, round_=0)
        block('hub bolt', (0, s * .064, .05), (.03, .01, .03), p['dark'], wheel, 0)
    return torso


# ── merge: one mesh per material per assembly, fewer draw calls ──

KEEP = ('tip', 'nav', 'lightbar', 'beacon', 'eye')


def consolidate(assembly, deep=True):
    """join the static meshes under an assembly. moving and blinking parts stay apart"""
    meshes = []
    def walk(o):
        for c in o.children:
            if c.type == 'EMPTY':
                if deep and not (c.get('spin') or c.get('joint') or c.get('sign') or c.name.startswith('socket_')): walk(c)
            elif c.type == 'MESH' and not any(k in c.name for k in KEEP):
                meshes.append(c)
    walk(assembly)
    if len(meshes) < 2: return
    for m in meshes:
        with bpy.context.temp_override(object=m, active_object=m, selected_objects=[m], selected_editable_objects=[m]):
            for mod in list(m.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    meshes[0].name = assembly.name + ' body'


def consolidate_all(root):
    for c in list(root.children):
        if c.type == 'EMPTY' and not c.name.startswith('socket_') and not c.get('sign'): consolidate(c)
    consolidate(root, deep=False)


# ── one pass per hull: build, sockets, export, save, render ───────

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block_ in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(block_):
            if item.users == 0: block_.remove(item)
    MATS.clear()


def export(root, path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root] + list(root.children_recursive): obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_apply=True,
        export_extras=True, export_animations=False, export_cameras=False, export_lights=False, export_yup=True)


def stats(root):
    deps = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for obj in root.children_recursive:
        if obj.type == 'MESH':
            mesh = obj.evaluated_get(deps).to_mesh()
            tris += sum(len(f.vertices) - 2 for f in mesh.polygons)
            obj.evaluated_get(deps).to_mesh_clear()
    return tris


# ── preview: toon light and an ink outline, at the painted angle ──

def toonify(size=14):
    outline = bpy.data.materials.new('preview / outline')
    outline.use_nodes = True
    nodes = outline.node_tree.nodes
    nodes.clear()
    em = nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (.012, .009, .007, 1)
    o = nodes.new('ShaderNodeOutputMaterial'); outline.node_tree.links.new(em.outputs[0], o.inputs[0])
    outline.use_backface_culling = True
    for m in list(MATS.values()):
        nt = m.node_tree
        base = nt.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:]
        nt.nodes.clear()
        out_ = nt.nodes.new('ShaderNodeOutputMaterial')
        if m.get('emissive'):
            em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = base; em.inputs['Strength'].default_value = 3
            nt.links.new(em.outputs[0], out_.inputs[0]); continue
        diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
        rgb = nt.nodes.new('ShaderNodeShaderToRGB')
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        els = ramp.color_ramp.elements
        els[0].position, els[0].color = 0, (.46, .44, .5, 1)
        els[1].position, els[1].color = .12, (.74, .72, .74, 1)
        e3 = els.new(.36); e3.color = (1, 1, 1, 1)
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1
        a = next(i for i in mix.inputs if i.identifier == 'A_Color'); b = next(i for i in mix.inputs if i.identifier == 'B_Color')
        a.default_value = base
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(diff.outputs[0], rgb.inputs[0]); nt.links.new(rgb.outputs[0], ramp.inputs[0])
        noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 7; noise.inputs['Detail'].default_value = 8
        coord = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
        wear = nt.nodes.new('ShaderNodeValToRGB'); wear.color_ramp.interpolation = 'CONSTANT'
        wear.color_ramp.elements[0].color = (1, 1, 1, 1); wear.color_ramp.elements[1].position = .7; wear.color_ramp.elements[1].color = (.8, .76, .72, 1)
        both = nt.nodes.new('ShaderNodeMix'); both.data_type = 'RGBA'; both.blend_type = 'MULTIPLY'; both.inputs['Factor'].default_value = 1
        nt.links.new(noise.outputs['Fac'], wear.inputs[0])
        nt.links.new(ramp.outputs[0], next(i for i in both.inputs if i.identifier == 'A_Color'))
        nt.links.new(wear.outputs[0], next(i for i in both.inputs if i.identifier == 'B_Color'))
        nt.links.new(next(o_ for o_ in both.outputs if o_.identifier == 'Result_Color'), b)
        nt.links.new(next(o_ for o_ in mix.outputs if o_.identifier == 'Result_Color'), em.inputs[0])
        nt.links.new(em.outputs[0], out_.inputs[0])
    for obj in bpy.data.objects:
        if obj.type != 'MESH': continue
        obj.data.materials.append(outline)
        mod = obj.modifiers.new('outline', 'SOLIDIFY')
        mod.thickness, mod.offset, mod.use_flip_normals, mod.use_rim = size * .002, 1, True, False
        mod.material_offset = len(obj.data.materials) - 1


def render(root, name, size):
    scene = bpy.context.scene
    try: scene.render.engine = 'BLENDER_EEVEE'
    except TypeError: scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = 1536, 1024
    scene.render.film_transparent = True
    scene.render.image_settings.file_format, scene.render.image_settings.color_mode = 'PNG', 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('preview') if not scene.world else scene.world
    scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.05, .06, .09, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    key = bpy.data.objects.new('preview key', bpy.data.lights.new('preview key', 'SUN')); scene.collection.objects.link(key)
    key.data.energy, key.data.color = 3.2, (1, .93, .82); key.rotation_euler = (math.radians(50), math.radians(-25), math.radians(140))
    fill = bpy.data.objects.new('preview fill', bpy.data.lights.new('preview fill', 'SUN')); scene.collection.objects.link(fill)
    fill.data.energy, fill.data.color = .8, (.6, .75, 1); fill.rotation_euler = (math.radians(110), 0, math.radians(-40))
    cam = bpy.data.objects.new('preview camera', bpy.data.cameras.new('preview camera')); scene.collection.objects.link(cam)
    cam.data.type, cam.data.ortho_scale = 'ORTHO', size
    scene.camera = cam
    bpy.context.view_layer.update()
    pts = [obj.matrix_world @ Vector(c) for obj in root.children_recursive if obj.type == 'MESH' for c in obj.bound_box]
    middle = Vector([(min(q[i] for q in pts) + max(q[i] for q in pts)) / 2 for i in range(3)])
    for suffix, az, el in (('preview', 55, 30), ('reverse', -125, 28)):
        a, e = math.radians(az), math.radians(el)
        d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
        cam.location = middle + d * 40
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        right = (-d).cross(Vector((0, 0, 1))).normalized(); up = right.cross(-d)
        key.rotation_euler = (-right * .55 + up * .7 + d * .45).normalized().to_track_quat('Z', 'Y').to_euler()
        fill.rotation_euler = (right * .6 - up * .25 + d * .2).normalized().to_track_quat('Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'{name}-{suffix}.png')
        bpy.ops.render.render(write_still=True)


def build_hull(name, fn, category, size, sockets_=None, rig=None):
    reset()
    p = palette()
    root = empty(name.replace('-', '_'))
    root['category'], root['forward_axis'], root['export_up_axis'] = category, '+x', '+y'
    fn(p, root)
    if sockets_:
        for slot, pos in sockets_.items(): socket(root, slot, slot.rstrip('1'), pos)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'))
    consolidate_all(root)
    export(root, out / f'{name}.glb')
    info = {'name': name, 'category': category, 'triangles': stats(root), 'bytes': (out / f'{name}.glb').stat().st_size}
    if rig:
        # the fitted preview: the starter rig on its sockets, for the render only
        for slot, gid in rig.items():
            sock = next(o for o in root.children if o.name == 'socket_' + slot)
            g = empty('module ' + gid, sock)
            MODULES[gid][1](p, g)
    if not args.no_render:
        toonify(size)
        render(root, name, size)
    return info


def build_module(gid):
    reset()
    p = palette()
    slot, fn = MODULES[gid]
    root = empty(gid.replace('.', '_'))
    root['module'], root['slot'], root['planned'] = gid, slot, gid in PLANNED
    fn(p, root)
    consolidate(root)
    export(root, out / 'modules' / f"{gid.replace('.', '-')}.glb")
    return {'name': gid, 'slot': slot, 'planned': gid in PLANNED, 'triangles': stats(root), 'bytes': (out / 'modules' / f"{gid.replace('.', '-')}.glb").stat().st_size}


(out / 'modules').mkdir(exist_ok=True)
manifest = {'hulls': [], 'modules': []}
hulls = [('far-treasure', far_treasure, 'painted', 14, FAR_SOCKETS, STARTER), ('tug', tug, 'painted', 8.5, None, None), ('hauler', hauler, 'painted', 23, None, None),
    ('nobody', nobody, 'painted', 11, None, None), ('patrol-cutter', cutter, 'painted', 9, None, None), ('tug-buoy', tug_buoy, 'painted', 5.5, None, None),
    ('deckhand', deckhand, 'robots', 2.2, None, None), ('porter', porter, 'robots', 2.0, None, None), ('containers', containers, 'containers', 19, None, None)]
for name, fn, category, size, sockets_, rig in hulls:
    if args.only and args.only != name: continue
    manifest['hulls'].append(build_hull(name, fn, category, size, sockets_, rig))
if not args.only or args.only == 'modules':
    for gid in MODULES: manifest['modules'].append(build_module(gid))
(out / 'painted-fleet.json').write_text(json.dumps(manifest, indent=4) + '\n')
print(json.dumps(manifest))

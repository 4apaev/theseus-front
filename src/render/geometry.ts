import * as T from 'three'
import type { Category, HullKind, ModuleId } from '../model.ts'

/**
 * faceted vertex-color geometry: the schematic reserve for a hull whose
 * glb did not load, and the exchange backdrop. no textures, lights or
 * postprocessing. the shade of a face follows its normal.
 */

type Vec3 = [ number, number, number ]

const PALETTES: Record<Category, { hull: string, secondary: string, frame: string, trim: string }> = {
    industrial: { hull: '#c49950', secondary: '#ddd2b2', frame: '#42404c', trim: '#f0cc83' },
    civil     : { hull: '#dddccc', secondary: '#71a5a0', frame: '#465c66', trim: '#afddd0' },
    security  : { hull: '#798393', secondary: '#ae6868', frame: '#3d414f', trim: '#c0c8d3' },
}

const HEAVY = new Set<HullKind>([ 'freighter', 'tanker', 'colony', 'liner', 'battleship', 'prison' ])

/** bake a three-tone shade into the faces: light from above, dark from below. */
export function solid(geometry: T.BufferGeometry, color: string): T.Mesh {
    const g = geometry.index ? geometry.toNonIndexed() : geometry
    if (g !== geometry) geometry.dispose()
    g.computeVertexNormals()

    const normal = g.getAttribute('normal')
    const colors = new Float32Array(normal.count * 3)
    const base   = new T.Color(color)

    for (let i = 0; i < normal.count; i += 3) {
        const light = normal.getY(i) * 0.8 + normal.getX(i) * 0.3 + normal.getZ(i) * 0.2
        const shade = light > 0.4 ? 1.12 : light < -0.2 ? 0.57 : 0.82
        const c = base.clone().multiplyScalar(shade)
        for (let j = 0; j < 3; j++) colors.set([ c.r, c.g, c.b ], (i + j) * 3)
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3))
    return new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true }))
}

function box(parent: T.Object3D, size: Vec3, position: Vec3, color: string) {
    const mesh = solid(new T.BoxGeometry(...size), color)
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
}

function cylinder(parent: T.Object3D, size: { radius: number, length: number, axis?: 'x' | 'y' | 'z' }, position: Vec3, color: string) {
    const { radius, length, axis = 'y' } = size
    const mesh = solid(new T.CylinderGeometry(radius, radius, length, 8, 1), color)
    if (axis === 'x') mesh.rotation.z = Math.PI / 2
    if (axis === 'z') mesh.rotation.x = Math.PI / 2
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
}

function tank(parent: T.Object3D, position: Vec3, color: string, radius = 0.65) {
    const mesh = solid(new T.IcosahedronGeometry(radius, 1), color)
    mesh.position.set(...position)
    parent.add(mesh)
}

function engine(parent: T.Object3D, position: Vec3, color: string, scale = 1) {
    const group = new T.Group
    group.position.set(...position)
    cylinder(group, { radius: 0.44 * scale, length: 0.75 * scale, axis: 'x' }, [ 0, 0, 0 ], color)
    const bell = solid(new T.CylinderGeometry(0.33 * scale, 0.56 * scale, 0.58 * scale, 8, 1, true), '#363442')
    bell.rotation.z = Math.PI / 2
    bell.position.x = 0.54 * scale
    group.add(bell)
    cylinder(group, { radius: 0.25 * scale, length: 0.04, axis: 'x' }, [ 0.8 * scale, 0, 0 ], '#739aaf')
    parent.add(group)
}

function radiator(parent: T.Object3D, position: Vec3, color: string) {
    box(parent, [ 1.35, 0.07, 1.15 ], position, color)
    for (let i = 0; i < 5; i++)
        box(parent, [ 0.035, 0.016, 1.12 ], [ position[ 0 ] - 0.54 + i * 0.27, position[ 1 ] + 0.043, position[ 2 ] ], '#8995ae')
}

function cabin(parent: T.Object3D, x: number, color: string) {
    const body = cylinder(parent, { radius: 0.63, length: 1.25, axis: 'x' }, [ x, 0.1, 0 ], color)
    body.scale.z = 0.86
    box(parent, [ 0.05, 0.24, 0.56 ], [ x - 0.635, 0.22, 0 ], '#1e273d')
    box(parent, [ 0.58, 0.035, 0.47 ], [ x - 0.05, 0.725, 0 ], '#35425b')
}

/**
 * the schematic reserve. a spine, a cabin, engines, radiators, and the
 * 3 module groups the rig view picks: cargo, drive, ansible. heavy
 * hulls get a third engine and a taller hold.
 */
export function buildShip(kind: HullKind, category: Category, fitted: ModuleId[] = [], selection?: ModuleId) {
    const ship  = new T.Group
    const p     = PALETTES[ category ]
    const heavy = HEAVY.has(kind)
    const group = (id: ModuleId) => {
        const g = new T.Group
        g.userData.module = id
        ship.add(g)
        return g
    }
    const cargo = group('cargo'), drive = group('drive'), comms = group('ansible')

    box(ship, [ 7, 0.22, 0.3 ], [ 0, 0, 0 ], p.frame)
    cabin(ship, -3.1, category === 'security' ? p.hull : p.secondary)
    for (const z of heavy ? [ -0.9, 0, 0.9 ] : [ -0.55, 0.55 ])
        engine(drive, [ 3.3, 0, z ], fitted.includes('drive') ? p.trim : p.hull)
    for (let x = -1.8; x < 2; x += 1.2) {
        box(ship, [ 0.12, 0.18, 2.15 ], [ x, -0.38, 0 ], p.frame)
        for (const z of [ -0.58, 0.58 ]) box(cargo, [ 1.03, heavy ? 0.9 : 0.6, 0.9 ], [ x + 0.14, 0.23, z ], p.hull)
    }
    for (const z of [ -1.3, 1.3 ]) radiator(ship, [ 2, -0.1, z ], p.frame)
    if (fitted.includes('cargo')) box(cargo, [ 1.15, 0.7, 0.85 ], [ 0.3, 1.0, 0 ], p.secondary)

    box(comms, [ 0.1, 0.85, 0.1 ], [ 0.8, 0.8, -0.45 ], p.frame)
    const dish = solid(new T.ConeGeometry(0.5, 0.22, 6), fitted.includes('ansible') ? p.trim : p.frame)
    dish.rotation.z = -0.5
    dish.position.set(0.8, 1.3, -0.45)
    comms.add(dish)

    if (selection) {
        const bounds = (new T.Box3).setFromObject({ cargo, drive, ansible: comms }[ selection ]).expandByScalar(0.15)
        ship.add(new T.Box3Helper(bounds, new T.Color('#e6c27b')))
    }
    return ship
}

/** the exchange backdrop: a berth slab with an exchange, a relay depot and a drydock to pick. */
export function buildPort() {
    const port = new T.Group
    const slab = '#68617f', edge = '#504764', pale = '#c0bec6', steel = '#464257'

    box(port, [ 12, 0.7, 8 ], [ -0.9, -0.7, -0.6 ], edge)
    box(port, [ 11.7, 0.15, 7.7 ], [ -0.9, -0.27, -0.6 ], slab)
    for (let x = -6; x < 5; x += 1.2) box(port, [ 0.018, 0.01, 7.4 ], [ x, -0.187, -0.6 ], '#79718d')
    for (let z = -4; z < 3; z += 1.2) box(port, [ 11.3, 0.01, 0.018 ], [ -0.9, -0.185, z ], '#79718d')
    for (const x of [ -4.7, -0.2, 4.3 ]) {
        box(port, [ 1.35, 0.4, 3 ], [ x, -0.65, 4.4 ], edge)
        box(port, [ 1.3, 0.07, 2.9 ], [ x, -0.41, 4.4 ], slab)
        for (const z of [ 3.5, 4.5, 5.5 ]) box(port, [ 0.25, 0.05, 0.16 ], [ x + 0.49, -0.35, z ], '#e5be75')
    }

    const facility = (id: string) => {
        const g = new T.Group
        g.userData.facility = id
        port.add(g)
        return g
    }

    const exchange = facility('exchange')
    box(exchange, [ 3.4, 1.45, 1.9 ], [ -4, 0.56, -2.9 ], pale)
    box(exchange, [ 3.55, 0.17, 2.0 ], [ -4, 1.34, -2.9 ], '#d6d0c7')
    box(exchange, [ 1.15, 0.8, 0.03 ], [ -3.8, 0.21, -1.935 ], '#302d43')
    for (let i = 0; i < 3; i++) box(exchange, [ 0.23, 0.19, 0.03 ], [ -5.2 + i * 0.42, 0.95, -1.933 ], '#7ca2ad')
    for (let i = 0; i < 6; i++)
        box(exchange, [ 0.65, 0.56, 0.65 ], [ -5.3 + (i % 3) * 0.78, 0.1, -0.7 + Math.floor(i / 3) * 0.8 ], i % 2 ? '#8f9f9b' : '#ba9459')

    const relay = facility('relay')
    for (const x of [ 0.0, 1.45, 2.9 ]) {
        cylinder(relay, { radius: 0.53, length: 0.6 }, [ x, 0.05, -3.3 ], steel)
        tank(relay, [ x, 0.92, -3.3 ], '#a6aaba', 0.88)
        box(relay, [ 0.16, 0.15, 0.16 ], [ x, 1.77, -3.3 ], '#d8b97c')
    }
    box(relay, [ 3.8, 0.14, 0.14 ], [ 1.2, 0.02, -2.15 ], '#aaa4b1')

    const dock = facility('drydock')
    for (const x of [ 1.9, 5.0 ]) box(dock, [ 0.25, 3.3, 0.4 ], [ x, 1.35, 0.65 ], steel)
    box(dock, [ 3.8, 0.42, 0.45 ], [ 3.45, 3.05, 0.65 ], '#b2a89b')
    box(dock, [ 0.8, 0.45, 0.56 ], [ 3.45, 2.74, 0.65 ], '#c3a263')
    cylinder(dock, { radius: 0.025, length: 1.4 }, [ 3.45, 1.88, 0.65 ], '#a8a0ab')
    box(dock, [ 0.3, 0.2, 0.3 ], [ 3.45, 1.14, 0.65 ], '#bd9a5b')

    for (const [ x, z ] of [[ -5.9, 2.6 ], [ -1.9, 2.7 ], [ 5, -3.7 ]]) {
        box(port, [ 0.09, 1.4, 0.09 ], [ x, 0.5, z ], steel)
        box(port, [ 0.23, 0.16, 0.18 ], [ x, 1.25, z ], '#f0cf8c')
    }
    for (const [ x, z ] of [[ -1.9, 0.4 ], [ 0.1, 1.5 ]]) {
        box(port, [ 0.14, 0.29, 0.15 ], [ x, 0.14, z ], '#cbc8b8')
        box(port, [ 0.16, 0.16, 0.16 ], [ x, 0.36, z ], '#e5ded0')
        box(port, [ 0.17, 0.07, 0.03 ], [ x, 0.37, z + 0.085 ], '#33384f')
        for (const dx of [ -0.055, 0.055 ]) box(port, [ 0.04, 0.13, 0.06 ], [ x + dx, -0.05, z ], steel)
    }
    return port
}

/** free every geometry, material and shadow map under a node. */
export function disposeGroup(group: T.Object3D) {
    group.traverse(object => {
        if (object instanceof T.DirectionalLight) object.shadow.dispose()
        if (object instanceof T.Mesh || object instanceof T.LineSegments || object instanceof T.Points) {
            object.geometry.dispose()
            const materials = Array.isArray(object.material) ? object.material : [ object.material ]
            materials.forEach(material => { if ('map' in material) (material.map as T.Texture | null)?.dispose(); material.dispose() })
        }
    })
}

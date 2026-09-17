import * as T from 'three'
import { buildDiscovery } from './hulls/discovery.ts'
import type { Category, HullKind, ModuleId } from '../model.ts'

export const PALETTES: Record<Category, {
    hull     : string,
    secondary: string,
    frame    : string,
    trim     : string }> = {
    industrial: { hull: '#c49950', secondary: '#ddd2b2', frame: '#42404c', trim: '#f0cc83' },
    civil     : { hull: '#dddccc', secondary: '#71a5a0', frame: '#465c66', trim: '#afddd0' },
    security  : { hull: '#798393', secondary: '#ae6868', frame: '#3d414f', trim: '#c0c8d3' },
}

/** bake a three-tone palette into faces: no textures, lights or postprocessing. */
export function solid(geometry: T.BufferGeometry, color: string): T.Mesh {
    const g = geometry.index
        ? geometry.toNonIndexed()
        : geometry
    if (g !== geometry) geometry.dispose()

    g.computeVertexNormals()

    const normal = g.getAttribute('normal')
    const colors = new Float32Array(normal.count * 3)
    const base = new T.Color(color)
    for (let i = 0; i < normal.count; i += 3) {
        const light = normal.getY(i) * 0.8 + normal.getX(i) * 0.3 + normal.getZ(i) * 0.2
        const c = base.clone().multiplyScalar(light > 0.4 ? 1.12 : light < -0.2 ? 0.57 : 0.82)
        for (let j = 0; j < 3; j++) { colors[ (i + j) * 3 ] = c.r; colors[ (i + j) * 3 + 1 ] = c.g; colors[ (i + j) * 3 + 2 ] = c.b }
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3))
    return new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true }))
}

export function box(parent: T.Group, size: [ number, number, number ], position: [ number, number, number ], color: string) {
    const mesh = solid(new T.BoxGeometry(...size), color)
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
}

export function cylinder(parent: T.Group, size: { radius: number, length: number, axis?: 'x' | 'y' | 'z' }, position: [ number, number, number ], color: string) {
    const { radius, length, axis = 'y' } = size
    const mesh = solid(new T.CylinderGeometry(radius, radius, length, 8, 1), color)
    if (axis === 'x') mesh.rotation.z = Math.PI / 2
    if (axis === 'z') mesh.rotation.x = Math.PI / 2
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
}

function tank(parent: T.Group, position: [ number, number, number ], color: string, radius = 0.65) {
    const mesh = solid(new T.IcosahedronGeometry(radius, 1), color)
    mesh.position.set(...position)
    parent.add(mesh)
}

function engine(parent: T.Group, position: [ number, number, number ], color: string, scale = 1) {
    const group = (new T.Group)
    group.position.set(...position)
    cylinder(group, { radius: 0.44 * scale, length: 0.75 * scale, axis: 'x' }, [ 0, 0, 0 ], color)
    const bell = solid(new T.CylinderGeometry(0.33 * scale, 0.56 * scale, 0.58 * scale, 8, 1, true), '#363442')
    bell.rotation.z = Math.PI / 2
    bell.position.x = 0.54 * scale
    group.add(bell)
    cylinder(group, { radius: 0.25 * scale, length: 0.04, axis: 'x' }, [ 0.8 * scale, 0, 0 ], '#739aaf')
    parent.add(group)
}

function radiator(parent: T.Group, position: [ number, number, number ], color: string) {
    box(parent, [ 1.35, 0.07, 1.15 ], position, color)
    for (let i = 0; i < 5; i++) box(parent, [ 0.035, 0.016, 1.12 ], [ position[ 0 ] - 0.54 + i * 0.27, position[ 1 ] + 0.043, position[ 2 ] ], '#8995ae')
}

function capsule(parent: T.Group, x: number, color: string) {
    const cabin = cylinder(parent, { radius: 0.63, length: 1.25, axis: 'x' }, [ x, 0.1, 0 ], color)
    cabin.scale.z = 0.86
    box(parent, [ 0.05, 0.24, 0.56 ], [ x - 0.635, 0.22, 0 ], '#1e273d')
    box(parent, [ 0.58, 0.035, 0.47 ], [ x - 0.05, 0.725, 0 ], '#35425b')
}

/** hull recipes share primitives and materials; attachment groups carry module ids. */
export function buildShip(id: HullKind | 'discovery', category: Category, fitted: ModuleId[] = [], selection?: ModuleId) {
    if (id === 'discovery') return buildDiscovery(fitted, selection)
    const ship = (new T.Group)
    const p = PALETTES[ category ]
    box(ship, [ 7, 0.22, 0.3 ], [ 0, 0, 0 ], p.frame)
    capsule(ship, -3.1, category === 'security' ? p.hull : p.secondary)
    const attach = (module: ModuleId) => {
        const group = (new T.Group)
        group.userData.module = module
        ship.add(group)
        return group
    }
    const cargo = attach('cargo'), drive = attach('drive'), comms = attach('ansible')
    const engines = id === 'battleship' ? [ -0.9, 0, 0.9 ] : [ -0.55, 0.55 ]
    for (const z of engines) engine(drive, [ 3.3, 0, z ], fitted.includes('drive') ? p.trim : p.hull)

    if (id === 'freighter' || id === 'prison') {
        for (let x = -1.8; x < 2; x += 1.2) {
            box(ship, [ 0.12, 0.18, 2.15 ], [ x, -0.38, 0 ], p.frame)
            for (const z of [ -0.58, 0.58 ]) box(cargo, [ 1.03, 0.75, 0.9 ], [ x + 0.14, 0.23, z ], id === 'prison' ? p.hull : p.hull)
        }
        for (const z of [ -1.06, 1.06 ]) box(ship, [ 4.85, 0.12, 0.12 ], [ 0.1, 0.68, z ], p.frame)
        if (id === 'prison') for (let x = -1.8; x < 2; x += 1.2) for (const z of [ -1.06, 1.06 ]) box(ship, [ 0.1, 1.1, 0.1 ], [ x, 0.1, z ], p.secondary)
    }
    else if (id === 'tanker') {
        for (const x of [ -1.65, 0, 1.65 ]) for (const z of [ -0.72, 0.72 ]) tank(cargo, [ x, 0.17, z ], p.hull, 0.82)
        for (const z of [ -1.55, 1.55 ]) box(ship, [ 5.6, 0.1, 0.1 ], [ 0, -0.2, z ], p.frame)
    }
    else if (id === 'liner') {
        for (const z of [ -0.85, 0, 0.85 ]) {
            cylinder(cargo, { radius: 0.4, length: 4.9, axis: 'x' }, [ -0.1, 0.28, z ], p.hull)
            for (let x = -2; x < 2; x += 0.6) box(cargo, [ 0.18, 0.16, 0.025 ], [ x, 0.35, z + 0.39 ], '#526e80')
        }
    }
    else if (id === 'research') {
        for (const z of [ -1.05, 1.25 ]) {
            box(ship, [ 0.18, 0.18, 2.5 ], [ -0.2, 0, 0 ], p.frame)
            box(cargo, [ 1.5, 0.8, 0.85 ], [ z === -1.05 ? -0.3 : 0.5, 0.2, z ], p.secondary)
        }
        box(ship, [ 1.8, 0.09, 0.09 ], [ -4.2, 0.1, 0 ], p.frame)
        tank(ship, [ -5.1, 0.1, 0 ], p.trim, 0.16)
        for (const z of [ -0.5, 0.5 ]) tank(ship, [ 2, 0.3, z ], p.secondary, 0.45)
    }
    else if (id === 'yacht') {
        const cabin = cylinder(cargo, { radius: 0.75, length: 2.1, axis: 'x' }, [ -1.8, 0.3, 0 ], p.hull)
        cabin.scale.z = 0.65
        box(cargo, [ 1.1, 0.04, 0.65 ], [ -2, 1.05, 0 ], '#27394c')
        box(ship, [ 0.16, 0.16, 1.7 ], [ 0.8, 0, 0.8 ], p.frame)
        for (const x of [ 0.6, 1.4 ]) tank(ship, [ x, 0, 1.5 ], p.secondary, 0.48)
    }
    else if (id === 'tug') {
        box(ship, [ 2.6, 0.65, 2.0 ], [ 1.6, 0, 0 ], p.hull)
        for (const z of [ -1.1, 1.1 ]) {
            box(cargo, [ 4.5, 0.22, 0.24 ], [ -0.3, -0.1, z ], p.frame)
            box(cargo, [ 0.4, 0.6, 0.42 ], [ -2.5, 0, z ], p.hull)
        }
        cylinder(ship, { radius: 0.5, length: 1.2, axis: 'z' }, [ 0.3, 0.2, 0 ], p.hull)
    }
    else if (id === 'colony') {
        const ring = solid(new T.TorusGeometry(1.65, 0.26, 4, 8), p.hull)
        ring.rotation.y = Math.PI / 2
        ring.position.x = -0.5
        ship.add(ring)
        for (const z of [ -1, 1 ]) box(cargo, [ 2.8, 0.4, 0.9 ], [ -1.6, 0, z ], p.secondary)
        for (const x of [ 1, 2 ]) for (const z of [ -0.6, 0.6 ]) box(cargo, [ 0.8, 0.95, 0.85 ], [ x, 0, z ], p.hull)
    }
    else if (id === 'battleship') {
        box(ship, [ 4.6, 0.72, 2.25 ], [ -0.75, 0.12, 0 ], p.hull)
        for (const x of [ -1.9, -0.3 ]) {
            for (const z of [ -0.62, 0.62 ]) {
                box(cargo, [ 0.9, 0.28, 0.45 ], [ x, 0.67, z ], p.secondary)
                box(cargo, [ 0.75, 0.1, 0.12 ], [ x - 0.5, 0.8, z ], p.frame)
            }
        }
        for (let x = 1.5; x < 2.8; x += 0.3) box(ship, [ 0.13, 0.7, 2.1 ], [ x, 0, 0 ], p.trim)
    }
    else if (id === 'frigate') {
        for (const z of [ -0.45, 0.45 ]) box(cargo, [ 4.6, 0.25, 0.28 ], [ 0, 0.25, z ], p.hull)
        for (const x of [ -1.5, 1 ]) box(cargo, [ 1.1, 0.48, 1.1 ], [ x, 0.05, 0 ], p.secondary)
    }
    else {
        box(cargo, [ 3.6, 0.6, 1.0 ], [ -0.7, 0.22, 0 ], p.hull)
        if (id === 'transport') { for (const z of [ -0.8, 0.8 ]) cylinder(ship, { radius: 0.28, length: 0.4, axis: 'z' }, [ -2, 0, z ], p.secondary) }
        else {
            box(ship, [ 0.1, 0.1, 1.5 ], [ -0.6, 0.2, -0.65 ], p.frame)
            tank(ship, [ -0.6, 0.2, -1.4 ], p.trim, 0.18)
        }
    }
    for (const z of [ -1.3, 1.3 ]) radiator(ship, [ 2, -0.1, z ], p.frame)
    box(comms, [ 0.1, 0.85, 0.1 ], [ 0.8, 0.8, -0.45 ], p.frame)
    const dish = solid(new T.ConeGeometry(0.5, 0.22, 6), fitted.includes('ansible') ? p.trim : p.frame)
    dish.rotation.z = -0.5
    dish.position.set(0.8, 1.3, -0.45)
    comms.add(dish)
    if (fitted.includes('cargo')) box(cargo, [ 1.15, 0.7, 0.85 ], [ 0.3, 1.0, 0 ], p.secondary)
    if (selection) {
        const selected = selection === 'cargo' ? cargo : selection === 'drive' ? drive : comms
        const bounds = (new T.Box3).setFromObject(selected)
        bounds.expandByScalar(0.15)
        const helper = new T.Box3Helper(bounds, new T.Color('#e6c27b'))
        ship.add(helper)
    }
    return ship
}

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
    const exchange = (new T.Group)
    exchange.userData.facility = 'exchange'
    port.add(exchange)
    box(exchange, [ 3.4, 1.45, 1.9 ], [ -4, 0.56, -2.9 ], pale)
    box(exchange, [ 3.55, 0.17, 2.0 ], [ -4, 1.34, -2.9 ], '#d6d0c7')
    box(exchange, [ 1.15, 0.8, 0.03 ], [ -3.8, 0.21, -1.935 ], '#302d43')
    for (let i = 0; i < 3; i++) box(exchange, [ 0.23, 0.19, 0.03 ], [ -5.2 + i * 0.42, 0.95, -1.933 ], '#7ca2ad')
    for (let i = 0; i < 6; i++) box(exchange, [ 0.65, 0.56, 0.65 ], [ -5.3 + (i % 3) * 0.78, 0.1, -0.7 + Math.floor(i / 3) * 0.8 ], i % 2 ? '#8f9f9b' : '#ba9459')
    const depot = (new T.Group)
    depot.userData.facility = 'relay'
    port.add(depot)
    for (const x of [ 0.0, 1.45, 2.9 ]) {
        cylinder(depot, { radius: 0.53, length: 0.6 }, [ x, 0.05, -3.3 ], steel)
        tank(depot, [ x, 0.92, -3.3 ], '#a6aaba', 0.88)
        box(depot, [ 0.16, 0.15, 0.16 ], [ x, 1.77, -3.3 ], '#d8b97c')
    }
    box(depot, [ 3.8, 0.14, 0.14 ], [ 1.2, 0.02, -2.15 ], '#aaa4b1')
    const dock = (new T.Group)
    dock.userData.facility = 'drydock'
    port.add(dock)
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

export function disposeGroup(group: T.Object3D) {
    group.traverse(object => {
        if (object instanceof T.DirectionalLight) object.shadow.dispose()
        if (object instanceof T.Mesh || object instanceof T.LineSegments || object instanceof T.Points) {
            object.geometry.dispose()
            const materials = Array.isArray(object.material) ? object.material : [ object.material ]
            materials.forEach(material => material.dispose())
        }
    })
}

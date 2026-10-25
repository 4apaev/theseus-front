import * as T from 'three'
import { model } from './loader.ts'
import { paint, rng } from './paint.ts'

/**
 * a station as a small world, after star birds: a low-poly rock, its
 * facilities grown out of the surface, each upright on its own normal.
 * the parts are cc0 kit models in `models/kits/`. it carries the empties
 * of a station model: `berth` on the top pad for our ship, `berth_b`…
 * pads for visitors, `spot_<place>` over each facility. a facility knows
 * its place in `userData.place`, so a click on it opens the place.
 */

const R = 130

const KAY = 'kits/kaykit-space/', KEN = 'kits/kenney-space/', QUA = 'kits/quaternius-space/'

/** a part: its model, metres across, where it stands (latitude, longitude, turn), what it is. */
interface Part { id: string, size: number, at: [ number, number, number ], place?: string, pad?: string }

const FACILITIES: Part[] = [
    { id: `${ KAY }landingpad_large.gltf`, size: 110, at: [ 90, 0, 0 ], pad: 'berth' },
    { id: `${ KAY }cargodepot_A.gltf`, size: 95, at: [ 38, 20, 30 ], place: 'exchange' },
    { id: `${ KAY }basemodule_garage.gltf`, size: 90, at: [ 34, 140, -20 ], place: 'rigging' },
    { id: `${ KEN }satelliteDish_large`, size: 70, at: [ 40, 255, 0 ], place: 'comms' },
    { id: `${ QUA }GeodesicDome.gltf`, size: 80, at: [ -10, 200, 0 ], place: 'chart' },
    { id: `${ KAY }landingpad_small.gltf`, size: 90, at: [ 0, 80, 90 ], pad: 'berth_b' },
    { id: `${ KAY }landingpad_small.gltf`, size: 90, at: [ -5, 320, 90 ], pad: 'berth_c' },
]

const CLUTTER = [
    [ `${ KAY }solarpanel.gltf`, 40 ], [ `${ KAY }cargo_A_stacked.gltf`, 30 ], [ `${ KAY }containers_B.gltf`, 40 ],
    [ `${ KAY }structure_tall.gltf`, 35 ], [ `${ KAY }roofmodule_solarpanels.gltf`, 45 ], [ `${ KAY }drill_structure.gltf`, 50 ],
    [ `${ KAY }rocks_A.gltf`, 45 ], [ `${ KAY }rock_B.gltf`, 35 ], [ `${ KEN }machine_generator`, 30 ],
    [ `${ KEN }machine_wireless`, 30 ], [ `${ QUA }House_Cylinder.gltf`, 45 ], [ `${ QUA }SolarPanel_Structure.gltf`, 40 ],
    [ `${ QUA }Roof_Antenna.gltf`, 25 ], [ `${ QUA }Rock_Large_1.gltf`, 50 ],
] as const

const ROCKS = [ 0xb8693d, 0x7d8a7c, 0x9c8d78, 0x5f7480 ]

export async function globe(seed: number) {
    const r = rng(seed), root = new T.Group
    root.add(core(r))
    const parts = [ ...FACILITIES, ...clutter(r) ]
    const made = await Promise.all(parts.map(p => model(p.id)))
    made.forEach((m, i) => root.add(stand(m, parts[ i ])))
    root.position.y = -R
    return root
}

// a rock: an icosphere, its corners pushed in and out a little
function core(r: () => number) {
    const g = new T.IcosahedronGeometry(R, 3)
    const p = g.attributes.position, v = new T.Vector3, bump = new Map<string, number>
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i)
        const k = v.toArray().map(x => x.toFixed(1)).join()
        v.setLength(R * (bump.get(k) ?? bump.set(k, .97 + r() * .05).get(k) as number))
        p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return paint(new T.Mesh(g, new T.MeshStandardMaterial({ color: ROCKS[ Math.floor(r() * ROCKS.length) ] })))
}

// a part upright on the surface: its foot sunk so no corner floats
function stand(m: T.Object3D, p: Part) {
    const box = (new T.Box3).setFromObject(m), size = box.getSize(new T.Vector3)
    const k = p.size / Math.max(size.x, size.z)
    m.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).multiplyScalar(k)
    m.scale.setScalar(k)
    const up = normal(p.at[ 0 ], p.at[ 1 ]), part = new T.Group
    part.add(m)
    part.position.copy(up).multiplyScalar(R - p.size ** 2 / (8 * R) - 1)
    part.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), up).multiply((new T.Quaternion).setFromAxisAngle(new T.Vector3(0, 1, 0), p.at[ 2 ] * Math.PI / 180))
    if (p.place) part.userData.place = p.place
    const top = new T.Object3D
    top.position.y = size.y * k + (p.pad ? 0 : 20)
    top.name = p.pad ?? `spot_${ p.place }`
    if (p.pad && p.pad !== 'berth') top.userData.size = 'medium'
    if (p.pad || p.place) part.add(top)
    return part
}

// 45 seeded bits between the facilities, none on another
function clutter(r: () => number): Part[] {
    const taken = FACILITIES.map(f => ({ n: normal(f.at[ 0 ], f.at[ 1 ]), a: f.size / R * .75 }))
    const out: Part[] = []
    for (let i = 0; out.length < 45 && i < 600; i++) {
        const [ id, size ] = CLUTTER[ Math.floor(r() * CLUTTER.length) ]
        const lat = Math.asin(r() * 2 - 1) * 180 / Math.PI, lon = r() * 360, n = normal(lat, lon), a = size / R * .6
        if (taken.some(t => t.n.angleTo(n) < t.a + a)) continue
        taken.push({ n, a })
        out.push({ id, size, at: [ lat, lon, r() * 360 ]})
    }
    return out
}

function normal(lat: number, lon: number) {
    const a = lat * Math.PI / 180, b = lon * Math.PI / 180
    return new T.Vector3(Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b))
}

import * as T from 'three'
import { solid } from './geometry.ts'

/**
 * a generic planet: a faceted sphere, a banded atmosphere texture, a
 * thin glow, and an optional ring. every value comes from a seed, so
 * the same station always shows the same planet.
 */

const PALETTES: [ string, string ][] = [
    [ '#c9805f', '#7a4632' ], // rust desert
    [ '#5f86a8', '#2c4258' ], // ocean ice
    [ '#ab9553', '#6b581f' ], // tan gas band
    [ '#748a63', '#3e4d34' ], // verdant
    [ '#9078ab', '#4c3961' ], // violet gas giant
    [ '#8f9aa3', '#4a525c' ], // ash rock
]

/** mulberry32, seeded from a short string. deterministic across sessions. */
function rng(seed: string) {
    let h = 1779033703 ^ seed.length
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
        h = h << 13 | h >>> 19
    }
    return () => {
        h = Math.imul(h ^ h >>> 16, 2246822507)
        h = Math.imul(h ^ h >>> 13, 3266489909)
        h ^= h >>> 16
        return (h >>> 0) / 4294967296
    }
}

/** a strip of horizontal bands, 2 tones, wrapped around the sphere as atmosphere. */
function atmosphereTexture(rand: () => number, tones: [ string, string ]): T.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const bands = 6 + Math.floor(rand() * 7)
    for (let i = 0; i < bands; i++) {
        ctx.fillStyle = rand() > 0.5 ? tones[ 0 ] : tones[ 1 ]
        ctx.globalAlpha = 0.25 + rand() * 0.5
        ctx.fillRect(0, i / bands * canvas.height, 2, canvas.height / bands + 1)
    }
    const texture = new T.CanvasTexture(canvas)
    texture.wrapS = T.RepeatWrapping
    texture.wrapT = T.ClampToEdgeWrapping
    texture.colorSpace = T.SRGBColorSpace
    return texture
}

export interface Orbit { radius: number, height: number, phase: number }
export interface Planet { group: T.Group, spin: number, orbit: Orbit }

export function buildPlanet(seed: string): Planet {
    const rand = rng(seed)
    const [ tone, shade ] = PALETTES[ Math.floor(rand() * PALETTES.length) ]!
    const radius = 8 + rand() * 5
    const group = new T.Group

    group.add(solid(new T.IcosahedronGeometry(radius, 3), tone))

    const atmosphere = new T.Mesh(
        new T.SphereGeometry(radius * 1.012, 40, 20),
        new T.MeshBasicMaterial({ map: atmosphereTexture(rand, [ tone, shade ]), transparent: true, opacity: 0.55, depthWrite: false }),
    )
    group.add(atmosphere)

    const glow = new T.Mesh(
        new T.SphereGeometry(radius * 1.09, 24, 12),
        new T.MeshBasicMaterial({ color: shade, transparent: true, opacity: 0.16, side: T.BackSide, depthWrite: false }),
    )
    group.add(glow)

    if (rand() > 0.5) {
        // dust and ice read lighter than the body, against any palette.
        const ringColor = new T.Color(tone).lerp(new T.Color('#fff8ea'), 0.55)
        const ring = new T.Mesh(
            new T.RingGeometry(radius * 1.5, radius * (1.85 + rand() * 0.35), 64),
            new T.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }),
        )
        ring.rotation.x = Math.PI / 2
        group.add(ring)
    }

    group.rotation.z = (rand() - 0.5) * 0.2

    // far and low, off the station's back-left. a wide orbit reads as a distant, near-static body.
    const orbit: Orbit = {
        radius: 34 + rand() * 10,
        height: -11 - rand() * 5,
        phase: Math.PI * (1.05 + rand() * 0.2),
    }
    return { group, spin: 0.015 + rand() * 0.02, orbit }
}

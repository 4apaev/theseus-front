import * as T from 'three'
import { model } from './loader.ts'
import { liven } from './paint.ts'

/**
 * a deck robot that walks to and fro between 2 deck points, in metres.
 * its joints (`leg_l`, `arm_r`, `wheel_l`, `head`…) swing with its speed.
 */
export class Robot {
    /*   */ readonly group = new T.Group
    private readonly a: T.Vector3
    private readonly b: T.Vector3
    private readonly period: number
    private joints: Record<string, T.Object3D> = {}
    private phase = 0

    constructor(name: string, a: T.Vector3, b: T.Vector3, period: number) {
        this.a = a
        this.b = b
        this.period = period
        this.group.scale.setScalar(.8)

        void model('painted/' + name).then(m => {
            m.traverse(o => {
                if (/^(leg|arm|wheel)_[lr]$|^head$/.test(o.name))
                    this.joints[ o.name ] = o
            })
            this.group.add(m)
        })
    }

    tick(t: number, dt: number) {
        const { a, b } = this
        const w = t / this.period * Math.PI * 2
        const dir = Math.sin(w) >= 0 ? 1 : -1

        this.group.position.lerpVectors(a, b, (1 - Math.cos(w)) / 2)
        this.group.rotation.y = Math.atan2(-(b.z - a.z) * dir, (b.x - a.x) * dir)
        this.walk(dt, Math.abs(Math.sin(w)) * 1.1 + .05)
        liven(this.group, t, dt)
    }

    private walk(dt: number, speed: number) {
        const j = this.joints
        this.phase += dt * speed * 7
        const swing = Math.sin(this.phase) * .55 * Math.min(1, speed * 2)
        for (const [ name, sign ] of [[ 'leg_l', 1 ], [ 'leg_r', -1 ], [ 'arm_l', -.8 ], [ 'arm_r', .8 ]] as const)
            if (j[ name ]) j[ name ].rotation.z = swing * sign

        for (const name of [ 'wheel_l', 'wheel_r' ]) if (j[ name ]) j[ name ].rotation.z -= dt * speed * 6
        if (j.head) j.head.rotation.y = Math.sin(this.phase * .21) * .25
    }
}

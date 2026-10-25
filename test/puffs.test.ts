import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { Puffs } from '../src/world/puffs.ts'

test('a burning drive blows puffs; they fade out when it stops', () => {
    const parent = new T.Group, nozzle = new T.Object3D
    parent.add(nozzle)
    const puffs = new Puffs([ nozzle ], '#a9dfb2')
    for (let i = 0; i < 10; i++) puffs.tick(.05, 1, parent)
    const blown = parent.children.length - 1
    assert.ok(blown >= 6, `blown ${ blown }`)
    for (let i = 0; i < 50; i++) puffs.tick(.05, 0, parent)
    assert.equal(parent.children.length, 1)
})

test('the puffs go at once when the ship leaves', () => {
    const parent = new T.Group, nozzle = new T.Object3D
    parent.add(nozzle)
    const puffs = new Puffs([ nozzle ], '#a9dfb2')
    for (let i = 0; i < 10; i++) puffs.tick(.05, 1, parent)
    puffs.clear()
    assert.equal(parent.children.length, 1)
})

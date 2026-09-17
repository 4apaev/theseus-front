import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FACILITIES, prepareStation, facilityOf } from '../src/render/lem-station.ts'
import { disposeGroup } from '../src/render/geometry.ts'

test('shipped station supports facility picking, label anchors and looping dish animation', async () => {
    const bytes = await readFile(new URL('../public/models/stations/lem-station.glb', import.meta.url))
    const asset = await (new GLTFLoader).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const parts = prepareStation(asset.scene)
    assert.equal(parts.facilities.length, FACILITIES.length)
    for (const f of parts.facilities) {
        const mesh = f.group.getObjectByProperty('type', 'Mesh')!
        assert.ok(mesh)
        assert.equal(facilityOf(mesh), f.id)
        assert.ok(f.outlines.length > 0)
        assert.ok(f.anchor.getWorldPosition(new T.Vector3).toArray().every(Number.isFinite))
    }
    assert.equal(facilityOf(asset.scene.getObjectByName('original_pressure_hull')!), undefined)
    assert.ok(parts.lamps.length >= 2)
    assert.notEqual(parts.lamps[ 0 ], parts.lamps[ 1 ])
    const mixer = new T.AnimationMixer(asset.scene)
    assert.equal(asset.animations.length, 1)
    mixer.clipAction(asset.animations[ 0 ]!).play()
    const dish = asset.scene.getObjectByName('dish_pivot')!
    mixer.setTime(0)
    const initial = dish.quaternion.clone()
    mixer.setTime(5)
    assert.ok(dish.quaternion.angleTo(initial) > 0.1)
    mixer.setTime(10)
    assert.ok(dish.quaternion.angleTo(initial) < 0.001)
    mixer.stopAllAction()
    mixer.uncacheRoot(asset.scene)
    disposeGroup(asset.scene)
})

test('incomplete exports fail explicitly instead of leaving broken facility controls', () => {
    assert.throws(() => prepareStation(new T.Group), { code: 'station-asset' })
    assert.equal(facilityOf(null), undefined)
})

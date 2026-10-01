import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STATIONS, prepareStation, facilityOf, stationModel } from '../src/render/lem-station.ts'
import { disposeGroup } from '../src/render/geometry.ts'

async function load(file: string) {
    const bytes = await readFile(new URL(`../public/models/${ file }`, import.meta.url))
    return (new GLTFLoader).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}

for (const model of Object.values(STATIONS)) {
    test(`${ model.id } supports facility picking, label anchors and a looping dish scan`, async () => {
        const asset = await load(model.file)
        const parts = prepareStation(asset.scene, model.facilities)
        assert.equal(parts.facilities.length, model.facilities.length)
        for (const f of parts.facilities) {
            const mesh = f.group.getObjectByProperty('type', 'Mesh')!
            assert.ok(mesh, `${ f.id } has a pickable mesh`)
            assert.equal(facilityOf(mesh), f.id)
            assert.ok(f.outlines.length > 0)
            assert.ok(f.anchor.getWorldPosition(new T.Vector3).toArray().every(Number.isFinite))
        }
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
}

test('the lem hull is scenery, not a facility', async () => {
    const asset = await load(STATIONS.lem.file)
    assert.equal(facilityOf(asset.scene.getObjectByName('original_pressure_hull')!), undefined)
    disposeGroup(asset.scene)
})

test('station ids pick a model: hubs get the port, the rest the observatory', () => {
    assert.equal(stationModel('sol.outpost').id, 'lem')
    assert.equal(stationModel('sol.titan').id, 'lem')
    assert.equal(stationModel(undefined).id, 'lem')
    assert.equal(stationModel('sol.mars').id, 'many-hands')
    assert.equal(stationModel('alpha.exchange').id, 'many-hands')
})

test('incomplete exports fail explicitly instead of leaving broken facility controls', () => {
    assert.throws(() => prepareStation(new T.Group), { code: 'station-asset' })
    assert.equal(facilityOf(null), undefined)
})

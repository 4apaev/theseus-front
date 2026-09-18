import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as T from 'three'
import { buildShip, disposeGroup } from '../src/render/geometry.ts'

test('discovery geometry is finite, berth-sized and gives each module a visible pick target', () => {
    const ship = buildShip('discovery', 'civil', [ 'cargo', 'drive', 'ansible' ])
    const bounds = (new T.Box3).setFromObject(ship)
    const size = bounds.getSize((new T.Vector3))
    assert.ok(size.x > 9 && size.x < 11)
    assert.ok(size.y > 1 && size.y < 3)
    assert.ok(size.z > 1 && size.z < 3)
    for (const id of [ 'cargo', 'drive', 'ansible' ]) {
        const group = ship.children.find(child => child.userData.module === id)
        assert.ok(group)
        assert.ok(!(new T.Box3).setFromObject(group).isEmpty())
        assert.ok(group.children.some(child => child instanceof T.Mesh && child.castShadow && child.receiveShadow))
    }
    ship.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        assert.ok(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite))
        assert.ok(object.material instanceof T.MeshStandardMaterial)
        assert.equal(object.material.map, null)
    })
    disposeGroup(ship)
})

test('discovery selection bounds remain aligned after berth scaling', () => {
    const ship = buildShip('discovery', 'civil', [ 'cargo' ], 'cargo')
    ship.scale.multiplyScalar(1.3)
    ship.position.set(0, 1, 0)
    ship.updateMatrixWorld(true)
    const group = ship.children.find(child => child.userData.module === 'cargo')!
    const helper = ship.children.find(child => child instanceof T.Box3Helper)!
    const targetBounds = (new T.Box3).setFromObject(group)
    const helperBounds = (new T.Box3).setFromObject(helper)
    assert.ok(helperBounds.containsBox(targetBounds))
    assert.ok(helperBounds.getSize((new T.Vector3)).distanceTo(targetBounds.getSize((new T.Vector3))) < 1)
    disposeGroup(ship)
})

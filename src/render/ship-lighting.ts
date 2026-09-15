import * as T from 'three'

/** One shared lighting rig for the drydock and catalog previews. */
export function shipLighting() {
    const rig = new T.Group
    rig.add(new T.HemisphereLight('#d8e5f0', '#343047', 1.65))
    const key = new T.DirectionalLight('#fff0d5', 3.2)
    key.position.set(-5, 9, 6)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = key.shadow.camera.bottom = -12
    key.shadow.camera.right = key.shadow.camera.top = 12
    key.shadow.camera.near = 0.1
    key.shadow.camera.far = 45
    key.shadow.normalBias = 0.025
    key.shadow.bias = -0.0001
    rig.add(key)
    const rim = new T.DirectionalLight('#adcad9', 1.1)
    rim.position.set(5, 2, -6)
    rig.add(rim)
    return rig
}

export function configureShipRenderer(renderer: T.WebGLRenderer) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = T.PCFSoftShadowMap
}

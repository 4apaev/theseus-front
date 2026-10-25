/*
    build the client fixtures from the backend domain. from ../backend:
    node --input-type=module - ../frontend/src/content/fixtures < ../frontend/scripts/fixtures.js
*/
import {
    mkdirSync,
    writeFileSync,
} from 'node:fs'

import {
    hulls,
    spread,
    starterRig,
    starterShip,
    deriveStats,
    universeData as u,
} from '@theseus/domain'

const out = process.argv[ 2 ]
mkdirSync(out, { recursive: true })

const me = {
    pid: '0b1c2d3e-0000-4000-8000-000000000001',
    handle: 'nobody',
    balance: '1000.00',
}

const money = n => n.toFixed(4)

function quotes(stid) {
    const station = u.stations.find(s => s.stid === stid)
    const goods = []
    for (const [ gid, g ] of Object.entries(u.goods)) {
        if (g.kind === 'commodity' || station.stocks?.includes(gid)) {
            const q = spread(g.price_base)
            goods.push({
                gid,
                price_buy: money(q.price_buy),
                price_sell: money(q.price_sell),
            })
        }
    }
    return goods
}

function ship(rig, place) {
    const s = deriveStats(hulls.starter, rig)
    return {
        rig: 1,
        sid: '5a1d0000-0000-4000-8000-000000000001',
        name: starterShip.name,
        hull: 'starter',
        capacity: s.capacity,
        velocity: s.velocity,
        acceleration: s.acceleration,
        power_pool: s.power.available,
        power: s.power.used,
        ...place,
    }
}

const fitted = rig => Object.entries(rig).map(([ slot, gid ]) => ({ slot, gid }))

const traffic = [
    { sid: '5a1d0000-0000-4000-8000-000000000002', name: 'sleeper service', handle: 'gurgeh' , status: 'docked', stid: 'sol.outpost' },
    { sid: '5a1d0000-0000-4000-8000-000000000003', name: 'mistake not'    , handle: 'zakalwe', status: 'transit',
        from: 'sol.mars', to: 'barnards.rama', arrives: '+120s', years_abs: '6.1' },
]

const base = {
    me,
    traffic,
    messages: [],
    trades: [],
}

const save = (name, f) => writeFileSync(`${ out }/${ name }.json`, JSON.stringify(f, null, 2) + '\n')

save('universe', u)
save('docked', {
    ...base,
    ship: ship(starterRig, { status: 'docked', stid: 'sol.outpost' }),
    fitted: fitted(starterRig),
    market: quotes('sol.outpost'),
    cargo: [],
})

const leg = u.routes.find(route => route.from === 'sol.outpost' && route.c >= 1)

save('transit', {
    ...base,
    market: [],
    fitted: fitted(starterRig),
    ship: ship(starterRig, {
        to: leg.to,
        from: leg.from,
        status: 'transit',
        arrives: '+90s',
        years_abs: String(leg.ly / starterShip.velocity),
        years_rel: String(leg.ly / starterShip.velocity * Math.sqrt(1 - starterShip.velocity ** 2)),
    }),
    cargo: [
        { gid: 'ore'        , quantity: '6' },
        { gid: 'electronics', quantity: '4' },
    ],

})

const mk2 = {
    ...starterRig,
    power1: 'reactor.mk2',
    cruise1: 'cruise.mk2',
    maneuver1: 'maneuver.mk2',
    cargo1: 'cargo.mk2',
}
const full = ship(mk2, { status: 'docked', stid: 'sol.ganymede' })

const hold = [ 'titanium', 'chips', 'hydrogen', 'grain' ]
const per  = Math.floor(full.capacity / hold.reduce((n, gid) => n + u.goods[ gid ].volume, 0))

save('full', {
    ...base,
    ship: full,
    cargo: hold.map(gid => ({ gid, quantity: String(per) })),
    fitted: fitted(mk2),
    market: quotes('sol.ganymede'),
})

console.log('route',
    leg.from, '→', leg.to,
    leg.ly, 'ly · full capacity',
    full.capacity, '·', per, 'of each',
)

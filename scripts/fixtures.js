// build the client fixtures from the backend domain. from ../backend:
// node --input-type=module - ../frontend/src/content/fixtures < ../frontend/scripts/fixtures.js
import { universeData as u, starterShip, starterRig, deriveStats, hulls, spread } from '@theseus/domain'
import { writeFileSync, mkdirSync } from 'node:fs'

const out = process.argv[ 2 ]
mkdirSync(out, { recursive: true })

const me = { pid: '0b1c2d3e-0000-4000-8000-000000000001', handle: 'nobody', balance: '1000.00' }
const money = n => n.toFixed(4)

function quotes(stid) {
    const st = u.stations.find(s => s.stid === stid)
    return Object.entries(u.goods)
        .filter(([ gid, g ]) => g.kind === 'commodity' || st.stocks?.includes(gid))
        .map(([ gid, g ]) => {
            const q = spread(g.price_base)
            return { gid, price_buy: money(q.price_buy), price_sell: money(q.price_sell) }
        })
}

function ship(rig, place) {
    const s = deriveStats(hulls.starter, rig)
    return {
        sid: '5a1d0000-0000-4000-8000-000000000001', name: starterShip.name, hull: 'starter', rig: 1,
        capacity: s.capacity, velocity: s.velocity, acceleration: s.acceleration,
        power: s.power.used, power_pool: s.power.available, ...place,
    }
}

const fitted = rig => Object.entries(rig).map(([ slot, gid ]) => ({ slot, gid }))
const traffic = [
    { sid: '5a1d0000-0000-4000-8000-000000000002', name: 'sleeper service', handle: 'gurgeh', status: 'docked', stid: 'sol.outpost' },
    { sid: '5a1d0000-0000-4000-8000-000000000003', name: 'mistake not', handle: 'zakalwe', status: 'transit', from: 'sol.mars', to: 'barnards.rama', arrives: '+120s', years_abs: '6.1' },
]
const base = { me, traffic, messages: [], trades: []}
const save = (name, f) => writeFileSync(`${ out }/${ name }.json`, JSON.stringify(f, null, 2) + '\n')
save('universe', u)

save('docked', { ...base,
    ship: ship(starterRig, { status: 'docked', stid: 'sol.outpost' }),
    cargo: [], fitted: fitted(starterRig), market: quotes('sol.outpost') })

const leg = u.routes.find(r => r.from === 'sol.outpost' && r.c >= 1)
save('transit', { ...base,
    ship: ship(starterRig, { status: 'transit', from: leg.from, to: leg.to, arrives: '+90s', years_abs: String(leg.ly / starterShip.velocity), years_rel: String(leg.ly / starterShip.velocity * Math.sqrt(1 - starterShip.velocity ** 2)) }),
    cargo: [{ gid: 'ore', quantity: '6' }, { gid: 'electronics', quantity: '4' }], fitted: fitted(starterRig), market: []})

const mk2 = { ...starterRig, power1: 'reactor.mk2', cruise1: 'cruise.mk2', maneuver1: 'maneuver.mk2', cargo1: 'cargo.mk2' }
const full = ship(mk2, { status: 'docked', stid: 'sol.ganymede' })
const hold = [ 'titanium', 'chips', 'hydrogen', 'grain' ]
const per  = Math.floor(full.capacity / hold.reduce((n, gid) => n + u.goods[ gid ].volume, 0))
save('full', { ...base,
    ship: full, cargo: hold.map(gid => ({ gid, quantity: String(per) })),
    fitted: fitted(mk2), market: quotes('sol.ganymede') })

console.log('route', leg.from, '→', leg.to, leg.ly, 'ly · full capacity', full.capacity, '·', per, 'of each')

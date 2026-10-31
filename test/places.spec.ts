import { type Page, expect, test } from '@playwright/test'

const PLACES = [ 'port', 'exchange', 'hold', 'chart', 'orbit', 'rigging', 'comms' ]

// the same picture every run: a fixed date, a seeded random, calm motion (the clock stops), no sounds
test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'))
    await page.addInitScript(() => {
        let seed = 7
        Math.random = () => {
            seed = seed + 0x6D2B79F5 | 0
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
            return ((t ^ t >>> 14) >>> 0) / 4294967296
        }
        localStorage.setItem('theseus.settings', JSON.stringify({ voice: '', sound: false, calm: true }))
    })
})

// a place is ready when its models are in and the arrival has eased in
async function open(page: Page, url: string) {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
}

for (const place of PLACES) {
    test(`the ${ place }`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', e => errors.push(e.message))
        await open(page, `/?fixture=full#${ place }`)
        expect(errors).toEqual([])
        await expect(page).toHaveScreenshot(`${ place }.png`)
    })
}

test('a peer picked in comms lights the way to it', async ({ page }) => {
    await open(page, '/?fixture=full#comms')
    await page.getByRole('button', { name: 'station channel' }).click()
    await page.getByRole('option', { name: 'letter → diziet' }).click()
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('comms-aim.png')
})

test('a deck of goods fans out under the pointer', async ({ page }) => {
    await open(page, '/?fixture=full#exchange')
    await page.locator('kit-tray > ul > li > button').first().hover()
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('exchange-fan.png')
})

test('the ship underway', async ({ page }) => {
    await open(page, '/?fixture=transit')
    await expect(page).toHaveScreenshot('transit.png')
})

// the memory stays flat: after a first round the caches are warm, 20 more changes add nothing
test('20 place changes keep the memory flat', async ({ page }) => {
    const memory = () => page.evaluate(() => (globalThis as unknown as { stage: { gl: { info: { memory: { geometries: number, textures: number }}}}}).stage.gl.info.memory)
    const go = async (place: string) => {
        await page.evaluate(p => { location.hash = p }, place)
        await page.waitForTimeout(500)
    }
    await open(page, '/?fixture=full#port')
    for (const place of PLACES) await go(place)
    await page.waitForLoadState('networkidle')
    const before = await memory()
    for (let i = 0; i < 20; i++) await go(PLACES[ i % PLACES.length ])
    const after = await memory()
    expect(after.geometries).toBeLessThanOrEqual(before.geometries * 1.1 + 5)
    expect(after.textures).toBeLessThanOrEqual(before.textures + 2)
})

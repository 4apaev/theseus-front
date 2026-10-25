import { defineConfig } from '@playwright/test'

/**
 * the screenshot checks: each place on its fixture in a headless
 * browser, against a stored image in `test/screens/`. the dev server
 * serves the client; one that runs already is reused.
 * `npm run screens -- --update-snapshots` stores new images.
 */
export default defineConfig({
    testDir      : 'test',
    testMatch    : '*.spec.ts',
    snapshotPathTemplate: 'test/screens/{arg}{ext}',
    timeout      : 60_000,
    workers      : 1,
    reporter     : 'list',
    expect       : { toHaveScreenshot: { maxDiffPixelRatio: .02 }},
    use          : { baseURL: 'http://localhost:5174', viewport: { width: 1280, height: 800 }},
    webServer    : { command: 'npm run dev', url: 'http://localhost:5174', reuseExistingServer: true },
})

import { defineConfig } from 'vite'

/**
 * the gateway has no cors headers.
 * the dev server proxies `/api`,
 * rest and websocket, so the browser
 * sees one origin.
 *
 * production hosting needs the same proxy,
 * or same-origin serving.
 */
const target = process.env.GATEWAY ?? 'http://localhost:3000'

export default defineConfig({

    server: {
        port      : 5174,
        strictPort: true,
        proxy     : {
            '/api': {
                target,
                changeOrigin: true,
                ws: true,
            },
        },
    },

    // the libraries change less than the game: each has its own file, the browser keeps it
    build: {
        chunkSizeWarningLimit: 800,
        rolldownOptions      : {
            output: {
                codeSplitting: {
                    groups: [
                        { name: 'three', test: /node_modules[\\/]three[\\/]/ },
                        { name: 'lit',   test: /node_modules[\\/](lit|@lit|lit-html|lit-element)[\\/]/ },
                    ],
                },
            },
        },
    },
})

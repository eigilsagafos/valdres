import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3017),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-window demo: ${server.url}`)

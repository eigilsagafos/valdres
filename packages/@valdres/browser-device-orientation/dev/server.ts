import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3026),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-device-orientation demo: ${server.url}`)

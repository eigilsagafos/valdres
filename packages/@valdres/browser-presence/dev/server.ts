import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3020),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-presence demo: ${server.url}`)

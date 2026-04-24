import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3019),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-visibility demo: ${server.url}`)

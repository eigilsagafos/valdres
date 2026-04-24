import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3025),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-reduced-data demo: ${server.url}`)

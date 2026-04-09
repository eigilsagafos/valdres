import { plugin } from "bun"

const transpiler = new Bun.Transpiler({ loader: "ts" })

await plugin({
    name: "svelte-runes",
    setup(build) {
        build.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async (args) => {
            const source = await Bun.file(args.path).text()
            const js = transpiler.transformSync(source)
            const { compileModule } = await import("svelte/compiler")
            const result = compileModule(js, {
                filename: args.path,
                dev: false,
                generate: "client",
            })
            return {
                contents: result.js.code,
                loader: "js",
            }
        })
    },
})

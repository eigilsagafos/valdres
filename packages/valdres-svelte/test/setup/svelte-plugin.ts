import { plugin } from "bun"

const transpiler = new Bun.Transpiler({ loader: "ts" })

await plugin({
    name: "svelte-runes",
    setup(build) {
        // `.svelte.ts` / `.svelte.test.ts` are rune-using modules: transpile TS,
        // then compile runes with `compileModule`.
        build.onLoad({ filter: /\.svelte\.(test\.)?(ts|js)$/ }, async (args) => {
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
        // `.svelte` components are compiled with `compile` so reactivity tests
        // can `mount(...)` a real component — the only way user/render effects
        // (and `createSubscriber` subscriptions) actually flush. Requires a DOM
        // (happy-DOM preload) and the `browser` export condition (set in the
        // test script) so `svelte` / `svelte/reactivity` resolve to their client
        // builds.
        build.onLoad({ filter: /\.svelte$/ }, async (args) => {
            const source = await Bun.file(args.path).text()
            const { compile } = await import("svelte/compiler")
            const result = compile(source, {
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

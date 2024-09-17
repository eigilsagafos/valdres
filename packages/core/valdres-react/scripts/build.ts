import { build } from "bun"

await build({
    entrypoints: ["./index.ts"],
    outdir: "./dist",
    target: "browser",
    packages: "external",
    format: "esm",
    // minify: true,
}).then(res => console.log(res))

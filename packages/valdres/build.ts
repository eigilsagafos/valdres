await Bun.build({
    entrypoints: ["./index.ts"],
    outdir: "./dist",
    external: ["./package.json"],
    packages: "external",
})

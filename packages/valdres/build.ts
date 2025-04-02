const pkg = await Bun.file("package.json").json()
const version = pkg.version

await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    external: ["./package.json"],
    packages: "external",
    define: {
        "process.env.VALDRES_VERSION": JSON.stringify(version), // Define the version as a constant
    },
})

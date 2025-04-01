const packageJsonFile = await Bun.file("./package.json")
const packageTmpJsonFile = await Bun.file("./package.tmp.json")
if (await packageTmpJsonFile.exists()) {
    throw new Error("Prepack failed: package.tmp.json already exists")
} else {
    await Bun.write("package.tmp.json", packageJsonFile)
    const json = await packageJsonFile.json()
    delete json.scripts
    delete json.devDependencies
    const exports = Object.fromEntries(
        Object.entries(json.exports).map(([k, v]) => {
            const [, , ...rest] = v.split("/")
            const file = rest.pop()
            const folder = ["dist", ...rest].join("/")
            const typesDir = ["dist", "types", ...rest].join("/")
            const fileName = file.split(".")[0]
            return [
                k,
                {
                    import: `./${folder}/${fileName}.js`,
                    types: `./${typesDir}/${fileName}.d.ts`,
                },
            ]
        }),
    )
    json.exports = exports
    await Bun.write("package.json", JSON.stringify(json, null, 4))
}

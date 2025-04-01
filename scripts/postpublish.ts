const tmpFile = await Bun.file("./package.tmp.json")
if (await tmpFile.exists()) {
    await Bun.write("package.json", tmpFile)
    await tmpFile.delete()
} else {
    throw new Error("package.tmp.json does not exist")
}

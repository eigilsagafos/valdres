import { inc } from "semver"
import { render, useApp } from "ink"
import SelectInput from "ink-select-input"
import { getAllPackageJsonPaths } from "./lib/getAllPackageJsonPaths"

const packagePaths = await getAllPackageJsonPaths()

const packages: { path: string; content: { version: string } }[] = []
for await (const path of packagePaths) {
    packages.push({
        path,
        content: await Bun.file(path).json(),
    })
}

const versionsSet = new Set()

packages.map(({ content }) => {
    if (content.private) return
    if (!content.version) throw new Error(`Missing version in ${content.name}`)
    versionsSet.add(content.version)
})
if (versionsSet.size > 1)
    throw new Error(
        `Inconsistent package versions: ${Array.from(versionsSet).join(", ")}`,
    )
const currentVersion = versionsSet.keys().next().value

const updateVersionNumbers = (packageJson, packageNames, newVersion) => {
    const newPackageJson = structuredClone(packageJson)

    newPackageJson.version = newVersion
    for (const name of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
    ]) {
        if (newPackageJson[name]) {
            for (const packageName of packageNames) {
                if (newPackageJson[name][packageName]) {
                    newPackageJson[name][packageName] = newVersion
                }
            }
        }
    }
    return newPackageJson
}

const packageNames = packages.map(p => p.content.name)
const Bump = () => {
    const { exit } = useApp()
    const handleSelect = async item => {
        for await (const { path, content } of packages) {
            const newJson = updateVersionNumbers(
                content,
                packageNames,
                item.value,
            )
            await Bun.write(path, JSON.stringify(newJson, null, 4))
            exit()
        }
    }

    const items = [
        "major",
        "premajor",
        "minor",
        "preminor",
        "patch",
        "prepatch",
        "prerelease",
    ].map(level => {
        const ver = inc(currentVersion, level, "pre", "1")
        return {
            key: `${level}-${ver}`,
            label: `${level.padEnd(12, " ")} ${currentVersion} -> ${ver}`,
            value: ver,
        }
    })

    return <SelectInput items={items} onSelect={handleSelect} />
}

render(<Bump />)

import { Glob } from "bun"

export const getAllPackageJsonPaths = async () => {
    const glob = new Glob("**/package.json")
    const paths = []
    for await (const path of glob.scan(".")) {
        if (!path.includes("node_modules")) {
            paths.push(path)
        }
    }
    return paths
}

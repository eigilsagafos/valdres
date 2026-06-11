export type Framework =
    | "react"
    | "vue"
    | "svelte"
    | "solid"
    | "angular"
    | "vanilla"

export type FrameworkMeta = {
    label: string
    packageName: string
    prefix: string
}

export const frameworks: Record<Framework, FrameworkMeta> = {
    react: { label: "React", packageName: "valdres-react", prefix: "react" },
    vue: { label: "Vue", packageName: "valdres-vue", prefix: "vue" },
    svelte: {
        label: "Svelte",
        packageName: "valdres-svelte",
        prefix: "svelte",
    },
    solid: { label: "Solid", packageName: "valdres-solid", prefix: "solid" },
    angular: {
        label: "Angular",
        packageName: "valdres-angular",
        prefix: "angular",
    },
    vanilla: { label: "Vanilla", packageName: "valdres", prefix: "vanilla" },
}

export const frameworkList = Object.keys(frameworks) as Framework[]

export const defaultFramework: Framework = "react"

// Maps a package name back to a framework key
const packageToFramework: Record<string, Framework> = {}
for (const [key, meta] of Object.entries(frameworks)) {
    packageToFramework[meta.packageName] = key as Framework
}

export function frameworkFromPackage(
    packageName: string,
): Framework | undefined {
    return packageToFramework[packageName]
}

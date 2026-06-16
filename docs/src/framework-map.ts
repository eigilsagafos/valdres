import type { Framework } from "./frameworks"

// Maps a conceptual "role" to the API name in each framework.
// null = not available in that framework.
type ApiMapping = Record<Framework, string | null>

// Each entry: [role label, { framework: apiName }]
const apiRoles: Record<string, ApiMapping> = {
    readWrite: {
        react: "useAtom",
        vue: "useAtom",
        svelte: "fromState",
        solid: "createAtom",
        angular: "injectAtom",
        vanilla: null,
    },
    readOnly: {
        react: "useValue",
        vue: "useValue",
        // fromState covers both roles in Svelte: read-only on a selector,
        // read/write on an atom. There is no separate read-only export.
        svelte: "fromState",
        solid: "createValue",
        angular: "injectValue",
        vanilla: null,
    },
    writeOnly: {
        react: "useSetAtom",
        vue: "useSetAtom",
        svelte: null,
        solid: "createSetAtom",
        angular: "injectSetAtom",
        vanilla: null,
    },
    reset: {
        react: "useResetAtom",
        vue: "useResetAtom",
        svelte: null,
        solid: "createResetAtom",
        angular: "injectResetAtom",
        vanilla: null,
    },
    storeAccess: {
        react: "useStore",
        vue: "useStore",
        svelte: "getValdresContext",
        solid: "useStore",
        angular: "injectStore",
        vanilla: null,
    },
    provider: {
        react: "Provider",
        vue: "createValdres",
        svelte: "setValdresContext",
        solid: "ValdresProvider",
        angular: "provideValdres",
        vanilla: null,
    },
    transaction: {
        react: "useTransaction",
        vue: "useTransaction",
        svelte: "transaction",
        solid: "createTransaction",
        angular: "injectTransaction",
        vanilla: null,
    },
    scope: {
        react: "Scope",
        vue: "ValdresScope",
        svelte: "scope",
        solid: "ValdresScope",
        angular: "provideValdresScope",
        vanilla: null,
    },
}

// Core valdres API pages exist at /<fw>/atom, /<fw>/selector, etc.
// These share the same name across all frameworks.
const coreApiNames = ["atom", "selector", "atomFamily", "selectorFamily", "store"]

// Given a route like /react/useAtom, find the equivalent route for another framework.
export function getEquivalentRoute(
    currentRoute: string,
    targetFramework: Framework,
): string | null {
    const match = currentRoute.match(/^\/([^/]+)\/(.+)$/)
    if (!match) return null

    const currentFw = match[1] as Framework
    const currentApi = match[2]

    // Core API pages: same name across all frameworks
    if (coreApiNames.includes(currentApi)) {
        return `/${targetFramework}/${currentApi}`
    }

    // Plugin pages: the plugin name is framework-invariant
    if (currentApi.startsWith("plugins/")) {
        return `/${targetFramework}/${currentApi}`
    }

    for (const [, mapping] of Object.entries(apiRoles)) {
        if (mapping[currentFw] === currentApi) {
            const targetApi = mapping[targetFramework]
            if (targetApi) {
                return `/${targetFramework}/${targetApi}`
            }
            return null
        }
    }

    return null
}

// Build a full map for a given route: { react: "/react/useAtom", solid: "/solid/createAtom", ... }
export function getFrameworkMap(
    currentRoute: string,
): Record<Framework, string | null> {
    const result: Record<Framework, string | null> = {
        react: null,
        vue: null,
        svelte: null,
        solid: null,
        angular: null,
        vanilla: null,
    }

    const match = currentRoute.match(/^\/([^/]+)\/(.+)$/)
    if (!match) return result

    const currentFw = match[1] as Framework
    const currentApi = match[2]

    // Core API pages: same name across all frameworks
    if (coreApiNames.includes(currentApi)) {
        for (const fw of Object.keys(result) as Framework[]) {
            if (fw !== "vanilla") {
                result[fw] = `/${fw}/${currentApi}`
            }
        }
        return result
    }

    // Plugin pages: the plugin name is framework-invariant
    if (currentApi.startsWith("plugins/")) {
        for (const fw of Object.keys(result) as Framework[]) {
            if (fw !== "vanilla") {
                result[fw] = `/${fw}/${currentApi}`
            }
        }
        return result
    }

    for (const [, mapping] of Object.entries(apiRoles)) {
        if (mapping[currentFw] === currentApi) {
            for (const fw of Object.keys(result) as Framework[]) {
                const api = mapping[fw]
                result[fw] = api ? `/${fw}/${api}` : null
            }
            return result
        }
    }

    return result
}

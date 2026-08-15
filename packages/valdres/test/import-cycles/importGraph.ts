import { existsSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { Glob } from "bun"

/**
 * Static import-dependency graph over the package's PRODUCTION modules
 * (everything under `src/` that ships), plus strongly-connected-component
 * analysis. Powers the import-cycle baseline guard (importCycles.test.ts).
 *
 * Nodes are package-relative paths (e.g. `src/lib/subscribe.ts`). Edges are the
 * runtime import edges between production modules — `import type` / `export
 * type` are erased by `verbatimModuleSyntax` and excluded, so an SCC here means
 * a real runtime module cycle, not a types-only reference loop.
 */

export const PACKAGE_ROOT = resolve(import.meta.dir, "../..")

/** A source file counts as production iff it lives under `src/` and is not a
 *  test, benchmark, or docs artifact. */
const isProductionModule = (relPath: string): boolean =>
    relPath.startsWith("src/") &&
    relPath.endsWith(".ts") &&
    !relPath.endsWith(".test.ts") &&
    !relPath.endsWith(".bench.ts") &&
    !/\.types\.test\.ts$/.test(relPath)

export const collectProductionModules = (): string[] => {
    const glob = new Glob("src/**/*.ts")
    const modules: string[] = []
    for (const file of glob.scanSync({ cwd: PACKAGE_ROOT })) {
        const relPath = file.split("\\").join("/")
        if (isProductionModule(relPath)) modules.push(relPath)
    }
    return modules.sort()
}

// Matches static `import ... from "x"`, `export ... from "x"`, and dynamic
// `import("x")`. Type-only clauses are filtered separately.
const STATIC_FROM = /(?:^|\n)\s*(import|export)\b([^;]*?)\bfrom\s*["']([^"']+)["']/g
const DYNAMIC = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
// Matches side-effect imports `import "x"` (no binding, no `from`) — these still
// create a runtime edge (module x executes) even though nothing is bound.
const SIDE_EFFECT = /(?:^|\n)\s*import\s*["']([^"']+)["']/g

const isRelative = (spec: string) => spec.startsWith("./") || spec.startsWith("../")

/**
 * Extract every runtime import specifier from a source string: static
 * `... from "x"`, dynamic `import("x")`, and side-effect `import "x"`. Whole-
 * clause `import type` / `export type` are erased at build and excluded. Pure
 * (source in, specifiers out) so it is unit-testable without touching disk.
 */
export const extractImportSpecifiers = (source: string): string[] => {
    const specifiers = new Set<string>()
    let match: RegExpExecArray | null

    STATIC_FROM.lastIndex = 0
    while ((match = STATIC_FROM.exec(source))) {
        // Drop whole-clause type imports/exports — they are erased at build.
        if (/^\s*type\b/.test(match[2] ?? "")) continue
        specifiers.add(match[3]!)
    }
    DYNAMIC.lastIndex = 0
    while ((match = DYNAMIC.exec(source))) specifiers.add(match[1]!)
    SIDE_EFFECT.lastIndex = 0
    while ((match = SIDE_EFFECT.exec(source))) specifiers.add(match[1]!)

    return [...specifiers]
}

const resolveSpecifier = (fromRel: string, spec: string): string | undefined => {
    const fromAbs = resolve(PACKAGE_ROOT, fromRel)
    const base = resolve(dirname(fromAbs), spec)
    // `.ts`-only, matching collectProductionModules / isProductionModule — the
    // valdres core has no `.tsx`. Resolve an extensionless specifier to its
    // `.ts` file or a directory's `index.ts`.
    const candidates = [base, `${base}.ts`, `${base}/index.ts`]
    for (const candidate of candidates) {
        if (candidate.endsWith(".ts") && existsSync(candidate)) {
            return relative(PACKAGE_ROOT, candidate).split("\\").join("/")
        }
    }
    return undefined
}

/** Runtime import edges of one module (resolved, production targets only).
 *  Self-edges are retained — a module that imports itself is a real self-loop
 *  that computeSccs reports as a single-node cycle. */
const parseEdges = (relPath: string): string[] => {
    const source = readFileSync(resolve(PACKAGE_ROOT, relPath), "utf8")
    const edges: string[] = []
    for (const spec of extractImportSpecifiers(source)) {
        if (!isRelative(spec)) continue
        const target = resolveSpecifier(relPath, spec)
        if (target && isProductionModule(target)) edges.push(target)
    }
    return edges
}

export type ImportGraph = Map<string, string[]>

export const buildImportGraph = (): ImportGraph => {
    const modules = collectProductionModules()
    const known = new Set(modules)
    const graph: ImportGraph = new Map()
    for (const module of modules) {
        const edges = parseEdges(module).filter(target => known.has(target))
        graph.set(module, [...new Set(edges)].sort())
    }
    return graph
}

/**
 * Iterative Tarjan SCC. Returns every strongly-connected component with more
 * than one node (a genuine multi-module cycle) plus any single node that
 * imports itself, each as a sorted node list. Deterministic ordering.
 */
export const computeSccs = (graph: ImportGraph): string[][] => {
    let index = 0
    const indices = new Map<string, number>()
    const lowlink = new Map<string, number>()
    const onStack = new Set<string>()
    const stack: string[] = []
    const sccs: string[][] = []

    type Frame = { node: string; edgeIndex: number }

    for (const start of graph.keys()) {
        if (indices.has(start)) continue
        const frames: Frame[] = [{ node: start, edgeIndex: 0 }]
        indices.set(start, index)
        lowlink.set(start, index)
        index++
        stack.push(start)
        onStack.add(start)

        while (frames.length > 0) {
            const frame = frames[frames.length - 1]!
            const edges = graph.get(frame.node) ?? []
            if (frame.edgeIndex < edges.length) {
                const next = edges[frame.edgeIndex++]!
                if (!indices.has(next)) {
                    indices.set(next, index)
                    lowlink.set(next, index)
                    index++
                    stack.push(next)
                    onStack.add(next)
                    frames.push({ node: next, edgeIndex: 0 })
                } else if (onStack.has(next)) {
                    lowlink.set(
                        frame.node,
                        Math.min(lowlink.get(frame.node)!, indices.get(next)!),
                    )
                }
            } else {
                if (lowlink.get(frame.node) === indices.get(frame.node)) {
                    const component: string[] = []
                    let member: string
                    do {
                        member = stack.pop()!
                        onStack.delete(member)
                        component.push(member)
                    } while (member !== frame.node)
                    const selfLoop = (graph.get(frame.node) ?? []).includes(
                        frame.node,
                    )
                    if (component.length > 1 || selfLoop) {
                        sccs.push(component.sort())
                    }
                }
                frames.pop()
                if (frames.length > 0) {
                    const parent = frames[frames.length - 1]!
                    lowlink.set(
                        parent.node,
                        Math.min(
                            lowlink.get(parent.node)!,
                            lowlink.get(frame.node)!,
                        ),
                    )
                }
            }
        }
    }
    // Stable order: by size then first member.
    return sccs.sort(
        (a, b) => a.length - b.length || (a[0]! < b[0]! ? -1 : 1),
    )
}

/**
 * Find one concrete directed cycle within an SCC, for actionable reporting.
 * Returns a path `[a, b, ..., a]` where each step is a real import edge.
 */
export const findCycleInScc = (
    scc: string[],
    graph: ImportGraph,
): string[] => {
    const members = new Set(scc)
    const start = scc[0]!
    const onPath: string[] = []
    const onPathSet = new Set<string>()
    const visited = new Set<string>()

    const dfs = (node: string): string[] | null => {
        onPath.push(node)
        onPathSet.add(node)
        visited.add(node)
        for (const next of graph.get(node) ?? []) {
            if (!members.has(next)) continue
            if (onPathSet.has(next)) {
                const cycleStart = onPath.indexOf(next)
                return [...onPath.slice(cycleStart), next]
            }
            if (!visited.has(next)) {
                const found = dfs(next)
                if (found) return found
            }
        }
        onPath.pop()
        onPathSet.delete(node)
        return null
    }

    return dfs(start) ?? [start, start]
}

/**
 * The subset of `currentSccs` that is NOT fully contained in any single
 * `baselineSccs` entry — i.e. brand-new cycles, an SCC that grew a member, or
 * two baseline cycles merged into one. A current SCC that is a subset of some
 * baseline SCC (equal, shrunk, or a fragment of a split) is always allowed, so
 * removing or shrinking a cycle never trips the guard.
 */
export const findNewOrGrownSccs = (
    currentSccs: string[][],
    baselineSccs: string[][],
): string[][] =>
    currentSccs.filter(scc => {
        const members = new Set(scc)
        return !baselineSccs.some(base => {
            const baseSet = new Set(base)
            for (const member of members) if (!baseSet.has(member)) return false
            return true
        })
    })

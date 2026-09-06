import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
// Candidate-owned, build-only observation for the fixed incumbent-lite ablation.
// No observer code or counter branches are present in normal production builds.
export function instrumentIncumbentLite(
    source,
    filename,
    observerPath = resolve(
        dirname(fileURLToPath(import.meta.url)),
        "evidence-observer.mjs",
    ),
) {
    let changed = false
    function replace(before, after, count = 1) {
        const found = source.split(before).length - 1
        if (found !== count)
            throw new Error(
                `INCUMBENT-LITE-ADAPTER-ANCHOR: ${filename}: expected ${count}, found ${found}: ${before}`,
            )
        source = source.split(before).join(after)
        changed = true
    }
    if (filename.endsWith("/selector-evaluator/evaluate.ts")) {
        replace(
            "        if (!suppliedReadActive) throw new SelectorReadRevokedError()",
            "        tournamentObserver.get(host, selector, dependency)\n        if (!suppliedReadActive) throw new SelectorReadRevokedError()",
        )
        replace(
            "        const served = host.serve(dependency, session)",
            "        tournamentObserver.serve()\n        const served = host.serve(dependency, session)",
        )
        replace(
            "            returned = definition.get(suppliedGet)",
            "            tournamentObserver.body(host, selector)\n            returned = definition.get(suppliedGet)",
        )
        replace(
            "    const pending = [start]",
            "    tournamentObserver.search(_site)\n    const pending = [start]",
        )
        replace(
            "        const node = pending.pop() as Node",
            '        tournamentObserver.count("canonicalNodeVisits")\n        const node = pending.pop() as Node',
        )
        replace(
            "            return Object.freeze(reversed)",
            '            tournamentObserver.count("canonicalPositivePaths")\n            return Object.freeze(reversed)',
        )
        replace(
            "        if (transient) {",
            '        if (transient) {\n            tournamentObserver.count("transientPrefixExpansions")',
        )
        for (const line of [
            "            for (const dependency of transient) {",
            "            for (const dependency of dependencies) {",
            "        for (const dependency of record.dependencies) {",
        ])
            replace(
                line,
                line +
                    '\n            tournamentObserver.count("canonicalEdgesExamined")',
            )
        replace(
            "        if (graphVersion === prefixProofVersion) return",
            '        tournamentObserver.count("prefixRevalidationCalls")\n        if (graphVersion === prefixProofVersion) return',
        )
        replace(
            "        if (addedEdges !== undefined) {",
            '        if (addedEdges !== undefined) {\n            tournamentObserver.count("exactDeltaBatches")\n            tournamentObserver.count("exactDeltaEdges", addedEdges.length)',
        )
        replace(
            "        for (let index = 0; index < dependencies.length; index++) {",
            '        tournamentObserver.count("canonicalPrefixFallbacks")\n        for (let index = 0; index < dependencies.length; index++) {',
        )
        replace(
            "        if (activePath) {",
            '        if (activePath) {\n            tournamentObserver.count("activeCycleRejections")',
        )
    } else if (filename.endsWith("/committed-store-tree/scope-node.ts")) {
        replace(
            "        this.coordinator = coordinator",
            '        tournamentObserver.coordinate(this, parent ? "scope" : "root", parent)\n        this.coordinator = coordinator',
        )
        replace(
            "        this.#facade = facade",
            "        this.#facade = facade\n        tournamentObserver.bind(facade, this)",
        )
        replace(
            "    dropRecords(): void {",
            "    dropRecords(): void {\n        tournamentObserver.clear(this)",
        )
        replace(
            '        if (\n            proposal.outcome.kind === "control-error" &&',
            '        tournamentObserver.proposal(this, proposal)\n        if (\n            proposal.outcome.kind === "control-error" &&',
        )
        replace(
            "        this.#selectorRecords.set(selector, record)",
            "        this.#selectorRecords.set(selector, record)\n        tournamentObserver.install(this, selector, record)",
        )
    } else if (
        filename.endsWith("/committed-store-tree/scratch-selector-host.ts")
    ) {
        replace(
            "        this.#bindings = bindings",
            '        tournamentObserver.coordinate(this, "scratch", undefined, generation)\n        this.#bindings = bindings',
        )
        replace(
            "        this.#selectorRecords.clear()",
            "        tournamentObserver.clear(this, this.#generation)\n        this.#selectorRecords.clear()",
            2,
        )
        replace(
            '        if (proposal.outcome.kind === "control-error") {',
            '        tournamentObserver.proposal(this, proposal)\n        if (proposal.outcome.kind === "control-error") {',
        )
        replace(
            "        return served\n    }",
            "        tournamentObserver.install(this, node, this.#selectorRecords.get(node))\n        return served\n    }",
        )
    } else if (
        filename.endsWith("/committed-store-tree/committed-store-tree.ts")
    ) {
        replace(
            "            scratchHost = this.#createHydrationSelectorHost(draft, scope)",
            '            scratchHost = this.#createHydrationSelectorHost(draft, scope)\n            tournamentObserver.coordinate(scratchHost, "hydration", scope, draft.generation)',
        )
        replace(
            "            scratchHost = this.#createScratchSelectorHost(draft, scope)",
            '            scratchHost = this.#createScratchSelectorHost(draft, scope)\n            tournamentObserver.coordinate(scratchHost, "scratch", scope, draft.generation)',
        )
        replace(
            "        const capture = (target: SubscriptionTarget): void => {",
            "        const capture = (target: SubscriptionTarget): void => {\n            tournamentObserver.notification()",
        )
        replace(
            "                        const returned = callback()",
            "                        tournamentObserver.callback()\n                        const returned = callback()",
        )
    }
    return changed
        ? `import { observer as tournamentObserver } from ${JSON.stringify(observerPath)};\n${source}`
        : source
}
export function createEvidencePlugin() {
    return {
        name: "incumbent-lite-tournament-observation",
        setup(build) {
            build.onLoad(
                {
                    filter: /\/(?:selector-evaluator\/evaluate|committed-store-tree\/(?:scope-node|scratch-selector-host|committed-store-tree))\.ts$/,
                },
                args => ({
                    contents: instrumentIncumbentLite(
                        readFileSync(args.path, "utf8"),
                        args.path,
                    ),
                    loader: "ts",
                }),
            )
        },
    }
}

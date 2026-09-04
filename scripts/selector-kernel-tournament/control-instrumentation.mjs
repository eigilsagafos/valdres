import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
// Exact anchors are specific to the frozen control. A candidate owns its own
// build-only translation; no production interface is designed by this plugin.
export function instrumentControl(
    source,
    filename,
    observerPath = resolve(
        dirname(fileURLToPath(import.meta.url)),
        "control-observer-runtime.mjs",
    ),
) {
    let changed = false
    function replace(before, after, count = 1) {
        const found = source.split(before).length - 1
        if (found !== count)
            throw new Error(
                `CONTROL-ADAPTER-ANCHOR: ${filename}: expected ${count}, found ${found}: ${before}`,
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
export function controlPlugin() {
    return {
        name: "beta36-tournament-observation",
        setup(build) {
            build.onLoad(
                {
                    filter: /\/(?:selector-evaluator\/evaluate|committed-store-tree\/(?:scope-node|scratch-selector-host|committed-store-tree))\.ts$/,
                },
                args => ({
                    contents: instrumentControl(
                        readFileSync(args.path, "utf8"),
                        args.path,
                    ),
                    loader: "ts",
                }),
            )
        },
    }
}

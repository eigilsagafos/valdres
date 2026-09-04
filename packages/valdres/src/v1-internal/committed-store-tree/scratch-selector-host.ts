import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorDependencySnapshot,
    SelectorEvaluationHost,
    SelectorEvaluationStrategy,
    SelectorRecordView,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import { SelectorEvaluationSession } from "../selector-evaluator/types"
import type { DraftScratchHost, DraftAtomOutcome } from "./tree-transaction"

type ScratchToken = Readonly<{ id: number }>

export type ResolvedScratchState<Node> =
    | Readonly<{ kind: "atom" }>
    | Readonly<{ kind: "ext" }>
    | Readonly<{
          kind: "selector"
          definition: SelectorDefinition<Node>
      }>

export type ScratchSourceKind = "atom" | "ext"

export interface ScratchSelectorBindings<Node> {
    resolve(
        node: Node,
        session: SelectorEvaluationSession<Node>,
    ): ResolvedScratchState<Node>
    read(
        source: Node,
        kind: ScratchSourceKind,
        session: SelectorEvaluationSession<Node>,
    ): DraftAtomOutcome
    baseline(selector: Node): Readonly<{ value: unknown }> | undefined
    run<Result>(
        session: SelectorEvaluationSession<Node>,
        operation: () => Result,
    ): Result
}

interface ScratchSelectorRecord<Node> {
    readonly served: ServedSelectorOutcome<ScratchToken>
    readonly dependencies: readonly SelectorDependencySnapshot<
        Node,
        ScratchToken
    >[]
}

const NO_COMMITTED_BASELINE = Symbol("no-committed-selector-baseline")

/**
 * Disposable forward-only evaluator policy for one TreeDraft. It owns no
 * committed record, reverse edge, source token, subscription, or lifecycle
 * state. Current-generation records are dropped after every admitted intent.
 */
export class ScratchSelectorHost<Node extends object>
    implements
        DraftScratchHost<Node>,
        SelectorEvaluationHost<Node, ScratchToken>
{
    #bindings: ScratchSelectorBindings<Node> | undefined
    readonly #selectorRecords = new Map<Node, ScratchSelectorRecord<Node>>()
    readonly #sourceRecords = new Map<
        Node,
        ServedSelectorOutcome<ScratchToken>
    >()
    readonly #committedBaselines = new Map<
        Node,
        typeof NO_COMMITTED_BASELINE | Readonly<{ value: unknown }>
    >()
    #generation: number
    #nextToken = 1
    #selectorGraphVersion = 0
    readonly #evaluate: SelectorEvaluationStrategy

    constructor(
        bindings: ScratchSelectorBindings<Node>,
        generation: number,
        evaluate: SelectorEvaluationStrategy,
    ) {
        this.#bindings = bindings
        this.#generation = generation
        this.#evaluate = evaluate
    }

    readSelector<Value>(selector: Node): Value {
        const session = new SelectorEvaluationSession<Node>()
        const served = this.serve(selector, session)
        if (served.outcome.kind !== "value") throw served.outcome.error
        return served.outcome.value as Value
    }

    advanceGeneration(generation: number): void {
        if (generation !== this.#generation + 1) {
            throw new Error("Scratch selector generation is not contiguous")
        }
        this.#generation = generation
        this.#selectorRecords.clear()
        this.#sourceRecords.clear()
    }

    revoke(): void {
        this.#selectorRecords.clear()
        this.#sourceRecords.clear()
        this.#committedBaselines.clear()
        this.#bindings = undefined
    }

    serve(
        node: Node,
        session: SelectorEvaluationSession<Node>,
    ): ServedSelectorOutcome<ScratchToken> {
        const bindings = this.#activeBindings()
        const resolved = bindings.resolve(node, session)
        if (resolved.kind !== "selector") {
            const current = this.#sourceRecords.get(node)
            if (current !== undefined) return current
            const served = Object.freeze({
                token: this.createOutcomeToken(),
                outcome: bindings.read(node, resolved.kind, session),
            })
            this.#sourceRecords.set(node, served)
            return served
        }

        const current = this.#selectorRecords.get(node)
        if (current !== undefined) return current.served
        const proposal = bindings.run(session, () =>
            this.#evaluate(resolved.definition, this, session),
        )
        if (proposal.outcome.kind === "control-error") {
            throw proposal.outcome.error
        }
        const served = Object.freeze({
            token: proposal.token,
            outcome: proposal.outcome,
        })
        this.#selectorGraphVersion++
        session.noteSelectorGraphPublication(this)
        this.#selectorRecords.set(
            node,
            Object.freeze({
                served,
                dependencies: proposal.dependencies,
            }),
        )
        return served
    }

    getSelectorRecord(
        node: Node,
    ): SelectorRecordView<Node, ScratchToken> | undefined {
        const record = this.#selectorRecords.get(node)
        return record === undefined
            ? undefined
            : Object.freeze({ dependencies: record.dependencies })
    }

    getSelectorGraphVersion(): number {
        return this.#selectorGraphVersion
    }

    getComparisonBaseline(
        node: Node,
    ): SelectorComparisonBaseline<ScratchToken> | undefined {
        let baseline = this.#committedBaselines.get(node)
        if (baseline === undefined) {
            baseline =
                this.#activeBindings().baseline(node) ?? NO_COMMITTED_BASELINE
            this.#committedBaselines.set(node, baseline)
        }
        return baseline === NO_COMMITTED_BASELINE
            ? undefined
            : Object.freeze({
                  current: false as const,
                  value: baseline.value,
              })
    }

    createOutcomeToken(): ScratchToken {
        return Object.freeze({ id: this.#nextToken++ })
    }

    #activeBindings(): ScratchSelectorBindings<Node> {
        if (this.#bindings === undefined) {
            throw new Error("Scratch selector host is revoked")
        }
        return this.#bindings
    }
}

import { evaluateSelector } from "./evaluate"
import type {
    SelectorDefinition,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
} from "./types"
import { SelectorEvaluationSession } from "./types"

declare const host: SelectorEvaluationHost<symbol, { readonly id: number }>
declare const definition: SelectorDefinition<symbol, number>

const assertSelectorEvaluatorTypes = (): void => {
    const proposal = evaluateSelector(
        definition,
        host,
        new SelectorEvaluationSession(),
    )

    const typedProposal: SelectorEvaluationProposal<
        symbol,
        { readonly id: number },
        number
    > = proposal
    void typedProposal

    // @ts-expect-error immutable proposal arrays cannot be extended
    proposal.dependencies.push({ node: Symbol(), token: { id: 1 } })
    // @ts-expect-error immutable proposal fields cannot be replaced
    proposal.outcome = { kind: "value", value: 2 }
}
void assertSelectorEvaluatorTypes

const numberDefinition: SelectorDefinition<string, number> = {
    node: "count",
    get: get => get<number>("source") + 1,
    equal: (previous, next) => previous === next,
}
void numberDefinition

import { SelectorEvaluationError } from "./SelectorEvaluationError"

import { generateSelectorTrace } from "./lib/generateSelectorTrace"

export class SelectorCircularDependencyError extends SelectorEvaluationError {
    constructor() {
        super()
        this.name = "SelectorCircularDependencyError"
    }

    public get message(): string {
        const firstSelectorName =
            this.selectors[0]?.name ?? "Anonymous Selector"
        const summary = `Circular dependency detected in '${firstSelectorName}'`
        const trace = generateSelectorTrace(this.selectors)
        return trace ? `${summary}\n${trace}` : summary
    }
}

import { SelectorEvaluationError } from "./SelectorEvaluationError"

import { generateSelectorTrace } from "./lib/generateSelectorTrace"

export class SelectorCircularDependencyError extends SelectorEvaluationError {
    constructor() {
        super()
    }

    public get message(): string {
        const firstSelectorName = this.selectors[0].name ?? "Anonymous Selector"
        return `Circular dependency detected in '${firstSelectorName}'
${generateSelectorTrace(this.selectors)}`
    }
}

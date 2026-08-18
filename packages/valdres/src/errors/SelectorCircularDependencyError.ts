import { SelectorEvaluationError } from "./SelectorEvaluationError"

import { generateSelectorTrace } from "./lib/generateSelectorTrace"
import { errorBrand, errorHasBrand, markError } from "./lib/errorBrand"

const SELECTOR_CIRCULAR_DEPENDENCY_ERROR = errorBrand(
    "SelectorCircularDependencyError",
)

export class SelectorCircularDependencyError extends SelectorEvaluationError {
    /** Preserve instanceof across adopted same-version package copies. */
    static [Symbol.hasInstance](value: unknown): boolean {
        return errorHasBrand(value, SELECTOR_CIRCULAR_DEPENDENCY_ERROR)
    }

    constructor() {
        super()
        markError(this, SELECTOR_CIRCULAR_DEPENDENCY_ERROR)
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

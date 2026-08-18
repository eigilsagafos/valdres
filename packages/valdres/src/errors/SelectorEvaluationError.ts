import type { Selector } from "../types/Selector"
import { generateSelectorTrace } from "./lib/generateSelectorTrace"
import { errorBrand, errorHasBrand, markError } from "./lib/errorBrand"

const SELECTOR_EVALUATION_ERROR = errorBrand("SelectorEvaluationError")

export class SelectorEvaluationError extends Error {
    selectors: any[]

    /** Preserve instanceof across adopted same-version package copies. */
    static [Symbol.hasInstance](value: unknown): boolean {
        return errorHasBrand(value, SELECTOR_EVALUATION_ERROR)
    }

    constructor(cause?: any) {
        super()
        markError(this, SELECTOR_EVALUATION_ERROR)
        this.name = "SelectorEvaluationError"
        this.cause = cause
        this.selectors = []
    }

    track(selector: Selector<any>) {
        this.selectors.push(selector)
    }

    public get message(): string {
        const firstSelectorName =
            this.selectors[0]?.name ?? "Anonymous Selector"
        const summary = `Selector eval crashed in '${firstSelectorName}'`
        const trace = generateSelectorTrace(this.selectors)
        return trace ? `${summary}\n${trace}` : summary
    }
}

import type { Selector } from "../types/Selector"
import { generateSelectorTrace } from "./lib/generateSelectorTrace"

export class SelectorEvaluationError extends Error {
    selectors: any[]
    constructor(cause?: any) {
        super()
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

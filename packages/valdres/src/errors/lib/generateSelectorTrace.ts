import type { Selector } from "../../types/Selector"

export const generateSelectorTrace = (selectors: Selector[]) => {
    const lastIndex = selectors.length - 1
    return [...selectors]
        .reverse()
        .map((selector, index) => {
            const name = selector.name ?? "Anonymous Selector"
            if (index === 0) {
                return `[START] ${name}`
            } else if (index === lastIndex) {
                return `[CRASH] ${name}`
            } else {
                return `        ${" ".repeat(index)}${name}`
            }
        })
        .join(`\n`)
}

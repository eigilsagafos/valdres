import {
    CONTRAST_QUERIES,
    contrastAtom,
    readContrast,
} from "../atoms/contrastAtom"

export const subscribe = () => {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return
    const sync = () => contrastAtom.setSelf(readContrast())
    sync()
    const mqs = CONTRAST_QUERIES.map(({ query }) => window.matchMedia(query))
    for (const mq of mqs) mq.addEventListener("change", sync)
    return () => {
        for (const mq of mqs) mq.removeEventListener("change", sync)
    }
}

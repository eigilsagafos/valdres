import { CONTRAST_QUERIES, contrastAtom } from "../atoms/contrastAtom"

export const subscribe = () => {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return
    const mqs = CONTRAST_QUERIES.map(({ value, query }) => ({
        value,
        mq: window.matchMedia(query),
    }))
    const sync = () => {
        const active = mqs.find(({ mq }) => mq.matches)
        contrastAtom.setSelf(active ? active.value : "no-preference")
    }
    sync()
    for (const { mq } of mqs) mq.addEventListener("change", sync)
    return () => {
        for (const { mq } of mqs) mq.removeEventListener("change", sync)
    }
}

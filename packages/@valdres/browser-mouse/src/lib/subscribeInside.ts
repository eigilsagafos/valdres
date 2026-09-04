import { mouseInsideAtom } from "../atoms/mouseInsideAtom"

const onEnter = () => mouseInsideAtom.setSelf(true)
const onLeave = () => mouseInsideAtom.setSelf(false)

// `mouseenter` / `mouseleave` on the document fire once as the cursor crosses
// the page boundary (they don't bubble per descendant the way over/out do).
export const subscribeInside = () => {
    if (typeof document === "undefined") return
    document.addEventListener("mouseenter", onEnter)
    document.addEventListener("mouseleave", onLeave)
    return () => {
        document.removeEventListener("mouseenter", onEnter)
        document.removeEventListener("mouseleave", onLeave)
    }
}

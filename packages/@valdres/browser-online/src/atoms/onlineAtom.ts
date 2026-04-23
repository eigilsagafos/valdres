import { atom } from "valdres"
import { bootstrap } from "../lib/bootstrap"

const getInitial = () => {
    if (typeof navigator === "undefined") return true
    return navigator.onLine
}

export const onlineAtom = atom<boolean>(getInitial(), {
    global: true,
    name: "@valdres/browser-online/online",
    onInit: () => bootstrap(),
})

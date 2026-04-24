import { atom } from "valdres"

export const publicIpStaleWhileRevalidateAtom = atom<number>(Infinity, {
    global: true,
    name: "@valdres/public-ip/staleWhileRevalidate",
})

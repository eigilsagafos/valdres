import { atom } from "valdres"

export const publicIpMaxAgeAtom = atom<number>(5 * 60 * 1000, {
    global: true,
    name: "@valdres/public-ip/maxAge",
})

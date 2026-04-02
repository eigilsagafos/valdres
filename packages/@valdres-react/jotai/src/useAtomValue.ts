import { useAtom } from "./useAtom"

export const useAtomValue = (atom: any) => {
    const [value] = useAtom(atom)
    return value
}

import { useEffect, useLayoutEffect } from "react"

/** Commit-phase effects in the browser; the server runs neither. */
export const useIsomorphicLayoutEffect =
    typeof document === "undefined" ? useEffect : useLayoutEffect

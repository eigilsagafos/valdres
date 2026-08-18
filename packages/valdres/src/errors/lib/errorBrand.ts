/** Same-version package copies have distinct class identities. A shared brand
 * preserves instanceof control flow without accepting arbitrary name matches. */
export const errorBrand = (name: string): symbol =>
    Symbol.for(`valdres.error.${name}`)

export const markError = (error: Error, brand: symbol): void => {
    Object.defineProperty(error, brand, { value: true })
}

export const errorHasBrand = (value: unknown, brand: symbol): boolean =>
    (value as Record<symbol, unknown> | null)?.[brand] === true

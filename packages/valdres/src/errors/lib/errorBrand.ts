/** Same-version package copies have distinct class identities. A shared brand
 * preserves instanceof control flow without accepting arbitrary name matches. */
export const errorBrand = (name: string): symbol =>
    Symbol.for(`valdres.error.${name}`)

export const markError = (error: Error, brand: symbol): void => {
    Object.defineProperty(error, brand, { value: true })
}

export const errorHasBrand = (value: unknown, brand: symbol): boolean =>
    (value as Record<symbol, unknown> | null)?.[brand] === true

const nativeHasInstance = Function.prototype[Symbol.hasInstance]

/** Preserve normal subclass direction while adding a cross-copy fallback only
 * for the class that owns the brand. Static Symbol.hasInstance is inherited,
 * so using the brand for a subclass receiver would make every base error an
 * instance of every subclass. */
export const brandedErrorHasInstance = (
    receiver: Function,
    declaringClass: Function,
    value: unknown,
    brand: symbol,
): boolean =>
    nativeHasInstance.call(receiver, value) ||
    (receiver === declaringClass && errorHasBrand(value, brand))

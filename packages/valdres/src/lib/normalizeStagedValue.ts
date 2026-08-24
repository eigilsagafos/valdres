import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { isPromiseLike } from "../utils/isPromiseLike"
import { IS_PROD } from "./IS_PROD"
import { validateSchema } from "./validateSchema"

/**
 * Staging-time normalization shared by every transaction write path
 * (`Transaction.set`, `batchSetFamilyAtoms`, and any future staging entry).
 *
 * Order is contractual: validate FIRST, then dev-freeze. Direct writes
 * validate the raw value in `setAtom` and freeze later in `setValueInData`,
 * so a schema must observe the same (unfrozen) representation no matter which
 * write path delivered the value. A schema failure throws here, inside the
 * user's transaction callback, so commit never runs and the transaction stays
 * atomic; promise-like values skip both steps and are validated after
 * settlement by coordinateAsyncWrite.
 *
 * The freeze decision mirrors `setValueInData` (which keeps its copy inline
 * for the hot primitive-set path): respect `atom.mutable` and production mode,
 * and never freeze a promise-like, which must stay usable until the async-write
 * coordinator normalizes it at commit. Freezing at staging (not only at commit)
 * is what makes staged values immutable within the transaction body.
 *
 * `deepFreezePolicyFuzz.test.ts` enforces both halves of that paragraph rather
 * than trusting it: it requires every write path to agree on the outcome for
 * one value (so the two copies cannot drift), pins the deliberate promise-like
 * exemption, and pins the validate-then-freeze order above by checking that a
 * schema is never shown an already-frozen value.
 */
export const normalizeStagedValue = <V>(
    atom: Atom<any>,
    resolved: V,
    data: StoreData,
): V => {
    resolved = validateSchema(atom, resolved, data)
    if (
        !atom.mutable &&
        !IS_PROD &&
        resolved !== null &&
        (typeof resolved === "object" || typeof resolved === "function") &&
        !isPromiseLike(resolved)
    ) {
        resolved = deepFreeze(resolved)
    }
    return resolved
}

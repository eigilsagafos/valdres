/**
 * Jotai-compatible type definitions for the valdres adapter.
 *
 * These types provide API compatibility so that code written with jotai types
 * can be used with the valdres adapter without type errors.
 */

// Re-export jotai's actual types for full compatibility
export type {
    Atom,
    WritableAtom,
    PrimitiveAtom,
    Getter,
    Setter,
    ExtractAtomValue,
    ExtractAtomArgs,
    ExtractAtomResult,
    SetStateAction,
} from "jotai/vanilla"

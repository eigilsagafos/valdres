import type {
    Atom,
    Selector,
} from "./committed-store-tree/committed-store-tree"
import type { FamilyKey } from "./family"

export type FamilyState = Atom<any> | Selector<any>

// The constraint is deliberately loose so an invalid factory still infers as
// itself instead of collapsing to the constraint; the branded conditionals
// below carry the actual diagnosis into the compiler output.
export type AnyFamilyFactory = (...args: any[]) => any

// `Factory & FamilyFactoryTypeError<…>` keeps the inferred Factory in the
// diagnostic and adds an impossible branded property whose name is the fix.
// A bare `never` false branch would only report "not assignable to parameter
// of type 'never'".
export type FamilyFactoryTypeError<Message extends string> = {
    readonly [Key in `ERROR: ${Message}`]: never
}

type IsAny<Value> = 0 extends 1 & Value ? true : false

// When inference cannot run against the argument (an unannotated or defaulted
// parameter makes the arrow context-sensitive; a non-function never matches),
// Factory is fixed to its constraint: any parameters and an any return. An
// explicit `(...args: any[]) => any` lands here too. Diagnose that before
// reading anything off the signature.
type IsUnresolvedFamilyFactory<Factory extends AnyFamilyFactory> =
    any[] extends Parameters<Factory> ? IsAny<ReturnType<Factory>> : false

export type CheckedFamilyFactory<
    Factory extends AnyFamilyFactory,
    Accepted extends AnyFamilyFactory,
> =
    IsUnresolvedFamilyFactory<Factory> extends true
        ? Factory &
              FamilyFactoryTypeError<"family factory parameters must have concrete types, not any">
        : [ReturnType<Factory>] extends [FamilyState]
          ? Parameters<Factory> extends [unknown, ...unknown[]]
              ? Accepted
              : Factory &
                    FamilyFactoryTypeError<"family factories require at least one argument">
          : Factory &
                FamilyFactoryTypeError<"family factories must return an Atom or Selector">

export type PrimitiveFamilyFactory<Factory extends AnyFamilyFactory> =
    CheckedFamilyFactory<
        Factory,
        Parameters<Factory> extends [FamilyKey, ...FamilyKey[]]
            ? Factory
            : Factory &
                  FamilyFactoryTypeError<"structured family arguments require a valid options.encodeKey">
    >

export type NonEmptyFamilyFactory<Factory extends AnyFamilyFactory> =
    CheckedFamilyFactory<Factory, Factory>

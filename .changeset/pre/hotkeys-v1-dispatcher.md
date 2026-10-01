---
"@valdres/hotkeys": major
"@valdres-react/hotkeys": major
---

**Breaking: hotkeys are rebuilt on `@valdres/browser-keyboard` and run their
commands as synchronous transactions inside the keydown's store update.**

**Upgrade both packages together, with their peers.** Move `@valdres/hotkeys`
and `@valdres-react/hotkeys` to this release in the same change, alongside
`valdres` 1.0.0-beta.41 or later, `@valdres/browser-keyboard` 1.0.0-beta.10 or
later and, for the React package, `valdres-react` 1.0.0-beta.8 or later; the
peer ranges require exactly these. Earlier `@valdres-react/hotkeys` betas
(1.0.0-beta.1 to 1.0.0-beta.7) depend on `@valdres/hotkeys` `^1.0.0-beta.N`,
which this release also satisfies, so an install that re-resolves
`@valdres/hotkeys` under one of them breaks: the import fails with the v1 core,
and npm reports an `ERESOLVE` peer conflict when an older core is pinned.
Installs from an existing lockfile are unaffected; keep it until you migrate
both packages. The migration guide in the hotkeys documentation maps every
removed API to its replacement.

- `bindHotkey(store, shortcut, (tx, hit) => …, options)` and
  `useHotkey(shortcut, command, options)` replace the `subscribeTo*` and
  `useHotkeys*` families. A command writes through the update's transaction, so
  subscribers see the key state and its result together. Each store runs at
  most one binding per keydown; a failing command is rolled back and reported,
  never retried, and never passed to another binding.
- Only a new keydown triggers anything: becoming enabled, entering a scope,
  re-rendering or resubscribing never acts on an earlier keydown, and a binding
  never runs for a keydown from before it was registered.
- Precedence is explicit: scope priority, then binding priority. Equally ranked
  eligible bindings are a `HotkeyConflictError` and none runs. Registration and
  mount order never decide.
- `hotkeyScope`, `activateHotkeyScope` and `useHotkeyScope`: layers that
  outrank the base layer while active; `exclusive` ones block lower-priority
  layers. Activation is per Store object — never inherited by child scope
  Stores — and a rejected activation or release changes nothing.
- Options: `enabled` (boolean or `State<boolean>`, read when the keydown
  happens), `priority`, `scope`, `repeat`, `editable`, `preventDefault`, and
  `handleDefaultPrevented` — keydowns already cancelled by earlier handlers are
  skipped unless a binding opts in.
- Shortcuts compare modifiers as a set (press order no longer matters), match
  `KeyDown.code` or `KeyDown.key`, and take arrays for alternatives.
- Removed, with replacements in the migration guide: keyup-triggered hotkeys,
  `useHotkeysCommand` / `subscribeToCommand` / `KeyboardCommand` presets,
  comma-separated alternatives, `currentKeyCombinationAtom`,
  `currentCodeCombinationAtom`, `eventByKeyAtom`, `eventByCodeAtom`,
  `registerListeners`, `eventHandler`, `DEFAULT_OPTIONS` and `Options`. Importing
  no longer attaches listeners.
- `@valdres-react/hotkeys` resolves its Store with `valdres-react`'s
  `useStore(options.store)`; no hotkeys Provider is needed.

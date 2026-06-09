---
"@valdres/search-languages": minor
"valdres": minor
---

Add `@valdres/search-languages` — 25 language presets (tokenizer + Snowball stemmer + stop-word list) for `atomFamilySearch`, with zero runtime dependencies and tree-shakable per-language imports.

valdres core: widened `language?: SearchLanguage` to also accept `LanguagePreset`, exported the type. Extractor signatures now allow `null | undefined` returns to skip indexing.

See the separate `valdres-core-apis.md` changeset for the full set of new valdres APIs (atomFamilyIndex / atomFamilySort / atomFamilySearch and helpers) that this package builds on.

---
---

Release infrastructure only, no published package changes:

- Derive the publishable package set from the workspace
  (`scripts/public-packages.ts`) instead of hardcoding it in both
  `ci-publish.sh` and `verify-publish.ts`.
- Add `bun run first-publish` to bootstrap a new package name on npm before OIDC
  trusted publishing can take over.
- Share the prepack/restore step (`scripts/lib/with-prepacked.ts`), fixing a
  case where a prepack that failed partway left a gitignored `package.tmp.json`
  behind and broke the next run.

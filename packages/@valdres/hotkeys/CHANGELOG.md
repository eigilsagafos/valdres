# @valdres/hotkeys

## 1.0.0-beta.6

### Patch Changes

- [#304](https://github.com/eigilsagafos/valdres/pull/304)
  [`2539b82`](https://github.com/eigilsagafos/valdres/commit/2539b82d95c7f1329f17a9a2740eef5bbb5be690)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Ship ESM
  declarations with explicit `.js` import specifiers so package exports resolve
  for Node16 and NodeNext TypeScript consumers with library checking enabled.

- [#305](https://github.com/eigilsagafos/valdres/pull/305)
  [`40a0998`](https://github.com/eigilsagafos/valdres/commit/40a0998a019653f3a94fd310b8a143879ecae5b7)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix published
  metadata for CommonJS `require(esm)` and legacy TypeScript resolution, declare
  Node.js 22.12 or newer, and preserve Valdres's runtime duplicate-instance
  guard during tree-shaking.
- Updated dependencies
  [[`2539b82`](https://github.com/eigilsagafos/valdres/commit/2539b82d95c7f1329f17a9a2740eef5bbb5be690),
  [`fc0c8bb`](https://github.com/eigilsagafos/valdres/commit/fc0c8bbd3617ac73e7158af6638146ea1146cc61),
  [`f4affba`](https://github.com/eigilsagafos/valdres/commit/f4affba65bb32429e2550aed63b51114ecaa434e),
  [`bf616d6`](https://github.com/eigilsagafos/valdres/commit/bf616d68642feccb7ca2e043f28cf60e8bf848af),
  [`40a0998`](https://github.com/eigilsagafos/valdres/commit/40a0998a019653f3a94fd310b8a143879ecae5b7),
  [`8b3903b`](https://github.com/eigilsagafos/valdres/commit/8b3903b659fd5a8d8fd3e22fa48e1857119ed531),
  [`f16ed4e`](https://github.com/eigilsagafos/valdres/commit/f16ed4e65bf5d2ab2f05fdf19ec8cb51a223814f),
  [`82ff384`](https://github.com/eigilsagafos/valdres/commit/82ff3848fbc754e2c707bf4c5f904ebce775585b),
  [`1be55cf`](https://github.com/eigilsagafos/valdres/commit/1be55cf3672aa70b50ecca01cd47d6450a0ab2e1),
  [`422a7d4`](https://github.com/eigilsagafos/valdres/commit/422a7d410474c1bd8a232ceb99dd545c9d4e6a75),
  [`b394e0f`](https://github.com/eigilsagafos/valdres/commit/b394e0f1a2e51456d0f30aa73cf1372892785d47),
  [`c4c2e6c`](https://github.com/eigilsagafos/valdres/commit/c4c2e6ce94c57b87bb2af3377ec3feb68f7f7f78),
  [`539fb74`](https://github.com/eigilsagafos/valdres/commit/539fb742cc4ffaf22f64939733c1c2bb373262ba),
  [`b669d77`](https://github.com/eigilsagafos/valdres/commit/b669d77e9637a089ff96da8994cc38ae43ed7360),
  [`c1a58bc`](https://github.com/eigilsagafos/valdres/commit/c1a58bc9174210e359f26202fc3fadc12bb6d514),
  [`154b413`](https://github.com/eigilsagafos/valdres/commit/154b413f4b06ea939d7b0cbfbba34cb2d5de34db),
  [`32b1894`](https://github.com/eigilsagafos/valdres/commit/32b18943331cbf0fd420181eb3920a8fb611d940),
  [`02e65c7`](https://github.com/eigilsagafos/valdres/commit/02e65c75328d88947e314933ca211c3da4dec9b7),
  [`826fff9`](https://github.com/eigilsagafos/valdres/commit/826fff9d691bb3798504593abb03c6639580e4d0),
  [`8416094`](https://github.com/eigilsagafos/valdres/commit/8416094d5edfe8dbce5b0e5966ceaeb7442cf118),
  [`0b3fb58`](https://github.com/eigilsagafos/valdres/commit/0b3fb58ad8dfc2a88dacddade17ee03a8177cdb9),
  [`7d135d7`](https://github.com/eigilsagafos/valdres/commit/7d135d74e89e74b168459de6c08e417a2db2ce75),
  [`f672be4`](https://github.com/eigilsagafos/valdres/commit/f672be49cd3cfc2fd0e0b8ae069d8c46f34dcb94),
  [`756fd96`](https://github.com/eigilsagafos/valdres/commit/756fd96a31119c72ae4eb69d3b3ca35e1efc8bbc),
  [`492af67`](https://github.com/eigilsagafos/valdres/commit/492af67409130b347ca133198c9bd82e4256ae83),
  [`84d73fc`](https://github.com/eigilsagafos/valdres/commit/84d73fcf6083cd39dfc914b0f2b89328d4ceff7e),
  [`dddcafd`](https://github.com/eigilsagafos/valdres/commit/dddcafd33a35e7d14934dfb508bbbf4a583922bb),
  [`348aa80`](https://github.com/eigilsagafos/valdres/commit/348aa80c882ef3f566f800d2c1ea950af28e8814),
  [`f8bf47e`](https://github.com/eigilsagafos/valdres/commit/f8bf47e829ec22e217f5d996dbb8d7bff3ad4af6),
  [`2697ce5`](https://github.com/eigilsagafos/valdres/commit/2697ce5965b0f8f4f97ce0d9659a553ee2c8fa19),
  [`9123fef`](https://github.com/eigilsagafos/valdres/commit/9123fef350a0816a3073fa67e8a738616290b6be)]:
    - valdres@1.0.0-beta.18
    - @valdres/browser-keyboard@1.0.0-beta.7

## 1.0.0-beta.5

### Patch Changes

- [#243](https://github.com/eigilsagafos/valdres/pull/243)
  [`b7536ab`](https://github.com/eigilsagafos/valdres/commit/b7536ab3bf4e2face50dda54a232242dd87a02f0)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Compare
  ArrayBuffer, SharedArrayBuffer, DataView, and typed-array values by their
  visible bytes, fixing unequal buffers being treated as equal and DataView
  comparisons hanging.

    Development deep-freezing now rejects mutable built-ins and host objects
    with an actionable `{ mutable: true }` requirement instead of throwing
    native typed-array errors or leaving Map, Set, Date, and binary contents
    mutable behind a frozen facade. The explicit opt-out is available on atoms
    and selectors; Error objects and Promise handles remain supported.

- Updated dependencies
  [[`c8faa24`](https://github.com/eigilsagafos/valdres/commit/c8faa244800025ddd1756c6a17386ef84906a25e),
  [`ca00a89`](https://github.com/eigilsagafos/valdres/commit/ca00a896025a42bf31528e505234a7bb929f292c),
  [`9ba01a1`](https://github.com/eigilsagafos/valdres/commit/9ba01a10dc4350247dec174b2ea0bdf99ed72942),
  [`20b253f`](https://github.com/eigilsagafos/valdres/commit/20b253fe91007ae8961ecc423b2d27c9420c68c7),
  [`967bb03`](https://github.com/eigilsagafos/valdres/commit/967bb038855fe0d032cf3bd6f7810ad952d75e30),
  [`888f868`](https://github.com/eigilsagafos/valdres/commit/888f868246adadac653517755c04821afc75d5cd),
  [`cdcb6a2`](https://github.com/eigilsagafos/valdres/commit/cdcb6a2bdd615d7ba04e32f43c68ed1551276eec),
  [`9278b66`](https://github.com/eigilsagafos/valdres/commit/9278b6635ebde1df9f4320e474ce54b41a0a64d9),
  [`2d31b16`](https://github.com/eigilsagafos/valdres/commit/2d31b162fd2875cbb264620d59ce01a925cc1794),
  [`e584913`](https://github.com/eigilsagafos/valdres/commit/e5849132a360c6224fbc66ed1236ddfc3f1fdbcc),
  [`01529e5`](https://github.com/eigilsagafos/valdres/commit/01529e523bbf26df6e3c188c052c44ef64303ec8),
  [`7a59614`](https://github.com/eigilsagafos/valdres/commit/7a596146a8cdf64907ceb45871a60c56fc0391aa),
  [`2556617`](https://github.com/eigilsagafos/valdres/commit/255661708bd27cad9581cf0e47c5c8610fc86c8b),
  [`27340c5`](https://github.com/eigilsagafos/valdres/commit/27340c5e250e0fdf313e670c506cd209b229b9d1),
  [`ebbaff5`](https://github.com/eigilsagafos/valdres/commit/ebbaff5ec885a82d45c01badabd2f89e430a1f5f),
  [`8d882e0`](https://github.com/eigilsagafos/valdres/commit/8d882e0993aa3ed87a27840accb91d261d0f0244),
  [`4648c40`](https://github.com/eigilsagafos/valdres/commit/4648c40c3ec3c6ab67b7d1d8b47f2b0a3762980e),
  [`f0e657c`](https://github.com/eigilsagafos/valdres/commit/f0e657cc569b652ae3c27e5ad7c0a6f09e11543f),
  [`26064d2`](https://github.com/eigilsagafos/valdres/commit/26064d2945be405a6f3909445b1da72f2f6c7158),
  [`d11de95`](https://github.com/eigilsagafos/valdres/commit/d11de95881d0548fbf47add4a942aecb8fef6b0c),
  [`2100bb3`](https://github.com/eigilsagafos/valdres/commit/2100bb35c138e4b145938bfdd3630fcb3468e9c4),
  [`b7536ab`](https://github.com/eigilsagafos/valdres/commit/b7536ab3bf4e2face50dda54a232242dd87a02f0),
  [`eafa72c`](https://github.com/eigilsagafos/valdres/commit/eafa72c78d41b6fcc2ae321244fecb26209a1410),
  [`b8a82e5`](https://github.com/eigilsagafos/valdres/commit/b8a82e512f446f5f80970573cb0a8986392ddcdf),
  [`8c2531c`](https://github.com/eigilsagafos/valdres/commit/8c2531cef47d199cdcdb163347498029ad4fab05),
  [`2046b87`](https://github.com/eigilsagafos/valdres/commit/2046b87f254666909528912a2dade380bd16b864),
  [`2d21f06`](https://github.com/eigilsagafos/valdres/commit/2d21f06a66277e760e65de57b3f8b528d3ed9cc6),
  [`5dcd530`](https://github.com/eigilsagafos/valdres/commit/5dcd5309381f4f78f87038bd638ee9b3ce22bc5e),
  [`f092e71`](https://github.com/eigilsagafos/valdres/commit/f092e71eb3604c57552ced5058693766732330eb),
  [`165cdc4`](https://github.com/eigilsagafos/valdres/commit/165cdc4346091f860c193a686f4ea55e1e955671)]:
    - valdres@1.0.0-beta.17
    - @valdres/browser-keyboard@1.0.0-beta.6

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies
  [[`67536e7`](https://github.com/eigilsagafos/valdres/commit/67536e7f177d46278b7324a56b2eecf738b1c86f),
  [`0b3dbb7`](https://github.com/eigilsagafos/valdres/commit/0b3dbb7214d640beac5c1aead9d89e45d732e4fd),
  [`ce638b0`](https://github.com/eigilsagafos/valdres/commit/ce638b0ba3871b2ba1536589da482670822c3585),
  [`a0c959a`](https://github.com/eigilsagafos/valdres/commit/a0c959a1d41bc7041a69c87c651a6e7f5587d9ca),
  [`4d57212`](https://github.com/eigilsagafos/valdres/commit/4d572129587e801ebea26c00f1e8f581b78f5035),
  [`59fab53`](https://github.com/eigilsagafos/valdres/commit/59fab53ed00b411ca3ad331f92f49c1c34fb7ae2)]:
    - valdres@1.0.0-beta.9
    - @valdres/browser-keyboard@1.0.0-beta.5

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies
  [[`affd12b`](https://github.com/eigilsagafos/valdres/commit/affd12b3845e355b71739cd7d577f5e2af5af74a),
  [`4ccd1af`](https://github.com/eigilsagafos/valdres/commit/4ccd1af8b24c69f725677222d99d055421352822),
  [`231e59d`](https://github.com/eigilsagafos/valdres/commit/231e59d15dabb8fd822e0803e93ffad0f0d0138a),
  [`b76cdc2`](https://github.com/eigilsagafos/valdres/commit/b76cdc27414abf4c55bb6dfbc9c1c5d370af8f1d),
  [`2776bff`](https://github.com/eigilsagafos/valdres/commit/2776bffa8deee3f2bc651c757aa19e788339fbfc),
  [`68b124d`](https://github.com/eigilsagafos/valdres/commit/68b124d4f191431cd608ff04ba5c5fb15429f205)]:
    - valdres@1.0.0-beta.7
    - @valdres/browser-keyboard@1.0.0-beta.4

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies
  [[`fde2ec1`](https://github.com/eigilsagafos/valdres/commit/fde2ec1aa4da44a9f3fddddd5b7c7c03eeaba796),
  [`6fef9c9`](https://github.com/eigilsagafos/valdres/commit/6fef9c9fc8a8a481dbacce2768bc09e413f80bdf),
  [`f32eb3e`](https://github.com/eigilsagafos/valdres/commit/f32eb3ef0092e7756e89eb5b3944f091726401e4)]:
    - valdres@1.0.0-beta.5
    - @valdres/browser-keyboard@1.0.0-beta.3

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies
  [[`f1afcc6`](https://github.com/eigilsagafos/valdres/commit/f1afcc6593854b86f9ae7387a8c00493f68a8ff7),
  [`73c2c8f`](https://github.com/eigilsagafos/valdres/commit/73c2c8f4528f1e8ddad331dd0017eeb7ca01c5ec),
  [`396a061`](https://github.com/eigilsagafos/valdres/commit/396a06183089ef4377a69f9580e30e025a1b7218),
  [`89838ee`](https://github.com/eigilsagafos/valdres/commit/89838eea5a65c161fb8d294d48257f3ba7602122),
  [`979fa2c`](https://github.com/eigilsagafos/valdres/commit/979fa2c8e6038f25eb820e15f2d12730e153f39b),
  [`8393f22`](https://github.com/eigilsagafos/valdres/commit/8393f22a408b886a6ff83179eba65cd3a6da1513),
  [`ab18cae`](https://github.com/eigilsagafos/valdres/commit/ab18cae6b96885c9afd2cfd81fc6336f7a7788d6),
  [`69b0e6d`](https://github.com/eigilsagafos/valdres/commit/69b0e6da6c1c6a62e900d9e48d13d75340764982),
  [`fa8db1b`](https://github.com/eigilsagafos/valdres/commit/fa8db1b83675544d68cba2000df708b606f54511),
  [`f8a555a`](https://github.com/eigilsagafos/valdres/commit/f8a555a1b99139f63b16c737f9b49e6aee60fc2f),
  [`9f011c9`](https://github.com/eigilsagafos/valdres/commit/9f011c915d4c8a1fbb2b3e886014890444e93afc),
  [`37c9afa`](https://github.com/eigilsagafos/valdres/commit/37c9afae8c6aae6b0f4e9a2b8b38b32d3c3ca7bd),
  [`0f3ce03`](https://github.com/eigilsagafos/valdres/commit/0f3ce03669b3ac92b26d1d047e850b6005a924fe)]:
    - valdres@1.0.0-beta.4
    - @valdres/browser-keyboard@1.0.0-beta.2

## 0.3.0-beta.0

### Minor Changes

- [#123](https://github.com/eigilsagafos/valdres/pull/123)
  [`ca1f266`](https://github.com/eigilsagafos/valdres/commit/ca1f266b1af0970161584da3cc0c1271a2c97ba2)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix `workspace:^`
  leaking into published manifests. The previous beta releases shipped with
  literal `"valdres": "workspace:^"` in their `dependencies`, which npm cannot
  resolve. Changesets only rewrites pinned workspace specs (e.g.
  `workspace:^1.2.3`), and `changeset publish` shells out to `npm publish` —
  which doesn't understand the workspace protocol — so the bare shortcut got
  published verbatim. Publishable packages now use plain semver ranges for
  inter-package deps; changesets keeps them in lockstep on every bump, and
  `verify-publish` fails CI if any `workspace:` reference sneaks back in.

    The six Lerna-era packages still on the `pre` dist-tag
    (`@valdres/color-mode`, `@valdres/hotkeys`, `@valdres-react/color-mode`,
    `@valdres-react/draggable`, `@valdres-react/hotkeys`,
    `@valdres-react/panable`) get a `minor` bump so they land on `0.3.0-beta.0`
    — a clean transition from the old `0.2.0-pre.28` line to the unified `beta`
    dist-tag.

### Patch Changes

- Updated dependencies
  [[`ca1f266`](https://github.com/eigilsagafos/valdres/commit/ca1f266b1af0970161584da3cc0c1271a2c97ba2)]:
    - valdres@1.0.0-beta.1
    - @valdres/browser-keyboard@1.0.0-beta.1

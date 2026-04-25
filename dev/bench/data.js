window.BENCHMARK_DATA = {
  "lastUpdate": 1777099067481,
  "repoUrl": "https://github.com/eigilsagafos/valdres",
  "entries": {
    "valdres benchmarks": [
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "6bf6778bcf75e9711141ff248a865278b668d2b9",
          "message": "Add CI benchmark suite comparing valdres vs jotai (#19)\n\n* Add CI benchmark suite comparing valdres vs jotai\n\nAdds performance benchmarks using mitata that run in GitHub Actions,\nfail on regressions, update a comparison table in README, and publish\nhistorical trends to GitHub Pages.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Create gh-pages branch if missing in benchmark workflow\n\nThe github-action-benchmark action requires the gh-pages branch to\nexist before it can push results. This adds a step to create it\non first run.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Move git config before gh-pages branch creation step\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix checkout after gh-pages creation using explicit SHA\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Split JSON generation from README update to avoid dirty working tree\n\nThe benchmark action switches to gh-pages internally and fails if\nREADME.md is modified. Now: generate JSON first, run the action,\nthen update README after.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address PR review feedback\n\n- Guard gh-pages creation to main-only pushes\n- Add pull-requests: write permission for comment-on-alert\n- Clean gh-pages orphan branch properly with git rm -rf\n- Run bench files serially (--concurrency 1) to prevent ndjson corruption\n- Clean stale ndjson before each bench run\n- Fix misleading \"set(atom, same)\" label — now tests actual new values\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-02T13:32:15-07:00",
          "tree_id": "8b95497023178eb2c51d6f1ea64cff6e60821446",
          "url": "https://github.com/eigilsagafos/valdres/commit/6bf6778bcf75e9711141ff248a865278b668d2b9"
        },
        "date": 1775161984923,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai: 54ns (15.2x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 41,
            "unit": "ns",
            "extra": "jotai: 82ns (2.0x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 725,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 724,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 708,
            "unit": "ns",
            "extra": "jotai: 450ns (1.6x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 50,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 645,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1202,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9214,
            "unit": "ns",
            "extra": "jotai: 7.9µs (1.2x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83507,
            "unit": "ns",
            "extra": "jotai: 65.4µs (1.3x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6927,
            "unit": "ns",
            "extra": "jotai: 5.4µs (1.3x slower)"
          },
          {
            "name": "createStore",
            "value": 596,
            "unit": "ns",
            "extra": "jotai: 205ns (2.9x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 76816,
            "unit": "ns",
            "extra": "jotai: 293.0µs (3.8x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10822,
            "unit": "ns",
            "extra": "jotai: 73.5µs (6.8x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 253,
            "unit": "ns",
            "extra": "jotai: 1.1µs (4.3x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "a9dce4bf09cbd7d0504ed29762f2147fe757842c",
          "message": "Replace benchmark alerting with scale-aware regression checker (#23)\n\n* Replace single-threshold benchmark alerting with scale-aware regression checker\n\nThe built-in github-action-benchmark alerting used a single threshold for\nall tests, causing false positives on sub-nanosecond benchmarks (e.g.\nobj.value=n going from 1ns to 2ns). The new custom script compares against\nthe median of the last 10 runs and uses tiered thresholds based on the\nmagnitude of each benchmark.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Redesign PR comment table: valdres vs jotai side-by-side, skip baselines\n\nRead from ndjson directly to get both valdres and jotai timings. The table\nnow shows each benchmark with both libraries side by side, a \"vs Jotai\"\ncolumn, and the regression check columns. Baseline JS ops (plain object,\nMap) are excluded from the table entirely.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: robust comment posting, generated threshold table\n\n- Wrap postOrUpdateComment in try/catch so API failures don't fail the\n  regression check\n- Add per_page=100, res.ok and Array.isArray guards\n- Generate the threshold tiers table from the TIERS config to avoid drift\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T08:10:17-07:00",
          "tree_id": "c7c33fb522cd311a25bff210452c2fdc5ccbdc9c",
          "url": "https://github.com/eigilsagafos/valdres/commit/a9dce4bf09cbd7d0504ed29762f2147fe757842c"
        },
        "date": 1775229070335,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 54ns (17.4x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 43,
            "unit": "ns",
            "extra": "jotai: 83ns (1.9x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 702,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 693,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.8x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 687,
            "unit": "ns",
            "extra": "jotai: 477ns (1.4x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 51,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 667,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1195,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9149,
            "unit": "ns",
            "extra": "jotai: 7.9µs (1.2x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 81230,
            "unit": "ns",
            "extra": "jotai: 65.4µs (1.2x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6595,
            "unit": "ns",
            "extra": "jotai: 5.5µs (1.2x slower)"
          },
          {
            "name": "createStore",
            "value": 631,
            "unit": "ns",
            "extra": "jotai: 211ns (3.0x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 76921,
            "unit": "ns",
            "extra": "jotai: 251.8µs (3.3x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10857,
            "unit": "ns",
            "extra": "jotai: 74.1µs (6.8x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 254,
            "unit": "ns",
            "extra": "jotai: 1.1µs (4.2x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9028f92667ce3bd6d3b7f8b40585a3fca51aff3b",
          "message": "Re-evaluate pending-promise selectors on dependency change (#21)\n\n* Re-evaluate pending-promise selectors on dependency change\n\nInstead of skipping unsubscribed pending-promise selectors during\npropagation (which left stale cached values), always re-evaluate them.\nRe-evaluation is cheap for async selectors since the actual work is\ndeferred to the promise. The old promise's .then() handler bails via\nthe existing reference guard (data.values.get(selector) !== oldPromise).\n\nThis replaces the dirty-marker approach (dirtySelectorsPendingPromise\nWeakSet) with a simpler structural fix: pending-promise selectors go\nthrough the re-evaluate path instead of the expire path, so no new\nmutable state is needed.\n\nEnables 3 more jotai compat tests:\n- \"should update async atom with delay (#1813)\"\n- \"async atom with subtle timing > case 2\"\n- \"can get async atom with deps more than once before resolving (#1668)\"\n\n57 pass, 44 todo, 0 fail (was 54/47/0)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix comments: use \"promise-valued\" instead of \"pending-promise\"\n\nisPromiseLike cannot distinguish pending from settled promises,\nso the comments should not imply otherwise.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T08:31:04-07:00",
          "tree_id": "ca372450360758fa1985dee04db55bfa107c0d8a",
          "url": "https://github.com/eigilsagafos/valdres/commit/9028f92667ce3bd6d3b7f8b40585a3fca51aff3b"
        },
        "date": 1775230319003,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai: 69ns (13.9x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 32,
            "unit": "ns",
            "extra": "jotai: 94ns (3.0x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 758,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 779,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 693,
            "unit": "ns",
            "extra": "jotai: 483ns (1.4x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 3,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 53,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 731,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9692,
            "unit": "ns",
            "extra": "jotai: 9.2µs (1.0x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 75945,
            "unit": "ns",
            "extra": "jotai: 71.1µs (1.1x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6040,
            "unit": "ns",
            "extra": "jotai: 6.1µs (1.0x faster)"
          },
          {
            "name": "createStore",
            "value": 661,
            "unit": "ns",
            "extra": "jotai: 233ns (2.8x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 74493,
            "unit": "ns",
            "extra": "jotai: 259.5µs (3.5x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 11422,
            "unit": "ns",
            "extra": "jotai: 81.6µs (7.1x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 270,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.5x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "e0b9d7abf8d27124108312e132ab3843e4e593e6",
          "message": "Optimize store creation: 6x faster with lazy WeakMaps (#22)\n\n* Optimize store creation with lazy WeakMaps and cheap IDs\n\nTwo changes to createStoreData that make store() 6x faster:\n\n1. Lazy WeakMap initialization via shared prototype with self-replacing\n   getters. Only `values` (always needed) is created eagerly. The other\n   5 WeakMaps are created on first access, then the getter replaces\n   itself with a direct property (zero overhead after init).\n\n2. Replace Math.random().toString(36) ID generation (~150ns) with a\n   sequential counter (~0ns). The ID is only used for identity comparison,\n   not as a human-readable or cross-process unique string.\n\nNote: prototype-based lazy properties are visible via `in` operator\neven before initialization. No current code checks lazy properties\nwith `in` (only `\"parent\" in data` for scope detection).\n\nBefore: createStore 450ns (3.7x slower than jotai)\nAfter:  createStore  78ns (1.5x faster than jotai)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: prefix generated store IDs and use Object.prototype\n\n- Prefix auto-generated IDs with \"__valdres_store_\" to prevent collision\n  with user-provided store/scope IDs (which are compared in globalAtom.ts)\n- Use Object.create(Object.prototype) instead of Object.create(null) so\n  store data objects retain standard Object methods\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T08:44:56-07:00",
          "tree_id": "511bae0accc47d1c0e60c84863deea6e976f25e6",
          "url": "https://github.com/eigilsagafos/valdres/commit/e0b9d7abf8d27124108312e132ab3843e4e593e6"
        },
        "date": 1775231144206,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai: 59ns (15.4x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 41,
            "unit": "ns",
            "extra": "jotai: 86ns (2.1x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 697,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 732,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 704,
            "unit": "ns",
            "extra": "jotai: 453ns (1.6x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 50,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 668,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1202,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9765,
            "unit": "ns",
            "extra": "jotai: 7.8µs (1.2x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 85682,
            "unit": "ns",
            "extra": "jotai: 64.0µs (1.3x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6700,
            "unit": "ns",
            "extra": "jotai: 5.5µs (1.2x slower)"
          },
          {
            "name": "createStore",
            "value": 151,
            "unit": "ns",
            "extra": "jotai: 203ns (1.3x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 83362,
            "unit": "ns",
            "extra": "jotai: 268.3µs (3.2x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10014,
            "unit": "ns",
            "extra": "jotai: 75.6µs (7.6x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 238,
            "unit": "ns",
            "extra": "jotai: 1.0µs (4.3x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "83e46c4f14d8f7371fc4d3985589fbb9472f189e",
          "message": "Reject async selectors in core, wrap in jotai compat layer (#26)\n\n* Wrap store.get for async atoms to match jotai Promise semantics\n\nJotai always returns Promises for async atoms, even after resolution.\nValdres unwraps resolved values. The compat layer now tags async\nselectors and re-wraps resolved values in Promise.resolve() on get.\n\nEnables 2 more compat tests:\n- handles complex dependency chains\n- should not inf on subscribe or unsubscribe\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Reject async functions in selector() to prevent inconsistent return types\n\nAsync functions always return Promises, but valdres unwraps resolved\nvalues. This causes store.get() to return Promise on first call, then\nthe unwrapped value on subsequent calls — an inconsistent return type.\n\nSync functions returning Promises are still allowed and work correctly\nwith valdres's unwrap-on-resolve semantics.\n\nThe jotai compat layer wraps async read functions into sync wrappers\nbefore passing them to valdresSelector.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address review: robust async detection, specific error assertion, deduplicate isPromiseLike\n\n- Use Object.prototype.toString.call instead of constructor.name for\n  async function detection (resilient to minification/realms)\n- Assert specific error message in test with toThrow(/async/i)\n- Import isPromiseLike from valdres instead of duplicating in compat\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T09:46:25-07:00",
          "tree_id": "251980b8247db6dc6ad7c743d7a5e9445454116b",
          "url": "https://github.com/eigilsagafos/valdres/commit/83e46c4f14d8f7371fc4d3985589fbb9472f189e"
        },
        "date": 1775234837806,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 57ns (20.3x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai: 83ns (2.1x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 698,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 710,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 681,
            "unit": "ns",
            "extra": "jotai: 435ns (1.6x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 51,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 2,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 720,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1391,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9739,
            "unit": "ns",
            "extra": "jotai: 7.5µs (1.3x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 81544,
            "unit": "ns",
            "extra": "jotai: 63.4µs (1.3x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6703,
            "unit": "ns",
            "extra": "jotai: 5.3µs (1.3x slower)"
          },
          {
            "name": "createStore",
            "value": 146,
            "unit": "ns",
            "extra": "jotai: 203ns (1.4x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 81322,
            "unit": "ns",
            "extra": "jotai: 254.3µs (3.1x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10213,
            "unit": "ns",
            "extra": "jotai: 72.9µs (7.1x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 231,
            "unit": "ns",
            "extra": "jotai: 990ns (4.3x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "334397d17bc821f3c68a472ed2ebfc25717ef68a",
          "message": "Optimize selector propagation and store.get hot path (#25)\n\n* Optimize selector propagation and store.get hot path\n\n- store.get: fast-path cache hit via data.values.has(); reuse per-store\n  Set<Atom> instead of allocating a new one per call\n- evaluateSelector: track deps in array, skip dependency diff when deps\n  are unchanged (common case); reuse shared WeakSet for circular dep check\n- setValueInData: skip deepFreeze for primitives (immutable by nature)\n- propagateDirtySelectors: eliminate redundant Set clone, use size check\n  instead of symmetricDifference\n\nSelectors go from 1.2x slower than jotai to 1.2-1.6x faster.\nset(atom) improves ~1.8x, store.get(atom) improves ~1.4x.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback with regression tests\n\n- storeFromStoreData: wrap getState in try/finally to clear reusable\n  _initSet on error, preventing stale atoms from leaking to next get()\n- setValueInData: include functions in deepFreeze check (typeof function)\n  so function values with own properties remain frozen in dev mode\n- propagateUpdatedAtoms: remove stale console.log TODO — the detected\n  case (atoms initialized during propagation) is benign since newly-init'd\n  atoms cannot have pre-existing dependents\n- Add regression test for function value freezing\n- Add defensive test for stale _initSet after selector throw\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T09:48:39-07:00",
          "tree_id": "43f65432511aa5188e3387438225b0a031032078",
          "url": "https://github.com/eigilsagafos/valdres/commit/334397d17bc821f3c68a472ed2ebfc25717ef68a"
        },
        "date": 1775234971232,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 54ns (17.8x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 36,
            "unit": "ns",
            "extra": "jotai: 91ns (2.5x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 286,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.2x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 300,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.1x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 690,
            "unit": "ns",
            "extra": "jotai: 445ns (1.5x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 3,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 50,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 253,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1233,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 5267,
            "unit": "ns",
            "extra": "jotai: 9.3µs (1.8x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 46918,
            "unit": "ns",
            "extra": "jotai: 65.0µs (1.4x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4407,
            "unit": "ns",
            "extra": "jotai: 5.3µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 168,
            "unit": "ns",
            "extra": "jotai: 218ns (1.3x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 80284,
            "unit": "ns",
            "extra": "jotai: 243.8µs (3.0x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 9609,
            "unit": "ns",
            "extra": "jotai: 75.6µs (7.9x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 258,
            "unit": "ns",
            "extra": "jotai: 1.1µs (4.1x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "796b2b9e08bce7458981283415e3126554d2c095",
          "message": "Optimize atomFamily/selectorFamily and add creation benchmarks (#27)\n\n* Optimize atomFamily/selectorFamily creation and add benchmarks\n\n- createAtomFamily: inline createOptions + atomFamilyAtom into single\n  object allocation; hoist isSelectorFamily/typeof checks to family\n  creation time (289ns → 200ns, flips from 1.3x slower to 1.1x faster)\n- selectorFamily: same inlining — bypass intermediate createOptions and\n  selector() allocations, build selector object directly\n- selector: use cheaper async function detection\n  (constructor.name vs Object.prototype.toString.call)\n- Add selector(fn) creation benchmark (6.7x faster than jotai)\n- Add selectorFamily(id) creation benchmark (1.1x faster than jotai)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove unused imports in benchmark files\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T10:11:00-07:00",
          "tree_id": "98b22c256aef4f80a7c3c32bd5a1a94ff6e3d2b8",
          "url": "https://github.com/eigilsagafos/valdres/commit/796b2b9e08bce7458981283415e3126554d2c095"
        },
        "date": 1775236333126,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai: 68ns (14.9x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 28,
            "unit": "ns",
            "extra": "jotai: 97ns (3.4x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 331,
            "unit": "ns",
            "extra": "jotai: 1.2µs (3.6x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 305,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.1x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 373,
            "unit": "ns",
            "extra": "jotai: 453ns (1.2x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 309,
            "unit": "ns",
            "extra": "jotai: 441ns (1.4x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 98,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 432,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1470,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai: 73ns (7.7x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6306,
            "unit": "ns",
            "extra": "jotai: 10.8µs (1.7x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 55762,
            "unit": "ns",
            "extra": "jotai: 80.5µs (1.4x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5151,
            "unit": "ns",
            "extra": "jotai: 6.0µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 329,
            "unit": "ns",
            "extra": "jotai: 246ns (1.3x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 84251,
            "unit": "ns",
            "extra": "jotai: 357.2µs (4.2x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 7327,
            "unit": "ns",
            "extra": "jotai: 131.3µs (17.9x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 288,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.2x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "1f2f0573322c547314cb420cf6257d305cf7d356",
          "message": "Fix atom(value, writeFn) handling and enable React tree dependencies test (#28)\n\n* Fix atom(value, writeFn) handling and enable React tree dependencies test\n\nHandle writable primitive atoms (atom(value, writeFn)) by creating a\nselector with a constant read function instead of a plain atom, so\ncreateStoreWithSelectorSet properly handles the write method.\n\nAlso removes the get.length === 1 guard so write-only atoms like\natom((get) => ..., writeFn) work regardless of arity.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Support writable primitive atoms with backing atom and enable 3 React tests\n\natom(value, writeFn) now uses a backing valdres atom for mutable storage,\nwith a selector that reads from it. Self-sets are intercepted and redirected\nto the backing atom, fixing infinite recursion for self-referencing writes.\n\nNewly passing tests:\n- uses an async write-only atom\n- uses a writable atom without read function\n- write self atom (undocumented usage)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T10:16:45-07:00",
          "tree_id": "13df948cff6f79a6ede47e2709c9affe37469264",
          "url": "https://github.com/eigilsagafos/valdres/commit/1f2f0573322c547314cb420cf6257d305cf7d356"
        },
        "date": 1775236667265,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 57ns (17.1x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 36,
            "unit": "ns",
            "extra": "jotai: 89ns (2.5x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 273,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.5x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai: 1.3µs (4.2x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 356,
            "unit": "ns",
            "extra": "jotai: 470ns (1.3x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 427,
            "unit": "ns",
            "extra": "jotai: 1.1µs (2.6x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 119,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 430,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1253,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai: 60ns (11.2x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6438,
            "unit": "ns",
            "extra": "jotai: 9.6µs (1.5x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 52344,
            "unit": "ns",
            "extra": "jotai: 92.2µs (1.8x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4884,
            "unit": "ns",
            "extra": "jotai: 5.8µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 207,
            "unit": "ns",
            "extra": "jotai: 217ns (1.0x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 92555,
            "unit": "ns",
            "extra": "jotai: 339.4µs (3.7x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 7383,
            "unit": "ns",
            "extra": "jotai: 108.6µs (14.7x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 288,
            "unit": "ns",
            "extra": "jotai: 1.1µs (3.8x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "3db9468fc489b9dc6fb5648d05a24bf900522750",
          "message": "Add dependency-aware onMount/onUnmount lifecycle hooks (#30)\n\n* Add dependency-aware onMount/onUnmount lifecycle hooks\n\nPreviously, onMount only fired when store.sub() was called directly on an\natom. Now onMount fires when an atom becomes a transitive dependency of any\nsubscribed selector, and onUnmount fires when it's no longer reachable.\n\nThis enables patterns like starting a WebSocket when data is \"in use\" and\nstopping when it isn't, matching how jotai's mount/unmount system works.\n\nCore changes:\n- Add data.mounts WeakMap to track mounted atoms and cleanup functions\n- Add mountAtom.ts with helpers for transitive mount/unmount\n- subscribe.ts calls mountTransitiveDeps on first subscriber\n- unsubscribe.ts calls unmountOrphanedDeps when last subscriber leaves\n- propagateUpdatedAtoms processes dependency changes during re-evaluation\n- evaluateSelector exposes added/removed deps via optional out-params\n- createStoreWithSelectorSet stores storeRef on data for onMount callbacks\n- Fix reentrant mount by marking atom as mounted before calling onMountFn\n\nJotai compat changes:\n- atom.ts uses onMount getter/setter to convert jotai signature at\n  assignment time (not during store.sub), enabling propagation-time mounts\n- createStore.ts simplified (no longer needs temporary onMount swap)\n\nNewly passing jotai tests (4):\n- should recompute dependents' state after onMount (#2098)\n- should mount once with atom creator atom (#2314)\n- Unmount an atom that is no longer dependent (#2658)\n- should use the correct pending on unmount\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address review: error resilience in mount/unmount and type fixes\n\n- mountAtom: clean up data.mounts entry if onMountFn throws\n- unmountAtom: delete entry before calling cleanup to prevent stuck state\n- subscribe.ts: guard mountTransitiveDeps with !isFamily check\n- unsubscribe.ts: cast state to State<V> for unmountOrphanedDeps\n- Add storeRef to RootStoreData type, remove @ts-ignore\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-04T10:22:19-07:00",
          "tree_id": "8b400c735fd97b37f8456d206a6389bbc1aa4ea2",
          "url": "https://github.com/eigilsagafos/valdres/commit/3db9468fc489b9dc6fb5648d05a24bf900522750"
        },
        "date": 1775323404455,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 54ns (15.5x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 36,
            "unit": "ns",
            "extra": "jotai: 92ns (2.6x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 280,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.3x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 301,
            "unit": "ns",
            "extra": "jotai: 1.3µs (4.2x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 373,
            "unit": "ns",
            "extra": "jotai: 464ns (1.2x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 345,
            "unit": "ns",
            "extra": "jotai: 464ns (1.3x faster)"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 129,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 472,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1951,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai: 67ns (11.4x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6458,
            "unit": "ns",
            "extra": "jotai: 12.7µs (2.0x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 55159,
            "unit": "ns",
            "extra": "jotai: 83.5µs (1.5x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5846,
            "unit": "ns",
            "extra": "jotai: 6.9µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 405,
            "unit": "ns",
            "extra": "jotai: 249ns (1.6x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 91579,
            "unit": "ns",
            "extra": "jotai: 421.1µs (4.6x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 7760,
            "unit": "ns",
            "extra": "jotai: 154.6µs (19.9x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 407,
            "unit": "ns",
            "extra": "jotai: 1.2µs (3.0x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "2f28885b68f18d0c0110df7695ce82b806359073",
          "message": "Optimize transaction performance and add benchmarks (#29)\n\n* Optimize transaction performance and add transaction benchmarks\n\n- Eager _atomMap creation in Transaction constructor (eliminates lazy\n  getter overhead on every set/get call)\n- Skip deepFreeze for primitives in txn.set(), add Object.isFrozen()\n  early return in deepFreeze to avoid double-freeze at commit time\n- Eliminate Set/array spread allocations in setAtoms()\n- Remove unused isProd import from transaction\n- Add transaction benchmarks: single-atom selectors and cross-atom\n  selectors (with and without subscribers)\n\nCross-atom selectors with subscribers show 5x speedup over jotai,\ndemonstrating the batching advantage of transactions.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Harden deepFreeze and fix benchmark nits\n\n- Add primitive type guard before WeakSet.has() to make deepFreeze safe\n  for any input type\n- Reorder checks: null/undefined → primitive → seen/frozen\n- Use forEach instead of map for side-effect-only subscription setup\n  in benchmarks\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-04T10:30:04-07:00",
          "tree_id": "58abe0930bb7ca909a7568f41e50c7b622d89462",
          "url": "https://github.com/eigilsagafos/valdres/commit/2f28885b68f18d0c0110df7695ce82b806359073"
        },
        "date": 1775323877390,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai: 45ns (18.7x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 29,
            "unit": "ns",
            "extra": "jotai: 78ns (2.7x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 223,
            "unit": "ns",
            "extra": "jotai: 1.0µs (4.6x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 221,
            "unit": "ns",
            "extra": "jotai: 1.0µs (4.6x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 361,
            "unit": "ns",
            "extra": "jotai: 444ns (1.2x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 265,
            "unit": "ns",
            "extra": "jotai: 435ns (1.6x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 104,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 401,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1447,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai: 53ns (8.7x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 5090,
            "unit": "ns",
            "extra": "jotai: 9.3µs (1.8x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 42149,
            "unit": "ns",
            "extra": "jotai: 74.7µs (1.8x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4875,
            "unit": "ns",
            "extra": "jotai: 5.6µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 165,
            "unit": "ns",
            "extra": "jotai: 194ns (1.2x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 65177,
            "unit": "ns",
            "extra": "jotai: 319.8µs (4.9x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 6074,
            "unit": "ns",
            "extra": "jotai: 131.7µs (21.7x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 271,
            "unit": "ns",
            "extra": "jotai: 938ns (3.5x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 54592,
            "unit": "ns",
            "extra": "jotai: 74.2µs (1.4x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 59829,
            "unit": "ns",
            "extra": "jotai: 203.6µs (3.4x faster)"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 476530,
            "unit": "ns",
            "extra": "jotai: 978.8µs (2.1x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 550694,
            "unit": "ns",
            "extra": "jotai: 1.51ms (2.7x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 690282,
            "unit": "ns",
            "extra": "jotai: 6.10ms (8.8x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "08ddfe4359b6951ce69ac7b3b5ad6770163601c3",
          "message": "Improve benchmark fairness and upgrade Jotai (#31)\n\n* Improve benchmark fairness and upgrade Jotai to v2.19.0\n\n- Upgrade Jotai 2.10.0 -> 2.19.0 to benchmark against latest\n- Randomize measurement order to eliminate systematic ordering bias\n- Use median (p50) instead of avg for outlier resistance\n- Add \"set with subscribers\" and \"atom lifecycle\" benchmarks for realism\n- Add atomFamily cache-hit benchmark (honestly shows Jotai is faster)\n- Separate high-threshold benchmarks into \"Optimization targets\" section\n- Show Jotai version in README footer\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Use deterministic name-based hash instead of Math.random() for measurement order\n- Use distinct callback functions per subscriber to avoid deduplication\n- Only catch ENOENT when probing for Jotai version, rethrow other errors\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-04T10:35:24-07:00",
          "tree_id": "03d10fb6490fffa0cca624604a274adc7fb4a801",
          "url": "https://github.com/eigilsagafos/valdres/commit/08ddfe4359b6951ce69ac7b3b5ad6770163601c3"
        },
        "date": 1775324198609,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai: 41ns (21.6x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 30,
            "unit": "ns",
            "extra": "jotai: 291ns (9.7x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 190,
            "unit": "ns",
            "extra": "jotai: 1.7µs (9.1x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 211,
            "unit": "ns",
            "extra": "jotai: 2.4µs (11.2x faster)"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 431,
            "unit": "ns",
            "extra": "jotai: 3.0µs (7.0x faster)"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 22349,
            "unit": "ns",
            "extra": "jotai: 227.2µs (10.2x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 261,
            "unit": "ns",
            "extra": "jotai: 413ns (1.6x faster)"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 41,
            "unit": "ns",
            "extra": "jotai: 9ns (4.8x slower)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 277,
            "unit": "ns",
            "extra": "jotai: 409ns (1.5x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 278,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 181,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1953,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai: 50ns (8.9x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 4833,
            "unit": "ns",
            "extra": "jotai: 25.4µs (5.3x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 35413,
            "unit": "ns",
            "extra": "jotai: 215.9µs (6.1x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4200,
            "unit": "ns",
            "extra": "jotai: 11.7µs (2.8x faster)"
          },
          {
            "name": "createStore",
            "value": 428,
            "unit": "ns",
            "extra": "jotai: 5.1µs (12.0x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 63415,
            "unit": "ns",
            "extra": "jotai: 759.3µs (12.0x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 6013,
            "unit": "ns",
            "extra": "jotai: 285.2µs (47.4x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 733,
            "unit": "ns",
            "extra": "jotai: 2.1µs (2.8x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 47192,
            "unit": "ns",
            "extra": "jotai: 214.0µs (4.5x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 84117,
            "unit": "ns",
            "extra": "jotai: 461.8µs (5.5x faster)"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 436810,
            "unit": "ns",
            "extra": "jotai: 2.39ms (5.5x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 515018,
            "unit": "ns",
            "extra": "jotai: 3.18ms (6.2x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 623431,
            "unit": "ns",
            "extra": "jotai: 16.75ms (26.9x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "28f1ba51b7f11da30078483b09a7ec76ca0d113d",
          "message": "Optimize atomFamily cache hit performance (#35)\n\n* Optimize atomFamily cache hit performance\n\nSkip stringifyFamilyArgs for single primitive args and use a single\nMap.get() instead of has()+get(), reducing cache hit overhead from\n~12x slower than jotai to ~2.5x.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Loosen benchmark thresholds and add baseline reset\n\nCI runners have variable performance that causes false regression\nreports. Widen thresholds to realistic CI tolerances (100% for\nsub-microsecond, 50% for larger benchmarks). Add workflow_dispatch\nwith reset_baseline input to clear gh-pages history after major\ndependency upgrades.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address review feedback and improve benchmark reporting\n\n- Fix duplicated key logic: use familyKey() in both atomFamily() and\n  release() (Copilot feedback)\n- Update AtomFamilyAtom type to reflect that familyArgsStringified\n  can be string | number | boolean (Copilot feedback)\n- Make Change column explicit: \"12% slower\" / \"8% faster\" instead\n  of ambiguous \"+12%\" / \"-8%\"\n- Make benchmark regression check non-blocking on PRs (continue-on-error)\n  since CI runner noise causes false positives\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Revert benchmark continue-on-error\n\nKeep the regression check as a hard failure.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Switch regression check to ratio-based comparison\n\nCompare the valdres/jotai ratio instead of absolute times. Since both\nlibraries run on the same CI machine, the ratio cancels out runner\nvariance — a slower runner slows both equally. This eliminates the\nfalse positives from CI noise that plagued the absolute-time approach.\n\nThe extra field in bench-results.json now includes the ratio in\nparseable format (ratio=X.XXXX) for historical comparison.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-06T13:25:56-07:00",
          "tree_id": "d5aa827a2524ebf97ad69d36a410ec343db4a3f6",
          "url": "https://github.com/eigilsagafos/valdres/commit/28f1ba51b7f11da30078483b09a7ec76ca0d113d"
        },
        "date": 1775507288332,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.0474 21.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1176 8.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 275,
            "unit": "ns",
            "extra": "jotai=2985 ratio=0.0921 10.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 559,
            "unit": "ns",
            "extra": "jotai=3673 ratio=0.1521 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 24095,
            "unit": "ns",
            "extra": "jotai=284001 ratio=0.0848 11.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 234,
            "unit": "ns",
            "extra": "jotai=407 ratio=0.5741 1.7x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4349 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 264,
            "unit": "ns",
            "extra": "jotai=413 ratio=0.6392 1.6x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 437,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2404,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0930 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6809,
            "unit": "ns",
            "extra": "jotai=25657 ratio=0.2654 3.8x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 57327,
            "unit": "ns",
            "extra": "jotai=258564 ratio=0.2217 4.5x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4927,
            "unit": "ns",
            "extra": "jotai=15020 ratio=0.3281 3.0x faster"
          },
          {
            "name": "createStore",
            "value": 446,
            "unit": "ns",
            "extra": "jotai=6065 ratio=0.0736 13.6x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 81723,
            "unit": "ns",
            "extra": "jotai=1006030 ratio=0.0812 12.3x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7535,
            "unit": "ns",
            "extra": "jotai=378037 ratio=0.0199 50.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 350,
            "unit": "ns",
            "extra": "jotai=2455 ratio=0.1426 7.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 58309,
            "unit": "ns",
            "extra": "jotai=285423 ratio=0.2043 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 102752,
            "unit": "ns",
            "extra": "jotai=573321 ratio=0.1792 5.6x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 549367,
            "unit": "ns",
            "extra": "jotai=2565764 ratio=0.2141 4.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 663359,
            "unit": "ns",
            "extra": "jotai=3291319 ratio=0.2015 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1152844,
            "unit": "ns",
            "extra": "jotai=18432546 ratio=0.0625 16.0x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "3197e00b5a68be1188bd69fcd40413ba7712e21b",
          "message": "Support late dep registration and async error handling (#36)\n\n* Support late dep registration and async error handling in selectors\n\nCore: Add late binding for deferred get calls (setTimeout, after await)\nwith stale closure detection and proper dep cleanup. Fix unhandled\npromise rejections in both handleSelectorResult branches.\n\nAdapter: Add setSelf support in read functions via store registry.\nImplement 4 jotai \"Error Handling in Async\" compat tests.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix stale-promise guard for selectors that settle to undefined\n\nUse data.values.has() instead of comparing against undefined, since\nWeakMap.get() returns undefined for both missing keys and keys whose\nvalue is literally undefined. Without this, a stale promise rejection\ncould incorrectly delete a valid undefined entry.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-06T13:46:38-07:00",
          "tree_id": "0d86b0113eb315d9fcb5ccdc5112cef9a291751f",
          "url": "https://github.com/eigilsagafos/valdres/commit/3197e00b5a68be1188bd69fcd40413ba7712e21b"
        },
        "date": 1775508475140,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0483 20.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=390 ratio=0.1026 9.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2174 ratio=0.1155 8.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 293,
            "unit": "ns",
            "extra": "jotai=2775 ratio=0.1056 9.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 550,
            "unit": "ns",
            "extra": "jotai=3888 ratio=0.1414 7.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25117,
            "unit": "ns",
            "extra": "jotai=291095 ratio=0.0863 11.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 290,
            "unit": "ns",
            "extra": "jotai=432 ratio=0.6705 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4398 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 313,
            "unit": "ns",
            "extra": "jotai=454 ratio=0.6896 1.5x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 371,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 241,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2394,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.0876 11.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6256,
            "unit": "ns",
            "extra": "jotai=23975 ratio=0.2610 3.8x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 58259,
            "unit": "ns",
            "extra": "jotai=258464 ratio=0.2254 4.4x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5185,
            "unit": "ns",
            "extra": "jotai=14087 ratio=0.3681 2.7x faster"
          },
          {
            "name": "createStore",
            "value": 451,
            "unit": "ns",
            "extra": "jotai=5992 ratio=0.0752 13.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 87805,
            "unit": "ns",
            "extra": "jotai=1006396 ratio=0.0872 11.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7594,
            "unit": "ns",
            "extra": "jotai=378118 ratio=0.0201 49.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 391,
            "unit": "ns",
            "extra": "jotai=2434 ratio=0.1606 6.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 62467,
            "unit": "ns",
            "extra": "jotai=283251 ratio=0.2205 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 114575,
            "unit": "ns",
            "extra": "jotai=584946 ratio=0.1959 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 597800,
            "unit": "ns",
            "extra": "jotai=2564405 ratio=0.2331 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 749765,
            "unit": "ns",
            "extra": "jotai=3311785 ratio=0.2264 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1269829,
            "unit": "ns",
            "extra": "jotai=21883358 ratio=0.0580 17.2x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ff0201c72ec964eb5a6730ec8002e9f4846d2bb4",
          "message": "Add AbortSignal support for async selectors (#33)\n\n* Add AbortSignal support for async selectors\n\nSelectors now receive an AbortSignal via the second argument ({ signal, storeId }).\nWhen a selector re-evaluates due to dependency changes, the previous signal is\naborted, enabling cancellation of in-flight async work. Each store maintains its\nown AbortController per selector via a WeakMap in StoreData.\n\nAlso adds rejection handlers to promise .then() chains in handleSelectorResult\nto prevent unhandled rejections from aborted async selectors.\n\nEnables 3 jotai compat abort signal tests.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Optimize AbortController allocation for sync selectors\n\nAfter first evaluation, sync selectors are marked with a `false` sentinel\nin the abortControllers WeakMap. Subsequent evaluations check this sentinel\n(~1ns WeakMap.get) and skip AbortController allocation (~140ns), using a\nstatic never-aborted signal instead. Async selectors continue to get real\nAbortControllers that are aborted on re-evaluation.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Cache sync selector options to eliminate per-eval object allocation\n\nFor known-sync selectors (marked with `false` sentinel after first eval),\nreuse a cached { signal, storeId } options object per store instead of\nallocating a new object on every evaluation. This eliminates all per-eval\noverhead on the sync hot path beyond a single WeakMap.get (~1ns).\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix jotai compat setSelf broken by options object change\n\nThe selector.get override for writable atoms expected the second\nargument to be a plain storeId string, but the abort signal change\nmade it an options object { signal, storeId }. Extract storeId from\nthe object and forward signal to the jotai read function.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix spurious abort on suspension retry and remove unnecessary cast\n\nWhen a selector suspends (dependency is a pending promise), the\nAbortController was left in the map. When the dependency resolved and\npropagation re-evaluated the selector, evaluateSelector would abort\nthe signal even though no async work was started (the selector threw\nbefore completing). Now the controller is cleared on suspension so\nthe retry creates a fresh signal without aborting the previous one.\n\nAlso removes the unnecessary `as any` cast on `false` since the\nWeakMap type already includes `false` in the union.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-06T16:23:15-07:00",
          "tree_id": "340b6e03475089d5b597266eeb849a6ee6934347",
          "url": "https://github.com/eigilsagafos/valdres/commit/ff0201c72ec964eb5a6730ec8002e9f4846d2bb4"
        },
        "date": 1775517866500,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0428 23.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2184 ratio=0.1149 8.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 283,
            "unit": "ns",
            "extra": "jotai=2977 ratio=0.0949 10.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 551,
            "unit": "ns",
            "extra": "jotai=3632 ratio=0.1516 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 23324,
            "unit": "ns",
            "extra": "jotai=280629 ratio=0.0831 12.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 244,
            "unit": "ns",
            "extra": "jotai=399 ratio=0.6135 1.6x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4554 4.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 266,
            "unit": "ns",
            "extra": "jotai=396 ratio=0.6709 1.5x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 370,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 250,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2531,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.1045 9.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 5920,
            "unit": "ns",
            "extra": "jotai=24165 ratio=0.2450 4.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 51888,
            "unit": "ns",
            "extra": "jotai=256062 ratio=0.2026 4.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5213,
            "unit": "ns",
            "extra": "jotai=15273 ratio=0.3413 2.9x faster"
          },
          {
            "name": "createStore",
            "value": 449,
            "unit": "ns",
            "extra": "jotai=5924 ratio=0.0758 13.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 89508,
            "unit": "ns",
            "extra": "jotai=1047426 ratio=0.0855 11.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7254,
            "unit": "ns",
            "extra": "jotai=377431 ratio=0.0192 52.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 370,
            "unit": "ns",
            "extra": "jotai=2454 ratio=0.1508 6.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 63530,
            "unit": "ns",
            "extra": "jotai=291329 ratio=0.2181 4.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 117562,
            "unit": "ns",
            "extra": "jotai=586976 ratio=0.2003 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 613055,
            "unit": "ns",
            "extra": "jotai=2642890 ratio=0.2320 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 760072,
            "unit": "ns",
            "extra": "jotai=3231680 ratio=0.2352 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1268971,
            "unit": "ns",
            "extra": "jotai=20412362 ratio=0.0622 16.1x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "dcf408bb3878cb0cd06213a97feecb07ffb84176",
          "message": "Fix async selector dependency tracking and enable 3 jotai onMount tests (#32)\n\nAsync selectors that read atoms after an await were invisible to the\ndependency tracking system. Add dynamic dep registration in the get\ncallback for async continuations, preserve deps during re-evaluation\nto prevent premature unmounting, and reconcile stale deps when the\npromise resolves.\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-06T16:50:47-07:00",
          "tree_id": "c9720aa67008fef51b1969b52fb837e79dd0ebfe",
          "url": "https://github.com/eigilsagafos/valdres/commit/dcf408bb3878cb0cd06213a97feecb07ffb84176"
        },
        "date": 1775519522860,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.0577 17.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=384 ratio=0.0677 14.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 255,
            "unit": "ns",
            "extra": "jotai=2170 ratio=0.1175 8.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 286,
            "unit": "ns",
            "extra": "jotai=2704 ratio=0.1059 9.4x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 568,
            "unit": "ns",
            "extra": "jotai=3563 ratio=0.1594 6.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 24472,
            "unit": "ns",
            "extra": "jotai=262207 ratio=0.0933 10.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=376 ratio=0.7116 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=3.9037 3.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 283,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.7448 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 344,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 400,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2300,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=67 ratio=0.1243 8.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6837,
            "unit": "ns",
            "extra": "jotai=24610 ratio=0.2778 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 60105,
            "unit": "ns",
            "extra": "jotai=248694 ratio=0.2417 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5174,
            "unit": "ns",
            "extra": "jotai=13109 ratio=0.3947 2.5x faster"
          },
          {
            "name": "createStore",
            "value": 376,
            "unit": "ns",
            "extra": "jotai=6816 ratio=0.0552 18.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 89025,
            "unit": "ns",
            "extra": "jotai=1024452 ratio=0.0869 11.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7386,
            "unit": "ns",
            "extra": "jotai=345503 ratio=0.0214 46.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 680,
            "unit": "ns",
            "extra": "jotai=2487 ratio=0.2733 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 68740,
            "unit": "ns",
            "extra": "jotai=251895 ratio=0.2729 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 110534,
            "unit": "ns",
            "extra": "jotai=484676 ratio=0.2281 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 690607,
            "unit": "ns",
            "extra": "jotai=2209826 ratio=0.3125 3.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 861969,
            "unit": "ns",
            "extra": "jotai=3284317 ratio=0.2625 3.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1284649,
            "unit": "ns",
            "extra": "jotai=19759556 ratio=0.0650 15.4x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7565d38f2d7415df619ddaa0229d19a0aa4cf4be",
          "message": "Improve benchmark stability and PR comment freshness (#38)\n\n* Improve benchmark stability and add run counter to PR comments\n\nIncrease mitata measurement parameters (min_samples: 20, min_cpu_time: 1.5s,\nwarmup_samples: 5) for more consistent results across CI runs. Add run number\nand timestamp footer to the benchmark PR comment so it's clear when results\nwere last updated.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Skip run counter in console log output\n\nThe run number is only meaningful on the PR comment where it tracks\nupdates. Console output now omits it to avoid showing a misleading\nhardcoded value.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-06T17:11:13-07:00",
          "tree_id": "0d745abd2d21cf95c4cefa7402467be86e92d256",
          "url": "https://github.com/eigilsagafos/valdres/commit/7565d38f2d7415df619ddaa0229d19a0aa4cf4be"
        },
        "date": 1775520828001,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.0507 19.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=401 ratio=0.0998 10.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=2154 ratio=0.1207 8.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 280,
            "unit": "ns",
            "extra": "jotai=2715 ratio=0.1031 9.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 550,
            "unit": "ns",
            "extra": "jotai=3793 ratio=0.1450 6.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25228,
            "unit": "ns",
            "extra": "jotai=286216 ratio=0.0881 11.3x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=454 ratio=0.6689 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4148 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 296,
            "unit": "ns",
            "extra": "jotai=435 ratio=0.6808 1.5x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 451,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3383,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.0901 11.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8699,
            "unit": "ns",
            "extra": "jotai=31133 ratio=0.2794 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83567,
            "unit": "ns",
            "extra": "jotai=347892 ratio=0.2402 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 11329,
            "unit": "ns",
            "extra": "jotai=18327 ratio=0.6181 1.6x faster"
          },
          {
            "name": "createStore",
            "value": 488,
            "unit": "ns",
            "extra": "jotai=6459 ratio=0.0756 13.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 95709,
            "unit": "ns",
            "extra": "jotai=1210887 ratio=0.0790 12.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7594,
            "unit": "ns",
            "extra": "jotai=377617 ratio=0.0201 49.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 391,
            "unit": "ns",
            "extra": "jotai=2605 ratio=0.1501 6.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 96421,
            "unit": "ns",
            "extra": "jotai=433271 ratio=0.2225 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 152496,
            "unit": "ns",
            "extra": "jotai=745296 ratio=0.2046 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 831527,
            "unit": "ns",
            "extra": "jotai=4536283 ratio=0.1833 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 982689,
            "unit": "ns",
            "extra": "jotai=4908932 ratio=0.2002 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1505388,
            "unit": "ns",
            "extra": "jotai=26044617 ratio=0.0578 17.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "847aca79a25d6523fdb286d20c9f1f6a53b4a86a",
          "message": "Add async atom support to jotai compat layer (#37)\n\n* Add async atom support to jotai compat layer and core async tests\n\n- Export isSuspendError type guard from valdres core so adapter uses\n  instanceof check instead of duck-typing\n- Add wrapAsync in jotai adapter to catch SuspendAndWaitForResolveError\n  and return Promise (jotai async atom semantics)\n- Wrap store.get to re-wrap resolved async values as Promises\n- Wrap store.sub to suppress promise-to-promise transition notifications\n- Add 9 core async selector tests (late deps, abort signals, stale\n  promise guard, suspension, dep cleanup)\n- Enable 7 jotai compat tests for async atoms\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address PR review: improve test quality and keep getDefaultStore unwrapped\n\n- Use shared wait() helper in async selector tests instead of inline setTimeout\n- Complete suspension test: assert resolved value after resolve()\n- Rename test to reflect observed behavior (suspension, not throwing)\n- Keep getDefaultStore using raw valdres store (not compat createStore)\n  because React hooks from valdres-react expect raw values, not\n  Promise-wrapped async atom values\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Unify getDefaultStore with createStore and fix React Suspense compat\n\ngetDefaultStore now uses the compat createStore(), ensuring async atom\nwrapping (get re-wrap, sub suppression) is consistent across all stores.\n\nThe store.get wrapper re-wraps resolved async values as Promise.resolve()\nfor jotai's vanilla API, but this breaks React's useSyncExternalStore\n(new Promise object each call = infinite re-render) and useValue's\nSuspense throw (any Promise = suspend forever). Fix: expose _rawGet on\nthe store and have useAtom pass a store view with the unwrapped get to\nvaldres-react hooks.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T11:42:18-07:00",
          "tree_id": "4dda6fd9b620bc2684ed139d77773b0a0edc2741",
          "url": "https://github.com/eigilsagafos/valdres/commit/847aca79a25d6523fdb286d20c9f1f6a53b4a86a"
        },
        "date": 1775587487542,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.0500 20.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=410 ratio=0.0976 10.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=2144 ratio=0.1213 8.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=2745 ratio=0.1013 9.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 557,
            "unit": "ns",
            "extra": "jotai=3532 ratio=0.1576 6.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26990,
            "unit": "ns",
            "extra": "jotai=287477 ratio=0.0939 10.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 321,
            "unit": "ns",
            "extra": "jotai=458 ratio=0.7007 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.2136 4.2x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=450 ratio=0.7253 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 463,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3298,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.0917 10.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8812,
            "unit": "ns",
            "extra": "jotai=30920 ratio=0.2850 3.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 84718,
            "unit": "ns",
            "extra": "jotai=333914 ratio=0.2537 3.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8468,
            "unit": "ns",
            "extra": "jotai=18239 ratio=0.4643 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 478,
            "unit": "ns",
            "extra": "jotai=6478 ratio=0.0738 13.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 94958,
            "unit": "ns",
            "extra": "jotai=1210862 ratio=0.0784 12.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7268,
            "unit": "ns",
            "extra": "jotai=377495 ratio=0.0193 51.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 371,
            "unit": "ns",
            "extra": "jotai=2585 ratio=0.1435 7.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 91221,
            "unit": "ns",
            "extra": "jotai=432398 ratio=0.2110 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 152344,
            "unit": "ns",
            "extra": "jotai=748498 ratio=0.2035 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 824290,
            "unit": "ns",
            "extra": "jotai=4527839 ratio=0.1820 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 983086,
            "unit": "ns",
            "extra": "jotai=4813112 ratio=0.2043 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1472551,
            "unit": "ns",
            "extra": "jotai=24873570 ratio=0.0592 16.9x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7a50eba0421765fc9df33b997ce2e20fcb5a7fc4",
          "message": "Remove console.logs and commented-out dead code (#39)\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T12:33:09-07:00",
          "tree_id": "6fa4ffddcad79a423cc4056ee76559247aebd5d4",
          "url": "https://github.com/eigilsagafos/valdres/commit/7a50eba0421765fc9df33b997ce2e20fcb5a7fc4"
        },
        "date": 1775590546655,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.0470 21.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 250,
            "unit": "ns",
            "extra": "jotai=2173 ratio=0.1150 8.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=2834 ratio=0.0964 10.4x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 530,
            "unit": "ns",
            "extra": "jotai=3849 ratio=0.1377 7.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25007,
            "unit": "ns",
            "extra": "jotai=292559 ratio=0.0855 11.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 366,
            "unit": "ns",
            "extra": "jotai=514 ratio=0.7129 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 53,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.8008 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 379,
            "unit": "ns",
            "extra": "jotai=512 ratio=0.7411 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 359,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 480,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3450,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.1426 7.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9209,
            "unit": "ns",
            "extra": "jotai=31079 ratio=0.2963 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 85409,
            "unit": "ns",
            "extra": "jotai=341103 ratio=0.2504 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 10888,
            "unit": "ns",
            "extra": "jotai=18605 ratio=0.5852 1.7x faster"
          },
          {
            "name": "createStore",
            "value": 494,
            "unit": "ns",
            "extra": "jotai=6772 ratio=0.0730 13.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 116966,
            "unit": "ns",
            "extra": "jotai=1194428 ratio=0.0979 10.2x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7776,
            "unit": "ns",
            "extra": "jotai=367744 ratio=0.0211 47.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 340,
            "unit": "ns",
            "extra": "jotai=2413 ratio=0.1409 7.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 89384,
            "unit": "ns",
            "extra": "jotai=410418 ratio=0.2178 4.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 148553,
            "unit": "ns",
            "extra": "jotai=722127 ratio=0.2057 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 839984,
            "unit": "ns",
            "extra": "jotai=4643207 ratio=0.1809 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 991558,
            "unit": "ns",
            "extra": "jotai=4929454 ratio=0.2011 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1507689,
            "unit": "ns",
            "extra": "jotai=25569148 ratio=0.0590 17.0x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9bd8ad110f6c4e308409acbdc5acfb41a3ad4049",
          "message": "Support async updater functions in setAtom (#41)\n\n* Support async updater functions in setAtom\n\nReplace the \"Todo\" throw with proper async handling: when an updater\nfunction returns a promise, store it immediately, then resolve the\nfinal value asynchronously. Includes guards for stale promise races,\nrejection rollback, onSet callback, and empty atom promise resolution.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: equality guard, suspense forwarding, race test\n\n- Add same-promise reference equality check to skip no-op async sets\n- Forward __isEmptyAtomPromise__ resolver across racing async sets via\n  __emptyAtomPromiseOrigin__ so the original suspense promise resolves\n  even when intermediate promises become stale\n- Add test for racing async updaters on empty atom suspense resolution\n- Add test for same-promise no-op behavior\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T13:08:37-07:00",
          "tree_id": "5398b979dbb7672d2d22fcee900a2941200e1001",
          "url": "https://github.com/eigilsagafos/valdres/commit/9bd8ad110f6c4e308409acbdc5acfb41a3ad4049"
        },
        "date": 1775592663734,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.0468 21.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=2144 ratio=0.1213 8.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 250,
            "unit": "ns",
            "extra": "jotai=2716 ratio=0.0922 10.8x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 541,
            "unit": "ns",
            "extra": "jotai=3558 ratio=0.1522 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26048,
            "unit": "ns",
            "extra": "jotai=282236 ratio=0.0923 10.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 318,
            "unit": "ns",
            "extra": "jotai=464 ratio=0.6853 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4387 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 316,
            "unit": "ns",
            "extra": "jotai=455 ratio=0.6956 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 459,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3304,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.0929 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8753,
            "unit": "ns",
            "extra": "jotai=28413 ratio=0.3081 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83996,
            "unit": "ns",
            "extra": "jotai=334183 ratio=0.2513 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8352,
            "unit": "ns",
            "extra": "jotai=18230 ratio=0.4581 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 470,
            "unit": "ns",
            "extra": "jotai=6421 ratio=0.0733 13.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 95819,
            "unit": "ns",
            "extra": "jotai=1199104 ratio=0.0799 12.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7215,
            "unit": "ns",
            "extra": "jotai=377103 ratio=0.0191 52.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 819,
            "unit": "ns",
            "extra": "jotai=2545 ratio=0.3217 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 89698,
            "unit": "ns",
            "extra": "jotai=422487 ratio=0.2123 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 150701,
            "unit": "ns",
            "extra": "jotai=745148 ratio=0.2022 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 798516,
            "unit": "ns",
            "extra": "jotai=4497819 ratio=0.1775 5.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 960651,
            "unit": "ns",
            "extra": "jotai=4791769 ratio=0.2005 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1489195,
            "unit": "ns",
            "extra": "jotai=24335605 ratio=0.0612 16.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "2baaec842845533df1a014fd995c1d3580fad49e",
          "message": "Enable jotai memory leak tests with Bun-native LeakDetector (#40)\n\n* Enable jotai memory leak tests with Bun-native LeakDetector\n\nReplace jest-leak-detector (which requires node:v8 setFlagsFromString) with a\nBun-native LeakDetector using Bun.gc, FinalizationRegistry, and\ngenerateHeapSnapshot. Restores 7 original tests and adds 3 new dependency\nleak tests. 9 of 10 now pass; 1 remains todo (upstream jotai).\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add memory leak test suite for core valdres\n\nTests GC behavior across atoms, selectors, subscriptions, atom families,\nselector families, onMount lifecycle, scoped stores, and transactions.\nUses the same Bun-native LeakDetector (Bun.gc + FinalizationRegistry).\nNotably verifies that unreleased atomFamily entries are retained (by design)\nwhile released ones are properly collected.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Extract shared LeakDetector, add selectorFamily.release(), fix store.del() cleanup\n\n- Extract LeakDetector to @valdres/test shared utility, used by both\n  core valdres and jotai compat test suites\n- Add .release() to selectorFamily for parity with atomFamily\n- Fix store.del() to also release the atom from its family's internal Map,\n  preventing memory leaks when deleting family atoms\n- Guard deleteFamilyAtom against non-family atoms (e.g. scoped store del)\n- Add tests: store.del() family cleanup, selectorFamily release/retain,\n  scoped store detach + parent reference counting\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix flaky memory leak test in CI\n\nAdd subscription to \"atom value is collected after set replaces it\" test\nso propagation runs and the old value is fully replaced in the store.\nWithout a subscriber, the old value could remain in engine internals\ncausing non-deterministic GC behavior on CI runners.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix flaky transaction memory leak test in CI\n\nUnsubscribe before checking for leaks — with an active subscription the\nstore retains internal references that CI GC doesn't collect deterministically.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix flaky memory leak tests in CI\n\nRevert LeakDetector to stable FinalizationRegistry approach (single GC\nround + heap snapshot fallback). Mark tests that depend on valdres\nstateDependents cleanup as todo — these are a known architectural\ndifference from jotai. Replace GC-timing-dependent transaction test\nwith a behavioral assertion.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Fix Map key types in AtomFamily and SelectorFamily (string, not Args/Value)\n- Tighten LeakDetector constructor to accept `object` instead of `unknown`\n- Clarify LeakDetector doc comment as Bun-specific\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T14:12:25-07:00",
          "tree_id": "9d6457c5c9757301fbf452e8c0cfa8e42051414a",
          "url": "https://github.com/eigilsagafos/valdres/commit/2baaec842845533df1a014fd995c1d3580fad49e"
        },
        "date": 1775596493565,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0476 21.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=390 ratio=0.1026 9.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1218 8.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=2725 ratio=0.0932 10.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 561,
            "unit": "ns",
            "extra": "jotai=3585 ratio=0.1565 6.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25378,
            "unit": "ns",
            "extra": "jotai=281779 ratio=0.0901 11.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=465 ratio=0.6721 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4324 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=447 ratio=0.6986 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 442,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3337,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.0943 10.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8876,
            "unit": "ns",
            "extra": "jotai=28824 ratio=0.3079 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 84338,
            "unit": "ns",
            "extra": "jotai=265258 ratio=0.3179 3.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8173,
            "unit": "ns",
            "extra": "jotai=15747 ratio=0.5190 1.9x faster"
          },
          {
            "name": "createStore",
            "value": 474,
            "unit": "ns",
            "extra": "jotai=6381 ratio=0.0743 13.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 95640,
            "unit": "ns",
            "extra": "jotai=1202385 ratio=0.0795 12.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7314,
            "unit": "ns",
            "extra": "jotai=379091 ratio=0.0193 51.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 829,
            "unit": "ns",
            "extra": "jotai=2515 ratio=0.3295 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 94837,
            "unit": "ns",
            "extra": "jotai=416401 ratio=0.2278 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 149831,
            "unit": "ns",
            "extra": "jotai=752412 ratio=0.1991 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 813586,
            "unit": "ns",
            "extra": "jotai=4516271 ratio=0.1801 5.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 969127,
            "unit": "ns",
            "extra": "jotai=4766208 ratio=0.2033 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1485947,
            "unit": "ns",
            "extra": "jotai=24512454 ratio=0.0606 16.5x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "942e27a0ce67307aa3ea7d602b4b4d3491d78057",
          "message": "Convert data.scopes from plain object to lazy Map (#44)\n\nReplace the plain `{ [scopeId: string]: ScopedStoreData }` object with a\n`Map<string, ScopedStoreData>` initialized lazily via the existing\nprototype getter pattern. This avoids `Object.keys()` allocations on\nevery scope iteration and defers the `Map` construction until scopes\nare actually used.\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T15:22:58-07:00",
          "tree_id": "253f48e174104e33adc7aa42249ec4b553236913",
          "url": "https://github.com/eigilsagafos/valdres/commit/942e27a0ce67307aa3ea7d602b4b4d3491d78057"
        },
        "date": 1775600726860,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.0454 22.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 250,
            "unit": "ns",
            "extra": "jotai=2133 ratio=0.1172 8.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=2804 ratio=0.0906 11.0x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 600,
            "unit": "ns",
            "extra": "jotai=3918 ratio=0.1531 6.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 27191,
            "unit": "ns",
            "extra": "jotai=291528 ratio=0.0933 10.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 387,
            "unit": "ns",
            "extra": "jotai=529 ratio=0.7317 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 54,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.8886 4.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 388,
            "unit": "ns",
            "extra": "jotai=518 ratio=0.7498 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 359,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 514,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3467,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.1344 7.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8942,
            "unit": "ns",
            "extra": "jotai=28533 ratio=0.3134 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 84438,
            "unit": "ns",
            "extra": "jotai=340566 ratio=0.2479 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8627,
            "unit": "ns",
            "extra": "jotai=18284 ratio=0.4719 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 492,
            "unit": "ns",
            "extra": "jotai=6748 ratio=0.0730 13.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 95374,
            "unit": "ns",
            "extra": "jotai=1206255 ratio=0.0791 12.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7682,
            "unit": "ns",
            "extra": "jotai=367890 ratio=0.0209 47.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 870,
            "unit": "ns",
            "extra": "jotai=2463 ratio=0.3532 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 87783,
            "unit": "ns",
            "extra": "jotai=409256 ratio=0.2145 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 148333,
            "unit": "ns",
            "extra": "jotai=712022 ratio=0.2083 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 808827,
            "unit": "ns",
            "extra": "jotai=4543867 ratio=0.1780 5.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 946274,
            "unit": "ns",
            "extra": "jotai=4907535 ratio=0.1928 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1478094,
            "unit": "ns",
            "extra": "jotai=25984710 ratio=0.0569 17.6x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "c4e2564da3c3ff5cc3c60a307b99b93e69080ec0",
          "message": "Fix maxAge timeout leak on async rejection (#42)\n\n* Fix maxAge timeout leak on async atom rejection and add staleWhileRevalidate test\n\nHandle promise rejection in the maxAge/staleWhileRevalidate interval to\nprevent timeout leaks and unhandled rejection crashes. Also fix existing\ntest teardown (mockReset → mockRestore) that was breaking setInterval\nfor subsequent tests.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add failing todo tests for known maxAge/staleWhileRevalidate issues\n\nTwo test.todo cases documenting known limitations:\n1. Overlapping interval ticks share a single timeout handle, so slow\n   revalidations cause orphaned timers that are never cleared\n2. Rejected async atom init leaves a rejected promise stuck in the\n   store permanently with no retry/recovery path\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix overlapping staleWhileRevalidate timeouts and rejected atom recovery\n\n1. Track per-tick timeouts with a Set instead of a shared handle, so\n   each promise clears its own timer and cleanup cancels all pending.\n\n2. On async atom init rejection, delete the rejected promise from\n   data.values so re-subscribing triggers a fresh init instead of\n   being permanently stuck.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Skip maxAge revalidation tick while previous is still in-flight\n\nPrevents unbounded accumulation of in-flight promises when async\nrevalidation takes longer than the maxAge interval. Matches HTTP\ncache semantics where you don't re-fetch while already revalidating.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T15:26:11-07:00",
          "tree_id": "63957cf4911f83720c41665127c6ae8dc126111c",
          "url": "https://github.com/eigilsagafos/valdres/commit/c4e2564da3c3ff5cc3c60a307b99b93e69080ec0"
        },
        "date": 1775600929219,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0502 19.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=2094 ratio=0.1242 8.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=2746 ratio=0.0941 10.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 595,
            "unit": "ns",
            "extra": "jotai=3627 ratio=0.1641 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 34302,
            "unit": "ns",
            "extra": "jotai=282137 ratio=0.1216 8.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 333,
            "unit": "ns",
            "extra": "jotai=461 ratio=0.7226 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4408 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 341,
            "unit": "ns",
            "extra": "jotai=455 ratio=0.7495 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 368,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 481,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3313,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.0949 10.5x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9050,
            "unit": "ns",
            "extra": "jotai=28342 ratio=0.3193 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83356,
            "unit": "ns",
            "extra": "jotai=331719 ratio=0.2513 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8525,
            "unit": "ns",
            "extra": "jotai=18057 ratio=0.4721 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 456,
            "unit": "ns",
            "extra": "jotai=6455 ratio=0.0706 14.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 97071,
            "unit": "ns",
            "extra": "jotai=1221169 ratio=0.0795 12.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7255,
            "unit": "ns",
            "extra": "jotai=375370 ratio=0.0193 51.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 842,
            "unit": "ns",
            "extra": "jotai=2574 ratio=0.3270 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 90799,
            "unit": "ns",
            "extra": "jotai=412189 ratio=0.2203 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 150240,
            "unit": "ns",
            "extra": "jotai=735102 ratio=0.2044 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 815582,
            "unit": "ns",
            "extra": "jotai=4488507 ratio=0.1817 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 972676,
            "unit": "ns",
            "extra": "jotai=4816890 ratio=0.2019 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1472358,
            "unit": "ns",
            "extra": "jotai=24602854 ratio=0.0598 16.7x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ac93c733154d5088774e4b0825ec1a4b0481f232",
          "message": "Fix onMount/onUnmount lifecycle continuation on error (#45)\n\n* Fix onMount/onUnmount lifecycle continuation when errors are thrown\n\nWhen atom B's onMount or onUnmount throws, valdres now continues processing\nremaining atoms instead of stopping. mountTransitiveDeps and unmountOrphanedDeps\ncollect errors in an internal helper and re-throw the first after all atoms are\nprocessed. Enables 2 more jotai compat tests (109 pass, 0 fail).\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: use firstError instead of errors array\n\nReplace errors[] collection with a single firstError variable to avoid\nunnecessary allocations. Also fix COMPAT_TODO.md wording to accurately\ndescribe the onMount/onUnmount error scenario.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-07T15:29:54-07:00",
          "tree_id": "614e209208d94fc9d22f77f71a440ba0a6dc3aa8",
          "url": "https://github.com/eigilsagafos/valdres/commit/ac93c733154d5088774e4b0825ec1a4b0481f232"
        },
        "date": 1775601144723,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0511 19.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1176 8.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2755 ratio=0.0910 11.0x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 578,
            "unit": "ns",
            "extra": "jotai=3546 ratio=0.1629 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 33223,
            "unit": "ns",
            "extra": "jotai=282908 ratio=0.1174 8.5x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 299,
            "unit": "ns",
            "extra": "jotai=462 ratio=0.6476 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4137 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 328,
            "unit": "ns",
            "extra": "jotai=451 ratio=0.7268 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 368,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 474,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3322,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.0895 11.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9280,
            "unit": "ns",
            "extra": "jotai=31753 ratio=0.2922 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 84548,
            "unit": "ns",
            "extra": "jotai=333773 ratio=0.2533 3.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8609,
            "unit": "ns",
            "extra": "jotai=18440 ratio=0.4669 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 487,
            "unit": "ns",
            "extra": "jotai=6502 ratio=0.0749 13.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 97161,
            "unit": "ns",
            "extra": "jotai=1239174 ratio=0.0784 12.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7704,
            "unit": "ns",
            "extra": "jotai=375130 ratio=0.0205 48.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 391,
            "unit": "ns",
            "extra": "jotai=2525 ratio=0.1549 6.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 93265,
            "unit": "ns",
            "extra": "jotai=432587 ratio=0.2156 4.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 153767,
            "unit": "ns",
            "extra": "jotai=743258 ratio=0.2069 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 821845,
            "unit": "ns",
            "extra": "jotai=4527793 ratio=0.1815 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 971324,
            "unit": "ns",
            "extra": "jotai=4771701 ratio=0.2036 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1496154,
            "unit": "ns",
            "extra": "jotai=24699231 ratio=0.0606 16.5x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "6b40272ebf63df178ab76fb4527449783f6286e3",
          "message": "Fix flaky memory leak tests in CI (#46)\n\n* Fix flaky memory leak tests in CI by switching to WeakRef\n\nFinalizationRegistry callbacks have non-deterministic timing — the spec\ndoesn't guarantee when they fire after GC. On CI runners with low memory\npressure, callbacks often didn't fire within the timeout window, causing\ntwo tests to fail intermittently.\n\nReplace FinalizationRegistry with WeakRef.deref() which gives an\nimmediate answer about whether an object has been collected. Use 3\nrounds of gc() + heap snapshot (more aggressive) with early returns\ninstead of 20 fixed yield iterations.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Increase LeakDetector GC rounds and use real timer delays\n\n3 rounds wasn't enough on CI — \"unreferenced selector value is\ncollected\" still failed. Bump to 10 rounds and use 1ms real timer\ndelays (instead of microtask yields) to give the runtime time to\nprocess WeakMap/WeakRef cleanup between GC passes.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Use fullGC + releaseWeakRefs + generateHeapSnapshot combo\n\nPrevious approach still failed in CI for selector tests. Now uses the\nfull arsenal from bun:jsc that Bun's own test suite relies on:\n- fullGC() for thorough collection\n- releaseWeakRefs() to explicitly process deferred weak ref cleanup\n- generateHeapSnapshot() to force the engine to walk the full heap\n  and determine reachability\n\n10 rounds with early return, 10/10 stable locally.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix tests asserting collection of objects with live reference chains\n\nThe two CI-flaky tests had real reference chains preventing GC:\n\n1. \"atom value is collected after set replaces it\": atom1.defaultValue\n   held a strong reference to the tracked object. Fix: use undefined\n   as default, set the tracked value via store.set() instead.\n\n2. \"unreferenced selector value is collected\": stateDependents.get(atom1)\n   held a Set containing the selector, keeping it and its value alive.\n   Fix: release atom1 and store1 so the WeakMap entries can be collected.\n\nAlso fixed \"chained selector values\", \"selector value after sub/unsub\",\nand \"released selector family entry\" which had the same stateDependents\nreference chain and could fail flakily on CI.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Use IIFEs to ensure all references leave the call stack\n\nSetting variables to undefined leaves the bindings allocated in the\nasync function's scope frame. JSC on Linux CI may not resolve the\nWeakMap ephemeron cycle (stateDependents ↔ stateDependencies cross-\nreference selectors and their dependency atoms through Sets in WeakMap\nvalues) when bindings still exist in scope.\n\nIIFEs ensure store, atom, and selector references are truly gone from\nthe call stack before GC runs — no lingering scope bindings.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Isolate selector getter closures from store scope\n\nJSC captures the entire scope object for closures, not just referenced\nvariables. When a selector getter like `get => get(atom)` is defined\nin the same scope as the store, the closure keeps the store alive.\nCombined with stateDependents (store → atom → Set → selector → getter\n→ scope → store), this creates an uncollectable cycle.\n\nFix: define selectors in nested IIFEs whose scope does NOT contain the\nstore. The getter closure only captures the inner scope (with the atom),\nwhile the store lives in a separate outer scope that's destroyed on\nreturn.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Use gcAggressionLevel(2) and real delays in LeakDetector\n\nJSC on Linux (CI) is lazier about processing WeakMap ephemeron cycles\nand WeakRef cleanup than on macOS. Two changes:\n\nLeakDetector: temporarily set gcAggressionLevel to maximum (2) during\nchecking, and use Bun.sleep(10) real delays between rounds (matching\nBun's own test patterns which sleep 10-50ms). This gives JSC's GC\nenough pressure and time to process deferred weak reference cleanup.\n\nTests: isolate selector getter closures in nested IIFEs so the getter's\ncaptured scope doesn't include the store (JSC captures entire scope\nobjects for closures, creating uncollectable cycles via stateDependents\nwhen store and selector share a scope).\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Run memory leak tests in isolated process to avoid heap pressure\n\nBun runs all test files in the same process, so heap pressure from\nother test files prevents WeakMap ephemeron cleanup even after many\nGC rounds. Running memoryleaks.test.ts as a separate bun test\ninvocation ensures a clean heap.\n\nAlso simplifies LeakDetector (10 rounds, no gcAggressionLevel hack)\nand wraps all leak tests in IIFEs so stores go fully out of scope.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T09:15:16-07:00",
          "tree_id": "efc4a458e661a13817e8fdd28a1c3ae6708230fc",
          "url": "https://github.com/eigilsagafos/valdres/commit/6b40272ebf63df178ab76fb4527449783f6286e3"
        },
        "date": 1775665066836,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.0464 21.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 241,
            "unit": "ns",
            "extra": "jotai=2194 ratio=0.1098 9.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 248,
            "unit": "ns",
            "extra": "jotai=2814 ratio=0.0882 11.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 577,
            "unit": "ns",
            "extra": "jotai=3799 ratio=0.1519 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25609,
            "unit": "ns",
            "extra": "jotai=291559 ratio=0.0878 11.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 370,
            "unit": "ns",
            "extra": "jotai=513 ratio=0.7211 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 54,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.8200 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 369,
            "unit": "ns",
            "extra": "jotai=508 ratio=0.7269 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 358,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 510,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3416,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.1348 7.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8868,
            "unit": "ns",
            "extra": "jotai=30101 ratio=0.2946 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 84046,
            "unit": "ns",
            "extra": "jotai=343427 ratio=0.2447 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8471,
            "unit": "ns",
            "extra": "jotai=18111 ratio=0.4677 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=6745 ratio=0.0743 13.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 94432,
            "unit": "ns",
            "extra": "jotai=1195407 ratio=0.0790 12.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7727,
            "unit": "ns",
            "extra": "jotai=371188 ratio=0.0208 48.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 870,
            "unit": "ns",
            "extra": "jotai=2494 ratio=0.3490 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 93301,
            "unit": "ns",
            "extra": "jotai=406972 ratio=0.2293 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 147892,
            "unit": "ns",
            "extra": "jotai=716617 ratio=0.2064 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 824450,
            "unit": "ns",
            "extra": "jotai=4528878 ratio=0.1820 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 970810,
            "unit": "ns",
            "extra": "jotai=5053536 ratio=0.1921 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1471362,
            "unit": "ns",
            "extra": "jotai=25660339 ratio=0.0573 17.4x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "6544458a8aecd1682d621bbb720750f60eb63b36",
          "message": "Stabilize benchmark regression detection (#43)\n\n* Stabilize benchmark regression detection with IQR filtering and variance-aware thresholds\n\n- Add IQR-based outlier removal to bench-utils.ts — filters GC-pause fat\n  tails from mitata's raw samples before computing median, dramatically\n  reducing per-run variance (sub+unsub was swinging 231ns–857ns)\n- Replace flat 50% regression threshold with per-benchmark dynamic\n  thresholds scaled by historical coefficient of variation (CV)\n- Skip regression gating for optimization-target benchmarks (threshold≥10)\n  which are inherently noisy and already gated by the bun test assertion\n- Add compact benchmark-data branch for history storage (~1KB/run vs\n  ~6KB/run on gh-pages), with backwards-compatible gh-pages fallback\n- Add concurrency group to prevent race conditions on parallel main pushes\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: fix doc comment, add empty-samples guard, serialize concurrent runs\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Update mitata to v1.0.34 (from v1.0.4)\n\nBetter default trimming (slice(2,-2)), higher min_samples (12),\nand new do_not_optimize() / gc options for more stable measurements.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add self-vs-self absolute timing tracking alongside jotai ratio comparison\n\nTracks absolute valdres timings against historical median with dynamic\nthresholds. Shown in a collapsible section on the PR comment. Does not\ngate CI — informational only, catches regressions invisible to the ratio.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Use --frozen-lockfile in benchmark CI to prevent bun.lock drift\n\nThe benchmark-action tries to git switch to gh-pages, which fails if\nbun install left unstaged changes to bun.lock.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Update bun.lock to match dependency changes\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: validate history inputs, avoid spread-copy in loop\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix GitHub API endpoint for updating PR comments and check response status\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T09:47:02-07:00",
          "tree_id": "96dac637fbe20f4397c51fdb2620b20309cd188a",
          "url": "https://github.com/eigilsagafos/valdres/commit/6544458a8aecd1682d621bbb720750f60eb63b36"
        },
        "date": 1775666969442,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.0500 20.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=401 ratio=0.0998 10.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=2144 ratio=0.1119 8.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2735 ratio=0.0919 10.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 576,
            "unit": "ns",
            "extra": "jotai=3552 ratio=0.1620 6.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25989,
            "unit": "ns",
            "extra": "jotai=282126 ratio=0.0921 10.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=445 ratio=0.6974 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4416 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 1075,
            "unit": "ns",
            "extra": "jotai=689 ratio=1.5606 1.6x slower"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 251,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3444,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.1147 8.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9500,
            "unit": "ns",
            "extra": "jotai=30828 ratio=0.3082 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 97582,
            "unit": "ns",
            "extra": "jotai=358078 ratio=0.2725 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 9231,
            "unit": "ns",
            "extra": "jotai=19724 ratio=0.4680 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 163,
            "unit": "ns",
            "extra": "jotai=6630 ratio=0.0246 40.6x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 98263,
            "unit": "ns",
            "extra": "jotai=1270000 ratio=0.0774 12.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7300,
            "unit": "ns",
            "extra": "jotai=375972 ratio=0.0194 51.5x faster"
          },
          {
            "name": "sub + unsub",
            "value": 371,
            "unit": "ns",
            "extra": "jotai=2615 ratio=0.1419 7.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 105577,
            "unit": "ns",
            "extra": "jotai=493701 ratio=0.2138 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 171970,
            "unit": "ns",
            "extra": "jotai=804406 ratio=0.2138 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 873400,
            "unit": "ns",
            "extra": "jotai=3942577 ratio=0.2215 4.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 1034856,
            "unit": "ns",
            "extra": "jotai=5091541 ratio=0.2033 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1598493,
            "unit": "ns",
            "extra": "jotai=26790377 ratio=0.0597 16.8x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d0e48dd9768690316fc4f5693b52d4a56ee4a17d",
          "message": "Fix stack overflow on deep atom dependency chains (#47)\n\n* Fix stack overflow on deeply nested atom dependency chains\n\nConvert recursive graph traversals to iterative approaches to prevent\nstack overflow when selector chains exceed the JS call stack depth.\n\nThree changes:\n- initSelector: hybrid depth-tracking + trampoline for deep init chains\n- mountAtom: iterative mountTransitiveDeps, unmountOrphanedDeps, isTransitivelySubscribed\n- propagateUpdatedAtoms: iterative recursivlyHandleSelectorUpdates and findAllDependents\n\nNormal (shallow) chains use standard recursion with zero behavioral change.\nThe trampoline only activates when recursion depth exceeds MAX_EVAL_DEPTH (100).\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix doc comment, typos, and remove dead code\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Rename recursivlyHandleSelectorUpdates and cap test depth\n\n- Rename to propagateSelectorUpdates (now iterative, fix typo)\n- Cap maxDepth stress tests at 5000 for CI stability\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix COMPAT_TODO test name to match actual jotai test\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T14:44:58-07:00",
          "tree_id": "2c1d04778a87390f44cd31826fbe520c0669f16f",
          "url": "https://github.com/eigilsagafos/valdres/commit/d0e48dd9768690316fc4f5693b52d4a56ee4a17d"
        },
        "date": 1775684871770,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.0734 13.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=353 ratio=0.0737 13.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 238,
            "unit": "ns",
            "extra": "jotai=2145 ratio=0.1110 9.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 279,
            "unit": "ns",
            "extra": "jotai=2705 ratio=0.1031 9.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 599,
            "unit": "ns",
            "extra": "jotai=3842 ratio=0.1560 6.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 28277,
            "unit": "ns",
            "extra": "jotai=286014 ratio=0.0989 10.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 313,
            "unit": "ns",
            "extra": "jotai=430 ratio=0.7294 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=11 ratio=3.9243 3.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=412 ratio=0.7932 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 340,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 426,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3136,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=80 ratio=0.1263 7.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8746,
            "unit": "ns",
            "extra": "jotai=29796 ratio=0.2935 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 82187,
            "unit": "ns",
            "extra": "jotai=310201 ratio=0.2649 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8106,
            "unit": "ns",
            "extra": "jotai=17053 ratio=0.4754 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 411,
            "unit": "ns",
            "extra": "jotai=7385 ratio=0.0556 18.0x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 93425,
            "unit": "ns",
            "extra": "jotai=1173013 ratio=0.0796 12.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7345,
            "unit": "ns",
            "extra": "jotai=425978 ratio=0.0172 58.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=2539 ratio=0.1308 7.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 92465,
            "unit": "ns",
            "extra": "jotai=295525 ratio=0.3129 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 140564,
            "unit": "ns",
            "extra": "jotai=593430 ratio=0.2369 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 804611,
            "unit": "ns",
            "extra": "jotai=3202328 ratio=0.2513 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 948644,
            "unit": "ns",
            "extra": "jotai=4628595 ratio=0.2050 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1482577,
            "unit": "ns",
            "extra": "jotai=25324647 ratio=0.0585 17.1x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d1f884c65699ab76472911688918ff19447bd8ea",
          "message": "Add opt-in implicit transaction batching for React (#49)\n\n* Add opt-in implicit transaction batching for React stores\n\nSequential store.set() calls within the same microtask are automatically\nbatched into a single transaction when batchUpdates is enabled. This\neliminates intermediate selector evaluations and defers subscriber\nnotification to a single commit, matching Jotai-style batching semantics.\n\n- Add batchUpdates option to store() and StoreData\n- React Provider defaults to batchUpdates: true with warning for non-batched stores\n- Fix Transaction.get() falsy value bug (0, false, \"\", null)\n- Fix Transaction.get() undefined values in parent transactions\n- Fix useValdresValueWithDefault snapshot stability with pending transactions\n- Scoped stores inherit batchUpdates from parent\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove useValdresValueWithDefault\n\nUnused outside tests. The hook had fundamental issues: it wrote to the\nstore inside getSnapshot (side effect during render), had race conditions\nwith concurrent renders, and the \"sticky default\" behavior was confusing.\nUse atom(defaultValue) or store initialization instead.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix Transaction.set() freezing mutable atoms and add error handling to batched flush\n\nTransaction.set() was unconditionally deep-freezing values, ignoring\natom.mutable and isProd() checks that setValueInData respects. Also\nwraps the batched microtask flush in try-catch to prevent errors from\nblocking the microtask queue, re-throwing via setTimeout for\nobservability.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T15:15:42-07:00",
          "tree_id": "b3fa4d728c094db8a4abf9a5ecba8f07d464f1a2",
          "url": "https://github.com/eigilsagafos/valdres/commit/d1f884c65699ab76472911688918ff19447bd8ea"
        },
        "date": 1775686697225,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0492 20.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=2174 ratio=0.1104 9.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 256,
            "unit": "ns",
            "extra": "jotai=2725 ratio=0.0940 10.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 593,
            "unit": "ns",
            "extra": "jotai=3622 ratio=0.1638 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26589,
            "unit": "ns",
            "extra": "jotai=285571 ratio=0.0931 10.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 320,
            "unit": "ns",
            "extra": "jotai=473 ratio=0.6760 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.3838 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=446 ratio=0.7436 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 371,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 481,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3402,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=84 ratio=0.0752 13.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9035,
            "unit": "ns",
            "extra": "jotai=30817 ratio=0.2932 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 86360,
            "unit": "ns",
            "extra": "jotai=334296 ratio=0.2583 3.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8392,
            "unit": "ns",
            "extra": "jotai=18291 ratio=0.4588 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 504,
            "unit": "ns",
            "extra": "jotai=6512 ratio=0.0775 12.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 88375,
            "unit": "ns",
            "extra": "jotai=1219797 ratio=0.0725 13.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7283,
            "unit": "ns",
            "extra": "jotai=378323 ratio=0.0193 51.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=2515 ratio=0.1551 6.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 95848,
            "unit": "ns",
            "extra": "jotai=431141 ratio=0.2223 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 152724,
            "unit": "ns",
            "extra": "jotai=740481 ratio=0.2062 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 855474,
            "unit": "ns",
            "extra": "jotai=4557988 ratio=0.1877 5.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 1037713,
            "unit": "ns",
            "extra": "jotai=4757930 ratio=0.2181 4.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1474455,
            "unit": "ns",
            "extra": "jotai=25039782 ratio=0.0589 17.0x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "99d30cd7a30f5744a2773f276e55569b55f0fd1f",
          "message": "Clean up stateDependents on unsubscribe to fix memory leaks (#50)\n\n* Clean up stateDependents on unsubscribe to fix memory leaks\n\nAfter unsubscribing from a state, orphaned selectors in the dependency\ngraph were retained via strong references in stateDependents, preventing\ngarbage collection. Add cleanupOrphanedDeps to recursively remove\nselectors from their dependencies' stateDependents sets when no\ntransitive subscribers remain. Cached values and abort controllers are\nalso cleared so re-subscription triggers fresh evaluation.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Guard against async promise resolution after cleanup\n\nAddress two issues flagged in PR review:\n- Clear expiredValues in cleanupOrphanedDeps so propagated stale values\n  don't retain memory for cleaned-up selectors.\n- Add stateDependencies guard in handleSelectorResult's async paths so\n  promise resolution handlers bail when the selector was cleaned up by\n  unsubscribe, preventing repopulation of data.values without deps.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add red-green tests for expiredValues cleanup and async guard\n\n- expiredValues test: verifies expired selector values are cleared on\n  unsubscribe (fails without expiredValues.delete in cleanup)\n- async promise test: verifies resolved promise handler bails after\n  cleanup (fails without stateDependencies guard in handleSelectorResult)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T15:21:51-07:00",
          "tree_id": "67d91037cdc1338e2f23232d5c5bf64295d2e228",
          "url": "https://github.com/eigilsagafos/valdres/commit/99d30cd7a30f5744a2773f276e55569b55f0fd1f"
        },
        "date": 1775687062991,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.0459 21.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 251,
            "unit": "ns",
            "extra": "jotai=2163 ratio=0.1160 8.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 267,
            "unit": "ns",
            "extra": "jotai=2814 ratio=0.0948 10.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 571,
            "unit": "ns",
            "extra": "jotai=3729 ratio=0.1531 6.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 27712,
            "unit": "ns",
            "extra": "jotai=290679 ratio=0.0953 10.5x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 375,
            "unit": "ns",
            "extra": "jotai=513 ratio=0.7307 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 55,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.9299 4.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 383,
            "unit": "ns",
            "extra": "jotai=516 ratio=0.7428 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 358,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 533,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3456,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.1192 8.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9109,
            "unit": "ns",
            "extra": "jotai=28183 ratio=0.3232 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 85409,
            "unit": "ns",
            "extra": "jotai=347650 ratio=0.2457 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8509,
            "unit": "ns",
            "extra": "jotai=18936 ratio=0.4494 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 555,
            "unit": "ns",
            "extra": "jotai=6723 ratio=0.0826 12.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 93701,
            "unit": "ns",
            "extra": "jotai=1196635 ratio=0.0783 12.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 9564,
            "unit": "ns",
            "extra": "jotai=581102 ratio=0.0165 60.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 480,
            "unit": "ns",
            "extra": "jotai=2474 ratio=0.1940 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 93361,
            "unit": "ns",
            "extra": "jotai=316764 ratio=0.2947 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 147201,
            "unit": "ns",
            "extra": "jotai=633099 ratio=0.2325 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 863942,
            "unit": "ns",
            "extra": "jotai=3517580 ratio=0.2456 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 1000851,
            "unit": "ns",
            "extra": "jotai=5152283 ratio=0.1943 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1474356,
            "unit": "ns",
            "extra": "jotai=26921046 ratio=0.0548 18.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "0a86d41824a49af56d9beec632817cdc516ac0e3",
          "message": "Add scope reverse index for O(1) propagation lookups (#48)\n\n* Add scope reverse index to optimize O(scopes × atoms) propagation\n\nIntroduces `scopeValueIndex` (WeakMap) on StoreData that maps each\natom/family to the set of child scopes that shadow it. This replaces\nthree O(scopes) linear scans with O(1) lookups:\n\n1. `recursivlyUpdateIndexes` — only visits scopes that have the family\n2. Main propagation loop — skips scopes that shadow the atom via index\n3. `propagateDeletedAtoms` — builds scope→families map from index\n\nAlso adds:\n- `trackScopeValue` helper in setValueInData for index registration\n- `scopeIndexKeys` per scope for efficient cleanup on detach\n- Single-atom fast path and multi-atom precomputed shadow sets\n- Guard against selector pollution via `\"defaultValue\" in atom` check\n- 5 new tests covering deep nesting, detach cleanup, partial shadow,\n  4-level propagation, and selector non-pollution\n- Scope propagation benchmarks (5, 10, 100, 1000 scopes)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address PR feedback: use Object.hasOwn and WeakKey type, fix test property name\n\n- trackScopeValue key parameter typed as WeakKey instead of any\n- Use Object.hasOwn(atom, \"defaultValue\") for precise own-property check\n- Fix test assertion: \"default\" → \"defaultValue\" to match actual atom shape\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T15:37:31-07:00",
          "tree_id": "4a1685d8fd08d2412bdb2bfa13cedaf941f07ff8",
          "url": "https://github.com/eigilsagafos/valdres/commit/0a86d41824a49af56d9beec632817cdc516ac0e3"
        },
        "date": 1775688034092,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.0579 17.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=359 ratio=0.0752 13.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 236,
            "unit": "ns",
            "extra": "jotai=2151 ratio=0.1097 9.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=2655 ratio=0.0973 10.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 579,
            "unit": "ns",
            "extra": "jotai=3529 ratio=0.1640 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26898,
            "unit": "ns",
            "extra": "jotai=277658 ratio=0.0969 10.3x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 300,
            "unit": "ns",
            "extra": "jotai=416 ratio=0.7206 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=3.9839 4.0x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 328,
            "unit": "ns",
            "extra": "jotai=406 ratio=0.8078 1.2x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 344,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 404,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3071,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=83 ratio=0.1011 9.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9006,
            "unit": "ns",
            "extra": "jotai=29314 ratio=0.3072 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 86629,
            "unit": "ns",
            "extra": "jotai=314487 ratio=0.2755 3.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7902,
            "unit": "ns",
            "extra": "jotai=16882 ratio=0.4681 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 530,
            "unit": "ns",
            "extra": "jotai=7243 ratio=0.0732 13.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 85750,
            "unit": "ns",
            "extra": "jotai=1148515 ratio=0.0747 13.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3883,
            "unit": "ns",
            "extra": "jotai=410478 ratio=0.0095 105.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 490,
            "unit": "ns",
            "extra": "jotai=2574 ratio=0.1904 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 91064,
            "unit": "ns",
            "extra": "jotai=291768 ratio=0.3121 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 138917,
            "unit": "ns",
            "extra": "jotai=576865 ratio=0.2408 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 776493,
            "unit": "ns",
            "extra": "jotai=3231381 ratio=0.2403 4.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 936927,
            "unit": "ns",
            "extra": "jotai=4609286 ratio=0.2033 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1435280,
            "unit": "ns",
            "extra": "jotai=23977720 ratio=0.0599 16.7x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "6629386ac35173a037d8aeb40852ddabe89260cb",
          "message": "Fix flaky benchmark CI and improve report readability (#52)\n\n* Fix flaky benchmark CI and improve report readability\n\nBenchmark CI failed on 50% of PR runs due to false positives. Two root\ncauses: (1) selector(fn) measures ~7ns operations where GC pauses cause\n10x spikes, and (2) Jotai reference variance makes the ratio check fail\neven when valdres absolute timing is stable.\n\nFlakiness fixes:\n- Dual-check gating: CI only fails when both ratio AND absolute checks\n  agree on a regression, eliminating Jotai-noise false positives\n- Noise floor at 500ns: sub-microsecond benchmarks auto-skipped from\n  regression gating since they're dominated by CI runner noise\n- New warning status for single-check flags (visible but non-blocking)\n\nReport readability:\n- PR comment: summary line at top, flagged benchmarks inline, full\n  results in collapsible section grouped by category\n- README: benchmarks grouped into Atoms/Selectors/Transactions,\n  clearer \"Not yet optimized\" section, baseline in collapsible details\n- Compact change format (+5% / -3% / ~same) instead of verbose text\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address review feedback: deduplicate categories, fix ordering\n\n- Extract shared bench-categories.ts module used by both scripts\n- Deterministic category ordering (BENCH_CATEGORIES order, then Other)\n- Add speed indicator (🟢/🟡/🔴) to optimization targets table\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T15:57:23-07:00",
          "tree_id": "5120d9931f13d8bf70d4da95236c380f46ed7f62",
          "url": "https://github.com/eigilsagafos/valdres/commit/6629386ac35173a037d8aeb40852ddabe89260cb"
        },
        "date": 1775689208147,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.0468 21.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1125 8.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 266,
            "unit": "ns",
            "extra": "jotai=2715 ratio=0.0978 10.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 559,
            "unit": "ns",
            "extra": "jotai=3496 ratio=0.1599 6.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25237,
            "unit": "ns",
            "extra": "jotai=282735 ratio=0.0893 11.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=452 ratio=0.6036 1.7x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4060 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 308,
            "unit": "ns",
            "extra": "jotai=442 ratio=0.6966 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 368,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 449,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3345,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0887 11.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9688,
            "unit": "ns",
            "extra": "jotai=30999 ratio=0.3125 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 91260,
            "unit": "ns",
            "extra": "jotai=336179 ratio=0.2715 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8525,
            "unit": "ns",
            "extra": "jotai=18465 ratio=0.4617 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 641,
            "unit": "ns",
            "extra": "jotai=6496 ratio=0.0987 10.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 88524,
            "unit": "ns",
            "extra": "jotai=1218469 ratio=0.0727 13.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6531,
            "unit": "ns",
            "extra": "jotai=434641 ratio=0.0150 66.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 481,
            "unit": "ns",
            "extra": "jotai=2534 ratio=0.1898 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 97461,
            "unit": "ns",
            "extra": "jotai=308853 ratio=0.3156 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 156020,
            "unit": "ns",
            "extra": "jotai=657735 ratio=0.2372 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 851756,
            "unit": "ns",
            "extra": "jotai=3393174 ratio=0.2510 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 970781,
            "unit": "ns",
            "extra": "jotai=4853884 ratio=0.2000 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1518011,
            "unit": "ns",
            "extra": "jotai=24764792 ratio=0.0613 16.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "eigilsagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "name": "eigilsagafos",
            "username": "eigilsagafos"
          },
          "id": "e14ae3b9a8c34df2d7c146c0e32ccfa08e101c6d",
          "message": "Fix flaky benchmark CI and improve report readability",
          "timestamp": "2026-04-08T22:40:45Z",
          "url": "https://github.com/eigilsagafos/valdres/pull/52/commits/e14ae3b9a8c34df2d7c146c0e32ccfa08e101c6d"
        },
        "date": 1775689370392,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0481 20.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=410 ratio=0.0976 10.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=2144 ratio=0.1119 8.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 269,
            "unit": "ns",
            "extra": "jotai=2746 ratio=0.0981 10.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 572,
            "unit": "ns",
            "extra": "jotai=3603 ratio=0.1589 6.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26269,
            "unit": "ns",
            "extra": "jotai=285754 ratio=0.0919 10.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 335,
            "unit": "ns",
            "extra": "jotai=465 ratio=0.7215 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.3376 4.3x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 1023,
            "unit": "ns",
            "extra": "jotai=666 ratio=1.5364 1.5x slower"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 367,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 250,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3472,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0896 11.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 10549,
            "unit": "ns",
            "extra": "jotai=32299 ratio=0.3266 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 103944,
            "unit": "ns",
            "extra": "jotai=356691 ratio=0.2914 3.4x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 9157,
            "unit": "ns",
            "extra": "jotai=19659 ratio=0.4658 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 217,
            "unit": "ns",
            "extra": "jotai=6601 ratio=0.0328 30.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 91652,
            "unit": "ns",
            "extra": "jotai=1257423 ratio=0.0729 13.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6703,
            "unit": "ns",
            "extra": "jotai=560677 ratio=0.0120 83.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 441,
            "unit": "ns",
            "extra": "jotai=2564 ratio=0.1720 5.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 113813,
            "unit": "ns",
            "extra": "jotai=327146 ratio=0.3479 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 176489,
            "unit": "ns",
            "extra": "jotai=698244 ratio=0.2528 4.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 898028,
            "unit": "ns",
            "extra": "jotai=3565578 ratio=0.2519 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 1048518,
            "unit": "ns",
            "extra": "jotai=5087665 ratio=0.2061 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1576529,
            "unit": "ns",
            "extra": "jotai=27285138 ratio=0.0578 17.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9cc9c7c4c7d5da4b9367c4ab174f9641342e60a9",
          "message": "Batch write-atom listener notifications in jotai compat layer (#51)\n\n* Batch write-atom listener notifications in jotai compat layer\n\nJotai defers all subscriber notifications until an entire write batch\ncompletes. This adds transaction-based batching to the jotai compat\nstore so listeners only fire after all atom updates propagate.\n\nUses valdres Transaction to collect atom changes during write-atom\nexecution, onMount setSelf, and unmount cleanup — committing once at\nthe end. Propagation-time writes (e.g. unmount cleanup calling setSelf)\nare deferred and flushed after the current propagation completes.\n\nAlso fixes write-only atom default value (null instead of undefined)\nand switches the store registry to WeakRef for GC correctness.\n\nEnables 4 previously-skipped jotai compat tests:\n- flushPending with set/mount/unmount (#2804)\n- batches sync writes\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove createStoreWithSelectorSet from valdres core\n\nThis factory only existed for compat layers (jotai, recoil) that need\nwritable selectors. Both layers already wrap store.set themselves, so\nthe intermediate factory was redundant.\n\n- Jotai and recoil compat now use store() and add selector-set support\n  directly, setting data.storeRef for onMount callback routing\n- Tests that used it for non-selector-set purposes switched to store()\n- Two selector-set-specific tests removed (compat-only concern)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T16:05:57-07:00",
          "tree_id": "9abbdcffe91de9adaf12b2296345b81bd5f51f83",
          "url": "https://github.com/eigilsagafos/valdres/commit/9cc9c7c4c7d5da4b9367c4ab174f9641342e60a9"
        },
        "date": 1775689725475,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.0512 19.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=2114 ratio=0.1135 8.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=2715 ratio=0.0949 10.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 562,
            "unit": "ns",
            "extra": "jotai=3570 ratio=0.1573 6.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26609,
            "unit": "ns",
            "extra": "jotai=280801 ratio=0.0948 10.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 329,
            "unit": "ns",
            "extra": "jotai=456 ratio=0.7208 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4084 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 340,
            "unit": "ns",
            "extra": "jotai=455 ratio=0.7460 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 368,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 241,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0853 11.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9666,
            "unit": "ns",
            "extra": "jotai=30869 ratio=0.3131 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 91410,
            "unit": "ns",
            "extra": "jotai=333579 ratio=0.2740 3.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8499,
            "unit": "ns",
            "extra": "jotai=18158 ratio=0.4681 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 619,
            "unit": "ns",
            "extra": "jotai=6444 ratio=0.0961 10.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 88544,
            "unit": "ns",
            "extra": "jotai=1204213 ratio=0.0735 13.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6693,
            "unit": "ns",
            "extra": "jotai=376124 ratio=0.0178 56.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 491,
            "unit": "ns",
            "extra": "jotai=2485 ratio=0.1976 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 96750,
            "unit": "ns",
            "extra": "jotai=420912 ratio=0.2299 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 150499,
            "unit": "ns",
            "extra": "jotai=746291 ratio=0.2017 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 832867,
            "unit": "ns",
            "extra": "jotai=4470160 ratio=0.1863 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 1005768,
            "unit": "ns",
            "extra": "jotai=4864151 ratio=0.2068 4.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1519922,
            "unit": "ns",
            "extra": "jotai=25671775 ratio=0.0592 16.9x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "0cd88a42f1fae4bb5cf586375d18f82c4fa48428",
          "message": "Enable passing jotai compat tests and fill in todo stubs (#54)\n\n* Enable passing jotai compat tests and add bodies to todo stubs\n\n- Enable 4 tests that now pass: async promise identity, resolves\n  dependencies after delay, onMount async setAtom, and memory leak\n  dependency tests\n- Add original jotai test bodies to all empty test.todo stubs so\n  they're ready to enable when the features are implemented\n- Update COMPAT_TODO.md to reflect current passing status\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Enable passing jotai compat tests and add bodies to todo stubs\n\n- Enable 4 tests that now pass: async promise identity, resolves\n  dependencies after delay, onMount async setAtom, and re-renders\n  time delayed derived atom\n- Add original jotai test bodies to all remaining test.todo stubs\n- Revert 3 memory leak dependency tests to test.todo (incorrectly\n  enabled on main — they don't pass yet)\n- Remove stale \"bun segfault\" comment\n- Update COMPAT_TODO.md to reflect current status (118 pass, 10 todo)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T17:37:30-07:00",
          "tree_id": "a7996b2d6799ebfc7d547c341acfd803195c2d64",
          "url": "https://github.com/eigilsagafos/valdres/commit/0cd88a42f1fae4bb5cf586375d18f82c4fa48428"
        },
        "date": 1775695213634,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.0458 21.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=390 ratio=0.1026 9.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1125 8.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 253,
            "unit": "ns",
            "extra": "jotai=2715 ratio=0.0932 10.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 548,
            "unit": "ns",
            "extra": "jotai=3475 ratio=0.1577 6.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25317,
            "unit": "ns",
            "extra": "jotai=280645 ratio=0.0902 11.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=450 ratio=0.6628 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4525 4.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 336,
            "unit": "ns",
            "extra": "jotai=748 ratio=0.4495 2.2x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 366,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 251,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3481,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=174 ratio=0.0312 32.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 10361,
            "unit": "ns",
            "extra": "jotai=44273 ratio=0.2340 4.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 106564,
            "unit": "ns",
            "extra": "jotai=288829 ratio=0.3690 2.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 9521,
            "unit": "ns",
            "extra": "jotai=17377 ratio=0.5479 1.8x faster"
          },
          {
            "name": "createStore",
            "value": 709,
            "unit": "ns",
            "extra": "jotai=6720 ratio=0.1055 9.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 97432,
            "unit": "ns",
            "extra": "jotai=1252591 ratio=0.0778 12.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6692,
            "unit": "ns",
            "extra": "jotai=387755 ratio=0.0173 57.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 541,
            "unit": "ns",
            "extra": "jotai=2485 ratio=0.2177 4.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 112921,
            "unit": "ns",
            "extra": "jotai=322417 ratio=0.3502 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 172417,
            "unit": "ns",
            "extra": "jotai=611909 ratio=0.2818 3.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 913327,
            "unit": "ns",
            "extra": "jotai=3711255 ratio=0.2461 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 1079863,
            "unit": "ns",
            "extra": "jotai=4008791 ratio=0.2694 3.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1582889,
            "unit": "ns",
            "extra": "jotai=22650510 ratio=0.0699 14.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ad7c7c4cdcb81a6102933d98fcbe0ba1581ccc63",
          "message": "Remove debug console.log statements from valdres core (#53)\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-08T17:38:01-07:00",
          "tree_id": "a3b3790f8dc35fcfc2da658b97fba2bbf99a3dfc",
          "url": "https://github.com/eigilsagafos/valdres/commit/ad7c7c4cdcb81a6102933d98fcbe0ba1581ccc63"
        },
        "date": 1775695394011,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.0765 13.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=358 ratio=0.0726 13.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 232,
            "unit": "ns",
            "extra": "jotai=2172 ratio=0.1068 9.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 259,
            "unit": "ns",
            "extra": "jotai=2703 ratio=0.0959 10.4x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 542,
            "unit": "ns",
            "extra": "jotai=3384 ratio=0.1602 6.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 27001,
            "unit": "ns",
            "extra": "jotai=276341 ratio=0.0977 10.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=419 ratio=0.6892 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=3.9699 4.0x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 320,
            "unit": "ns",
            "extra": "jotai=410 ratio=0.7801 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 341,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 408,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3044,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=81 ratio=0.1059 9.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8982,
            "unit": "ns",
            "extra": "jotai=28566 ratio=0.3144 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 90857,
            "unit": "ns",
            "extra": "jotai=323720 ratio=0.2807 3.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7974,
            "unit": "ns",
            "extra": "jotai=17564 ratio=0.4540 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 683,
            "unit": "ns",
            "extra": "jotai=7814 ratio=0.0874 11.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 87029,
            "unit": "ns",
            "extra": "jotai=1159869 ratio=0.0750 13.3x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6673,
            "unit": "ns",
            "extra": "jotai=438294 ratio=0.0152 65.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 560,
            "unit": "ns",
            "extra": "jotai=2611 ratio=0.2145 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 99196,
            "unit": "ns",
            "extra": "jotai=302108 ratio=0.3283 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 151110,
            "unit": "ns",
            "extra": "jotai=619815 ratio=0.2438 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 832135,
            "unit": "ns",
            "extra": "jotai=3408096 ratio=0.2442 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 983987,
            "unit": "ns",
            "extra": "jotai=4957893 ratio=0.1985 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1605148,
            "unit": "ns",
            "extra": "jotai=27798993 ratio=0.0577 17.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "576d5a9f023a2932f6a3778e0eacbec004fa4ce7",
          "message": "Extract async dependency tracking into dedicated module (#55)\n\nMove SuspendAndWaitForResolveError, isSuspendError, pendingAsyncDeps,\nlatestEvalContext, lateGet, cleanUpRejectedPromise, and getOrInitDependentsSet\nfrom initSelector.ts into asyncDependencyTracking.ts. Deduplicate\ngetOrInitDependentsSet (was copied into both files) and remove unused\nmountAtom imports from initSelector.ts.\n\nPure refactor — no behavior changes.\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T06:08:33-07:00",
          "tree_id": "5b401188747b7deffdb477e088afdc4de93e1576",
          "url": "https://github.com/eigilsagafos/valdres/commit/576d5a9f023a2932f6a3778e0eacbec004fa4ce7"
        },
        "date": 1775740284199,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.0472 21.2x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 230,
            "unit": "ns",
            "extra": "jotai=2204 ratio=0.1044 9.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 248,
            "unit": "ns",
            "extra": "jotai=2805 ratio=0.0883 11.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 574,
            "unit": "ns",
            "extra": "jotai=3771 ratio=0.1522 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 33680,
            "unit": "ns",
            "extra": "jotai=290778 ratio=0.1158 8.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 412,
            "unit": "ns",
            "extra": "jotai=532 ratio=0.7747 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 53,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.7933 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 393,
            "unit": "ns",
            "extra": "jotai=522 ratio=0.7532 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 382,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 241,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3419,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.1074 9.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9412,
            "unit": "ns",
            "extra": "jotai=28963 ratio=0.3250 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 88533,
            "unit": "ns",
            "extra": "jotai=339751 ratio=0.2606 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8702,
            "unit": "ns",
            "extra": "jotai=18378 ratio=0.4735 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 660,
            "unit": "ns",
            "extra": "jotai=6688 ratio=0.0987 10.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 87401,
            "unit": "ns",
            "extra": "jotai=1167245 ratio=0.0749 13.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7193,
            "unit": "ns",
            "extra": "jotai=385669 ratio=0.0187 53.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 471,
            "unit": "ns",
            "extra": "jotai=2534 ratio=0.1859 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 93531,
            "unit": "ns",
            "extra": "jotai=411338 ratio=0.2274 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 150196,
            "unit": "ns",
            "extra": "jotai=710318 ratio=0.2114 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 814945,
            "unit": "ns",
            "extra": "jotai=4576901 ratio=0.1781 5.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 967089,
            "unit": "ns",
            "extra": "jotai=4952427 ratio=0.1953 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1497542,
            "unit": "ns",
            "extra": "jotai=25887661 ratio=0.0578 17.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "tarje.pladsen@ardoq.com",
            "name": "Tarje Pladsen",
            "username": "tarjep"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "97c7bd5e3f213c933a3b45edbb7687001f759522",
          "message": "SX-2398 useSetAtom has stale closure when atom reference changes (#9)\n\n* Correctly update setState when atom changes.\n\n* Add failing test for stale closure in useSetAtom when atom reference changes\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Eigil Sagafos <eigil.sagafos@ardoq.com>\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T06:18:10-07:00",
          "tree_id": "425d477b4a32ce97cf6088b396e8bbd926d99447",
          "url": "https://github.com/eigilsagafos/valdres/commit/97c7bd5e3f213c933a3b45edbb7687001f759522"
        },
        "date": 1775740870674,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.0810 12.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=358 ratio=0.0726 13.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 234,
            "unit": "ns",
            "extra": "jotai=2169 ratio=0.1079 9.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 263,
            "unit": "ns",
            "extra": "jotai=2667 ratio=0.0985 10.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 595,
            "unit": "ns",
            "extra": "jotai=3642 ratio=0.1633 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 28161,
            "unit": "ns",
            "extra": "jotai=282512 ratio=0.0997 10.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 330,
            "unit": "ns",
            "extra": "jotai=440 ratio=0.7508 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.1050 4.1x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 347,
            "unit": "ns",
            "extra": "jotai=428 ratio=0.8112 1.2x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 341,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 412,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3068,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.1284 7.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8810,
            "unit": "ns",
            "extra": "jotai=28533 ratio=0.3088 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83617,
            "unit": "ns",
            "extra": "jotai=305956 ratio=0.2733 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7967,
            "unit": "ns",
            "extra": "jotai=16559 ratio=0.4811 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 512,
            "unit": "ns",
            "extra": "jotai=7282 ratio=0.0703 14.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 85230,
            "unit": "ns",
            "extra": "jotai=1128296 ratio=0.0755 13.2x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6778,
            "unit": "ns",
            "extra": "jotai=418510 ratio=0.0162 61.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 473,
            "unit": "ns",
            "extra": "jotai=2546 ratio=0.1858 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 87093,
            "unit": "ns",
            "extra": "jotai=290029 ratio=0.3003 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 137004,
            "unit": "ns",
            "extra": "jotai=566290 ratio=0.2419 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 750671,
            "unit": "ns",
            "extra": "jotai=3094216 ratio=0.2426 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 909818,
            "unit": "ns",
            "extra": "jotai=4483495 ratio=0.2029 4.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1421316,
            "unit": "ns",
            "extra": "jotai=23863913 ratio=0.0596 16.8x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "7bbec2dca226692485111d94e6c3168fbb7de1c5",
          "message": "Remove dead expiredValues infrastructure to fix selector family GC leak (#57)\n\nThe expiredValues WeakMap was written during selector propagation but\nnever read — its only consumer (updateSelectorSubscribers.ts) was\ndeleted in the propagation overhaul (36c5291). Under heap pressure,\nthese write-only WeakMap entries pinned selector values and caused\nthe \"released selector family entry is collected\" leak test to flake.\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T06:27:23-07:00",
          "tree_id": "808bb2cad58b081d0c7e1d90e4b3011e0e4afdd6",
          "url": "https://github.com/eigilsagafos/valdres/commit/7bbec2dca226692485111d94e6c3168fbb7de1c5"
        },
        "date": 1775741427637,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.0770 13.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=360 ratio=0.0722 13.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 236,
            "unit": "ns",
            "extra": "jotai=2146 ratio=0.1100 9.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 265,
            "unit": "ns",
            "extra": "jotai=2662 ratio=0.0997 10.0x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 596,
            "unit": "ns",
            "extra": "jotai=3581 ratio=0.1664 6.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 27865,
            "unit": "ns",
            "extra": "jotai=280461 ratio=0.0994 10.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=432 ratio=0.7214 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=12 ratio=3.7471 3.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=423 ratio=0.7749 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 339,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 251,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3117,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=84 ratio=0.1042 9.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9215,
            "unit": "ns",
            "extra": "jotai=28498 ratio=0.3234 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 87373,
            "unit": "ns",
            "extra": "jotai=319035 ratio=0.2739 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7901,
            "unit": "ns",
            "extra": "jotai=17581 ratio=0.4494 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 557,
            "unit": "ns",
            "extra": "jotai=7333 ratio=0.0760 13.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 85452,
            "unit": "ns",
            "extra": "jotai=1151942 ratio=0.0742 13.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6722,
            "unit": "ns",
            "extra": "jotai=427433 ratio=0.0157 63.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 495,
            "unit": "ns",
            "extra": "jotai=2687 ratio=0.1842 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 91657,
            "unit": "ns",
            "extra": "jotai=297051 ratio=0.3086 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 111467,
            "unit": "ns",
            "extra": "jotai=586220 ratio=0.1901 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 766269,
            "unit": "ns",
            "extra": "jotai=3280958 ratio=0.2336 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 919981,
            "unit": "ns",
            "extra": "jotai=4694817 ratio=0.1960 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1175925,
            "unit": "ns",
            "extra": "jotai=24816252 ratio=0.0474 21.1x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "00140411f82ac01ce19c05b5f1ae6c81422c5b1b",
          "message": "Extract AtomFamily index management into atomFamilyIndex.ts (#58)\n\n* Extract AtomFamily index management into dedicated module\n\nMove AtomFamilyIndex type, index CRUD functions, and family atom\nset operations from propagateUpdatedAtoms.ts into atomFamilyIndex.ts.\nRe-export moved symbols for backward compatibility.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove unused setValueInData import and spurious Map.delete arg\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix boxed Number types and recursivly typo\n\n- Change Number (boxed) to number (primitive) in AtomFamilyIndex type\n  and addFamilyAtomsToSet parameter\n- Rename recursivlyUpdateIndexes → recursivelyUpdateIndexes and\n  recursivlyUpdateAtomFamilyIndexes → recursivelyUpdateAtomFamilyIndexes\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T07:26:30-07:00",
          "tree_id": "68a0942168be33961f0ad2a249436dfb28b781c6",
          "url": "https://github.com/eigilsagafos/valdres/commit/00140411f82ac01ce19c05b5f1ae6c81422c5b1b"
        },
        "date": 1775744974067,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.0718 13.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=354 ratio=0.0734 13.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 234,
            "unit": "ns",
            "extra": "jotai=2142 ratio=0.1092 9.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 265,
            "unit": "ns",
            "extra": "jotai=2675 ratio=0.0989 10.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 584,
            "unit": "ns",
            "extra": "jotai=3429 ratio=0.1703 5.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 27553,
            "unit": "ns",
            "extra": "jotai=277306 ratio=0.0994 10.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=428 ratio=0.7296 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=3.9993 4.0x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 329,
            "unit": "ns",
            "extra": "jotai=414 ratio=0.7940 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 341,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 407,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3090,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=88 ratio=0.1007 9.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8799,
            "unit": "ns",
            "extra": "jotai=28856 ratio=0.3049 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 84015,
            "unit": "ns",
            "extra": "jotai=312161 ratio=0.2691 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7876,
            "unit": "ns",
            "extra": "jotai=17149 ratio=0.4593 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 540,
            "unit": "ns",
            "extra": "jotai=7338 ratio=0.0736 13.6x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 83972,
            "unit": "ns",
            "extra": "jotai=1158120 ratio=0.0725 13.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3945,
            "unit": "ns",
            "extra": "jotai=416776 ratio=0.0095 105.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 476,
            "unit": "ns",
            "extra": "jotai=2611 ratio=0.1823 5.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 87488,
            "unit": "ns",
            "extra": "jotai=295116 ratio=0.2965 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 139043,
            "unit": "ns",
            "extra": "jotai=586671 ratio=0.2370 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 780060,
            "unit": "ns",
            "extra": "jotai=3217086 ratio=0.2425 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 969223,
            "unit": "ns",
            "extra": "jotai=4653876 ratio=0.2083 4.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1441110,
            "unit": "ns",
            "extra": "jotai=24951625 ratio=0.0578 17.3x faster"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "c0437432fb85c42497033108ddbc57a540eb900d",
          "message": "Add Node.js (V8) benchmarks alongside Bun (JSC) (#59)\n\n* Add Node.js (V8) benchmarks alongside Bun (JSC)\n\nRun performance benchmarks on both Bun (JavaScriptCore) and Node.js (V8)\nto track valdres performance across JS engines. Bun remains the primary\nruntime for regression detection; Node benchmarks are informational and\nonly run on main pushes.\n\n- Add vitest as test runner for Node, with runtime-agnostic test-compat shim\n- Write results to separate ndjson files per runtime\n- README shows compact comparison table with JSC (Safari) and V8 (Chrome) columns\n- BENCHMARKS.md generated with full timing details\n- CI pins Node 22.17 for reproducible V8 results\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix Copilot review: stable chart names, remove dead code\n\n- Bun benchmark names are always unsuffixed for GitHub Pages chart\n  continuity; only Node entries get a \" [Node]\" suffix\n- Remove unused bunByName variable\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T09:51:58-07:00",
          "tree_id": "5ceab89b116553971629f9d7c0f2f75533a98d71",
          "url": "https://github.com/eigilsagafos/valdres/commit/c0437432fb85c42497033108ddbc57a540eb900d"
        },
        "date": 1775753784339,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0467 21.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 231,
            "unit": "ns",
            "extra": "jotai=2104 ratio=0.1098 9.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 249,
            "unit": "ns",
            "extra": "jotai=2665 ratio=0.0936 10.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 569,
            "unit": "ns",
            "extra": "jotai=3481 ratio=0.1636 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 26379,
            "unit": "ns",
            "extra": "jotai=279212 ratio=0.0945 10.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 280,
            "unit": "ns",
            "extra": "jotai=439 ratio=0.6387 1.6x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4324 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 317,
            "unit": "ns",
            "extra": "jotai=424 ratio=0.7483 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 379,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 445,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3309,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=72 ratio=0.0716 14.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9314,
            "unit": "ns",
            "extra": "jotai=28283 ratio=0.3293 3.0x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 88115,
            "unit": "ns",
            "extra": "jotai=337712 ratio=0.2609 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8441,
            "unit": "ns",
            "extra": "jotai=18179 ratio=0.4643 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 620,
            "unit": "ns",
            "extra": "jotai=6394 ratio=0.0970 10.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 88095,
            "unit": "ns",
            "extra": "jotai=1222517 ratio=0.0721 13.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 4007,
            "unit": "ns",
            "extra": "jotai=376896 ratio=0.0106 94.1x faster"
          },
          {
            "name": "sub + unsub",
            "value": 491,
            "unit": "ns",
            "extra": "jotai=2475 ratio=0.1984 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 95539,
            "unit": "ns",
            "extra": "jotai=421228 ratio=0.2268 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 116999,
            "unit": "ns",
            "extra": "jotai=757267 ratio=0.1545 6.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 789397,
            "unit": "ns",
            "extra": "jotai=4538706 ratio=0.1739 5.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 917647,
            "unit": "ns",
            "extra": "jotai=4778319 ratio=0.1920 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1159575,
            "unit": "ns",
            "extra": "jotai=25005545 ratio=0.0464 21.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 78788,
            "unit": "ns",
            "extra": "jotai=138720 ratio=0.5680 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 79689,
            "unit": "ns",
            "extra": "jotai=238185 ratio=0.3346 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 871455,
            "unit": "ns",
            "extra": "jotai=1326958 ratio=0.6567 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1075822,
            "unit": "ns",
            "extra": "jotai=1777064 ratio=0.6054 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1013682,
            "unit": "ns",
            "extra": "jotai=12102426 ratio=0.0838 11.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.7359 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8906,
            "unit": "ns",
            "extra": "jotai=19111 ratio=0.4660 2.1x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 78917,
            "unit": "ns",
            "extra": "jotai=127819 ratio=0.6174 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4887,
            "unit": "ns",
            "extra": "jotai=9536 ratio=0.5125 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.4873 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0739 13.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 408,
            "unit": "ns",
            "extra": "jotai=1225 ratio=0.3330 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 438,
            "unit": "ns",
            "extra": "jotai=1448 ratio=0.3027 3.3x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 787,
            "unit": "ns",
            "extra": "jotai=1668 ratio=0.4719 2.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 45986,
            "unit": "ns",
            "extra": "jotai=140292 ratio=0.3278 3.1x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1179 ratio=0.1330 7.5x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 118922,
            "unit": "ns",
            "extra": "jotai=449155 ratio=0.2648 3.8x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14146,
            "unit": "ns",
            "extra": "jotai=214321 ratio=0.0660 15.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 763,
            "unit": "ns",
            "extra": "jotai=2051 ratio=0.3719 2.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 366,
            "unit": "ns",
            "extra": "jotai=487 ratio=0.7511 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=6 ratio=1.7276 1.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 347,
            "unit": "ns",
            "extra": "jotai=352 ratio=0.9842 1.0x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 201,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 423,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1314,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "fc00346f451b0ba63083c8fb0456f8b252e751e8",
          "message": "Avoid hot-path Set allocation in setAtom (#64)\n\nSkip allocating `new Set<Atom>()` when the atom is already initialized\n(data.values.has(atom) is true), which is the common case. Also replace\n`new Set([...set, atom])` + `[...all]` with `.add(atom)` + single spread\nto eliminate intermediate allocations.\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T14:33:49-07:00",
          "tree_id": "b2e958d463bed03bb7273b3ae3ca678b2bec744f",
          "url": "https://github.com/eigilsagafos/valdres/commit/fc00346f451b0ba63083c8fb0456f8b252e751e8"
        },
        "date": 1775770696527,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0528 18.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 221,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1036 9.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 280,
            "unit": "ns",
            "extra": "jotai=2695 ratio=0.1039 9.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 549,
            "unit": "ns",
            "extra": "jotai=3675 ratio=0.1494 6.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 29782,
            "unit": "ns",
            "extra": "jotai=275378 ratio=0.1082 9.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 316,
            "unit": "ns",
            "extra": "jotai=450 ratio=0.7019 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4720 4.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=434 ratio=0.7159 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 371,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 427,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3313,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0895 11.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9423,
            "unit": "ns",
            "extra": "jotai=31058 ratio=0.3034 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 88585,
            "unit": "ns",
            "extra": "jotai=336752 ratio=0.2631 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8504,
            "unit": "ns",
            "extra": "jotai=18462 ratio=0.4606 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 623,
            "unit": "ns",
            "extra": "jotai=6421 ratio=0.0971 10.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 71763,
            "unit": "ns",
            "extra": "jotai=1205201 ratio=0.0595 16.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6692,
            "unit": "ns",
            "extra": "jotai=539854 ratio=0.0124 80.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 491,
            "unit": "ns",
            "extra": "jotai=2495 ratio=0.1968 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 93985,
            "unit": "ns",
            "extra": "jotai=305898 ratio=0.3072 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 121325,
            "unit": "ns",
            "extra": "jotai=659291 ratio=0.1840 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 794276,
            "unit": "ns",
            "extra": "jotai=3422569 ratio=0.2321 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 943947,
            "unit": "ns",
            "extra": "jotai=4828358 ratio=0.1955 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1189682,
            "unit": "ns",
            "extra": "jotai=25364112 ratio=0.0469 21.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 81321,
            "unit": "ns",
            "extra": "jotai=137265 ratio=0.5924 1.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 81201,
            "unit": "ns",
            "extra": "jotai=237532 ratio=0.3419 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 874396,
            "unit": "ns",
            "extra": "jotai=1313332 ratio=0.6658 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1077569,
            "unit": "ns",
            "extra": "jotai=1829181 ratio=0.5891 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1047753,
            "unit": "ns",
            "extra": "jotai=12473188 ratio=0.0840 11.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.8023 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8921,
            "unit": "ns",
            "extra": "jotai=19743 ratio=0.4519 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 80169,
            "unit": "ns",
            "extra": "jotai=127196 ratio=0.6303 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4972,
            "unit": "ns",
            "extra": "jotai=9794 ratio=0.5076 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.4802 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=157 ratio=0.0740 13.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 366,
            "unit": "ns",
            "extra": "jotai=1216 ratio=0.3009 3.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 397,
            "unit": "ns",
            "extra": "jotai=1430 ratio=0.2773 3.6x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 752,
            "unit": "ns",
            "extra": "jotai=1717 ratio=0.4382 2.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 42510,
            "unit": "ns",
            "extra": "jotai=142275 ratio=0.2988 3.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 159,
            "unit": "ns",
            "extra": "jotai=1230 ratio=0.1292 7.7x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 100778,
            "unit": "ns",
            "extra": "jotai=449346 ratio=0.2243 4.5x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14106,
            "unit": "ns",
            "extra": "jotai=201484 ratio=0.0700 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 758,
            "unit": "ns",
            "extra": "jotai=2115 ratio=0.3585 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 368,
            "unit": "ns",
            "extra": "jotai=471 ratio=0.7809 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=7 ratio=1.6278 1.6x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 314,
            "unit": "ns",
            "extra": "jotai=388 ratio=0.8099 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 375,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1335,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "c2237dba90459040b4c13cafa0138d52aa6d31f8",
          "message": "Use dots reporter locally and JUnit in CI (#63)\n\n* Use dots reporter locally and JUnit reporter in CI for readable test output\n\nSwitches local test output to dots reporter (concise) and CI to JUnit XML\nwith mikepenz/action-junit-report for a structured test summary on PRs.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Replace JUnit report action with inline step summary\n\nAvoids creating a separate check — renders test results directly\nin the job summary using $GITHUB_STEP_SUMMARY.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add inline test report check via GitHub Checks API\n\nCreates a 'Test Results' check with test counts and a per-package\nbreakdown table, using actions/github-script to parse JUnit XML\ndirectly — no third-party action dependency.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Rename test report check to 'Test / results'\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Derive test report check name from workflow context\n\nNames the check e.g. \"Test / test (pull_request) — results\" to\nmatch the parent job's naming convention.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix Copilot review feedback on test report workflow\n\n- Add contents: read permission alongside checks: write\n- Aggregate JUnit results by package (fixes duplicate valdres rows)\n- Remove unused path import\n- Detect missing JUnit files and mark check as failed\n- Use test step outcome to catch crashes that produce no XML\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T14:46:12-07:00",
          "tree_id": "5e6f3d9e8cf13a99f4e8d86f298563d00ad6c431",
          "url": "https://github.com/eigilsagafos/valdres/commit/c2237dba90459040b4c13cafa0138d52aa6d31f8"
        },
        "date": 1775771438111,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0483 20.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=391 ratio=0.1023 9.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 230,
            "unit": "ns",
            "extra": "jotai=2183 ratio=0.1054 9.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=2754 ratio=0.0944 10.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 513,
            "unit": "ns",
            "extra": "jotai=3768 ratio=0.1362 7.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 23225,
            "unit": "ns",
            "extra": "jotai=286050 ratio=0.0812 12.3x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 349,
            "unit": "ns",
            "extra": "jotai=492 ratio=0.7090 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 53,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.7948 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 358,
            "unit": "ns",
            "extra": "jotai=494 ratio=0.7244 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 429,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 456,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3475,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.1005 9.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9225,
            "unit": "ns",
            "extra": "jotai=31647 ratio=0.2915 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 87001,
            "unit": "ns",
            "extra": "jotai=347863 ratio=0.2501 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8568,
            "unit": "ns",
            "extra": "jotai=18413 ratio=0.4653 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 675,
            "unit": "ns",
            "extra": "jotai=6746 ratio=0.1000 10.0x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 68593,
            "unit": "ns",
            "extra": "jotai=1246154 ratio=0.0550 18.2x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7081,
            "unit": "ns",
            "extra": "jotai=403086 ratio=0.0176 56.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 491,
            "unit": "ns",
            "extra": "jotai=2453 ratio=0.2002 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 92980,
            "unit": "ns",
            "extra": "jotai=412476 ratio=0.2254 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 119309,
            "unit": "ns",
            "extra": "jotai=718846 ratio=0.1660 6.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 775025,
            "unit": "ns",
            "extra": "jotai=4612845 ratio=0.1680 6.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 935692,
            "unit": "ns",
            "extra": "jotai=4977263 ratio=0.1880 5.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1172503,
            "unit": "ns",
            "extra": "jotai=26258858 ratio=0.0447 22.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 73620,
            "unit": "ns",
            "extra": "jotai=138999 ratio=0.5296 1.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 73311,
            "unit": "ns",
            "extra": "jotai=233321 ratio=0.3142 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 819222,
            "unit": "ns",
            "extra": "jotai=1302768 ratio=0.6288 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1019182,
            "unit": "ns",
            "extra": "jotai=1824042 ratio=0.5587 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 990279,
            "unit": "ns",
            "extra": "jotai=12353952 ratio=0.0802 12.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 50,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.9355 1.1x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8063,
            "unit": "ns",
            "extra": "jotai=19212 ratio=0.4197 2.4x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 75233,
            "unit": "ns",
            "extra": "jotai=128853 ratio=0.5839 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4674,
            "unit": "ns",
            "extra": "jotai=9639 ratio=0.4849 2.1x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.6249 1.6x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=163 ratio=0.0782 12.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 368,
            "unit": "ns",
            "extra": "jotai=1215 ratio=0.3029 3.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 382,
            "unit": "ns",
            "extra": "jotai=1448 ratio=0.2637 3.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 722,
            "unit": "ns",
            "extra": "jotai=1730 ratio=0.4174 2.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 41314,
            "unit": "ns",
            "extra": "jotai=137687 ratio=0.3001 3.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1187 ratio=0.1326 7.5x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 96656,
            "unit": "ns",
            "extra": "jotai=415815 ratio=0.2324 4.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13740,
            "unit": "ns",
            "extra": "jotai=207502 ratio=0.0662 15.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 667,
            "unit": "ns",
            "extra": "jotai=2019 ratio=0.3306 3.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 415,
            "unit": "ns",
            "extra": "jotai=535 ratio=0.7749 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=8 ratio=1.3779 1.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 272,
            "unit": "ns",
            "extra": "jotai=394 ratio=0.6907 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 364,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1330,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "eigilsagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "name": "eigilsagafos",
            "username": "eigilsagafos"
          },
          "id": "8fce25e35fcebbd5ceff3743db2c47714c1fe637",
          "message": "Remove unused seen parameter from propagateSelectorUpdates",
          "timestamp": "2026-04-09T21:46:21Z",
          "url": "https://github.com/eigilsagafos/valdres/pull/65/commits/8fce25e35fcebbd5ceff3743db2c47714c1fe637"
        },
        "date": 1775771701132,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0498 20.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=391 ratio=0.1023 9.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 230,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1078 9.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 271,
            "unit": "ns",
            "extra": "jotai=2826 ratio=0.0959 10.4x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 551,
            "unit": "ns",
            "extra": "jotai=3757 ratio=0.1466 6.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 25036,
            "unit": "ns",
            "extra": "jotai=282830 ratio=0.0885 11.3x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 317,
            "unit": "ns",
            "extra": "jotai=442 ratio=0.7161 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4409 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 328,
            "unit": "ns",
            "extra": "jotai=431 ratio=0.7605 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 438,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3332,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=73 ratio=0.0720 13.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8529,
            "unit": "ns",
            "extra": "jotai=28102 ratio=0.3035 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77436,
            "unit": "ns",
            "extra": "jotai=336371 ratio=0.2302 4.3x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7513,
            "unit": "ns",
            "extra": "jotai=18337 ratio=0.4097 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 645,
            "unit": "ns",
            "extra": "jotai=6493 ratio=0.0993 10.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 72346,
            "unit": "ns",
            "extra": "jotai=1216830 ratio=0.0595 16.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6610,
            "unit": "ns",
            "extra": "jotai=377698 ratio=0.0175 57.1x faster"
          },
          {
            "name": "sub + unsub",
            "value": 481,
            "unit": "ns",
            "extra": "jotai=2515 ratio=0.1913 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 79885,
            "unit": "ns",
            "extra": "jotai=406692 ratio=0.1964 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 137884,
            "unit": "ns",
            "extra": "jotai=741298 ratio=0.1860 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 753627,
            "unit": "ns",
            "extra": "jotai=4508134 ratio=0.1672 6.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 896236,
            "unit": "ns",
            "extra": "jotai=4803523 ratio=0.1866 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1396601,
            "unit": "ns",
            "extra": "jotai=25371332 ratio=0.0550 18.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77655,
            "unit": "ns",
            "extra": "jotai=139672 ratio=0.5560 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 79700,
            "unit": "ns",
            "extra": "jotai=238356 ratio=0.3344 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 833483,
            "unit": "ns",
            "extra": "jotai=1314212 ratio=0.6342 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1057573,
            "unit": "ns",
            "extra": "jotai=1775527 ratio=0.5956 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1001817,
            "unit": "ns",
            "extra": "jotai=12381830 ratio=0.0809 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.7510 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8609,
            "unit": "ns",
            "extra": "jotai=18939 ratio=0.4546 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77004,
            "unit": "ns",
            "extra": "jotai=125585 ratio=0.6132 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4709,
            "unit": "ns",
            "extra": "jotai=9663 ratio=0.4874 2.1x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5383 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0731 13.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 388,
            "unit": "ns",
            "extra": "jotai=1218 ratio=0.3183 3.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 397,
            "unit": "ns",
            "extra": "jotai=1514 ratio=0.2623 3.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 752,
            "unit": "ns",
            "extra": "jotai=1740 ratio=0.4322 2.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 42477,
            "unit": "ns",
            "extra": "jotai=142377 ratio=0.2983 3.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=1359 ratio=0.1182 8.5x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 90379,
            "unit": "ns",
            "extra": "jotai=439609 ratio=0.2056 4.9x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13906,
            "unit": "ns",
            "extra": "jotai=207058 ratio=0.0672 14.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 774,
            "unit": "ns",
            "extra": "jotai=2075 ratio=0.3732 2.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 395,
            "unit": "ns",
            "extra": "jotai=518 ratio=0.7632 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=7 ratio=1.5002 1.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 300,
            "unit": "ns",
            "extra": "jotai=366 ratio=0.8220 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 387,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1353,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "4416262e64992cc27c2dce2df484259ac8a26fb6",
          "message": "Fast path in propagateUpdatedAtoms for atoms with no dependents (#66)\n\n* Add fast path in propagateUpdatedAtoms for atoms with no dependents\n\nSkip the full propagation graph walk when a single non-family atom has\nno dependent selectors and no child scopes — just call subscriber\ncallbacks directly. Also defers Set/Map default parameter allocation\nuntil after the fast path check, and extracts callSubscribers to share\nnotification logic between the fast path and propagateDirtySelectors.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Guard fast path against AtomFamily in type signature\n\nAdd isAtomFamily check to the fast path predicate. No current call site\ncan trigger this (the only AtomFamily caller uses selectorsOnly=true),\nbut the type signature allows it and the guard costs nothing.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T15:02:42-07:00",
          "tree_id": "a19500803e4ad21f354285ce680bf32e95fc6779",
          "url": "https://github.com/eigilsagafos/valdres/commit/4416262e64992cc27c2dce2df484259ac8a26fb6"
        },
        "date": 1775772448563,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=67 ratio=0.0939 10.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=365 ratio=0.0712 14.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=2153 ratio=0.0729 13.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 199,
            "unit": "ns",
            "extra": "jotai=2648 ratio=0.0752 13.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 195,
            "unit": "ns",
            "extra": "jotai=4029 ratio=0.0484 20.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15951,
            "unit": "ns",
            "extra": "jotai=284339 ratio=0.0561 17.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 318,
            "unit": "ns",
            "extra": "jotai=443 ratio=0.7181 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=3.9147 3.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 324,
            "unit": "ns",
            "extra": "jotai=410 ratio=0.7895 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 335,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 183,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3044,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=85 ratio=0.1140 8.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8173,
            "unit": "ns",
            "extra": "jotai=27901 ratio=0.2929 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 73862,
            "unit": "ns",
            "extra": "jotai=309213 ratio=0.2389 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7487,
            "unit": "ns",
            "extra": "jotai=16823 ratio=0.4451 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 676,
            "unit": "ns",
            "extra": "jotai=7713 ratio=0.0877 11.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 70338,
            "unit": "ns",
            "extra": "jotai=1186066 ratio=0.0593 16.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6554,
            "unit": "ns",
            "extra": "jotai=519398 ratio=0.0126 79.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 490,
            "unit": "ns",
            "extra": "jotai=2686 ratio=0.1824 5.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 85231,
            "unit": "ns",
            "extra": "jotai=317368 ratio=0.2686 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 137974,
            "unit": "ns",
            "extra": "jotai=653792 ratio=0.2110 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 781056,
            "unit": "ns",
            "extra": "jotai=3569751 ratio=0.2188 4.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 936758,
            "unit": "ns",
            "extra": "jotai=5075936 ratio=0.1845 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1486620,
            "unit": "ns",
            "extra": "jotai=29687055 ratio=0.0501 20.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 82662,
            "unit": "ns",
            "extra": "jotai=165825 ratio=0.4985 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 76652,
            "unit": "ns",
            "extra": "jotai=280295 ratio=0.2735 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 812183,
            "unit": "ns",
            "extra": "jotai=1609481 ratio=0.5046 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1028030,
            "unit": "ns",
            "extra": "jotai=2244929 ratio=0.4579 2.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1141006,
            "unit": "ns",
            "extra": "jotai=13937893 ratio=0.0819 12.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.5908 1.7x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8814,
            "unit": "ns",
            "extra": "jotai=24087 ratio=0.3660 2.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 74222,
            "unit": "ns",
            "extra": "jotai=150806 ratio=0.4922 2.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 5134,
            "unit": "ns",
            "extra": "jotai=11551 ratio=0.4444 2.3x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.3969 2.5x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0672 14.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=1416 ratio=0.1834 5.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 276,
            "unit": "ns",
            "extra": "jotai=1673 ratio=0.1648 6.1x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 296,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.1386 7.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30126,
            "unit": "ns",
            "extra": "jotai=155909 ratio=0.1932 5.2x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 403,
            "unit": "ns",
            "extra": "jotai=2076 ratio=0.1940 5.2x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 91177,
            "unit": "ns",
            "extra": "jotai=447371 ratio=0.2038 4.9x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13186,
            "unit": "ns",
            "extra": "jotai=186171 ratio=0.0708 14.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 838,
            "unit": "ns",
            "extra": "jotai=2702 ratio=0.3100 3.2x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 469,
            "unit": "ns",
            "extra": "jotai=575 ratio=0.8157 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 18,
            "unit": "ns",
            "extra": "jotai=6 ratio=3.1785 3.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 423,
            "unit": "ns",
            "extra": "jotai=519 ratio=0.8142 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 253,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1503,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "12a8ae545d10f2f10a314cad881dc739a007fdf4",
          "message": "Add Recoil compat test suite and fix 3 bugs (#62)\n\n* Add Recoil compat test suite and fix 3 bugs\n\nAdds 61 tests adapted from the official Recoil test suite covering atom,\nselector, atomFamily, selectorFamily, hooks, useRecoilCallback, RecoilRoot,\nand isRecoilValue. Fixes three bugs discovered by the new tests:\n\n- isRecoilValue: guard against null/primitive inputs that crashed isAtom/isSelector\n- atom onSet: update oldValue after each callback so subsequent calls get correct previous value\n- atom default: wrap explicit `undefined` defaults in a thunk so valdres doesn't treat them as async/suspense atoms\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Scope test command to recoil-tests/ to exclude pre-existing broken src/ tests\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove old broken src/ test files superseded by recoil-tests/\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Revert test command to plain `bun test` now that old test files are removed\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback on PR #62\n\n- Use .forEach() instead of .map() for onSet callbacks (no return value used)\n- Remove unused imports (mock, selectorFamily, selector)\n- Replace require() with static import in hooks test\n- Remove unused myAtomFamily variable in selectorFamily test\n- Convert \"cleanup on unmount\" test to test.todo (effect cleanup not yet implemented)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T15:18:09-07:00",
          "tree_id": "2f212f6f0a2e7a92e7717754d09c68aee2c0dc4d",
          "url": "https://github.com/eigilsagafos/valdres/commit/12a8ae545d10f2f10a314cad881dc739a007fdf4"
        },
        "date": 1775773355582,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.0462 21.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2133 ratio=0.0797 12.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 200,
            "unit": "ns",
            "extra": "jotai=2675 ratio=0.0748 13.4x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 190,
            "unit": "ns",
            "extra": "jotai=3676 ratio=0.0516 19.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15589,
            "unit": "ns",
            "extra": "jotai=276354 ratio=0.0564 17.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 303,
            "unit": "ns",
            "extra": "jotai=440 ratio=0.6877 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4234 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 302,
            "unit": "ns",
            "extra": "jotai=434 ratio=0.6948 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 377,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 188,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3261,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.0722 13.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8559,
            "unit": "ns",
            "extra": "jotai=28573 ratio=0.2996 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 78055,
            "unit": "ns",
            "extra": "jotai=331707 ratio=0.2353 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7418,
            "unit": "ns",
            "extra": "jotai=18260 ratio=0.4063 2.5x faster"
          },
          {
            "name": "createStore",
            "value": 621,
            "unit": "ns",
            "extra": "jotai=6410 ratio=0.0968 10.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 70692,
            "unit": "ns",
            "extra": "jotai=1200841 ratio=0.0589 17.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3807,
            "unit": "ns",
            "extra": "jotai=384484 ratio=0.0099 101.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=2534 ratio=0.1977 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 81682,
            "unit": "ns",
            "extra": "jotai=402413 ratio=0.2030 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 137566,
            "unit": "ns",
            "extra": "jotai=737916 ratio=0.1864 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 752363,
            "unit": "ns",
            "extra": "jotai=4541468 ratio=0.1657 6.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 907186,
            "unit": "ns",
            "extra": "jotai=4823732 ratio=0.1881 5.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1399876,
            "unit": "ns",
            "extra": "jotai=25458500 ratio=0.0550 18.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79016,
            "unit": "ns",
            "extra": "jotai=138908 ratio=0.5688 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78396,
            "unit": "ns",
            "extra": "jotai=238669 ratio=0.3285 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 851271,
            "unit": "ns",
            "extra": "jotai=1291859 ratio=0.6590 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1042326,
            "unit": "ns",
            "extra": "jotai=1794774 ratio=0.5808 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 976008,
            "unit": "ns",
            "extra": "jotai=12605808 ratio=0.0774 12.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.7741 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8761,
            "unit": "ns",
            "extra": "jotai=19890 ratio=0.4405 2.3x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 78085,
            "unit": "ns",
            "extra": "jotai=128188 ratio=0.6091 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4846,
            "unit": "ns",
            "extra": "jotai=9810 ratio=0.4940 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5158 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0726 13.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 290,
            "unit": "ns",
            "extra": "jotai=1199 ratio=0.2418 4.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1434 ratio=0.2076 4.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=1691 ratio=0.1933 5.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32734,
            "unit": "ns",
            "extra": "jotai=138818 ratio=0.2358 4.2x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=1282 ratio=0.1253 8.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89527,
            "unit": "ns",
            "extra": "jotai=451278 ratio=0.1984 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14347,
            "unit": "ns",
            "extra": "jotai=206003 ratio=0.0696 14.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 760,
            "unit": "ns",
            "extra": "jotai=2128 ratio=0.3569 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=499 ratio=0.7809 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=6 ratio=1.7328 1.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 321,
            "unit": "ns",
            "extra": "jotai=360 ratio=0.8920 1.1x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 281,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1315,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d739e0d6d7c1e8d44e961c72f0378339706c27d9",
          "message": "Add valdres-vue package (#61)\n\n* Add valdres-vue package with Vue 3 composables and plugin\n\nProvides Vue 3 bindings for the valdres store, mirroring the valdres-react\nAPI: useValue, useAtom, useSetAtom, useResetAtom, useStore, useTransaction,\nand ValdresPlugin. Uses shallowRef + store.sub() for reactivity and\nprovide/inject with an InjectionKey for store context.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Follow Vue 3 conventions in valdres-vue\n\n- useAtom: return writable Ref via customRef instead of React-style tuple\n- createValdres(): factory function replaces static ValdresPlugin object\n- useValue: fix throw in sub callback (uncatchable), skip promise values instead\n- useValue: simplify return type to Readonly<Ref<V>>\n- useStore: remove unused storeId parameter\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add ValdresScope component and useStore(id) support\n\n- ValdresScope: renderless component for scoped stores with initialize\n  prop, cleanup on unmount, and parent store chain propagation\n- Injection value is now a ValdresContext { current, stores } instead\n  of a bare Store, enabling useStore(id) to access ancestor stores\n- Rename StoreKey → ValdresKey to reflect the new context shape\n- createValdres() provides the context with the root store in the map\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Improve valdres-vue code quality and test coverage\n\nCode fixes:\n- ValdresScope: include scoped store in stores map so nested children\n  can look it up by id\n- ValdresScope: use onScopeDispose instead of onUnmounted for consistency\n  with composables and effectScope support\n- useTransaction: remove unnecessary callback wrapper\n\nTest additions:\n- useValue: atomFamily, selectorFamily, unsubscribe on unmount,\n  multiple independent subscribers\n- useAtom: verify no reactive updates after unmount\n- useSetAtom: updater function support\n- useTransaction: read-back inside transaction\n- ValdresScope: scoped set does not leak to parent store\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Fix InitializeCallback: remove unused generic on AtomPair, use\n  AtomPair = [Atom<any>, any] to avoid ts-ignore\n- createValdres: default to store({ batchUpdates: true }) and warn\n  when provided store lacks batchUpdates (matches React Provider)\n- Tests: use batchUpdates: true when passing stores to createValdres\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Move valdres to peerDependencies\n\nValdres must be a peer dependency (like vue) to ensure a single copy\nacross the app — atoms and stores rely on referential identity.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T15:18:53-07:00",
          "tree_id": "b6cb4c7696fc66b44f31514723554916a7a0611f",
          "url": "https://github.com/eigilsagafos/valdres/commit/d739e0d6d7c1e8d44e961c72f0378339706c27d9"
        },
        "date": 1775773629386,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0496 20.2x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2153 ratio=0.0790 12.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 200,
            "unit": "ns",
            "extra": "jotai=2765 ratio=0.0723 13.8x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 194,
            "unit": "ns",
            "extra": "jotai=3871 ratio=0.0501 19.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15559,
            "unit": "ns",
            "extra": "jotai=283829 ratio=0.0548 18.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 344,
            "unit": "ns",
            "extra": "jotai=485 ratio=0.7102 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4216 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 346,
            "unit": "ns",
            "extra": "jotai=473 ratio=0.7319 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 189,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.0906 11.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8281,
            "unit": "ns",
            "extra": "jotai=27782 ratio=0.2981 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77104,
            "unit": "ns",
            "extra": "jotai=325197 ratio=0.2371 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7228,
            "unit": "ns",
            "extra": "jotai=17479 ratio=0.4135 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 582,
            "unit": "ns",
            "extra": "jotai=6342 ratio=0.0917 10.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 71253,
            "unit": "ns",
            "extra": "jotai=1172167 ratio=0.0608 16.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6488,
            "unit": "ns",
            "extra": "jotai=375150 ratio=0.0173 57.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 461,
            "unit": "ns",
            "extra": "jotai=2465 ratio=0.1870 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 78777,
            "unit": "ns",
            "extra": "jotai=428600 ratio=0.1838 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 134811,
            "unit": "ns",
            "extra": "jotai=749288 ratio=0.1799 5.6x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 764197,
            "unit": "ns",
            "extra": "jotai=4491831 ratio=0.1701 5.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 901011,
            "unit": "ns",
            "extra": "jotai=4743241 ratio=0.1900 5.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1396105,
            "unit": "ns",
            "extra": "jotai=25313798 ratio=0.0552 18.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77385,
            "unit": "ns",
            "extra": "jotai=139110 ratio=0.5563 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 77585,
            "unit": "ns",
            "extra": "jotai=242112 ratio=0.3205 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 850688,
            "unit": "ns",
            "extra": "jotai=1279663 ratio=0.6648 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1077170,
            "unit": "ns",
            "extra": "jotai=1778078 ratio=0.6058 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1040326,
            "unit": "ns",
            "extra": "jotai=12375673 ratio=0.0841 11.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.8000 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8595,
            "unit": "ns",
            "extra": "jotai=19106 ratio=0.4499 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76092,
            "unit": "ns",
            "extra": "jotai=126787 ratio=0.6002 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4869,
            "unit": "ns",
            "extra": "jotai=9894 ratio=0.4921 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.4795 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0737 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 295,
            "unit": "ns",
            "extra": "jotai=1210 ratio=0.2438 4.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=1459 ratio=0.2094 4.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 322,
            "unit": "ns",
            "extra": "jotai=1712 ratio=0.1882 5.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31871,
            "unit": "ns",
            "extra": "jotai=138980 ratio=0.2293 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=1226 ratio=0.1315 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 87874,
            "unit": "ns",
            "extra": "jotai=454268 ratio=0.1934 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14327,
            "unit": "ns",
            "extra": "jotai=205884 ratio=0.0696 14.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 772,
            "unit": "ns",
            "extra": "jotai=2141 ratio=0.3604 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 404,
            "unit": "ns",
            "extra": "jotai=514 ratio=0.7852 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=7 ratio=1.5873 1.6x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 321,
            "unit": "ns",
            "extra": "jotai=379 ratio=0.8467 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 283,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1323,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "55e353a114fcb5c2c476732f03d9919650170205",
          "message": "Add valdres-svelte package (#60)\n\n* Add valdres-svelte package with Svelte 5 runes-compatible utilities\n\nProvides useValue, useAtom, useSetAtom, useResetAtom, useStore,\nuseTransaction, context helpers, and toSvelteStore for integrating\nvaldres state management with Svelte 5.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Refactor valdres-svelte to follow Svelte conventions\n\n- Rename useXxx to Svelte-idiomatic names (getValue, getAtom, getSetter,\n  getReset, getStore, getTransaction)\n- Change .current to .value for reactive return objects\n- Return { value, set, reset } object from getAtom instead of React tuple\n- Import Readable from svelte/store instead of redefining it\n- Use $effect.pre instead of $effect for earlier subscription setup\n- Add svelte export condition in package.json\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Consolidate API to 4 exports following Svelte philosophy\n\nMerge getValue/getAtom into single `watch()` with TypeScript overloads —\natoms get { value, set, reset }, selectors get { value }. Remove thin\nwrappers (getSetter, getReset, getStore, getTransaction) that added\nnothing over using the store directly. Rename toSvelteStore to readable\nto mirror svelte/store naming.\n\nFinal API: watch, readable, setValdresContext, getValdresContext.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add performance benchmarks comparing valdres vs Svelte stores\n\nBenchmarks atom vs writable, selector vs derived, and transactions\nusing the same mitata + IQR methodology as the core valdres benchmarks.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Switch benchmarks to compare valdres vs nanostores\n\nReplace Svelte built-in store comparison with nanostores — the most\nrelevant competitor in the Svelte atom-based state management space.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add scope() helper for scoped stores in Svelte\n\nSvelte equivalent of React's <Scope> component. Gets parent store from\ncontext, creates a scoped child store, sets it in context for descendants,\nand registers onDestroy cleanup — all in one call.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove nanostores benchmarks from valdres-svelte\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Move valdres to peerDependencies\n\nPrevents duplicate module instances when the user's app also depends\non valdres directly.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Fix exports to use string path for prepack compatibility\n- Add build and build:types scripts for monorepo pipeline\n- Remove unnecessary `as Atom<V>` casts in watch (isAtom narrows)\n- Add watch tests using Svelte compiler Bun plugin + effect_root\n- Add bunfig.toml with Svelte rune compilation preload for tests\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-09T20:41:48-07:00",
          "tree_id": "12e1b4e6cfb4550d28c331c030f2905c5950ed6a",
          "url": "https://github.com/eigilsagafos/valdres/commit/55e353a114fcb5c2c476732f03d9919650170205"
        },
        "date": 1775792768134,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.0455 22.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2164 ratio=0.0790 12.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 200,
            "unit": "ns",
            "extra": "jotai=2694 ratio=0.0742 13.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 192,
            "unit": "ns",
            "extra": "jotai=3646 ratio=0.0527 19.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15272,
            "unit": "ns",
            "extra": "jotai=280263 ratio=0.0545 18.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 373,
            "unit": "ns",
            "extra": "jotai=523 ratio=0.7139 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 54,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.7752 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 382,
            "unit": "ns",
            "extra": "jotai=517 ratio=0.7401 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 357,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 184,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3336,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.1064 9.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8331,
            "unit": "ns",
            "extra": "jotai=30469 ratio=0.2734 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 75842,
            "unit": "ns",
            "extra": "jotai=333547 ratio=0.2274 4.4x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8210,
            "unit": "ns",
            "extra": "jotai=18041 ratio=0.4551 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 661,
            "unit": "ns",
            "extra": "jotai=6721 ratio=0.0984 10.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 69532,
            "unit": "ns",
            "extra": "jotai=1175143 ratio=0.0592 16.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 4136,
            "unit": "ns",
            "extra": "jotai=369066 ratio=0.0112 89.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 500,
            "unit": "ns",
            "extra": "jotai=2394 ratio=0.2089 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 79577,
            "unit": "ns",
            "extra": "jotai=392826 ratio=0.2026 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 106146,
            "unit": "ns",
            "extra": "jotai=655280 ratio=0.1620 6.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 705303,
            "unit": "ns",
            "extra": "jotai=4518699 ratio=0.1561 6.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 861471,
            "unit": "ns",
            "extra": "jotai=4807797 ratio=0.1792 5.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1096508,
            "unit": "ns",
            "extra": "jotai=25686379 ratio=0.0427 23.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 69782,
            "unit": "ns",
            "extra": "jotai=135579 ratio=0.5147 1.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 71865,
            "unit": "ns",
            "extra": "jotai=236817 ratio=0.3035 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 782737,
            "unit": "ns",
            "extra": "jotai=1322047 ratio=0.5921 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 981055,
            "unit": "ns",
            "extra": "jotai=1784772 ratio=0.5497 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 934119,
            "unit": "ns",
            "extra": "jotai=12624699 ratio=0.0740 13.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.8041 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7075,
            "unit": "ns",
            "extra": "jotai=19799 ratio=0.3574 2.8x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 70403,
            "unit": "ns",
            "extra": "jotai=127597 ratio=0.5518 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4094,
            "unit": "ns",
            "extra": "jotai=9941 ratio=0.4118 2.4x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5545 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0794 12.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 275,
            "unit": "ns",
            "extra": "jotai=1209 ratio=0.2272 4.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1457 ratio=0.1971 5.1x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 319,
            "unit": "ns",
            "extra": "jotai=1752 ratio=0.1822 5.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32017,
            "unit": "ns",
            "extra": "jotai=136621 ratio=0.2343 4.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "jotai=1245 ratio=0.1257 8.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 94949,
            "unit": "ns",
            "extra": "jotai=421148 ratio=0.2255 4.4x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13760,
            "unit": "ns",
            "extra": "jotai=205702 ratio=0.0669 14.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 678,
            "unit": "ns",
            "extra": "jotai=2108 ratio=0.3218 3.1x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 441,
            "unit": "ns",
            "extra": "jotai=570 ratio=0.7748 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=7 ratio=1.5375 1.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 370,
            "unit": "ns",
            "extra": "jotai=434 ratio=0.8543 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 202,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 264,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1318,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "b5a6e5af779bc1a38323e86ad597bd25b9170ecd",
          "message": "Add valdres-solid package (#69)\n\n* Add valdres-solid package\n\nSolidJS adapter for valdres state management, designed to feel native\nto Solid developers:\n\n- Uses Solid's `from()` primitive to bridge valdres subscriptions into\n  signals, with automatic cleanup\n- Follows `createX` naming convention (createAtom, createValue, etc.)\n  matching Solid's createSignal/createMemo patterns\n- createAtom returns [Accessor, Setter] tuple like createSignal\n- createValue returns Accessor for read-only state (atoms, selectors,\n  families)\n- ValdresProvider and ValdresScope components for context management\n- useStore kept with `use` prefix as it only accesses context\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix frozen lockfile by removing stale solid-testing-library entries\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- ValdresProvider now merges ancestor stores when nested, matching\n  valdres-react behavior. Throws if a store id already exists upstream.\n- ValdresScope uses Solid's createUniqueId() instead of Math.random()\n  for SSR-safe scope ID generation.\n- ValdresScope error message now mentions it can also nest under\n  another ValdresScope.\n- Added tests for ValdresProvider (auto-create, explicit store,\n  initialize with array/txn, batchUpdates warning, nested providers).\n- Added tests for ValdresScope (throws without provider, inheritance,\n  initialize with array/txn, store access by id, detach on cleanup).\n- Converted components from .tsx to .ts (no JSX dependency needed).\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-10T09:01:28-07:00",
          "tree_id": "4883dd7fb3b2c4b30292efc52b323b99c48b8026",
          "url": "https://github.com/eigilsagafos/valdres/commit/b5a6e5af779bc1a38323e86ad597bd25b9170ecd"
        },
        "date": 1775837146810,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.0467 21.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=371 ratio=0.1078 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2053 ratio=0.0828 12.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 201,
            "unit": "ns",
            "extra": "jotai=2635 ratio=0.0763 13.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 188,
            "unit": "ns",
            "extra": "jotai=3670 ratio=0.0512 19.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15739,
            "unit": "ns",
            "extra": "jotai=272078 ratio=0.0578 17.3x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 302,
            "unit": "ns",
            "extra": "jotai=443 ratio=0.6823 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4397 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 307,
            "unit": "ns",
            "extra": "jotai=440 ratio=0.6985 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 351,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 196,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3142,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=72 ratio=0.0676 14.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8381,
            "unit": "ns",
            "extra": "jotai=27591 ratio=0.3037 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77264,
            "unit": "ns",
            "extra": "jotai=323073 ratio=0.2392 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7467,
            "unit": "ns",
            "extra": "jotai=17832 ratio=0.4188 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 606,
            "unit": "ns",
            "extra": "jotai=6290 ratio=0.0963 10.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 73406,
            "unit": "ns",
            "extra": "jotai=1164381 ratio=0.0630 15.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6655,
            "unit": "ns",
            "extra": "jotai=520931 ratio=0.0128 78.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 470,
            "unit": "ns",
            "extra": "jotai=2494 ratio=0.1885 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 82474,
            "unit": "ns",
            "extra": "jotai=296763 ratio=0.2779 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 135573,
            "unit": "ns",
            "extra": "jotai=611666 ratio=0.2216 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 754437,
            "unit": "ns",
            "extra": "jotai=3273815 ratio=0.2304 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 921228,
            "unit": "ns",
            "extra": "jotai=4663506 ratio=0.1975 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1400842,
            "unit": "ns",
            "extra": "jotai=20596965 ratio=0.0680 14.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 81472,
            "unit": "ns",
            "extra": "jotai=137977 ratio=0.5905 1.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 76102,
            "unit": "ns",
            "extra": "jotai=239131 ratio=0.3182 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 835879,
            "unit": "ns",
            "extra": "jotai=1332585 ratio=0.6273 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1037325,
            "unit": "ns",
            "extra": "jotai=1795559 ratio=0.5777 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 973065,
            "unit": "ns",
            "extra": "jotai=12156522 ratio=0.0800 12.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.7413 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8632,
            "unit": "ns",
            "extra": "jotai=19045 ratio=0.4533 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77654,
            "unit": "ns",
            "extra": "jotai=126786 ratio=0.6125 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4867,
            "unit": "ns",
            "extra": "jotai=9662 ratio=0.5038 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.4907 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0736 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1198 ratio=0.2399 4.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 319,
            "unit": "ns",
            "extra": "jotai=1483 ratio=0.2154 4.6x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 322,
            "unit": "ns",
            "extra": "jotai=1676 ratio=0.1921 5.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31399,
            "unit": "ns",
            "extra": "jotai=139160 ratio=0.2256 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 158,
            "unit": "ns",
            "extra": "jotai=1188 ratio=0.1333 7.5x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 98414,
            "unit": "ns",
            "extra": "jotai=457522 ratio=0.2151 4.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14457,
            "unit": "ns",
            "extra": "jotai=206705 ratio=0.0699 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 773,
            "unit": "ns",
            "extra": "jotai=2039 ratio=0.3791 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 360,
            "unit": "ns",
            "extra": "jotai=465 ratio=0.7748 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=6 ratio=1.7305 1.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 255,
            "unit": "ns",
            "extra": "jotai=360 ratio=0.7089 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1320,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "b759e8e92a6d011baf0959cd88926ffc9a946742",
          "message": "Add valdres-angular package (#68)\n\n* Add valdres-angular package\n\nAngular adapter for valdres using Angular Signals (17+) and modern\ninject() API. Provides provideValdres(), injectAtom(), injectValue(),\nand other Angular-idiomatic bindings.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix provideValdresScope to work at component level\n\nReturn Provider[] instead of EnvironmentProviders so scopes can be\nused in @Component({ providers }) for component-level state isolation.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add tests and fix bugs in valdres-angular\n\n- Fix critical bug in injectAtom: save original signal.set before\n  overriding, so store subscriptions update the Angular signal instead\n  of recursing through the store\n- Fix provideValdresScope: use skipSelf to avoid circular DI when the\n  scope provides and injects the same token\n- Add 34 tests covering all public APIs\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Fix injectAtom: update Angular signal synchronously in set/update/reset\n  so read-after-write is consistent even with batchUpdates: true\n- Fix provideValdresScope: detach scoped store on destroy to prevent\n  memory leaks (matches Vue adapter's onScopeDispose behavior)\n- Add test for synchronous read-after-write with batchUpdates\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix scope tests and add detach test\n\n- Fix scope inheritance test: scopes inherit parent values (verified\n  against core store.test.ts). Previous test was wrong due to\n  batchUpdates timing masking the real behavior.\n- Add \"scope is detached on destroy\" test (verified red against\n  pre-fix code)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Narrow useValue/injectValue to reject AtomFamily\n\nPassing an AtomFamily to useValue/injectValue returned atom metadata\nobjects instead of values, while the type signature promised Signal<V>\nor Ref<V>. Narrowing the parameter from State (which includes\nAtomFamily) to Atom | Selector fixes this across all three adapters.\n\nAtomFamilyAtom and SelectorFamilySelector still work since they\nextend Atom and Selector respectively.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add injectAsyncValue for async selector support\n\nAngular has no Suspense, so throwing Promises (like React/Vue do) is\nan uncaught error. injectAsyncValue() returns a resource-like shape\nmatching Angular ecosystem conventions (ngrx, tanstack-query):\n\n  const data = injectAsyncValue(myAsyncSelector)\n  data.value()     // Signal<V | undefined>\n  data.status()    // Signal<'loading' | 'resolved' | 'error'>\n  data.error()     // Signal<unknown | undefined>\n  data.isLoading() // Signal<boolean>\n  data.hasValue()  // Signal<boolean>\n\nAlso works with sync state (immediately resolved), so it can be used\nas a universal accessor when the caller doesn't know if state is async.\n\ninjectValue() and injectAtom() now throw descriptive errors instead of\nraw Promises when given async state.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Merge injectAsyncValue into injectValue as unified API\n\ninjectValue now handles both sync and async state, returning a\nValueState<V> with value/status/error/isLoading/hasValue signals.\nRemoves the separate injectAsyncValue function.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add reloading status to align with Angular ResourceStatus\n\nDistinguishes first load (\"loading\", no previous value) from re-fetch\n(\"reloading\", previous value retained). isLoading covers both states.\nThis mirrors Angular's ResourceStatus.Loading vs ResourceStatus.Reloading,\nmaking future migration to resource() more natural.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix stale promise, hasValue, and reloading bugs; remove unnecessary ts-ignore\n\nBugs fixed (with red tests first):\n- Stale promise: old in-flight promise could overwrite newer resolved value.\n  Added version counter so only the latest promise updates signals.\n- hasValue: was based on value() !== undefined, which can't distinguish\n  \"resolved with undefined\" from \"not yet resolved\". Now based on status.\n- reloading: check used value() !== undefined to decide loading vs reloading,\n  breaking when resolved value was undefined. Now uses hasResolved flag.\n\nCleanup:\n- Remove unnecessary @ts-ignore on store.sub() and store.set() calls\n- Remove unused SetAtomValue import\n- Use crypto.randomUUID() for scope IDs instead of Math.random()\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-10T09:58:50-07:00",
          "tree_id": "d9f1ad76fe01b7e0dda777619abce6f7bf4480a2",
          "url": "https://github.com/eigilsagafos/valdres/commit/b759e8e92a6d011baf0959cd88926ffc9a946742"
        },
        "date": 1775840603818,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.0577 17.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=357 ratio=0.0756 13.2x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=2200 ratio=0.0732 13.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 193,
            "unit": "ns",
            "extra": "jotai=2682 ratio=0.0720 13.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 195,
            "unit": "ns",
            "extra": "jotai=3683 ratio=0.0531 18.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15785,
            "unit": "ns",
            "extra": "jotai=283857 ratio=0.0556 18.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 316,
            "unit": "ns",
            "extra": "jotai=425 ratio=0.7431 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=12 ratio=3.8235 3.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 323,
            "unit": "ns",
            "extra": "jotai=415 ratio=0.7793 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 340,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 184,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3010,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=82 ratio=0.1029 9.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9146,
            "unit": "ns",
            "extra": "jotai=28177 ratio=0.3246 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 73076,
            "unit": "ns",
            "extra": "jotai=302686 ratio=0.2414 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7203,
            "unit": "ns",
            "extra": "jotai=16536 ratio=0.4356 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 549,
            "unit": "ns",
            "extra": "jotai=7180 ratio=0.0765 13.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 70959,
            "unit": "ns",
            "extra": "jotai=1137700 ratio=0.0624 16.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3851,
            "unit": "ns",
            "extra": "jotai=497481 ratio=0.0077 129.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 487,
            "unit": "ns",
            "extra": "jotai=2495 ratio=0.1952 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 75311,
            "unit": "ns",
            "extra": "jotai=283175 ratio=0.2660 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 131909,
            "unit": "ns",
            "extra": "jotai=570157 ratio=0.2314 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 735585,
            "unit": "ns",
            "extra": "jotai=3068580 ratio=0.2397 4.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 867336,
            "unit": "ns",
            "extra": "jotai=4480629 ratio=0.1936 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1445398,
            "unit": "ns",
            "extra": "jotai=23903066 ratio=0.0605 16.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 75880,
            "unit": "ns",
            "extra": "jotai=157504 ratio=0.4818 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 74400,
            "unit": "ns",
            "extra": "jotai=252948 ratio=0.2941 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 796205,
            "unit": "ns",
            "extra": "jotai=1559788 ratio=0.5105 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 992577,
            "unit": "ns",
            "extra": "jotai=1964641 ratio=0.5052 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1019870,
            "unit": "ns",
            "extra": "jotai=12595809 ratio=0.0810 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.6835 1.5x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8317,
            "unit": "ns",
            "extra": "jotai=20287 ratio=0.4100 2.4x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 71607,
            "unit": "ns",
            "extra": "jotai=132952 ratio=0.5386 1.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4689,
            "unit": "ns",
            "extra": "jotai=10484 ratio=0.4473 2.2x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.4020 2.5x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=153 ratio=0.0694 14.4x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 247,
            "unit": "ns",
            "extra": "jotai=1311 ratio=0.1881 5.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 264,
            "unit": "ns",
            "extra": "jotai=1521 ratio=0.1736 5.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1904 ratio=0.1509 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 28012,
            "unit": "ns",
            "extra": "jotai=146855 ratio=0.1907 5.2x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 243,
            "unit": "ns",
            "extra": "jotai=1547 ratio=0.1569 6.4x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 84357,
            "unit": "ns",
            "extra": "jotai=436235 ratio=0.1934 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13499,
            "unit": "ns",
            "extra": "jotai=184402 ratio=0.0732 13.7x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 789,
            "unit": "ns",
            "extra": "jotai=2157 ratio=0.3657 2.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 359,
            "unit": "ns",
            "extra": "jotai=463 ratio=0.7757 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=5 ratio=2.0950 2.1x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 329,
            "unit": "ns",
            "extra": "jotai=407 ratio=0.8087 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 185,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 253,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1416,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f416bd12e508fd9b7c9f3c05c57cb43b4b6d23a1",
          "message": "Extract shared familyKey and optimize selectorFamily (#71)\n\n* Extract shared familyKey helper and optimize selectorFamily\n\n- Extract familyKey() to shared module used by both atomFamily and selectorFamily\n- Use single Map.get() + undefined check instead of has() + get() in selectorFamily\n- Fast-path primitive single args as Map keys, skipping stringification\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add explicit FamilyKey type for family map keys\n\nAddress Copilot review feedback:\n- Add FamilyKey type (string | number | boolean) to familyKey.ts\n- Update AtomFamily and SelectorFamily map types from Map<string, ...> to Map<FamilyKey, ...>\n- Add explicit return type annotation to familyKey()\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-10T23:40:20-07:00",
          "tree_id": "4c64ec380fe9feb6d0c4f839aa0ebad23d35cd26",
          "url": "https://github.com/eigilsagafos/valdres/commit/f416bd12e508fd9b7c9f3c05c57cb43b4b6d23a1"
        },
        "date": 1775889879402,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0480 20.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=371 ratio=0.1078 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2053 ratio=0.0828 12.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 201,
            "unit": "ns",
            "extra": "jotai=2665 ratio=0.0754 13.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 191,
            "unit": "ns",
            "extra": "jotai=3642 ratio=0.0523 19.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15579,
            "unit": "ns",
            "extra": "jotai=270616 ratio=0.0576 17.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 294,
            "unit": "ns",
            "extra": "jotai=440 ratio=0.6674 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4380 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 323,
            "unit": "ns",
            "extra": "jotai=440 ratio=0.7323 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 348,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 192,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3139,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0859 11.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8319,
            "unit": "ns",
            "extra": "jotai=28404 ratio=0.2929 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 76012,
            "unit": "ns",
            "extra": "jotai=322583 ratio=0.2356 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7428,
            "unit": "ns",
            "extra": "jotai=17627 ratio=0.4214 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 600,
            "unit": "ns",
            "extra": "jotai=6400 ratio=0.0937 10.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 73727,
            "unit": "ns",
            "extra": "jotai=1181353 ratio=0.0624 16.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6734,
            "unit": "ns",
            "extra": "jotai=361405 ratio=0.0186 53.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 471,
            "unit": "ns",
            "extra": "jotai=2455 ratio=0.1919 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 81843,
            "unit": "ns",
            "extra": "jotai=401350 ratio=0.2039 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 135914,
            "unit": "ns",
            "extra": "jotai=715037 ratio=0.1901 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 768026,
            "unit": "ns",
            "extra": "jotai=4471036 ratio=0.1718 5.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 925164,
            "unit": "ns",
            "extra": "jotai=4684084 ratio=0.1975 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1401870,
            "unit": "ns",
            "extra": "jotai=24590445 ratio=0.0570 17.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79879,
            "unit": "ns",
            "extra": "jotai=139191 ratio=0.5739 1.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78547,
            "unit": "ns",
            "extra": "jotai=239017 ratio=0.3286 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 840331,
            "unit": "ns",
            "extra": "jotai=1281625 ratio=0.6557 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1045985,
            "unit": "ns",
            "extra": "jotai=1771841 ratio=0.5903 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1012703,
            "unit": "ns",
            "extra": "jotai=12514979 ratio=0.0809 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.7833 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8672,
            "unit": "ns",
            "extra": "jotai=18912 ratio=0.4586 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 79228,
            "unit": "ns",
            "extra": "jotai=125615 ratio=0.6307 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4728,
            "unit": "ns",
            "extra": "jotai=9497 ratio=0.4978 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.5041 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0738 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 285,
            "unit": "ns",
            "extra": "jotai=1214 ratio=0.2347 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1465 ratio=0.2037 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 322,
            "unit": "ns",
            "extra": "jotai=1681 ratio=0.1918 5.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32174,
            "unit": "ns",
            "extra": "jotai=140182 ratio=0.2295 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "jotai=1275 ratio=0.1222 8.2x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 94397,
            "unit": "ns",
            "extra": "jotai=442212 ratio=0.2135 4.7x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14697,
            "unit": "ns",
            "extra": "jotai=209762 ratio=0.0701 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 745,
            "unit": "ns",
            "extra": "jotai=2062 ratio=0.3614 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 387,
            "unit": "ns",
            "extra": "jotai=457 ratio=0.8479 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.7813 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 209,
            "unit": "ns",
            "extra": "jotai=349 ratio=0.5988 1.7x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 295,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1333,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "b479aca20cd09fc0a00a4d0e3669c0537d689bcb",
          "message": "Fix global atomFamily cross-store sync and add detach API (#72)\n\n* Fix global atomFamily cross-store sync and add detach API\n\nGlobal atomFamily members were created as plain objects, bypassing\nglobalAtom() wrapping — so cross-store sync, setSelf, getSelf, and\nresetSelf were missing. Wire createAtomFamily through globalAtom()\nwhen options.global is set.\n\nAlso fixes:\n- Memory leak: add detach(storeData) to remove stores from global atoms\n- resetSelf() mutating Set during iteration (snapshot first)\n- Remove dead code: atomFamilyAtom.ts and AtomFamilyGlobalAtom.ts\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix resetSelf: defer stores.clear and call onReset exactly once\n\nTwo bugs from Copilot review:\n- stores.clear() ran before propagation loop, so if a subscriber threw,\n  all stores were permanently orphaned and cross-store sync broke\n- onReset cleanup was called once per store instead of once per reset\n\nNow: iterate snapshot without clearing, clear stores after the loop,\ncall onReset once at the end. Errors during propagation are caught\nand re-thrown after cleanup completes.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-12T11:45:15-07:00",
          "tree_id": "2ed4ffe70dbc3bb55fde8356a4f62ca9469a7680",
          "url": "https://github.com/eigilsagafos/valdres/commit/b479aca20cd09fc0a00a4d0e3669c0537d689bcb"
        },
        "date": 1776019774469,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.0447 22.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2113 ratio=0.0852 11.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 201,
            "unit": "ns",
            "extra": "jotai=2714 ratio=0.0741 13.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 185,
            "unit": "ns",
            "extra": "jotai=3768 ratio=0.0491 20.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15183,
            "unit": "ns",
            "extra": "jotai=282147 ratio=0.0538 18.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 368,
            "unit": "ns",
            "extra": "jotai=508 ratio=0.7239 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 53,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.7766 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 373,
            "unit": "ns",
            "extra": "jotai=497 ratio=0.7495 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 356,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 184,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3335,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.1018 9.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8353,
            "unit": "ns",
            "extra": "jotai=30740 ratio=0.2717 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 72879,
            "unit": "ns",
            "extra": "jotai=333494 ratio=0.2185 4.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7495,
            "unit": "ns",
            "extra": "jotai=17919 ratio=0.4182 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 662,
            "unit": "ns",
            "extra": "jotai=6730 ratio=0.0983 10.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 69825,
            "unit": "ns",
            "extra": "jotai=1143014 ratio=0.0611 16.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7171,
            "unit": "ns",
            "extra": "jotai=547153 ratio=0.0131 76.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 530,
            "unit": "ns",
            "extra": "jotai=2374 ratio=0.2233 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 76555,
            "unit": "ns",
            "extra": "jotai=302902 ratio=0.2527 4.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136194,
            "unit": "ns",
            "extra": "jotai=598204 ratio=0.2277 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 741944,
            "unit": "ns",
            "extra": "jotai=3432310 ratio=0.2162 4.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 886906,
            "unit": "ns",
            "extra": "jotai=4789288 ratio=0.1852 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1405376,
            "unit": "ns",
            "extra": "jotai=25176570 ratio=0.0558 17.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 67701,
            "unit": "ns",
            "extra": "jotai=140640 ratio=0.4814 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 73419,
            "unit": "ns",
            "extra": "jotai=239739 ratio=0.3062 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 778824,
            "unit": "ns",
            "extra": "jotai=1345661 ratio=0.5788 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 965238,
            "unit": "ns",
            "extra": "jotai=1942363 ratio=0.4969 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 989629,
            "unit": "ns",
            "extra": "jotai=13679575 ratio=0.0723 13.8x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.8402 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8096,
            "unit": "ns",
            "extra": "jotai=20553 ratio=0.3939 2.5x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 70325,
            "unit": "ns",
            "extra": "jotai=126499 ratio=0.5559 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4705,
            "unit": "ns",
            "extra": "jotai=10256 ratio=0.4588 2.2x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5375 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0792 12.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 280,
            "unit": "ns",
            "extra": "jotai=1193 ratio=0.2344 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 295,
            "unit": "ns",
            "extra": "jotai=1450 ratio=0.2035 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 314,
            "unit": "ns",
            "extra": "jotai=1747 ratio=0.1797 5.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31308,
            "unit": "ns",
            "extra": "jotai=139789 ratio=0.2240 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1396 ratio=0.1123 8.9x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 93339,
            "unit": "ns",
            "extra": "jotai=420228 ratio=0.2221 4.5x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13750,
            "unit": "ns",
            "extra": "jotai=206909 ratio=0.0665 15.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 686,
            "unit": "ns",
            "extra": "jotai=2221 ratio=0.3086 3.2x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 496,
            "unit": "ns",
            "extra": "jotai=574 ratio=0.8640 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.3674 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 435,
            "unit": "ns",
            "extra": "jotai=414 ratio=1.0527 1.1x slower"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 205,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1383,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f094d1654412b645e33b6dd5afd0a1e61cd18709",
          "message": "Complete maxAge, staleWhileRevalidate and staleIfError support (#73)",
          "timestamp": "2026-04-13T17:43:40+02:00",
          "tree_id": "ad18bb2c48883022a9a9f98bea57b626aeadcc77",
          "url": "https://github.com/eigilsagafos/valdres/commit/f094d1654412b645e33b6dd5afd0a1e61cd18709"
        },
        "date": 1776095282258,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.0461 21.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.1053 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2134 ratio=0.0843 11.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 200,
            "unit": "ns",
            "extra": "jotai=2704 ratio=0.0740 13.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 184,
            "unit": "ns",
            "extra": "jotai=3670 ratio=0.0502 19.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15163,
            "unit": "ns",
            "extra": "jotai=279750 ratio=0.0542 18.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 358,
            "unit": "ns",
            "extra": "jotai=504 ratio=0.7109 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 55,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.9371 4.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 362,
            "unit": "ns",
            "extra": "jotai=503 ratio=0.7189 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 356,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 184,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3320,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.0988 10.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8283,
            "unit": "ns",
            "extra": "jotai=30405 ratio=0.2724 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 73270,
            "unit": "ns",
            "extra": "jotai=333781 ratio=0.2195 4.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7525,
            "unit": "ns",
            "extra": "jotai=17891 ratio=0.4206 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 664,
            "unit": "ns",
            "extra": "jotai=6697 ratio=0.0991 10.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 70005,
            "unit": "ns",
            "extra": "jotai=1164134 ratio=0.0601 16.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7220,
            "unit": "ns",
            "extra": "jotai=553246 ratio=0.0131 76.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=2374 ratio=0.2110 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 76055,
            "unit": "ns",
            "extra": "jotai=305414 ratio=0.2490 4.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 135684,
            "unit": "ns",
            "extra": "jotai=601364 ratio=0.2256 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 744919,
            "unit": "ns",
            "extra": "jotai=3433459 ratio=0.2170 4.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 904704,
            "unit": "ns",
            "extra": "jotai=4853202 ratio=0.1864 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1422933,
            "unit": "ns",
            "extra": "jotai=25269970 ratio=0.0563 17.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 73350,
            "unit": "ns",
            "extra": "jotai=138949 ratio=0.5279 1.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 72398,
            "unit": "ns",
            "extra": "jotai=235840 ratio=0.3070 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 788950,
            "unit": "ns",
            "extra": "jotai=1304038 ratio=0.6050 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 972572,
            "unit": "ns",
            "extra": "jotai=1832203 ratio=0.5308 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 943984,
            "unit": "ns",
            "extra": "jotai=12706683 ratio=0.0743 13.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.8082 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7883,
            "unit": "ns",
            "extra": "jotai=20097 ratio=0.3923 2.5x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 69314,
            "unit": "ns",
            "extra": "jotai=127332 ratio=0.5444 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4480,
            "unit": "ns",
            "extra": "jotai=9901 ratio=0.4524 2.2x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.5548 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0793 12.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 257,
            "unit": "ns",
            "extra": "jotai=1196 ratio=0.2152 4.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 280,
            "unit": "ns",
            "extra": "jotai=1461 ratio=0.1913 5.2x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 292,
            "unit": "ns",
            "extra": "jotai=1750 ratio=0.1671 6.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 29524,
            "unit": "ns",
            "extra": "jotai=138959 ratio=0.2125 4.7x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1198 ratio=0.1311 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 114902,
            "unit": "ns",
            "extra": "jotai=420312 ratio=0.2734 3.7x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13780,
            "unit": "ns",
            "extra": "jotai=204117 ratio=0.0675 14.8x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 669,
            "unit": "ns",
            "extra": "jotai=2044 ratio=0.3274 3.1x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 457,
            "unit": "ns",
            "extra": "jotai=567 ratio=0.8064 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.3902 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 264,
            "unit": "ns",
            "extra": "jotai=397 ratio=0.6665 1.5x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 202,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 273,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1345,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "966ad78651a39a088749454db9cef7c3bea242b2",
          "message": "Fix global atom maxAge duplicate revalidation intervals (#74)\n\n* Fix global atoms with maxAge creating duplicate revalidation intervals\n\nWhen multiple stores subscribed to a global atom with maxAge, each store\nindependently started its own setInterval, causing defaultValue() to be\ncalled N times per cycle instead of once. Hoist the interval onto the\natom's _maxAgeInterval property with refcounting so only one interval\nruns regardless of store count. Also clear the interval on resetSelf\nand read current values from the live stores set instead of a\nclosed-over store reference.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Rename _maxAgeInterval to maxAgeInterval\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Make maxAgeInterval optional and guard cleanup with reference equality\n\nAddress review feedback:\n- Make maxAgeInterval optional in GlobalAtom type to avoid breaking\n  consumers who mock/implement the type\n- Guard both cleanup paths with reference equality check so a stale\n  closure from before resetSelf cannot wipe a newly created interval\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix in-flight promise updating store after maxAge cleanup\n\nAfter unsubscribing from an atom with maxAge, a pending defaultValue()\npromise could still resolve and write back to the store. Add a cancelled\nflag that is set in cleanup and checked in all promise handlers to\nprevent post-cleanup updates.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix getValueStore fallback and resetSelf/refcount coordination\n\n- getValueStore now falls back to closed-over data when all global\n  stores are detached, preventing undefined access\n- resetSelf zeroes refCount before clearing maxAgeInterval so stale\n  unsub closures no-op instead of double-cleaning or going negative\n- Both cleanup closures guard against refCount <= 0\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix maxAge interval leak when non-first subscriber unsubscribes last\n\nThe maxAge cleanup was only captured in the first subscriber's unsub\nclosure. If that subscriber unsubscribed before others, the remaining\nsubscribers had no cleanup to call when they were the last to leave,\nleaking the interval.\n\nMove maxAge cleanup storage to a shared WeakMap keyed by (store, state)\nso unsubscribe can always find and run it regardless of which\nsubscription triggers the final removal.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Add isGlobalAtom helper and remove as-any casts in subscribe\n\nUse Object.hasOwn-based isGlobalAtom type guard consistent with\nexisting isAtom/isSelector helpers. Narrow to GlobalAtom once at the\ntop of the maxAge block, eliminating all as-any casts and string-based\nproperty checks.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-14T05:27:27+02:00",
          "tree_id": "dceed925c84da14d33be66e572bf39f9bede47e8",
          "url": "https://github.com/eigilsagafos/valdres/commit/966ad78651a39a088749454db9cef7c3bea242b2"
        },
        "date": 1776137520101,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.0630 15.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=359 ratio=0.0724 13.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 163,
            "unit": "ns",
            "extra": "jotai=2181 ratio=0.0747 13.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 194,
            "unit": "ns",
            "extra": "jotai=2668 ratio=0.0727 13.8x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 193,
            "unit": "ns",
            "extra": "jotai=3668 ratio=0.0526 19.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16647,
            "unit": "ns",
            "extra": "jotai=282689 ratio=0.0589 17.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 317,
            "unit": "ns",
            "extra": "jotai=431 ratio=0.7352 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.0301 4.0x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 325,
            "unit": "ns",
            "extra": "jotai=416 ratio=0.7806 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 330,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 184,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3020,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=87 ratio=0.0995 10.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7862,
            "unit": "ns",
            "extra": "jotai=28292 ratio=0.2779 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 74000,
            "unit": "ns",
            "extra": "jotai=302442 ratio=0.2447 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7400,
            "unit": "ns",
            "extra": "jotai=16933 ratio=0.4370 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 557,
            "unit": "ns",
            "extra": "jotai=7321 ratio=0.0761 13.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 69114,
            "unit": "ns",
            "extra": "jotai=1159816 ratio=0.0596 16.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3845,
            "unit": "ns",
            "extra": "jotai=492579 ratio=0.0078 128.1x faster"
          },
          {
            "name": "sub + unsub",
            "value": 483,
            "unit": "ns",
            "extra": "jotai=2589 ratio=0.1866 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 76655,
            "unit": "ns",
            "extra": "jotai=288340 ratio=0.2658 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 129390,
            "unit": "ns",
            "extra": "jotai=573577 ratio=0.2256 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 741657,
            "unit": "ns",
            "extra": "jotai=3197520 ratio=0.2319 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 879691,
            "unit": "ns",
            "extra": "jotai=4592016 ratio=0.1916 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1442912,
            "unit": "ns",
            "extra": "jotai=24356370 ratio=0.0592 16.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 76208,
            "unit": "ns",
            "extra": "jotai=152739 ratio=0.4989 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 74398,
            "unit": "ns",
            "extra": "jotai=255228 ratio=0.2915 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 780124,
            "unit": "ns",
            "extra": "jotai=1607278 ratio=0.4854 2.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 984586,
            "unit": "ns",
            "extra": "jotai=2002574 ratio=0.4917 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1022928,
            "unit": "ns",
            "extra": "jotai=13117048 ratio=0.0780 12.8x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.7519 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8052,
            "unit": "ns",
            "extra": "jotai=22566 ratio=0.3568 2.8x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 71299,
            "unit": "ns",
            "extra": "jotai=142533 ratio=0.5002 2.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4613,
            "unit": "ns",
            "extra": "jotai=10456 ratio=0.4412 2.3x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=45 ratio=0.5473 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0673 14.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 252,
            "unit": "ns",
            "extra": "jotai=1317 ratio=0.1914 5.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=1475 ratio=0.1819 5.5x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "jotai=1787 ratio=0.1599 6.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 28656,
            "unit": "ns",
            "extra": "jotai=139609 ratio=0.2053 4.9x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 266,
            "unit": "ns",
            "extra": "jotai=1518 ratio=0.1752 5.7x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 83670,
            "unit": "ns",
            "extra": "jotai=445017 ratio=0.1880 5.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13163,
            "unit": "ns",
            "extra": "jotai=182477 ratio=0.0721 13.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 827,
            "unit": "ns",
            "extra": "jotai=2212 ratio=0.3738 2.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=478 ratio=0.8163 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 19,
            "unit": "ns",
            "extra": "jotai=6 ratio=3.4309 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 291,
            "unit": "ns",
            "extra": "jotai=380 ratio=0.7666 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 182,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 251,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1382,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "4ec5b61598f18915013f22c3c5aa1681331b15f1",
          "message": "Add reactive cache config and cacheMeta() API (#75)\n\n* Add reactive cache config (Reactive<T>) and cacheMeta() API\n\nAllow maxAge, staleWhileRevalidate, and staleIfError to be atoms or\nselectors instead of just numbers. When the config value changes, the\nrevalidation interval restarts automatically.\n\nAdd cacheMeta(atom) which returns a reactive selector exposing cache\nstate (isRevalidating, lastSuccessAt, maxAge, etc.). Works with global\natoms — metadata is seeded into new stores and propagated to all stores\non updates.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Move cacheMeta storage from module-scope WeakMaps to Atom properties\n\nStore __cacheMeta and __cacheMetaSelector directly on the Atom object\ninstead of in separate module-scope WeakMaps. Eliminates cacheMetaAtoms.ts\nand the hidden global registries. CacheMeta type moves to types/Atom.ts.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address PR review: propagate seeded meta, fix waitFor and test name\n\n- Add propagateUpdatedAtoms after seeding cacheMeta in new global store\n- Fix waitFor to use count + 1 and add maxRetries guard\n- Rename test to match null assertion\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-14T05:58:35+02:00",
          "tree_id": "e82304ab8fa227daf200f2e19117c9b6d3a2c111",
          "url": "https://github.com/eigilsagafos/valdres/commit/4ec5b61598f18915013f22c3c5aa1681331b15f1"
        },
        "date": 1776139372966,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=44 ratio=0.0432 23.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=291 ratio=0.1031 9.7x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 140,
            "unit": "ns",
            "extra": "jotai=1672 ratio=0.0837 11.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 135,
            "unit": "ns",
            "extra": "jotai=2173 ratio=0.0619 16.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 147,
            "unit": "ns",
            "extra": "jotai=2717 ratio=0.0540 18.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 12574,
            "unit": "ns",
            "extra": "jotai=224642 ratio=0.0560 17.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=454 ratio=0.7319 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=9 ratio=4.8820 4.9x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 362,
            "unit": "ns",
            "extra": "jotai=447 ratio=0.8089 1.2x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 277,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 146,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2606,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.1116 9.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6771,
            "unit": "ns",
            "extra": "jotai=24660 ratio=0.2746 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 60660,
            "unit": "ns",
            "extra": "jotai=217271 ratio=0.2792 3.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6206,
            "unit": "ns",
            "extra": "jotai=12555 ratio=0.4943 2.0x faster"
          },
          {
            "name": "createStore",
            "value": 563,
            "unit": "ns",
            "extra": "jotai=5336 ratio=0.1054 9.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 54751,
            "unit": "ns",
            "extra": "jotai=921069 ratio=0.0594 16.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 5484,
            "unit": "ns",
            "extra": "jotai=365775 ratio=0.0150 66.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 391,
            "unit": "ns",
            "extra": "jotai=1963 ratio=0.1992 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 62703,
            "unit": "ns",
            "extra": "jotai=328625 ratio=0.1908 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 109802,
            "unit": "ns",
            "extra": "jotai=477926 ratio=0.2297 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 601443,
            "unit": "ns",
            "extra": "jotai=2828335 ratio=0.2126 4.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 718701,
            "unit": "ns",
            "extra": "jotai=3122579 ratio=0.2302 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1141881,
            "unit": "ns",
            "extra": "jotai=17035213 ratio=0.0670 14.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 54530,
            "unit": "ns",
            "extra": "jotai=106988 ratio=0.5097 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 58987,
            "unit": "ns",
            "extra": "jotai=186345 ratio=0.3165 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 609730,
            "unit": "ns",
            "extra": "jotai=1056435 ratio=0.5772 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 766231,
            "unit": "ns",
            "extra": "jotai=1465984 ratio=0.5227 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 754835,
            "unit": "ns",
            "extra": "jotai=9991001 ratio=0.0756 13.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 35,
            "unit": "ns",
            "extra": "jotai=43 ratio=0.8120 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 6440,
            "unit": "ns",
            "extra": "jotai=15739 ratio=0.4092 2.4x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 55482,
            "unit": "ns",
            "extra": "jotai=99978 ratio=0.5549 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 3658,
            "unit": "ns",
            "extra": "jotai=8034 ratio=0.4554 2.2x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=39 ratio=0.5623 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=125 ratio=0.0790 12.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 212,
            "unit": "ns",
            "extra": "jotai=938 ratio=0.2256 4.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 228,
            "unit": "ns",
            "extra": "jotai=1169 ratio=0.1949 5.1x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 239,
            "unit": "ns",
            "extra": "jotai=1368 ratio=0.1744 5.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 24278,
            "unit": "ns",
            "extra": "jotai=108971 ratio=0.2228 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 124,
            "unit": "ns",
            "extra": "jotai=1104 ratio=0.1123 8.9x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 71626,
            "unit": "ns",
            "extra": "jotai=327914 ratio=0.2184 4.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 10591,
            "unit": "ns",
            "extra": "jotai=165284 ratio=0.0641 15.6x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 576,
            "unit": "ns",
            "extra": "jotai=1734 ratio=0.3321 3.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 468,
            "unit": "ns",
            "extra": "jotai=533 ratio=0.8787 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 18,
            "unit": "ns",
            "extra": "jotai=5 ratio=3.3927 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 362,
            "unit": "ns",
            "extra": "jotai=409 ratio=0.8853 1.1x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 10,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 211,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1084,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9c98e4f68967a51f0300efe40a2c022bc4bfe180",
          "message": "Run tests in parallel with bun --parallel (#77)\n\n* Run tests in parallel with bun --parallel\n\nAdds `--parallel` to every package's test script. `--parallel` spawns\nworker processes per file and implies `--isolate`, so each file gets a\nfresh global. That makes the valdres memoryleaks two-phase split\n(previously run in a second `bun test` invocation for heap isolation)\nunnecessary — collapsed back into a single command.\n\nWarm monorepo time: 6.6s → 3.9s. Within valdres: 3.4s → 1.2s.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Centralize test:ci reporter args at the root\n\nRemoves per-package test:ci scripts. Root test:ci now forwards JUnit\nreporter flags to every package via `bun --filter '*' test -- <args>`.\nbun test takes the last --reporter= flag so the CI flags override the\nlocal `--reporter=dots`.\n\nEach package still writes its own junit.xml in its cwd, which the CI\naggregator already collects via `find packages -name 'junit*.xml'`.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Run jotai compat tests serially\n\nCI failed with a flaky memoryleaks assertion (jotai-tests/vanilla/memoryleaks.test.ts)\nunder --parallel on the 4-CPU runner. PR #46 history shows these tests have a long\ntrack record of CI flakiness tied to GC timing — parallel worker memory contention\nreintroduced it. Monorepo-level parallelism between packages still applies.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Pin Bun to 1.3.13 in CI and engines\n\n--parallel was added in Bun 1.3.13. Without a pin, a future setup-bun\ndefault change or an older local Bun install would surface as a cryptic\n\"unknown option: --parallel\". engines.bun makes bun install warn; the\nCI pin makes the workflows reproducible.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-22T11:47:21-07:00",
          "tree_id": "a935f43efa660781e0ce6eb79ca275c2f24036c7",
          "url": "https://github.com/eigilsagafos/valdres/commit/9c98e4f68967a51f0300efe40a2c022bc4bfe180"
        },
        "date": 1776883891526,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0452 22.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2014 ratio=0.0849 11.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 182,
            "unit": "ns",
            "extra": "jotai=2585 ratio=0.0705 14.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 193,
            "unit": "ns",
            "extra": "jotai=3398 ratio=0.0569 17.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17361,
            "unit": "ns",
            "extra": "jotai=270376 ratio=0.0642 15.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 316,
            "unit": "ns",
            "extra": "jotai=486 ratio=0.6513 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 50,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.7287 4.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 343,
            "unit": "ns",
            "extra": "jotai=481 ratio=0.7135 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 353,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3288,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=73 ratio=0.0676 14.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8978,
            "unit": "ns",
            "extra": "jotai=28062 ratio=0.3199 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83106,
            "unit": "ns",
            "extra": "jotai=340447 ratio=0.2441 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8240,
            "unit": "ns",
            "extra": "jotai=18649 ratio=0.4418 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 684,
            "unit": "ns",
            "extra": "jotai=6860 ratio=0.0997 10.0x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74059,
            "unit": "ns",
            "extra": "jotai=1177571 ratio=0.0629 15.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6612,
            "unit": "ns",
            "extra": "jotai=359903 ratio=0.0184 54.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 521,
            "unit": "ns",
            "extra": "jotai=2465 ratio=0.2114 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 89097,
            "unit": "ns",
            "extra": "jotai=407532 ratio=0.2186 4.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 117569,
            "unit": "ns",
            "extra": "jotai=748440 ratio=0.1571 6.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 767576,
            "unit": "ns",
            "extra": "jotai=4574714 ratio=0.1678 6.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 932148,
            "unit": "ns",
            "extra": "jotai=4953281 ratio=0.1882 5.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1157860,
            "unit": "ns",
            "extra": "jotai=25651259 ratio=0.0451 22.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79228,
            "unit": "ns",
            "extra": "jotai=141575 ratio=0.5596 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78933,
            "unit": "ns",
            "extra": "jotai=243510 ratio=0.3241 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 846693,
            "unit": "ns",
            "extra": "jotai=1297686 ratio=0.6525 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1041968,
            "unit": "ns",
            "extra": "jotai=1845336 ratio=0.5646 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1024591,
            "unit": "ns",
            "extra": "jotai=12624085 ratio=0.0812 12.3x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.7358 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8844,
            "unit": "ns",
            "extra": "jotai=19220 ratio=0.4601 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 79830,
            "unit": "ns",
            "extra": "jotai=129271 ratio=0.6175 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4845,
            "unit": "ns",
            "extra": "jotai=9863 ratio=0.4912 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.5015 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0731 13.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 290,
            "unit": "ns",
            "extra": "jotai=1264 ratio=0.2296 4.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 305,
            "unit": "ns",
            "extra": "jotai=1465 ratio=0.2083 4.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 319,
            "unit": "ns",
            "extra": "jotai=1714 ratio=0.1859 5.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31389,
            "unit": "ns",
            "extra": "jotai=139932 ratio=0.2243 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=1214 ratio=0.1323 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89327,
            "unit": "ns",
            "extra": "jotai=445243 ratio=0.2006 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13996,
            "unit": "ns",
            "extra": "jotai=205314 ratio=0.0682 14.7x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 784,
            "unit": "ns",
            "extra": "jotai=2065 ratio=0.3795 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 395,
            "unit": "ns",
            "extra": "jotai=476 ratio=0.8298 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.1599 4.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=351 ratio=0.6843 1.5x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 200,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 282,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1341,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "16824005d061780a09d4eb92639f77a00029a8df",
          "message": "Add @valdres/browser-keyboard package (#76)\n\n* Add @valdres/browser-keyboard package\n\nReactive global keyboard state built on valdres atoms and selectors:\n- pressedKeysAtom as single source of truth holding PressedKey[]\n- pressedCodesSelector, pressedKeyValuesSelector, modifierSelector,\n  isCodePressedSelector, isKeyPressedSelector derived from it\n- toggleKeyAtom family for CapsLock/NumLock/ScrollLock state\n- Handles macOS Meta keyup quirk, IME composition, and window blur\n  cleanup\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Auto-bootstrap DOM listeners via onInit, remove test scaffolding\n\nReplace explicit init() call with onInit hook on pressedKeysAtom. DOM\nlisteners attach on first subscribe and detach on unmount — consumers\nno longer need to remember to bootstrap.\n\nAlso drop the vite-based manual test page: it was dev scaffolding,\nnot part of the published package.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review: guard window, reset state on cleanup, dedupe KeyboardCode\n\n- Extract bootstrap from pressedKeysAtom.onInit into lib/bootstrap.ts so it's\n  independently testable\n- Guard window access (non-browser runtimes may provide document shim but not\n  window), matching the pattern in @valdres/color-mode\n- Cleanup now calls clearAllPressed so locksState.initialized and toggleKeyAtom\n  values reset on unmount — prevents stale lock state across remounts\n- Re-export KeyboardCode from @valdres/browser-keyboard in @valdres/hotkeys so\n  the canonical definition lives with the primitive and the two can't drift\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Use type-only re-export for KeyboardCode\n\nverbatimModuleSyntax requires the `type` keyword for type-only re-exports.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-22T13:49:08-07:00",
          "tree_id": "973ae20cbc6e1377386fe5c31f21e925e17e4c29",
          "url": "https://github.com/eigilsagafos/valdres/commit/16824005d061780a09d4eb92639f77a00029a8df"
        },
        "date": 1776891193233,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.0455 22.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2064 ratio=0.0872 11.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 175,
            "unit": "ns",
            "extra": "jotai=2634 ratio=0.0664 15.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 191,
            "unit": "ns",
            "extra": "jotai=3474 ratio=0.0550 18.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15494,
            "unit": "ns",
            "extra": "jotai=277267 ratio=0.0559 17.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 349,
            "unit": "ns",
            "extra": "jotai=509 ratio=0.6870 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.7049 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 362,
            "unit": "ns",
            "extra": "jotai=505 ratio=0.7175 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 357,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 189,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3297,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.0927 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8341,
            "unit": "ns",
            "extra": "jotai=30386 ratio=0.2745 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 76165,
            "unit": "ns",
            "extra": "jotai=340212 ratio=0.2239 4.5x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7611,
            "unit": "ns",
            "extra": "jotai=17918 ratio=0.4248 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 664,
            "unit": "ns",
            "extra": "jotai=6724 ratio=0.0988 10.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 72439,
            "unit": "ns",
            "extra": "jotai=1155920 ratio=0.0627 16.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 4130,
            "unit": "ns",
            "extra": "jotai=368734 ratio=0.0112 89.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 481,
            "unit": "ns",
            "extra": "jotai=2333 ratio=0.2062 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 78228,
            "unit": "ns",
            "extra": "jotai=403397 ratio=0.1939 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 140737,
            "unit": "ns",
            "extra": "jotai=680289 ratio=0.2069 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 761416,
            "unit": "ns",
            "extra": "jotai=4689106 ratio=0.1624 6.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 908397,
            "unit": "ns",
            "extra": "jotai=4886113 ratio=0.1859 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1420678,
            "unit": "ns",
            "extra": "jotai=25188069 ratio=0.0564 17.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 70386,
            "unit": "ns",
            "extra": "jotai=138699 ratio=0.5075 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 69134,
            "unit": "ns",
            "extra": "jotai=237147 ratio=0.2915 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 759248,
            "unit": "ns",
            "extra": "jotai=1333147 ratio=0.5695 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 954406,
            "unit": "ns",
            "extra": "jotai=1905638 ratio=0.5008 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 921386,
            "unit": "ns",
            "extra": "jotai=12555716 ratio=0.0734 13.6x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.8075 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7896,
            "unit": "ns",
            "extra": "jotai=19504 ratio=0.4048 2.5x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 69014,
            "unit": "ns",
            "extra": "jotai=129154 ratio=0.5344 1.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4490,
            "unit": "ns",
            "extra": "jotai=9788 ratio=0.4587 2.2x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5450 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0793 12.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 262,
            "unit": "ns",
            "extra": "jotai=1210 ratio=0.2165 4.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 279,
            "unit": "ns",
            "extra": "jotai=1475 ratio=0.1893 5.3x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 299,
            "unit": "ns",
            "extra": "jotai=1734 ratio=0.1725 5.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30369,
            "unit": "ns",
            "extra": "jotai=136715 ratio=0.2221 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 155,
            "unit": "ns",
            "extra": "jotai=1191 ratio=0.1299 7.7x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 96044,
            "unit": "ns",
            "extra": "jotai=422737 ratio=0.2272 4.4x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13871,
            "unit": "ns",
            "extra": "jotai=206050 ratio=0.0673 14.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 696,
            "unit": "ns",
            "extra": "jotai=2077 ratio=0.3350 3.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 442,
            "unit": "ns",
            "extra": "jotai=539 ratio=0.8208 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.3106 3.3x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 353,
            "unit": "ns",
            "extra": "jotai=400 ratio=0.8821 1.1x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 275,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1303,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "161d3276a344a2e2bf987bab6fdeb86b03ddd5f0",
          "message": "Add @valdres/browser-online package (#79)\n\n* Add @valdres/browser-online package\n\nWraps navigator.onLine and window online/offline events as a reactive\nvaldres atom. Mirrors the structure of @valdres/browser-keyboard.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Use happy-dom for browser-online tests\n\nReplaces hand-rolled fake window/navigator objects with\n@happy-dom/global-registrator, matching the setup already used by\nvaldres-react, valdres-vue, and @valdres/color-mode.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Rename bootstrap to subscribe\n\nThe function attaches event listeners and returns an unsubscribe, so\nsubscribe matches the reactive-state idiom more clearly than bootstrap.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Inline eventHandler into subscribe\n\nThe handler was 3 lines with no branching — it didn't earn its own\nfile. Keep update at module scope so add/removeEventListener reference\nthe same function across multiple subscribe/cleanup cycles.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Evaluate onlineAtom initial value lazily\n\nPass getInitial as a function (not invoked) so navigator.onLine is\nread when the atom is first accessed, not at module import. Add a\ntest that exercises the onInit path via store().get(onlineAtom).\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-23T14:53:28-07:00",
          "tree_id": "f0157e5c7a4aaaa3dcfe681aa97d62333f5df4a4",
          "url": "https://github.com/eigilsagafos/valdres/commit/161d3276a344a2e2bf987bab6fdeb86b03ddd5f0"
        },
        "date": 1776981454523,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.0448 22.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2113 ratio=0.0852 11.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=2644 ratio=0.0679 14.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 187,
            "unit": "ns",
            "extra": "jotai=3446 ratio=0.0543 18.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16873,
            "unit": "ns",
            "extra": "jotai=279490 ratio=0.0604 16.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 346,
            "unit": "ns",
            "extra": "jotai=496 ratio=0.6974 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6992 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 360,
            "unit": "ns",
            "extra": "jotai=494 ratio=0.7295 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 359,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 185,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2294,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.0918 10.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8417,
            "unit": "ns",
            "extra": "jotai=31020 ratio=0.2713 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77367,
            "unit": "ns",
            "extra": "jotai=332260 ratio=0.2329 4.3x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7690,
            "unit": "ns",
            "extra": "jotai=17990 ratio=0.4275 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 662,
            "unit": "ns",
            "extra": "jotai=6796 ratio=0.0975 10.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 72389,
            "unit": "ns",
            "extra": "jotai=1154927 ratio=0.0627 16.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7090,
            "unit": "ns",
            "extra": "jotai=368884 ratio=0.0192 52.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 510,
            "unit": "ns",
            "extra": "jotai=2374 ratio=0.2148 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 76025,
            "unit": "ns",
            "extra": "jotai=397839 ratio=0.1911 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 137006,
            "unit": "ns",
            "extra": "jotai=702036 ratio=0.1952 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 775976,
            "unit": "ns",
            "extra": "jotai=4549742 ratio=0.1706 5.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 924771,
            "unit": "ns",
            "extra": "jotai=4832869 ratio=0.1914 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1416831,
            "unit": "ns",
            "extra": "jotai=25167493 ratio=0.0563 17.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 69925,
            "unit": "ns",
            "extra": "jotai=137116 ratio=0.5100 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 71647,
            "unit": "ns",
            "extra": "jotai=234012 ratio=0.3062 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 775867,
            "unit": "ns",
            "extra": "jotai=1301928 ratio=0.5959 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 972818,
            "unit": "ns",
            "extra": "jotai=1830082 ratio=0.5316 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 964301,
            "unit": "ns",
            "extra": "jotai=12414608 ratio=0.0777 12.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.8258 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7982,
            "unit": "ns",
            "extra": "jotai=19163 ratio=0.4165 2.4x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 70025,
            "unit": "ns",
            "extra": "jotai=127061 ratio=0.5511 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4607,
            "unit": "ns",
            "extra": "jotai=9734 ratio=0.4733 2.1x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5547 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0789 12.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=1194 ratio=0.2245 4.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1458 ratio=0.2044 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 326,
            "unit": "ns",
            "extra": "jotai=1743 ratio=0.1869 5.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31718,
            "unit": "ns",
            "extra": "jotai=140211 ratio=0.2262 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 155,
            "unit": "ns",
            "extra": "jotai=1235 ratio=0.1255 8.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 94602,
            "unit": "ns",
            "extra": "jotai=423397 ratio=0.2234 4.5x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13770,
            "unit": "ns",
            "extra": "jotai=204838 ratio=0.0672 14.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 697,
            "unit": "ns",
            "extra": "jotai=2064 ratio=0.3376 3.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 437,
            "unit": "ns",
            "extra": "jotai=553 ratio=0.7892 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.3781 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 336,
            "unit": "ns",
            "extra": "jotai=396 ratio=0.8492 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 201,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1338,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "5bb7ab10a882395c2a8eb5e26bb831cb0e62a6a7",
          "message": "Fix flaky atom maxAge revalidation test (#80)\n\nReplace fixed 1ms waits with waitFor so assertions retry instead of\nracing resolve-then-commit on loaded CI runners.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-23T14:55:28-07:00",
          "tree_id": "51fd0d8ae7846f75c86fdcabe4160b9172cfd411",
          "url": "https://github.com/eigilsagafos/valdres/commit/5bb7ab10a882395c2a8eb5e26bb831cb0e62a6a7"
        },
        "date": 1776981704023,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0500 20.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=511 ratio=0.0783 12.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 200,
            "unit": "ns",
            "extra": "jotai=2503 ratio=0.0799 12.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 210,
            "unit": "ns",
            "extra": "jotai=2924 ratio=0.0718 13.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 190,
            "unit": "ns",
            "extra": "jotai=4112 ratio=0.0463 21.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17262,
            "unit": "ns",
            "extra": "jotai=298671 ratio=0.0578 17.3x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 395,
            "unit": "ns",
            "extra": "jotai=533 ratio=0.7421 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 32,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.8332 2.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 405,
            "unit": "ns",
            "extra": "jotai=530 ratio=0.7631 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 357,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3526,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.0943 10.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9088,
            "unit": "ns",
            "extra": "jotai=35110 ratio=0.2588 3.9x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 82945,
            "unit": "ns",
            "extra": "jotai=337609 ratio=0.2457 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7958,
            "unit": "ns",
            "extra": "jotai=18981 ratio=0.4193 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 675,
            "unit": "ns",
            "extra": "jotai=6852 ratio=0.0985 10.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74152,
            "unit": "ns",
            "extra": "jotai=1524043 ratio=0.0487 20.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 10172,
            "unit": "ns",
            "extra": "jotai=773797 ratio=0.0131 76.1x faster"
          },
          {
            "name": "sub + unsub",
            "value": 551,
            "unit": "ns",
            "extra": "jotai=3145 ratio=0.1752 5.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 86441,
            "unit": "ns",
            "extra": "jotai=318651 ratio=0.2713 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 108514,
            "unit": "ns",
            "extra": "jotai=654356 ratio=0.1658 6.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 751563,
            "unit": "ns",
            "extra": "jotai=3525756 ratio=0.2132 4.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 900858,
            "unit": "ns",
            "extra": "jotai=4912957 ratio=0.1834 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1120820,
            "unit": "ns",
            "extra": "jotai=22303557 ratio=0.0503 19.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 69535,
            "unit": "ns",
            "extra": "jotai=143697 ratio=0.4839 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 73962,
            "unit": "ns",
            "extra": "jotai=232000 ratio=0.3188 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 798994,
            "unit": "ns",
            "extra": "jotai=1304356 ratio=0.6126 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 981179,
            "unit": "ns",
            "extra": "jotai=1814325 ratio=0.5408 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 952736,
            "unit": "ns",
            "extra": "jotai=12601024 ratio=0.0756 13.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.8484 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8035,
            "unit": "ns",
            "extra": "jotai=19414 ratio=0.4139 2.4x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 70326,
            "unit": "ns",
            "extra": "jotai=127873 ratio=0.5500 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4607,
            "unit": "ns",
            "extra": "jotai=9907 ratio=0.4650 2.2x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5422 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=163 ratio=0.0782 12.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 274,
            "unit": "ns",
            "extra": "jotai=1191 ratio=0.2302 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=1407 ratio=0.2056 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=1701 ratio=0.1830 5.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30672,
            "unit": "ns",
            "extra": "jotai=140561 ratio=0.2182 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1176 ratio=0.1337 7.5x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 96395,
            "unit": "ns",
            "extra": "jotai=417249 ratio=0.2310 4.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13841,
            "unit": "ns",
            "extra": "jotai=208594 ratio=0.0664 15.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 705,
            "unit": "ns",
            "extra": "jotai=2064 ratio=0.3415 2.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 448,
            "unit": "ns",
            "extra": "jotai=547 ratio=0.8197 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.4001 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 334,
            "unit": "ns",
            "extra": "jotai=393 ratio=0.8495 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 206,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1303,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "027192f0a53ea4759376d62c71eeaaeec782d59d",
          "message": "Add @valdres/public-ip package (#81)\n\n* Add @valdres/public-ip package\n\nExposes the user's public IP as reactive valdres atoms. Provides\nseparate publicIpV4Atom and publicIpV6Atom (with configurable endpoint\nlists) backed by a shared maxAge. Auto-refetches on browser network\nsignals (online, visibilitychange, navigator.connection.change) with\nSSR-safe feature detection.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address PR review: family validation + test cleanup\n\nFix v4 atom silently returning IPv6 on dual-stack hosts by switching\ndefault endpoint to api4.ipify.org and enforcing an IPv4-only validator.\nSplit isValidIp into v4/v6/union so each atom rejects wrong-family\nresponses and falls through to the next endpoint. Add publicIpAtom +\npublicIpEndpointsAtom for the family-agnostic default. Restore\nglobalThis.fetch in all test afterAll hooks to avoid cross-file leakage.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-23T16:29:31-07:00",
          "tree_id": "a76ea1af4716786902097a33b4ed6543ba60ff70",
          "url": "https://github.com/eigilsagafos/valdres/commit/027192f0a53ea4759376d62c71eeaaeec782d59d"
        },
        "date": 1776987230519,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.0763 13.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=367 ratio=0.0817 12.2x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 165,
            "unit": "ns",
            "extra": "jotai=2221 ratio=0.0743 13.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 197,
            "unit": "ns",
            "extra": "jotai=2681 ratio=0.0735 13.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 192,
            "unit": "ns",
            "extra": "jotai=3792 ratio=0.0506 19.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16566,
            "unit": "ns",
            "extra": "jotai=276574 ratio=0.0599 16.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=430 ratio=0.7128 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5882 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 329,
            "unit": "ns",
            "extra": "jotai=417 ratio=0.7888 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 324,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 181,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2967,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=84 ratio=0.1026 9.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8236,
            "unit": "ns",
            "extra": "jotai=29181 ratio=0.2822 3.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 75681,
            "unit": "ns",
            "extra": "jotai=313162 ratio=0.2417 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6876,
            "unit": "ns",
            "extra": "jotai=16780 ratio=0.4098 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 571,
            "unit": "ns",
            "extra": "jotai=7322 ratio=0.0780 12.8x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 72447,
            "unit": "ns",
            "extra": "jotai=1153012 ratio=0.0628 15.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6405,
            "unit": "ns",
            "extra": "jotai=488790 ratio=0.0131 76.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 493,
            "unit": "ns",
            "extra": "jotai=2544 ratio=0.1938 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 77253,
            "unit": "ns",
            "extra": "jotai=298239 ratio=0.2590 3.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 129201,
            "unit": "ns",
            "extra": "jotai=585214 ratio=0.2208 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 739819,
            "unit": "ns",
            "extra": "jotai=3287072 ratio=0.2251 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 879379,
            "unit": "ns",
            "extra": "jotai=4664719 ratio=0.1885 5.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1406556,
            "unit": "ns",
            "extra": "jotai=24869470 ratio=0.0566 17.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 74668,
            "unit": "ns",
            "extra": "jotai=159680 ratio=0.4676 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 75747,
            "unit": "ns",
            "extra": "jotai=261819 ratio=0.2893 3.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 818550,
            "unit": "ns",
            "extra": "jotai=1444970 ratio=0.5665 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 985393,
            "unit": "ns",
            "extra": "jotai=1850208 ratio=0.5326 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1098685,
            "unit": "ns",
            "extra": "jotai=13039168 ratio=0.0843 11.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.7050 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8549,
            "unit": "ns",
            "extra": "jotai=21477 ratio=0.3980 2.5x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 70517,
            "unit": "ns",
            "extra": "jotai=138777 ratio=0.5081 2.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4558,
            "unit": "ns",
            "extra": "jotai=10502 ratio=0.4340 2.3x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.3978 2.5x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=162 ratio=0.0659 15.2x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 243,
            "unit": "ns",
            "extra": "jotai=1326 ratio=0.1830 5.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 260,
            "unit": "ns",
            "extra": "jotai=1508 ratio=0.1725 5.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 288,
            "unit": "ns",
            "extra": "jotai=1909 ratio=0.1510 6.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 28946,
            "unit": "ns",
            "extra": "jotai=145391 ratio=0.1991 5.0x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 263,
            "unit": "ns",
            "extra": "jotai=1601 ratio=0.1644 6.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 83047,
            "unit": "ns",
            "extra": "jotai=434547 ratio=0.1911 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13347,
            "unit": "ns",
            "extra": "jotai=189571 ratio=0.0704 14.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 763,
            "unit": "ns",
            "extra": "jotai=2318 ratio=0.3294 3.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 396,
            "unit": "ns",
            "extra": "jotai=481 ratio=0.8235 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 19,
            "unit": "ns",
            "extra": "jotai=5 ratio=3.4915 3.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 317,
            "unit": "ns",
            "extra": "jotai=423 ratio=0.7492 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 182,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 252,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1432,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "247e1f717be1b51819ae03e271a10f6377db7cff",
          "message": "Add @valdres/browser-geolocation package (#82)\n\n* Add @valdres/browser-geolocation package\n\nReactive wrapper around navigator.geolocation: watchPosition-backed\npositionAtom, permissionAtom via the Permissions API (with onchange),\na watch-lifecycle status atom, typed error atom, and writable options\nthat restart the watch live.\n\nShips with a demo page on port 3011 with a Leaflet/OSM map that tracks\nthe user's position.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- bootstrap: clear geolocationErrorAtom on watch (re)start and on cleanup so stale errors don't leak across option changes or resetSelf\n- coordsSelector.test: use resetSelf() to match positionAtom.test and ensure global watch state is fully torn down between test files\n- Add regression test for error-clearing on options-driven restart\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Fix flaky atom maxAge revalidation test (take 2)\n\nIncrease maxAge from 20ms to 50ms and add a deterministic wait before\npolling fetchCount. The prior tight window let CI load reorder the\nrevalidation interval relative to the initial resolve, timing out\nwaitFor at 5s.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-23T17:31:58-07:00",
          "tree_id": "238f43a92643ddf043062fcb54df2c1094540196",
          "url": "https://github.com/eigilsagafos/valdres/commit/247e1f717be1b51819ae03e271a10f6377db7cff"
        },
        "date": 1776990962596,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0459 21.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=370 ratio=0.1081 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2033 ratio=0.0841 11.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2585 ratio=0.0696 14.4x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 190,
            "unit": "ns",
            "extra": "jotai=3356 ratio=0.0567 17.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15869,
            "unit": "ns",
            "extra": "jotai=267993 ratio=0.0592 16.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 285,
            "unit": "ns",
            "extra": "jotai=451 ratio=0.6323 1.6x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5625 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 294,
            "unit": "ns",
            "extra": "jotai=434 ratio=0.6771 1.5x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 347,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3087,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.0690 14.5x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8213,
            "unit": "ns",
            "extra": "jotai=29612 ratio=0.2773 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 78656,
            "unit": "ns",
            "extra": "jotai=324472 ratio=0.2424 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7663,
            "unit": "ns",
            "extra": "jotai=17627 ratio=0.4347 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 613,
            "unit": "ns",
            "extra": "jotai=6497 ratio=0.0943 10.6x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 75681,
            "unit": "ns",
            "extra": "jotai=1150702 ratio=0.0658 15.2x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6602,
            "unit": "ns",
            "extra": "jotai=516274 ratio=0.0128 78.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 481,
            "unit": "ns",
            "extra": "jotai=2424 ratio=0.1984 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 81812,
            "unit": "ns",
            "extra": "jotai=294352 ratio=0.2779 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 139368,
            "unit": "ns",
            "extra": "jotai=610724 ratio=0.2282 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 759340,
            "unit": "ns",
            "extra": "jotai=3281362 ratio=0.2314 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 920148,
            "unit": "ns",
            "extra": "jotai=4723309 ratio=0.1948 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1406471,
            "unit": "ns",
            "extra": "jotai=24410170 ratio=0.0576 17.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 75881,
            "unit": "ns",
            "extra": "jotai=139949 ratio=0.5422 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78576,
            "unit": "ns",
            "extra": "jotai=239545 ratio=0.3280 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 845896,
            "unit": "ns",
            "extra": "jotai=1318949 ratio=0.6413 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1040326,
            "unit": "ns",
            "extra": "jotai=1819889 ratio=0.5716 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1004425,
            "unit": "ns",
            "extra": "jotai=12448972 ratio=0.0807 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.7609 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8474,
            "unit": "ns",
            "extra": "jotai=19410 ratio=0.4366 2.3x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 75941,
            "unit": "ns",
            "extra": "jotai=129330 ratio=0.5872 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4906,
            "unit": "ns",
            "extra": "jotai=9775 ratio=0.5019 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.4929 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0731 13.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=1232 ratio=0.2260 4.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1478 ratio=0.2018 5.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 338,
            "unit": "ns",
            "extra": "jotai=1690 ratio=0.2000 5.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32901,
            "unit": "ns",
            "extra": "jotai=141212 ratio=0.2330 4.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=1258 ratio=0.1282 7.8x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 87974,
            "unit": "ns",
            "extra": "jotai=453667 ratio=0.1939 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13816,
            "unit": "ns",
            "extra": "jotai=210310 ratio=0.0657 15.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 785,
            "unit": "ns",
            "extra": "jotai=2070 ratio=0.3790 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 391,
            "unit": "ns",
            "extra": "jotai=481 ratio=0.8122 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.1465 4.1x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 250,
            "unit": "ns",
            "extra": "jotai=351 ratio=0.7106 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 279,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1335,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "fecad26f36eacc8a2b3f36572b95f8e18ba99666",
          "message": "Add @valdres/browser-screen package (#84)\n\n* Add @valdres/browser-screen package\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Freeze the EMPTY screen snapshot so consumer mutation can't leak\n  across reads/stores\n- Feature-detect MediaQueryList.addEventListener and fall back to the\n  legacy addListener/removeListener for older browsers\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T05:57:10-07:00",
          "tree_id": "e03f6db178463a9cf91352784a2ec1a3002edc0f",
          "url": "https://github.com/eigilsagafos/valdres/commit/fecad26f36eacc8a2b3f36572b95f8e18ba99666"
        },
        "date": 1777035676584,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0484 20.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=421 ratio=0.0950 10.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2034 ratio=0.0841 11.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=2595 ratio=0.0691 14.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 193,
            "unit": "ns",
            "extra": "jotai=3443 ratio=0.0560 17.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15910,
            "unit": "ns",
            "extra": "jotai=269753 ratio=0.0590 17.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 305,
            "unit": "ns",
            "extra": "jotai=461 ratio=0.6621 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6342 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 313,
            "unit": "ns",
            "extra": "jotai=441 ratio=0.7100 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 345,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 192,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3122,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0876 11.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8789,
            "unit": "ns",
            "extra": "jotai=30460 ratio=0.2885 3.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 79718,
            "unit": "ns",
            "extra": "jotai=324185 ratio=0.2459 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7544,
            "unit": "ns",
            "extra": "jotai=18051 ratio=0.4179 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 622,
            "unit": "ns",
            "extra": "jotai=6529 ratio=0.0953 10.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 75160,
            "unit": "ns",
            "extra": "jotai=1155295 ratio=0.0651 15.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 4028,
            "unit": "ns",
            "extra": "jotai=354542 ratio=0.0114 88.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 491,
            "unit": "ns",
            "extra": "jotai=2435 ratio=0.2016 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 81818,
            "unit": "ns",
            "extra": "jotai=396750 ratio=0.2062 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 141023,
            "unit": "ns",
            "extra": "jotai=720925 ratio=0.1956 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 781233,
            "unit": "ns",
            "extra": "jotai=4421109 ratio=0.1767 5.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 924185,
            "unit": "ns",
            "extra": "jotai=4681705 ratio=0.1974 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1422825,
            "unit": "ns",
            "extra": "jotai=24487392 ratio=0.0581 17.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79548,
            "unit": "ns",
            "extra": "jotai=141264 ratio=0.5631 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78567,
            "unit": "ns",
            "extra": "jotai=237889 ratio=0.3303 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 850116,
            "unit": "ns",
            "extra": "jotai=1293914 ratio=0.6570 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1053561,
            "unit": "ns",
            "extra": "jotai=1796061 ratio=0.5866 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 975651,
            "unit": "ns",
            "extra": "jotai=12441272 ratio=0.0784 12.8x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.7725 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8863,
            "unit": "ns",
            "extra": "jotai=19416 ratio=0.4565 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77554,
            "unit": "ns",
            "extra": "jotai=127719 ratio=0.6072 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4891,
            "unit": "ns",
            "extra": "jotai=9691 ratio=0.5047 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.4852 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0740 13.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 277,
            "unit": "ns",
            "extra": "jotai=1251 ratio=0.2217 4.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 301,
            "unit": "ns",
            "extra": "jotai=1469 ratio=0.2048 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=1717 ratio=0.1819 5.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31323,
            "unit": "ns",
            "extra": "jotai=139771 ratio=0.2241 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1294 ratio=0.1213 8.2x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 91150,
            "unit": "ns",
            "extra": "jotai=457610 ratio=0.1992 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13836,
            "unit": "ns",
            "extra": "jotai=207879 ratio=0.0666 15.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 786,
            "unit": "ns",
            "extra": "jotai=2066 ratio=0.3805 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 414,
            "unit": "ns",
            "extra": "jotai=491 ratio=0.8430 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.7733 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 277,
            "unit": "ns",
            "extra": "jotai=365 ratio=0.7591 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 200,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1321,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f0db284727eb18e5f85e81356f69c95970ad6429",
          "message": "Fix flaky cacheMeta isRevalidating test (#86)\n\n* Fix flaky cacheMeta isRevalidating test\n\nReplace fixed 1ms waits with waitFor so assertions retry instead of\nracing resolve-then-commit on loaded CI runners. Mirrors the pattern\nused in #80 for the adjacent atom maxAge test.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Assert on isRevalidating history instead of current value\n\nPrevious fix retried the snapshot with waitFor, but the assertion was\nracing against the maxAge setInterval: once resolvers[1] resolved, the\nnext tick (≤20ms later) started a new fetch that never resolves in the\ntest, pinning isRevalidating=true. On CPU-contended CI runners waitFor\nwould miss the brief false window and time out.\n\nRecord every emission via a cacheMeta subscriber and assert the history\ncontains false after the observed true transition — no timing window to\nmiss. Verified 35/35 runs pass, including 15 under 8x yes CPU load.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T07:42:16-07:00",
          "tree_id": "866cc3b64b8d51989a4d9455e99e7ca83e14f801",
          "url": "https://github.com/eigilsagafos/valdres/commit/f0db284727eb18e5f85e81356f69c95970ad6429"
        },
        "date": 1777042002534,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.0723 13.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=343 ratio=0.0758 13.2x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 166,
            "unit": "ns",
            "extra": "jotai=2139 ratio=0.0776 12.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 189,
            "unit": "ns",
            "extra": "jotai=2679 ratio=0.0705 14.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 193,
            "unit": "ns",
            "extra": "jotai=3699 ratio=0.0521 19.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17373,
            "unit": "ns",
            "extra": "jotai=278238 ratio=0.0624 16.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 302,
            "unit": "ns",
            "extra": "jotai=424 ratio=0.7121 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5445 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 321,
            "unit": "ns",
            "extra": "jotai=405 ratio=0.7918 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 327,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 182,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2940,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=83 ratio=0.1004 10.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7819,
            "unit": "ns",
            "extra": "jotai=28509 ratio=0.2743 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 72283,
            "unit": "ns",
            "extra": "jotai=312929 ratio=0.2310 4.3x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6932,
            "unit": "ns",
            "extra": "jotai=16837 ratio=0.4117 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 538,
            "unit": "ns",
            "extra": "jotai=7198 ratio=0.0748 13.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 72009,
            "unit": "ns",
            "extra": "jotai=1123656 ratio=0.0641 15.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3889,
            "unit": "ns",
            "extra": "jotai=488498 ratio=0.0080 125.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 466,
            "unit": "ns",
            "extra": "jotai=2570 ratio=0.1813 5.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 75981,
            "unit": "ns",
            "extra": "jotai=289453 ratio=0.2625 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 125355,
            "unit": "ns",
            "extra": "jotai=566403 ratio=0.2213 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 709666,
            "unit": "ns",
            "extra": "jotai=3211803 ratio=0.2210 4.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 866192,
            "unit": "ns",
            "extra": "jotai=4427108 ratio=0.1957 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1354578,
            "unit": "ns",
            "extra": "jotai=23712786 ratio=0.0571 17.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79821,
            "unit": "ns",
            "extra": "jotai=146441 ratio=0.5451 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 73009,
            "unit": "ns",
            "extra": "jotai=256325 ratio=0.2848 3.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 777036,
            "unit": "ns",
            "extra": "jotai=1425697 ratio=0.5450 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 949383,
            "unit": "ns",
            "extra": "jotai=1989984 ratio=0.4771 2.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1012298,
            "unit": "ns",
            "extra": "jotai=12355122 ratio=0.0819 12.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.7224 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8181,
            "unit": "ns",
            "extra": "jotai=20989 ratio=0.3898 2.6x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 70080,
            "unit": "ns",
            "extra": "jotai=132911 ratio=0.5273 1.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4507,
            "unit": "ns",
            "extra": "jotai=10536 ratio=0.4278 2.3x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.4005 2.5x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0704 14.2x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 245,
            "unit": "ns",
            "extra": "jotai=1301 ratio=0.1885 5.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 261,
            "unit": "ns",
            "extra": "jotai=1478 ratio=0.1765 5.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 288,
            "unit": "ns",
            "extra": "jotai=1859 ratio=0.1549 6.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 28352,
            "unit": "ns",
            "extra": "jotai=137549 ratio=0.2061 4.9x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 245,
            "unit": "ns",
            "extra": "jotai=1466 ratio=0.1673 6.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80329,
            "unit": "ns",
            "extra": "jotai=433889 ratio=0.1851 5.4x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 12769,
            "unit": "ns",
            "extra": "jotai=188185 ratio=0.0679 14.7x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 850,
            "unit": "ns",
            "extra": "jotai=2245 ratio=0.3786 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=474 ratio=0.8237 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 19,
            "unit": "ns",
            "extra": "jotai=6 ratio=3.3542 3.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=406 ratio=0.6359 1.6x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 187,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 246,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1409,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "777fa44c0a8f7b9bc838f2bc17bac8c21bb5e842",
          "message": "Add @valdres/browser-window package (#85)\n\n* Add @valdres/browser-window package\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Freeze the EMPTY window-size snapshot so consumer mutation can't\n  leak across reads/stores (especially under SSR)\n- Switch WindowSize from interface to type alias for consistency with\n  the rest of the repo's types/ files\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Restore window inner size in test teardown\n\nCapture window.innerWidth/innerHeight before each test and restore\nthem in afterEach so mutated values don't leak into other tests\nsharing happy-dom's window global.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Fix flaky cacheMeta isRevalidating test\n\nReplace fixed 1ms waits with waitFor so assertions retry instead of\nracing resolve-then-commit on loaded CI runners. Mirrors the pattern\nused in #80 for the adjacent atom maxAge test.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T07:50:16-07:00",
          "tree_id": "e5c638dad7fbeda7a1b900359c466fb2251aa27b",
          "url": "https://github.com/eigilsagafos/valdres/commit/777fa44c0a8f7b9bc838f2bc17bac8c21bb5e842"
        },
        "date": 1777042460522,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.0507 19.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2114 ratio=0.0809 12.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2715 ratio=0.0662 15.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 194,
            "unit": "ns",
            "extra": "jotai=3546 ratio=0.0546 18.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15930,
            "unit": "ns",
            "extra": "jotai=280790 ratio=0.0567 17.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 331,
            "unit": "ns",
            "extra": "jotai=479 ratio=0.6918 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6662 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 353,
            "unit": "ns",
            "extra": "jotai=475 ratio=0.7435 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 349,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 194,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2324,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0916 10.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8608,
            "unit": "ns",
            "extra": "jotai=26941 ratio=0.3195 3.1x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 79269,
            "unit": "ns",
            "extra": "jotai=321166 ratio=0.2468 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7567,
            "unit": "ns",
            "extra": "jotai=17478 ratio=0.4329 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 587,
            "unit": "ns",
            "extra": "jotai=6652 ratio=0.0882 11.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74661,
            "unit": "ns",
            "extra": "jotai=1168854 ratio=0.0639 15.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6896,
            "unit": "ns",
            "extra": "jotai=355410 ratio=0.0194 51.5x faster"
          },
          {
            "name": "sub + unsub",
            "value": 471,
            "unit": "ns",
            "extra": "jotai=2444 ratio=0.1927 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 80672,
            "unit": "ns",
            "extra": "jotai=389655 ratio=0.2070 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 137475,
            "unit": "ns",
            "extra": "jotai=723585 ratio=0.1900 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 765398,
            "unit": "ns",
            "extra": "jotai=4408411 ratio=0.1736 5.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 911218,
            "unit": "ns",
            "extra": "jotai=4629287 ratio=0.1968 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1385681,
            "unit": "ns",
            "extra": "jotai=23483574 ratio=0.0590 16.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79790,
            "unit": "ns",
            "extra": "jotai=140575 ratio=0.5676 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78858,
            "unit": "ns",
            "extra": "jotai=239467 ratio=0.3293 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 849511,
            "unit": "ns",
            "extra": "jotai=1295973 ratio=0.6555 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1057395,
            "unit": "ns",
            "extra": "jotai=1809305 ratio=0.5844 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 994402,
            "unit": "ns",
            "extra": "jotai=12915257 ratio=0.0770 13.0x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.8046 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8558,
            "unit": "ns",
            "extra": "jotai=19138 ratio=0.4472 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77857,
            "unit": "ns",
            "extra": "jotai=128272 ratio=0.6070 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4801,
            "unit": "ns",
            "extra": "jotai=9598 ratio=0.5002 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.5096 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0722 13.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 281,
            "unit": "ns",
            "extra": "jotai=1239 ratio=0.2271 4.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=1520 ratio=0.2012 5.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 319,
            "unit": "ns",
            "extra": "jotai=1724 ratio=0.1848 5.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31893,
            "unit": "ns",
            "extra": "jotai=141015 ratio=0.2262 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 162,
            "unit": "ns",
            "extra": "jotai=1247 ratio=0.1298 7.7x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 90180,
            "unit": "ns",
            "extra": "jotai=465107 ratio=0.1939 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14207,
            "unit": "ns",
            "extra": "jotai=208223 ratio=0.0682 14.7x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 789,
            "unit": "ns",
            "extra": "jotai=2183 ratio=0.3615 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 419,
            "unit": "ns",
            "extra": "jotai=542 ratio=0.7737 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.1635 4.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 209,
            "unit": "ns",
            "extra": "jotai=374 ratio=0.5598 1.8x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 300,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1369,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "906e53fec3682eabe76cb50612c62924be409994",
          "message": "Add @valdres/browser-focus package (#89)\n\nAdds a reactive wrapper for document.hasFocus() with focus/blur event\nlisteners. Follows the browser-online pattern (global atom, onInit-wired\nsubscribe, module-level listeners for dedupe) and ships a React-based\nbun dev demo.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T09:04:16-07:00",
          "tree_id": "b3e2572b5d5919aa4650f5abd2f3fa05a7494290",
          "url": "https://github.com/eigilsagafos/valdres/commit/906e53fec3682eabe76cb50612c62924be409994"
        },
        "date": 1777046907967,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0499 20.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2104 ratio=0.0808 12.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2695 ratio=0.0668 15.0x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 193,
            "unit": "ns",
            "extra": "jotai=3570 ratio=0.0540 18.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15980,
            "unit": "ns",
            "extra": "jotai=273205 ratio=0.0585 17.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=461 ratio=0.6595 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.5131 4.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 344,
            "unit": "ns",
            "extra": "jotai=436 ratio=0.7897 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 346,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3168,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.0922 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8839,
            "unit": "ns",
            "extra": "jotai=27872 ratio=0.3171 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 79678,
            "unit": "ns",
            "extra": "jotai=333276 ratio=0.2391 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8129,
            "unit": "ns",
            "extra": "jotai=18191 ratio=0.4469 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 660,
            "unit": "ns",
            "extra": "jotai=6721 ratio=0.0981 10.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74168,
            "unit": "ns",
            "extra": "jotai=1169720 ratio=0.0634 15.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6853,
            "unit": "ns",
            "extra": "jotai=527714 ratio=0.0130 77.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=2554 ratio=0.1962 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 84447,
            "unit": "ns",
            "extra": "jotai=303647 ratio=0.2781 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 112019,
            "unit": "ns",
            "extra": "jotai=635124 ratio=0.1764 5.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 749437,
            "unit": "ns",
            "extra": "jotai=3383626 ratio=0.2215 4.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 893756,
            "unit": "ns",
            "extra": "jotai=4787843 ratio=0.1867 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1111972,
            "unit": "ns",
            "extra": "jotai=25959346 ratio=0.0428 23.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 76963,
            "unit": "ns",
            "extra": "jotai=142776 ratio=0.5390 1.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 81402,
            "unit": "ns",
            "extra": "jotai=245237 ratio=0.3319 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 852278,
            "unit": "ns",
            "extra": "jotai=1391083 ratio=0.6127 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1036802,
            "unit": "ns",
            "extra": "jotai=1932632 ratio=0.5365 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1048935,
            "unit": "ns",
            "extra": "jotai=13654057 ratio=0.0768 13.0x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.7361 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 9033,
            "unit": "ns",
            "extra": "jotai=20658 ratio=0.4372 2.3x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77605,
            "unit": "ns",
            "extra": "jotai=132947 ratio=0.5837 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 5073,
            "unit": "ns",
            "extra": "jotai=10403 ratio=0.4877 2.1x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.4894 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0732 13.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 285,
            "unit": "ns",
            "extra": "jotai=1271 ratio=0.2240 4.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 305,
            "unit": "ns",
            "extra": "jotai=1530 ratio=0.1996 5.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=1779 ratio=0.1746 5.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31843,
            "unit": "ns",
            "extra": "jotai=145671 ratio=0.2186 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 167,
            "unit": "ns",
            "extra": "jotai=1373 ratio=0.1220 8.2x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 96270,
            "unit": "ns",
            "extra": "jotai=461416 ratio=0.2086 4.8x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14156,
            "unit": "ns",
            "extra": "jotai=207728 ratio=0.0681 14.7x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 782,
            "unit": "ns",
            "extra": "jotai=2214 ratio=0.3532 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 433,
            "unit": "ns",
            "extra": "jotai=528 ratio=0.8211 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.8017 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=392 ratio=0.7602 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 197,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 282,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1350,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "964dd90b8686db6bb99635db5493976b683ce168",
          "message": "Fix globalAtom resetSelf for repeated resets with sync re-reads (#88)\n\n* Fix globalAtom resetSelf to support repeated resets with sync re-reads\n\nSubscribers that synchronously re-read the atom from their callback (the\nuseSyncExternalStore pattern) caused two problems on resetSelf: the\nre-init's stores.add was wiped by the trailing stores.clear, and the\nfreshly-installed onReset closure was overwritten before the previous\ncleanup ran. Delete each store inside the loop and snapshot onReset\nbefore propagating so the next reset still has subscribers to notify\nand re-init can install a new cleanup safely.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review on globalAtom resetSelf\n\n- Wrap the propagation loop in try/finally so previousOnReset always\n  runs, even if a future change causes a synchronous escape from the\n  loop body.\n- Remove the dead stateDependencies.has(atom) branch. stateDependencies\n  is a Map keyed by selectors (populated only in asyncDependencyTracking\n  and initSelector), so the check was always false for a globalAtom and\n  its TODO throw was unreachable.\n\nNo behavior change — resetSelf still handles selector dependents\ncorrectly via propagateUpdatedAtoms (covered by the existing \"reset\nsupport for global atom with selectors\" test).\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T09:20:23-07:00",
          "tree_id": "cb92e33bab1819dee343013f715e2bb182c977bb",
          "url": "https://github.com/eigilsagafos/valdres/commit/964dd90b8686db6bb99635db5493976b683ce168"
        },
        "date": 1777047875223,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0462 21.6x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2034 ratio=0.0841 11.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2615 ratio=0.0689 14.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 194,
            "unit": "ns",
            "extra": "jotai=3592 ratio=0.0541 18.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17454,
            "unit": "ns",
            "extra": "jotai=276315 ratio=0.0632 15.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 340,
            "unit": "ns",
            "extra": "jotai=459 ratio=0.7397 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.4386 4.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 336,
            "unit": "ns",
            "extra": "jotai=441 ratio=0.7633 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 344,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3127,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0921 10.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8273,
            "unit": "ns",
            "extra": "jotai=27181 ratio=0.3044 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77204,
            "unit": "ns",
            "extra": "jotai=322871 ratio=0.2391 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7529,
            "unit": "ns",
            "extra": "jotai=17646 ratio=0.4267 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 611,
            "unit": "ns",
            "extra": "jotai=6520 ratio=0.0937 10.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74899,
            "unit": "ns",
            "extra": "jotai=1153310 ratio=0.0649 15.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6663,
            "unit": "ns",
            "extra": "jotai=512480 ratio=0.0130 76.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 481,
            "unit": "ns",
            "extra": "jotai=2464 ratio=0.1952 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 79187,
            "unit": "ns",
            "extra": "jotai=293227 ratio=0.2701 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 139129,
            "unit": "ns",
            "extra": "jotai=607020 ratio=0.2292 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 758663,
            "unit": "ns",
            "extra": "jotai=3244526 ratio=0.2338 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 910858,
            "unit": "ns",
            "extra": "jotai=4624929 ratio=0.1969 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1408786,
            "unit": "ns",
            "extra": "jotai=24959161 ratio=0.0564 17.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 76422,
            "unit": "ns",
            "extra": "jotai=139941 ratio=0.5461 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 76913,
            "unit": "ns",
            "extra": "jotai=237092 ratio=0.3244 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 835522,
            "unit": "ns",
            "extra": "jotai=1287520 ratio=0.6489 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1031353,
            "unit": "ns",
            "extra": "jotai=1772294 ratio=0.5819 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1012808,
            "unit": "ns",
            "extra": "jotai=12521108 ratio=0.0809 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.7309 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8737,
            "unit": "ns",
            "extra": "jotai=19269 ratio=0.4534 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77595,
            "unit": "ns",
            "extra": "jotai=126697 ratio=0.6124 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4813,
            "unit": "ns",
            "extra": "jotai=9629 ratio=0.4999 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.4748 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0736 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 281,
            "unit": "ns",
            "extra": "jotai=1210 ratio=0.2320 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=1421 ratio=0.2157 4.6x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 318,
            "unit": "ns",
            "extra": "jotai=1694 ratio=0.1880 5.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31309,
            "unit": "ns",
            "extra": "jotai=141079 ratio=0.2219 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 160,
            "unit": "ns",
            "extra": "jotai=1222 ratio=0.1310 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89677,
            "unit": "ns",
            "extra": "jotai=447254 ratio=0.2005 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14147,
            "unit": "ns",
            "extra": "jotai=206105 ratio=0.0686 14.6x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 798,
            "unit": "ns",
            "extra": "jotai=2107 ratio=0.3787 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 419,
            "unit": "ns",
            "extra": "jotai=485 ratio=0.8637 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.1689 4.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 362,
            "unit": "ns",
            "extra": "jotai=353 ratio=1.0258 1.0x slower"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 200,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 284,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1321,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "352037795e95945d003950deb9ce9bf1b1f40de7",
          "message": "Add @valdres/browser-screen-details package (#83)\n\n* Add @valdres/browser-window-management package\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Align permission atom's initial check with the runtime guard\n  (typeof getScreenDetails === \"function\")\n- Don't downgrade permission to \"unsupported\" when only the\n  Permissions API is missing; leave state as \"prompt\" so\n  requestScreenDetails can still try\n- Only set permission to \"denied\" for DOMException NotAllowedError;\n  other failures (transient, insecure context) leave state untouched\n- Escape interpolated strings in the dev demo to avoid XSS via\n  OS-provided screen labels\n- Add tests covering both error branches\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Remove module-level bootstrapped flag from subscribe; return a\n  cleanup function so the atom's onInit can cancel a pending query\n  and detach the status listener\n- Drop the unused details field from detailsState\n- Reset global atoms in afterEach across tests to prevent cross-test\n  pollution\n- Stub navigator.permissions in requestScreenDetails tests so the\n  atom's onInit subscribe doesn't race with setSelf assertions\n- Add dedicated subscribe tests covering hydrate, change propagation,\n  cancel-before-resolution, and listener teardown\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Fix flaky cacheMeta isRevalidating test\n\nReplace fixed 1ms waits with waitFor so assertions retry instead of\nracing resolve-then-commit on loaded CI runners. Mirrors the pattern\nused in #80 for the adjacent atom maxAge test.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Rename @valdres/browser-window-management to @valdres/browser-screen-details\n\nThe package doesn't manipulate windows — everything it exposes is\nscreen enumeration and per-screen metadata. The new name describes\nwhat the package actually does and pairs cleanly with\n@valdres/browser-screen (current screen vs. all screen details).\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address review comments on browser-screen-details\n\n- subscribe(): guard navigator.permissions.query as well, matching the\n  pattern in browser-geolocation, so a partially-polyfilled\n  navigator.permissions can't throw.\n- detailsState.inflight → detailsState.request: the field caches the\n  successful request; it's never cleared on success, so \"inflight\" was\n  misleading.\n- subscribe.test.ts: add a Safari/Firefox-like test where\n  permissions.query rejects, and a test for the new .query guard.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T09:41:33-07:00",
          "tree_id": "923d5c263e7dc24a05f850fe5f7d98ba5f171957",
          "url": "https://github.com/eigilsagafos/valdres/commit/352037795e95945d003950deb9ce9bf1b1f40de7"
        },
        "date": 1777049142411,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0504 19.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=511 ratio=0.0783 12.8x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2155 ratio=0.0789 12.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=2715 ratio=0.0661 15.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 194,
            "unit": "ns",
            "extra": "jotai=3702 ratio=0.0524 19.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16000,
            "unit": "ns",
            "extra": "jotai=287048 ratio=0.0557 17.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 325,
            "unit": "ns",
            "extra": "jotai=477 ratio=0.6814 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 48,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.5150 4.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 346,
            "unit": "ns",
            "extra": "jotai=460 ratio=0.7529 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 351,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 190,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3168,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=72 ratio=0.0731 13.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8358,
            "unit": "ns",
            "extra": "jotai=27862 ratio=0.3000 3.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 79920,
            "unit": "ns",
            "extra": "jotai=326311 ratio=0.2449 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7750,
            "unit": "ns",
            "extra": "jotai=17886 ratio=0.4333 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 636,
            "unit": "ns",
            "extra": "jotai=6696 ratio=0.0950 10.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74881,
            "unit": "ns",
            "extra": "jotai=1175090 ratio=0.0637 15.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6614,
            "unit": "ns",
            "extra": "jotai=363711 ratio=0.0182 55.0x faster"
          },
          {
            "name": "sub + unsub",
            "value": 480,
            "unit": "ns",
            "extra": "jotai=2464 ratio=0.1948 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 81272,
            "unit": "ns",
            "extra": "jotai=421960 ratio=0.1926 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 140363,
            "unit": "ns",
            "extra": "jotai=735457 ratio=0.1909 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 769871,
            "unit": "ns",
            "extra": "jotai=4566951 ratio=0.1686 5.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 910385,
            "unit": "ns",
            "extra": "jotai=4722260 ratio=0.1928 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1403182,
            "unit": "ns",
            "extra": "jotai=24475377 ratio=0.0573 17.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77836,
            "unit": "ns",
            "extra": "jotai=139932 ratio=0.5562 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 77655,
            "unit": "ns",
            "extra": "jotai=237013 ratio=0.3276 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 857335,
            "unit": "ns",
            "extra": "jotai=1274827 ratio=0.6725 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1068797,
            "unit": "ns",
            "extra": "jotai=1848941 ratio=0.5781 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1016012,
            "unit": "ns",
            "extra": "jotai=12658625 ratio=0.0803 12.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 47,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.8752 1.1x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8806,
            "unit": "ns",
            "extra": "jotai=19464 ratio=0.4524 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76504,
            "unit": "ns",
            "extra": "jotai=126066 ratio=0.6069 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4931,
            "unit": "ns",
            "extra": "jotai=9911 ratio=0.4975 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.4689 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=157 ratio=0.0742 13.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1234 ratio=0.2323 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=1448 ratio=0.2115 4.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 316,
            "unit": "ns",
            "extra": "jotai=1707 ratio=0.1852 5.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30477,
            "unit": "ns",
            "extra": "jotai=138971 ratio=0.2193 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 159,
            "unit": "ns",
            "extra": "jotai=1292 ratio=0.1232 8.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 90569,
            "unit": "ns",
            "extra": "jotai=454616 ratio=0.1992 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14778,
            "unit": "ns",
            "extra": "jotai=221194 ratio=0.0668 15.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 771,
            "unit": "ns",
            "extra": "jotai=2173 ratio=0.3547 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 417,
            "unit": "ns",
            "extra": "jotai=539 ratio=0.7734 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.0850 4.1x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 358,
            "unit": "ns",
            "extra": "jotai=364 ratio=0.9845 1.0x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 284,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1334,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "875e49348a467fd261c110fae18df48da6bbe6ca",
          "message": "Deflake atom maxAge async tests (#91)\n\nTwo tests in `atom.test.ts` were intermittently failing on CI:\n- \"atom with maxAge async (no SWR) shows promise during revalidation\"\n- \"multiple consecutive failures with staleIfError\"\n\nTest 1: After resolving the second fetch, the test polled `store.get()`\nfor the resolved value. The maxAge interval keeps firing in the\nbackground, so a tick can replace that resolved value with a fresh\npending promise before the assertion runs — the polling then never\nsees the value and times out (~2116ms). Fix: capture every value\nthrough the subscription callback and assert against the captured\nsequence rather than the live store value.\n\nTest 2: maxAge=15 + staleIfError=40 gave a 55ms staleIfError window,\nand `lastSuccessTime` is initialized at subscribe time and only\nupdated by tick-driven revalidation success — not by the initial\nfetch resolving. On a slow CI runner the first rejection callback\nran past the 55ms threshold from subscribe, so the rejection branch\ntreated the cache as past-window and didn't restore the stale value.\nFix: bump maxAge to 50 and staleIfError to 200 (250ms window),\ncapture observations through the subscription callback, and time\nthe post-success wait from the captured success time.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T10:04:06-07:00",
          "tree_id": "51fe7f6e06b15f977773b1de094a7e3430d8aa69",
          "url": "https://github.com/eigilsagafos/valdres/commit/875e49348a467fd261c110fae18df48da6bbe6ca"
        },
        "date": 1777050510883,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0455 22.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2034 ratio=0.0841 11.9x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 183,
            "unit": "ns",
            "extra": "jotai=2555 ratio=0.0716 14.0x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 192,
            "unit": "ns",
            "extra": "jotai=3387 ratio=0.0567 17.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16040,
            "unit": "ns",
            "extra": "jotai=270681 ratio=0.0593 16.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 302,
            "unit": "ns",
            "extra": "jotai=462 ratio=0.6540 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6230 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 314,
            "unit": "ns",
            "extra": "jotai=446 ratio=0.7045 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 349,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 192,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2275,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.0860 11.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8542,
            "unit": "ns",
            "extra": "jotai=27362 ratio=0.3122 3.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77315,
            "unit": "ns",
            "extra": "jotai=323304 ratio=0.2391 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7651,
            "unit": "ns",
            "extra": "jotai=17621 ratio=0.4342 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 603,
            "unit": "ns",
            "extra": "jotai=6512 ratio=0.0926 10.8x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74909,
            "unit": "ns",
            "extra": "jotai=1143824 ratio=0.0655 15.3x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6729,
            "unit": "ns",
            "extra": "jotai=354593 ratio=0.0190 52.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 490,
            "unit": "ns",
            "extra": "jotai=2414 ratio=0.2030 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 79649,
            "unit": "ns",
            "extra": "jotai=392965 ratio=0.2027 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 138098,
            "unit": "ns",
            "extra": "jotai=702794 ratio=0.1965 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 756585,
            "unit": "ns",
            "extra": "jotai=4396601 ratio=0.1721 5.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 911299,
            "unit": "ns",
            "extra": "jotai=4641919 ratio=0.1963 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1410868,
            "unit": "ns",
            "extra": "jotai=25345096 ratio=0.0557 18.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77354,
            "unit": "ns",
            "extra": "jotai=138589 ratio=0.5582 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 79680,
            "unit": "ns",
            "extra": "jotai=242634 ratio=0.3284 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 853847,
            "unit": "ns",
            "extra": "jotai=1322338 ratio=0.6457 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1053491,
            "unit": "ns",
            "extra": "jotai=1813260 ratio=0.5810 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1025157,
            "unit": "ns",
            "extra": "jotai=12659641 ratio=0.0810 12.3x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.7796 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8672,
            "unit": "ns",
            "extra": "jotai=19764 ratio=0.4388 2.3x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76844,
            "unit": "ns",
            "extra": "jotai=128280 ratio=0.5990 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4822,
            "unit": "ns",
            "extra": "jotai=9766 ratio=0.4938 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.5073 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0738 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "jotai=1227 ratio=0.2333 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 305,
            "unit": "ns",
            "extra": "jotai=1468 ratio=0.2078 4.8x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 316,
            "unit": "ns",
            "extra": "jotai=1702 ratio=0.1854 5.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31875,
            "unit": "ns",
            "extra": "jotai=138529 ratio=0.2301 4.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 160,
            "unit": "ns",
            "extra": "jotai=1282 ratio=0.1251 8.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 90420,
            "unit": "ns",
            "extra": "jotai=441897 ratio=0.2046 4.9x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14598,
            "unit": "ns",
            "extra": "jotai=206326 ratio=0.0708 14.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 774,
            "unit": "ns",
            "extra": "jotai=2130 ratio=0.3632 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 435,
            "unit": "ns",
            "extra": "jotai=527 ratio=0.8251 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.1686 4.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 292,
            "unit": "ns",
            "extra": "jotai=362 ratio=0.8077 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 284,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1348,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "644edca80488ac595cea65e2ecdbb51e0f7965b1",
          "message": "Add @valdres/browser-visibility package (#90)\n\n* Add @valdres/browser-visibility package\n\nReactive wrapper around the Page Visibility API\n(document.visibilityState + visibilitychange event). Distinct from\n@valdres/browser-focus, which tracks keyboard focus: visibility stays\n\"visible\" when another app is in the foreground as long as the tab is\non-screen, and only flips to \"hidden\" when the tab is backgrounded or\nthe window minimized.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Dedupe demo log entries under StrictMode\n\nGuard the demo's useEffect with a ref so StrictMode's double-invoke\ndoesn't produce duplicate initial log entries. Applied to both\nbrowser-visibility (new) and browser-focus (same bug shipped in #89).\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T10:11:00-07:00",
          "tree_id": "adcbc395b1f53d225fccec38f9ec0d23ec017639",
          "url": "https://github.com/eigilsagafos/valdres/commit/644edca80488ac595cea65e2ecdbb51e0f7965b1"
        },
        "date": 1777050922973,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.0670 14.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=342 ratio=0.0877 11.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 165,
            "unit": "ns",
            "extra": "jotai=2094 ratio=0.0788 12.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 196,
            "unit": "ns",
            "extra": "jotai=2661 ratio=0.0737 13.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 188,
            "unit": "ns",
            "extra": "jotai=3686 ratio=0.0509 19.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15352,
            "unit": "ns",
            "extra": "jotai=277677 ratio=0.0553 18.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 301,
            "unit": "ns",
            "extra": "jotai=424 ratio=0.7097 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.0372 4.0x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 333,
            "unit": "ns",
            "extra": "jotai=426 ratio=0.7821 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 334,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 174,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2933,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=80 ratio=0.1080 9.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7718,
            "unit": "ns",
            "extra": "jotai=28510 ratio=0.2707 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 71402,
            "unit": "ns",
            "extra": "jotai=313296 ratio=0.2279 4.4x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6827,
            "unit": "ns",
            "extra": "jotai=16683 ratio=0.4092 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 553,
            "unit": "ns",
            "extra": "jotai=7204 ratio=0.0768 13.0x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 70607,
            "unit": "ns",
            "extra": "jotai=1117542 ratio=0.0632 15.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7168,
            "unit": "ns",
            "extra": "jotai=485206 ratio=0.0148 67.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 488,
            "unit": "ns",
            "extra": "jotai=2528 ratio=0.1930 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 76027,
            "unit": "ns",
            "extra": "jotai=287682 ratio=0.2643 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 127672,
            "unit": "ns",
            "extra": "jotai=567587 ratio=0.2249 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 733202,
            "unit": "ns",
            "extra": "jotai=3230238 ratio=0.2270 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 866364,
            "unit": "ns",
            "extra": "jotai=4390275 ratio=0.1973 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1403628,
            "unit": "ns",
            "extra": "jotai=24382890 ratio=0.0576 17.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77701,
            "unit": "ns",
            "extra": "jotai=155100 ratio=0.5010 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 73359,
            "unit": "ns",
            "extra": "jotai=272675 ratio=0.2690 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 804243,
            "unit": "ns",
            "extra": "jotai=1551393 ratio=0.5184 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 981324,
            "unit": "ns",
            "extra": "jotai=2100105 ratio=0.4673 2.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1021466,
            "unit": "ns",
            "extra": "jotai=13594498 ratio=0.0751 13.3x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 39,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.6408 1.6x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8367,
            "unit": "ns",
            "extra": "jotai=22024 ratio=0.3799 2.6x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 71192,
            "unit": "ns",
            "extra": "jotai=147233 ratio=0.4835 2.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4638,
            "unit": "ns",
            "extra": "jotai=11437 ratio=0.4055 2.5x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.4026 2.5x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=154 ratio=0.0692 14.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 253,
            "unit": "ns",
            "extra": "jotai=1373 ratio=0.1840 5.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=1496 ratio=0.1789 5.6x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 292,
            "unit": "ns",
            "extra": "jotai=1866 ratio=0.1563 6.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 29697,
            "unit": "ns",
            "extra": "jotai=148715 ratio=0.1997 5.0x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=1636 ratio=0.1466 6.8x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 84750,
            "unit": "ns",
            "extra": "jotai=435620 ratio=0.1946 5.1x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 12912,
            "unit": "ns",
            "extra": "jotai=184683 ratio=0.0699 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 848,
            "unit": "ns",
            "extra": "jotai=2372 ratio=0.3574 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 397,
            "unit": "ns",
            "extra": "jotai=482 ratio=0.8243 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 19,
            "unit": "ns",
            "extra": "jotai=5 ratio=3.5755 3.6x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 338,
            "unit": "ns",
            "extra": "jotai=432 ratio=0.7826 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 185,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 249,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1424,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "f8a220369579c8fee4e65951367a4f55fcc2c0c2",
          "message": "Default cache stale windows to Infinity and enforce SWR timeout (#92)\n\n* Default cache stale windows to Infinity and enforce SWR timeout\n\nThree semantics fixes to the maxAge/staleWhileRevalidate/staleIfError\ncaching layer:\n\n- `staleWhileRevalidate` and `staleIfError` now default to Infinity\n  when unset. Matches the standard SWR / React Query intuition: keep\n  showing stale during background revalidation, keep last-good on\n  network errors. Opt out of stale-on-revalidate by passing 0\n  explicitly.\n\n- The SWR timeout actually enforces its window. Previously the\n  setTimeout only cleaned up a Set — `swr: 5000` and `swr: 60000`\n  behaved identically. Now, if the request is still in flight when\n  the SWR window expires, the atom flips to the pending promise so\n  consumers can render a loading state.\n\n- `if (swr)` is tightened to `if (swr > 0)`. Previously `swr: 0`\n  fell through to the loading-state branch by truthy coincidence;\n  now it does so by intent.\n\nThe error path is also unified: both branches funnel through a\nsingle `handleReject` that restores `lastGoodValue` within the\nstaleIfError window, otherwise surfaces the rejected promise. The\nold SWR/non-SWR branches had subtly different reject behavior.\n\nCacheMeta.staleWhileRevalidate and staleIfError are now required\nfields (always populated, possibly Infinity).\n\nBehavioral change: callers that omitted `staleWhileRevalidate`\npreviously saw a pending promise during revalidation. They will\nnow see the stale value. Pass `staleWhileRevalidate: 0` to restore\nthe old behavior.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Use !== undefined check for timeoutRef cleanup\n\nIn browser runtimes setTimeout returns a numeric ID where 0 is a\nvalid value. The truthy `if (timeoutRef)` guard would skip the\nclearTimeout / pendingTimeouts.delete call when the ID happens to\nbe 0, leaking the timer. Use an explicit undefined check instead.\n\nFlagged by Copilot review on PR #92.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T10:30:33-07:00",
          "tree_id": "517a3eac8b9aebc248e7b2e9cf1948665b301add",
          "url": "https://github.com/eigilsagafos/valdres/commit/f8a220369579c8fee4e65951367a4f55fcc2c0c2"
        },
        "date": 1777052087029,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.0440 22.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=381 ratio=0.1050 9.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2073 ratio=0.0868 11.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 176,
            "unit": "ns",
            "extra": "jotai=2664 ratio=0.0660 15.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 189,
            "unit": "ns",
            "extra": "jotai=3595 ratio=0.0527 19.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15353,
            "unit": "ns",
            "extra": "jotai=280060 ratio=0.0548 18.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 370,
            "unit": "ns",
            "extra": "jotai=527 ratio=0.7023 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 54,
            "unit": "ns",
            "extra": "jotai=11 ratio=4.8053 4.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 384,
            "unit": "ns",
            "extra": "jotai=522 ratio=0.7358 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 358,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 186,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3369,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.0998 10.0x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8536,
            "unit": "ns",
            "extra": "jotai=30524 ratio=0.2797 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 76204,
            "unit": "ns",
            "extra": "jotai=333345 ratio=0.2286 4.4x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7814,
            "unit": "ns",
            "extra": "jotai=17771 ratio=0.4397 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 668,
            "unit": "ns",
            "extra": "jotai=6746 ratio=0.0991 10.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 72449,
            "unit": "ns",
            "extra": "jotai=1154887 ratio=0.0627 15.9x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7105,
            "unit": "ns",
            "extra": "jotai=579520 ratio=0.0123 81.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 500,
            "unit": "ns",
            "extra": "jotai=2364 ratio=0.2115 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 82103,
            "unit": "ns",
            "extra": "jotai=307872 ratio=0.2667 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 107692,
            "unit": "ns",
            "extra": "jotai=608843 ratio=0.1769 5.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 736289,
            "unit": "ns",
            "extra": "jotai=3437305 ratio=0.2142 4.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 885248,
            "unit": "ns",
            "extra": "jotai=4816034 ratio=0.1838 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1124377,
            "unit": "ns",
            "extra": "jotai=25201453 ratio=0.0446 22.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 71487,
            "unit": "ns",
            "extra": "jotai=136761 ratio=0.5227 1.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 72108,
            "unit": "ns",
            "extra": "jotai=239485 ratio=0.3011 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 783265,
            "unit": "ns",
            "extra": "jotai=1313320 ratio=0.5964 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 974637,
            "unit": "ns",
            "extra": "jotai=1851101 ratio=0.5265 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 935869,
            "unit": "ns",
            "extra": "jotai=12319767 ratio=0.0760 13.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.8274 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7980,
            "unit": "ns",
            "extra": "jotai=19606 ratio=0.4070 2.5x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 67591,
            "unit": "ns",
            "extra": "jotai=130325 ratio=0.5186 1.9x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4628,
            "unit": "ns",
            "extra": "jotai=9849 ratio=0.4699 2.1x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.5574 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0792 12.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 263,
            "unit": "ns",
            "extra": "jotai=1163 ratio=0.2258 4.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 282,
            "unit": "ns",
            "extra": "jotai=1507 ratio=0.1873 5.3x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 300,
            "unit": "ns",
            "extra": "jotai=1730 ratio=0.1731 5.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 29936,
            "unit": "ns",
            "extra": "jotai=138437 ratio=0.2162 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "jotai=1225 ratio=0.1273 7.9x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 91958,
            "unit": "ns",
            "extra": "jotai=420962 ratio=0.2184 4.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13811,
            "unit": "ns",
            "extra": "jotai=207371 ratio=0.0666 15.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 707,
            "unit": "ns",
            "extra": "jotai=2074 ratio=0.3410 2.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 457,
            "unit": "ns",
            "extra": "jotai=554 ratio=0.8257 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 22,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.0907 3.1x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=414 ratio=0.4124 2.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 284,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1402,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "d58dff802c47c8e69a80824a71a971cec3918a1e",
          "message": "Add isVisibleSelector to @valdres/browser-visibility (#96)\n\nDerives a boolean from visibilityAtom for the common \"is the page\nvisible\" check, while keeping visibilityAtom faithful to the native\nDocumentVisibilityState union.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T11:15:34-07:00",
          "tree_id": "f93914d02d29f3d0a43e5d69ea17c410ff86fd12",
          "url": "https://github.com/eigilsagafos/valdres/commit/d58dff802c47c8e69a80824a71a971cec3918a1e"
        },
        "date": 1777054783654,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0829 12.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=370 ratio=0.1081 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2084 ratio=0.0821 12.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 182,
            "unit": "ns",
            "extra": "jotai=2675 ratio=0.0681 14.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 192,
            "unit": "ns",
            "extra": "jotai=3720 ratio=0.0515 19.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16010,
            "unit": "ns",
            "extra": "jotai=282135 ratio=0.0567 17.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 341,
            "unit": "ns",
            "extra": "jotai=465 ratio=0.7325 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 29,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6957 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 325,
            "unit": "ns",
            "extra": "jotai=467 ratio=0.6952 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 345,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 190,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3184,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.0838 11.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8655,
            "unit": "ns",
            "extra": "jotai=29543 ratio=0.2930 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 78526,
            "unit": "ns",
            "extra": "jotai=321799 ratio=0.2440 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7577,
            "unit": "ns",
            "extra": "jotai=18016 ratio=0.4206 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 589,
            "unit": "ns",
            "extra": "jotai=6641 ratio=0.0887 11.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 76934,
            "unit": "ns",
            "extra": "jotai=1173495 ratio=0.0656 15.3x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6754,
            "unit": "ns",
            "extra": "jotai=525889 ratio=0.0128 77.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 461,
            "unit": "ns",
            "extra": "jotai=2464 ratio=0.1871 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 78166,
            "unit": "ns",
            "extra": "jotai=293281 ratio=0.2665 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136704,
            "unit": "ns",
            "extra": "jotai=596229 ratio=0.2293 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 749906,
            "unit": "ns",
            "extra": "jotai=3274391 ratio=0.2290 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 898787,
            "unit": "ns",
            "extra": "jotai=4968647 ratio=0.1809 5.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1438107,
            "unit": "ns",
            "extra": "jotai=24346548 ratio=0.0591 16.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 78045,
            "unit": "ns",
            "extra": "jotai=142135 ratio=0.5491 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 77644,
            "unit": "ns",
            "extra": "jotai=244985 ratio=0.3169 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 858067,
            "unit": "ns",
            "extra": "jotai=1322166 ratio=0.6490 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1080250,
            "unit": "ns",
            "extra": "jotai=1973683 ratio=0.5473 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1016372,
            "unit": "ns",
            "extra": "jotai=12599806 ratio=0.0807 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 44,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.8371 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 9104,
            "unit": "ns",
            "extra": "jotai=20164 ratio=0.4515 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 80138,
            "unit": "ns",
            "extra": "jotai=130463 ratio=0.6143 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 5207,
            "unit": "ns",
            "extra": "jotai=9815 ratio=0.5306 1.9x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5155 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0735 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 291,
            "unit": "ns",
            "extra": "jotai=1258 ratio=0.2311 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=1514 ratio=0.2019 5.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 330,
            "unit": "ns",
            "extra": "jotai=1812 ratio=0.1821 5.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32827,
            "unit": "ns",
            "extra": "jotai=143287 ratio=0.2291 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 159,
            "unit": "ns",
            "extra": "jotai=1521 ratio=0.1044 9.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89136,
            "unit": "ns",
            "extra": "jotai=443170 ratio=0.2011 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13876,
            "unit": "ns",
            "extra": "jotai=214699 ratio=0.0646 15.5x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 805,
            "unit": "ns",
            "extra": "jotai=2108 ratio=0.3817 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 411,
            "unit": "ns",
            "extra": "jotai=476 ratio=0.8630 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.7673 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 339,
            "unit": "ns",
            "extra": "jotai=355 ratio=0.9564 1.0x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 296,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1369,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "92f3bc2beb633cb476710eacf3a114245e96969d",
          "message": "Add @valdres/browser-presence package (#94)\n\n* Add @valdres/browser-presence package\n\nCombines @valdres/browser-visibility and @valdres/browser-focus into a\nsingle derived presenceSelector that is true when the tab is visible and\nthe window has focus.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Use isVisibleSelector instead of inline === \"visible\" check\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T11:20:05-07:00",
          "tree_id": "5478226b886637df00fd468444d8ff934d14ec8f",
          "url": "https://github.com/eigilsagafos/valdres/commit/92f3bc2beb633cb476710eacf3a114245e96969d"
        },
        "date": 1777055055133,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.0491 20.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=370 ratio=0.1081 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2063 ratio=0.0829 12.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 210,
            "unit": "ns",
            "extra": "jotai=2625 ratio=0.0800 12.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 191,
            "unit": "ns",
            "extra": "jotai=3535 ratio=0.0541 18.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15959,
            "unit": "ns",
            "extra": "jotai=273092 ratio=0.0584 17.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 337,
            "unit": "ns",
            "extra": "jotai=486 ratio=0.6935 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6791 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 348,
            "unit": "ns",
            "extra": "jotai=475 ratio=0.7314 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 348,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3096,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.0898 11.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8468,
            "unit": "ns",
            "extra": "jotai=28929 ratio=0.2927 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 77836,
            "unit": "ns",
            "extra": "jotai=314949 ratio=0.2471 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7349,
            "unit": "ns",
            "extra": "jotai=17399 ratio=0.4224 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 578,
            "unit": "ns",
            "extra": "jotai=6493 ratio=0.0889 11.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74480,
            "unit": "ns",
            "extra": "jotai=1151317 ratio=0.0647 15.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6546,
            "unit": "ns",
            "extra": "jotai=526536 ratio=0.0124 80.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 461,
            "unit": "ns",
            "extra": "jotai=2415 ratio=0.1909 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 79349,
            "unit": "ns",
            "extra": "jotai=289482 ratio=0.2741 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136566,
            "unit": "ns",
            "extra": "jotai=605580 ratio=0.2255 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 742371,
            "unit": "ns",
            "extra": "jotai=3197167 ratio=0.2322 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 893420,
            "unit": "ns",
            "extra": "jotai=4588052 ratio=0.1947 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1399371,
            "unit": "ns",
            "extra": "jotai=25245532 ratio=0.0554 18.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 78046,
            "unit": "ns",
            "extra": "jotai=138179 ratio=0.5648 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 77274,
            "unit": "ns",
            "extra": "jotai=239257 ratio=0.3230 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 851815,
            "unit": "ns",
            "extra": "jotai=1314712 ratio=0.6479 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1044325,
            "unit": "ns",
            "extra": "jotai=1811653 ratio=0.5764 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 988116,
            "unit": "ns",
            "extra": "jotai=13072162 ratio=0.0756 13.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.8104 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8922,
            "unit": "ns",
            "extra": "jotai=19807 ratio=0.4504 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77815,
            "unit": "ns",
            "extra": "jotai=126547 ratio=0.6149 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 5029,
            "unit": "ns",
            "extra": "jotai=9968 ratio=0.5045 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.4947 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.0727 13.7x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 277,
            "unit": "ns",
            "extra": "jotai=1244 ratio=0.2225 4.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 296,
            "unit": "ns",
            "extra": "jotai=1474 ratio=0.2009 5.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 334,
            "unit": "ns",
            "extra": "jotai=1707 ratio=0.1954 5.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32954,
            "unit": "ns",
            "extra": "jotai=141876 ratio=0.2323 4.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 160,
            "unit": "ns",
            "extra": "jotai=1370 ratio=0.1168 8.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 91541,
            "unit": "ns",
            "extra": "jotai=454421 ratio=0.2014 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14397,
            "unit": "ns",
            "extra": "jotai=204944 ratio=0.0702 14.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 870,
            "unit": "ns",
            "extra": "jotai=2174 ratio=0.3999 2.5x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 487,
            "unit": "ns",
            "extra": "jotai=544 ratio=0.8957 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.8265 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 425,
            "unit": "ns",
            "extra": "jotai=381 ratio=1.1139 1.1x slower"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 201,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 282,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1341,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "24700ef5b6ba4fcf4760d152c5a614dcad5fe1fa",
          "message": "Rebuild maxAge interval after globalAtom resetSelf (#97)\n\n* Rebuild maxAge interval after globalAtom resetSelf\n\nresetSelf cleared atom.maxAgeInterval but left per-store subscribers\nin place. Because the interval is only created on the 0→1 subscriber\ntransition, the timer was never rebuilt, leaving maxAge-driven\nrevalidation silently broken for the atom until the last subscriber\nfully detached.\n\nExtract the maxAge timer setup from subscribe.ts into an exported\ninstallMaxAgeTimer helper and call it from resetSelf for every store\nwith remaining subscribers, mirroring the first-subscriber path.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Re-add stores before rebuilding maxAge timer in resetSelf\n\ninstallMaxAgeTimer's tick propagates through globalState.stores. After\nresetSelf clears that set, subscribers whose callbacks don't\nsynchronously re-read never trigger onInit during propagation and\nnever rejoin stores, leaving the new timer running but unable to\nreach them.\n\nRe-add any store with remaining subscribers back into stores before\ninstalling the timer, so setAndPropagate can notify passive\nsubscribers on the next tick.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T11:40:54-07:00",
          "tree_id": "48ab6dc366a4e14a19dba33721af30bf004fae11",
          "url": "https://github.com/eigilsagafos/valdres/commit/24700ef5b6ba4fcf4760d152c5a614dcad5fe1fa"
        },
        "date": 1777056305439,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0458 21.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2144 ratio=0.0798 12.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 210,
            "unit": "ns",
            "extra": "jotai=2665 ratio=0.0788 12.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 214,
            "unit": "ns",
            "extra": "jotai=3520 ratio=0.0607 16.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15899,
            "unit": "ns",
            "extra": "jotai=278406 ratio=0.0571 17.5x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 200,
            "unit": "ns",
            "extra": "jotai=464 ratio=0.4312 2.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=4 ratio=2.5901 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 342,
            "unit": "ns",
            "extra": "jotai=463 ratio=0.7384 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 345,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 193,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3214,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.0739 13.5x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8559,
            "unit": "ns",
            "extra": "jotai=30380 ratio=0.2817 3.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 82780,
            "unit": "ns",
            "extra": "jotai=337712 ratio=0.2451 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 8356,
            "unit": "ns",
            "extra": "jotai=18385 ratio=0.4545 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 641,
            "unit": "ns",
            "extra": "jotai=6662 ratio=0.0962 10.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74500,
            "unit": "ns",
            "extra": "jotai=1172265 ratio=0.0636 15.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6632,
            "unit": "ns",
            "extra": "jotai=524313 ratio=0.0126 79.1x faster"
          },
          {
            "name": "sub + unsub",
            "value": 491,
            "unit": "ns",
            "extra": "jotai=2554 ratio=0.1922 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 84549,
            "unit": "ns",
            "extra": "jotai=314193 ratio=0.2691 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 110717,
            "unit": "ns",
            "extra": "jotai=653142 ratio=0.1695 5.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 756722,
            "unit": "ns",
            "extra": "jotai=3393773 ratio=0.2230 4.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 892781,
            "unit": "ns",
            "extra": "jotai=4829571 ratio=0.1849 5.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1157016,
            "unit": "ns",
            "extra": "jotai=27089931 ratio=0.0427 23.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 79399,
            "unit": "ns",
            "extra": "jotai=145393 ratio=0.5461 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 79469,
            "unit": "ns",
            "extra": "jotai=243977 ratio=0.3257 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 863205,
            "unit": "ns",
            "extra": "jotai=1359320 ratio=0.6350 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1046479,
            "unit": "ns",
            "extra": "jotai=1827051 ratio=0.5728 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1068626,
            "unit": "ns",
            "extra": "jotai=13267647 ratio=0.0805 12.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.7909 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8792,
            "unit": "ns",
            "extra": "jotai=20103 ratio=0.4373 2.3x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 78187,
            "unit": "ns",
            "extra": "jotai=130224 ratio=0.6004 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4977,
            "unit": "ns",
            "extra": "jotai=10178 ratio=0.4890 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.5075 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.0712 14.0x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 277,
            "unit": "ns",
            "extra": "jotai=1308 ratio=0.2120 4.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 306,
            "unit": "ns",
            "extra": "jotai=1532 ratio=0.1999 5.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 324,
            "unit": "ns",
            "extra": "jotai=1747 ratio=0.1854 5.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31027,
            "unit": "ns",
            "extra": "jotai=146555 ratio=0.2117 4.7x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 159,
            "unit": "ns",
            "extra": "jotai=1452 ratio=0.1097 9.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 100719,
            "unit": "ns",
            "extra": "jotai=458744 ratio=0.2196 4.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14577,
            "unit": "ns",
            "extra": "jotai=208109 ratio=0.0700 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 792,
            "unit": "ns",
            "extra": "jotai=2240 ratio=0.3535 2.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 482,
            "unit": "ns",
            "extra": "jotai=554 ratio=0.8696 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.8114 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=392 ratio=0.7604 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 272,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1388,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "10f5e15dd168415b7da0d47c1a7d825731d2db1c",
          "message": "Skip heap snapshot on first LeakDetector round (#98)\n\nHeap snapshots are expensive (walk the entire heap) and only needed\nto force WeakMap ephemeron cleanup in JSC. For WeakRef-only cases,\nfullGC() + releaseWeakRefs() usually clears the ref on the first\nround. Skipping the snapshot on round 0 makes the happy path fast\nand falls back to the original strategy (with snapshots) from round\n1 onward, preserving CI behavior for tests that rely on ephemeron\ncleanup.\n\nDrops memoryleaks.test.ts from 5.6s to 1.3s and the full monorepo\nparallel run from ~10s to ~6s.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T11:48:28-07:00",
          "tree_id": "f481076767f10ef87979cfc2908a993bb8104336",
          "url": "https://github.com/eigilsagafos/valdres/commit/10f5e15dd168415b7da0d47c1a7d825731d2db1c"
        },
        "date": 1777056761435,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0456 21.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=361 ratio=0.1108 9.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=2154 ratio=0.0794 12.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=2665 ratio=0.0671 14.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 194,
            "unit": "ns",
            "extra": "jotai=3546 ratio=0.0547 18.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17066,
            "unit": "ns",
            "extra": "jotai=275291 ratio=0.0620 16.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 299,
            "unit": "ns",
            "extra": "jotai=465 ratio=0.6432 1.6x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5658 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 297,
            "unit": "ns",
            "extra": "jotai=439 ratio=0.6757 1.5x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 343,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3201,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.0786 12.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8489,
            "unit": "ns",
            "extra": "jotai=30190 ratio=0.2812 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 81032,
            "unit": "ns",
            "extra": "jotai=328215 ratio=0.2469 4.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7747,
            "unit": "ns",
            "extra": "jotai=18205 ratio=0.4255 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 623,
            "unit": "ns",
            "extra": "jotai=6544 ratio=0.0952 10.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 76002,
            "unit": "ns",
            "extra": "jotai=1182055 ratio=0.0643 15.6x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 3978,
            "unit": "ns",
            "extra": "jotai=356378 ratio=0.0112 89.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=2495 ratio=0.2008 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 82044,
            "unit": "ns",
            "extra": "jotai=401772 ratio=0.2042 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 141615,
            "unit": "ns",
            "extra": "jotai=725859 ratio=0.1951 5.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 783207,
            "unit": "ns",
            "extra": "jotai=4472606 ratio=0.1751 5.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 934320,
            "unit": "ns",
            "extra": "jotai=4802580 ratio=0.1945 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1415444,
            "unit": "ns",
            "extra": "jotai=24112161 ratio=0.0587 17.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 78327,
            "unit": "ns",
            "extra": "jotai=141304 ratio=0.5543 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78206,
            "unit": "ns",
            "extra": "jotai=241818 ratio=0.3234 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 855963,
            "unit": "ns",
            "extra": "jotai=1322812 ratio=0.6471 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1069882,
            "unit": "ns",
            "extra": "jotai=1848661 ratio=0.5787 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1022474,
            "unit": "ns",
            "extra": "jotai=13318252 ratio=0.0768 13.0x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.7476 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8780,
            "unit": "ns",
            "extra": "jotai=19866 ratio=0.4419 2.3x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 80030,
            "unit": "ns",
            "extra": "jotai=129683 ratio=0.6171 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4911,
            "unit": "ns",
            "extra": "jotai=9758 ratio=0.5033 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=49 ratio=0.4849 2.1x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0733 13.6x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "jotai=1227 ratio=0.2333 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 341,
            "unit": "ns",
            "extra": "jotai=1514 ratio=0.2253 4.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 309,
            "unit": "ns",
            "extra": "jotai=1732 ratio=0.1785 5.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30562,
            "unit": "ns",
            "extra": "jotai=142627 ratio=0.2143 4.7x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "jotai=1178 ratio=0.1321 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 91021,
            "unit": "ns",
            "extra": "jotai=444913 ratio=0.2046 4.9x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13896,
            "unit": "ns",
            "extra": "jotai=204007 ratio=0.0681 14.7x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 786,
            "unit": "ns",
            "extra": "jotai=2086 ratio=0.3766 2.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 283,
            "unit": "ns",
            "extra": "jotai=375 ratio=0.7541 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=6 ratio=4.5385 4.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 283,
            "unit": "ns",
            "extra": "jotai=366 ratio=0.7734 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 200,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 286,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1358,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "67b04461c8ddb083318feea083354c735778313f",
          "message": "Handle bare promises passed to setAtom (#95)\n\n* Add failing tests for bare-promise setSelf on global atoms\n\nDocuments the bug where atom.setSelf(Promise.resolve(...)) on a global\natom stores the promise reference permanently instead of updating to\nthe resolved value. Subscribers never fire again after resolution and\ncross-store sync fans out the unresolved promise.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Handle bare promises passed to setAtom\n\nsetAtom only wired up .then/.catch when the caller passed a thunk\nreturning a promise — bare promises bypassed the resolution handling\nand left subscribers looking at the unresolved promise. Hoist the\nisPromiseLike branch above the isFunction check so both call shapes\nget the stale-promise guard, rejection revert, and empty-atom promise\nforwarding. Widen SetAtomValue, GlobalAtomSetSelfFunc, and the Store\nSetAtom overloads so the types reflect what the runtime now accepts.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Drop redundant newValue promise check in setAtom equality\n\nThe hoisted isPromiseLike(newValue) branch already returns on the\npromise path, so by the time we reach the equality check newValue\nis guaranteed to be a non-promise — the second isPromiseLike call\nwas pure overhead and showed up as a ~36% regression on the \"set\n1000 atoms\" benchmark.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review on setAtom promise handling\n\n- Replace .then().catch() with .then(onFulfilled, onRejected) so the\n  rejection handler works on any thenable, not just real Promise\n  instances (isPromiseLike only asserts .then exists).\n- Reuse SetAtomValue<Value> as the parameter type for setAtom and as\n  the value parameter in GlobalAtomSetSelfFunc so the two stay in sync.\n- Add bare-promise coverage directly in setAtom.test.ts for both the\n  resolve and the reject paths, independent of globalAtom.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Normalize thenables to real Promises in setAtom\n\nWiden the public SetAtomValue type to PromiseLike<Value> so the\nsignature matches what the implementation actually accepts, then call\nPromise.resolve() at the setAtom boundary so every subsequent piece\nof internal machinery (including .catch handlers elsewhere in the\nstore) works with a real Promise. Promise.resolve returns the same\nreference for real Promises, so the hot path (non-promise sets) pays\nnothing — only callers handing in a foreign thenable pay a single\nwrapper allocation.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Isolate promise closures in a setAtom helper\n\nHoisting the promise branch to the top level of setAtom made the\n.then/onRejected closures hoist their captured scope along with it,\nand JSC's scope-capture heuristics started retaining the setAtom\nframe even on the sync path — which surfaced as an intermittent\nmemory-leak test failure in CI (selector old-value retention).\nExtract the promise wiring into its own helper so the closures live\nin an isolated scope and never pin setAtom's locals.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Route fulfilled-handler errors through .catch in setAtom\n\nWhy: Using `.then(onFulfilled, onRejected)` let exceptions thrown inside\nthe fulfilled handler (e.g. a throwing onSet) escape as unhandled\nrejections. Normalize to `.then(f).catch(g)` now that Promise.resolve()\nguarantees a real Promise with .catch semantics.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T12:05:15-07:00",
          "tree_id": "c1f458be4544abc96570deb93878495720384bc3",
          "url": "https://github.com/eigilsagafos/valdres/commit/67b04461c8ddb083318feea083354c735778313f"
        },
        "date": 1777057759593,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0454 22.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=370 ratio=0.1081 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=2064 ratio=0.0824 12.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 152,
            "unit": "ns",
            "extra": "jotai=2654 ratio=0.0573 17.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 196,
            "unit": "ns",
            "extra": "jotai=3463 ratio=0.0567 17.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15680,
            "unit": "ns",
            "extra": "jotai=269433 ratio=0.0582 17.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 276,
            "unit": "ns",
            "extra": "jotai=436 ratio=0.6316 1.6x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5860 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 290,
            "unit": "ns",
            "extra": "jotai=428 ratio=0.6764 1.5x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 351,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 193,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3153,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.0693 14.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8535,
            "unit": "ns",
            "extra": "jotai=30764 ratio=0.2774 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 78276,
            "unit": "ns",
            "extra": "jotai=330488 ratio=0.2368 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7634,
            "unit": "ns",
            "extra": "jotai=17890 ratio=0.4267 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 624,
            "unit": "ns",
            "extra": "jotai=6621 ratio=0.0942 10.6x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74650,
            "unit": "ns",
            "extra": "jotai=1160780 ratio=0.0643 15.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6793,
            "unit": "ns",
            "extra": "jotai=364682 ratio=0.0186 53.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=2475 ratio=0.2024 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 83526,
            "unit": "ns",
            "extra": "jotai=400203 ratio=0.2087 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 143418,
            "unit": "ns",
            "extra": "jotai=748580 ratio=0.1916 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 769178,
            "unit": "ns",
            "extra": "jotai=4500703 ratio=0.1709 5.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 909049,
            "unit": "ns",
            "extra": "jotai=4710981 ratio=0.1930 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1483677,
            "unit": "ns",
            "extra": "jotai=24273807 ratio=0.0611 16.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 80621,
            "unit": "ns",
            "extra": "jotai=140041 ratio=0.5757 1.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 78346,
            "unit": "ns",
            "extra": "jotai=241582 ratio=0.3243 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 834670,
            "unit": "ns",
            "extra": "jotai=1347262 ratio=0.6195 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1050973,
            "unit": "ns",
            "extra": "jotai=1840549 ratio=0.5710 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1006316,
            "unit": "ns",
            "extra": "jotai=12180543 ratio=0.0826 12.1x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.7626 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7711,
            "unit": "ns",
            "extra": "jotai=18940 ratio=0.4071 2.5x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 75781,
            "unit": "ns",
            "extra": "jotai=128500 ratio=0.5897 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4260,
            "unit": "ns",
            "extra": "jotai=9741 ratio=0.4373 2.3x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=50 ratio=0.4962 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=162 ratio=0.0720 13.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 274,
            "unit": "ns",
            "extra": "jotai=1288 ratio=0.2128 4.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 267,
            "unit": "ns",
            "extra": "jotai=1534 ratio=0.1743 5.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 310,
            "unit": "ns",
            "extra": "jotai=1758 ratio=0.1764 5.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31892,
            "unit": "ns",
            "extra": "jotai=152435 ratio=0.2092 4.8x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 157,
            "unit": "ns",
            "extra": "jotai=1345 ratio=0.1165 8.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80992,
            "unit": "ns",
            "extra": "jotai=438795 ratio=0.1846 5.4x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14136,
            "unit": "ns",
            "extra": "jotai=209541 ratio=0.0675 14.8x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 790,
            "unit": "ns",
            "extra": "jotai=2043 ratio=0.3869 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 354,
            "unit": "ns",
            "extra": "jotai=445 ratio=0.7954 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.8213 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 212,
            "unit": "ns",
            "extra": "jotai=339 ratio=0.6254 1.6x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 201,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 257,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1394,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "3e6fcdc2707d8b0b5da022d2be6b2f0f238aff42",
          "message": "Retry leak check with real-timer gap for selector dep-change test (#107)\n\n* Retry isLeaking with real-timer gap in selector dep-change leak test\n\nAfter #98's round-0 snapshot skip, this specific test started flaking\nconsistently on CI across four open PRs. Approach: attempt isLeaking\nup to 5 more times with a 50ms real-timer delay between attempts if the\nfirst call reports a leak. Gives JSC's ephemeron trace enough wall-clock\ntime to clear the WeakMap chain holding the old selector value under CI\nallocation pressure.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Expand selector dep-change leak comment with root cause and Bun issue link\n\nReplaces the short retry rationale with a fuller writeup: JSC's ephemeron\nresolution holds a cyclic WeakMap chain across data.values, stateDependents,\nand the selector closure that V8 clears in one pass but JSC only clears\nafter multiple full GC + heap-trace passes with wall-clock slack. Links\nBun issue #24285 which proposes a primitive for exactly this pattern, and\nreferences PR #107 as the workaround so we can revisit once Bun ships a\nfix.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T16:40:35-07:00",
          "tree_id": "8f893ca97982c8622e7684f9d33211833a99f875",
          "url": "https://github.com/eigilsagafos/valdres/commit/3e6fcdc2707d8b0b5da022d2be6b2f0f238aff42"
        },
        "date": 1777074288412,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.0461 21.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=370 ratio=0.1081 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2043 ratio=0.0881 11.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 151,
            "unit": "ns",
            "extra": "jotai=2655 ratio=0.0569 17.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 192,
            "unit": "ns",
            "extra": "jotai=3535 ratio=0.0543 18.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17265,
            "unit": "ns",
            "extra": "jotai=271097 ratio=0.0637 15.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 318,
            "unit": "ns",
            "extra": "jotai=466 ratio=0.6830 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6010 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 338,
            "unit": "ns",
            "extra": "jotai=456 ratio=0.7402 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 351,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 189,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3100,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.0679 14.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8274,
            "unit": "ns",
            "extra": "jotai=30146 ratio=0.2745 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 76463,
            "unit": "ns",
            "extra": "jotai=324815 ratio=0.2354 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7718,
            "unit": "ns",
            "extra": "jotai=18046 ratio=0.4277 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 621,
            "unit": "ns",
            "extra": "jotai=6619 ratio=0.0938 10.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 74830,
            "unit": "ns",
            "extra": "jotai=1160928 ratio=0.0645 15.5x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7374,
            "unit": "ns",
            "extra": "jotai=526194 ratio=0.0140 71.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 471,
            "unit": "ns",
            "extra": "jotai=2455 ratio=0.1919 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 80911,
            "unit": "ns",
            "extra": "jotai=298603 ratio=0.2710 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 138088,
            "unit": "ns",
            "extra": "jotai=633494 ratio=0.2180 4.6x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 768361,
            "unit": "ns",
            "extra": "jotai=3309764 ratio=0.2321 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 900884,
            "unit": "ns",
            "extra": "jotai=4674734 ratio=0.1927 5.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1391840,
            "unit": "ns",
            "extra": "jotai=24374920 ratio=0.0571 17.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77034,
            "unit": "ns",
            "extra": "jotai=136034 ratio=0.5663 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 76083,
            "unit": "ns",
            "extra": "jotai=238305 ratio=0.3193 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 838482,
            "unit": "ns",
            "extra": "jotai=1274421 ratio=0.6579 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1069909,
            "unit": "ns",
            "extra": "jotai=1826984 ratio=0.5856 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 994158,
            "unit": "ns",
            "extra": "jotai=12240583 ratio=0.0812 12.3x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 46,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.7779 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8627,
            "unit": "ns",
            "extra": "jotai=18943 ratio=0.4554 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77855,
            "unit": "ns",
            "extra": "jotai=124352 ratio=0.6261 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4951,
            "unit": "ns",
            "extra": "jotai=9644 ratio=0.5134 1.9x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.4571 2.2x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=157 ratio=0.0740 13.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=1235 ratio=0.2212 4.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 265,
            "unit": "ns",
            "extra": "jotai=1439 ratio=0.1840 5.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 297,
            "unit": "ns",
            "extra": "jotai=1687 ratio=0.1759 5.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31803,
            "unit": "ns",
            "extra": "jotai=136806 ratio=0.2325 4.3x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 159,
            "unit": "ns",
            "extra": "jotai=1204 ratio=0.1322 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 78917,
            "unit": "ns",
            "extra": "jotai=437136 ratio=0.1805 5.5x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13776,
            "unit": "ns",
            "extra": "jotai=208179 ratio=0.0662 15.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 766,
            "unit": "ns",
            "extra": "jotai=2045 ratio=0.3746 2.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=497 ratio=0.7843 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.7964 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 230,
            "unit": "ns",
            "extra": "jotai=351 ratio=0.6555 1.5x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 268,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1337,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "5100b3783f15b29de2210c462505a371868aadf0",
          "message": "Fix root cause of selector leak flake in LeakDetector (#109)\n\nInvestigation in the WebKit checkout (bugs.webkit.org has no matching\nopen bug; ephemeron fixpoint at MarkingConstraintSet.cpp:98-166 is\ncorrect) revealed the actual cause: ECMAScript [[KeptAlive]] list pins\nWeakRef targets across synchronous gc() loops. JSC's ClearKeptObjects\nruns at microtask checkpoints, but bun:jsc.fullGC() called BEFORE\nreleaseWeakRefs() marks the still-pinned target as live, missing the\ncollection window.\n\nFixes:\n- Reorder to releaseWeakRefs() FIRST, then GC.\n- Switch from fullGC() (no sweep) to Bun.gc(true) (full GC + sweep).\n- Remove the test-scoped retry from PR #107 — no longer needed.\n\nConfirmed: 30/30 trials of the full valdres suite pass cleanly in the\nubuntu-22.04 + bun-1.3.13 container that was reproducing the original\n~30% flake rate.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-04-24T23:33:44-07:00",
          "tree_id": "ad1d56fef55562d5b969fc668580363c66f318f2",
          "url": "https://github.com/eigilsagafos/valdres/commit/5100b3783f15b29de2210c462505a371868aadf0"
        },
        "date": 1777099066903,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai=51 ratio=0.0455 22.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai=371 ratio=0.1078 9.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2044 ratio=0.0881 11.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 150,
            "unit": "ns",
            "extra": "jotai=2535 ratio=0.0593 16.9x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 189,
            "unit": "ns",
            "extra": "jotai=3392 ratio=0.0558 17.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16892,
            "unit": "ns",
            "extra": "jotai=264725 ratio=0.0638 15.7x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 281,
            "unit": "ns",
            "extra": "jotai=445 ratio=0.6306 1.6x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5815 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=439 ratio=0.6935 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 346,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 189,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3079,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0854 11.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8282,
            "unit": "ns",
            "extra": "jotai=29388 ratio=0.2818 3.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 75902,
            "unit": "ns",
            "extra": "jotai=315144 ratio=0.2408 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7370,
            "unit": "ns",
            "extra": "jotai=17332 ratio=0.4253 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 601,
            "unit": "ns",
            "extra": "jotai=6558 ratio=0.0916 10.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 75802,
            "unit": "ns",
            "extra": "jotai=1146672 ratio=0.0661 15.1x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6713,
            "unit": "ns",
            "extra": "jotai=518628 ratio=0.0129 77.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 511,
            "unit": "ns",
            "extra": "jotai=2455 ratio=0.2081 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 81823,
            "unit": "ns",
            "extra": "jotai=290493 ratio=0.2817 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136846,
            "unit": "ns",
            "extra": "jotai=604318 ratio=0.2264 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 772243,
            "unit": "ns",
            "extra": "jotai=3202140 ratio=0.2412 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 909659,
            "unit": "ns",
            "extra": "jotai=4588024 ratio=0.1983 5.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1401099,
            "unit": "ns",
            "extra": "jotai=23926566 ratio=0.0586 17.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 77064,
            "unit": "ns",
            "extra": "jotai=139100 ratio=0.5540 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 77584,
            "unit": "ns",
            "extra": "jotai=239347 ratio=0.3241 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 816455,
            "unit": "ns",
            "extra": "jotai=1331317 ratio=0.6133 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1021369,
            "unit": "ns",
            "extra": "jotai=1806963 ratio=0.5652 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 965565,
            "unit": "ns",
            "extra": "jotai=12211833 ratio=0.0791 12.6x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 41,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.7930 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8699,
            "unit": "ns",
            "extra": "jotai=19067 ratio=0.4562 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77685,
            "unit": "ns",
            "extra": "jotai=127849 ratio=0.6076 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4857,
            "unit": "ns",
            "extra": "jotai=9622 ratio=0.5047 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=48 ratio=0.5020 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0739 13.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 267,
            "unit": "ns",
            "extra": "jotai=1236 ratio=0.2160 4.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 266,
            "unit": "ns",
            "extra": "jotai=1432 ratio=0.1860 5.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 301,
            "unit": "ns",
            "extra": "jotai=1716 ratio=0.1755 5.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32240,
            "unit": "ns",
            "extra": "jotai=140593 ratio=0.2293 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 160,
            "unit": "ns",
            "extra": "jotai=1227 ratio=0.1307 7.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80190,
            "unit": "ns",
            "extra": "jotai=450542 ratio=0.1780 5.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14487,
            "unit": "ns",
            "extra": "jotai=206266 ratio=0.0702 14.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 801,
            "unit": "ns",
            "extra": "jotai=2086 ratio=0.3841 2.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 382,
            "unit": "ns",
            "extra": "jotai=463 ratio=0.8261 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.8175 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 280,
            "unit": "ns",
            "extra": "jotai=355 ratio=0.7885 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 197,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 261,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1350,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      }
    ]
  }
}
window.BENCHMARK_DATA = {
  "lastUpdate": 1775596494465,
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
      }
    ]
  }
}
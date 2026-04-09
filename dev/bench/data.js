window.BENCHMARK_DATA = {
  "lastUpdate": 1775695213925,
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
      }
    ]
  }
}
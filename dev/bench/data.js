window.BENCHMARK_DATA = {
  "lastUpdate": 1779480474889,
  "repoUrl": "https://github.com/eigilsagafos/valdres",
  "entries": {
    "valdres benchmarks": [
      {
        "commit": {
          "author": {
            "name": "Eigil Sagafos",
            "username": "eigilsagafos",
            "email": "eigil@sagafos.no"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "e4dbc313d2f879e3eeea9df4b2f0a1e7ef5c510e",
          "message": "Stabilize benchmarks with paired per-batch measurement (#120)\n\nThe atomFamily cache-hit assertion was flaking on CI (5.1× vs 5.0× threshold\non PR #119, despite the PR not touching the hot path). Root cause: each\nside was measured back-to-back for 1.5s in a fixed order. A noisy CPU\nwindow during one side's run would shift its median 2× while the other\nran clean, blowing the ratio up even when neither implementation changed.\nIQR trimming only handles transient outliers; sustained pressure across\nthe whole window stays in the distribution.\n\nReplaces the back-to-back model with paired per-batch sampling:\nalternating ~30µs batches of valdres and competitor share the same ~60µs\nnoise window, so CPU stalls hit numerator and denominator together and\ncancel out of the ratio. Sample count is sized by a 50ms wall-clock\nbudget — fast benchmarks get 1000+ pairs, slow ones get the 50-sample\nfloor.\n\nSide effects:\n\n- CI bench job ~3× faster (20s vs ~66s of measurement budget on main).\n- Per-side numbers will shift on most benchmarks since pairing removes\n  noise that was biasing toward valdres on the old methodology\n  (store.get(atom) is the biggest mover; cache-hit basically unchanged).\n  Marketing numbers in README/BENCHMARKS.md will regenerate on first\n  main merge. Consider triggering the `reset_baseline` workflow input\n  to purge stale historical CV data — dynamic regression thresholds in\n  check-bench-regression.ts use that history.",
          "timestamp": "2026-05-21T20:52:10Z",
          "url": "https://github.com/eigilsagafos/valdres/commit/e4dbc313d2f879e3eeea9df4b2f0a1e7ef5c510e"
        },
        "date": 1779397144231,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.0821 12.2x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=340 ratio=0.0379 26.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=4292 ratio=0.0767 13.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 344,
            "unit": "ns",
            "extra": "jotai=6559 ratio=0.0567 17.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 206,
            "unit": "ns",
            "extra": "jotai=3441 ratio=0.0616 16.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17032,
            "unit": "ns",
            "extra": "jotai=262191 ratio=0.0649 15.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=405 ratio=0.7027 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.3854 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=423 ratio=0.7228 1.4x faster"
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
            "value": 9,
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
            "value": 188,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3037,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=67 ratio=0.0968 10.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6658,
            "unit": "ns",
            "extra": "jotai=24406 ratio=0.2731 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 59361,
            "unit": "ns",
            "extra": "jotai=247113 ratio=0.2392 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5967,
            "unit": "ns",
            "extra": "jotai=12999 ratio=0.4529 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 238,
            "unit": "ns",
            "extra": "jotai=5936 ratio=0.0401 24.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 106539,
            "unit": "ns",
            "extra": "jotai=929484 ratio=0.1151 8.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 9017,
            "unit": "ns",
            "extra": "jotai=385020 ratio=0.0215 46.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1184,
            "unit": "ns",
            "extra": "jotai=3680 ratio=0.3114 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 86391,
            "unit": "ns",
            "extra": "jotai=291044 ratio=0.2920 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 135844,
            "unit": "ns",
            "extra": "jotai=546903 ratio=0.2393 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 948093,
            "unit": "ns",
            "extra": "jotai=3388137 ratio=0.2825 3.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 882470,
            "unit": "ns",
            "extra": "jotai=3579976 ratio=0.2463 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1361226,
            "unit": "ns",
            "extra": "jotai=18830237 ratio=0.0722 13.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 143488,
            "unit": "ns",
            "extra": "jotai=288279 ratio=0.4918 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97783,
            "unit": "ns",
            "extra": "jotai=293569 ratio=0.3361 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 925897,
            "unit": "ns",
            "extra": "jotai=1395309 ratio=0.6499 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1133370,
            "unit": "ns",
            "extra": "jotai=1836906 ratio=0.6078 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1372502,
            "unit": "ns",
            "extra": "jotai=13216428 ratio=0.1059 9.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.7768 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8226,
            "unit": "ns",
            "extra": "jotai=14272 ratio=0.5755 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81598,
            "unit": "ns",
            "extra": "jotai=129703 ratio=0.6294 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4418,
            "unit": "ns",
            "extra": "jotai=7157 ratio=0.6137 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.5613 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 14,
            "unit": "ns",
            "extra": "jotai=156 ratio=0.0927 10.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 421,
            "unit": "ns",
            "extra": "jotai=1248 ratio=0.3360 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1468 ratio=0.2026 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 489,
            "unit": "ns",
            "extra": "jotai=1712 ratio=0.2823 3.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31454,
            "unit": "ns",
            "extra": "jotai=143664 ratio=0.2174 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 166,
            "unit": "ns",
            "extra": "jotai=561 ratio=0.2956 3.4x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80640,
            "unit": "ns",
            "extra": "jotai=488784 ratio=0.1651 6.1x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15789,
            "unit": "ns",
            "extra": "jotai=206135 ratio=0.0764 13.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 815,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.5786 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 184,
            "unit": "ns",
            "extra": "jotai=227 ratio=0.8036 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=10 ratio=2.7060 2.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 167,
            "unit": "ns",
            "extra": "jotai=208 ratio=0.8022 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
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
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1406,
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
          "id": "56672784b854fb15223426980c49fe7ee896fb2d",
          "message": "Fix benchmark README push from detached HEAD (#121)\n\nactions/checkout@v6 (upgraded in #110) checks out the workflow SHA in\ndetached HEAD state. Bare `git push` then fails with \"You are not\ncurrently on a branch\" — first observed on a manual workflow_dispatch\nrun. Push events on main happened to keep working, but the workflow\nis fragile either way.\n\nPush HEAD explicitly to main so the job works regardless of how it\nwas triggered.",
          "timestamp": "2026-05-21T14:03:43-07:00",
          "tree_id": "402d7cd7aefe27ca2989e197101d88e3b744e4a8",
          "url": "https://github.com/eigilsagafos/valdres/commit/56672784b854fb15223426980c49fe7ee896fb2d"
        },
        "date": 1779397485146,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=76 ratio=0.1362 7.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=341 ratio=0.0371 27.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 328,
            "unit": "ns",
            "extra": "jotai=4540 ratio=0.0716 14.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 371,
            "unit": "ns",
            "extra": "jotai=5339 ratio=0.0663 15.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=6046 ratio=0.0641 15.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16526,
            "unit": "ns",
            "extra": "jotai=271881 ratio=0.0609 16.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 323,
            "unit": "ns",
            "extra": "jotai=426 ratio=0.7345 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.2501 2.3x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 284,
            "unit": "ns",
            "extra": "jotai=383 ratio=0.7418 1.3x faster"
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
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 350,
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
            "value": 192,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3031,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.0922 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8757,
            "unit": "ns",
            "extra": "jotai=40296 ratio=0.2272 4.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 63631,
            "unit": "ns",
            "extra": "jotai=204597 ratio=0.3076 3.3x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7858,
            "unit": "ns",
            "extra": "jotai=15466 ratio=0.5075 2.0x faster"
          },
          {
            "name": "createStore",
            "value": 246,
            "unit": "ns",
            "extra": "jotai=5944 ratio=0.0408 24.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 109006,
            "unit": "ns",
            "extra": "jotai=967112 ratio=0.1136 8.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8987,
            "unit": "ns",
            "extra": "jotai=357137 ratio=0.0252 39.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1310,
            "unit": "ns",
            "extra": "jotai=3834 ratio=0.3141 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 73790,
            "unit": "ns",
            "extra": "jotai=280682 ratio=0.2537 3.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136458,
            "unit": "ns",
            "extra": "jotai=597912 ratio=0.2050 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 925240,
            "unit": "ns",
            "extra": "jotai=2748512 ratio=0.3291 3.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 843670,
            "unit": "ns",
            "extra": "jotai=3056855 ratio=0.2762 3.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1104959,
            "unit": "ns",
            "extra": "jotai=18459931 ratio=0.0600 16.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 138222,
            "unit": "ns",
            "extra": "jotai=289096 ratio=0.4778 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 94809,
            "unit": "ns",
            "extra": "jotai=268403 ratio=0.3534 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 892658,
            "unit": "ns",
            "extra": "jotai=1362407 ratio=0.6520 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1092015,
            "unit": "ns",
            "extra": "jotai=1748947 ratio=0.6214 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1103316,
            "unit": "ns",
            "extra": "jotai=11966024 ratio=0.1018 9.8x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7337 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8176,
            "unit": "ns",
            "extra": "jotai=13987 ratio=0.5844 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81835,
            "unit": "ns",
            "extra": "jotai=132090 ratio=0.6229 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4346,
            "unit": "ns",
            "extra": "jotai=6996 ratio=0.6189 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.5158 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1457 6.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 427,
            "unit": "ns",
            "extra": "jotai=1253 ratio=0.3371 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1497 ratio=0.1911 5.2x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=1746 ratio=0.2850 3.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32281,
            "unit": "ns",
            "extra": "jotai=145580 ratio=0.2210 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=539 ratio=0.3032 3.3x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89269,
            "unit": "ns",
            "extra": "jotai=466943 ratio=0.1908 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15775,
            "unit": "ns",
            "extra": "jotai=205374 ratio=0.0744 13.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 797,
            "unit": "ns",
            "extra": "jotai=1427 ratio=0.5577 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=240 ratio=0.7293 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 60,
            "unit": "ns",
            "extra": "jotai=31 ratio=1.8971 1.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 117,
            "unit": "ns",
            "extra": "jotai=169 ratio=0.6956 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
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
          "id": "ea9e32542c90c8c45d7b6862d063c8f5a39f5ba6",
          "message": "Stop publish workflow from committing the npm token to a branch (#124)\n\nWhen the changesets/action enters Version Packages PR mode after our\n1.0.0-beta.1 wave, it does `git add . && git commit && git push` to open\nthe release PR. Because the workflow created `.npmrc` at the repo root\nright before that step, the `git add .` swept the token into the commit\nand GitHub's push protection (correctly) blocked the push — see\nhttps://github.com/eigilsagafos/valdres/actions/runs/26255304854.\n\nTwo-layer fix:\n1. Move the workflow's `.npmrc` to `$HOME/.npmrc` so the token never\n   lives in the working tree. npm/`bunx changeset publish` still pick\n   it up from the user config.\n2. Gitignore `.npmrc` so the same shape can't recur if someone reverts\n   layer 1 or runs `npm login` locally.\n\nNo token leaked — push protection caught it at the wire and the\nchangeset-release/main branch was never created on the remote.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-21T14:57:26-07:00",
          "tree_id": "6a6f17cace6701aa8953400a00834125d2346e96",
          "url": "https://github.com/eigilsagafos/valdres/commit/ea9e32542c90c8c45d7b6862d063c8f5a39f5ba6"
        },
        "date": 1779400704464,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.1055 9.5x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=353 ratio=0.0365 27.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2734 ratio=0.0725 13.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 329,
            "unit": "ns",
            "extra": "jotai=5284 ratio=0.0623 16.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 430,
            "unit": "ns",
            "extra": "jotai=6008 ratio=0.0683 14.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16019,
            "unit": "ns",
            "extra": "jotai=274231 ratio=0.0585 17.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 351,
            "unit": "ns",
            "extra": "jotai=471 ratio=0.7298 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 35,
            "unit": "ns",
            "extra": "jotai=13 ratio=2.6004 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 295,
            "unit": "ns",
            "extra": "jotai=345 ratio=0.7852 1.3x faster"
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
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 364,
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
            "value": 186,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.1271 7.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8100,
            "unit": "ns",
            "extra": "jotai=28152 ratio=0.2908 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 58852,
            "unit": "ns",
            "extra": "jotai=248658 ratio=0.2396 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5569,
            "unit": "ns",
            "extra": "jotai=12969 ratio=0.4276 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 269,
            "unit": "ns",
            "extra": "jotai=6108 ratio=0.0436 22.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 81145,
            "unit": "ns",
            "extra": "jotai=900770 ratio=0.0896 11.2x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8262,
            "unit": "ns",
            "extra": "jotai=362626 ratio=0.0228 43.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1389,
            "unit": "ns",
            "extra": "jotai=3991 ratio=0.3154 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 63529,
            "unit": "ns",
            "extra": "jotai=270820 ratio=0.2353 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 143783,
            "unit": "ns",
            "extra": "jotai=544033 ratio=0.2377 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 911376,
            "unit": "ns",
            "extra": "jotai=3834153 ratio=0.2456 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 823066,
            "unit": "ns",
            "extra": "jotai=3776567 ratio=0.2264 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1692140,
            "unit": "ns",
            "extra": "jotai=20377164 ratio=0.0829 12.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 133938,
            "unit": "ns",
            "extra": "jotai=311009 ratio=0.4300 2.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 88597,
            "unit": "ns",
            "extra": "jotai=281811 ratio=0.3214 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 845048,
            "unit": "ns",
            "extra": "jotai=1429982 ratio=0.5884 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1052425,
            "unit": "ns",
            "extra": "jotai=1887127 ratio=0.5516 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1325307,
            "unit": "ns",
            "extra": "jotai=12899669 ratio=0.1084 9.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 46,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.7874 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7301,
            "unit": "ns",
            "extra": "jotai=14301 ratio=0.5097 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76624,
            "unit": "ns",
            "extra": "jotai=131114 ratio=0.5838 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4176,
            "unit": "ns",
            "extra": "jotai=7323 ratio=0.5679 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.5776 1.7x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 16,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.1012 9.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 379,
            "unit": "ns",
            "extra": "jotai=1221 ratio=0.3070 3.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 272,
            "unit": "ns",
            "extra": "jotai=1455 ratio=0.1825 5.5x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 447,
            "unit": "ns",
            "extra": "jotai=1730 ratio=0.2557 3.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30480,
            "unit": "ns",
            "extra": "jotai=138114 ratio=0.2188 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 178,
            "unit": "ns",
            "extra": "jotai=578 ratio=0.3066 3.3x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 81416,
            "unit": "ns",
            "extra": "jotai=448031 ratio=0.1826 5.5x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14431,
            "unit": "ns",
            "extra": "jotai=205940 ratio=0.0701 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 728,
            "unit": "ns",
            "extra": "jotai=1393 ratio=0.5199 1.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 154,
            "unit": "ns",
            "extra": "jotai=217 ratio=0.7246 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=8 ratio=3.3484 3.3x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=194 ratio=0.8324 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 10,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 18,
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
            "value": 252,
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
          "id": "123316db3145e895cda44e2c56dd49742ca01731",
          "message": "Relax atomFamily cache-hit benchmark threshold (#126)\n\nThe 5.0x threshold was tight enough to flake on GitHub runners: jotai's\ncache hit lands at ~16ns, right at the timer-resolution floor, so the\npair-ratio band routinely spans 4–9x even though quiet hardware reports\n~2x. Bumped to 8.0x and added a comment so the next reader knows why.\nThe README still tracks the real ratio; this assertion only guards\nagainst regressions.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-21T15:05:16-07:00",
          "tree_id": "a9beb1365f80cb53024d0df7d0af0c57b9ed159a",
          "url": "https://github.com/eigilsagafos/valdres/commit/123316db3145e895cda44e2c56dd49742ca01731"
        },
        "date": 1779401179813,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.0842 11.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=341 ratio=0.0377 26.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=2729 ratio=0.0659 15.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 345,
            "unit": "ns",
            "extra": "jotai=5876 ratio=0.0598 16.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=3323 ratio=0.0796 12.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16156,
            "unit": "ns",
            "extra": "jotai=266747 ratio=0.0603 16.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=429 ratio=0.7134 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.4181 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=390 ratio=0.7211 1.4x faster"
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
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 352,
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
            "value": 189,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3065,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.1101 9.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6628,
            "unit": "ns",
            "extra": "jotai=24050 ratio=0.2703 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 57568,
            "unit": "ns",
            "extra": "jotai=241325 ratio=0.2386 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5901,
            "unit": "ns",
            "extra": "jotai=13115 ratio=0.4498 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 229,
            "unit": "ns",
            "extra": "jotai=5956 ratio=0.0383 26.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 111353,
            "unit": "ns",
            "extra": "jotai=923240 ratio=0.1207 8.3x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8871,
            "unit": "ns",
            "extra": "jotai=420874 ratio=0.0187 53.5x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1056,
            "unit": "ns",
            "extra": "jotai=3861 ratio=0.2329 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 69690,
            "unit": "ns",
            "extra": "jotai=258777 ratio=0.2789 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 120033,
            "unit": "ns",
            "extra": "jotai=521141 ratio=0.2323 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 832015,
            "unit": "ns",
            "extra": "jotai=3353966 ratio=0.2480 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 799640,
            "unit": "ns",
            "extra": "jotai=3554561 ratio=0.2287 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1586635,
            "unit": "ns",
            "extra": "jotai=18541083 ratio=0.0801 12.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 174280,
            "unit": "ns",
            "extra": "jotai=286805 ratio=0.5612 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 104454,
            "unit": "ns",
            "extra": "jotai=285031 ratio=0.3614 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 937085,
            "unit": "ns",
            "extra": "jotai=1378282 ratio=0.6751 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1144983,
            "unit": "ns",
            "extra": "jotai=1856067 ratio=0.6128 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1288219,
            "unit": "ns",
            "extra": "jotai=12854762 ratio=0.1216 8.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.8066 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8200,
            "unit": "ns",
            "extra": "jotai=14241 ratio=0.5750 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 80230,
            "unit": "ns",
            "extra": "jotai=131956 ratio=0.6051 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4406,
            "unit": "ns",
            "extra": "jotai=7157 ratio=0.6144 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.5172 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 15,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0926 10.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 434,
            "unit": "ns",
            "extra": "jotai=1285 ratio=0.3332 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 288,
            "unit": "ns",
            "extra": "jotai=1502 ratio=0.1915 5.2x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 494,
            "unit": "ns",
            "extra": "jotai=1784 ratio=0.2754 3.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32440,
            "unit": "ns",
            "extra": "jotai=151698 ratio=0.2126 4.7x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 160,
            "unit": "ns",
            "extra": "jotai=574 ratio=0.2770 3.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80730,
            "unit": "ns",
            "extra": "jotai=482733 ratio=0.1669 6.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16281,
            "unit": "ns",
            "extra": "jotai=206510 ratio=0.0774 12.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 793,
            "unit": "ns",
            "extra": "jotai=1382 ratio=0.5714 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 169,
            "unit": "ns",
            "extra": "jotai=220 ratio=0.7551 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=7 ratio=4.4443 4.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 181,
            "unit": "ns",
            "extra": "jotai=235 ratio=0.7411 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
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
            "value": 266,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1430,
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
          "id": "6ed43d8bebb08cf43e42096619f1d6dcd3d087af",
          "message": "Gate publish on Test workflow success (#125)\n\n* Gate publish workflow on Test workflow success\n\nPublish previously ran in parallel with Test on push to main, so a\nfailing test suite wouldn't block an npm release. Switch to\n`workflow_run` so Publish only runs when Test completes successfully,\nand check out the exact tested commit.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Consolidate test and publish into single CI workflow\n\nReplace the workflow_run gating with the more idiomatic pattern: one\nworkflow with two jobs, publish depending on test via `needs:`. Publish\nonly runs on push to main and only when the test job succeeds.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-21T15:08:03-07:00",
          "tree_id": "5e7fcf3f6f7bedb09dc51988faef0bdbdca185fc",
          "url": "https://github.com/eigilsagafos/valdres/commit/6ed43d8bebb08cf43e42096619f1d6dcd3d087af"
        },
        "date": 1779401345619,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.1143 8.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=399 ratio=0.0322 31.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 345,
            "unit": "ns",
            "extra": "jotai=5764 ratio=0.0634 15.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=5563 ratio=0.0602 16.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 488,
            "unit": "ns",
            "extra": "jotai=6316 ratio=0.0756 13.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17688,
            "unit": "ns",
            "extra": "jotai=285144 ratio=0.0626 16.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 422,
            "unit": "ns",
            "extra": "jotai=620 ratio=0.6902 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.3943 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 343,
            "unit": "ns",
            "extra": "jotai=448 ratio=0.7482 1.3x faster"
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
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 350,
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
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3129,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.1218 8.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7066,
            "unit": "ns",
            "extra": "jotai=24816 ratio=0.2744 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 68388,
            "unit": "ns",
            "extra": "jotai=245408 ratio=0.2679 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5931,
            "unit": "ns",
            "extra": "jotai=13210 ratio=0.4433 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 248,
            "unit": "ns",
            "extra": "jotai=5999 ratio=0.0409 24.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 105256,
            "unit": "ns",
            "extra": "jotai=943512 ratio=0.1113 9.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 9848,
            "unit": "ns",
            "extra": "jotai=435623 ratio=0.0193 51.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1119,
            "unit": "ns",
            "extra": "jotai=4060 ratio=0.2567 3.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 72060,
            "unit": "ns",
            "extra": "jotai=271467 ratio=0.2619 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 130103,
            "unit": "ns",
            "extra": "jotai=542062 ratio=0.2434 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 833998,
            "unit": "ns",
            "extra": "jotai=3470929 ratio=0.2417 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 838156,
            "unit": "ns",
            "extra": "jotai=3618910 ratio=0.2327 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1498559,
            "unit": "ns",
            "extra": "jotai=18866381 ratio=0.0806 12.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 142907,
            "unit": "ns",
            "extra": "jotai=305751 ratio=0.4786 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 101129,
            "unit": "ns",
            "extra": "jotai=283895 ratio=0.3526 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 947268,
            "unit": "ns",
            "extra": "jotai=1439557 ratio=0.6664 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1139512,
            "unit": "ns",
            "extra": "jotai=1905617 ratio=0.5878 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1471396,
            "unit": "ns",
            "extra": "jotai=13302613 ratio=0.1109 9.0x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.7512 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8408,
            "unit": "ns",
            "extra": "jotai=14783 ratio=0.5681 1.8x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 82254,
            "unit": "ns",
            "extra": "jotai=135152 ratio=0.6058 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4719,
            "unit": "ns",
            "extra": "jotai=7464 ratio=0.6204 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 35,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.5253 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1447 6.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 425,
            "unit": "ns",
            "extra": "jotai=1285 ratio=0.3297 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=1484 ratio=0.1863 5.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 482,
            "unit": "ns",
            "extra": "jotai=1754 ratio=0.2728 3.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31499,
            "unit": "ns",
            "extra": "jotai=144630 ratio=0.2164 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=574 ratio=0.2800 3.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 79809,
            "unit": "ns",
            "extra": "jotai=473584 ratio=0.1682 5.9x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16436,
            "unit": "ns",
            "extra": "jotai=209311 ratio=0.0760 13.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 854,
            "unit": "ns",
            "extra": "jotai=1479 ratio=0.5738 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 147,
            "unit": "ns",
            "extra": "jotai=217 ratio=0.6706 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 69,
            "unit": "ns",
            "extra": "jotai=31 ratio=3.7752 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 115,
            "unit": "ns",
            "extra": "jotai=175 ratio=0.6674 1.5x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
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
            "value": 273,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1466,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "74112a646288fb29048507008780dba625e16031",
          "message": "Version Packages (beta) (#127)\n\n* Version Packages (beta)\n\n* Hardcode 0.3.0-beta.0 for the six pre-tag packages\n\nChangesets pre mode computes the new version as `semverInc(oldVersion,\nbumpType) + \"-${tag}.${preCount+1}\"`. When oldVersion already carries a\nprerelease identifier (here 0.2.0-pre.28), semver.inc collapses\nminor/patch into the bare 0.2.0, so a \"minor\" bump for these six\npackages produced 0.2.0-beta.29 instead of the intended 0.3.0-beta.0.\n\nOverride the bot's output for @valdres/color-mode, @valdres/hotkeys,\n@valdres-react/{color-mode,draggable,hotkeys,panable} — including their\ninter-package peerDependencies and the \"Updated dependencies\" footnotes\nin their CHANGELOGs. All other packages in this release PR are\nunaffected.\n\n* Add empty changeset for manual version override\n\nThe \"Require changeset\" CI gate runs `bunx changeset status --since=origin/main`\nand rejects publishable-package edits without a corresponding changeset\nentry. The override in the previous commit bypassed the bot's computed\nversions but added no changeset of its own — this empty entry satisfies\nthe gate without triggering an unwanted release.\n\n---------\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>\nCo-authored-by: Eigil Sagafos <eigil.sagafos@ardoq.com>",
          "timestamp": "2026-05-21T18:01:34-07:00",
          "tree_id": "a26f53ffe6a9020c4d9926251b80392489700bcf",
          "url": "https://github.com/eigilsagafos/valdres/commit/74112a646288fb29048507008780dba625e16031"
        },
        "date": 1779411751689,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=80 ratio=0.1062 9.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=708 ratio=0.0363 27.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=4746 ratio=0.0649 15.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 359,
            "unit": "ns",
            "extra": "jotai=5659 ratio=0.0637 15.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 435,
            "unit": "ns",
            "extra": "jotai=5940 ratio=0.0723 13.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16575,
            "unit": "ns",
            "extra": "jotai=278706 ratio=0.0592 16.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=449 ratio=0.7327 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 32,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.5408 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 334,
            "unit": "ns",
            "extra": "jotai=447 ratio=0.7254 1.4x faster"
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
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 361,
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
            "value": 185,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3232,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.1203 8.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7041,
            "unit": "ns",
            "extra": "jotai=40439 ratio=0.1790 5.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 55152,
            "unit": "ns",
            "extra": "jotai=207109 ratio=0.2639 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7154,
            "unit": "ns",
            "extra": "jotai=14915 ratio=0.4850 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=6071 ratio=0.0421 23.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 103703,
            "unit": "ns",
            "extra": "jotai=922738 ratio=0.1109 9.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8533,
            "unit": "ns",
            "extra": "jotai=368872 ratio=0.0230 43.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1306,
            "unit": "ns",
            "extra": "jotai=4034 ratio=0.3184 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 68671,
            "unit": "ns",
            "extra": "jotai=239533 ratio=0.2805 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 196590,
            "unit": "ns",
            "extra": "jotai=742598 ratio=0.2388 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 947815,
            "unit": "ns",
            "extra": "jotai=2998894 ratio=0.3091 3.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 769082,
            "unit": "ns",
            "extra": "jotai=3088726 ratio=0.2482 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1497399,
            "unit": "ns",
            "extra": "jotai=19252167 ratio=0.0679 14.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 137372,
            "unit": "ns",
            "extra": "jotai=312750 ratio=0.4402 2.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 93313,
            "unit": "ns",
            "extra": "jotai=283777 ratio=0.3313 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 889199,
            "unit": "ns",
            "extra": "jotai=1398223 ratio=0.6323 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1100587,
            "unit": "ns",
            "extra": "jotai=1874857 ratio=0.5680 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1272379,
            "unit": "ns",
            "extra": "jotai=12961834 ratio=0.1042 9.6x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 51,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.8319 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7326,
            "unit": "ns",
            "extra": "jotai=14451 ratio=0.5069 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 74165,
            "unit": "ns",
            "extra": "jotai=132585 ratio=0.5580 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4153,
            "unit": "ns",
            "extra": "jotai=7394 ratio=0.5574 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.5840 1.7x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1382 7.2x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 406,
            "unit": "ns",
            "extra": "jotai=1247 ratio=0.3224 3.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=1457 ratio=0.1858 5.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 458,
            "unit": "ns",
            "extra": "jotai=1713 ratio=0.2647 3.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 29599,
            "unit": "ns",
            "extra": "jotai=141738 ratio=0.2077 4.8x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=552 ratio=0.3222 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80784,
            "unit": "ns",
            "extra": "jotai=436583 ratio=0.1865 5.4x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14292,
            "unit": "ns",
            "extra": "jotai=205082 ratio=0.0697 14.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 731,
            "unit": "ns",
            "extra": "jotai=1352 ratio=0.5395 1.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=250 ratio=0.9124 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 87,
            "unit": "ns",
            "extra": "jotai=29 ratio=4.7200 4.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "jotai=191 ratio=0.7807 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 18,
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
            "value": 1346,
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
          "id": "6c3a33be48a8024907bd995ff6162fd4c00f1f28",
          "message": "Fix spurious SelectorCircularDependencyError from leaked cycle-set entry (#128)\n\nevaluateSelector switched to a module-level sharedCircularDepSet for cycle\ndetection, but cleanup only ran on the NeedsInitError branch and at the\ntail of the function. Any other throw — a SelectorEvaluationError rethrow,\na wrapped non-cycle error, or anything from the dep-tracking code after\nthe inner catch — left the selector in the set, so the next read tripped\nthe cycle check against a stale entry.\n\nWrap the body in try/finally so the delete runs on every exit path. The\nold per-call new WeakSet hid the bug because it was GC'd after each\ntop-level call.\n\nRepro (added as regression tests in selector.test.ts):\n  - Inner selector throws once; second store.get(outer) should succeed.\n  - Same via the reEvaluteSelector propagation path (which passes\n    circularDependencySet=undefined and defaults to the shared set).\n\nBoth fail before this change with \"Circular dependency detected in 'outer'\";\nboth pass after.",
          "timestamp": "2026-05-22T07:51:31-07:00",
          "tree_id": "e8cd661e744cf298e3a99142f68cb1ddeb0ef143",
          "url": "https://github.com/eigilsagafos/valdres/commit/6c3a33be48a8024907bd995ff6162fd4c00f1f28"
        },
        "date": 1779461549894,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=81 ratio=0.1468 6.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=353 ratio=0.0365 27.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=4201 ratio=0.0736 13.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 331,
            "unit": "ns",
            "extra": "jotai=5237 ratio=0.0605 16.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 423,
            "unit": "ns",
            "extra": "jotai=6120 ratio=0.0702 14.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 29264,
            "unit": "ns",
            "extra": "jotai=499186 ratio=0.0583 17.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 409,
            "unit": "ns",
            "extra": "jotai=550 ratio=0.7474 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 31,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.6365 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 383,
            "unit": "ns",
            "extra": "jotai=494 ratio=0.7867 1.3x faster"
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
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 361,
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
            "value": 186,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3246,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=73 ratio=0.1299 7.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 10636,
            "unit": "ns",
            "extra": "jotai=56485 ratio=0.1782 5.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 56269,
            "unit": "ns",
            "extra": "jotai=211641 ratio=0.2599 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5648,
            "unit": "ns",
            "extra": "jotai=11392 ratio=0.4950 2.0x faster"
          },
          {
            "name": "createStore",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=6135 ratio=0.0451 22.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 103064,
            "unit": "ns",
            "extra": "jotai=924071 ratio=0.1116 9.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8172,
            "unit": "ns",
            "extra": "jotai=375987 ratio=0.0220 45.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1356,
            "unit": "ns",
            "extra": "jotai=4107 ratio=0.3146 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 72498,
            "unit": "ns",
            "extra": "jotai=292657 ratio=0.2428 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 207019,
            "unit": "ns",
            "extra": "jotai=639475 ratio=0.2390 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 993203,
            "unit": "ns",
            "extra": "jotai=2990376 ratio=0.3264 3.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 773736,
            "unit": "ns",
            "extra": "jotai=3144656 ratio=0.2469 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1827289,
            "unit": "ns",
            "extra": "jotai=22580471 ratio=0.0943 10.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 146224,
            "unit": "ns",
            "extra": "jotai=324796 ratio=0.4490 2.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 96019,
            "unit": "ns",
            "extra": "jotai=296889 ratio=0.3124 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 874541,
            "unit": "ns",
            "extra": "jotai=1404928 ratio=0.6260 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1082632,
            "unit": "ns",
            "extra": "jotai=1910873 ratio=0.5609 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1568047,
            "unit": "ns",
            "extra": "jotai=14149366 ratio=0.1090 9.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 46,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.8331 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7461,
            "unit": "ns",
            "extra": "jotai=14632 ratio=0.5105 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76274,
            "unit": "ns",
            "extra": "jotai=133520 ratio=0.5685 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4116,
            "unit": "ns",
            "extra": "jotai=7451 ratio=0.5524 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.5808 1.7x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.1325 7.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=1194 ratio=0.2309 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 271,
            "unit": "ns",
            "extra": "jotai=1477 ratio=0.1819 5.5x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 451,
            "unit": "ns",
            "extra": "jotai=1745 ratio=0.2525 4.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30115,
            "unit": "ns",
            "extra": "jotai=136444 ratio=0.2187 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 176,
            "unit": "ns",
            "extra": "jotai=547 ratio=0.3221 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 81927,
            "unit": "ns",
            "extra": "jotai=429451 ratio=0.1903 5.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14412,
            "unit": "ns",
            "extra": "jotai=205587 ratio=0.0701 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 738,
            "unit": "ns",
            "extra": "jotai=1373 ratio=0.5361 1.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 228,
            "unit": "ns",
            "extra": "jotai=254 ratio=0.9348 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.9259 3.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 150,
            "unit": "ns",
            "extra": "jotai=187 ratio=0.8036 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 10,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 18,
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
            "value": 256,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1324,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9ee7d48cde10467af56040ee32d4df7ed6b3d5e2",
          "message": "Version Packages (beta) (#130)\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-22T07:54:58-07:00",
          "tree_id": "b84d7302b29c9f85fba5faf854a0848ebc5c808e",
          "url": "https://github.com/eigilsagafos/valdres/commit/9ee7d48cde10467af56040ee32d4df7ed6b3d5e2"
        },
        "date": 1779461757747,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=89 ratio=0.0934 10.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=322 ratio=0.0385 26.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 343,
            "unit": "ns",
            "extra": "jotai=4113 ratio=0.0799 12.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 406,
            "unit": "ns",
            "extra": "jotai=5746 ratio=0.0730 13.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 301,
            "unit": "ns",
            "extra": "jotai=4271 ratio=0.0755 13.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16440,
            "unit": "ns",
            "extra": "jotai=276999 ratio=0.0596 16.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 303,
            "unit": "ns",
            "extra": "jotai=403 ratio=0.7402 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 31,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.5672 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 281,
            "unit": "ns",
            "extra": "jotai=391 ratio=0.7237 1.4x faster"
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
            "value": 171,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2839,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=81 ratio=0.1378 7.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 11297,
            "unit": "ns",
            "extra": "jotai=40034 ratio=0.2751 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 58829,
            "unit": "ns",
            "extra": "jotai=226024 ratio=0.2617 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5275,
            "unit": "ns",
            "extra": "jotai=12480 ratio=0.4180 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 293,
            "unit": "ns",
            "extra": "jotai=6556 ratio=0.0449 22.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 96808,
            "unit": "ns",
            "extra": "jotai=948925 ratio=0.1024 9.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8091,
            "unit": "ns",
            "extra": "jotai=337730 ratio=0.0239 41.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1042,
            "unit": "ns",
            "extra": "jotai=3280 ratio=0.2865 3.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 69202,
            "unit": "ns",
            "extra": "jotai=255957 ratio=0.2703 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 107527,
            "unit": "ns",
            "extra": "jotai=461889 ratio=0.2317 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 795742,
            "unit": "ns",
            "extra": "jotai=2933746 ratio=0.2861 3.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 790835,
            "unit": "ns",
            "extra": "jotai=3385234 ratio=0.2407 4.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1689467,
            "unit": "ns",
            "extra": "jotai=17898672 ratio=0.0818 12.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 113189,
            "unit": "ns",
            "extra": "jotai=233584 ratio=0.4946 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 99856,
            "unit": "ns",
            "extra": "jotai=293246 ratio=0.3430 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 887833,
            "unit": "ns",
            "extra": "jotai=1476801 ratio=0.6016 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1075336,
            "unit": "ns",
            "extra": "jotai=1959202 ratio=0.5456 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1460100,
            "unit": "ns",
            "extra": "jotai=12533762 ratio=0.1183 8.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7426 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7725,
            "unit": "ns",
            "extra": "jotai=15386 ratio=0.5010 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 74838,
            "unit": "ns",
            "extra": "jotai=137125 ratio=0.5501 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4149,
            "unit": "ns",
            "extra": "jotai=7601 ratio=0.5429 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.4436 2.3x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 19,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.1140 8.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=1355 ratio=0.1909 5.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 257,
            "unit": "ns",
            "extra": "jotai=1577 ratio=0.1640 6.1x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 445,
            "unit": "ns",
            "extra": "jotai=1951 ratio=0.2296 4.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 27652,
            "unit": "ns",
            "extra": "jotai=154980 ratio=0.1793 5.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 271,
            "unit": "ns",
            "extra": "jotai=809 ratio=0.3356 3.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 75492,
            "unit": "ns",
            "extra": "jotai=508801 ratio=0.1594 6.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13182,
            "unit": "ns",
            "extra": "jotai=182350 ratio=0.0716 14.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 897,
            "unit": "ns",
            "extra": "jotai=1575 ratio=0.5649 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 270,
            "unit": "ns",
            "extra": "jotai=336 ratio=0.7050 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 63,
            "unit": "ns",
            "extra": "jotai=13 ratio=4.4612 4.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 267,
            "unit": "ns",
            "extra": "jotai=337 ratio=0.8482 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 21,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 186,
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
            "value": 242,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1495,
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
          "id": "36f75240f8fed2d0441fd30f360ed2dec24fafe1",
          "message": "Lazy-allocate AbortController for selector first eval (#131)\n\n* Defer AbortController allocation until selector reads options.signal\n\n`options.signal` is now a lazy getter. Selectors that never read it (the\ncommon case) skip AbortController allocation on first eval — ~160ns saved\nper first-eval sync selector, ~29% off the init path for that case. The\nknown-sync cache, previous-controller abort on re-eval, and controller\nstorage for async cancellation are all preserved.\n\n* Pre-abort signal when accessed after eval was superseded\n\nA selector whose body returns a Promise without reading `opts.signal` and\nonly touches it later (e.g. after an await) would, with lazy allocation\nalone, miss the abort on re-eval — Eval 2 would see no controller in the\nmap to abort. The getter now captures its eval's `evalCtx` and, if that\ncontext has been revoked by the time `signal` is first read, returns a\npre-aborted signal. Hot path (signal never read) is unchanged.",
          "timestamp": "2026-05-22T09:59:05-07:00",
          "tree_id": "beee59247d3909ebd2542f2f4a7bdd9c8ba61f15",
          "url": "https://github.com/eigilsagafos/valdres/commit/36f75240f8fed2d0441fd30f360ed2dec24fafe1"
        },
        "date": 1779469202902,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.1077 9.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=740 ratio=0.0333 30.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 196,
            "unit": "ns",
            "extra": "jotai=2688 ratio=0.0795 12.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 397,
            "unit": "ns",
            "extra": "jotai=5427 ratio=0.0703 14.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 486,
            "unit": "ns",
            "extra": "jotai=5796 ratio=0.0809 12.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15767,
            "unit": "ns",
            "extra": "jotai=272097 ratio=0.0576 17.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 307,
            "unit": "ns",
            "extra": "jotai=394 ratio=0.7419 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 31,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6712 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=389 ratio=0.7407 1.4x faster"
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
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 338,
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
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 165,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2787,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=83 ratio=0.1384 7.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8618,
            "unit": "ns",
            "extra": "jotai=25946 ratio=0.3396 2.9x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 62555,
            "unit": "ns",
            "extra": "jotai=229761 ratio=0.2785 3.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5137,
            "unit": "ns",
            "extra": "jotai=12565 ratio=0.4061 2.5x faster"
          },
          {
            "name": "createStore",
            "value": 513,
            "unit": "ns",
            "extra": "jotai=6973 ratio=0.0732 13.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 80477,
            "unit": "ns",
            "extra": "jotai=942192 ratio=0.0851 11.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7883,
            "unit": "ns",
            "extra": "jotai=330950 ratio=0.0239 41.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1240,
            "unit": "ns",
            "extra": "jotai=3510 ratio=0.3246 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 70518,
            "unit": "ns",
            "extra": "jotai=262296 ratio=0.2725 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 129522,
            "unit": "ns",
            "extra": "jotai=494782 ratio=0.2403 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 809401,
            "unit": "ns",
            "extra": "jotai=3046629 ratio=0.2810 3.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 834779,
            "unit": "ns",
            "extra": "jotai=3506002 ratio=0.2438 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1505130,
            "unit": "ns",
            "extra": "jotai=17786621 ratio=0.0766 13.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 114012,
            "unit": "ns",
            "extra": "jotai=234557 ratio=0.4808 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97130,
            "unit": "ns",
            "extra": "jotai=296056 ratio=0.3233 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 879488,
            "unit": "ns",
            "extra": "jotai=1489297 ratio=0.5666 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1102642,
            "unit": "ns",
            "extra": "jotai=2095686 ratio=0.4904 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1659863,
            "unit": "ns",
            "extra": "jotai=13864766 ratio=0.1187 8.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7041 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7583,
            "unit": "ns",
            "extra": "jotai=15781 ratio=0.4802 2.1x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 72248,
            "unit": "ns",
            "extra": "jotai=142842 ratio=0.5103 2.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 3996,
            "unit": "ns",
            "extra": "jotai=8072 ratio=0.4925 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.4408 2.3x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0886 11.3x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=1300 ratio=0.1956 5.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=1524 ratio=0.1673 6.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 441,
            "unit": "ns",
            "extra": "jotai=1877 ratio=0.2338 4.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 27679,
            "unit": "ns",
            "extra": "jotai=138999 ratio=0.1997 5.0x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=757 ratio=0.3188 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 72036,
            "unit": "ns",
            "extra": "jotai=445610 ratio=0.1623 6.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13360,
            "unit": "ns",
            "extra": "jotai=184829 ratio=0.0716 14.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 772,
            "unit": "ns",
            "extra": "jotai=1509 ratio=0.5125 2.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 207,
            "unit": "ns",
            "extra": "jotai=286 ratio=0.6757 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 58,
            "unit": "ns",
            "extra": "jotai=13 ratio=4.6151 4.6x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 209,
            "unit": "ns",
            "extra": "jotai=289 ratio=0.7582 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 183,
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
            "value": 245,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1445,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "28d47c9ecce46f88a18664921d7273312c6d80bb",
          "message": "Version Packages (beta) (#132)\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-22T13:06:49-07:00",
          "tree_id": "024c4f14f364061a75e4ec110699e61e693346a3",
          "url": "https://github.com/eigilsagafos/valdres/commit/28d47c9ecce46f88a18664921d7273312c6d80bb"
        },
        "date": 1779480474410,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0845 11.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=342 ratio=0.0377 26.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 305,
            "unit": "ns",
            "extra": "jotai=4211 ratio=0.0741 13.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 402,
            "unit": "ns",
            "extra": "jotai=5700 ratio=0.0676 14.8x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=5978 ratio=0.0619 16.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16471,
            "unit": "ns",
            "extra": "jotai=262970 ratio=0.0630 15.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 339,
            "unit": "ns",
            "extra": "jotai=504 ratio=0.7203 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.4611 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=402 ratio=0.7268 1.4x faster"
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
            "value": 12,
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
            "value": 187,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3086,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.0985 10.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7344,
            "unit": "ns",
            "extra": "jotai=27492 ratio=0.2727 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 62086,
            "unit": "ns",
            "extra": "jotai=245919 ratio=0.2512 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5821,
            "unit": "ns",
            "extra": "jotai=13225 ratio=0.4379 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 229,
            "unit": "ns",
            "extra": "jotai=5959 ratio=0.0378 26.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 104715,
            "unit": "ns",
            "extra": "jotai=918153 ratio=0.1143 8.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8681,
            "unit": "ns",
            "extra": "jotai=403983 ratio=0.0191 52.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1065,
            "unit": "ns",
            "extra": "jotai=3861 ratio=0.2320 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 74960,
            "unit": "ns",
            "extra": "jotai=259709 ratio=0.2899 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 130844,
            "unit": "ns",
            "extra": "jotai=532719 ratio=0.2430 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 869461,
            "unit": "ns",
            "extra": "jotai=3368286 ratio=0.2595 3.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 841896,
            "unit": "ns",
            "extra": "jotai=3610514 ratio=0.2376 4.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1366343,
            "unit": "ns",
            "extra": "jotai=18411976 ratio=0.0753 13.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 144009,
            "unit": "ns",
            "extra": "jotai=291273 ratio=0.4896 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97426,
            "unit": "ns",
            "extra": "jotai=285802 ratio=0.3486 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 902573,
            "unit": "ns",
            "extra": "jotai=1397852 ratio=0.6478 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1110320,
            "unit": "ns",
            "extra": "jotai=1814083 ratio=0.6021 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1234161,
            "unit": "ns",
            "extra": "jotai=12591329 ratio=0.1031 9.7x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.7679 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8080,
            "unit": "ns",
            "extra": "jotai=14778 ratio=0.5466 1.8x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81462,
            "unit": "ns",
            "extra": "jotai=135042 ratio=0.6044 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4341,
            "unit": "ns",
            "extra": "jotai=7369 ratio=0.5874 1.7x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.5162 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0835 12.0x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 302,
            "unit": "ns",
            "extra": "jotai=1239 ratio=0.2445 4.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 309,
            "unit": "ns",
            "extra": "jotai=1456 ratio=0.2119 4.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 502,
            "unit": "ns",
            "extra": "jotai=1723 ratio=0.2900 3.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32371,
            "unit": "ns",
            "extra": "jotai=141479 ratio=0.2286 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 163,
            "unit": "ns",
            "extra": "jotai=552 ratio=0.2943 3.4x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 92743,
            "unit": "ns",
            "extra": "jotai=462633 ratio=0.2007 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16210,
            "unit": "ns",
            "extra": "jotai=210137 ratio=0.0758 13.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 793,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.5643 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 144,
            "unit": "ns",
            "extra": "jotai=204 ratio=0.6711 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=10 ratio=2.8811 2.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=203 ratio=0.7965 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
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
            "value": 292,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1378,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      }
    ]
  }
}
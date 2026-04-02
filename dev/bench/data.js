window.BENCHMARK_DATA = {
  "lastUpdate": 1775161985202,
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
      }
    ]
  }
}
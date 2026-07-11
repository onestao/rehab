# Errors

## [ERR-20260711-001] pyftsubset

**Logged**: 2026-07-11T10:22:00+08:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
The local FontTools install could not decode WOFF2 while attempting an extra subset pass.

### Error
```
ImportError: No module named brotli
```

### Context
- Command: `pyftsubset assets/material-symbols-rounded.woff2 ... --flavor=woff2`
- The downloaded Google Fonts response was already a 23 KB icon subset after requesting fixed optical size and weight axes, so an additional local subset pass was unnecessary.
- A later exploratory read also used the nonexistent path `css-src/02-reset.css`; the registered base file is `css-src/02-base.css`.

### Suggested Fix
Use the fixed-axis Google Fonts subset directly, or install the Python Brotli extension before using FontTools on WOFF2 input. Read CSS filenames from `scripts/css-sections.mjs` before opening them.

### Metadata
- Reproducible: yes
- Related Files: assets/material-symbols-rounded.woff2, css-src/02-base.css

---

## [ERR-20260711-002] npm-run-ci-nested-worktree

**Logged**: 2026-07-11T10:43:00+08:00
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
`npm run ci` cannot lint the nested `.worktrees/ui-mockup-fix` checkout because ESLint treats the entire checkout as ignored.

### Error
```
You are linting ".", but all of the files matching the glob pattern "." are ignored.
```

### Context
- Command: `npm run ci`
- Working directory: `.worktrees/ui-mockup-fix`
- The focused Node regression test passes; the full worktree CI stops at its first lint step.

### Suggested Fix
Teach the CI lint command about nested worktrees, or run ESLint with `--no-ignore` against the changed files when validating a nested worktree.

### Metadata
- Reproducible: yes
- Related Files: .eslintignore, package.json

---

## [ERR-20260711-003] powershell-rg-wildcard

**Logged**: 2026-07-11T16:05:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
PowerShell passed a literal `data-*.js` path to ripgrep, which Windows rejected before the intended source search ran.

### Error
```
rg: data-*.js: 文件名、目录名或卷标语法不正确。 (os error 123)
```

### Context
- Command attempted a positional Windows wildcard while tracing split-module method ownership.
- A later exploratory read also guessed the nonexistent file `test/data-views.test.mjs`.

### Suggested Fix
Use repository globs through `rg --glob "data-*.js"`, and use `rg --files test` before opening a guessed test filename.

### Metadata
- Reproducible: yes
- Related Files: test/, data-views.js

---

## [ERR-20260711-004] in-app-browser-telemetry-timeout

**Logged**: 2026-07-11T16:55:00+08:00
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
The in-app browser client repeatedly waited on blocked Statsig telemetry and one multi-step local UI audit timed out even though the localhost app remained responsive.

### Error
```
[Statsig] A networking error occurred ... Timeout of 10000ms expired.
js execution timed out; kernel reset
```

### Context
- Target application: local static server on `127.0.0.1`.
- Short, focused browser interactions succeeded; a loop spanning five profile subpages exceeded the tool timeout.

### Suggested Fix
Keep local browser audit calls focused to one or two interactions, and avoid aggregating long UI loops while connector telemetry is offline.

### Metadata
- Reproducible: intermittent
- Related Files: test/today-lazy-runtime.test.mjs

---

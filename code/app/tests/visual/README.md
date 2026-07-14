# Visual Regression Tests

Viewport gestito esclusivamente dalla configurazione dei progetti Playwright (`playwright.config.ts`).
Non usare `page.setViewportSize()` negli spec — ogni spec gira due volte: una per `visual-desktop`
(1280×800) e una per `visual-mobile` (375×812).

Per generare le baseline iniziali:

```
npx playwright test tests/visual --update-snapshots --project=visual-desktop
npx playwright test tests/visual --update-snapshots --project=visual-mobile
```

Per eseguire i test contro le baseline esistenti:

```
npx playwright test tests/visual --project=visual-desktop
npx playwright test tests/visual --project=visual-mobile
```

Snapshot salvati in:

- `tests/visual/__snapshots__/desktop/`
- `tests/visual/__snapshots__/mobile/`

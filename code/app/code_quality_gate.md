# Code Quality Gate — Wave 4

Checklist gate pre-merge per il progetto Turnly (TSK-012).

## Checklist

| # | Check | Comando | Threshold / Atteso | Stato |
|---|-------|---------|-------------------|-------|
| 1 | TypeScript strict | `npm run type:check` | 0 errori, 0 `@ts-ignore` | - |
| 2 | ESLint | `npx eslint .` | 0 errori (warning ammessi) | - |
| 3 | Prettier format | `npm run format:check` | 0 file out-of-format | - |
| 4 | Unit tests + coverage | `npm run test:coverage` | lines >= 80%, functions >= 80%, branches >= 75%, statements >= 80% | - |
| 5 | E2E tests (Playwright) | `npm run test:e2e` | 0 test falliti | - |
| 6 | A11y WCAG 2.2 AA | `npm run test:a11y` | 0 violazioni WCAG 2.2 AA | - |

## Comandi

### 1. TypeScript

```bash
# Dalla directory code/app/
npm run type:check
# oppure
npx tsc --noEmit
```

Flags attivi in `tsconfig.json`:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`

### 2. ESLint

```bash
npx eslint .
```

Regole TypeScript strict attive:
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-floating-promises: error`
- `@typescript-eslint/no-misused-promises: error`
- `no-console: warn` (allow: error, warn)

### 3. Prettier

```bash
# Controlla senza modificare
npm run format:check

# Applica la formattazione
npm run format
```

Config `.prettierrc`: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: es5`, `printWidth: 100`.

### 4. Vitest Coverage

```bash
npm run test:coverage
```

Thresholds (`vitest.config.ts`):
- `lines: 80`
- `functions: 80`
- `branches: 75`
- `statements: 80`

Include scope: `lib/rules/**/*.ts`, `lib/zod/**/*.ts`.
Report: `text` (console) + `lcov` (per CI).

### 5. E2E — Playwright

```bash
npm run test:e2e
```

Suite coperti: T-DOM, T-REC, T-SWP, T-REQ, T-SEC.

### 6. A11y — Playwright + axe

```bash
npm run test:a11y
# equivale a: playwright test --project=a11y
```

Standard: WCAG 2.2 AA.

## CI pipeline

Vedi `.github/workflows/ci.yml` per l'esecuzione automatica di tutti i check
su ogni `push` e `pull_request`.

## Note

- **Nessun `@ts-ignore`** nel codice produttivo (`lib/`, `app/`, `components/`).
- **Nessun `any` non giustificato**: ogni uso di `any` deve avere un commento
  che spiega il motivo.
- La coverage viene calcolata **solo su `lib/rules/` e `lib/zod/`**, non
  sull'intero progetto Next.js.
- Il gate CQRL (`/review TSK-006`, `/review TSK-005`, `/review TSK-008`)
  viene eseguito separatamente dal TPM dopo il completamento wave 3.

# QA Static Pipeline Report — soli-turnly
Data: 2026-07-15

---

## TypeScript Check: ✅ PASS

**Comando:** `npm run typecheck` → `tsc --noEmit`

- Errori TS: **0**
- Warning TS: **0**
- Note: `npm warn Unknown user config "email"` — warning npm non pertinente, ignorabile.

---

## ESLint: ⚠️ WARNING

**Comando:** `npm run lint` → `next lint`

- Errori ESLint: **0**
- Warning ESLint: **8**

| File | Riga | Regola | Messaggio |
|------|------|--------|-----------|
| `app/admin/staff/_components/StaffPageClient.tsx` | 45 | `react-hooks/exhaustive-deps` | `allStaff` logical expression invalida useMemo deps (riga 108) |
| `components/matrix/ShiftCell.tsx` | 73 | `jsx-a11y/role-supports-aria-props` | `aria-readonly` non supportato dal ruolo `cell` |
| `components/matrix/ShiftCell.tsx` | 88 | `jsx-a11y/role-supports-aria-props` | `aria-readonly` non supportato dal ruolo `cell` |
| `components/matrix/ShiftGrid.tsx` | 180 | `react-hooks/exhaustive-deps` | `shifts` conditional invalida useMemo deps (riga 215) |
| `components/matrix/ShiftGrid.tsx` | 180 | `react-hooks/exhaustive-deps` | `shifts` conditional invalida useMemo deps (riga 282) |
| `components/matrix/ShiftGrid.tsx` | 180 | `react-hooks/exhaustive-deps` | `shifts` conditional invalida useMemo deps (riga 468) |
| `lib/toast.ts` | 15 | `no-console` | `console` statement non consentito (solo `error`/`warn`) |
| `lib/toast.ts` | 21 | `no-console` | `console` statement non consentito (solo `error`/`warn`) |

**Note aggiuntive:**
- `next lint` è deprecated in Next.js 16; verrà rimosso in futuro (migrare a ESLint CLI).
- Nessun errore bloccante: pipeline non interrotta.

---

## Unit Tests (Vitest): ✅ PASS

**Comando:** `npm run test` → `vitest run`

- Test files: **6 passed (6)**
- Tests: **36 passed (36)**
- Skipped: **0**
- Failed: **0**
- Durata totale: **4.14s**

---

## Build Check: ⚠️ WARNING

**Comando:** `npm run build` → `next build`

- Esito build: **✅ Completata con successo**
- Pagine generate: **49/49**
- Compiled with warnings: **sì** (non bloccanti)

**Warning di build:**

| Sorgente | Warning |
|----------|---------|
| `node_modules/jose` (`deflate.js:10`) | `CompressionStream` — Node.js API non supportata in Edge Runtime |
| `node_modules/jose` (`deflate.js:26`) | `DecompressionStream` — Node.js API non supportata in Edge Runtime |
| `tailwind.config.ts` | Modulo senza `"type": "module"` in `package.json` — reparsed come ES module (overhead prestazionale) |

**Note:**
- I warning `jose`/Edge Runtime derivano da `next-auth` → `@auth/core` → `jose`. Sono warning di dipendenze di terze parti, non del codice applicativo.
- Il warning `tailwind.config.ts` si risolve aggiungendo `"type": "module"` in `package.json` (impatto selettivo: verificare compatibilità con altre config CJS).
- Gli 8 warning ESLint sono riproposti anche durante la build (fase lint interna di `next build`): confermati, non nuovi.

**Route summary:** 18 route dinamiche applicative + 40 API route + 2 route statiche (`/_not-found`, `/login`). Bundle condiviso: 102 kB.

---

## Summary

| Step | Stato | Errori | Warning |
|------|-------|--------|---------|
| TypeScript Check | ✅ PASS | 0 | 0 |
| ESLint | ⚠️ WARNING | 0 | 8 |
| Unit Tests (Vitest) | ✅ PASS | 0 | 0 |
| Build Check | ⚠️ WARNING | 0 | 3 build + 8 lint |

**Overall: ⚠️ PARTIAL**

La pipeline è funzionalmente sana: nessun errore bloccante in nessuno step. I warning aperti sono:
- **4 react-hooks/exhaustive-deps** (rischio stale closure in `useMemo`) — bassa priorità ma da risolvere
- **2 jsx-a11y/role-supports-aria-props** in `ShiftCell` — impatto accessibilità (ARIA non conforme su `cell`)
- **2 no-console** in `lib/toast.ts` — qualità codice
- **2 jose/Edge Runtime** — dipendenza terze parti, non modificabile direttamente
- **1 tailwind.config.ts module type** — configurazione, fix semplice ma richiede verifica CJS compatibility

**Azioni consigliate (per portare a PASS completo):**
1. Wrappare `allStaff` e `shifts` in `useMemo` dedicati (`StaffPageClient.tsx`, `ShiftGrid.tsx`)
2. Rimuovere `aria-readonly` dal ruolo `cell` in `ShiftCell.tsx` o cambiare ruolo ARIA
3. Sostituire `console.log/info` con `console.warn/error` in `lib/toast.ts`
4. Aggiungere `"type": "module"` a `package.json` (verificare impatto config CJS)

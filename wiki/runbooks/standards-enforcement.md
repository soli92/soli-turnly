---
id: standards-enforcement
type: runbook
title: Tenant standards enforcement — come funziona, come dichiarare, come deviare
status: draft
created: 2026-05-15
updated: 2026-05-15
sources: []
tags: [runbook, hooks, standards, adr, governance]
---

# Tenant standards enforcement

Runbook operativo per l'hook `enforce_standards.sh` (P1.1). Documenta come
dichiarare standard tenant nel constitution, come l'hook li impone sugli ADR,
e come dichiarare deviazioni esplicite quando un vincolo legacy lo richiede.
Sostituisce le note implicite finora distribuite tra
[[2026-05-15-p0-silent-guardrail-degradation]] e [[hook-dependencies]].

## Cosa è uno standard tenant

Standard normativo (SPID, OIDC, OAuth2, SAML, eIDAS, FHIR, GDPR, HL7,
ISO/IEC, RFC numerati) che il `lead-architect` ha dedotto dai raw del
progetto-tenant e dichiarato come vincolo verbatim. Una volta in
[^code: constitution.md:90] sotto `tenant_standards:`, lo standard diventa
gate mechanical: ogni ADR scritto in `wiki/design/decisions/` viene scansionato
per anti-pattern noti del dominio coperto da quello standard.

## Come dichiarare uno standard

L'editing è riservato al `lead-architect` (o a un umano in fase di setup) e
avviene in `constitution.md`. Esempio di attivazione di OIDC come vincolo:

```yaml
tenant_standards: ["OIDC"]
```

Il bump della versione del constitution è additive (es. da `1.3` a `1.3.1`)
quando si aggiungono standard a una lista preesistente. La modifica va
registrata in [^code: logs/audit_log.md:1] con `actor: lead-architect` (o
`actor: human` se manuale) e una riga in [[log]] sotto operation `policy`.

## Come funziona l'enforcement

L'hook [^code: .claude/hooks/enforce_standards.sh:1] è PreToolUse su Write|Edit.
Per ogni ADR target (path glob `wiki/design/decisions/*.md` o futuro
`wiki-staging/design/decisions/*.md` quando P1.2 sarà attivo):

1. Legge da `constitution.md` i blocchi YAML `tenant_standards:` e
   `standards_antipatterns:`.
2. Se `tenant_standards` è vuoto, esce con `exit 0` (no-op gate). Questo è
   lo stato di default del framework agnostico — l'enforcement si attiva solo
   per tenant che hanno popolato la lista.
3. Per ogni standard `S` in `tenant_standards`, recupera l'array di
   anti-pattern `standards_antipatterns[S]` (case-insensitive match).
4. Estrae il body dell'ADR (esclusa frontmatter) e cerca ogni anti-pattern
   come substring lowercase.
5. Se match e `S` **non** appare in `deviates_from:` del frontmatter,
   `exit 2` con diagnostic e suggerimenti di rimedio.
6. Altrimenti `exit 0`.

## Come dichiarare una deviazione

Quando un vincolo legacy o un requisito di transizione rende necessario
discostarsi da uno standard, l'ADR può dichiarare una deviazione esplicita
nel frontmatter:

```yaml
deviates_from: ["OIDC"]
```

Il campo è array di stringhe, validato da [^code: schemas/adr.schema.json:23].
Ogni entry deve corrispondere a una chiave di `standards_antipatterns:` nel
constitution. La deviazione **non** è un bypass silenzioso: è una opt-out
costituzionale tracciata. Il `decision` o `consequences` body dell'ADR
deve argomentare il razionale, in modo che un futuro reviewer (umano o
verifier) possa valutare se la deviazione è ancora giustificata.

## Estendere la lookup-table di anti-pattern

Quando emergono nuovi standard rilevanti per i tenant futuri (FHIR, eIDAS,
ecc.), si estende `standards_antipatterns:` in `constitution.md` con nuove
chiavi e relative liste di anti-pattern. Esempio additive per FHIR:

```yaml
standards_antipatterns:
  OIDC:   ["JWT custom", ...]
  OAuth2: [...]
  SAML:   [...]
  SPID:   [...]
  FHIR:   ["custom JSON schema for clinical data", "non-FHIR resource model"]
```

Nessuna modifica al codice del hook è necessaria — la logica è data-driven.
Il bump del constitution è additive. La nuova chiave diventa attiva solo
quando un tenant la dichiara in `tenant_standards:`.

## Troubleshooting

### "tenant standards constraint violation: standard X — anti-patterns found"

L'hook ha trovato match di anti-pattern nel body dell'ADR. Tre rimedi
gerarchici, dal più conformante al più costoso:

1. **Sostituire l'anti-pattern con lo standard verbatim**. È sempre la
   prima opzione: se possibile, riformulare la decisione per adottare lo
   standard senza varianti custom.
2. **Dichiarare deviazione esplicita** in `deviates_from:` e giustificare
   nel body. Adatto a vincoli legacy temporanei. Crea debito tecnico
   tracciato che un futuro ADR di "follow-up" può chiudere.
3. **Rimuovere lo standard da `tenant_standards:`** in constitution. Adatto
   solo se lo standard non è più un vincolo del progetto. Richiede bump
   costituzionale e un ADR che spieghi il cambio di assunzione.

### "enforce_standards: pyyaml is required but is not installed"

Lo stesso messaggio fail-closed di altri hook che dipendono da pyyaml. Soluzione
in [[hook-dependencies]] sezione "pyyaml is required but is not installed". L'hook
non distingue tra hook diversi sul messaggio di dipendenza: il rimedio è
uniforme (`pip3 install -r requirements.txt`).

### L'ADR sembra conforme ma viene rifiutato

Cause comuni e relativi rimedi:

1. **Match case-insensitive su substring**: il hook fa lowercase su entrambi
   il body e ogni anti-pattern e cerca substring. Se un anti-pattern è
   `"JWT custom"`, anche `"JWT custom-signed"` matchа. Soluzione: riformulare
   la frase oppure dichiarare deviazione.
2. **Standard dichiarato ma assente da `standards_antipatterns:`**: l'hook
   non blocca, ma nemmeno fa enforcement positivo. Sintomo del problema
   inverso: pensavi che blockasse e invece passa. Aggiungere chiavi alla
   lookup-table per attivare l'enforcement effettivo.
3. **Frontmatter non parseable**: se la frontmatter ha YAML mal-formato,
   l'hook delega il rifiuto a `validate_frontmatter.sh` e non blocca per
   contestare l'assenza di `deviates_from`. Sintomo: vedi due rifiuti uno
   dopo l'altro.

## Cosa NON fare

- ❌ Non aggiungere standard a `tenant_standards:` senza un raw che li
  motivi. Il framework è agnostic by default: l'enforcement si attiva solo
  per evidenza derivata da raw del progetto-tenant, mai per opinione.
- ❌ Non usare `deviates_from:` come scorciatoia per evitare di seguire uno
  standard. La deviazione è un opt-out costituzionale, non un toggle di
  comodo. Un'ADR che cita `deviates_from: ["OIDC"]` ma giustifica solo con
  "ci piace di più JWT" deve essere bloccata dal verifier-grounding o dal
  reviewer umano.
- ❌ Non hardcodare anti-pattern dentro il codice dell'hook. La lookup-table
  vive in constitution per ragione di agent-agnosticità (vedi
  [^code: constitution.md:42]). Ogni override di codice trasforma il framework
  in tenant-specific.

## Stato del status

Status iniziale `draft`. Promotion a `reviewed` quando il primo ADR reale
prodotto dal `lead-architect` in un progetto-tenant avrà esercitato almeno
uno scenario di reject e uno di deviazione esplicita. Promotion a `certified`
dopo due tenant indipendenti senza emergere nuovi pattern di troubleshooting.

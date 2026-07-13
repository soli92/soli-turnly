---
type: runbook
status: draft
sources:
  - PATTERN.md
  - .claude/commands/premortem.md
  - .claude/skills/premortem-protocol.md
created: 2026-06-03
updated: 2026-06-03
---

# Come Claude Code carica e invoca le skill

Risolve il gap `claude-code-skill-dispatch-mechanism` (2026-05-29).

Il PATTERN documenta «thin agents, fat skills» (v2.3) ma non spiega il meccanismo
fisico con cui una skill viene caricata. Questo runbook colma quella lacuna sulla
base dell'osservazione empirica durante l'implementazione di v2.16 (TSK-001/002).

## Cosa sono skill e comandi

- **Comando** (`.claude/commands/*.md`) — file markdown con frontmatter `description:`
  e `argument-hint:`. Claude Code lo espone come slash command (`/nome`). Quando
  invocato, il suo **contenuto intero** viene iniettato come prompt nel turno corrente
  con `$ARGUMENTS` sostituito dagli argomenti dell'utente.
- **Skill** (`.claude/skills/*.md`) — file markdown con frontmatter `name:` e
  `description:`. È un **protocollo riusabile** che descrive una procedura.

## Come un comando invoca una skill: due meccanismi

### Meccanismo 1 — Inline reference (più comune)

Il corpo del comando include il testo «Invoca la skill `premortem-protocol`» o
«Esegui la procedura descritta in `.claude/skills/premortem-protocol.md`».

Claude Code — essendo l'LLM che esegue il turno — **legge il contenuto del file
skill direttamente** tramite il sistema di context (il file è noto al runtime perché
è nel progetto). In pratica il comando agisce da dispatcher: le sue istruzioni
puntano alla skill, e l'LLM segue la procedura descritta lì.

**Non c'è chiamata di funzione esplicita.** La skill diventa parte del contesto
dell'LLM tramite il riferimento nel comando + la lettura del file.

### Meccanismo 2 — Tool `Skill` (per invocazione programmatica)

Claude Code espone il tool `Skill` (vedi sistema di invocazione in-band). Quando
l'LLM vuole eseguire una skill con nome preciso, chiama:

```
Skill({ skill: "premortem-protocol", args: "EP-001" })
```

Il runtime carica il file `.claude/skills/premortem-protocol.md` come contesto nel
turno di esecuzione del tool. La skill vede `$ARGUMENTS` sostituito con `"EP-001"`.

Questo è il meccanismo usato quando un agente (`.claude/agents/*.md`) vuole eseguire
una skill in modo strutturato, o quando il sistema di prompt del comando contiene
esplicitamente `Skill(...)` come call.

## Qual è il meccanismo usato in v2.16?

Il comando `/premortem` usa il **Meccanismo 1**: il suo corpo descrive come interpretare
gli argomenti, discrimina l'input shape, e poi dice «invoca la skill premortem-protocol»
come istruzione testuale. L'LLM che esegue il turno legge la skill direttamente come
file del progetto — non serve un tool call esplicito.

Verifica empirica durante TSK-002: il runtime Claude Code carica i file `.claude/skills/`
come parte del context di progetto; i comandi che li referenziano non richiedono un
`Agent` tool separato. La skill può anche essere invocata via `Skill` tool da agenti
che hanno accesso a quel tool.

## Implicazioni pratiche per nuove skill

1. **Non serve una chiamata esplicita via `Agent` tool** per eseguire una skill da un
   comando — basta che il comando la nomini e l'LLM ne legga il contenuto.
2. Le skill **non si auto-caricano** all'avvio di Claude Code: diventano attive solo
   quando un comando o un agente le referenzia esplicitamente nel turno corrente.
3. Una skill può essere richiamata da più comandi/agenti senza duplicare la logica
   (riuso by-reference, non by-copy).
4. Il frontmatter `name:` è la chiave con cui il `Skill` tool identifica la skill
   (meccanismo 2); il path è usato nei reference inline (meccanismo 1).

## Sub-agent e skill

Quando un agente (`.claude/agents/`) spawna un sub-agent via `Agent` tool, il
sub-agent ha accesso alle skill del progetto ma **non eredita automaticamente il
contesto del parent**. Se il sub-agent deve seguire una skill, il prompt del parent
deve includerlo esplicitamente (es. «segui la procedura in `.claude/skills/X.md`»).

Questo spiega perché `wiki-keeper-worker` (sub-agent) non invoca automaticamente
tutte le skill del parent `wiki-keeper`: il parent passa esplicitamente le istruzioni
rilevanti nel prompt del sub-agent.

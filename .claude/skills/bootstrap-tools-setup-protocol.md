# bootstrap-tools-setup-protocol — v1.0

**Scopo:** Verifica e installa le dipendenze di `tools/` durante il bootstrap di una factory.

## Procedura

### Check 1 — Python 3.10+
```bash
python3 --version 2>&1 | grep -E "3\.(1[0-9]|[2-9][0-9])" || { echo "ERROR: Python >= 3.10 required"; exit 1; }
```

### Check 2 — Node 18+
```bash
node --version 2>&1 | grep -E "v(1[8-9]|[2-9][0-9])\." || { echo "ERROR: Node >= 18 required"; exit 1; }
```

### Check 3 — pip install
```bash
if [ -f "tools/requirements.txt" ]; then
  pip install -r tools/requirements.txt --quiet
fi
```

### Check 4 — npm install
```bash
if [ -f "tools/package.json" ]; then
  cd tools && npm install --silent
fi
```

### Check 5 — Playwright browsers
```bash
npx playwright install --with-deps chromium 2>&1 | tail -3
```

## Output

- `TOOLS_SETUP: OK` se tutti i check passano
- Lista dipendenze mancanti se uno o più check falliscono

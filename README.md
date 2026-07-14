# OmniScribe AI

OmniScribe AI turns handwritten JPG/PNG pages into reviewed Markdown notes with Obsidian tags, topic links, and source-image attachments.

## What works

- Upload, preview, reorder, and validate up to 8 JPG/PNG images
- Progressive page-level OCR events over replayable SSE
- Official Z.AI `glm-ocr` Layout Parsing API integration
- OpenAI-compatible LLM metadata enrichment with validated JSON
- Markdown review with GFM tables and KaTeX math
- Explicit review before export
- Atomic Obsidian note writes, source images, topic/category notes, and a hybrid local vault graph
- Safe demo mode that never writes to the configured real vault by default

## Quick start on Windows

```powershell
Copy-Item .env.example backend\.env
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

In another PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Demo mode is enabled in `.env.example`, so the complete flow works without API calls and exports into `backend/demo-vault/`.

To use real APIs, set `DEMO_MODE=false`, add `Z_AI_API_KEY`, `LLM_API_KEY`, and an absolute `VAULT_PATH`. Never commit `backend/.env`.

The graph indexes `OmniScribe` by default. Add comma-separated relative folders with `VAULT_GRAPH_ROOTS`; use `.` only if indexing the entire vault is intentional. If the Obsidian vault root is the `OmniScribe` folder itself, set `VAULT_PATH` to that folder and `VAULT_GRAPH_ROOTS=.`; exports then use `Inbox/`, `Topics/`, `Categories/`, and `Attachments/` directly without creating a nested `OmniScribe/OmniScribe` directory. Existing handwritten notes are never changed automatically. Preview or apply the category-link migration with:

```powershell
python backend/scripts/migrate_category_links.py --dry-run
python backend/scripts/migrate_category_links.py --apply
```

## Verification

```powershell
cd backend
python -m unittest discover -s tests -v

cd ..\frontend
npm run lint
npm test
npm run build
```

See [SETUP.md](SETUP.md) for configuration, [ARCHITECTURE.md](ARCHITECTURE.md) for the data flow, and [PLAN.md](PLAN.md) for scope.

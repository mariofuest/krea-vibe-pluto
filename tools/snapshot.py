#!/usr/bin/env python3
"""Legt den aktuellen Stand des Spiels als spielbare Version in history/ ab, mit Prompt und Zeiten.

    python3 tools/snapshot.py --prompt-file prompt.txt --start 2026-11-26T21:51:35+01:00
    python3 tools/snapshot.py --prompt "Mach den Helden schneller" --start ... --end ...
    python3 tools/snapshot.py --source /pfad/zu/altem/stand --prompt "(Vorlage)" ...

Erzeugt history/vNNN/ (Kopie von index.html, style.css, js/, game.json, assets/, lib/)
und ergänzt history/history.json. Die Übersicht history/index.html liest diese Datei.
"""
import argparse, json, shutil
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HIST = ROOT / "history"
PARTS = ["index.html", "style.css", "game.json", "js", "assets", "lib"]

ap = argparse.ArgumentParser()
ap.add_argument("--prompt"); ap.add_argument("--prompt-file")
ap.add_argument("--start", required=True, help="Zeitpunkt des Prompts (ISO 8601)")
ap.add_argument("--end", help="Zeitpunkt, an dem der Stand fertig war (Standard: jetzt)")
ap.add_argument("--agent", default="", help="z. B. 'Claude Code (Claude Opus 5.5)'")
ap.add_argument("--note", default="", help="kurze Zusammenfassung, was sich geändert hat")
ap.add_argument("--source", default=str(ROOT), help="Ordner mit dem Spielstand (Standard: Repo)")
a = ap.parse_args()

prompt = Path(a.prompt_file).read_text(encoding="utf-8").strip() if a.prompt_file else (a.prompt or "").strip()
start = datetime.fromisoformat(a.start)
end = datetime.fromisoformat(a.end) if a.end else datetime.now().astimezone()
hfile = HIST / "history.json"
history = json.loads(hfile.read_text(encoding="utf-8")) if hfile.exists() else []
n = (max(e["v"] for e in history) + 1) if history else 0
dest = HIST / f"v{n:03d}"
dest.mkdir(parents=True)
src = Path(a.source)
for p in PARTS:
    s = src / p
    if s.is_dir():
        shutil.copytree(s, dest / p)
    elif s.is_file():
        shutil.copy2(s, dest / p)
idx = dest / "index.html"
if idx.exists():  # Link auf die Versionsübersicht in der Kopie umbiegen
    idx.write_text(idx.read_text(encoding="utf-8").replace('href="history/"', 'href="../"'), encoding="utf-8")
history.append({"v": n, "prompt": prompt, "start": start.isoformat(), "end": end.isoformat(),
                "seconds": int((end - start).total_seconds()), "agent": a.agent, "note": a.note})
hfile.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Version {n} abgelegt in {dest.relative_to(ROOT)} ({history[-1]['seconds'] // 60} Min.)")

"""Captura las pantallas del frontend en Chrome real, en claro y oscuro.

Uso:
    python tools/screenshots.py [--only <ruta>] [--theme light|dark|both]

Requiere el frontend en http://127.0.0.1:3000 y el backend en :8000.
Las imágenes quedan en `data/screenshots/` para revisarlas a ojo.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import urllib.request
from pathlib import Path

CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = 9341
APP = "http://127.0.0.1:3000"
BACKEND = "http://127.0.0.1:8000"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "screenshots"
PROFILE = Path(os.environ.get("TEMP", ".")) / "ia_doblaje_shots"

# Cuenta con proyecto completo y subtítulos en varios idiomas.
EMAIL = os.environ.get("IA_E2E_EMAIL", "e2emulti1791304689@e.co")
PASSWORD = os.environ.get("IA_E2E_PASSWORD", "password123")

DESKTOP = (1440, int(os.environ.get("IA_SHOT_HEIGHT", "900")))
TABLET = (834, 1112)
MOBILE = (390, 844)


def project_with_cues() -> str | None:
    # El proyecto se puede fijar por entorno: con la base en PostgreSQL ya no
    # hay SQLite local donde buscarlo.
    explicit = os.environ.get("IA_SHOT_PROJECT", "").strip()
    if explicit:
        return explicit
    db = ROOT.parent / "IA-Doblaje" / "data" / "app.sqlite"
    if not db.is_file():
        return None
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            """
            SELECT p.id FROM projects p JOIN users u ON u.id = p.user_id
            WHERE u.email = ?
            ORDER BY (SELECT COUNT(*) FROM subtitles s WHERE s.project_id = p.id) DESC,
                     p.created_at DESC LIMIT 1
            """,
            (EMAIL,),
        ).fetchone()
        return str(row["id"]) if row else None
    finally:
        conn.close()


class Cdp:
    def __init__(self, socket) -> None:
        self.socket = socket
        self.next_id = 0

    async def call(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        message_id = self.next_id
        payload = json.dumps({"id": message_id, "method": method, "params": params or {}})
        for attempt in range(3):
            try:
                await self.socket.send(payload)
                while True:
                    raw = json.loads(await asyncio.wait_for(self.socket.recv(), timeout=120))
                    if raw.get("id") == message_id:
                        if "error" in raw:
                            raise RuntimeError(f"{method}: {raw['error']}")
                        return raw.get("result", {})
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        return {}

    async def evaluate(self, expression: str):
        result = await self.call(
            "Runtime.evaluate",
            {"expression": expression, "awaitPromise": True, "returnByValue": True},
        )
        return result.get("result", {}).get("value")


async def capture(cdp: Cdp, path: str, name: str, size: tuple[int, int], theme: str) -> Path:
    width, height = size
    await cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 500},
    )
    await cdp.call(
        "Emulation.setEmulatedMedia",
        {"features": [{"name": "prefers-color-scheme", "value": theme}]},
    )
    await cdp.evaluate(f"window.location.href = {json.dumps(APP + path)}")
    await asyncio.sleep(3.2)
    # Espera a que no haya spinners y a que terminen las peticiones en curso.
    for _ in range(12):
        busy = await cdp.evaluate(
            "document.querySelectorAll('[role=progressbar],.animate-ping,.animate-spin').length"
        )
        if not busy:
            break
        await asyncio.sleep(0.8)
    await asyncio.sleep(0.6)
    # En headless, un vídeo pausado en el primer frame no se pinta: se arranca
    # la reproducción (y se pausa) para que la captura muestre la imagen.
    await cdp.evaluate(
        "(async () => { const v = document.querySelector('video');"
        " if (!v) return; try { await v.play(); } catch (e) {}"
        " await new Promise(r => setTimeout(r, 1200)); try { v.pause(); } catch (e) {} })()"
    )
    await asyncio.sleep(0.5)
    shot = await cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{name}-{theme}-{width}.png"
    target.write_bytes(base64.b64decode(shot["data"]))
    print(f"  {target.name}")
    return target


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--theme", default="both", choices=["light", "dark", "both"])
    parser.add_argument("--sizes", default="desktop", choices=["desktop", "all"])
    args = parser.parse_args()

    project_id = project_with_cues()

    routes: list[tuple[str, str]] = [
        ("home", "/"),
        ("login", "/login"),
        ("register", "/register"),
        ("projects", "/projects"),
        ("new", "/projects/new"),
        ("account", "/account"),
    ]
    if project_id:
        routes.insert(5, ("studio", f"/projects/{project_id}"))

    if args.only:
        routes = [r for r in routes if r[0] == args.only]

    themes = ["light", "dark"] if args.theme == "both" else [args.theme]
    sizes = [DESKTOP, TABLET, MOBILE] if args.sizes == "all" else [DESKTOP]

    if PROFILE.exists():
        shutil.rmtree(PROFILE, ignore_errors=True)
    PROFILE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    process = subprocess.Popen(
        [
            str(CHROME),
            "--headless=new",
            f"--remote-debugging-port={PORT}",
            f"--user-data-dir={PROFILE}",
            "--no-first-run",
            "--no-default-browser-check",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        target = None
        for _ in range(50):
            await asyncio.sleep(0.4)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=3) as response:
                    pages = json.load(response)
                target = next((p for p in pages if p.get("type") == "page"), None)
                if target:
                    break
            except Exception:
                continue
        if target is None:
            print("No se pudo conectar a Chrome")
            return 2

        import websockets

        socket = await websockets.connect(target["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)
        cdp = Cdp(socket)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Network.enable")

        # Sesión contra el backend desde el propio origen de la app.
        await cdp.evaluate(f"window.location.href = {json.dumps(APP + '/login')}")
        await asyncio.sleep(3)
        status = await cdp.evaluate(
            f"""
            (async () => {{
              try {{
                const r = await fetch('/api/auth/login', {{
                  method: 'POST',
                  headers: {{ 'Content-Type': 'application/json' }},
                  body: JSON.stringify({{ email: {json.dumps(EMAIL)}, password: {json.dumps(PASSWORD)} }})
                }});
                return r.status;
              }} catch (e) {{ return 'error: ' + e.message; }}
            }})()
            """
        )
        print(f"Sesión: {status} ({EMAIL})")
        if status != 200:
            print("Aviso: sin sesión, las pantallas privadas mostrarán el estado de invitado.")

        print(f"\nCapturando {len(routes)} rutas × {len(themes)} tema(s) × {len(sizes)} tamaño(s):")
        for name, path in routes:
            for size in sizes:
                for theme in themes:
                    await capture(cdp, path, name, size, theme)

        await socket.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
        shutil.rmtree(PROFILE, ignore_errors=True)

    print(f"\nCapturas en {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

"""Comprueba el estilo real de elementos concretos (cursiva, contraste, tamaños)."""
import asyncio
import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = 9351
APP = "http://127.0.0.1:3000"
PROFILE = Path(os.environ.get("TEMP", ".")) / "ia_audit_chrome"


async def main() -> int:
    if PROFILE.exists():
        shutil.rmtree(PROFILE, ignore_errors=True)
    PROFILE.mkdir(parents=True, exist_ok=True)
    process = subprocess.Popen(
        [
            str(CHROME), "--headless=new", f"--remote-debugging-port={PORT}",
            f"--user-data-dir={PROFILE}", "--no-first-run", "--window-size=1440,900",
            "--hide-scrollbars", "about:blank",
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        target = None
        for _ in range(50):
            await asyncio.sleep(0.4)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=3) as r:
                    pages = json.load(r)
                target = next((p for p in pages if p.get("type") == "page"), None)
                if target:
                    break
            except Exception:
                continue
        if target is None:
            print("sin Chrome")
            return 2

        import websockets

        ws = await websockets.connect(target["webSocketDebuggerUrl"], max_size=1 << 24)
        counter = {"id": 0}

        async def call(method, params=None):
            counter["id"] += 1
            mid = counter["id"]
            await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
            while True:
                raw = json.loads(await asyncio.wait_for(ws.recv(), timeout=60))
                if raw.get("id") == mid:
                    return raw.get("result", {})

        async def js(expression):
            result = await call("Runtime.evaluate", {
                "expression": expression, "awaitPromise": True, "returnByValue": True,
            })
            return result.get("result", {}).get("value")

        await call("Runtime.enable")
        await js(f"window.location.href = {json.dumps(APP + '/login')}")
        await asyncio.sleep(3)
        await js(
            "(async () => { await fetch('/api/auth/login', {method:'POST',"
            " headers:{'Content-Type':'application/json'},"
            " body: JSON.stringify({email:'e2emulti1791304689@e.co',password:'password123'})}); })()"
        )

        project = os.environ.get("IA_PROJECT", "")
        await js(f"window.location.href = {json.dumps(APP + '/projects/' + project)}")
        await asyncio.sleep(6)

        print("=== Estilo del título del proyecto ===")
        print(await js("""
        (() => {
          const h1 = document.querySelector('h1');
          if (!h1) return 'sin h1';
          const s = getComputedStyle(h1);
          return {
            text: h1.textContent, fontStyle: s.fontStyle, fontFamily: s.fontFamily.split(',')[0],
            fontWeight: s.fontWeight, fontSize: s.fontSize, letterSpacing: s.letterSpacing,
            transform: s.transform
          };
        })()
        """))

        print("\n=== Contraste real de textos clave (ratio WCAG) ===")
        print(await js("""
        (() => {
          function lum(c) {
            const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v => {
              v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
            });
            return 0.2126*r + 0.7152*g + 0.0722*b;
          }
          function bgOf(el) {
            let node = el;
            while (node) {
              const bg = getComputedStyle(node).backgroundColor;
              if (bg && !bg.includes('rgba(0, 0, 0, 0)')) return bg;
              node = node.parentElement;
            }
            return 'rgb(255,255,255)';
          }
          function ratio(a, b) {
            const [l1, l2] = [lum(a), lum(b)].sort((x,y) => y-x);
            return Math.round(((l1+0.05)/(l2+0.05)) * 100) / 100;
          }
          const out = [];
          for (const sel of ['h1','p.text-muted','[class*="text-subtle"]','[class*="text-ink-2"]']) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const s = getComputedStyle(el);
            out.push({ sel, fg: s.color, bg: bgOf(el), ratio: ratio(s.color, bgOf(el)), size: s.fontSize });
          }
          return out;
        })()
        """))

        print("\n=== Elementos que desbordan horizontalmente ===")
        print(await js("""
        (() => {
          const docW = document.documentElement.clientWidth;
          const bad = [];
          for (const el of document.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > docW + 1 || r.left < -1)) {
              bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70),
                         left: Math.round(r.left), right: Math.round(r.right) });
              if (bad.length >= 8) break;
            }
          }
          return { docWidth: docW, count: bad.length, items: bad };
        })()
        """))

        await ws.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
        shutil.rmtree(PROFILE, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

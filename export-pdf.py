#!/usr/bin/env python3
"""Export the deck to a PDF backup at the deck's real aspect ratio.

Chrome's `--print-to-pdf` flag has no paper-size option, so it falls back to
US Letter portrait and clips a 1600x900 slide — 18 slides came out as 10
mangled pages. Page.printToPDF over the DevTools Protocol does take an
explicit size, which is what this script uses.

Usage:  python3 export-pdf.py [input.html] [output.pdf]
"""

import asyncio
import base64
import json
import pathlib
import subprocess
import sys
import time
import urllib.request

import websockets

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9222

# Reveal is configured 1600x900; CSS pixels are 96 to the inch.
PAPER_W = 1600 / 96
PAPER_H = 900 / 96


def wait_for_devtools(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version") as r:
                return json.load(r)["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("Chrome DevTools never came up")


async def render(browser_ws, url, out_path):
    async with websockets.connect(browser_ws, max_size=None) as ws:
        async def call(method, params=None, session=None):
            call.n += 1
            msg = {"id": call.n, "method": method, "params": params or {}}
            if session:
                msg["sessionId"] = session
            await ws.send(json.dumps(msg))
            while True:
                reply = json.loads(await ws.recv())
                if reply.get("id") == call.n:
                    if "error" in reply:
                        raise RuntimeError(reply["error"])
                    return reply.get("result", {})
        call.n = 0

        target = await call("Target.createTarget", {"url": "about:blank"})
        attached = await call(
            "Target.attachToTarget",
            {"targetId": target["targetId"], "flatten": True},
        )
        sid = attached["sessionId"]

        await call("Page.enable", session=sid)
        await call("Page.navigate", {"url": url}, session=sid)

        # Reveal builds the print layout on load; give the charts and the four
        # mermaid re-renders time to settle before capturing.
        await asyncio.sleep(20)

        result = await call(
            "Page.printToPDF",
            {
                "printBackground": True,
                "paperWidth": PAPER_W,
                "paperHeight": PAPER_H,
                "marginTop": 0, "marginBottom": 0,
                "marginLeft": 0, "marginRight": 0,
                "preferCSSPageSize": True,
            },
            session=sid,
        )
        pathlib.Path(out_path).write_bytes(base64.b64decode(result["data"]))


def main():
    src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "ticker.html").resolve()
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "ticker.pdf").resolve()
    if not src.exists():
        sys.exit(f"{src} not found — run `quarto render ticker.qmd` first")

    chrome = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu",
         f"--remote-debugging-port={PORT}",
         "--user-data-dir=/tmp/ticker-pdf-profile",
         "--no-first-run", "--no-default-browser-check"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        ws_url = wait_for_devtools()
        asyncio.run(render(ws_url, f"file://{src}?print-pdf", out))
    finally:
        chrome.terminate()
        chrome.wait(timeout=10)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

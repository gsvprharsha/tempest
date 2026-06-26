import { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";

// Maximum simultaneous WebGL contexts. Chromium/WebView2 caps at ~16; staying at 6
// leaves headroom for DevTools and other pages and ensures visible panes always get GPU rendering.
const POOL_SIZE = 6;

class WebGLPool {
  private active = new Map<string, WebglAddon>();

  acquire(term: Terminal, sessionId: string): void {
    if (this.active.has(sessionId)) return;
    if (this.active.size >= POOL_SIZE) return; // graceful degradation to canvas renderer
    try {
      const addon = new WebglAddon();
      // Context loss: dispose and remove from pool. The terminal falls back to canvas
      // automatically; no freeze, no silent permanent degradation.
      addon.onContextLoss(() => this.release(sessionId));
      term.loadAddon(addon);
      this.active.set(sessionId, addon);
    } catch {
      // WebGL unavailable on this system — canvas renderer is used automatically.
    }
  }

  release(sessionId: string): void {
    const addon = this.active.get(sessionId);
    if (!addon) return;
    try { addon.dispose(); } catch { /* ignore — may already be disposed on context loss */ }
    this.active.delete(sessionId);
  }
}

export const webglPool = new WebGLPool();

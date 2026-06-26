import { Channel } from "@tauri-apps/api/core";
import { getWorkState, setWorkState } from "./workState";

// How long (ms) with no PTY output before a working agent is considered done.
const QUIET_MS = 4000;
// Window (ms) after user presses Enter during which "done" signals are suppressed.
const DEAD_ZONE_MS = 300;
// Maximum bytes to keep in each session's replay buffer.
const BUFFER_MAX_BYTES = 2 * 1024 * 1024;

interface SessionRecord {
  isAgent: boolean;
  onDone: (() => void) | null;
  onChunk: ((data: string) => void) | null;
  buffer: string[];
  bufferBytes: number;
  quietTimer: ReturnType<typeof setTimeout> | null;
  deadZoneUntil: number;
  listeners: Set<(data: string) => void>;
}

class SessionManager {
  private sessions = new Map<string, SessionRecord>();

  register(
    sessionId: string,
    channel: Channel<{ session_id: string; data: string }>,
    isAgent: boolean,
    onDone?: () => void,
    onChunk?: (data: string) => void,
  ) {
    const record: SessionRecord = {
      isAgent,
      onDone: onDone ?? null,
      onChunk: onChunk ?? null,
      buffer: [],
      bufferBytes: 0,
      quietTimer: null,
      deadZoneUntil: 0,
      listeners: new Set(),
    };
    this.sessions.set(sessionId, record);
    channel.onmessage = (payload) => this.processChunk(sessionId, payload.data);
  }

  unregister(sessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    if (record.quietTimer !== null) clearTimeout(record.quietTimer);
    this.sessions.delete(sessionId);
  }

  // Called by TerminalPane on mount. Returns the buffered chunks to write for replay.
  attach(sessionId: string, onData: (data: string) => void): string[] {
    const record = this.sessions.get(sessionId);
    if (!record) return [];
    record.listeners.add(onData);
    return [...record.buffer];
  }

  // Called by TerminalPane on unmount.
  detach(sessionId: string, onData: (data: string) => void) {
    this.sessions.get(sessionId)?.listeners.delete(onData);
  }

  // Called by TerminalPane when the user presses Enter — arms work-done timer.
  markUserInput(sessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record?.isAgent) return;
    record.deadZoneUntil = Date.now() + DEAD_ZONE_MS;
    setWorkState(sessionId, "working");
    this.scheduleQuiet(record, sessionId);
  }

  // Update the per-chunk capture callback (for opencode session ID sniffing).
  setOnChunk(sessionId: string, onChunk: ((data: string) => void) | null) {
    const record = this.sessions.get(sessionId);
    if (record) record.onChunk = onChunk;
  }

  private processChunk(sessionId: string, data: string) {
    const record = this.sessions.get(sessionId);
    if (!record) return;

    // Append to ring buffer, evicting old chunks from the front when over limit.
    record.buffer.push(data);
    record.bufferBytes += data.length;
    while (record.bufferBytes > BUFFER_MAX_BYTES && record.buffer.length > 1) {
      record.bufferBytes -= record.buffer.shift()!.length;
    }

    // Optional capture callback (e.g. opencode session ID extraction).
    record.onChunk?.(data);

    // Work-done detection runs on raw bytes — no xterm dependency.
    if (record.isAgent) {
      if (data.includes("\x1b]9;")) {
        this.markDone(record, sessionId);
      } else if (getWorkState(sessionId) === "working") {
        this.scheduleQuiet(record, sessionId);
      }
    }

    // Deliver to all attached renderers (visible panes).
    for (const listener of record.listeners) {
      listener(data);
    }
  }

  private markDone(record: SessionRecord, sessionId: string) {
    if (record.quietTimer !== null) {
      clearTimeout(record.quietTimer);
      record.quietTimer = null;
    }
    if (Date.now() < record.deadZoneUntil) return;
    if (getWorkState(sessionId) === "working") {
      setWorkState(sessionId, "done");
      record.onDone?.();
    }
  }

  private scheduleQuiet(record: SessionRecord, sessionId: string) {
    if (record.quietTimer !== null) clearTimeout(record.quietTimer);
    record.quietTimer = setTimeout(() => {
      record.quietTimer = null;
      this.markDone(record, sessionId);
    }, QUIET_MS);
  }
}

export const sessionManager = new SessionManager();

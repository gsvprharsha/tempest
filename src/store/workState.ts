import { useSyncExternalStore } from "react";

// Ephemeral per-session "work done" detection state.
// Not persisted — it only reflects live agent activity and resets on app restart.
export type WorkState = "idle" | "working" | "done";

const states = new Map<string, WorkState>();
// Per-session listeners so a single session's change only re-renders that
// session's badge, instead of every subscriber (O(N) per chunk, not O(N²)).
const sessionListeners = new Map<string, Set<() => void>>();
const versionListeners = new Set<() => void>();
let version = 0;

function emit(sessionId: string) {
  version++;
  const subs = sessionListeners.get(sessionId);
  if (subs) for (const fn of subs) fn();
  for (const fn of versionListeners) fn();
}

function subscribeSession(sessionId: string, fn: () => void): () => void {
  let subs = sessionListeners.get(sessionId);
  if (!subs) {
    subs = new Set();
    sessionListeners.set(sessionId, subs);
  }
  subs.add(fn);
  return () => {
    subs!.delete(fn);
    if (subs!.size === 0) sessionListeners.delete(sessionId);
  };
}

function subscribeVersion(fn: () => void): () => void {
  versionListeners.add(fn);
  return () => {
    versionListeners.delete(fn);
  };
}

export function getWorkState(sessionId: string): WorkState {
  return states.get(sessionId) ?? "idle";
}

export function setWorkState(sessionId: string, state: WorkState): void {
  if (getWorkState(sessionId) === state) return;
  if (state === "idle") {
    states.delete(sessionId);
  } else {
    states.set(sessionId, state);
  }
  emit(sessionId);
}

export function clearWorkState(sessionId: string): void {
  if (states.delete(sessionId)) emit(sessionId);
}

// Subscribe a component to a single session's work state.
export function useWorkState(sessionId: string): WorkState {
  return useSyncExternalStore(
    (fn) => subscribeSession(sessionId, fn),
    () => getWorkState(sessionId),
    () => getWorkState(sessionId)
  );
}

// Subscribe to any work state change and return an ever-incrementing version.
// Use in components that need to re-sort or re-count across all sessions.
export function useWorkStateVersion(): number {
  return useSyncExternalStore(subscribeVersion, () => version, () => version);
}

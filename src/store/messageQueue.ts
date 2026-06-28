import { useSyncExternalStore } from "react";

export interface QueueItem {
  id: string;
  text: string;
}

const queues = new Map<string, QueueItem[]>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: QueueItem[] = [];

function emit(sessionId: string) {
  const subs = listeners.get(sessionId);
  if (subs) for (const fn of subs) fn();
}

function subscribe(sessionId: string, fn: () => void): () => void {
  let subs = listeners.get(sessionId);
  if (!subs) { subs = new Set(); listeners.set(sessionId, subs); }
  subs.add(fn);
  return () => {
    subs!.delete(fn);
    if (subs!.size === 0) listeners.delete(sessionId);
  };
}

export function enqueue(sessionId: string, text: string): void {
  const q = queues.get(sessionId) ?? [];
  q.push({ id: crypto.randomUUID(), text });
  queues.set(sessionId, q);
  emit(sessionId);
}

export function dequeue(sessionId: string): QueueItem | undefined {
  const q = queues.get(sessionId);
  if (!q?.length) return undefined;
  const item = q.shift()!;
  if (q.length === 0) queues.delete(sessionId);
  emit(sessionId);
  return item;
}

export function removeFromQueue(sessionId: string, itemId: string): void {
  const q = queues.get(sessionId);
  if (!q) return;
  const idx = q.findIndex((i) => i.id === itemId);
  if (idx !== -1) { q.splice(idx, 1); emit(sessionId); }
}

export function clearQueue(sessionId: string): void {
  if (queues.delete(sessionId)) emit(sessionId);
}

export function getQueue(sessionId: string): QueueItem[] {
  return queues.get(sessionId) ?? EMPTY;
}

export function useQueue(sessionId: string): QueueItem[] {
  return useSyncExternalStore(
    (fn) => subscribe(sessionId, fn),
    () => getQueue(sessionId),
    () => getQueue(sessionId),
  );
}

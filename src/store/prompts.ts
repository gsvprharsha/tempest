import { useState, useEffect } from "react";
import { getRuntimeState, setRuntimeState } from "../lib/runtimeState";

export interface PromptEntry {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  isBuiltin: boolean;
}

export const BUILTIN_PROMPTS: PromptEntry[] = [
  {
    id: "builtin-review",
    isBuiltin: true,
    enabled: true,
    title: "Review",
    body: "Review the changes in this workspace. Identify bugs, edge cases, and areas for improvement. Be specific and actionable.",
  },
  {
    id: "builtin-tests",
    isBuiltin: true,
    enabled: true,
    title: "Write tests",
    body: "Write comprehensive tests for the changes in this workspace. Cover happy paths, edge cases, and failure modes. Follow existing test patterns.",
  },
  {
    id: "builtin-security",
    isBuiltin: true,
    enabled: true,
    title: "Security review",
    body: "Perform a security review of the changes. Look for injection vulnerabilities, authentication issues, secrets in code, and OWASP Top 10 risks.",
  },
  {
    id: "builtin-explain",
    isBuiltin: true,
    enabled: true,
    title: "Explain the changes",
    body: "Summarize what changed in this workspace — what was added, removed, or modified — and explain the reasoning behind each change.",
  },
  {
    id: "builtin-commit",
    isBuiltin: true,
    enabled: true,
    title: "Commit message",
    body: "Generate a concise conventional commit message for the changes in this workspace. Format: <type>(<scope>): <subject>.",
  },
];

const BUILTIN_MAP = new Map(BUILTIN_PROMPTS.map((p) => [p.id, p]));
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((l) => l());
}

function _load(): PromptEntry[] {
  const stored = getRuntimeState().prompts;
  if (!stored || stored.length === 0) {
    return BUILTIN_PROMPTS.map((p) => ({ ...p }));
  }
  // Append any new builtins added in a later app version
  const storedIds = new Set(stored.map((p) => p.id));
  const result = [...stored] as PromptEntry[];
  for (const def of BUILTIN_PROMPTS) {
    if (!storedIds.has(def.id)) result.push({ ...def });
  }
  return result;
}

function _save(prompts: PromptEntry[]): void {
  setRuntimeState({ prompts });
  _notify();
}

export function getPrompts(): PromptEntry[] {
  return _load();
}

export function usePrompts(): PromptEntry[] {
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  }, []);
  return _load();
}

export function addPrompt(title: string, body: string): void {
  const prompts = _load();
  prompts.push({
    id: `custom-${crypto.randomUUID()}`,
    title,
    body,
    enabled: true,
    isBuiltin: false,
  });
  _save(prompts);
}

export function updatePrompt(
  id: string,
  patch: Partial<Pick<PromptEntry, "title" | "body" | "enabled">>
): void {
  const prompts = _load();
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx === -1) return;
  prompts[idx] = { ...prompts[idx], ...patch };
  _save(prompts);
}

export function deletePrompt(id: string): void {
  const prompts = _load();
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx === -1) return;
  if (prompts[idx].isBuiltin) {
    prompts[idx] = { ...prompts[idx], enabled: false };
  } else {
    prompts.splice(idx, 1);
  }
  _save(prompts);
}

export function resetPrompt(id: string): void {
  const def = BUILTIN_MAP.get(id);
  if (!def) return;
  const prompts = _load();
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx !== -1) prompts[idx] = { ...def };
  _save(prompts);
}

export function clonePrompt(id: string): void {
  const prompts = _load();
  const src = prompts.find((p) => p.id === id);
  if (!src) return;
  prompts.push({
    id: `custom-${crypto.randomUUID()}`,
    title: `${src.title} (copy)`,
    body: src.body,
    enabled: true,
    isBuiltin: false,
  });
  _save(prompts);
}

export function reorderPrompts(fromId: string, toId: string, side: "before" | "after"): void {
  const prompts = _load();
  const fromIdx = prompts.findIndex((p) => p.id === fromId);
  if (fromIdx === -1) return;
  const [item] = prompts.splice(fromIdx, 1);
  const toIdx = prompts.findIndex((p) => p.id === toId);
  if (toIdx === -1) {
    prompts.push(item);
  } else {
    prompts.splice(side === "before" ? toIdx : toIdx + 1, 0, item);
  }
  _save(prompts);
}

export function isBuiltinModified(prompt: PromptEntry): boolean {
  if (!prompt.isBuiltin) return false;
  const def = BUILTIN_MAP.get(prompt.id);
  return !!def && (prompt.body !== def.body || prompt.title !== def.title);
}

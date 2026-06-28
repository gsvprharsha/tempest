import { useRef, useState, useEffect } from "react";
import { X, ListOrdered } from "lucide-react";
import { useQueue, enqueue, removeFromQueue, clearQueue } from "../store/messageQueue";
import "./QueuePanel.css";

interface Props {
  sessionId: string;
  onClose: () => void;
}

export function QueuePanel({ sessionId, onClose }: Props) {
  const queue = useQueue(sessionId);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    enqueue(sessionId, text);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="qp-panel">
      <div className="qp-header">
        <ListOrdered size={13} className="qp-header-icon" />
        <span className="qp-title">Message Queue</span>
        {queue.length > 0 && (
          <button className="qp-clear" onClick={() => clearQueue(sessionId)}>
            Clear all
          </button>
        )}
        <button className="qp-close" onClick={onClose} aria-label="Close queue">
          <X size={12} />
        </button>
      </div>

      {queue.length > 0 && (
        <ol className="qp-list">
          {queue.map((item, i) => (
            <li key={item.id} className="qp-item">
              <span className="qp-item-index">{i + 1}</span>
              <span className="qp-item-text">{item.text}</span>
              <button
                className="qp-item-remove"
                onClick={() => removeFromQueue(sessionId, item.id)}
                aria-label="Remove"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {queue.length === 0 && (
        <p className="qp-empty">No messages queued. The next message you add will be sent automatically when the agent finishes.</p>
      )}

      <div className="qp-compose">
        <textarea
          ref={inputRef}
          className="qp-input"
          placeholder="Next message for the agent…"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            e.stopPropagation();
          }}
        />
        <div className="qp-compose-footer">
          <span className="qp-hint">Enter to queue · Shift+Enter for newline · Esc to close</span>
          <button className="qp-queue-btn" disabled={!draft.trim()} onClick={submit}>
            Queue
          </button>
        </div>
      </div>
    </div>
  );
}

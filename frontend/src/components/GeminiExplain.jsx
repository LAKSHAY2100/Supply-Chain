import React from "react";
import { useStore } from "../store/useStore.js";

export default function GeminiExplain() {
  const recommendation = useStore((s) => s.recommendation);
  const decision = useStore((s) => s.decision);
  const impact = useStore((s) => s.impact);
  const messages = useStore((s) => s.assistantMessages);
  const prompts = useStore((s) => s.assistantPrompts);
  const askAssistant = useStore((s) => s.askAssistant);
  const loading = useStore((s) => s.loadingAssistant);
  const cap = useStore((s) => s.capabilities);
  const [input, setInput] = React.useState("");

  const submit = async (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    await askAssistant(q);
  };

  return (
    <div className="cg-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="cg-title text-sm font-semibold">Gemini copilot</h3>
        <span className="cg-badge cg-muted">
          {cap?.gemini ? "Gemini live" : "Template fallback"}
        </span>
      </div>

      {recommendation ? (
        <div className="rounded border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-3 text-xs leading-relaxed text-slate-700">
          <p className="cg-muted mb-1 text-[10px] uppercase tracking-wider">Latest decision summary</p>
          {recommendation}
        </div>
      ) : (
        <p className="cg-muted text-xs">Optimise a route and then use this panel to ask follow-up questions.</p>
      )}

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-xl border px-3 py-2 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-8 border-sky-200 bg-sky-50 text-sky-900"
                : "mr-4 border-[var(--cg-border)] bg-white text-slate-700"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider">
              <span className="cg-muted">{message.role === "user" ? "You" : "ChainGuard AI"}</span>
              {message.source ? <span className="cg-muted">{message.source}</span> : null}
            </div>
            <div className="whitespace-pre-line">{message.text}</div>
          </div>
        ))}
        {loading ? (
          <div className="mr-4 rounded-xl border border-[var(--cg-border)] bg-white px-3 py-2 text-sm text-slate-600">
            Generating response...
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(prompts || []).map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => askAssistant(prompt)}
            className="rounded-full border border-[var(--cg-border)] bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-[var(--cg-border)] pt-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Ask about the route, disruption impact, quality model, Google stack, or deployment..."
          className="cg-input min-h-24 resize-y"
        />
        <button
          type="submit"
          disabled={loading}
          className="cg-btn-primary w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask Gemini copilot"}
        </button>
      </form>

      {impact && (
        <div className="border-t border-[var(--cg-border)] pt-4">
          <p className="cg-muted mb-2 text-[11px] uppercase tracking-wider">Cascade impact</p>
          <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
            <Mini label="Affected nodes" value={impact.affected_nodes.length} />
            <Mini label="Shipments" value={impact.affected_shipments} />
            <Mini label="USD exposure" value={`$${formatUSD(impact.economic_impact_usd)}`} />
          </div>
          <p className="rounded border border-[var(--cg-border)] bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            {impact.narrative}
          </p>
        </div>
      )}

      {decision ? (
        <div className="cg-muted text-[10px] uppercase tracking-wider">
          Action: <span className="text-slate-700">{decision}</span>
        </div>
      ) : null}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
      <p className="cg-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

function formatUSD(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return Number(n || 0).toFixed(0);
}

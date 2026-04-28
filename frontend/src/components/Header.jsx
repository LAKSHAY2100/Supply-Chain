import React from "react";
import { useStore } from "../store/useStore.js";

export default function Header() {
  const capabilities = useStore((s) => s.capabilities);
  const cap = capabilities || {};
  const dot = (on) => <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${on ? "bg-emerald-500" : "bg-slate-400"}`} />;

  return (
    <header className="cg-navbar">
      <div className="flex h-14 items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#426eff,#5b7dff)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
            <h1 className="cg-title text-base font-semibold tracking-tight">ChainGuard AI</h1>
            <p className="cg-muted text-[10px] uppercase tracking-wider">Perishable route intelligence</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="cg-badge cg-muted">{dot(cap.gemini)}Gemini</span>
          <span className="cg-badge cg-muted">{dot(cap.gmaps)}Maps</span>
          <span className="cg-badge cg-muted">{dot(cap.weather)}Weather</span>
          <span className="cg-badge cg-muted">{dot(cap.firestore)}Firestore</span>
        </div>
      </div>
    </header>
  );
}

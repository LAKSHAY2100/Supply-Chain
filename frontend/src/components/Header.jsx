import React from "react";
import { useStore } from "../store/useStore.js";

export default function Header() {
  const capabilities = useStore((s) => s.capabilities);
  const cap = capabilities || {};
  const dot = (on) => (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
        on ? "bg-primary-400" : "bg-slate-600"
      }`}
    />
  );
  return (
    <header className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">ChainGuard AI</h1>
          <p className="text-xs text-slate-400">
            Resilient Supply Chain Intelligence -- Perishable-Aware Decision Optimisation
          </p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
        <span title="Gemini Pro explanation">
          {dot(cap.gemini)}Gemini
        </span>
        <span title="Google Maps">
          {dot(cap.gmaps)}Maps
        </span>
        <span title="OpenWeatherMap">
          {dot(cap.weather)}Weather
        </span>
        <span title="Firestore persistence">
          {dot(cap.firestore)}Firestore
        </span>
      </div>
    </header>
  );
}

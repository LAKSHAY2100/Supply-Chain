import React, { useEffect } from "react";
import Header from "./components/Header.jsx";
import ShipmentForm from "./components/ShipmentForm.jsx";
import MapView from "./components/MapView.jsx";
import QualityChart from "./components/QualityChart.jsx";
import RiskPanel from "./components/RiskPanel.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";
import GeminiExplain from "./components/GeminiExplain.jsx";
import DisruptionButton from "./components/DisruptionButton.jsx";
import { useStore } from "./store/useStore.js";

export default function App() {
  const loadCapabilities = useStore((s) => s.loadCapabilities);
  const optimize = useStore((s) => s.optimize);
  const error = useStore((s) => s.error);

  useEffect(() => {
    (async () => {
      await loadCapabilities();
      await optimize();
    })();
  }, [loadCapabilities, optimize]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {error && (
        <div className="mx-6 mt-4 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <main className="flex-1 grid grid-cols-12 gap-5 p-6 max-w-[1600px] w-full mx-auto">
        <section className="col-span-12 lg:col-span-3 space-y-5">
          <ShipmentForm />
          <DisruptionButton />
          <RiskPanel />
        </section>

        <section className="col-span-12 lg:col-span-6 space-y-5">
          <MapView />
          <QualityChart />
        </section>

        <section className="col-span-12 lg:col-span-3 space-y-5">
          <DecisionPanel />
          <GeminiExplain />
        </section>
      </main>

      <footer className="px-6 py-3 text-center text-xs text-slate-500 border-t border-slate-800/40">
        ChainGuard AI -- Track -&gt; Analyse -&gt; Predict -&gt; Simulate -&gt; Decide -&gt; Explain
      </footer>
    </div>
  );
}

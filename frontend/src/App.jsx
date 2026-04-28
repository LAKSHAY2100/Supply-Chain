import React, { useEffect } from "react";
import Header from "./components/Header.jsx";
import ShipmentForm from "./components/ShipmentForm.jsx";
import MapView from "./components/MapView.jsx";
import QualityChart from "./components/QualityChart.jsx";
import RiskPanel from "./components/RiskPanel.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";
import GeminiExplain from "./components/GeminiExplain.jsx";
import DisruptionButton from "./components/DisruptionButton.jsx";
import RouteBuilder from "./components/RouteBuilder.jsx";
import StageGraphSection from "./components/StageGraphSection.jsx";
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
    <div className="cg-shell flex flex-col">
      <Header />

      {error && (
        <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <main className="flex-1 px-5 py-5">
        <div className="mx-auto max-w-[1600px] cg-grid">
          <section className="space-y-5">
            <MapView />
            <StageGraphSection />
            <QualityChart />
          </section>

          <aside className="space-y-5">
            <ShipmentForm />
            <RouteBuilder />
            <DisruptionButton />
            <RiskPanel />
            <DecisionPanel />
            <GeminiExplain />
          </aside>
        </div>
      </main>
    </div>
  );
}

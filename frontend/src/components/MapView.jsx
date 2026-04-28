import React from "react";
import { GoogleMap, LoadScript, Marker, Polyline } from "@react-google-maps/api";
import { useStore } from "../store/useStore.js";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

const containerStyle = { width: "100%", height: "100%", borderRadius: "16px" };
const center = { lat: 12, lng: 60 };

export default function MapView() {
  const primary = useStore((s) => s.primaryRoute);
  const alt = useStore((s) => s.alternativeRoute);

  const routes = [primary, alt].filter(Boolean);

  if (!MAPS_KEY) {
    return <FallbackMap routes={routes} />;
  }

  return (
    <div className="cg-card relative h-[420px] overflow-hidden">
      <LoadScript googleMapsApiKey={MAPS_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={3}
          options={{
            disableDefaultUI: true,
            styles: lightMapStyle,
            backgroundColor: "#eef3ff",
          }}
        >
          {routes.map((route, i) => (
            <React.Fragment key={route.name + i}>
              <Polyline
                path={route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))}
                options={{
                  strokeColor: i === 0 ? "#10b981" : "#64748b",
                  strokeOpacity: i === 0 ? 0.95 : 0.55,
                  strokeWeight: i === 0 ? 4 : 3,
                  geodesic: true,
                }}
              />
              {route.waypoints.map((wp) => (
                <Marker
                  key={wp.name + i}
                  position={{ lat: wp.lat, lng: wp.lng }}
                  title={wp.name}
                />
              ))}
            </React.Fragment>
          ))}
        </GoogleMap>
      </LoadScript>
      <Legend routes={routes} />
    </div>
  );
}

function Legend({ routes }) {
  if (!routes.length) return null;
  return (
    <div className="absolute bottom-3 left-3 space-y-1.5 rounded-lg border border-[var(--cg-border)] bg-white/95 px-3 py-2 text-xs">
      {routes.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2">
          <span
            className="inline-block h-1 w-6 rounded"
            style={{ background: i === 0 ? "#10b981" : "#64748b" }}
          />
          <span className={i === 0 ? "font-medium text-emerald-700" : "text-slate-600"}>
            {r.name}
          </span>
          <span className="cg-muted">{r.base_eta_hrs}h</span>
        </div>
      ))}
    </div>
  );
}

function FallbackMap({ routes }) {
  const project = (lat, lng) => {
    // Simple equirectangular projection over a [-10, 35] lat / [30, 90] lng box
    const x = ((lng - 30) / 60) * 100;
    const y = 100 - ((lat + 10) / 45) * 100;
    return [x, y];
  };
  return (
    <div className="cg-card relative h-[420px] overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="ocean" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f4f7ff" />
            <stop offset="100%" stopColor="#e8eefc" />
          </linearGradient>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(100,116,140,0.09)" strokeWidth="0.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#ocean)" />
        <rect width="100" height="100" fill="url(#grid)" />
        {/* land mass approximations */}
        <path d="M0,55 Q15,40 30,45 T60,55 Q70,52 80,48 L85,55 L80,75 L60,80 L40,85 L20,80 L0,75 Z" fill="rgba(166,183,219,0.7)" />
        <path d="M75,30 Q85,28 95,35 L100,55 L95,60 L80,55 Z" fill="rgba(166,183,219,0.7)" />

        {routes.map((route, i) => {
          const points = route.waypoints.map((wp) => project(wp.lat, wp.lng)).map((p) => p.join(",")).join(" ");
          return (
            <polyline
              key={route.name + i}
              points={points}
              fill="none"
              stroke={i === 0 ? "#1f9960" : "#64748b"}
              strokeWidth={i === 0 ? 0.8 : 0.5}
              strokeOpacity={i === 0 ? 1 : 0.6}
              strokeDasharray={i === 0 ? "" : "1.5 1.5"}
            />
          );
        })}

        {routes[0]?.waypoints.map((wp, i, arr) => {
          const [x, y] = project(wp.lat, wp.lng);
          const isEnd = i === 0 || i === arr.length - 1;
          return (
            <g key={wp.name + i}>
              <circle cx={x} cy={y} r={isEnd ? 1.4 : 1} fill={isEnd ? "#1f9960" : "#475569"} stroke="#f8fbff" strokeWidth="0.3" />
              <text x={x + 1.5} y={y - 0.8} fill="#334155" fontSize="2.2" fontFamily="Inter">
                {wp.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="cg-muted absolute right-3 top-3 rounded border border-[var(--cg-border)] bg-white/95 px-2 py-1 text-[11px]">
        SVG fallback (no Google Maps key set)
      </div>
      <Legend routes={routes} />
    </div>
  );
}

const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#ecf2ff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5e6d8e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f3f7ff" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#b9c6e8" }] },
  { featureType: "water", stylers: [{ color: "#dde9ff" }] },
  { featureType: "landscape", stylers: [{ color: "#eef3ff" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
];

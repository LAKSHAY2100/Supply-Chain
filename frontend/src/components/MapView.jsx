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
    <div className="glass overflow-hidden h-[420px] relative">
      <LoadScript googleMapsApiKey={MAPS_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={3}
          options={{
            disableDefaultUI: true,
            styles: darkMapStyle,
            backgroundColor: "#0b1120",
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
    <div className="absolute bottom-3 left-3 glass !rounded-lg px-3 py-2 text-xs space-y-1.5">
      {routes.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2">
          <span
            className="inline-block h-1 w-6 rounded"
            style={{ background: i === 0 ? "#10b981" : "#64748b" }}
          />
          <span className={i === 0 ? "text-primary-400 font-medium" : "text-slate-400"}>
            {r.name}
          </span>
          <span className="text-slate-500">{r.base_eta_hrs}h</span>
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
    <div className="glass h-[420px] relative overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="ocean" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="0.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#ocean)" />
        <rect width="100" height="100" fill="url(#grid)" />
        {/* land mass approximations */}
        <path d="M0,55 Q15,40 30,45 T60,55 Q70,52 80,48 L85,55 L80,75 L60,80 L40,85 L20,80 L0,75 Z" fill="rgba(30,41,59,0.6)" />
        <path d="M75,30 Q85,28 95,35 L100,55 L95,60 L80,55 Z" fill="rgba(30,41,59,0.6)" />

        {routes.map((route, i) => {
          const points = route.waypoints.map((wp) => project(wp.lat, wp.lng)).map((p) => p.join(",")).join(" ");
          return (
            <polyline
              key={route.name + i}
              points={points}
              fill="none"
              stroke={i === 0 ? "#10b981" : "#64748b"}
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
              <circle cx={x} cy={y} r={isEnd ? 1.4 : 1} fill={isEnd ? "#10b981" : "#cbd5e1"} stroke="#0b1120" strokeWidth="0.3" />
              <text x={x + 1.5} y={y - 0.8} fill="#cbd5e1" fontSize="2.2" fontFamily="Inter">
                {wp.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute top-3 right-3 text-[11px] text-slate-500 bg-slate-900/60 px-2 py-1 rounded">
        SVG fallback (no Google Maps key set)
      </div>
      <Legend routes={routes} />
    </div>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b1120" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1120" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", stylers: [{ color: "#020617" }] },
  { featureType: "landscape", stylers: [{ color: "#1e293b" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
];

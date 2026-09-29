import { Link } from "@tanstack/react-router";

import L from "leaflet";
import { Crosshair } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { Button } from "@/components/ui/button";
import type { BusinessWithMetrics } from "@/lib/data";
import { percent, STATUS_META, type CouponStatus } from "@/lib/coupon";

const STATUS_HEX: Record<CouponStatus, string> = {
  healthy: "#2f9e5e",
  soon: "#e6b62e",
  attention: "#e2802f",
  overdue: "#d0402c",
  never: "#8d8a83",
};

const iconCache = new Map<CouponStatus, L.DivIcon>();
function pinIcon(status: CouponStatus) {
  const cached = iconCache.get(status);
  if (cached) return cached;
  const color = STATUS_HEX[status];
  const icon = L.divIcon({
    className: "coupon-pin",
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
  iconCache.set(status, icon);
  return icon;
}

function LocateButton() {
  const map = useMap();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="absolute right-3 top-3 z-[500] gap-1.5 shadow-float"
      onClick={() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 14),
          () => undefined,
        );
      }}
    >
      <Crosshair className="size-4" aria-hidden="true" />
      My location
    </Button>
  );
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0]!, 13);
    else map.fitBounds(L.latLngBounds(points).pad(0.2));
  }, [map, points]);
  return null;
}

export default function BusinessMap({
  businesses,
  height = "70vh",
}: {
  businesses: BusinessWithMetrics[];
  height?: string;
}) {
  const pinned = useMemo(
    () => businesses.filter((b) => b.latitude !== null && b.longitude !== null),
    [businesses],
  );
  const points = useMemo(
    () => pinned.map((b) => [b.latitude as number, b.longitude as number] as [number, number]),
    [pinned],
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-border" style={{ height }}>
      <MapContainer
        center={points[0] ?? [52.1332, -106.67]}
        zoom={points.length ? 12 : 5}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <LocateButton />
        {pinned.map((b) => (
          <Marker
            key={b.id}
            position={[b.latitude as number, b.longitude as number]}
            icon={pinIcon(b.metrics.status)}
            eventHandlers={{
              mouseover: (e) => e.target.openPopup(),
              // Leaflet toggles on click; after a hover-open that would close it, so keep it open.
              click: (e) => setTimeout(() => e.target.openPopup(), 0),
            }}
            title={`${b.name} — ${STATUS_META[b.metrics.status].label}`}
          >
            <Popup maxWidth={240} minWidth={180} autoPanPadding={[16, 16]}>
              <div className="space-y-1">
                <p className="text-sm font-semibold leading-tight">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.address}</p>
                <p className="pt-1 text-xs">
                  Coupons handed out: <strong>{b.metrics.totalDistributed}</strong>
                </p>
                <p className="text-xs">
                  Turnover:{" "}
                  <strong>{b.metrics.hasEnoughData ? percent(b.metrics.percentUsed) : "Not enough data"}</strong>
                </p>
                <Link
                  to="/businesses/$businessId"
                  params={{ businessId: b.id }}
                  className="inline-block pt-1 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  More →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

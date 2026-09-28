import { Link } from "@tanstack/react-router";

import { RecordCouponsDialog } from "@/components/record-coupons";
import L from "leaflet";
import { Crosshair } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { Button } from "@/components/ui/button";
import type { BusinessWithMetrics } from "@/lib/data";
import { estimatedRemainingLabel, formatDate, STATUS_META, type CouponStatus } from "@/lib/coupon";

const STATUS_HEX: Record<CouponStatus, string> = {
  healthy: "#2f9e5e",
  soon: "#e6b62e",
  attention: "#e2802f",
  overdue: "#d0402c",
  never: "#8d8a83",
};

function pinIcon(status: CouponStatus) {
  const color = STATUS_HEX[status];
  return L.divIcon({
    className: "coupon-pin",
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
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
            title={`${b.name} — ${STATUS_META[b.metrics.status].label}`}
          >
            <Popup>
              <div className="min-w-52 space-y-1.5">
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.address}</p>
                {b.contact_name ? (
                  <p className="text-xs">
                    {b.contact_name}
                    {b.contact_phone ? ` · ${b.contact_phone}` : ""}
                  </p>
                ) : null}
                <p className="text-xs">
                  Status: <strong>{STATUS_META[b.metrics.status].label}</strong>
                </p>
                <p className="text-xs">{b.metrics.turnoverLabel}</p>
                <p className="text-xs">{estimatedRemainingLabel(b.metrics)}</p>
                <p className="text-xs text-muted-foreground">
                  Last distribution: {formatDate(b.metrics.lastDistribution)}
                  <br />
                  Last return: {formatDate(b.metrics.lastReturn)}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Link
                    to="/businesses/$businessId"
                    params={{ businessId: b.id }}
                    className="inline-flex rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    View business
                  </Link>
                  <RecordCouponsDialog
                    mode="distribution"
                    business={b}
                    trigger={
                      <button type="button" className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium">
                        Record distribution
                      </button>
                    }
                  />
                  <RecordCouponsDialog
                    mode="return"
                    business={b}
                    trigger={
                      <button type="button" className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium">
                        Record return
                      </button>
                    }
                  />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

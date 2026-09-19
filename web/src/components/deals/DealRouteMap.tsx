import { forwardRef, useEffect, useRef } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { Tooltip as LeafletTooltip } from 'leaflet';
import type { MutableRefObject } from 'react';
import {
  planPrintLayout,
  polaroidRoof,
  polaroidRoofMax,
  polaroidTilts,
  polaroidWing,
  printAnchorDrop,
  printReach,
  printSize,
} from '@/lib/route-map-prints';
import type { RouteGeometry, Waypoint } from '@/types';
import 'leaflet/dist/leaflet.css';

interface DealRouteMapProps {
  waypoints?: Waypoint[] | null;
  geometry?: RouteGeometry | null;
  editable?: boolean;
  onMapClick?: (point: { lat: number; lng: number }) => void;
  className?: string;
  /** Bump this value to re-fit the map to all waypoints. */
  repositionKey?: number;
}

type LatLngTuple = [number, number];

export function isValidWaypoint(point: Waypoint | null | undefined): point is Waypoint {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      point.lng >= -180 &&
      point.lng <= 180,
  );
}

function filterValidWaypoints(waypoints?: Waypoint[] | null): Waypoint[] {
  return (waypoints || []).filter(isValidWaypoint);
}

function validGeometry(geometry?: RouteGeometry | null): LatLngTuple[] {
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return [];
  return geometry.coordinates
    .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
    .map(([lng, lat]) => [lat, lng] as LatLngTuple);
}

/** What a stop is called: its title, else the geocoded address, else its position. */
function stopLabel(point: Waypoint, index: number): string {
  return point.name?.trim() || point.address?.trim() || `Stop ${index + 1}`;
}

/**
 * Numbered pin marking where a stop actually is. Stops that carry a polaroid
 * still keep their pin: the photo rides above it as a permanent popup, so the
 * route order stays readable when several photos overlap.
 */
function stopPinIcon(number: number) {
  return L.divIcon({
    className: 'deal-route-marker',
    html: `<span>${number}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

interface PolaroidPopupProps {
  number: number;
  caption: string;
  image: string;
}

/**
 * One stop's polaroid — the gallery photo the admin picked for the stop — drawn
 * as a Leaflet tooltip made `permanent`. That is deliberately a tooltip rather
 * than a popup: it is already open the moment the map mounts and stays open for
 * as long as the map is, so every stop's photo is on screen each time the route
 * map is opened without anyone having to click a pin. It stays non-interactive
 * so the print never swallows a map click or drag — which also keeps the admin
 * map clickable for adding stops.
 */
const PolaroidPopup = forwardRef<LeafletTooltip, PolaroidPopupProps>(function PolaroidPopup(
  { number, caption, image },
  ref,
) {
  return (
    <Tooltip
      ref={ref}
      permanent
      interactive={false}
      direction="top"
      offset={[0, -printReach]}
      opacity={1}
      className="deal-route-polaroid-popup"
    >
      <figure
        className="relative m-0 box-border rounded-[2px] bg-white p-1.5 pb-5 shadow-[0_4px_12px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.15)]"
        style={{
          width: printSize.width,
          height: printSize.height,
          // `--print-scale` is the declutter pass's dial, set on the tooltip frame
          // rather than here so a re-render cannot reset it. One means full size.
          transform: `rotate(${polaroidTilts[(number - 1) % polaroidTilts.length]}deg) scale(var(--print-scale, 1))`,
        }}
      >
        {/* Sized to the print's content box: 100 - 2 * 6 wide, 88 - 6 - 20 tall. */}
        <img src={image} alt={caption} loading="lazy" className="h-[62px] w-[88px] rounded-[1px] object-cover" />
        <figcaption className="absolute inset-x-0 bottom-1 truncate px-1 text-center text-[11px] leading-4 text-neutral-600">
          {caption}
        </figcaption>
        <span
          aria-hidden="true"
          className="absolute left-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        >
          {number}
        </span>
      </figure>
    </Tooltip>
  );
});

/** A stop as the declutter pass sees it: which stop it is, and where its pin sits. */
interface PrintAnchor {
  /** Index of the stop in the map's waypoint list. */
  index: number;
  lat: number;
  lng: number;
}

/** A stop paired with the open print that belongs to it. */
interface PrintEntry {
  stop: PrintAnchor;
  tooltip: LeafletTooltip;
}

/**
 * Applies the print layout to the live map. Where each print goes is worked out by
 * `planPrintLayout` in `@/lib/route-map-prints`; what is left here is the map's side
 * of the bargain: turning stops into pixels, handing the plan to Leaflet, and
 * reading back the one number the plan needs from a real tooltip.
 */
function PrintDeclutter({
  stops,
  tooltips,
}: {
  stops: PrintAnchor[];
  tooltips: MutableRefObject<Array<LeafletTooltip | null>>;
}) {
  const map = useMap();
  /** Leaflet's tooltip gap, learned from a print on screen and reused after that. */
  const anchorDrop = useRef(printAnchorDrop);

  useEffect(() => {
    const pinPoint = (stop: PrintAnchor) => map.latLngToContainerPoint([stop.lat, stop.lng]);

    /** Re-reads Leaflet's tooltip gap from the first print that has painted. */
    const learnAnchorDrop = (entries: PrintEntry[]) => {
      const frame = map.getContainer().getBoundingClientRect();
      for (const { stop, tooltip } of entries) {
        const element = tooltip.getElement();
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < printSize.width / 2 || rect.height < printSize.height / 2) continue;
        // A scaled print keeps its centre, so the paper's own box is read from there.
        const centreY = rect.top + rect.height / 2 - frame.top;
        const applied = tooltip.options.offset ? L.point(tooltip.options.offset) : L.point(0, 0);
        const sample = pinPoint(stop).y + applied.y - (centreY + printSize.height / 2);
        if (Number.isFinite(sample) && Math.abs(sample) <= printSize.height) anchorDrop.current = sample;
        return;
      }
    };

    const place = () => {
      const prints: PrintEntry[] = stops.flatMap((stop) => {
        const tooltip = tooltips.current[stop.index];
        return tooltip ? [{ stop, tooltip }] : [];
      });
      if (prints.length === 0) return;

      learnAnchorDrop(prints);
      const size = map.getSize();
      const plan = planPrintLayout({
        // `stops` is in map order and each stop knows its own index, which is what
        // the plan uses to tell a print apart from the pins it must not bury.
        pins: stops.map(pinPoint),
        printIndexes: prints.map(({ stop }) => stop.index),
        size: { width: size.x, height: size.y },
        anchorDrop: anchorDrop.current,
      });

      const byIndex = new Map(prints.map(({ stop, tooltip }) => [stop.index, tooltip]));
      // Size and spot are applied together, so a print is never drawn at a size its
      // placement was not worked out for.
      plan.placements.forEach((placement) => {
        const tooltip = byIndex.get(placement.index);
        if (!tooltip) return;
        tooltip.getElement()?.style.setProperty('--print-scale', String(plan.scale));
        tooltip.options.offset = L.point(placement.dx, -plan.reach - placement.lift);
        tooltip.update();
      });
    };

    place();
    map.on('moveend zoomend resize', place);
    // The bounds are fitted one animation frame in, so settle again just after.
    const frame = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(frame);
      map.off('moveend zoomend resize', place);
    };
  }, [map, stops, tooltips]);

  return null;
}

function MapBounds({
  waypoints,
  geometry,
  hasPolaroid,
  repositionKey,
}: {
  waypoints: Waypoint[];
  geometry?: RouteGeometry | null;
  hasPolaroid: boolean;
  repositionKey?: number;
}) {
  const map = useMap();
  const geometryPoints = validGeometry(geometry);

  useEffect(() => {
    const points = [
      ...filterValidWaypoints(waypoints).map((point) => [point.lat, point.lng] as LatLngTuple),
      ...geometryPoints,
    ];
    const resizeAndFit = () => {
      map.invalidateSize();
      if (points.length === 1) map.setView(points[0], 13);
      if (points.length > 1) {
        // Polaroids hang above their pins, so the top and side edges need the extra
        // room; otherwise the outermost stops' prints are clipped by the map frame.
        const roof = Math.min(polaroidRoofMax, Math.max(polaroidRoof, Math.round(map.getSize().y * 0.45)));
        map.fitBounds(L.latLngBounds(points), {
          paddingTopLeft: hasPolaroid ? [polaroidWing, roof] : [28, 28],
          paddingBottomRight: [28, 28],
        });
      }
    };
    const frame = requestAnimationFrame(resizeAndFit);
    // The map often mounts inside an animating/scrollable dialog; Leaflet measures
    // its container once at init and renders blank if the size changes afterwards.
    // Re-measuring on container resize keeps the tiles visible in that case.
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [geometry, geometryPoints.length, hasPolaroid, map, repositionKey, waypoints]);

  return null;
}

function ClickHandler({ onMapClick }: { onMapClick?: DealRouteMapProps['onMapClick'] }) {
  useMapEvents({
    click: (event) => onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

const defaultCenter: LatLngTuple = [23.8103, 90.4125];

export function DealRouteMap({
  waypoints = [],
  geometry,
  editable = false,
  onMapClick,
  className = '',
  repositionKey,
}: DealRouteMapProps) {
  const safeWaypoints = filterValidWaypoints(waypoints);
  const line = validGeometry(geometry);
  const firstPoint = safeWaypoints[0];
  const center: LatLngTuple = firstPoint ? [firstPoint.lat, firstPoint.lng] : defaultCenter;
  const printRefs = useRef<Array<LeafletTooltip | null>>([]);
  const stops: PrintAnchor[] = safeWaypoints.map((point, index) => ({
    index,
    lat: point.lat,
    lng: point.lng,
  }));

  return (
    <div
      className={`relative isolate overflow-hidden rounded-lg border ${className}`}
      role="region"
      aria-label={editable ? 'Editable tour route map' : 'Tour route map'}
    >
      <MapContainer
        center={center}
        zoom={firstPoint ? 12 : 9}
        scrollWheelZoom
        className="absolute inset-0"
        aria-label={editable ? 'Editable tour route map' : 'Tour route map'}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds
          waypoints={safeWaypoints}
          geometry={geometry}
          hasPolaroid={safeWaypoints.some((point) => Boolean(point.image))}
          repositionKey={repositionKey}
        />
        {editable && <ClickHandler onMapClick={onMapClick} />}
        {safeWaypoints.map((point, index) => (
          <Marker
            key={`${point.lat}-${point.lng}-${index}`}
            position={[point.lat, point.lng]}
            icon={stopPinIcon(index + 1)}
          >
            {point.image ? (
              <PolaroidPopup
                ref={(instance) => {
                  printRefs.current[index] = instance;
                }}
                number={index + 1}
                caption={stopLabel(point, index)}
                image={point.image}
              />
            ) : null}
          </Marker>
        ))}
        {safeWaypoints.length > 1 && line.length > 1 && (
          <Polyline positions={line} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.85 }} />
        )}
        {/* Declared last so every pin and print above is already on the map when the
            first layout pass runs. */}
        <PrintDeclutter stops={stops} tooltips={printRefs} />
      </MapContainer>
      {editable && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
          Click the map to add a stop. On touch devices, use the ordered list below to edit the route.
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { X, Globe, Map, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature as topojsonFeature } from 'topojson-client';
import { ALPHA3_TO_NUMERIC } from './country-codes';
import type { Trip, TripStatus } from '@/lib/types/database';

const GEO_URL = '/world-110m.json';
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;
const MIN_ZOOM = 0.9;
const MAX_ZOOM = 20;

type MapPosition = {
  x: number;
  y: number;
  zoom: number;
};

type DragState = {
  dragging: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type CountryPath = {
  id: number;
  key: string;
  path: string;
};

type TopologyJson = {
  objects?: {
    countries?: unknown;
  };
};

type FeatureCollectionLike = {
  features?: unknown[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatTripDates(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-AU', { month: 'short' })} – ${e.toLocaleDateString('en-AU', opts)}`;
  }
  return `${s.toLocaleDateString('en-AU', opts)} – ${e.toLocaleDateString('en-AU', opts)}`;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

const STATUS_LABEL: Record<TripStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Happening Now',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<TripStatus, string> = {
  upcoming: '#C9B98A',
  active: '#4ade80',
  completed: '#B5621E',
  cancelled: '#6b7280',
};

// ─── sub-components ───────────────────────────────────────────────────────────

interface TripMarkerProps {
  trip: Trip;
  isSelected: boolean;
  zoom: number;
  x: number;
  y: number;
  onClick: (e?: React.MouseEvent) => void;
}

function TripMarker({ trip, isSelected, zoom, x, y, onClick }: TripMarkerProps) {
  const isUpcoming = trip.status === 'upcoming' || trip.status === 'active';
  const color = STATUS_COLOR[trip.status];
  // Scale pins inversely with zoom so they don't grow huge when zoomed in
  const r = Math.max(4, 8 / Math.sqrt(zoom));
  const pulseR = r * 2.2;

  return (
    <g
      transform={`translate(${x} ${y})`}
      onClick={(e: React.MouseEvent) => onClick(e)}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={trip.name}
    >
      {/* Outer glow ring for upcoming/active */}
      {isUpcoming && (
        <circle
          r={pulseR}
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth={1}
        >
          <animate
            attributeName="r"
            values={`${r * 1.4};${pulseR};${r * 1.4}`}
            dur="2.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="fill-opacity"
            values="0.22;0.05;0.22"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Selection ring */}
      {isSelected && (
        <circle
          r={r + 5}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.7}
        />
      )}

      {/* Main pin body */}
      <circle
        r={r}
        fill={color}
        stroke="#0D0D0D"
        strokeWidth={1.5}
        fillOpacity={0.95}
        filter={isSelected ? 'url(#pin-glow)' : undefined}
      />

      {/* Centre dot */}
      <circle r={r * 0.32} fill="#0D0D0D" fillOpacity={0.6} />
    </g>
  );
}

interface TripPopupProps {
  trip: Trip;
  onClose: () => void;
}

function TripPopup({ trip, onClose }: TripPopupProps) {
  const color = STATUS_COLOR[trip.status];
  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-72 max-w-[calc(100%-2rem)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="relative rounded-xl border overflow-hidden shadow-2xl"
        style={{ borderColor: `${color}40`, background: '#151209' }}
      >
        {/* Accent stripe */}
        <div className="h-1 w-full" style={{ background: color }} />

        <div className="p-4">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-brand-cream/40 hover:text-brand-cream/80 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Status badge */}
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2"
            style={{ color, background: `${color}20` }}
          >
            {STATUS_LABEL[trip.status]}
          </span>

          {/* Trip name */}
          <h3 className="text-brand-cream font-bold text-base leading-tight mb-1 pr-5">
            {trip.name}
          </h3>

          {/* Destination */}
          <p className="text-brand-cream/60 text-xs mb-1">
            {trip.destination}, {trip.country}
          </p>

          {/* Dates */}
          <p className="text-brand-cream/50 text-xs mb-3">
            {formatTripDates(trip.start_date, trip.end_date)}
          </p>

          {/* Rider count */}
          {trip.max_members && (
            <p className="text-brand-cream/50 text-xs mb-3">
              Up to {trip.max_members} riders
            </p>
          )}

          {/* CTA */}
          <Link
            href={`/trips/${trip.slug}`}
            className="block w-full text-center text-xs font-semibold py-2 rounded-lg transition-colors"
            style={{
              background: `${color}22`,
              color,
              border: `1px solid ${color}40`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = `${color}40`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = `${color}22`;
            }}
          >
            View Trip →
          </Link>
        </div>
      </div>
    </div>
  );
}

interface MapStatsProps {
  totalTrips: number;
  uniqueCountries: number;
  memberMode?: boolean;
}

function MapStats({ totalTrips, uniqueCountries, memberMode }: MapStatsProps) {
  return (
    <div className="flex items-center gap-6 mb-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-brand-tan" />
        <span className="text-brand-tan font-bold text-lg">{totalTrips}</span>
        <span className="text-brand-cream/50 text-sm">
          {memberMode ? (totalTrips === 1 ? 'trip' : 'trips') : 'adventures'}
        </span>
      </div>
      <div className="w-px h-5 bg-brand-brown/30" />
      <div className="flex items-center gap-2">
        <Map className="w-4 h-4 text-brand-tan" />
        <span className="text-brand-tan font-bold text-lg">{uniqueCountries}</span>
        <span className="text-brand-cream/50 text-sm">
          {uniqueCountries === 1 ? 'country' : 'countries'}
        </span>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export interface WorldMapProps {
  trips: Trip[];
  /** When true, renders in a compact height (for profile sidebar) */
  compact?: boolean;
  /** Show stats bar above the map */
  showStats?: boolean;
  /** Label prefix — e.g. "Your" → "Your adventures" */
  memberMode?: boolean;
}

export function WorldMap({
  trips,
  compact = false,
  showStats = true,
  memberMode = false,
}: WorldMapProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [position, setPosition] = useState<MapPosition>({ x: 0, y: 0, zoom: 1 });
  const [isReady, setIsReady] = useState(false);
  const [countries, setCountries] = useState<unknown[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<DragState>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const ignoreNextClickRef = useRef(false);

  // Slight delay so map renders after hydration
  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;

    const loadMap = async () => {
      try {
        const res = await fetch(GEO_URL, { cache: 'force-cache' });
        if (!res.ok) return;

        const topology = (await res.json()) as TopologyJson;
        const countryObject = topology?.objects?.countries;
        if (!countryObject) return;

        const collection = topojsonFeature(
          topology as unknown,
          countryObject
        ) as FeatureCollectionLike;
        const nextCountries = Array.isArray(collection?.features)
          ? collection.features
          : [];

        if (!cancelled) {
          setCountries(nextCountries);
        }
      } catch {
        if (!cancelled) {
          setCountries([]);
        }
      }
    };

    void loadMap();

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  // Visited country numeric codes (only completed / active trips)
  const visitedNumericCodes = new Set(
    trips
      .filter((t) => t.country_code && t.status !== 'upcoming' && t.status !== 'cancelled')
      .map((t) => ALPHA3_TO_NUMERIC[t.country_code!])
      .filter(Boolean)
  );

  // Unique countries (all trips)
  const uniqueCountries = new Set(
    trips.filter((t) => t.country_code).map((t) => t.country_code!)
  ).size;

  // Trips with map coordinates
  const mappableTrips = trips.filter(
    (t) => t.latitude != null && t.longitude != null && t.status !== 'cancelled'
  );

  const projection = useMemo(
    () =>
      geoNaturalEarth1()
        .scale(175)
        .center([15, 5])
        .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]),
    []
  );

  const countryPaths = useMemo<CountryPath[]>(() => {
    const toPath = geoPath(projection);

    const paths = countries
      .map((country, idx) => {
        const d = toPath(country);
        if (!d) return null;

        const countryId =
          typeof country === 'object' && country !== null && 'id' in country
            ? (country as { id?: unknown }).id
            : undefined;
        const numericId = Number.parseInt(String(countryId ?? ''), 10);
        return {
          id: Number.isNaN(numericId) ? -1 : numericId,
          key: `${countryId ?? 'country'}-${idx}`,
          path: d,
        };
      })
      .filter((entry): entry is CountryPath => entry !== null);

    return paths;
  }, [countries, projection]);

  const markerPositions = useMemo(() => {
    return mappableTrips
      .map((trip) => {
        const projected = projection([trip.longitude!, trip.latitude!]);
        if (!projected) return null;
        return {
          trip,
          x: projected[0],
          y: projected[1],
        };
      })
      .filter(
        (
          entry
        ): entry is {
          trip: Trip;
          x: number;
          y: number;
        } => entry !== null
      );
  }, [mappableTrips, projection]);

  const handleReset = useCallback(() => {
    setPosition({ x: 0, y: 0, zoom: 1 });
    setSelectedTrip(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    setPosition((p) => ({ ...p, zoom: clampZoom(p.zoom * 1.5) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPosition((p) => ({ ...p, zoom: clampZoom(p.zoom / 1.5) }));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setPosition((p) => ({ ...p, zoom: clampZoom(p.zoom * factor) }));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);

      dragRef.current = {
        dragging: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        originX: position.x,
        originY: position.y,
      };
    },
    [position.x, position.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag.dragging) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }

    setPosition((p) => ({
      ...p,
      x: drag.originX + dx,
      y: drag.originY + dy,
    }));
  }, []);

  const handlePointerEnd = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;

    if (drag.dragging && drag.moved) {
      ignoreNextClickRef.current = true;
    }

    dragRef.current.dragging = false;
    dragRef.current.moved = false;
    setIsDragging(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const mapTransform = useMemo(() => {
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;
    return `translate(${position.x} ${position.y}) translate(${cx} ${cy}) scale(${position.zoom}) translate(${-cx} ${-cy})`;
  }, [position]);

  const mapHeight = compact ? 320 : 480;

  return (
    <div className="w-full">
      {showStats && (
        <MapStats
          totalTrips={trips.length}
          uniqueCountries={uniqueCountries}
          memberMode={memberMode}
        />
      )}

      <div
        className="relative rounded-xl overflow-hidden border border-brand-brown/20 select-none"
        style={{ height: mapHeight, background: '#0a0804' }}
        onClick={() => {
          if (ignoreNextClickRef.current) {
            ignoreNextClickRef.current = false;
            return;
          }
          if (selectedTrip) setSelectedTrip(null);
        }}
      >
        {/* SVG filter for selected-pin glow */}
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <defs>
            <filter id="pin-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {isReady && (
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {/* Ocean background */}
            <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0e0c08" />

            <g transform={mapTransform}>
              {countryPaths.map((country) => {
                const isVisited = visitedNumericCodes.has(country.id);
                return (
                  <path
                    key={country.key}
                    d={country.path}
                    fill={isVisited ? '#C9B98A' : '#1e1a12'}
                    stroke="#0a0804"
                    strokeWidth={0.4}
                  />
                );
              })}

              {markerPositions.map(({ trip, x, y }) => (
                <TripMarker
                  key={trip.id}
                  trip={trip}
                  x={x}
                  y={y}
                  isSelected={selectedTrip?.id === trip.id}
                  zoom={position.zoom}
                  onClick={(e?: React.MouseEvent) => {
                    e?.stopPropagation();
                    setSelectedTrip((prev) => (prev?.id === trip.id ? null : trip));
                  }}
                />
              ))}
            </g>
          </svg>
        )}

        {/* Map controls (top-right) */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomIn();
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(21,18,9,0.85)',
              border: '1px solid rgba(181,98,30,0.3)',
              color: '#C9B98A',
            }}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomOut();
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(21,18,9,0.85)',
              border: '1px solid rgba(181,98,30,0.3)',
              color: '#C9B98A',
            }}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(21,18,9,0.85)',
              border: '1px solid rgba(181,98,30,0.3)',
              color: '#C9B98A',
            }}
            aria-label="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend (bottom-left) */}
        <div
          className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 text-[10px] text-brand-cream/50"
          style={{
            background: 'rgba(10,8,4,0.75)',
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1px solid rgba(181,98,30,0.2)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#C9B98A' }} />
            Visited
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#B5621E' }} />
            Past trip
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ background: '#C9B98A', boxShadow: '0 0 6px #C9B98A' }}
            />
            Upcoming
          </span>
        </div>

        {/* Drag hint */}
        {!selectedTrip && mappableTrips.length > 0 && (
          <div
            className="absolute top-3 left-3 z-10 text-[10px] text-brand-cream/30 pointer-events-none"
            style={{
              background: 'rgba(10,8,4,0.6)',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            Drag to pan · scroll to zoom · click a pin
          </div>
        )}

        {/* Empty state */}
        {mappableTrips.length === 0 && isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-brand-cream/30 text-sm text-center px-8">
              {trips.length > 0
                ? 'No trips have map coordinates yet.\nAdmins can add them in Trip Settings.'
                : 'No trips yet — adventures await.'}
            </p>
          </div>
        )}

        {/* Selected trip popup */}
        {selectedTrip && <TripPopup trip={selectedTrip} onClose={() => setSelectedTrip(null)} />}
      </div>
    </div>
  );
}

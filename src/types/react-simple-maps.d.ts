declare module 'react-simple-maps' {
  import { ComponentProps, CSSProperties, ReactNode } from 'react';

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
  }

  export interface ZoomableGroupProps {
    zoom?: number;
    center?: [number, number];
    minZoom?: number;
    maxZoom?: number;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
    onMoveStart?: (position: { coordinates: [number, number]; zoom: number }) => void;
    translateExtent?: [[number, number], [number, number]];
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Geography[] }) => ReactNode;
    parseGeographies?: (geographies: unknown[]) => Geography[];
  }

  export interface Geography {
    rsmKey: string;
    id: string | number;
    type: string;
    geometry: object;
    properties: Record<string, unknown>;
  }

  export interface GeographyProps {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: CSSProperties & { outline?: string };
      hover?: CSSProperties & { outline?: string };
      pressed?: CSSProperties & { outline?: string };
    };
    className?: string;
    onClick?: (event: React.MouseEvent, geography: Geography) => void;
    onMouseEnter?: (event: React.MouseEvent, geography: Geography) => void;
    onMouseLeave?: (event: React.MouseEvent, geography: Geography) => void;
    key?: string;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
    onClick?: (event: React.MouseEvent) => void;
    onMouseEnter?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
  }

  export interface LineProps {
    from: [number, number];
    to: [number, number];
    stroke?: string;
    strokeWidth?: number;
    className?: string;
    style?: CSSProperties;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
  export function Line(props: LineProps): JSX.Element;
}

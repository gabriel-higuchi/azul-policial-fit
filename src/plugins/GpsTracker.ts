import { registerPlugin } from '@capacitor/core';

export interface Coord {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  time: number;
}

export interface GpsTrackerPlugin {
  startTracking(): Promise<{ status: string }>;
  stopTracking(): Promise<{ status: string }>;
  getCoords(): Promise<{ coords: string; count: number }>;
  isTracking(): Promise<{ running: boolean }>;
}

const GpsTracker = registerPlugin<GpsTrackerPlugin>('GpsTracker');

// Helper: inicia tracking
export async function startGpsTracking(): Promise<void> {
  await GpsTracker.startTracking();
}

// Helper: para tracking e retorna coords acumuladas
export async function stopGpsTracking(): Promise<Coord[]> {
  const { coords } = await GpsTracker.getCoords();
  await GpsTracker.stopTracking();
  try {
    return JSON.parse(coords) as Coord[];
  } catch {
    return [];
  }
}

// Helper: busca coords sem parar (para mostrar contador)
export async function getCurrentCoords(): Promise<Coord[]> {
  const { coords } = await GpsTracker.getCoords();
  try {
    return JSON.parse(coords) as Coord[];
  } catch {
    return [];
  }
}

export default GpsTracker;

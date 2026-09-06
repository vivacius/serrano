import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeoLocation {
  lat:      number;
  lng:      number;
  accuracy: number;
}

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );
    watchIdRef.current = id;
    setWatching(true);
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
    setLocation(null);
    setError(null);
  }, []);

  const toggle = useCallback(() => {
    if (watching) stop(); else start();
  }, [watching, start, stop]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (watchIdRef.current !== null)
      navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  return { location, error, watching, toggle };
}

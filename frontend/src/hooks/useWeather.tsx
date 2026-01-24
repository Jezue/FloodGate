import { useState, useEffect } from 'react';
import type { WeatherData } from '../api/weather';
import { getWeatherForCity } from '../api/weather';
import { api } from '../api/client';

const DEFAULT_CITY = 'Warszawa';
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [failSafeTimeout, setFailSafeTimeout] = useState<number>(5);

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.fetchSettings();
        if (settings.city) setCity(settings.city);
        if (settings.fail_safe_timeout_min) setFailSafeTimeout(settings.fail_safe_timeout_min);
      } catch (error) {
        console.error('Failed to load settings from backend:', error);
      }
    };
    loadSettings();
  }, []);

  const fetchWeather = async (cityName: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeatherForCity(cityName);
      if (data) setWeather(data);
      else setError(`Nie można pobrać pogody dla: ${cityName}`);
    } catch (err) {
      setError('Błąd pobierania danych pogodowych');
      console.error('Weather fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateCity = async (newCity: string) => {
    console.log('[useWeather] updateCity called with:', newCity);
    setCity(newCity);
    try {
      console.log('[useWeather] Saving to backend:', { city: newCity, timeout: failSafeTimeout });
      await api.updateSettings({ city: newCity, fail_safe_timeout_min: failSafeTimeout });
      console.log('[useWeather] Backend save success');
    } catch (error) {
      console.error('[useWeather] Failed to save settings:', error);
    }
    console.log('[useWeather] Fetching weather for:', newCity);
    fetchWeather(newCity);
  };

  const updateTimeout = async (minutes: number) => {
    setFailSafeTimeout(minutes);
    try {
      await api.updateSettings({ city, fail_safe_timeout_min: minutes });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  useEffect(() => {
    fetchWeather(city);
    const interval = setInterval(() => fetchWeather(city), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [city]);

  return {
    weather,
    city,
    updateCity,
    failSafeTimeout,
    updateTimeout,
    loading,
    error
  };
}

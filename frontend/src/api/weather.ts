// Open-Meteo API integration for weather data

export interface WeatherData {
  temperature: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  cityName: string;
}

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

/**
 * Geocode a city name to get latitude and longitude
 */
export async function geocodeCity(cityName: string): Promise<GeocodingResult | null> {
  try {
    console.log('[Weather] Geocoding city:', cityName);
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=pl&format=json`
    );
    
    if (!response.ok) {
      console.error('Geocoding API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.error('City not found:', cityName);
      return null;
    }
    
    console.log('[Weather] Geocoding results for', cityName, ':', data.results);
    
    // Try to find exact match first (case-insensitive)
    const exactMatch = data.results.find((r: any) => 
      r.name.toLowerCase() === cityName.toLowerCase()
    );
    
    const result = exactMatch || data.results[0];
    console.log('[Weather] Selected result:', result);
    
    return {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Get weather data from Open-Meteo API
 */
export async function getWeatherData(lat: number, lon: number): Promise<Omit<WeatherData, 'cityName'> | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto`
    );
    
    if (!response.ok) {
      console.error('Weather API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      temperature: Math.round(data.current.temperature_2m),
      precipitation: data.current.precipitation,
      humidity: data.current.relative_humidity_2m,
      windSpeed: Math.round(data.current.wind_speed_10m)
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
}

/**
 * Get weather data for a city by name
 */
export async function getWeatherForCity(cityName: string): Promise<WeatherData | null> {
  const geocoding = await geocodeCity(cityName);
  
  if (!geocoding) {
    return null;
  }
  
  const weather = await getWeatherData(geocoding.latitude, geocoding.longitude);
  
  if (!weather) {
    return null;
  }
  
  return {
    ...weather,
    cityName: geocoding.name
  };
}

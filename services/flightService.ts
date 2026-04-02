import { GoogleGenerativeAI } from "@google/generative-ai";

// Cache implementation
const CACHE_PREFIX = 'smartflight_cache_';
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function getFromCache(key: string) {
  try {
    const cached = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function setToCache(key: string, data: any) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn("Cache storage failed", e);
  }
}

export interface FlightLeg {
  id: string;
  flightNumber: string;
  airline: string;
  departure: {
    airport: string;
    city: string;
    scheduled: string;
  };
  arrival: {
    airport: string;
    city: string;
    scheduled: string;
  };
  disruptionProbability: number; // 0-1
}

export interface Itinerary {
  id: string;
  legs: FlightLeg[];
  totalDuration: string;
  reliabilityScore: number; // 0-10
  connectionRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  connectionRiskValue: number; // 0-100%
  status: 'RELIABLE' | 'CAUTION' | 'HIGH RISK';
  price: number;
  alternatives?: Itinerary[];
}

export interface LiveFlightData {
  flightNumber: string;
  airline: string;
  origin: { airport: string; city: string; time: string; terminal: string; gate: string };
  destination: { airport: string; city: string; time: string; terminal: string; gate: string };
  status: 'IN AIR' | 'SCHEDULED' | 'LANDED' | 'DELAYED';
  progress: number;
  altitude: number;
  speed: number;
  aircraft: { model: string; age: string; registration: string };
  estimatedArrival: string;
}

const DEMO_ITINERARIES: Itinerary[] = [
  {
    id: 'demo-1',
    totalDuration: '1h 05m',
    reliabilityScore: 9.8,
    connectionRisk: 'LOW',
    connectionRiskValue: 2,
    status: 'RELIABLE',
    price: 185,
    legs: [{
      id: 'l1',
      flightNumber: 'AK5106',
      airline: 'AirAsia',
      departure: { airport: 'KUL', city: 'Kuala Lumpur', scheduled: new Date().toISOString() },
      arrival: { airport: 'PEN', city: 'Penang', scheduled: new Date(Date.now() + 3900000).toISOString() },
      disruptionProbability: 0.02
    }]
  },
  {
    id: 'demo-2',
    totalDuration: '2h 15m',
    reliabilityScore: 8.5,
    connectionRisk: 'LOW',
    connectionRiskValue: 5,
    status: 'RELIABLE',
    price: 420,
    legs: [{
      id: 'l2',
      flightNumber: 'MH601',
      airline: 'Malaysia Airlines',
      departure: { airport: 'KUL', city: 'Kuala Lumpur', scheduled: new Date().toISOString() },
      arrival: { airport: 'SIN', city: 'Singapore', scheduled: new Date(Date.now() + 8100000).toISOString() },
      disruptionProbability: 0.08
    }]
  }
];

export async function searchFlight(query: string, useDemo: boolean = false): Promise<Itinerary[]> {
  if (useDemo) return DEMO_ITINERARIES;
  
  const cacheKey = `search_${query.toLowerCase().replace(/\s+/g, '_')}`;
  const cachedData = getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set, returning demo data");
    return DEMO_ITINERARIES;
  }

  const ai = new GoogleGenerativeAI(apiKey);

  try {
    const response = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(`Search for flight itineraries for query: "${query}". 
      Return a list of realistic Itinerary objects. 
      Each itinerary can have 1 or 2 legs (for connections).
      
      CRITICAL: All departure times MUST be in the LOCAL TIME of the departure airport, and all arrival times MUST be in the LOCAL TIME of the arrival airport.
      
      Include:
      - reliabilityScore (0-10 based on historical performance)
      - connectionRisk (LOW/MEDIUM/HIGH) based on layover duration
      - connectionRiskValue (0-100%)
      - price (in RM)
      - disruptionProbability for each leg.
      Make the data look extremely realistic and varied.`);

    const text = response.response?.text?.() || response.response?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const data = JSON.parse(text);
    const sortedData = data.sort((a: Itinerary, b: Itinerary) => b.reliabilityScore - a.reliabilityScore);
    setToCache(cacheKey, sortedData);
    return sortedData;
  } catch (e: any) {
    if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    console.error("Failed to fetch flight data", e);
    return [];
  }
}

export async function trackFlight(flightNumber: string, useDemo: boolean = false): Promise<LiveFlightData | null> {
  if (useDemo) {
    return {
      flightNumber: flightNumber || 'MH123',
      airline: 'Malaysia Airlines',
      origin: { airport: 'KUL', city: 'Kuala Lumpur', time: new Date().toISOString(), terminal: 'M', gate: 'C12' },
      destination: { airport: 'LHR', city: 'London', time: new Date(Date.now() + 43200000).toISOString(), terminal: '4', gate: 'B3' },
      status: 'IN AIR',
      progress: 45,
      altitude: 36000,
      speed: 850,
      aircraft: { model: 'Airbus A350-900', age: '4 years', registration: '9M-MAC' },
      estimatedArrival: new Date(Date.now() + 24000000).toISOString()
    };
  }

  const cacheKey = `track_${flightNumber.toLowerCase()}`;
  const cachedData = getFromCache(cacheKey);
  if (cachedData) return cachedData;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set, returning demo data");
    return {
      flightNumber: flightNumber || 'MH123',
      airline: 'Malaysia Airlines',
      origin: { airport: 'KUL', city: 'Kuala Lumpur', time: new Date().toISOString(), terminal: 'M', gate: 'C12' },
      destination: { airport: 'LHR', city: 'London', time: new Date(Date.now() + 43200000).toISOString(), terminal: '4', gate: 'B3' },
      status: 'IN AIR',
      progress: 45,
      altitude: 36000,
      speed: 850,
      aircraft: { model: 'Airbus A350-900', age: '4 years', registration: '9M-MAC' },
      estimatedArrival: new Date(Date.now() + 24000000).toISOString()
    };
  }

  const ai = new GoogleGenerativeAI(apiKey);

  try {
    const response = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(`Search for the real-time status of flight ${flightNumber}. 
      Provide current telemetry, aircraft details, and progress if the flight is currently in the air.
      If the flight is scheduled or landed, provide the most recent or upcoming data.
      
      CRITICAL: All times (origin.time, destination.time, estimatedArrival) MUST be in the LOCAL TIME of the respective airport. 
      For example, if a flight departs KUL (UTC+8) and arrives in HAN (UTC+7), the arrival time must be shown in HAN local time (UTC+7).
      
      Return a single LiveFlightData object.`);

    const text = response.response?.text?.() || response.response?.candidates?.[0]?.content?.parts?.[0]?.text || "null";
    const data = JSON.parse(text);
    if (data) setToCache(cacheKey, data);
    return data;
  } catch (e: any) {
    if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    console.error("Failed to track flight", e);
    return null;
  }
}

import { GoogleGenAI, Type } from "@google/genai";

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

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for flight itineraries for query: "${query}". 
      Return a list of realistic Itinerary objects. 
      Each itinerary can have 1 or 2 legs (for connections).
      
      CRITICAL: All departure times MUST be in the LOCAL TIME of the departure airport, and all arrival times MUST be in the LOCAL TIME of the arrival airport.
      
      Include:
      - reliabilityScore (0-10 based on historical performance)
      - connectionRisk (LOW/MEDIUM/HIGH) based on layover duration
      - connectionRiskValue (0-100%)
      - price (in RM)
      - disruptionProbability for each leg.
      Make the data look extremely realistic and varied.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              totalDuration: { type: Type.STRING },
              reliabilityScore: { type: Type.NUMBER },
              connectionRisk: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
              connectionRiskValue: { type: Type.NUMBER },
              status: { type: Type.STRING, enum: ['RELIABLE', 'CAUTION', 'HIGH RISK'] },
              price: { type: Type.NUMBER },
              legs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    flightNumber: { type: Type.STRING },
                    airline: { type: Type.STRING },
                    departure: {
                      type: Type.OBJECT,
                      properties: {
                        airport: { type: Type.STRING },
                        city: { type: Type.STRING },
                        scheduled: { type: Type.STRING, description: "ISO 8601 timestamp in local time" },
                      }
                    },
                    arrival: {
                      type: Type.OBJECT,
                      properties: {
                        airport: { type: Type.STRING },
                        city: { type: Type.STRING },
                        scheduled: { type: Type.STRING, description: "ISO 8601 timestamp in local time" },
                      }
                    },
                    disruptionProbability: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
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

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for the real-time status of flight ${flightNumber}. 
      Provide current telemetry, aircraft details, and progress if the flight is currently in the air.
      If the flight is scheduled or landed, provide the most recent or upcoming data.
      
      CRITICAL: All times (origin.time, destination.time, estimatedArrival) MUST be in the LOCAL TIME of the respective airport. 
      For example, if a flight departs KUL (UTC+8) and arrives in HAN (UTC+7), the arrival time must be shown in HAN local time (UTC+7).
      
      Return a single LiveFlightData object.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flightNumber: { type: Type.STRING },
            airline: { type: Type.STRING },
            origin: {
              type: Type.OBJECT,
              properties: {
                airport: { type: Type.STRING },
                city: { type: Type.STRING },
                time: { type: Type.STRING, description: "ISO 8601 timestamp in local time" },
                terminal: { type: Type.STRING },
                gate: { type: Type.STRING }
              }
            },
            destination: {
              type: Type.OBJECT,
              properties: {
                airport: { type: Type.STRING },
                city: { type: Type.STRING },
                time: { type: Type.STRING, description: "ISO 8601 timestamp in local time" },
                terminal: { type: Type.STRING },
                gate: { type: Type.STRING }
              }
            },
            status: { type: Type.STRING, enum: ['IN AIR', 'SCHEDULED', 'LANDED', 'DELAYED'] },
            progress: { type: Type.NUMBER, description: "Percentage of flight completed (0-100)" },
            altitude: { type: Type.NUMBER, description: "Current altitude in feet" },
            speed: { type: Type.NUMBER, description: "Current ground speed in km/h" },
            aircraft: {
              type: Type.OBJECT,
              properties: {
                model: { type: Type.STRING },
                age: { type: Type.STRING },
                registration: { type: Type.STRING }
              }
            },
            estimatedArrival: { type: Type.STRING, description: "ISO 8601 timestamp in local time" }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "null");
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

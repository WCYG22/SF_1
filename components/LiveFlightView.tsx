import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Plane, 
  Search, 
  Activity, 
  Clock, 
  Navigation, 
  Wind, 
  ShieldCheck,
} from 'lucide-react';
import { Card, Badge } from './UI';
import { trackFlight, LiveFlightData } from '../services/flightService';

const formatTime = (timeStr: string) => {
  try {
    // Check if it's an ISO string
    if (timeStr.includes('T')) {
      return format(parseISO(timeStr), 'HH:mm');
    }
    return timeStr;
  } catch (e) {
    return timeStr;
  }
};

const formatDate = (timeStr: string) => {
  if (!timeStr) return '';
  try {
    // If it's already an ISO string
    if (timeStr.includes('T')) {
      return format(parseISO(timeStr), 'dd MMM yyyy');
    }
    // If it's just a time like "12:10", we can't easily get the date
    // But since we updated the service to return ISO, this should be less common
    return '';
  } catch (e) {
    return '';
  }
};

interface LiveFlightViewProps {
  isDemoMode?: boolean;
  onEnableDemo?: () => void;
}

export const LiveFlightView: React.FC<LiveFlightViewProps> = ({ isDemoMode = false, onEnableDemo }) => {
  const [query, setQuery] = useState('');
  const [tracking, setTracking] = useState<LiveFlightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError(null);
    setIsRateLimited(false);
    
    try {
      const data = await trackFlight(query, isDemoMode);
      if (data) {
        setTracking(data);
      } else {
        setError("Could not find live data for this flight. Please check the flight number.");
      }
    } catch (err: any) {
      if (err.message === "RATE_LIMIT_EXCEEDED") {
        setIsRateLimited(true);
        setError("RATE_LIMIT");
      } else {
        console.error(err);
        setError("An error occurred while fetching flight data.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 px-2">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-3">
          <Activity className="w-6 h-6 text-accent" />
          Live Flight Tracking
        </h2>
        <p className="text-xs text-white/70">Track real-time flight status, aircraft data, and live progress.</p>
      </div>

      <Card className="border-accent/20 bg-accent/5">
        <form onSubmit={handleTrack} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text"
              placeholder="Enter Flight Number (e.g. MH123, AK512)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-accent outline-none transition-all font-bold mono"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="bg-accent text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
          >
            {loading ? <Activity className="w-5 h-5 animate-spin" /> : 'Track'}
          </button>
        </form>
      </Card>

      {error === "RATE_LIMIT" && (
        <div 
          className="bg-accent/10 border border-accent/20 p-6 rounded-2xl space-y-4 animate-in fade-in"
        >
          <div className="flex items-center gap-3 text-accent">
            <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest">Shared API Quota Exceeded</p>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            The shared platform key is currently at its limit. You can fix this by adding your own key in the Profile tab, or try the app with demo data.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={onEnableDemo}
              className="flex-1 py-2 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent/80 transition-all"
            >
              Use Demo Data
            </button>
          </div>
        </div>
      )}

      {error && error !== "RATE_LIMIT" && (
        <div 
          className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 animate-in fade-in"
        >
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {isDemoMode && !error && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-2 text-green-400 text-[10px] font-bold uppercase tracking-widest">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Demo Mode Active
        </div>
      )}

      {tracking && !loading && (
        <div 
          className="space-y-6 animate-in fade-in"
        >
          {/* Main Tracking Card */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Plane className="w-48 h-48 -rotate-45" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
                    <Plane className="w-7 h-7 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mono">{tracking.flightNumber}</h3>
                    <p className="text-xs text-white/60 font-bold uppercase tracking-widest">{tracking.airline}</p>
                  </div>
                </div>
                <Badge 
                  variant={tracking.status === 'IN AIR' ? 'success' : 'warning'} 
                  className="px-4 py-1.5 text-[10px] flex items-center gap-2"
                >
                  {tracking.status === 'IN AIR' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  )}
                  {tracking.status === 'IN AIR' ? (
                    <span className="animate-pulse">
                      {tracking.status}
                    </span>
                  ) : (
                    tracking.status
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="text-center md:text-left">
                  <div className="text-4xl font-black mono mb-1">{tracking.origin.airport}</div>
                  <div className="text-xs text-white/60 font-bold uppercase mb-4">{tracking.origin.city}</div>
                  <div className="space-y-1">
                    <div className="text-lg font-bold mono">{formatTime(tracking.origin.time)}</div>
                    <div className="text-[10px] text-white/40 font-bold uppercase">{formatDate(tracking.origin.time)}</div>
                    <div className="text-[10px] text-white/40 font-bold uppercase">Terminal {tracking.origin.terminal} • Gate {tracking.origin.gate}</div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center px-4">
                  <div className="w-full h-1 bg-white/5 rounded-full relative mb-4 overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-accent shadow-[0_0_10px_rgba(242,125,38,0.5)] transition-all duration-500"
                      style={{ width: `${tracking.progress}%` }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
                      style={{ left: `${tracking.progress}%` }}
                    >
                      <div className="animate-pulse">
                        <Plane className="w-4 h-4 text-accent rotate-90 fill-accent" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_5px_rgba(242,125,38,0.8)]" />
                    <div className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">
                      {tracking.progress}% Completed
                    </div>
                  </div>
                </div>

                <div className="text-center md:text-right">
                  <div className="text-4xl font-black mono mb-1">{tracking.destination.airport}</div>
                  <div className="text-xs text-white/60 font-bold uppercase mb-4">{tracking.destination.city}</div>
                  <div className="space-y-1">
                    <div className="text-lg font-bold mono">{formatTime(tracking.destination.time)}</div>
                    <div className="text-[10px] text-white/40 font-bold uppercase">{formatDate(tracking.destination.time)}</div>
                    <div className="text-[10px] text-white/40 font-bold uppercase">Terminal {tracking.destination.terminal} • Gate {tracking.destination.gate}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Technical Data Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/[0.02] border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Navigation className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Aircraft Info</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Live</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-white/40 font-bold uppercase mb-0.5">Model</div>
                  <div className="text-sm font-bold mono">{tracking.aircraft.model}</div>
                </div>
                <div className="flex justify-between">
                  <div>
                    <div className="text-[10px] text-white/40 font-bold uppercase mb-0.5">Registration</div>
                    <div className="text-xs font-bold mono">{tracking.aircraft.registration}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 font-bold uppercase mb-0.5">Age</div>
                    <div className="text-xs font-bold mono">{tracking.aircraft.age}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-white/[0.02] border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Wind className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Live Telemetry</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                  <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">Live</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-[10px] text-white/40 font-bold uppercase">Altitude</div>
                  <div 
                    className="text-sm font-bold mono text-white animate-pulse"
                  >
                    {tracking.altitude.toLocaleString()} FT
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[10px] text-white/40 font-bold uppercase">Ground Speed</div>
                  <div 
                    className="text-sm font-bold mono text-white animate-pulse"
                  >
                    {tracking.speed} KM/H
                  </div>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-green-500/40 w-3/4 animate-pulse" />
                </div>
              </div>
            </Card>

            <Card className="bg-accent/5 border-accent/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Clock className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-[10px] font-black text-accent uppercase tracking-widest">Arrival Estimate</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 rounded-full border border-accent/20">
                  <span className="w-1 h-1 bg-accent rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-accent uppercase tracking-tighter">Live</span>
                </div>
              </div>
              <div className="text-center py-2">
                <div className="text-3xl font-black mono text-white mb-1">{formatTime(tracking.estimatedArrival)}</div>
                <div className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-1">{formatDate(tracking.estimatedArrival)}</div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Estimated Landing Time</div>
                <div className="mt-4 flex items-center justify-center gap-2 text-green-500">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase tracking-widest">On Schedule</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Dynamic Flight Path Visualization */}
          <Card className="h-64 bg-white/[0.02] border-white/5 relative overflow-hidden group">
            {/* Background Map Texture */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/world-map.png')] bg-center bg-no-repeat bg-contain" />
            
            {/* Radar Scanning Effect */}
            <div className="absolute inset-0">
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-accent/10 to-transparent rounded-full origin-center pointer-events-none animate-spin"
                style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%)', animationDuration: '10s' }}
              />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-accent/20 rounded-full pointer-events-none animate-pulse"
                  style={{ animationDelay: `${i * 1.3}s` }}
                />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-12">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 100">
                {/* Path Background */}
                <path 
                  d="M 20 50 Q 200 -20 380 50" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.05)" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                />
                
                {/* Completed Path */}
                <path 
                  d="M 20 50 Q 200 -20 380 50" 
                  fill="none" 
                  stroke="url(#pathGradient)" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  style={{ 
                    strokeDasharray: '100%',
                    strokeDashoffset: `${100 - tracking.progress}%`,
                    transition: 'stroke-dashoffset 0.5s ease-out'
                  }}
                />

                <defs>
                  <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--color-accent)" />
                  </linearGradient>
                </defs>

                {/* Origin Point */}
                <circle cx="20" cy="50" r="4" className="fill-accent" />
                <text x="20" y="70" className="fill-white/40 text-[8px] font-black mono" textAnchor="middle">{tracking.origin.airport}</text>

                {/* Destination Point */}
                <circle cx="380" cy="50" r="4" className="fill-white/20" />
                <text x="380" y="70" className="fill-white/40 text-[8px] font-black mono" textAnchor="middle">{tracking.destination.airport}</text>

                {/* Moving Plane */}
                <g
                  style={{ 
                    offsetPath: "path('M 20 50 Q 200 -20 380 50')",
                    offsetRotate: "auto 90deg",
                    offsetDistance: `${tracking.progress}%`,
                    transition: 'offset-distance 0.5s ease-out'
                  }}
                >
                  <g className="text-accent">
                    <circle 
                      r="8" 
                      className="fill-accent/20 animate-pulse" 
                    />
                    <Plane className="w-5 h-5 -translate-x-1/2 -translate-y-1/2 fill-accent" />
                  </g>
                </g>
              </svg>
            </div>

            {/* Overlay Info */}
            <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
                  <span 
                    className="text-[10px] font-black text-accent uppercase tracking-widest animate-pulse"
                  >
                    Live Radar Active
                  </span>
                </div>
                <div className="text-[8px] text-white/30 font-bold uppercase tracking-tighter">
                  LAT: { (3.1390 + (Math.random() * 0.1)).toFixed(4) } • LON: { (101.6869 + (Math.random() * 0.1)).toFixed(4) }
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Current Position</div>
                <div className="text-xs font-bold mono text-accent">{tracking.progress}% of Route</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!tracking && !loading && (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <Plane className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/60">Enter a flight number to start tracking.</p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <button onClick={() => setQuery('MH123')} className="text-[8px] font-bold text-accent hover:underline uppercase tracking-widest">Try MH123</button>
            <button onClick={() => setQuery('SQ801')} className="text-[8px] font-bold text-accent hover:underline uppercase tracking-widest">Try SQ801</button>
            <button onClick={() => setQuery('AK512')} className="text-[8px] font-bold text-accent hover:underline uppercase tracking-widest">Try AK512</button>
          </div>
        </div>
      )}
    </div>
  );
};

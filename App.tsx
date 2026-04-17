import React, { useState, useEffect } from 'react';
import { 
  Plane, 
  Search, 
  Clock, 
  MapPin, 
  Info, 
  ChevronRight, 
  ArrowRight, 
  Wind, 
  Navigation,
  AlertCircle,
  Activity,
  TrendingDown,
  Save,
  ArrowRightLeft,
  LogIn,
  LogOut,
  User as UserIcon,
  Mail,
  Trash2,
  Heart,
  Calendar,
} from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { format, parseISO } from 'date-fns';
import { searchFlight, Itinerary, FlightLeg } from './services/flightService';
import { Card, Badge } from './components/UI';
import { AirportSelector } from './components/AirportSelector';
import { CalendarSelector } from './components/CalendarSelector';
import { LiveFlightView } from './components/LiveFlightView';
import { cn } from './lib/utils';
import { AIRPORT_REGIONS } from './constants/airports';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';

export default function App() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<'reliability' | 'price'>('reliability');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedFilterAirline, setSavedFilterAirline] = useState('');
  
  // Advanced Filters
  const [filterAirline, setFilterAirline] = useState<string>('');
  const [filterStops, setFilterStops] = useState<number | null>(null);
  const [filterTimeOfDay, setFilterTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | null>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'search' | 'live' | 'saved' | 'profile'>('search');

  // Live Tracking State
  const [liveFlightNumber, setLiveFlightNumber] = useState('');
  const [trackingFlight, setTrackingFlight] = useState<any | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Firebase State
  const [user, setUser] = useState<User | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<any[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedItineraries([]);
      return;
    }

    const q = query(collection(db, 'saved_itineraries'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const saved = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedItineraries(saved);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'saved_itineraries');
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    
    setLoading(true);
    setIsSearching(true);
    setError(null);
    try {
      const results = await searchFlight(`${origin} to ${destination} on ${date}`, isDemoMode);
      setItineraries(results);
    } catch (err: any) {
      if (err.message === "RATE_LIMIT_EXCEEDED") {
        setError("RATE_LIMIT");
      } else {
        setError("An error occurred while searching for flights.");
      }
    } finally {
      setLoading(false);
    }
  };

  const enableDemoMode = () => {
    setIsDemoMode(true);
    setError(null);
    handleSearch();
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await searchFlight("Popular routes from KUL");
        setItineraries(results);
      } catch (err: any) {
        console.warn("Initial search failed", err);
        // Don't set global error for background init, just log it
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const filteredItineraries = itineraries.filter(itinerary => {
    const firstLeg = itinerary.legs[0];
    const depHour = parseISO(firstLeg.departure.scheduled).getHours();
    
    // Airline filter
    if (filterAirline && !itinerary.legs.some(leg => leg.airline === filterAirline)) return false;
    
    // Stops filter
    if (filterStops !== null && (itinerary.legs.length - 1) !== filterStops) return false;
    
    // Time of day filter
    if (filterTimeOfDay === 'morning' && (depHour < 6 || depHour >= 12)) return false;
    if (filterTimeOfDay === 'afternoon' && (depHour < 12 || depHour >= 18)) return false;
    if (filterTimeOfDay === 'evening' && (depHour < 18 && depHour >= 6)) return false; // Simple evening logic

    return true;
  });

  const sortedItineraries = [...filteredItineraries].sort((a, b) => {
    if (sortBy === 'reliability') return b.reliabilityScore - a.reliabilityScore;
    return a.price - b.price;
  });

  const uniqueAirlines = Array.from(new Set(itineraries.flatMap(it => it.legs.map(l => l.airline))));

  const handleSelectApiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setError(null);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // Handle specific Firebase Auth popup errors
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User closed the popup or multiple requests were made, ignore or log as info
        console.log("Sign in cancelled by user");
        return;
      }
      console.error("Sign in failed", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setSelectedItinerary(null);
      setShowSavedOnly(false);
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  const handleSaveItinerary = async (itinerary: Itinerary) => {
    if (!user) {
      handleSignIn();
      return;
    }

    const docId = `${user.uid}_${itinerary.id}`;
    const path = `saved_itineraries/${docId}`;
    
    try {
      await setDoc(doc(db, 'saved_itineraries', docId), {
        uid: user.uid,
        itineraryId: itinerary.id,
        origin: itinerary.legs[0].departure.airport,
        destination: itinerary.legs[itinerary.legs.length - 1].arrival.airport,
        reliabilityScore: itinerary.reliabilityScore,
        price: itinerary.price,
        legs: itinerary.legs,
        status: itinerary.status,
        connectionRisk: itinerary.connectionRisk,
        connectionRiskValue: itinerary.connectionRiskValue,
        savedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteSaved = async (savedId: string) => {
    const path = `saved_itineraries/${savedId}`;
    try {
      await deleteDoc(doc(db, 'saved_itineraries', savedId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleShareEmail = (itinerary: Itinerary) => {
    const firstLeg = itinerary.legs[0];
    const lastLeg = itinerary.legs[itinerary.legs.length - 1];
    const subject = encodeURIComponent(`Flight Itinerary: ${firstLeg.departure.airport} to ${lastLeg.arrival.airport}`);
    
    let bodyText = `Check out this flight itinerary I found on SmartFlight!\n\n`;
    bodyText += `Route: ${firstLeg.departure.airport} to ${lastLeg.arrival.airport}\n`;
    bodyText += `Reliability Score: ${itinerary.reliabilityScore}/10\n`;
    bodyText += `Price: RM${itinerary.price}\n`;
    bodyText += `Status: ${itinerary.status}\n\n`;
    bodyText += `Flight Details:\n`;
    
    itinerary.legs.forEach((leg, i) => {
      bodyText += `${i + 1}. ${leg.airline} ${leg.flightNumber}\n`;
      bodyText += `   Dep: ${leg.departure.airport} at ${format(parseISO(leg.departure.scheduled), 'HH:mm')}\n`;
      bodyText += `   Arr: ${leg.arrival.airport} at ${format(parseISO(leg.arrival.scheduled), 'HH:mm')}\n\n`;
    });
    
    bodyText += `View more details on SmartFlight.`;
    
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-white overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => { setActiveTab('search'); setSelectedItinerary(null); }}
          >
            <div className="w-10 h-10 bg-accent rounded-xl flex flex-col items-center justify-center shadow-lg shadow-accent/20 leading-none">
              <Plane className="text-white w-5 h-5 -rotate-45 mb-0.5" />
              <span className="text-[8px] font-black text-white tracking-tighter">SF</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold tracking-tight leading-none">SmartFlight</h1>
              <p className="text-[8px] text-muted uppercase tracking-widest font-bold mt-1">Decision Support</p>
            </div>
          </div>

          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => { setActiveTab('search'); setSelectedItinerary(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                activeTab === 'search' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-white hover:bg-white/5"
              )}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Search</span>
            </button>

            <button 
              onClick={() => { setActiveTab('live'); setSelectedItinerary(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                activeTab === 'live' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-white hover:bg-white/5"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Live</span>
            </button>
            
            <button 
              onClick={() => { setActiveTab('saved'); setSelectedItinerary(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                activeTab === 'saved' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-muted hover:text-white hover:bg-white/5"
              )}
            >
              <Heart className={cn("w-3.5 h-3.5", activeTab === 'saved' && "fill-current")} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Saved</span>
            </button>
            
            <button 
              onClick={() => { setActiveTab('profile'); setSelectedItinerary(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                activeTab === 'profile' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-white hover:bg-white/5"
              )}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        <div>
          {selectedItinerary ? (
            <ItineraryDetailView 
              itinerary={selectedItinerary} 
              allItineraries={itineraries}
              onBack={() => setSelectedItinerary(null)} 
              onSave={() => handleSaveItinerary(selectedItinerary)}
              onShare={() => handleShareEmail(selectedItinerary)}
              onSelectAlternative={(alt) => setSelectedItinerary(alt)}
              isSaved={savedItineraries.some(s => s.itineraryId === selectedItinerary.id)}
              searchDate={date}
            />
          ) : activeTab === 'search' ? (
            <motion.div 
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Search Form */}
              <header>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AirportSelector 
                      label="Origin"
                      value={origin}
                      onChange={setOrigin}
                      icon={<MapPin className="w-4 h-4" />}
                      placeholder="Select Departure"
                    />
                    <AirportSelector 
                      label="Destination"
                      value={destination}
                      onChange={setDestination}
                      icon={<Navigation className="w-4 h-4" />}
                      placeholder="Select Arrival"
                    />
                    <CalendarSelector 
                      label="Travel Date"
                      value={date}
                      onChange={setDate}
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-accent/80 hover:border-white/20 border border-accent transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Activity className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Search Smart Itineraries
                      </>
                    )}
                  </button>
                </form>

                {error === "RATE_LIMIT" && (
                  <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-2xl space-y-3">
                    <div className="flex items-center gap-3 text-accent text-xs font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p>Shared API Quota Exceeded</p>
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">
                      The shared platform key is currently at its limit. You can fix this by adding your own key, or try the app with demo data.
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSelectApiKey}
                        className="flex-1 py-2 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent/80 transition-all"
                      >
                        Fix with My Key
                      </button>
                      <button 
                        onClick={enableDemoMode}
                        className="flex-1 py-2 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all border border-white/10"
                      >
                        Use Demo Data
                      </button>
                    </div>
                  </div>
                )}

                {error && error !== "RATE_LIMIT" && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {isDemoMode && !error && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Demo Mode Active
                    </div>
                    <button 
                      onClick={() => setIsDemoMode(false)}
                      className="text-[8px] font-black text-muted hover:text-white uppercase tracking-widest"
                    >
                      Disable
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => setSortBy('reliability')}
                      className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border", 
                        sortBy === 'reliability' ? "bg-accent text-white border-accent" : "bg-white/5 text-white/70 hover:bg-white/10 hover:border-accent/30 border-white/10")}
                    >
                      Reliability First
                    </button>
                    <span className="text-[8px] text-white/50 ml-2">Prioritizes historical on-time performance</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => setSortBy('price')}
                      className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border", 
                        sortBy === 'price' ? "bg-accent text-white border-accent" : "bg-white/5 text-white/70 hover:bg-white/10 hover:border-accent/30 border-white/10")}
                    >
                      Lowest Price
                    </button>
                    <span className="text-[8px] text-white/50 ml-2">Sorts by the most affordable fares</span>
                  </div>
                </div>

                {/* Advanced Filters UI */}
                {itineraries.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Airline</span>
                      <select 
                        value={filterAirline}
                        onChange={(e) => setFilterAirline(e.target.value)}
                        className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-[10px] mono focus:border-accent outline-none"
                      >
                        <option value="">All Airlines</option>
                        {uniqueAirlines.map(airline => (
                          <option key={airline} value={airline}>{airline}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Stops</span>
                      <select 
                        value={filterStops === null ? "" : filterStops}
                        onChange={(e) => setFilterStops(e.target.value === "" ? null : parseInt(e.target.value))}
                        className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-[10px] mono focus:border-accent outline-none"
                      >
                        <option value="">Any Stops</option>
                        <option value="0">Non-stop</option>
                        <option value="1">1 Stop</option>
                        <option value="2">2+ Stops</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[8px] font-black text-muted uppercase tracking-widest ml-1">Time</span>
                      <select 
                        value={filterTimeOfDay || ""}
                        onChange={(e) => setFilterTimeOfDay(e.target.value as any || null)}
                        className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-[10px] mono focus:border-accent outline-none"
                      >
                        <option value="">Any Time</option>
                        <option value="morning">Morning (6am-12pm)</option>
                        <option value="afternoon">Afternoon (12pm-6pm)</option>
                        <option value="evening">Evening (6pm-6am)</option>
                      </select>
                    </div>

                    <button 
                      onClick={() => {
                        setFilterAirline('');
                        setFilterStops(null);
                        setFilterTimeOfDay(null);
                      }}
                      className="mt-auto text-[8px] font-bold text-accent hover:underline uppercase tracking-widest pb-2"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </header>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">
                      {isSearching ? 'Recommended Itineraries' : 'Popular Routes'}
                    </h2>
                    {isSearching && (
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-accent" />
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
                          {format(parseISO(date), 'EEE, dd MMM yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] mono text-white/40">{sortedItineraries.length} OPTIONS FOUND</span>
                </div>
                
                {sortedItineraries.map((itinerary) => (
                  <ItineraryCard 
                    key={itinerary.id} 
                    itinerary={itinerary} 
                    onClick={() => setSelectedItinerary(itinerary)} 
                    onSave={(e) => { e.stopPropagation(); handleSaveItinerary(itinerary); }}
                    isSaved={savedItineraries.some(s => s.itineraryId === itinerary.id)}
                    searchDate={date}
                  />
                ))}

                {sortedItineraries.length === 0 && !loading && (
                  <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <Plane className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/60">No itineraries found matching your filters.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'live' ? (
            <motion.div 
              key="live"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <LiveFlightView isDemoMode={isDemoMode} onEnableDemo={enableDemoMode} />
            </motion.div>
          ) : activeTab === 'saved' ? (
            <motion.div 
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-2 px-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight flex items-center gap-3">
                    <Heart className="w-6 h-6 text-red-500 fill-current" />
                    Saved Trips
                  </h2>
                  <span className="text-[10px] mono text-white/60">{savedItineraries.length} SAVED</span>
                </div>
                <p className="text-xs text-white/70">Manage and track your favorite flight itineraries and price alerts.</p>
              </div>

              {user && savedItineraries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input 
                      type="text"
                      placeholder="Search saved trips..."
                      value={savedSearchQuery}
                      onChange={(e) => setSavedSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:border-accent outline-none transition-all"
                    />
                  </div>
                  <select 
                    value={savedFilterAirline}
                    onChange={(e) => setSavedFilterAirline(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-accent outline-none transition-all"
                  >
                    <option value="">All Airlines</option>
                    {Array.from(new Set(savedItineraries.flatMap(s => s.legs.map((l: FlightLeg) => l.airline)))).map(airline => (
                      <option key={airline} value={airline}>{airline}</option>
                    ))}
                  </select>
                </div>
              )}

              {!user ? (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <LogIn className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/60 mb-6">Sign in to view and manage your saved trips.</p>
                  <button 
                    onClick={handleSignIn}
                    className="bg-accent text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-accent/80 transition-all"
                  >
                    Sign In Now
                  </button>
                </div>
              ) : savedItineraries.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <Heart className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/60">You haven't saved any itineraries yet.</p>
                  <button 
                    onClick={() => setActiveTab('search')}
                    className="mt-6 text-accent font-bold uppercase tracking-widest text-xs hover:underline"
                  >
                    Start Searching
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const filteredSaved = savedItineraries.filter(saved => {
                      if (!saved.legs) return false;
                      const matchesSearch = saved.legs.some((l: FlightLeg) => 
                        l.departure?.city?.toLowerCase().includes(savedSearchQuery.toLowerCase()) ||
                        l.arrival?.city?.toLowerCase().includes(savedSearchQuery.toLowerCase()) ||
                        l.airline?.toLowerCase().includes(savedSearchQuery.toLowerCase())
                      );
                      const matchesAirline = !savedFilterAirline || saved.legs.some((l: FlightLeg) => l.airline === savedFilterAirline);
                      return matchesSearch && matchesAirline;
                    });

                    if (filteredSaved.length === 0) {
                      return (
                        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                          <Search className="w-12 h-12 text-muted/20 mx-auto mb-4" />
                          <p className="text-muted">No saved trips match your search or filter criteria.</p>
                          <button 
                            onClick={() => { setSavedSearchQuery(''); setSavedFilterAirline(''); }}
                            className="mt-4 text-accent font-bold uppercase tracking-widest text-[10px] hover:underline"
                          >
                            Clear Search & Filters
                          </button>
                        </div>
                      );
                    }

                    return filteredSaved.map((saved) => (
                      <div key={saved.id}>
                        <ItineraryCard 
                          itinerary={{
                            id: saved.itineraryId,
                            legs: saved.legs,
                            reliabilityScore: saved.reliabilityScore,
                            price: saved.price,
                            status: saved.status,
                            connectionRisk: saved.connectionRisk,
                            connectionRiskValue: saved.connectionRiskValue,
                            totalDuration: '',
                          }} 
                          onRemove={(e) => { e.stopPropagation(); handleDeleteSaved(saved.id); }}
                          onClick={() => setSelectedItinerary({
                            id: saved.itineraryId,
                            legs: saved.legs,
                            reliabilityScore: saved.reliabilityScore,
                            price: saved.price,
                            status: saved.status,
                            connectionRisk: saved.connectionRisk,
                            connectionRiskValue: saved.connectionRiskValue,
                            totalDuration: '',
                          })} 
                        />
                      </div>
                    ));
                  })()}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-3">
                  <UserIcon className="w-6 h-6 text-accent" />
                  Account Settings
                </h2>
                <p className="text-xs text-muted">Manage your profile, preferences, and account details.</p>
              </div>

              <Card className="border-white/10">
                {isAuthLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Activity className="w-8 h-8 text-accent animate-spin" />
                  </div>
                ) : user ? (
                  <div className="space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-accent/20 rounded-3xl flex items-center justify-center border border-accent/30 overflow-hidden">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserIcon className="w-10 h-10 text-accent" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{user.displayName || 'SmartFlight User'}</h3>
                        <p className="text-muted mono text-sm">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-green-500">Verified Account</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div className="p-4 bg-white/5 rounded-2xl">
                        <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Saved</div>
                        <div className="text-2xl font-black mono">{savedItineraries.length}</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl">
                        <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Account Type</div>
                        <div className="text-2xl font-black mono text-accent">FREE</div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-white/60">Quota Management</h4>
                        <p className="text-[10px] text-muted leading-relaxed">
                          If you are experiencing "Quota Exceeded" errors, you can use your own Gemini API key from a paid Google Cloud project.
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", hasApiKey ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]")} />
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest">
                              {hasApiKey ? "Personal API Key Active" : "Using Shared Platform Quota"}
                            </div>
                            <div className="text-[8px] text-muted font-bold uppercase">
                              {hasApiKey ? "Dedicated limits enabled" : "Limited requests per minute"}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={handleSelectApiKey}
                          className="px-4 py-2 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent/80 transition-all"
                        >
                          {hasApiKey ? "Change Key" : "Select Key"}
                        </button>
                      </div>
                      
                      <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[8px] font-bold text-accent hover:underline uppercase tracking-widest"
                      >
                        <Info className="w-3 h-3" />
                        Learn how to set up a paid API key
                      </a>
                    </div>

                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-3 bg-red-500/10 text-red-500 py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                    >
                      <LogOut className="w-5 h-5" />
                      Sign Out of SmartFlight
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <UserIcon className="w-8 h-8 text-muted" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Not Signed In</h3>
                    <p className="text-muted text-sm mb-8">Sign in to sync your saved trips across devices and access all features.</p>
                    <button 
                      onClick={handleSignIn}
                      className="w-full bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3"
                    >
                      <LogIn className="w-5 h-5" />
                      Sign In with Google
                    </button>
                  </div>
                )}
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white/5 border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest">Search History</span>
                  </div>
                  <p className="text-[10px] text-muted">View your recent flight searches and itineraries.</p>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingDown className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest">Price Alerts</span>
                  </div>
                  <p className="text-[10px] text-muted">Get notified when prices drop for your saved routes.</p>
                </Card>
              </div>
            </motion.div>
          )}
        </div>
      </main>
      <SpeedInsights />
    </div>
  );
}

const ItineraryCard: React.FC<{ 
  itinerary: Itinerary, 
  onClick: () => void,
  onSave?: (e: React.MouseEvent) => void,
  onRemove?: (e: React.MouseEvent) => void,
  isSaved?: boolean,
  searchDate?: string
}> = ({ itinerary, onClick, onSave, onRemove, isSaved, searchDate }) => {
  const statusColors = {
    'RELIABLE': 'success',
    'CAUTION': 'warning',
    'HIGH RISK': 'error',
  } as const;

  const firstLeg = itinerary.legs[0];
  const lastLeg = itinerary.legs[itinerary.legs.length - 1];
  const isConnecting = itinerary.legs.length > 1;

  const riskLabels = {
    'RELIABLE': 'Stable Route • High probability of on-time arrival',
    'CAUTION': 'Moderate Risk • Potential for minor delays',
    'HIGH RISK': 'Unstable Route • High probability of disruption',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className="hover:bg-white/[0.07] hover:border-accent/40 transition-all group border border-white/10 relative overflow-hidden">
        {/* Real-time Status Simulation */}
        <div className="absolute top-0 right-0 px-3 py-1 bg-accent/10 border-b border-l border-accent/20 rounded-bl-lg flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[8px] font-black text-accent uppercase tracking-widest">Live: On Time</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-accent/10 transition-colors relative">
              <div className="text-center">
                <div className="text-[10px] font-black mono text-accent leading-none">{itinerary.reliabilityScore}</div>
                <div className="text-[8px] text-white/80 font-bold uppercase">Score</div>
              </div>
              {itinerary.reliabilityScore >= 9 && itinerary.price < 1000 && (
                <div className="absolute -top-2 -left-2 bg-accent text-white text-[6px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-bounce uppercase">
                  Best Value
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold mono">
                  {firstLeg.departure.airport} → {lastLeg.arrival.airport}
                </h3>
                <Badge variant={statusColors[itinerary.status]}>{itinerary.status}</Badge>
                {itinerary.reliabilityScore >= 9.5 && (
                  <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20">Top Choice</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-accent uppercase tracking-widest">
                  {itinerary.legs.map(l => l.airline).filter((v, i, a) => a.indexOf(v) === i).join(' + ')}
                </span>
                {isConnecting && (
                  <span className="text-[8px] text-white/60 uppercase font-bold">
                    • {itinerary.legs.length - 1} Stop{itinerary.legs.length > 2 ? 's' : ''}
                  </span>
                )}
                {searchDate && (
                  <span className="text-[8px] text-white/60 uppercase font-bold flex items-center gap-1">
                    • <Calendar className="w-2 h-2" /> {format(parseISO(searchDate), 'dd MMM')}
                  </span>
                )}
              </div>
              <p className="text-white/80 text-[10px] uppercase tracking-wider font-medium mt-1">
                {riskLabels[itinerary.status]}
              </p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <div className="text-xs text-white/60 mono mb-1">EST. PRICE</div>
              <div className="text-lg font-bold mono text-accent">RM{itinerary.price}</div>
            </div>
            {onSave && (
              <button
                onClick={onSave}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                  isSaved 
                    ? "bg-red-500/10 text-red-500 border-red-500/20" 
                    : "bg-white/5 text-muted border-white/10 hover:bg-accent/10 hover:text-accent hover:border-accent/20"
                )}
              >
                <Heart className={cn("w-3 h-3", isSaved && "fill-current")} />
                {isSaved ? "Saved" : "Save"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between text-xs mono text-white/90 bg-white/5 p-3 rounded-lg">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-accent" />
                <span>DEP: {format(parseISO(firstLeg.departure.scheduled), 'HH:mm')} • {format(parseISO(firstLeg.departure.scheduled), 'dd MMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3 h-3 text-accent" />
                <span>RISK: {itinerary.connectionRiskValue}%</span>
              </div>
            </div>
            {onRemove && (
              <button
                onClick={onRemove}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 rounded-lg transition-all hover:bg-red-500 hover:text-white border border-red-500/20 text-[8px] font-black uppercase tracking-widest"
              >
                <Trash2 className="w-3 h-3" />
                Remove Trip
              </button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ItineraryDetailView({ 
  itinerary, 
  allItineraries,
  onBack, 
  onSave, 
  onShare,
  onSelectAlternative,
  isSaved,
  searchDate
}: { 
  itinerary: Itinerary, 
  allItineraries: Itinerary[],
  onBack: () => void, 
  onSave: () => void,
  onShare: () => void,
  onSelectAlternative: (alt: Itinerary) => void,
  isSaved: boolean,
  searchDate?: string
}) {
  const firstLeg = itinerary.legs[0];
  const lastLeg = itinerary.legs[itinerary.legs.length - 1];

  // Dynamic Alternatives Logic (F009)
  const otherItineraries = allItineraries.filter(it => it.id !== itinerary.id);
  
  const higherReliability = [...otherItineraries]
    .filter(it => it.reliabilityScore > itinerary.reliabilityScore)
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0];

  const betterPrice = [...otherItineraries]
    .filter(it => it.price < itinerary.price)
    .sort((a, b) => a.price - b.price)[0];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Results
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={onShare}
            className="flex items-center gap-2 bg-white/5 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:border-accent/50 transition-all border border-white/10"
          >
            <Mail className="w-4 h-4" />
            Share
          </button>
          <button 
            onClick={onSave}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg border",
              isSaved 
                ? "bg-red-500 text-white shadow-red-500/20 border-red-500" 
                : "bg-accent text-white shadow-accent/20 hover:bg-accent/80 border-accent hover:border-white/20"
            )}
          >
            {isSaved ? <Heart className="w-4 h-4 fill-current" /> : <Save className="w-4 h-4" />}
            {isSaved ? 'Saved' : 'Save Itinerary'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Reliability Card */}
        <Card className="md:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Plane className="w-48 h-48 -rotate-45" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-4xl font-black mono mb-1">{itinerary.reliabilityScore}/10</h2>
                <p className="text-white/60 font-bold uppercase tracking-[0.2em] text-xs">Route Reliability Score</p>
                {searchDate && (
                  <div className="flex items-center gap-2 mt-2 text-accent">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {format(parseISO(searchDate), 'EEE, dd MMM yyyy')}
                    </span>
                  </div>
                )}
              </div>
              <Badge variant={itinerary.status === 'RELIABLE' ? 'success' : 'warning'}>{itinerary.status}</Badge>
            </div>

            <div className="space-y-8">
              {itinerary.legs.map((leg, index) => (
                <div key={leg.id} className="relative">
                  {index < itinerary.legs.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-[-24px] w-[1px] bg-dashed border-l border-white/10" />
                  )}
                  <div className="flex gap-6">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0">
                      <Plane className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-lg font-bold mono">{leg.flightNumber} • {leg.airline}</h4>
                        <div className="text-[10px] mono text-white/50 font-bold">DISRUPTION PROB: {(leg.disruptionProbability * 100).toFixed(1)}%</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-white/70 font-bold uppercase">{leg.departure.airport} → {leg.arrival.airport}</div>
                        <div className="text-right">
                          <div className="mono font-bold text-accent">{format(parseISO(leg.departure.scheduled), 'HH:mm')} - {format(parseISO(leg.arrival.scheduled), 'HH:mm')}</div>
                          <div className="text-[10px] text-white/40 font-bold uppercase">{format(parseISO(leg.departure.scheduled), 'dd MMM yyyy')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Connection Risk Card */}
        <Card className="flex flex-col justify-between border-accent/20 bg-accent/5">
          <div>
            <div className="flex items-center gap-2 text-accent mb-6">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Connection Risk Assessment</span>
            </div>
            <div className="text-center py-6">
              <div className="text-5xl font-black mono text-white mb-2">{itinerary.connectionRiskValue}%</div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Probability of Missed Connection</p>
            </div>
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60 uppercase font-bold">Risk Level</span>
                <Badge variant={itinerary.connectionRisk === 'LOW' ? 'success' : 'warning'}>{itinerary.connectionRisk}</Badge>
              </div>
              <div className="p-3 bg-white/5 rounded-lg text-[10px] text-white/80 leading-relaxed italic border border-white/5">
                "Based on historical delay propagation and airport transfer characteristics at {itinerary.legs[0].arrival.airport}."
              </div>
            </div>
          </div>
        </Card>

        {/* Alternative Suggestions (F009) */}
        <div className="md:col-span-3 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/60 px-2">Alternative Suggestions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {higherReliability ? (
              <Card 
                onClick={() => onSelectAlternative(higherReliability)}
                className="bg-white/[0.02] border-dashed border-white/10 hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-green-400 -rotate-45" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Higher Reliability Option</span>
                  </div>
                  <div className="text-sm font-bold mono text-accent">
                    {higherReliability.price > itinerary.price ? `RM+${higherReliability.price - itinerary.price}` : `RM-${itinerary.price - higherReliability.price}`}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold mono group-hover:text-accent transition-colors">
                    {higherReliability.legs[0].airline} • {higherReliability.legs[0].flightNumber}
                  </div>
                  <div className="text-xs mono text-muted">Score: {higherReliability.reliabilityScore}/10</div>
                </div>
              </Card>
            ) : (
              <div className="p-8 bg-white/5 rounded-3xl border border-dashed border-white/10 flex items-center justify-center text-[10px] text-muted uppercase tracking-widest">
                No higher reliability options found
              </div>
            )}

            {betterPrice ? (
              <Card 
                onClick={() => onSelectAlternative(betterPrice)}
                className="bg-white/[0.02] border-dashed border-white/10 hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Better Price Option</span>
                  </div>
                  <div className="text-sm font-bold mono text-accent">RM-{itinerary.price - betterPrice.price}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold mono group-hover:text-accent transition-colors">
                    {betterPrice.legs[0].airline} • {betterPrice.legs[0].flightNumber}
                  </div>
                  <div className="text-xs mono text-muted">Score: {betterPrice.reliabilityScore}/10</div>
                </div>
              </Card>
            ) : (
              <div className="p-8 bg-white/5 rounded-3xl border border-dashed border-white/10 flex items-center justify-center text-[10px] text-muted uppercase tracking-widest">
                No cheaper options found
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

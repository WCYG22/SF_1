import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { MapPin, Navigation, ChevronDown, Globe } from 'lucide-react';
import { AIRPORT_REGIONS, Airport } from '../constants/airports';
import { cn } from '../lib/utils';

interface AirportSelectorProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  icon: React.ReactNode;
  placeholder: string;
}

export function AirportSelector({ label, value, onChange, icon, placeholder }: AirportSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(AIRPORT_REGIONS[0].name);
  const tabsRef = useRef<HTMLDivElement>(null);

  const selectedAirport = AIRPORT_REGIONS.flatMap(r => r.airports).find(a => a.code === value);
  const currentRegion = AIRPORT_REGIONS.find(r => r.name === selectedRegion);

  useEffect(() => {
    if (isOpen && tabsRef.current) {
      const activeButton = tabsRef.current.querySelector(`[data-region="${selectedRegion}"]`);
      if (activeButton) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedRegion, isOpen]);

  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 hover:border-accent/50 transition-all group relative"
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-hover:text-accent transition-colors">
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted uppercase font-bold tracking-widest leading-none mb-1">{label}</span>
          <span className={cn("text-sm mono truncate", !value && "text-muted/50")}>
            {selectedAirport ? `${selectedAirport.city} (${selectedAirport.code})` : placeholder}
          </span>
        </div>
        <ChevronDown className={cn("absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-transform w-4 h-4", isOpen && "rotate-180")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Regions Slider */}
              <div className="relative p-2 border-b border-white/5 bg-white/5">
                <LayoutGroup id={label}>
                  <div 
                    ref={tabsRef}
                    className="flex items-center gap-1 overflow-x-auto no-scrollbar snap-x snap-mandatory px-1"
                  >
                    {AIRPORT_REGIONS.map((region) => (
                      <button
                        key={region.name}
                        data-region={region.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRegion(region.name);
                        }}
                        className={cn(
                          "relative px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors snap-start",
                          selectedRegion === region.name 
                            ? "text-white" 
                            : "text-muted hover:text-white"
                        )}
                      >
                        {selectedRegion === region.name && (
                          <motion.div
                            layoutId="activeRegion"
                            className="absolute inset-0 bg-accent rounded-full -z-10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        {region.name}
                      </button>
                    ))}
                  </div>
                </LayoutGroup>
              </div>

              {/* Swipeable Airports List */}
              <div className="relative overflow-hidden h-[300px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedRegion}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute inset-0 p-2 overflow-y-auto no-scrollbar"
                  >
                    <div className="grid grid-cols-1 gap-1">
                      {currentRegion?.airports.map((airport) => (
                        <button
                          key={airport.code}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(airport.code);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl transition-all text-left group border",
                            value === airport.code 
                              ? "bg-accent/10 border-accent/20" 
                              : "hover:bg-white/5 border-transparent hover:border-accent/30"
                          )}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white group-hover:text-accent transition-colors">{airport.city}</span>
                              <span className="text-[10px] mono text-muted">{airport.code}</span>
                            </div>
                            <div className="text-[10px] text-muted/70">{airport.name}</div>
                          </div>
                          <div className="text-[10px] font-bold text-muted uppercase tracking-wider">{airport.country}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

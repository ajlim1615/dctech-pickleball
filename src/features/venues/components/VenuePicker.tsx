"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Check, Search } from "lucide-react";
import { filterVenues, findVenueForSession } from "../utils/venueUtils";
import type { Venue } from "@/types";

interface VenuePickerProps {
  venues: Venue[];
  name?: string;
  venueIdName?: string;
  defaultValue?: string;
  defaultVenueId?: string | null;
  placeholder?: string;
  className?: string;
}

export function VenuePicker({
  venues,
  name = "location",
  venueIdName = "venueId",
  defaultValue = "",
  defaultVenueId = null,
  placeholder = "Search pickleball venue or type custom location...",
  className = "",
}: VenuePickerProps) {
  const initialMatch = useMemo(
    () => findVenueForSession({ venue_id: defaultVenueId, location: defaultValue }, venues),
    [defaultVenueId, defaultValue, venues]
  );

  const [query, setQuery] = useState(defaultValue);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(initialMatch?.id ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matches = useMemo(() => filterVenues(venues, query, true), [venues, query]);
  const activeMatch = useMemo(
    () => findVenueForSession({ venue_id: selectedVenueId || null, location: query }, venues),
    [selectedVenueId, query, venues]
  );

  function handleInputChange(value: string) {
    setQuery(value);
    const exact = venues.find(
      (v) => v.is_active !== false && v.name.trim().toLowerCase() === value.trim().toLowerCase()
    );
    setSelectedVenueId(exact ? exact.id : "");
    setOpen(true);
  }

  function handleSelect(venue: Venue) {
    setQuery(venue.name);
    setSelectedVenueId(venue.id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={venueIdName} value={selectedVenueId} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          name={name}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none ${className}`}
        />
      </div>

      {activeMatch && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Google Maps link attached
        </p>
      )}

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-lg"
        >
          {matches.map((venue) => {
            const isSelected = venue.id === selectedVenueId;
            return (
              <li key={venue.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(venue);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{venue.name}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">Maps</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

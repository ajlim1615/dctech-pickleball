import { ExternalLink } from "lucide-react";
import { findVenueForSession } from "../utils/venueUtils";
import type { Venue } from "@/types";

interface VenueLocationLinkProps {
  location: string;
  venueId?: string | null;
  venues?: Pick<Venue, "id" | "name" | "maps_url">[];
  className?: string;
}

export function VenueLocationLink({
  location,
  venueId,
  venues = [],
  className = "",
}: VenueLocationLinkProps) {
  const venue = findVenueForSession({ venue_id: venueId, location }, venues);

  if (!venue) {
    return <span className={className}>{location}</span>;
  }

  return (
    <a
      href={venue.maps_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${location} in Google Maps`}
      className={`inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${className}`}
    >
      <span>{location}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
    </a>
  );
}

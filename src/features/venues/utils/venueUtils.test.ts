import { describe, it, expect } from "vitest";
import { isValidMapsUrl, filterVenues, findVenueForSession } from "./venueUtils";

describe("venueUtils", () => {
  it("validates http/https Google Maps URLs and rejects unsafe or invalid inputs", () => {
    expect(isValidMapsUrl("https://maps.app.goo.gl/Ry6qjodsQBR6DavL8")).toBe(true);
    expect(isValidMapsUrl("http://maps.google.com/?q=pickleball")).toBe(true);
    expect(isValidMapsUrl("javascript:alert(1)")).toBe(false);
    expect(isValidMapsUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidMapsUrl("not a url")).toBe(false);
    expect(isValidMapsUrl("")).toBe(false);
    expect(isValidMapsUrl(`https://maps.app.goo.gl/${"a".repeat(500)}`)).toBe(false);
  });

  it("filters venues by case-insensitive substring and active status", () => {
    const venues = [
      { id: "1", name: "The Forge Pickleball Court", maps_url: "https://maps.app.goo.gl/1", is_active: true },
      { id: "2", name: "Balhai CrossCourt", maps_url: "https://maps.app.goo.gl/2", is_active: true },
      { id: "3", name: "Old Closed Court", maps_url: "https://maps.app.goo.gl/3", is_active: false },
    ];
    expect(filterVenues(venues, "forge")).toHaveLength(1);
    expect(filterVenues(venues, "  BALHAI ")).toHaveLength(1);
    expect(filterVenues(venues, "")).toHaveLength(2);
    expect(filterVenues(venues, "", false)).toHaveLength(3);
  });

  it("resolves venue by venue_id first, then falls back to case-insensitive location name", () => {
    const venues = [
      { id: "v1", name: "The Forge", maps_url: "https://maps.app.goo.gl/Ry6qjodsQBR6DavL8" },
      { id: "v2", name: "Flying pickle sports center", maps_url: "https://maps.app.goo.gl/9x3G1UHfAWTGCJ3T8" },
    ];

    // Renamed venue still resolves via venue_id even if session.location has old name
    expect(findVenueForSession({ venue_id: "v1", location: "Old Forge Name" }, venues)?.id).toBe("v1");

    // Legacy session without venue_id falls back to trimmed case-insensitive name match
    expect(
      findVenueForSession({ venue_id: null, location: "  FLYING PICKLE SPORTS CENTER " }, venues)?.maps_url
    ).toBe("https://maps.app.goo.gl/9x3G1UHfAWTGCJ3T8");

    expect(findVenueForSession({ venue_id: null, location: "Custom Arena" }, venues)).toBeNull();
    expect(findVenueForSession({ venue_id: null, location: null }, venues)).toBeNull();
  });
});

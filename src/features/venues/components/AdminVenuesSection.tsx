"use client";

import { useState } from "react";
import { MapPin, Plus, ExternalLink, Pencil, Archive, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createVenue, updateVenue, setVenueActive } from "../api/venueActions";
import type { Venue } from "@/types";

interface AdminVenuesSectionProps {
  venues: Venue[];
  onVenuesChange: (venues: Venue[]) => void;
}

export function AdminVenuesSection({ venues, onVenuesChange }: AdminVenuesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMapsUrl, setNewMapsUrl] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMapsUrl, setEditMapsUrl] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await createVenue({ name: newName, mapsUrl: newMapsUrl, address: newAddress });
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.venue) {
      const next = [...venues, res.venue].sort((a, b) => a.name.localeCompare(b.name));
      onVenuesChange(next);
    }
    setNewName("");
    setNewMapsUrl("");
    setNewAddress("");
    setIsAdding(false);
  }

  function startEdit(venue: Venue) {
    setEditingId(venue.id);
    setEditName(venue.name);
    setEditMapsUrl(venue.maps_url);
    setEditAddress(venue.address || "");
    setError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || pending) return;
    setPending(true);
    setError(null);
    const res = await updateVenue(editingId, {
      name: editName,
      mapsUrl: editMapsUrl,
      address: editAddress,
    });
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.venue) {
      const next = venues
        .map((v) => (v.id === editingId ? res.venue! : v))
        .sort((a, b) => a.name.localeCompare(b.name));
      onVenuesChange(next);
    }
    setEditingId(null);
  }

  async function handleToggleActive(venue: Venue) {
    if (pending) return;
    setPending(true);
    setError(null);
    const nextActive = !venue.is_active;
    const res = await setVenueActive(venue.id, nextActive);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onVenuesChange(
      venues.map((v) => (v.id === venue.id ? { ...v, is_active: nextActive } : v))
    );
  }

  const activeCount = venues.filter((v) => v.is_active !== false).length;

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-500" />
            Pickleball Venues ({activeCount})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saved venues appear in the session location picker with a clickable Google Maps link for players.
          </p>
        </div>
        {!isAdding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setIsAdding(true);
              setError(null);
            }}
            className="cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add venue
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Venue name (e.g. The Forge Pickleball Court)"
              required
              disabled={pending}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="url"
              value={newMapsUrl}
              onChange={(e) => setNewMapsUrl(e.target.value)}
              placeholder="Google Maps link (https://maps.app.goo.gl/...)"
              required
              disabled={pending}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Address or landmark (optional)"
            disabled={pending}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAdding(false)}
              disabled={pending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending} className="cursor-pointer">
              {pending ? "Saving…" : "Save venue"}
            </Button>
          </div>
        </form>
      )}

      {venues.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No venues added yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {venues.map((venue) => {
            const isArchived = venue.is_active === false;
            const isEditing = editingId === venue.id;
            return (
              <li key={venue.id} className="py-2.5 first:pt-0 last:pb-0">
                {isEditing ? (
                  <form onSubmit={handleSaveEdit} className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        disabled={pending}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="url"
                        value={editMapsUrl}
                        onChange={(e) => setEditMapsUrl(e.target.value)}
                        required
                        disabled={pending}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Address (optional)"
                        disabled={pending}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="submit"
                          disabled={pending}
                          aria-label="Save venue"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                          aria-label="Cancel editing venue"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className={`flex flex-wrap items-center justify-between gap-2 ${isArchived ? "opacity-60" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {venue.name}
                        </span>
                        {isArchived && (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            Archived
                          </span>
                        )}
                      </div>
                      <a
                        href={venue.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-full"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{venue.maps_url}</span>
                      </a>
                      {venue.address && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{venue.address}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(venue)}
                        disabled={pending}
                        title="Edit venue"
                        aria-label={`Edit ${venue.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(venue)}
                        disabled={pending}
                        title={isArchived ? "Restore venue" : "Archive venue"}
                        aria-label={isArchived ? `Restore ${venue.name}` : `Archive ${venue.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

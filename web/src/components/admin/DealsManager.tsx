import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package, Loader2, Search, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, GripVertical, Upload, Calendar, Eye, RefreshCw, LocateFixed } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DEAL_CATEGORIES, getDealCategory } from '@/lib/deal-category';
import { useDeals } from '@/hooks/useDeals';
import { api, ApiError } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DealRouteMap } from '@/components/deals/DealRouteMap';
import type { GeoPlace, GeoRoute, ItineraryPhase, RouteGeometry, TourDeal, Waypoint } from '@/types';
import { Lightbox } from '@/components/ui/lightbox';

/**
 * Place search results are cached per query for the session, so re-running the
 * same search doesn't spend another round trip. Cleared on reload.
 */
const geocodeCache = new Map<string, GeoPlace[]>();

/** `lat,lon|lat,lon` — the form the Worker's /geo/route expects. */
function waypointParam(points: Waypoint[]): string {
  // Rounded to 4 decimals (~11m): Geoapify can reject full-precision Leaflet
  // coordinates that land between road segments.
  return points.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|');
}

type DealFormData = {
  title: string;
  slug: string;
  description: string;
  short_description: string;
  destination: string;
  category: string;
  price: number;
  original_price: number;
  duration_days: number;
  max_travelers: number;
  image_url: string;
  gallery: string[];
  inclusions: string;
  exclusions: string;
  is_featured: boolean;
  route_waypoints: Waypoint[];
  route_geometry: RouteGeometry | null;
  itinerary: ItineraryPhase[];
};

const emptyForm: DealFormData = {
  title: '', slug: '', description: '', short_description: '', destination: '', category: '',
  price: 0, original_price: 0, duration_days: 1, max_travelers: 0, image_url: '',
  gallery: [],
  inclusions: '', exclusions: '', is_featured: false, route_waypoints: [], route_geometry: null,
  itinerary: [],
};

export function DealsManager() {
  const { deals, isLoading } = useDeals();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<TourDeal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DealFormData>(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<GeoPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [routeMessage, setRouteMessage] = useState('');
  const [routeStats, setRouteStats] = useState<{ distance: number; time: number } | null>(null);
  const [draggingWaypointIndex, setDraggingWaypointIndex] = useState<number | null>(null);
  const [draggingGalleryIndex, setDraggingGalleryIndex] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPurgingGeoCache, setIsPurgingGeoCache] = useState(false);
  const [snappingWaypointIndex, setSnappingWaypointIndex] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const setRouteWaypoints = (waypoints: Waypoint[]) => {
    setFormData((current) => ({ ...current, route_waypoints: waypoints, route_geometry: null }));
    setRouteStats(null);
    setRouteMessage('');
  };

  const addWaypoint = (waypoint: Waypoint) => {
    setFormData((current) => ({
      ...current,
      route_waypoints: [...current.route_waypoints, waypoint],
      route_geometry: null,
    }));
    setRouteStats(null);
    setRouteMessage('');
    setSearchResults([]);
    setSearchText('');
  };

  const searchPlaces = async () => {
    const query = searchText.trim();
    if (!query) return;
    const cacheKey = query.toLowerCase();
    setIsSearching(true);
    setSearchMessage('');
    try {
      const cached = geocodeCache.get(cacheKey);
      const places = cached ?? (await api.searchPlaces(query)).places;
      if (!cached) geocodeCache.set(cacheKey, places);

      setSearchResults(places);
      if (places.length === 0) setSearchMessage('No places found. Try another name or click the map to place this stop manually.');
    } catch (error) {
      setSearchResults([]);
      const reason = error instanceof Error && error.message ? ` (${error.message})` : '';
      setSearchMessage(`Could not search places${reason}. You can click the map to place this stop manually.`);
    } finally {
      setIsSearching(false);
    }
  };

  const generateRoute = async () => {
    if (formData.route_waypoints.length < 2) {
      setRouteMessage('Add at least two stops to generate a route.');
      return;
    }
    setIsGeneratingRoute(true);
    setRouteMessage('');
    try {
      let route: GeoRoute;
      try {
        route = await api.generateRoute(waypointParam(formData.route_waypoints));
      } catch (error) {
        // Only an unroutable pin is worth retrying with snapped coordinates
        // (Geoapify answers 400 for "no suitable edges"). Auth, rate-limit and
        // server failures must surface instead of being misreported as stops
        // that are off-road.
        const status = error instanceof ApiError ? error.status : 0;
        const unroutable = status >= 400 && status < 500 && ![401, 403, 429].includes(status);
        if (!unroutable) throw error;

        setRouteMessage('Some stops are off-road. Snapping to nearest roads...');
        const badIndices = await findBadPins(formData.route_waypoints);
        if (badIndices.length === 0) throw new Error('Routing request failed');

        const snapped = [...formData.route_waypoints];
        for (const idx of badIndices) {
          snapped[idx] = await snapToNearestRoad(snapped[idx]);
        }
        setFormData((current) => ({ ...current, route_waypoints: snapped }));

        try {
          route = await api.generateRoute(waypointParam(snapped));
        } catch {
          throw new Error('Could not find roads for some stops. Try moving them closer to a road or town.');
        }
      }

      if (!route.geometry) throw new Error('No route geometry returned');
      setFormData((current) => ({ ...current, route_geometry: route.geometry }));
      setRouteStats({ distance: route.distance, time: route.time });
      setRouteMessage('Route generated and ready to save.');
    } catch (err: any) {
      setFormData((current) => ({ ...current, route_geometry: null }));
      setRouteStats(null);
      setRouteMessage(err.message || 'Route unavailable — drop a point manually or try again. The waypoints can still be saved.');
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const reorderWaypoints = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const waypoints = [...formData.route_waypoints];
    const [movedWaypoint] = waypoints.splice(fromIndex, 1);
    waypoints.splice(toIndex, 0, movedWaypoint);
    setRouteWaypoints(waypoints);
  };

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= formData.route_waypoints.length) return;
    reorderWaypoints(index, nextIndex);
  };

  const updateWaypointName = (index: number, name: string) => {
    setFormData((current) => ({
      ...current,
      route_waypoints: current.route_waypoints.map((waypoint, waypointIndex) =>
        waypointIndex === index ? { ...waypoint, name } : waypoint,
      ),
    }));
  };

  const removeWaypoint = (index: number) => {
    setRouteWaypoints(formData.route_waypoints.filter((_, itemIndex) => itemIndex !== index));
  };

  /**
   * Drops cached place lookups from the session, the Worker's isolate and the
   * edge cache, so the next search or pin snap asks Geoapify again instead of
   * waiting out the TTL. Cache entries live in layers we can't all address, so
   * the toast reports what was actually cleared.
   */
  const clearGeoCache = async () => {
    setIsPurgingGeoCache(true);
    try {
      const result = await api.purgeGeoCache();
      geocodeCache.clear();
      setSearchResults([]);
      setSearchMessage('Cached lookups cleared. Search again for fresh results.');
      const edge = result.edgeCacheAvailable
        ? `, ${result.edgeEntriesDeleted} edge ${result.edgeEntriesDeleted === 1 ? 'entry' : 'entries'}`
        : ' (edge cache inactive on this host)';
      toast.success(`Cleared ${result.isolateEntriesCleared} cached ${result.isolateEntriesCleared === 1 ? 'lookup' : 'lookups'}${edge}`);
    } catch (error: any) {
      toast.error(error?.message || 'Could not clear the lookup cache');
    } finally {
      setIsPurgingGeoCache(false);
    }
  };

  /** Re-snaps one stop to the nearest road, bypassing any cached answer. */
  const refreshWaypointSnap = async (index: number) => {
    const point = formData.route_waypoints[index];
    if (!point) return;
    setSnappingWaypointIndex(index);
    try {
      const { place } = await api.reverseGeocode(point.lat, point.lng, true);
      if (!place) {
        toast.error('No address found near that stop');
        return;
      }
      const moved = Math.abs(place.lat - point.lat) > 1e-6 || Math.abs(place.lon - point.lng) > 1e-6;
      setFormData((current) => ({
        ...current,
        route_waypoints: current.route_waypoints.map((waypoint, waypointIndex) =>
          waypointIndex === index
            // Only the geocoded reference moves; a title the admin typed is theirs to keep.
            ? { ...waypoint, lat: place.lat, lng: place.lon, address: place.address || waypoint.address }
            : waypoint,
        ),
        // Moving a stop invalidates the saved route.
        route_geometry: moved ? null : current.route_geometry,
      }));
      if (moved) {
        // The old distance/time no longer describes this route.
        setRouteStats(null);
        setRouteMessage('Stop moved to the nearest road — generate the route again to update it.');
      }
      toast.success(moved ? 'Stop snapped to the nearest road' : 'Stop is already on the nearest road');
    } catch (error: any) {
      toast.error(error?.message || 'Could not look up that stop');
    } finally {
      setSnappingWaypointIndex(null);
    }
  };

  // Snap a waypoint to the nearest road using reverse geocoding.
  //
  // Only the pin and its geocoded reference move. The title the admin typed and
  // the photo they assigned to this stop are theirs to keep — rebuilding the
  // object here used to drop both, so an off-road pin silently un-assigned the
  // stop's polaroid mid-edit and overwrote its name with the geocoded address.
  const snapToNearestRoad = async (point: Waypoint): Promise<Waypoint> => {
    try {
      const { place } = await api.reverseGeocode(point.lat, point.lng);
      if (!place) return point;
      return {
        ...point,
        lat: place.lat,
        lng: place.lon,
        address: place.address || point.address,
      };
    } catch {
      // Ignore errors, return original point
    }
    return point;
  };

  // Test each pin against a known-good reference to find bad ones: a pin that
  // cannot be routed from Dhaka is treated as off-road.
  const findBadPins = async (points: Waypoint[]): Promise<number[]> => {
    const reference: Waypoint = { lat: 23.8103, lng: 90.4125, name: 'Reference' };
    const badIndices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      try {
        await api.generateRoute(waypointParam([reference, points[i]]));
      } catch {
        badIndices.push(i);
      }
    }
    return badIndices;
  };

  const addMapWaypoint = ({ lat, lng }: { lat: number; lng: number }) => {
    // Deliberately untitled: the admin names the stop themselves, so a pin
    // dropped on the map never arrives pre-labelled with a placeholder that
    // then has to be cleared. The UI falls back to "Stop N" until it is named.
    addWaypoint({ name: '', lat, lng });
  };

  const validateDeal = (): string | null => {
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.slug.trim()) return 'Slug is required';
    if (!formData.destination.trim()) return 'Destination is required';
    if (!formData.description.trim()) return 'Description is required';
    if (!formData.price || formData.price <= 0) return 'Price must be greater than 0';
    if (!formData.image_url) return 'Pick a main thumbnail from the gallery first';
    return null;
  };

  // Live preview of the chip the card will show for the current form values.
  const categoryPreview = getDealCategory(formData);

  const payloadForApi = () => ({
    ...formData,
    // Empty means "auto-detect on the card", which the column stores as null.
    category: formData.category || null,
    inclusions: formData.inclusions.split('\n').filter(Boolean),
    exclusions: formData.exclusions.split('\n').filter(Boolean),
    route_waypoints: formData.route_waypoints.length > 0 ? formData.route_waypoints : null,
    route_geometry: formData.route_geometry,
    itinerary: formData.itinerary.length > 0 ? formData.itinerary : undefined,
    gallery: formData.gallery,
  });

  const handleCreate = async () => {
    const problem = validateDeal();
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createDeal(payloadForApi() as any);
      toast.success('Deal created successfully');
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error: any) {
      const msg = error?.message || 'Failed to create deal';
      toast.error(msg);
      console.error('Create deal error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedDeal) return;
    const problem = validateDeal();
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.updateDeal(selectedDeal.id, payloadForApi() as any);
      toast.success('Deal updated successfully');
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsEditModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update deal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      await api.deleteDeal(id);
      toast.success('Deal deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } catch {
      toast.error('Failed to delete deal');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelected = () => {
    setSelectedIds((current) => {
      if (current.size === deals.length && deals.length > 0) return new Set();
      return new Set(deals.map((deal) => deal.id));
    });
  };

  // Prune selection when the deals list changes (e.g. after delete/refetch)
  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) return current;
      const live = new Set(deals.map((deal) => deal.id));
      const pruned = new Set(Array.from(current).filter((id) => live.has(id)));
      return pruned.size === current.size ? current : pruned;
    });
  }, [deals]);

  // Clamp lightbox index when gallery changes
  useEffect(() => {
    if (lightboxOpen && formData.gallery.length > 0) {
      const maxIndex = formData.gallery.length - 1;
      if (lightboxIndex > maxIndex) {
        setLightboxIndex(maxIndex);
      } else if (lightboxIndex < 0) {
        setLightboxIndex(0);
      }
    }
    if (lightboxOpen && formData.gallery.length === 0) {
      setLightboxOpen(false);
    }
  }, [formData.gallery.length, lightboxOpen, lightboxIndex]);



  const handleBulkRemove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const word = ids.length === 1 ? 'deal' : 'deals';
    if (!confirm(`Permanently remove ${ids.length} ${word} and their uploaded images? This cannot be undone.`)) return;
    setIsBulkRemoving(true);
    try {
      const { removed, failed, results } = await api.bulkRemoveDeals(ids);
      const skipped = results.filter((r) => r.status === 'skipped_has_bookings').length;
      if (failed === 0) {
        toast.success(`${removed} ${word} removed with their images`);
      } else if (removed === 0) {
        if (skipped > 0 && skipped === results.length) {
          toast.error('None removed — selected deals still have bookings');
        } else {
          toast.error('Remove failed');
        }
      } else {
        toast(`${removed} removed, ${failed} not (check console for details)`, { icon: '⚠️' });
        console.warn('Bulk remove partial results:', results);
      }
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } catch (error: any) {
      toast.error(error?.message || 'Bulk remove failed');
    } finally {
      setIsBulkRemoving(false);
    }
  };

  const resetRouteUi = () => {
    setSearchText('');
    setSearchResults([]);
    setSearchMessage('');
    setRouteMessage('');
    setRouteStats(null);
  };

  const resetForm = () => {
    setFormData({ ...emptyForm, route_waypoints: [] });
    resetRouteUi();
    setLightboxOpen(false);
    setLightboxIndex(0);
  };

  const openEditModal = (deal: TourDeal) => {
    setSelectedDeal(deal);
    // Collect all images from the deal into gallery
    const allImages: string[] = [];
    if (deal.image_url) allImages.push(deal.image_url);
    (deal.gallery || []).forEach((img) => {
      if (!allImages.includes(img)) allImages.push(img);
    });
    (deal.itinerary || []).forEach((phase) => {
      (phase.photos || []).forEach((img) => {
        if (!allImages.includes(img)) allImages.push(img);
      });
    });
    (deal.route_waypoints || []).forEach((wp) => {
      if (wp.image && !allImages.includes(wp.image)) allImages.push(wp.image);
    });

    setFormData({
      title: deal.title, slug: deal.slug, description: deal.description || '',
      short_description: deal.short_description || '', destination: deal.destination,
      category: deal.category || '',
      price: deal.price, original_price: deal.original_price || 0, duration_days: deal.duration_days,
      max_travelers: deal.max_travelers || 0, image_url: deal.image_url || '',
      gallery: allImages,
      inclusions: (deal.inclusions || []).join('\n'), exclusions: (deal.exclusions || []).join('\n'),
      is_featured: deal.is_featured, route_waypoints: deal.route_waypoints || [], route_geometry: deal.route_geometry || null,
      itinerary: (deal.itinerary || []).map((d, i) => ({ phase: i + 1, title: d.title, description: d.description, photos: d.photos || [] })),
    });
    resetRouteUi();
    setLightboxOpen(false);
    setLightboxIndex(0);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    resetForm();
  };

  // Gallery management
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const maxSize = 5 * 1024 * 1024;

    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, AVIF`);
        continue;
      }
      if (file.size > maxSize) {
        toast.error(`File too large: ${file.name}. Maximum size: 5MB`);
        continue;
      }

      setIsUploading(true);
      try {
        const compressed = await compressImage(file);
        const { url } = await api.uploadImage(compressed);
        if (formData.gallery.includes(url)) {
          toast(`${file.name} is already in the gallery`, { icon: 'ℹ️' });
          continue;
        }
        setFormData((current) => current.gallery.includes(url)
          ? current
          : { ...current, gallery: [...current.gallery, url] });
        toast.success(`Uploaded: ${file.name}`);
      } catch (error: any) {
        toast.error(error?.message || `Failed to upload: ${file.name}`);
      } finally {
        setIsUploading(false);
      }
    }

    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removeFromGallery = (index: number) => {
    const removedUrl = formData.gallery[index];
    if (!removedUrl) return;
    setFormData((current) => {
      const gallery = current.gallery.filter((_, i) => i !== index);
      return {
        ...current,
        gallery,
        // Never leave the deal pointing at a deleted upload.
        image_url: current.image_url === removedUrl ? (gallery[0] || '') : current.image_url,
        itinerary: current.itinerary.map((phase) => ({
          ...phase,
          photos: (phase.photos || []).filter((photo) => photo !== removedUrl),
        })),
        route_waypoints: current.route_waypoints.map((waypoint) =>
          waypoint.image === removedUrl ? { ...waypoint, image: undefined } : waypoint,
        ),
      };
    });
    // If lightbox is open, close it since the index may be invalid
    if (lightboxOpen) {
      setLightboxOpen(false);
    }
  };

  const reorderGallery = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const items = [...formData.gallery];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    setFormData((current) => ({ ...current, gallery: items }));
    // If lightbox is open, update index to follow the dragged image
    if (lightboxOpen) {
      if (lightboxIndex === fromIndex) {
        setLightboxIndex(toIndex);
      } else if (fromIndex < lightboxIndex && toIndex >= lightboxIndex) {
        setLightboxIndex(lightboxIndex - 1);
      } else if (fromIndex > lightboxIndex && toIndex <= lightboxIndex) {
        setLightboxIndex(lightboxIndex + 1);
      }
    }
  };

  const setImageAsMain = (url: string) => {
    setFormData((current) => ({ ...current, image_url: url }));
  };

  const toggleItineraryPhoto = (phaseIndex: number, photoUrl: string) => {
    setFormData((current) => ({
      ...current,
      itinerary: current.itinerary.map((phase, i) => {
        if (i !== phaseIndex) return phase;
        const photos = phase.photos.includes(photoUrl)
          ? phase.photos.filter((p) => p !== photoUrl)
          : [...phase.photos, photoUrl];
        return { ...phase, photos };
      }),
    }));
  };

  const toggleWaypointImage = (waypointIndex: number, photoUrl: string) => {
    setFormData((current) => ({
      ...current,
      route_waypoints: current.route_waypoints.map((wp, i) =>
        i === waypointIndex ? { ...wp, image: wp.image === photoUrl ? undefined : photoUrl } : wp
      ),
    }));
  };

  // Itinerary (phase) management
  const addItineraryPhase = () => {
    const nextPhase = formData.itinerary.length + 1;
    setFormData((current) => ({
      ...current,
      itinerary: [...current.itinerary, { phase: nextPhase, title: '', description: '', photos: [] }],
    }));
  };

  const removeItineraryPhase = (index: number) => {
    setFormData((current) => ({
      ...current,
      itinerary: current.itinerary
        .filter((_, i) => i !== index)
        .map((phase, i) => ({ ...phase, phase: i + 1 })),
    }));
  };

  const updateItineraryPhase = (index: number, field: keyof ItineraryPhase, value: string | number) => {
    setFormData((current) => ({
      ...current,
      itinerary: current.itinerary.map((phase, i) =>
        i === index ? { ...phase, [field]: value } : phase,
      ),
    }));
  };

  const moveItineraryPhase = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= formData.itinerary.length) return;
    const items = [...formData.itinerary];
    const [moved] = items.splice(index, 1);
    items.splice(nextIndex, 0, moved);
    setFormData((current) => ({
      ...current,
      itinerary: items.map((phase, i) => ({ ...phase, phase: i + 1 })),
    }));
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5 text-muted-foreground" />Tour Deals ({deals.length})</CardTitle>
          <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} size="sm"><Plus className="w-4 h-4 mr-1.5" />Add Deal</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : (
          <div className="overflow-x-auto">
            {selectedIds.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkRemove}
                  disabled={isBulkRemoving}
                >
                  {isBulkRemoving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                  {isBulkRemoving ? 'Removing…' : 'Remove selected & images'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={isBulkRemoving}>
                  Clear
                </Button>
              </div>
            )}
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="w-9 py-3 px-2 text-left">
                  <input
                    type="checkbox"
                    className="rounded align-middle"
                    aria-label="Select all deals"
                    checked={deals.length > 0 && selectedIds.size === deals.length}
                    onChange={toggleAllSelected}
                    disabled={deals.length === 0}
                  />
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Deal ID</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Destination</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Duration</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr></thead>
              <tbody>{deals.map((deal) => (
                <tr key={deal.id} className={'border-b border-border last:border-0 hover:bg-muted/50 transition-colors ' + (selectedIds.has(deal.id) ? 'bg-muted/40' : '')}>
                  <td className="py-3 px-2">
                    <input
                      type="checkbox"
                      className="rounded align-middle"
                      aria-label={`Select ${deal.title}`}
                      checked={selectedIds.has(deal.id)}
                      onChange={() => toggleSelected(deal.id)}
                    />
                  </td>
                  <td className="py-3 px-3"><div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{deal.title}</p><p className="text-xs text-muted-foreground truncate sm:hidden">{deal.destination}</p>{deal.is_featured && <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Featured</span>}</div></td>
                  <td className="py-3 px-3 text-sm text-muted-foreground font-mono hidden lg:table-cell">{deal.deal_code || '—'}</td>
                  <td className="py-3 px-3 text-sm text-muted-foreground hidden sm:table-cell">{deal.destination}</td>
                  <td className="py-3 px-3 text-sm font-medium text-foreground">{formatCurrency(deal.price)}</td>
                  <td className="py-3 px-3 text-sm text-muted-foreground hidden md:table-cell">{deal.duration_days} days</td>
                  <td className="py-3 px-3"><div className="flex gap-1 justify-end"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(deal)}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(deal.id)}><Trash2 className="w-4 h-4" /></Button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <Dialog
          open={isCreateModalOpen || isEditModalOpen}
          onOpenChange={(open) => {
            if (open) return;
            // While the image preview is open, it owns Escape and outside clicks.
            if (lightboxOpen) return;
            closeModal();
          }}
        >
          <DialogContent
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(event) => { if (lightboxOpen) event.preventDefault(); }}
            onInteractOutside={(event) => { if (lightboxOpen) event.preventDefault(); }}
            onFocusOutside={(event) => { if (lightboxOpen) event.preventDefault(); }}
            onEscapeKeyDown={(event) => { if (lightboxOpen) event.preventDefault(); }}
          >
            <DialogHeader><DialogTitle>{isEditModalOpen ? 'Edit Deal' : 'Create New Deal'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="col-span-1 sm:col-span-2"><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
              <div><Label>Slug *</Label><Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="my-tour-deal" /></div>
              <div><Label>Destination *</Label><Input value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} /></div>
              <div className="col-span-1 sm:col-span-2"><Label>Description *</Label><MarkdownEditor value={formData.description} onChange={(value) => setFormData({ ...formData, description: value })} rows={4} /></div>
              <div className="col-span-1 sm:col-span-2"><Label>Short Description</Label><Input value={formData.short_description} onChange={(e) => setFormData({ ...formData, short_description: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category || 'auto'}
                  onValueChange={(value) => setFormData({ ...formData, category: value === 'auto' ? '' : value })}
                >
                  <SelectTrigger aria-label="Deal category">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect from the deal text</SelectItem>
                    {DEAL_CATEGORIES.map((category) => (
                      <SelectItem key={category.key} value={category.key}>
                        {category.emoji} {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Card badge:
                  <span className={'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ' + categoryPreview.className}>
                    <span aria-hidden="true">{categoryPreview.emoji}</span>
                    {categoryPreview.label}
                  </span>
                </p>
              </div>
              <div><Label>Price *</Label><Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} /></div>
              <div><Label>Original Price</Label><Input type="number" value={formData.original_price} onChange={(e) => setFormData({ ...formData, original_price: Number(e.target.value) })} /></div>
              <div><Label>Duration (Days) *</Label><Input type="number" value={formData.duration_days} onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })} /></div>
              <div><Label>Max Travelers</Label><Input type="number" value={formData.max_travelers} onChange={(e) => setFormData({ ...formData, max_travelers: Number(e.target.value) })} /></div>
              {/* Centralized Gallery Upload */}
              <div className="col-span-1 sm:col-span-2">
                <Label>Deal Gallery</Label>
                <p className="text-xs text-muted-foreground mb-2">Upload all images here. Select from gallery below for main image, itinerary days, and map markers.</p>
                
                {/* Upload area */}
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => galleryInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files.length > 0 && galleryInputRef.current) {
                      const dt = new DataTransfer();
                      Array.from(files).forEach(f => dt.items.add(f));
                      galleryInputRef.current.files = dt.files;
                      galleryInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }}
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isUploading ? 'Uploading...' : 'Drop images here or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, AVIF · Max 5MB each · Multiple files OK</p>
                </div>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  multiple
                  onChange={handleGalleryUpload}
                  disabled={isUploading}
                />

                {/* Gallery grid */}
                {formData.gallery.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Gallery ({formData.gallery.length} images)</Label>
                      <Label className="text-xs text-muted-foreground">Drag (or use ← →) to reorder · Click to preview</Label>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {formData.gallery.map((url, idx) => (
                        <div
                          key={url}
                          draggable
                          onDragStart={(e) => {
                            setDraggingGalleryIndex(idx);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggingGalleryIndex !== null) reorderGallery(draggingGalleryIndex, idx);
                            setDraggingGalleryIndex(null);
                          }}
                          onDragEnd={() => setDraggingGalleryIndex(null)}
                          className={'relative group cursor-pointer rounded-md overflow-hidden border-2 transition-all ' + (draggingGalleryIndex === idx ? 'opacity-40 scale-95' : '') + (formData.image_url === url ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/30')}
                          onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                        >
                          <img src={url} alt={'Gallery ' + (idx + 1)} className="w-full h-20 object-cover" />
                          <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-4 h-4 text-white drop-shadow-md cursor-grab" />
                          </div>
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4 text-white drop-shadow-md" />
                          </div>
                          {/* Pointer-friendly reordering: HTML5 drag-and-drop never fires on touch. */}
                          {formData.gallery.length > 1 && (
                            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center gap-1">
                              <button
                                type="button"
                                aria-label={'Move image ' + (idx + 1) + ' earlier'}
                                title="Move earlier"
                                disabled={idx === 0}
                                onClick={(e) => { e.stopPropagation(); reorderGallery(idx, idx - 1); }}
                                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 disabled:pointer-events-none disabled:opacity-30"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={'Move image ' + (idx + 1) + ' later'}
                                title="Move later"
                                disabled={idx === formData.gallery.length - 1}
                                onClick={(e) => { e.stopPropagation(); reorderGallery(idx, idx + 1); }}
                                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 disabled:pointer-events-none disabled:opacity-30"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label={'Remove image ' + (idx + 1)}
                            className="absolute bottom-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 transition-opacity hover:opacity-100 focus:opacity-100"
                            onClick={(e) => { e.stopPropagation(); removeFromGallery(idx); }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {formData.image_url === url && (
                            <div className="absolute bottom-1 left-1 z-10 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                              Main
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div><Label>Inclusions (one per line)</Label><Textarea value={formData.inclusions} onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })} rows={4} /></div>
              <div><Label>Exclusions (one per line)</Label><Textarea value={formData.exclusions} onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })} rows={4} /></div>

              <div className="col-span-2 border-t pt-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Route Map</h3><p className="text-xs text-muted-foreground">Add stops in order, then generate the driving route once before saving.</p></div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formData.route_waypoints.length} stop{formData.route_waypoints.length === 1 ? '' : 's'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 gap-1.5 px-2 text-xs"
                      onClick={clearGeoCache}
                      disabled={isPurgingGeoCache}
                      title="Forget cached place lookups and pin snaps so the next request asks Geoapify again"
                    >
                      {isPurgingGeoCache ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {isPurgingGeoCache ? 'Clearing' : 'Clear cache'}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchPlaces(); } }} placeholder="Search a place (e.g. Dhaka)" aria-label="Search for a route stop" />
                  <Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={searchPlaces} disabled={isSearching || !searchText.trim()}><Search className="h-4 w-4 mr-1.5" />{isSearching ? 'Searching' : 'Search'}</Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Search results are powered by Geoapify. OSM map tiles are used for display.</p>
                {searchMessage && <p className="mt-2 text-xs text-amber-700" role="status">{searchMessage}</p>}
                {searchResults.length > 0 && <div className="mt-2 divide-y rounded-md border bg-background">{searchResults.map((place, index) => <button type="button" key={place.id ?? `${place.lat}-${place.lon}-${index}`} className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => addWaypoint({ name: place.name || place.address || '', address: place.address || undefined, lat: place.lat, lng: place.lon })}>{place.address || place.name || 'Selected place'}</button>)}</div>}
                <DealRouteMap waypoints={formData.route_waypoints} geometry={formData.route_geometry} editable onMapClick={addMapWaypoint} className="mt-3 h-72" />
                <div className="mt-3 space-y-2">
                  {formData.route_waypoints.map((point, index) => {
                    const stopLabel = point.name.trim() || point.address?.trim() || `Stop ${index + 1}`;
                    const waypointRow = (
                      <div
                        key={index}
                        draggable
                        onDragStart={(event) => {
                          setDraggingWaypointIndex(index);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingWaypointIndex !== null) reorderWaypoints(draggingWaypointIndex, index);
                          setDraggingWaypointIndex(null);
                        }}
                        onDragEnd={() => setDraggingWaypointIndex(null)}
                        className={'flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 transition-opacity sm:flex-nowrap ' + (draggingWaypointIndex === index ? 'opacity-40' : '')}
                      >
                        <span className="hidden cursor-grab text-muted-foreground sm:inline-flex" title="Drag to reorder" aria-label={'Drag stop ' + (index + 1) + ' to reorder'}><GripVertical className="h-5 w-5" /></span>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{index + 1}</span>
                        <div className="order-1 flex min-w-0 flex-1 basis-[calc(100%-3rem)] flex-col gap-0.5 sm:order-none">
                          <Input
                            value={point.name}
                            onChange={(event) => updateWaypointName(index, event.target.value)}
                            placeholder={`Title for stop ${index + 1} — e.g. Sunset camp`}
                            aria-label={`Title for stop ${index + 1}`}
                            className="h-10 min-w-0 sm:h-8"
                          />
                          {point.address && (
                            <span className="truncate text-[11px] leading-tight text-muted-foreground" title={point.address}>
                              {point.address}
                            </span>
                          )}
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => refreshWaypointSnap(index)} disabled={snappingWaypointIndex === index} title="Re-look up the nearest road for this stop" aria-label={'Re-snap ' + stopLabel + ' to the nearest road'}>{snappingWaypointIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}</Button>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => moveWaypoint(index, -1)} disabled={index === 0} aria-label={'Move ' + stopLabel + ' up'}><ChevronUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => moveWaypoint(index, 1)} disabled={index === formData.route_waypoints.length - 1} aria-label={'Move ' + stopLabel + ' down'}><ChevronDown className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-destructive" onClick={() => removeWaypoint(index)} aria-label={'Remove ' + stopLabel}><X className="h-4 w-4" /></Button>
                      </div>
                    );
                    const imageSelector = formData.gallery.length > 0 ? (
                      <div key={'img-' + index} className="ml-8 mt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Label className="text-[11px] text-muted-foreground">Polaroid image:</Label>
                          {point.image && (
                            <button type="button" className="text-[11px] text-destructive hover:underline" onClick={() => toggleWaypointImage(index, point.image!)}>Remove</button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {formData.gallery.map((url, imgIdx) => {
                            const isSelected = point.image === url;
                            const cls = 'w-10 h-10 rounded overflow-hidden cursor-pointer border-2 transition-all ' + (isSelected ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-100');
                            return (
                              <div
                                key={imgIdx}
                                className={cls}
                                onClick={() => toggleWaypointImage(index, url)}
                              >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p key={'img-hint-' + index} className="ml-8 mt-1 text-[11px] text-muted-foreground">
                        Upload images in the Deal Gallery above to give this stop a polaroid photo.
                      </p>
                    );
                    return [waypointRow, imageSelector];
                  })}
                  {formData.route_waypoints.length === 0 && <p className="text-xs text-muted-foreground">No stops yet. Search for a place or click anywhere on the map.</p>}
                  {formData.route_waypoints.length > 1 && <p className="text-xs text-muted-foreground">Each stop's title is free text — type whatever the stop should be called, it does not have to match the address underneath. Drag stops to change the route order. Use the arrow buttons on touch devices. Reordering or adding/removing a stop requires generating the route again; renaming a stop does not. The pin button re-snaps a stop to the nearest road.</p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={generateRoute} disabled={isGeneratingRoute || formData.route_waypoints.length < 2}>{isGeneratingRoute ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}{isGeneratingRoute ? 'Generating route...' : 'Generate route'}</Button>{routeStats && <span className="text-sm text-muted-foreground">{(routeStats.distance / 1000).toFixed(1)} km · {(routeStats.time / 60).toFixed(0)} min</span>}</div>
                {routeMessage && <p className={'mt-2 text-xs ' + (routeMessage.includes('ready') ? 'text-emerald-700' : 'text-amber-700')} role="status">{routeMessage}</p>}

              </div>
              {/* Itinerary Phases / Timeline Editor */}
              <div className="col-span-1 sm:col-span-2 border-t pt-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Itinerary Phases
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Add the steps of this tour in order — a one-day tour can have several phases. This appears as an animated timeline on the deal page.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formData.itinerary.length} phase{formData.itinerary.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-3">
                  {formData.itinerary.map((phase, index) => (
                    <div
                      key={index}
                      className="rounded-lg border p-3 bg-muted/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-white">
                          {phase.phase}
                        </span>
                        <span className="text-sm font-medium">Phase {phase.phase}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItineraryPhase(index, -1)} disabled={index === 0} aria-label={'Move phase ' + (index + 1) + ' up'}>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItineraryPhase(index, 1)} disabled={index === formData.itinerary.length - 1} aria-label={'Move phase ' + (index + 1) + ' down'}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItineraryPhase(index)} aria-label={'Remove phase ' + (index + 1)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={phase.title}
                        onChange={(e) => updateItineraryPhase(index, 'title', e.target.value)}
                        placeholder="Phase title (e.g. Arrival in Dhaka)"
                        className="mb-2"
                      />
                      <Textarea
                        value={phase.description}
                        onChange={(e) => updateItineraryPhase(index, 'description', e.target.value)}
                        placeholder="What happens in this phase..."
                        rows={2}
                      />
                      {/* Photo selector for this phase */}
                      {formData.gallery.length > 0 && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Photos for this phase (click to toggle)</Label>
                          <div className="flex flex-wrap gap-2">
                            {formData.gallery.map((url, imgIdx) => {
                              const isPhotoSelected = phase.photos.includes(url);
                              return (
                              <div
                                key={imgIdx}
                                className={'relative w-16 h-16 rounded-md overflow-hidden cursor-pointer border-2 transition-all ' + (isPhotoSelected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-60 hover:opacity-100')}
                                onClick={() => toggleItineraryPhoto(index, url)}
                              >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                {isPhotoSelected && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <span className="text-primary-foreground text-xs font-bold">✓</span>
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                          {phase.photos.length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-1">{phase.photos.length} photo{phase.photos.length === 1 ? '' : 's'} selected</p>
                          )}
                        </div>
                      )}
                      {formData.gallery.length === 0 && (
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          Upload images in the Deal Gallery above, then pick the ones that belong to this phase.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addItineraryPhase}>
                  <Plus className="h-4 w-4 mr-1.5" />Add Phase
                </Button>
              </div>

              <div className="col-span-1 sm:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} className="rounded" /><span>Featured Deal</span></label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={closeModal}>Cancel</Button><Button onClick={isEditModalOpen ? handleEdit : handleCreate} disabled={isSubmitting}>{isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{isEditModalOpen ? 'Update Deal' : 'Create Deal'}</Button></DialogFooter>

            {/*
              Rendered INSIDE DialogContent on purpose: Radix only treats pointer/focus
              events inside its content as "inside", so the preview can no longer dismiss
              (and wipe) the whole form. The native dialog still paints in the browser's
              top layer, above the form and its overlay.
            */}
            <Lightbox
              images={formData.gallery}
              currentIndex={lightboxIndex}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              onNavigate={setLightboxIndex}
              alt="Gallery preview"
              actions={
                <Button
                  type="button"
                  onClick={() => {
                    const activeImage = formData.gallery[lightboxIndex];
                    if (!activeImage) return;
                    setImageAsMain(activeImage);
                    setLightboxOpen(false);
                    toast.success('Image set as main thumbnail');
                  }}
                  className={formData.image_url === formData.gallery[lightboxIndex] ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {formData.image_url === formData.gallery[lightboxIndex] ? '✓ Current Main' : 'Set as Main Thumbnail'}
                </Button>
              }
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    </>
  );
}

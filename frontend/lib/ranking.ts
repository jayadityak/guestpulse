import type { Hotel, SearchParams, TripType } from "./types";

type WeightMap = Record<string, number>;

const BASE_WEIGHTS: WeightMap = {
  cleanliness: 1, service: 1, location: 1, noise: 1,
  food: 0.6, value: 1, roomQuality: 0.8, maintenance: 0.7,
};

const TRIP_WEIGHTS: Record<TripType, WeightMap> = {
  business: { cleanliness: 1.2, service: 1.5, location: 1.8, noise: 1.8, food: 0.8, value: 0.8, roomQuality: 1.2, maintenance: 1.3 },
  couple:   { cleanliness: 1.3, service: 1.3, location: 1.3, noise: 1.5, food: 1.3, value: 0.9, roomQuality: 1.4, maintenance: 1.0 },
  family:   { cleanliness: 1.8, service: 1.4, location: 1.0, noise: 1.6, food: 1.5, value: 1.4, roomQuality: 1.6, maintenance: 1.3 },
  solo:     { cleanliness: 1.0, service: 0.9, location: 1.6, noise: 1.0, food: 0.8, value: 1.5, roomQuality: 0.8, maintenance: 0.8 },
  luxury:   { cleanliness: 1.5, service: 2.0, location: 1.2, noise: 1.3, food: 1.5, value: 0.4, roomQuality: 1.8, maintenance: 1.5 },
  budget:   { cleanliness: 1.0, service: 0.8, location: 1.2, noise: 0.8, food: 0.6, value: 2.5, roomQuality: 0.7, maintenance: 0.7 },
};

const PRIORITY_WEIGHTS: Record<string, Partial<WeightMap>> = {
  "cleanliness":    { cleanliness: 2.0 },
  "quiet rooms":    { noise: 2.0 },
  "location":       { location: 2.0 },
  "service quality":{ service: 2.0 },
  "breakfast":      { food: 1.5 },
  "wifi":           { maintenance: 1.3 },
  "value for money":{ value: 2.0 },
  "room size":      { roomQuality: 1.5 },
  "safety":         { maintenance: 1.3, noise: 1.2 },
};

export function rankHotels(hotels: Hotel[], params: Partial<SearchParams>): Hotel[] {
  const tripType = params.tripType as TripType | undefined;
  const priorities = (params.priorities as unknown as string) || "";
  const priorityList = typeof priorities === "string"
    ? priorities.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean)
    : [];

  const budgetMin = Number(params.budgetMin) || 0;
  const budgetMax = Number(params.budgetMax) || 999999;

  let filtered = hotels.filter((h) => {
    if (h.pricePerNight < budgetMin || h.pricePerNight > budgetMax) return false;
    const city = params.city?.toLowerCase() || "";
    if (city && !h.city.toLowerCase().includes(city) && !h.neighborhood.toLowerCase().includes(city)) return false;
    return true;
  });

  if (!filtered.length) filtered = hotels;

  const weights: WeightMap = { ...BASE_WEIGHTS };
  if (tripType && TRIP_WEIGHTS[tripType]) {
    for (const [k, v] of Object.entries(TRIP_WEIGHTS[tripType])) {
      weights[k] = (weights[k] || 1) * v;
    }
  }
  for (const p of priorityList) {
    const pw = PRIORITY_WEIGHTS[p];
    if (pw) {
      for (const [k, v] of Object.entries(pw)) {
        weights[k] = (weights[k] || 1) * (v as number);
      }
    }
  }

  function hotelScore(h: Hotel): number {
    const s = h.analysis.scores;
    const dims: [string, number][] = [
      ["cleanliness", s.cleanliness], ["service", s.service],
      ["location", s.location], ["noise", s.noise], ["food", s.food],
      ["value", s.value], ["roomQuality", s.roomQuality], ["maintenance", s.maintenance],
    ];
    const total = dims.reduce((sum, [k, v]) => sum + v * (weights[k] || 1), 0);
    const maxPossible = dims.reduce((sum, [k]) => sum + 100 * (weights[k] || 1), 0);
    return Math.round((total / maxPossible) * 100);
  }

  return filtered.sort((a, b) => hotelScore(b) - hotelScore(a));
}

export type TripType = "business" | "couple" | "family" | "solo" | "luxury" | "budget";

export type SortOption =
  | "best_overall"
  | "best_value"
  | "cleanest"
  | "best_service"
  | "lowest_noise"
  | "best_location"
  | "best_business"
  | "best_family";

export type Amenity =
  | "wifi" | "pool" | "gym" | "spa" | "parking" | "breakfast"
  | "restaurant" | "bar" | "airport_shuttle" | "pet_friendly"
  | "family_friendly" | "business_center" | "concierge" | "room_service";

export interface SearchParams {
  city: string;
  checkIn: string;
  checkOut: string;
  budgetMin: number;
  budgetMax: number;
  guests: number;
  starRating: number[];
  neighborhood: string;
  tripType: TripType | "";
  priorities: string[];
  amenities: Amenity[];
}

export interface ScoreBreakdown {
  cleanliness: number;
  service: number;
  location: number;
  noise: number;
  food: number;
  value: number;
  roomQuality: number;
  maintenance: number;
}

export interface ReviewTheme {
  theme: string;
  frequency: number;
  summary: string;
}

export interface HotelAnalysis {
  guestPulseScore: number;
  summary: string;
  bestFor: string[];
  avoidIf: string[];
  scores: ScoreBreakdown;
  positiveThemes: ReviewTheme[];
  negativeThemes: ReviewTheme[];
  repeatedComplaints: string[];
  topStrengths: string[];
  topRisks: string[];
  finalVerdict: string;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  neighborhood: string;
  address: string;
  starRating: number;
  pricePerNight: number;
  imageUrl: string;
  bookingUrl: string;
  amenities: Amenity[];
  totalReviews: number;
  analysis: HotelAnalysis;
  // NLP recommendation context (present only when returned by /recommend)
  matchScore?: number;
  matchReason?: string;
}

export interface SavedHotel {
  hotelId: string;
  savedAt: string;
}

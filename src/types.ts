export interface Product {
  id: string;
  title: string;
  price: number;
  comparePrice: number;
  discount: number;
  description: string;
  collectionId: string;       // primary collection (legacy, kept for compat)
  collectionIds: string[];    // all collections this product belongs to
  tags: string[];
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  isFeatured: boolean;
  isTrending: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  images: string[];
  models: string[];
  createdAt: string;
  updatedAt: string;
  reviewsCount?: number;
  rating?: number;
  displayOrder?: number;
}

export interface SubCollection {
  id: string;
  name: string;
  image?: string;
  productIds: string[];
  displayOrder?: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  isVisible: boolean;         // if false, collection is hidden from website
  subcollections?: SubCollection[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  link: string;
  active: boolean;
  order: number;
}

export interface Announcement {
  id: string;
  text: string;
  link?: string;
}

export interface StoreSettings {
  announcements: Announcement[];
  freeShippingThreshold: number;
  contactEmail: string;
  contactPhone: string;
  contactAddress?: string;
  instagramUrl?: string;
  facebookUrl?: string;

  // Reassurance cards
  reassuranceCard1Title?: string;
  reassuranceCard1Body?: string;
  reassuranceCard2Title?: string;
  reassuranceCard2Body?: string;
  reassuranceCard3Title?: string;
  reassuranceCard3Body?: string;

  offerText?: string;
  logoUrl?: string;
  logoText?: string;
  logoSubtext?: string;
  brandModels?: Record<string, string[]>;

  // About section
  aboutSectionTitle?: string;
  aboutSectionSubtitle?: string;
  aboutSectionDesc1?: string;
  aboutSectionDesc2?: string;
  bannerStoryBadge?: string;

  // Reviews section
  reviewsBadge?: string;
  reviewsTitle?: string;
  reviewsSubtitle?: string;

  // Footer
  footerDisclaimer?: string;

  // Trending / Bestseller section
  trendingSectionTitle?: string;
  trendingSectionSubtitle?: string;
  bestsellerSectionBadge?: string;
  bestsellerSectionTitle?: string;
  bestsellerSectionSubtitle?: string;

  // Contact section
  contactSectionBadge?: string;
  contactSectionTitle?: string;
  contactSectionSubtitle?: string;

  // Newsletter section
  newsletterBadge?: string;
  newsletterTitle?: string;
  newsletterSubtitle?: string;
  newsletterDisclaimer?: string;

  // Top Selling scroll section
  topSellingTitle?: string;
  topSellingProductIds?: string[];

  // Best Selling Metal Glossy section (homepage grid)
  bestSellingMetalProductIds?: string[];

  // Collection display order (array of slugs)
  collectionOrder?: string[];

  // Per-collection product display order: { [collectionSlug]: productId[] }
  productOrder?: Record<string, string[]>;

  // Per-subcollection product display order: { [subCollectionId]: productId[] }
  subcollectionProductOrder?: Record<string, string[]>;

  // Shipping settings
  codEnabled?: boolean;
  deliveryMessage?: string;
  estimatedDeliveryDays?: string;

  // Promotions / Coupons
  coupons?: CouponCode[];

  // Social & Chat
  whatsappNumber?: string;
  whatsappEnabled?: boolean;
  twitterUrl?: string;
  youtubeUrl?: string;

  // SEO Settings — editable from Admin Panel → Settings → SEO
  seoHomeTitle?: string;
  seoHomeDescription?: string;
  seoHomeKeywords?: string;
  // Per-collection SEO overrides: { [slug]: { title, description, keywords } }
  seoCollectionOverrides?: Record<string, { title?: string; description?: string; keywords?: string }>;

  // Instagram Snaps Gallery
  instagramSnaps?: { url: string; imageUrl: string; caption?: string }[];

  // Store Config
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  currencySymbol?: string;
  taxRate?: number;
  storeTimezone?: string;
}

export interface CouponCode {
  id: string;
  code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  minOrder?: number;
  maxUses?: number;
  usedCount?: number;
  active: boolean;
  expiresAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedModel: string;
  customText?: string;
  customerImage?: string; // base64 data URL for photo cases
}

export interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAltPhone?: string;
  shippingAddress: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: "cod" | "card" | "upi" | "razorpay";
  status: "pending" | "waiting_for_manufacturing" | "waiting_for_customer_confirmation" | "processing" | "ready_to_ship" | "waiting_for_pickup" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "returned";
  awb?: string;
  createdAt: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface ReviewItem {
  id: string;
  name: string;
  location: string;
  review: string;
  rating: number;
  verified: boolean;
}

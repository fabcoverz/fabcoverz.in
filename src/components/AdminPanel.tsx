import React, { useState, useEffect, useCallback, useMemo } from "react";
import { processAndUpload, uploadToCloudinary } from "../utils/cloudinary";
import { DEFAULT_BRAND_MODELS } from "../utils/brandModels";
import {
  getProducts, addProduct, updateProduct, deleteProduct,
  getCollections, addCollection, updateCollection, deleteCollection,
  getBanners, addBanner, updateBanner, deleteBanner,
  getSettings, saveSettings,
  getFAQs, addFAQ, updateFAQ, deleteFAQ,
  getReviews, addReview, updateReview, deleteReview,
  getOrders, updateOrder, deleteOrder, deleteAllOrders,
} from "../utils/remoteStore";
import { 
  Product, Collection, SubCollection, Order, StoreSettings, Announcement, Banner, FAQItem, ReviewItem, CouponCode
} from "../types";
import { 
  Layers, Package, Radio, Settings2, FileText, Plus, HelpCircle, Star,
  Trash2, Edit, Save, ShieldAlert, BarChart3, TrendingUp, ShoppingBag, 
  UserCheck, Terminal, LogOut, Lock, Globe, Smartphone, CheckCircle2, AlertCircle,
  Home, ShoppingCart, Tag, Megaphone, ChevronRight, Search, Bell, User,
  ArrowUpRight, ArrowDownRight, DollarSign, Activity, Box, Users, 
  LayoutDashboard, Package2, FolderOpen, Image, MessageSquare, Settings,
  ChevronDown, Menu, X, Zap, Eye, Filter, Download, MoreHorizontal,
  BarChart2, PieChart, LineChart, RefreshCw, Check, ExternalLink, Phone, Mail, MapPin, Link2, GitMerge
} from "lucide-react";

interface AdminPanelProps {
  onExitAdmin?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onExitAdmin }) => {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("admin_verified") === "true");
  const [adminName, setAdminName] = useState(() => sessionStorage.getItem("admin_name") || "");
  const [adminNameInput, setAdminNameInput] = useState("");
  const [nameStep, setNameStep] = useState(false); // Name step removed — go straight to password
  const [loading, setLoading] = useState(true);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const failedAttemptsRef = React.useRef(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  interface NotificationToast {
    id: string;
    message: string;
    type: "success" | "error";
  }
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "collections" | "orders" | "settings" | "faqs" | "reviews" | "content_editor" | "phone_models" | "serviceability" | "our_snaps">("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [revName, setRevName] = useState("");
  const [revLocation, setRevLocation] = useState("");
  const [revReview, setRevReview] = useState("");
  const [revRating, setRevRating] = useState(5);
  const [revVerified, setRevVerified] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  // ── Live Visitors & Abandoned Carts ──────────────────────────────────
  interface VisitorSession { id: string; page: string; cart_count: number; last_seen: string; ip_address?: string; city?: string; country?: string; checkout_fields?: string | null; }
  interface AbandonedCart {
    id: string; customer_name: string | null; customer_phone: string | null;
    customer_email: string | null; city: string | null; total: number;
    items: {id:string;name:string;qty:number;price:number}[];
    updated_at: string;
  }
  const [liveVisitors, setLiveVisitors] = useState<VisitorSession[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [liveTab, setLiveTab] = useState<"visitors" | "abandoned">("visitors");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [dailyVisitors, setDailyVisitors] = useState<number | null>(null);
  const [yesterdayVisitors, setYesterdayVisitors] = useState<number | null>(null);
  const [weeklyVisitors, setWeeklyVisitors] = useState<number | null>(null);
  const SUPABASE_URL_LIVE = "https://rrirrmjfdocqtfifzuiz.supabase.co";
  const SUPABASE_KEY_LIVE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";

  const fetchLiveData = async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      // Cutoff: 4s — heartbeat is 1s, so 4 missed beats = visitor left
      const cutoff = new Date(Date.now() - 4 * 1000).toISOString();
      // PostgREST syntax: ?column=gte.value  (no encoding of the ISO string)
      const vsUrl = `${SUPABASE_URL_LIVE}/rest/v1/visitor_sessions?select=*&last_seen=gte.${cutoff}&order=last_seen.desc`;
      const acUrl = `${SUPABASE_URL_LIVE}/rest/v1/abandoned_carts?select=*&order=updated_at.desc`;
      const headers = { apikey: SUPABASE_KEY_LIVE, Authorization: `Bearer ${SUPABASE_KEY_LIVE}` };

      const [vsRes, acRes] = await Promise.all([
        fetch(vsUrl, { headers }),
        fetch(acUrl, { headers }),
      ]);

      if (!vsRes.ok) {
        const errText = await vsRes.text();
        setLiveError(`visitor_sessions error ${vsRes.status}: ${errText}`);
        setLiveLoading(false);
        return;
      }
      if (!acRes.ok) {
        const errText = await acRes.text();
        setLiveError(`abandoned_carts error ${acRes.status}: ${errText}`);
        setLiveLoading(false);
        return;
      }

      const visitors: VisitorSession[] = await vsRes.json();
      // Filter out admin's own session (admin panel page)
      const mySessionId = sessionStorage.getItem("fc_visitor_sid");
      setLiveVisitors(visitors.filter(v => v.id !== mySessionId));
      setAbandonedCarts(await acRes.json());

      // Daily / Yesterday / Weekly visitor counts
      try {
        const now = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday

        const hdr = { apikey: SUPABASE_KEY_LIVE, Authorization: `Bearer ${SUPABASE_KEY_LIVE}`, Prefer: "count=exact" };

        const fetchCount = async (gte: string, lt?: string) => {
          const url = `${SUPABASE_URL_LIVE}/rest/v1/visitor_sessions?select=id&created_at=gte.${gte}${lt ? `&created_at=lt.${lt}` : ""}`;
          const res = await fetch(url, { headers: hdr });
          const cr = res.headers.get("content-range");
          if (cr) { const n = parseInt(cr.split("/")[1], 10); return isNaN(n) ? null : n; }
          const d: { id: string }[] = await res.json();
          return d.length;
        };

        const [todayCnt, yestCnt, weekCnt] = await Promise.all([
          fetchCount(todayStart.toISOString()),
          fetchCount(yesterdayStart.toISOString(), todayStart.toISOString()),
          fetchCount(weekStart.toISOString()),
        ]);

        if (todayCnt !== null) setDailyVisitors(todayCnt);
        if (yestCnt !== null) setYesterdayVisitors(yestCnt);
        if (weekCnt !== null) setWeeklyVisitors(weekCnt);
      } catch (_) {}
    } catch (e: any) {
      setLiveError(`Network error: ${e?.message || e}`);
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const smartFetch = () => {
      if (document.visibilityState !== "hidden") fetchLiveData();
    };
    smartFetch();
    const iv = setInterval(smartFetch, 1_000); // Enhanced: 1s refresh
    document.addEventListener("visibilitychange", smartFetch);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", smartFetch);
    };
  }, [isAdmin]);
  const [orderDateFilter, setOrderDateFilter] = useState<"today" | "yesterday" | "this_week" | "this_month" | "all">("today");
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  // HIGH-7: Reset expanded state when date filter changes to avoid stale Set
  useEffect(() => {
    setExpandedOrderIds(new Set());
  }, [orderDateFilter]);
  const toggleOrderExpand = (id: string) => setExpandedOrderIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<"all" | "cod" | "prepaid">("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | Order["status"]>("all");
  const [orderSearch, setOrderSearch] = useState("");

  // ── Serviceability Tab ────────────────────────────────────────────────────────
  const [svcPincodes, setSvcPincodes] = useState<Record<string, {cod:boolean;prepaid:boolean;pickup:boolean;zone:string;city:string;state:string}>>({});
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcLoaded, setSvcLoaded] = useState(false);
  const [svcCheckPin, setSvcCheckPin] = useState("");
  const [svcResult, setSvcResult] = useState<{cod:boolean;prepaid:boolean;pickup:boolean;zone:string;city:string;state:string} | null | "not_found">(null);
  const [svcStats, setSvcStats] = useState<{total:number;codY:number;prepaidY:number;both:number;prepaidOnly:number;none:number}>({total:0,codY:0,prepaidY:0,both:0,prepaidOnly:0,none:0});

  // ── Our Snaps state ───────────────────────────────────────────────────
  const [snapNewUrl, setSnapNewUrl]         = useState("");
  const [snapNewImageUrl, setSnapNewImageUrl] = useState("");
  const [snapNewCaption, setSnapNewCaption] = useState("");
  const [snapSaving, setSnapSaving]         = useState(false);
  const [snapImageUploading, setSnapImageUploading] = useState(false);

  const SUPABASE_URL_SVC = "https://rrirrmjfdocqtfifzuiz.supabase.co";
  const SUPABASE_KEY_SVC = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";

  async function loadSvcPincodes() {
    setSvcLoading(true);
    try {
      // Fetch all rows with pagination (max 1000 per request in Supabase free)
      let allRows: any[] = [];
      let offset = 0;
      const limit = 1000;
      while (true) {
        const res = await fetch(
          `${SUPABASE_URL_SVC}/rest/v1/serviceable_pincodes?select=pincode,cod,prepaid,pickup,zone,city,state&limit=${limit}&offset=${offset}`,
          { headers: { apikey: SUPABASE_KEY_SVC, Authorization: `Bearer ${SUPABASE_KEY_SVC}` } }
        );
        if (!res.ok) throw new Error("Fetch failed");
        const rows: any[] = await res.json();
        allRows = allRows.concat(rows);
        if (rows.length < limit) break;
        offset += limit;
      }
      const lookup: Record<string, any> = {};
      let codY = 0, prepaidY = 0, both = 0, prepaidOnly = 0, none = 0;
      for (const r of allRows) {
        lookup[String(r.pincode)] = { cod: r.cod, prepaid: r.prepaid, pickup: r.pickup, zone: r.zone || "", city: r.city || "", state: r.state || "" };
        if (r.cod && r.prepaid) both++;
        else if (!r.cod && r.prepaid) prepaidOnly++;
        else if (r.cod && !r.prepaid) codY++;
        else none++;
        if (r.cod) codY = codY; // counted above
        if (r.prepaid) prepaidY++;
      }
      // recompute properly
      let c=0,p=0,b=0,po=0,n=0;
      for(const r of allRows){
        if(r.cod&&r.prepaid){b++;c++;p++;}
        else if(r.cod&&!r.prepaid){c++;}
        else if(!r.cod&&r.prepaid){po++;p++;}
        else{n++;}
      }
      setSvcPincodes(lookup);
      setSvcStats({ total: allRows.length, codY: c, prepaidY: p, both: b, prepaidOnly: po, none: n });
      setSvcLoaded(true);
    } catch(e) {
      showToast("Could not load pincodes from DB", "error");
    } finally {
      setSvcLoading(false);
    }
  }

  function checkSvcPin() {
    const pin = svcCheckPin.trim();
    if (!/^\d{6}$/.test(pin)) { showToast("Enter a valid 6-digit pincode", "error"); return; }
    const found = svcPincodes[pin];
    setSvcResult(found ?? "not_found");
  }
  const [prodTitle, setProdTitle] = useState("");
  const [prodPrice, setProdPrice] = useState(199);
  const [prodCompare, setProdCompare] = useState(1200);
  const [prodCollection, setProdCollection] = useState("god-cases");
  const [prodCollectionIds, setProdCollectionIds] = useState<string[]>(["god-cases"]);
  const [prodStock, setProdStock] = useState<"in_stock" | "low_stock" | "out_of_stock">("in_stock");
  // prodImages: array of 1-3 URLs (Cloudinary https:// or preset key). Min 1, max 3.
  const [prodImages, setProdImages] = useState<string[]>(["default"]);
  const [imageUploading, setImageUploading] = useState<boolean[]>([false, false, false]);
  // Legacy refs kept for resetProdForm / handleEditProductClick compatibility
  const [image1Type, setImage1Type] = useState<"preset" | "upload" | "custom">("preset");
  const [image1Value, setImage1Value] = useState("default");
  const [image2Type, setImage2Type] = useState<"preset" | "upload" | "custom" | "none">("none");
  const [image2Value, setImage2Value] = useState("");
  const [image3Type, setImage3Type] = useState<"preset" | "upload" | "custom" | "none">("none");
  const [image3Value, setImage3Value] = useState("");
  const [statsPeriod, setStatsPeriod] = useState<"day" | "week" | "month" | "six_months" | "year">("month");
  const [prodTags, setProdTags] = useState("");
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodTrending, setProdTrending] = useState(false);
  const [prodNew, setProdNew] = useState(true);
  const [prodBest, setProdBest] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collName, setCollName] = useState("");
  const [collSlug, setCollSlug] = useState("");
  const [collImage, setCollImage] = useState("default");
  const [collImageType, setCollImageType] = useState<"preset" | "upload">("preset");
  const [collDesc, setCollDesc] = useState("");
  const [collIsVisible, setCollIsVisible] = useState(true);
  // Subcollection state
  const [editingSubCollId, setEditingSubCollId] = useState<string | null>(null);
  const [subCollName, setSubCollName] = useState("");
  const [subCollProductIds, setSubCollProductIds] = useState<string[]>([]);
  const [subCollSearch, setSubCollSearch] = useState("");
  const [subCollImage, setSubCollImage] = useState("");
  const [subCollImageType, setSubCollImageType] = useState<"upload" | "url">("url");
  // Product list search + filter
  const [prodListSearch, setProdListSearch] = useState("");
  const [prodListColFilter, setProdListColFilter] = useState("all");
  // Bulk collection edit
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkCollectionIds, setBulkCollectionIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [logoText, setLogoText] = useState("");
  const [logoSubtext, setLogoSubtext] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploadPreview, setLogoUploadPreview] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [reassuranceCard1Title, setReassuranceCard1Title] = useState("");
  const [reassuranceCard1Body, setReassuranceCard1Body] = useState("");
  const [reassuranceCard2Title, setReassuranceCard2Title] = useState("");
  const [reassuranceCard2Body, setReassuranceCard2Body] = useState("");
  const [reassuranceCard3Title, setReassuranceCard3Title] = useState("");
  const [reassuranceCard3Body, setReassuranceCard3Body] = useState("");
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [banTitle, setBanTitle] = useState("");
  const [banSubtitle, setBanSubtitle] = useState("");
  const [banImageUrl, setBanImageUrl] = useState("");
  const [banMobileImageUrl, setBanMobileImageUrl] = useState("");
  const [banLink, setBanLink] = useState("");
  const [banOrder, setBanOrder] = useState(1);
  const [banBadge, setBanBadge] = useState("");
  const [settingsSec, setSettingsSec] = useState<"branding" | "banners" | "announcements" | "seo" | "shipping" | "promotions" | "social" | "storeconfig">("branding");

  // SEO — dynamic meta settings
  const [seoHomeTitle, setSeoHomeTitle] = useState("");
  const [seoHomeDescription, setSeoHomeDescription] = useState("");
  const [seoHomeKeywords, setSeoHomeKeywords] = useState("");
  const [seoCollectionOverrides, setSeoCollectionOverrides] = useState<Record<string, { title?: string; description?: string; keywords?: string }>>({});

  // Shipping
  const [codEnabled, setCodEnabled] = useState(true);
  const [deliveryMessage, setDeliveryMessage] = useState("Delivered in 3-5 business days");
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState("3-5");

  // Promotions / Coupons
  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [cpCode, setCpCode] = useState("");
  const [cpType, setCpType] = useState<"percent" | "flat">("percent");
  const [cpValue, setCpValue] = useState(10);
  const [cpMinOrder, setCpMinOrder] = useState(0);
  const [cpMaxUses, setCpMaxUses] = useState(0);
  const [cpExpiry, setCpExpiry] = useState("");

  // Social & Chat
  const [whatsappNumber, setWhatsappNumber] = useState("+917418152926");
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Store Config
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("We are updating our store. Back shortly!");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [taxRate, setTaxRate] = useState(0);
  const [storeTimezone, setStoreTimezone] = useState("Asia/Kolkata");
  const [announcementText, setAnnouncementText] = useState("");
  const [brandModels, setBrandModels] = useState<Record<string, string[]>>({});
  const [activeBrandName, setActiveBrandName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [brandOrder, setBrandOrder] = useState<string[]>([]);
  const [dragBrandIdx, setDragBrandIdx] = useState<number | null>(null);
  const [dragBrandOver, setDragBrandOver] = useState<number | null>(null);
  const [dragModelIdx, setDragModelIdx] = useState<number | null>(null);
  const [dragModelOver, setDragModelOver] = useState<number | null>(null);

  useEffect(() => {
    const isSessionVerified = sessionStorage.getItem("admin_verified") === "true";
    const savedName = sessionStorage.getItem("admin_name") || "";
    setIsAdmin(isSessionVerified);
    setAdminName(savedName);
    setNameStep(false); // Always go to password directly
    setLoading(false);
    // Pre-load logo for login screen
    getSettings().then(stg => { if (stg?.logoUrl) setLogoUrl(stg.logoUrl); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAdmin) loadAllAdminData();
  }, [isAdmin]);

  // ── New Order Notification Sound + Badge ──────────────────────────────────
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevOrderIdsRef = React.useRef<Set<string>>(new Set());
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  const playOrderSound = () => {
    try {
      // COIN sound: bright metallic pings — "cha-ching!"
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const playPing = (freq: number, delay: number, vol: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "triangle";
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur + 0.02);
      };

      // Coin: four rapid metallic pings ascending
      playPing(1318, 0.00, 0.55, 0.18);
      playPing(1760, 0.07, 0.45, 0.14);
      playPing(2093, 0.14, 0.35, 0.12);
      playPing(2637, 0.21, 0.25, 0.10);
      // Final sustain "ring"
      playPing(1318, 0.30, 0.30, 0.35);
    } catch {}
  };

  // Poll for new orders every 30s when admin is logged in
  useEffect(() => {
    if (!isAdmin) return;
    const check = async () => {
      try {
        const fresh = await getOrders();
        const freshIds = new Set(fresh.map((o) => o.id));
        const prev = prevOrderIdsRef.current;
        if (prev.size > 0) {
          const newOnes = fresh.filter((o) => !prev.has(o.id));
          if (newOnes.length > 0) {
            setNewOrderCount((c) => c + newOnes.length);
            playOrderSound();
            showToast(`${newOnes.length} new order${newOnes.length > 1 ? "s" : ""} received!`, "success");
            setOrders(fresh);
          }
        } else {
          setOrders(fresh);
        }
        prevOrderIdsRef.current = freshIds;
      } catch {}
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ── Daily Analytics Reset removed (CRITICAL-4 fix) ───────────────────────
  // Auto-deletion at midnight was replaced with a manual Archive button in the UI.

  useEffect(() => {
    if (settings) {
      setLogoText(settings.logoText || "");
      setLogoSubtext(settings.logoSubtext || "");
      setLogoUrl(settings.logoUrl || "");
      setContactPhone(settings.contactPhone || "+91 7418152926");
      setContactEmail(settings.contactEmail || "fabcoverz.in@gmail.com");
      setContactAddress(settings.contactAddress || "Chennai, Tamil Nadu, India");
      setInstagramUrl(settings.instagramUrl || "https://instagram.com/fabcoverz.store");
      setFacebookUrl(settings.facebookUrl || "https://www.facebook.com/profile.php?id=61590280420176");
      setReassuranceCard1Title(settings.reassuranceCard1Title || "10-Ft Drop Protection Armor");
      setReassuranceCard1Body(settings.reassuranceCard1Body || "Metal Glossy Case built with deep soft shock-absorbing TPU frame nodes & polished scratch-resistant glossy print face.");
      setReassuranceCard2Title(settings.reassuranceCard2Title || "Custom Printed Cursives");
      setReassuranceCard2Body(settings.reassuranceCard2Body || "Type your signature cursive Gold/White fonts directly inside our custom models. Personalized exactly according to order.");
      setReassuranceCard3Title(settings.reassuranceCard3Title || "Free Defect Replacements");
      setReassuranceCard3Body(settings.reassuranceCard3Body || "Any transit harm, print blemishes or blemish cracks are covered by our 7-day 100% Free Replacements Guarantee.");
      if (settings.brandModels) {
        setBrandModels(settings.brandModels);
        const keys = Object.keys(settings.brandModels);
        setBrandOrder(keys);
        if (!activeBrandName) {
          if (keys.length > 0) setActiveBrandName(keys[0]);
        }
      }
      // Content editor
      setCeAboutTitle(settings.aboutSectionTitle || "");
      setCeAboutSubtitle(settings.aboutSectionSubtitle || "");
      setCeAboutDesc1(settings.aboutSectionDesc1 || "");
      setCeAboutDesc2(settings.aboutSectionDesc2 || "");
      setCeAboutBadge(settings.bannerStoryBadge || "");
      setCeTrendingTitle(settings.trendingSectionTitle || "");
      setCeTrendingSubtitle(settings.trendingSectionSubtitle || "");
      setCeBestsellerBadge(settings.bestsellerSectionBadge || "");
      setCeBestsellerTitle(settings.bestsellerSectionTitle || "");
      setCeBestsellerSubtitle(settings.bestsellerSectionSubtitle || "");
      setCeReviewsBadge(settings.reviewsBadge || "");
      setCeReviewsTitle(settings.reviewsTitle || "");
      setCeReviewsSubtitle(settings.reviewsSubtitle || "");
      setCeContactBadge(settings.contactSectionBadge || "");
      setCeContactTitle(settings.contactSectionTitle || "");
      setCeContactSubtitle(settings.contactSectionSubtitle || "");
      setCeNewsletterBadge(settings.newsletterBadge || "");
      setCeNewsletterTitle(settings.newsletterTitle || "");
      setCeNewsletterSubtitle(settings.newsletterSubtitle || "");
      setCeNewsletterDisclaimer(settings.newsletterDisclaimer || "");
      setCeTopSellingTitle(settings.topSellingTitle || "Top Selling Products");
      setCeTopSellingIds((settings.topSellingProductIds || []).join(", "));
      setCeCollectionOrder((settings.collectionOrder || []).join(", "));
      setCeFooterDisclaimer(settings.footerDisclaimer || "");
      setCeFreeShipping(settings.freeShippingThreshold || 499);
      // Shipping
      setCodEnabled(settings.codEnabled !== false);
      setDeliveryMessage(settings.deliveryMessage || "Delivered in 3-5 business days");
      setEstimatedDeliveryDays(settings.estimatedDeliveryDays || "3-5");
      // Promotions
      setCoupons(settings.coupons || []);
      // Social
      setWhatsappNumber(settings.whatsappNumber || "+917418152926");
      setWhatsappEnabled(settings.whatsappEnabled !== false);
      setTwitterUrl(settings.twitterUrl || "");
      setYoutubeUrl(settings.youtubeUrl || "");
      // Store Config
      setMaintenanceMode(settings.maintenanceMode || false);
      setMaintenanceMessage(settings.maintenanceMessage || "We are updating our store. Back shortly!");
      setCurrencySymbol(settings.currencySymbol || "₹");
      setTaxRate(settings.taxRate || 0);
      setStoreTimezone(settings.storeTimezone || "Asia/Kolkata");
    }
  }, [settings, activeBrandName]);

  // ── Memoized expensive computations (INP fix) ─────────────────────────────
  const orderStats = useMemo(() => {
    const total = orders.reduce((s, o) => s + o.total, 0);
    const pending = orders.filter(o => o.status === "pending").length;
    const processing = orders.filter(o => o.status === "processing").length;
    return { total, pending, processing };
  }, [orders]);

  const loadAllAdminData = async () => {
    const [prods, cols, bans, ords, stg, faqList, revList] = await Promise.all([
      getProducts(),
      getCollections(),
      getBanners(),
      getOrders(),
      getSettings(),
      getFAQs(),
      getReviews(),
    ]);
    setProducts(prods);
    setBanners(bans.sort((a, b) => (a.order || 0) - (b.order || 0)));
    setOrders(ords);
    setSettings(stg);
    setFaqs(faqList);
    setReviews(revList);

    // ── Auto-migrate old timestamp-based subcollection IDs to name slugs ──
    const toSlug = (name: string) =>
      name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+|-+$/g, "");
    const isOldId = (id: string) => /^sub-\d+$/.test(id);

    let anyMigrated = false;
    let updatedSubcollectionProductOrder = { ...(stg?.subcollectionProductOrder ?? {}) };
    const migratedCols = cols.map(col => ({ ...col }));

    for (let ci = 0; ci < migratedCols.length; ci++) {
      const col = migratedCols[ci];
      const subs = col.subcollections ?? [];
      if (subs.length === 0) continue;

      // Build old-id → new-slug map for this collection
      const idMap: Record<string, string> = {};
      const usedSlugs = new Set<string>(subs.filter(s => !isOldId(s.id)).map(s => s.id));

      for (const sub of subs) {
        if (!isOldId(sub.id)) continue;
        let slug = toSlug(sub.name) || "sub";
        let finalSlug = slug;
        let counter = 2;
        while (usedSlugs.has(finalSlug)) { finalSlug = `${slug}-${counter++}`; }
        usedSlugs.add(finalSlug);
        idMap[sub.id] = finalSlug;
      }

      if (Object.keys(idMap).length === 0) continue;

      // Apply new IDs in-memory
      const migratedSubs = subs.map(sub =>
        idMap[sub.id] ? { ...sub, id: idMap[sub.id] } : sub
      );
      migratedCols[ci] = { ...col, subcollections: migratedSubs };
      anyMigrated = true;

      // Save to Supabase
      try {
        await updateCollection(col.id, { subcollections: migratedSubs });
      } catch { /* silently skip */ }

      // Remap subcollectionProductOrder keys
      for (const [oldId, newId] of Object.entries(idMap)) {
        if (updatedSubcollectionProductOrder[oldId]) {
          updatedSubcollectionProductOrder[newId] = updatedSubcollectionProductOrder[oldId];
          delete updatedSubcollectionProductOrder[oldId];
        }
      }
    }

    if (anyMigrated) {
      try {
        await saveSettings({
          ...stg,
          productOrder: stg?.productOrder ?? {},
          subcollectionProductOrder: updatedSubcollectionProductOrder,
        });
      } catch { /* silently skip */ }
    }

    // Use in-memory migrated collections (no extra Supabase fetch needed)
    const finalCols = anyMigrated ? migratedCols : cols;
    setCollections(finalCols);

    // Initialize ordered collections based on saved order or raw order
    const savedColOrder = stg?.collectionOrder ?? [];
    if (savedColOrder.length > 0) {
      const sorted = [...finalCols].sort((a, b) => {
        const ia = savedColOrder.indexOf(a.slug);
        const ib = savedColOrder.indexOf(b.slug);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      setOrderedCollections(sorted);
    } else {
      setOrderedCollections(finalCols);
    }

    // Initialize product order map
    setProductOrderMap(stg?.productOrder ?? {});

    // Initialize subcollection product order map
    setSubcollectionProductOrderMap(stg?.subcollectionProductOrder ?? {});

    // Initialize Top Selling picker
    const tsIds = stg?.topSellingProductIds ?? [];
    setTopSellingList(tsIds.map(id => prods.find(p => p.id === id)).filter(Boolean) as typeof prods);

    // Initialize Best Selling Metal picker
    const bmIds = stg?.bestSellingMetalProductIds ?? [];
    setBestMetalList(bmIds.map(id => prods.find(p => p.id === id)).filter(Boolean) as typeof prods);

    // Initialize SEO settings
    setSeoHomeTitle(stg?.seoHomeTitle ?? "");
    setSeoHomeDescription(stg?.seoHomeDescription ?? "");
    setSeoHomeKeywords(stg?.seoHomeKeywords ?? "");
    setSeoCollectionOverrides(stg?.seoCollectionOverrides ?? {});
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setPasswordError(`Too many attempts. Try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s.`);
      return;
    }
    try {
      // Call Supabase Edge Function to verify password server-side
      // verify_jwt = false ஆனதால் auth header தேவையில்லை
      const res = await fetch(`${SUPABASE_URL_LIVE}/functions/v1/verify-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: adminEmailInput, password: adminPasswordInput }),
      });
      const data = await res.json();
      if (data.ok) {
        failedAttemptsRef.current = 0;
        setLockoutUntil(null);
        sessionStorage.setItem("admin_verified", "true");
        setIsAdmin(true);
        setPasswordError("");
        showToast(`Welcome, ${adminName}! Access Granted.`, "success");
      } else {
        failedAttemptsRef.current += 1;
        if (failedAttemptsRef.current >= 5) {
          setLockoutUntil(Date.now() + 30_000);
          failedAttemptsRef.current = 0;
          setPasswordError("Too many failed attempts. Locked for 30 seconds.");
        } else {
          setPasswordError("Incorrect admin password. Please try again.");
        }
      }
    } catch {
      setPasswordError("Network error. Please try again.");
    }
  };

  const resetProdForm = () => {
    setEditingProduct(null); setProdTitle(""); setProdPrice(199); setProdCompare(1200);
    setProdCollection("god-cases"); setProdCollectionIds(["god-cases"]); setProdStock("in_stock");
    setProdImages(["default"]);
    setImageUploading([false, false, false]);
    setProdTags(""); setProdFeatured(false);
    setProdTrending(false); setProdNew(true); setProdBest(false);
    setProductModalOpen(false);
  };

  // ── Cloudinary upload handlers ────────────────────────────────────────────
  // Images go to Cloudinary CDN → we store the returned https:// URL in Supabase.
  // No more base64 bloat in the database!

  const handleImageUpload = (file: File, setImageValue: (val: string) => void) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast("Image must be under 15MB", "error"); return; }
    showToast("Uploading image…", "success");
    uploadToCloudinary(file, "fabcoverz/collections")
      .then((url) => { setImageValue(url); showToast("Image uploaded successfully!", "success"); })
      .catch((err) => showToast(err?.message || "Image upload failed.", "error"));
  };

  // Shared handler for logo/banner uploads - uploads to Cloudinary CDN
  const handleRawImageUpload = (file: File, onResult: (url: string) => void) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB", "error"); return; }
    showToast("Uploading image…", "success");
    processAndUpload(file, 1200, 1200, "fabcoverz/assets")
      .then((url) => { onResult(url); showToast("Image uploaded!", "success"); })
      .catch((err) => showToast(err?.message || "Image upload failed.", "error"));
  };

  // Banner upload — original quality, no canvas resize/compression
  const handleBannerImageUpload = (file: File, onResult: (url: string) => void) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast("Image must be under 15MB", "error"); return; }
    showToast("Uploading banner…", "success");
    uploadToCloudinary(file, "fabcoverz/banners")
      .then((url) => { onResult(url); showToast("Banner uploaded!", "success"); })
      .catch((err) => showToast(err?.message || "Banner upload failed.", "error"));
  };

  // "Our Snaps" image upload — uploads the chosen photo straight to Cloudinary
  const handleSnapImageUpload = (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast("Image must be under 15MB", "error"); return; }
    setSnapImageUploading(true);
    showToast("Uploading image…", "success");
    uploadToCloudinary(file, "fabcoverz/snaps")
      .then((url) => { setSnapNewImageUrl(url); showToast("Image uploaded to Cloudinary!", "success"); })
      .catch((err) => showToast(err?.message || "Image upload failed.", "error"))
      .finally(() => setSnapImageUploading(false));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle) return;
    const discountValue = Math.round(((prodCompare - prodPrice) / prodCompare) * 100);
    const finalImages: string[] = prodImages.filter(u => u && u.trim()).slice(0, 3);
    if (finalImages.length === 0) finalImages.push("default");
    const dataPayload = {
      title: prodTitle, price: Number(prodPrice), comparePrice: Number(prodCompare),
      discount: discountValue, description: `Premium durable hybrid phone case model with visual print face.`,
      collectionId: prodCollectionIds[0] ?? prodCollection,
      collectionIds: prodCollectionIds.length > 0 ? prodCollectionIds : [prodCollection],
      stockStatus: prodStock, images: finalImages,
      models: ["iPhone 15 Pro Max", "iPhone 15 Pro", "Samsung S24 Ultra", "OnePlus 12"],
      tags: prodTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      isFeatured: prodFeatured, isTrending: prodTrending, isNewArrival: prodNew,
      isBestSeller: prodBest, updatedAt: new Date().toISOString(),
    };
    try {
      if (editingProduct) { await updateProduct(editingProduct.id, dataPayload); showToast("Product updated successfully!", "success"); }
      else { const randomId = "prod-" + Math.floor(100000 + Math.random() * 900000); await addProduct({ ...dataPayload, id: randomId, createdAt: new Date().toISOString() } as any); showToast("Product added to catalog!", "success"); }
      resetProdForm(); loadAllAdminData();
    } catch (err: any) { showToast(err?.message || "Could not save product.", "error"); }
  };

  const handleEditProductClick = (p: Product) => {
    setEditingProduct(p); setProdTitle(p.title); setProdPrice(p.price); setProdCompare(p.comparePrice || 1200);
    const ids = p.collectionIds?.length ? p.collectionIds : (p.collectionId ? [p.collectionId] : []);
    setProdCollection(ids[0] ?? ""); setProdCollectionIds(ids); setProdStock(p.stockStatus);
    const imgs = p.images || [];
    const img1 = imgs[0] || "default";
    if (img1.startsWith("data:")) setImage1Type("upload");
    else if (img1.startsWith("http") || img1.includes(".") || img1.includes("/")) setImage1Type("custom");
    else setImage1Type("preset");
    setImage1Value(img1);
    // Sync new array-based state
    const loadedImgs = imgs.length > 0 ? imgs.slice(0, 3) : ["default"];
    setProdImages(loadedImgs);
    setImageUploading([false, false, false]);
    setProdTags(p.tags.join(", ")); setProdFeatured(p.isFeatured); setProdTrending(p.isTrending); setProdNew(p.isNewArrival); setProdBest(p.isBestSeller);
    setProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    try { await deleteProduct(id); showToast("Product deleted.", "success"); loadAllAdminData(); }
    catch (err) { showToast("Failed to delete product.", "error"); }
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collName || !collSlug) return;
    const payload = { name: collName, slug: collSlug, image: collImage, description: collDesc || `A collection grouping custom themed ${collName} prints.`, subcollections: editingCollection?.subcollections ?? [], isVisible: collIsVisible };
    try {
      if (editingCollection) { await updateCollection(editingCollection.id, payload); showToast("Collection updated!", "success"); }
      else { await addCollection({ ...payload, id: collSlug }); showToast("Collection created!", "success"); }
      setEditingCollection(null); setCollName(""); setCollSlug(""); setCollImage("default"); setCollDesc(""); setCollIsVisible(true); loadAllAdminData();
    } catch (err) { showToast("Could not save collection.", "error"); }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!window.confirm("Delete this collection?")) return;
    try { await deleteCollection(id); showToast("Collection deleted.", "success"); loadAllAdminData(); }
    catch (err) { showToast("Could not delete collection.", "error"); }
  };

  const handleSaveSubCollection = async () => {
    if (!editingCollection || !subCollName.trim()) return;
    const existing = editingCollection.subcollections ?? [];
    let updated;
    if (editingSubCollId) {
      updated = existing.map(s => s.id === editingSubCollId ? { ...s, name: subCollName, image: subCollImage, productIds: subCollProductIds } : s);
    } else {
      // Generate unique slug within this collection
      const toSlug = (name: string) =>
        name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+|-+$/g, "");
      const usedIds = new Set(existing.map(s => s.id));
      let baseSlug = toSlug(subCollName) || "subcollection";
      let finalSlug = baseSlug;
      let counter = 2;
      while (usedIds.has(finalSlug)) { finalSlug = `${baseSlug}-${counter++}`; }
      const newSub = { id: finalSlug, name: subCollName, image: subCollImage, productIds: subCollProductIds };
      updated = [...existing, newSub];
    }
    const newColl = { ...editingCollection, subcollections: updated };
    try {
      await updateCollection(editingCollection.id, { subcollections: updated });
      setEditingCollection(newColl);
      setEditingSubCollId(null); setSubCollName(""); setSubCollProductIds([]); setSubCollSearch(""); setSubCollImage(""); setSubCollImageType("url");
      showToast("Subcollection saved!", "success"); loadAllAdminData();
    } catch { showToast("Failed to save subcollection.", "error"); }
  };

  const handleDeleteSubCollection = async (subId: string) => {
    if (!editingCollection) return;
    const updated = (editingCollection.subcollections ?? []).filter(s => s.id !== subId);
    try {
      await updateCollection(editingCollection.id, { subcollections: updated });
      setEditingCollection({ ...editingCollection, subcollections: updated });
      showToast("Subcollection deleted.", "success"); loadAllAdminData();
    } catch { showToast("Failed to delete subcollection.", "error"); }
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion || !faqAnswer) return;
    try {
      const docId = editingFaq?.id || "faq-" + Date.now();
      const data: FAQItem = { id: docId, question: faqQuestion, answer: faqAnswer };
      if (editingFaq) { await updateFAQ(docId, data); } else { await addFAQ(data); }
      showToast(editingFaq ? "FAQ updated!" : "FAQ published!", "success");
      getFAQs().then(setFaqs); setEditingFaq(null); setFaqQuestion(""); setFaqAnswer("");
    } catch (err) { showToast("Could not save FAQ.", "error"); }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm("Delete this FAQ?")) return;
    try { await deleteFAQ(id); showToast("FAQ deleted.", "success"); setFaqs(prev => prev.filter(f => f.id !== id)); }
    catch (err) { showToast("Could not delete FAQ.", "error"); }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revName || !revReview) return;
    try {
      const docId = editingReview?.id || "review-" + Date.now();
      const data: ReviewItem = { id: docId, name: revName, location: revLocation, review: revReview, rating: revRating, verified: revVerified };
      if (editingReview) { await updateReview(docId, data); } else { await addReview(data); }
      showToast(editingReview ? "Review updated!" : "Review published!", "success");
      getReviews().then(setReviews); setEditingReview(null); setRevName(""); setRevLocation(""); setRevReview(""); setRevRating(5); setRevVerified(true);
    } catch (err) { showToast("Could not save review.", "error"); }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm("Delete this review?")) return;
    try { await deleteReview(id); showToast("Review deleted.", "success"); setReviews(prev => prev.filter(r => r.id !== id)); }
    catch (err) { showToast("Could not delete review.", "error"); }
  };

  const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; border: string; row: string }> = {
    pending:                          { label: "Pending",                          dot: "bg-amber-400",    badge: "bg-amber-100 text-amber-700",      border: "border-amber-200 bg-amber-50 text-amber-700",      row: "bg-white" },
    waiting_for_manufacturing:        { label: "Waiting for Manufacturing",        dot: "bg-orange-400",   badge: "bg-orange-100 text-orange-700",    border: "border-orange-200 bg-orange-50 text-orange-700",    row: "bg-orange-50/30" },
    waiting_for_customer_confirmation:{ label: "Waiting for Customer Confirmation",dot: "bg-yellow-400",   badge: "bg-yellow-100 text-yellow-700",    border: "border-yellow-200 bg-yellow-50 text-yellow-700",    row: "bg-yellow-50/30" },
    processing:                       { label: "Processing",                       dot: "bg-blue-500",     badge: "bg-blue-100 text-blue-700",        border: "border-blue-200 bg-blue-50 text-blue-700",          row: "bg-[#eff6ff]" },
    ready_to_ship:                    { label: "Ready to Ship",                    dot: "bg-violet-500",   badge: "bg-violet-100 text-violet-700",    border: "border-violet-200 bg-violet-50 text-violet-700",    row: "bg-violet-50/30" },
    waiting_for_pickup:               { label: "Waiting for Pickup",               dot: "bg-indigo-400",   badge: "bg-indigo-100 text-indigo-700",    border: "border-indigo-200 bg-indigo-50 text-indigo-700",    row: "bg-indigo-50/30" },
    shipped:                          { label: "Shipped",                          dot: "bg-sky-400",      badge: "bg-sky-100 text-sky-700",          border: "border-sky-200 bg-sky-50 text-sky-700",             row: "bg-[#f0f9ff]" },
    out_for_delivery:                 { label: "Out for Delivery",                 dot: "bg-teal-500",     badge: "bg-teal-100 text-teal-700",        border: "border-teal-200 bg-teal-50 text-teal-700",          row: "bg-teal-50/30" },
    delivered:                        { label: "Delivered",                        dot: "bg-emerald-400",  badge: "bg-emerald-100 text-emerald-700",  border: "border-emerald-200 bg-emerald-50 text-emerald-700", row: "bg-[#f0fdf4]" },
    cancelled:                        { label: "Cancelled",                        dot: "bg-red-400",      badge: "bg-red-100 text-red-700",          border: "border-red-200 bg-red-50 text-red-700",             row: "bg-red-50/20" },
    returned:                         { label: "Returned",                         dot: "bg-zinc-400",     badge: "bg-zinc-100 text-zinc-600",        border: "border-zinc-200 bg-zinc-50 text-zinc-600",          row: "bg-zinc-50/30" },
  };
  const getStatusCfg = (s: string) => STATUS_CONFIG[s] ?? STATUS_CONFIG["pending"];

  const handleUpdateOrderStatus = async (id: string, newStatus: Order["status"]) => {
    try { await updateOrder(id, { status: newStatus }); showToast(`Order status updated to ${newStatus}`, "success"); loadAllAdminData(); }
    catch (err) { showToast("Could not update order.", "error"); }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Delete this order permanently? This cannot be undone.")) return;
    try { await deleteOrder(id); showToast("Order deleted.", "success"); loadAllAdminData(); }
    catch (err) { showToast("Could not delete order.", "error"); }
  };

  // ── AWB / Shipment ID Modal ─────────────────────────────────────────────────
  const [awbModal, setAwbModal] = useState<{ orderId: string; customerName: string } | null>(null);
  const [awbInput, setAwbInput] = useState("");
  const [awbSaving, setAwbSaving] = useState(false);

  const handleStatusChange = async (ord: Order, newStatus: Order["status"]) => {
    if (newStatus === "shipped") {
      // If AWB already exists, just mark shipped directly
      if (ord.awb) {
        await handleUpdateOrderStatus(ord.id, "shipped");
        return;
      }
      // Auto-create shipment in NimbusPost → AWB auto-fills
      if (npPushingOrderId) return;
      setNpPushingOrderId(ord.id);
      showToast("Creating shipment in NimbusPost…", "success");
      try {
        const res = await fetch(
          `${SUPABASE_URL_LIVE}/functions/v1/nimbuspost-create-shipment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY_LIVE,
              Authorization: `Bearer ${SUPABASE_KEY_LIVE}`,
            },
            body: JSON.stringify({ order: ord }),
          }
        );
        const data = await res.json();
        if (!data.success) {
          const rawMsg = data.raw ? ` | Raw: ${JSON.stringify(data.raw)}` : "";
          throw new Error((data.error || "Shipment creation failed") + rawMsg);
        }
        if (data.awb) {
          showToast(`Shipped — AWB: ${data.awb}`, "success");
        } else {
          // No AWB yet (not shipped in NimbusPost) — fallback to manual entry
          showToast("Order added to NimbusPost (Not Shipped). Enter AWB manually.", "error");
          setAwbInput("");
          setAwbModal({ orderId: ord.id, customerName: ord.customerName });
        }
        loadAllAdminData();
      } catch (e: any) {
        const msg = e?.message || String(e);
        showToast(`NimbusPost Error: ${msg}`, "error");
      } finally {
        setNpPushingOrderId(null);
      }
    } else {
      handleUpdateOrderStatus(ord.id, newStatus);
    }
  };

  const handleSaveAwbAndShip = async () => {
    if (!awbModal) return;
    const trimmed = awbInput.trim();
    if (!trimmed) { showToast("Enter a valid Shipment ID (AWB)", "error"); return; }
    setAwbSaving(true);
    try {
      await updateOrder(awbModal.orderId, { status: "shipped", awb: trimmed } as any);
      showToast(`Marked as Shipped - AWB: ${trimmed}`, "success");
      setAwbModal(null);
      setAwbInput("");
      loadAllAdminData();
    } catch {
      showToast("Could not update order.", "error");
    } finally {
      setAwbSaving(false);
    }
  };

  // ── NimbusPost Auto-Shipment ─────────────────────────────────────────────────
  // All NimbusPost calls go through the Supabase edge function (server-side)
  // because NimbusPost API doesn't allow direct browser requests (CORS).
  const [npPushingOrderId, setNpPushingOrderId] = useState<string | null>(null);

  const pushToNimbusPost = async (ord: Order) => {
    if (npPushingOrderId) return;
    setNpPushingOrderId(ord.id);
    try {
      const res = await fetch(
        `${SUPABASE_URL_LIVE}/functions/v1/nimbuspost-create-shipment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY_LIVE,
            Authorization: `Bearer ${SUPABASE_KEY_LIVE}`,
          },
          body: JSON.stringify({ order: ord }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        // Show the full NimbusPost error including raw response details
        const rawMsg = data.raw ? ` | Raw: ${JSON.stringify(data.raw)}` : "";
        const errMsg = (data.error || "Shipment creation failed") + rawMsg;
        console.error("[NimbusPost Push] Failed:", errMsg);
        throw new Error(data.error || "Shipment creation failed");
      }
      // Edge function already saved AWB to DB via service key.
      // Refresh admin data to reflect updated status + awb.
      showToast(data.awb ? `Shipment created! AWB: ${data.awb}` : "Order added to NimbusPost (Not Shipped) ✓ Ship manually from NimbusPost.", "success");
      loadAllAdminData();
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error("[NimbusPost Push] Error:", msg);
      showToast(`NimbusPost Error: ${msg}`, "error");
    } finally {
      setNpPushingOrderId(null);
    }
  };

  // ── Track Order (NimbusPost AWB Status) ────────────────────────────────────
  const [trackModal, setTrackModal] = useState<{ orderId: string; awb: string; customerName: string } | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackData, setTrackData] = useState<any>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const openTrackModal = async (ord: Order) => {
    if (!ord.awb) return;
    setTrackModal({ orderId: ord.id, awb: ord.awb, customerName: ord.customerName });
    setTrackLoading(true);
    setTrackData(null);
    setTrackError(null);
    try {
      const res = await fetch(
        `${SUPABASE_URL_LIVE}/functions/v1/nimbuspost-track`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY_LIVE,
            Authorization: `Bearer ${SUPABASE_KEY_LIVE}`,
          },
          body: JSON.stringify({ awb: ord.awb }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Tracking failed");
      setTrackData(data.tracking);
    } catch (e: any) {
      setTrackError(e?.message || "Could not fetch tracking info");
    } finally {
      setTrackLoading(false);
    }
  };

  // ── Edit Order ──────────────────────────────────────────────────────────────
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderData, setEditOrderData] = useState<Partial<Order> & { items: Order["items"] }>({ items: [] });

  const openEditOrder = (ord: Order) => {
    setEditingOrder(ord);
    setEditOrderData({
      customerName: ord.customerName,
      customerEmail: ord.customerEmail,
      customerPhone: ord.customerPhone,
      customerAltPhone: ord.customerAltPhone || "",
      shippingAddress: ord.shippingAddress,
      city: ord.city,
      state: ord.state,
      pincode: ord.pincode,
      paymentMethod: ord.paymentMethod,
      items: ord.items.map(it => ({ ...it })),
    });
  };

  const [editSaveAndPush, setEditSaveAndPush] = useState(false);

  // ₹199 per item fixed price; shipping: TN=₹50, others=₹100
  const calcEditOrderTotals = (items: Order["items"], paymentMethod: string, state: string) => {
    const PRICE_PER_ITEM = 299;
    const isCOD = paymentMethod === "cod";
    const isTN = (state || "").trim().toLowerCase().replace(/\s+/g, "") === "tamilnadu";
    const subtotal = items.reduce((sum, it) => sum + PRICE_PER_ITEM * (it.quantity || 1), 0);
    const shipping = isCOD ? (isTN ? 50 : 70) : 0;
    const total = subtotal + shipping;
    return { subtotal, shipping, total };
  };

  const handleSaveOrderEdit = async () => {
    if (!editingOrder) return;
    // Validate phone: must be 10 digits starting with 6-9
    const phoneToSave = String(editOrderData.customerPhone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phoneToSave)) {
      showToast("Customer phone must be a valid 10-digit Indian mobile number (starts with 6-9).", "error");
      return;
    }
    const altPhoneToSave = String(editOrderData.customerAltPhone || "").replace(/\D/g, "");
    if (altPhoneToSave && !/^[6-9]\d{9}$/.test(altPhoneToSave.slice(-10))) {
      showToast("Alternate phone must also be a valid 10-digit Indian mobile number.", "error");
      return;
    }
    // Recalculate totals: ₹299 per item, shipping based on COD+state
    const { subtotal, shipping, total } = calcEditOrderTotals(
      editOrderData.items,
      editOrderData.paymentMethod || "cod",
      editOrderData.state || ""
    );
    const updatedData = { ...editOrderData, subtotal, shipping, total };
    try {
      await updateOrder(editingOrder.id, updatedData as any);
      showToast("Order updated successfully!", "success");
      setEditingOrder(null);
      loadAllAdminData();
      // Auto-push to NimbusPost if checkbox was checked
      if (editSaveAndPush) {
        const updatedOrder = { ...editingOrder, ...updatedData };
        await pushToNimbusPost(updatedOrder as Order);
      }
    } catch {
      showToast("Could not update order.", "error");
    }
  };

  // ── Merge Orders ─────────────────────────────────────────────────────────────
  const [mergeSourceOrder, setMergeSourceOrder] = useState<Order | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeSuggestions, setMergeSuggestions] = useState<Order[]>([]);

  const openMergeModal = (ord: Order) => {
    setMergeSourceOrder(ord);
    setMergeTargetId("");
    // Auto-suggest: same phone OR same pincode+address (different order id)
    const phone = ord.customerPhone?.trim();
    const pin   = ord.pincode?.trim();
    const addr  = ord.shippingAddress?.toLowerCase().trim();
    const suggestions = orders.filter(o =>
      o.id !== ord.id &&
      o.status !== ("archived" as any) &&
      (
        (phone && o.customerPhone?.trim() === phone) ||
        (pin   && o.pincode?.trim() === pin && o.shippingAddress?.toLowerCase().trim() === addr)
      )
    );
    setMergeSuggestions(suggestions);
    setMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeSourceOrder || !mergeTargetId) return;
    const target = orders.find(o => o.id === mergeTargetId);
    if (!target) { showToast("Target order not found.", "error"); return; }
    if (!confirm(`Merge ${target.id.startsWith("FC") ? target.id : "#" + target.id.slice(-8)} INTO ${mergeSourceOrder.id.startsWith("FC") ? mergeSourceOrder.id : "#" + mergeSourceOrder.id.slice(-8)}?\n\nItems from the second order will be added to the first, and the second order will be deleted.`)) return;

    // Combine items, recalc total
    const mergedItems = [...mergeSourceOrder.items, ...target.items];
    const mergedTotal = mergedItems.reduce((sum, it) => sum + it.product.price * it.quantity, 0) + mergeSourceOrder.shipping;

    try {
      await updateOrder(mergeSourceOrder.id, { items: mergedItems, total: mergedTotal, subtotal: mergedTotal - mergeSourceOrder.shipping } as any);
      await deleteOrder(target.id);
      showToast(`Orders merged! ${target.id.startsWith("FC") ? target.id : "#" + target.id.slice(-8)} → ${mergeSourceOrder.id.startsWith("FC") ? mergeSourceOrder.id : "#" + mergeSourceOrder.id.slice(-8)}`, "success");
      setMergeModalOpen(false);
      setMergeSourceOrder(null);
      loadAllAdminData();
    } catch {
      showToast("Merge failed. Try again.", "error");
    }
  };

  const handleAddAnnouncement = async () => {
    if (!announcementText.trim() || !settings) return;
    const newAnn: Announcement = { id: "ann-" + Date.now(), text: announcementText.trim() };
    const updatedAnnouncements = [...settings.announcements, newAnn];
    try { const currentSettings = await getSettings(); await saveSettings({ ...currentSettings, announcements: updatedAnnouncements }); setAnnouncementText(""); showToast("Announcement published!", "success"); loadAllAdminData(); }
    catch (err) { showToast("Could not publish announcement.", "error"); }
  };

  const handleRemoveAnnouncement = async (id: string) => {
    if (!settings) return;
    const filtered = settings.announcements.filter((a) => a.id !== id);
    try { const currentSettings = await getSettings(); await saveSettings({ ...currentSettings, announcements: filtered }); showToast("Announcement removed.", "success"); loadAllAdminData(); }
    catch (err) { showToast("Could not remove announcement.", "error"); }
  };

  const handleSaveLogoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentSettings = await getSettings();
      await saveSettings({ ...currentSettings, logoText: logoText.trim(), logoSubtext: logoSubtext.trim(), logoUrl: logoUrl.trim(), contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim(), contactAddress: contactAddress.trim(), instagramUrl: instagramUrl.trim(), facebookUrl: facebookUrl.trim(), reassuranceCard1Title: reassuranceCard1Title.trim(), reassuranceCard1Body: reassuranceCard1Body.trim(), reassuranceCard2Title: reassuranceCard2Title.trim(), reassuranceCard2Body: reassuranceCard2Body.trim(), reassuranceCard3Title: reassuranceCard3Title.trim(), reassuranceCard3Body: reassuranceCard3Body.trim() });
      showToast("Store settings saved!", "success"); loadAllAdminData();
    } catch (err) { showToast("Could not save settings.", "error"); }
  };

  const handleSaveSEOSettings = async () => {
    try {
      const currentSettings = await getSettings();
      await saveSettings({
        ...currentSettings,
        seoHomeTitle: seoHomeTitle.trim(),
        seoHomeDescription: seoHomeDescription.trim(),
        seoHomeKeywords: seoHomeKeywords.trim(),
        seoCollectionOverrides,
      });
      showToast("SEO settings saved!", "success");
      loadAllAdminData();
    } catch (err) { showToast("Could not save SEO settings.", "error"); }
  };

  const handleSaveContentEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const currentSettings = await getSettings();
      await saveSettings({
        ...currentSettings,
        aboutSectionTitle: ceAboutTitle.trim(),
        aboutSectionSubtitle: ceAboutSubtitle.trim(),
        aboutSectionDesc1: ceAboutDesc1.trim(),
        aboutSectionDesc2: ceAboutDesc2.trim(),
        bannerStoryBadge: ceAboutBadge.trim(),
        trendingSectionTitle: ceTrendingTitle.trim(),
        trendingSectionSubtitle: ceTrendingSubtitle.trim(),
        bestsellerSectionBadge: ceBestsellerBadge.trim(),
        bestsellerSectionTitle: ceBestsellerTitle.trim(),
        bestsellerSectionSubtitle: ceBestsellerSubtitle.trim(),
        reviewsBadge: ceReviewsBadge.trim(),
        reviewsTitle: ceReviewsTitle.trim(),
        reviewsSubtitle: ceReviewsSubtitle.trim(),
        contactSectionBadge: ceContactBadge.trim(),
        contactSectionTitle: ceContactTitle.trim(),
        contactSectionSubtitle: ceContactSubtitle.trim(),
        newsletterBadge: ceNewsletterBadge.trim(),
        newsletterTitle: ceNewsletterTitle.trim(),
        newsletterSubtitle: ceNewsletterSubtitle.trim(),
        newsletterDisclaimer: ceNewsletterDisclaimer.trim(),
        footerDisclaimer: ceFooterDisclaimer.trim(),
        freeShippingThreshold: ceFreeShipping,
        topSellingTitle: ceTopSellingTitle.trim(),
        topSellingProductIds: topSellingList.map(p => p.id),
        collectionOrder: orderedCollections.map(c => c.slug),
        productOrder: productOrderMap,
        subcollectionProductOrder: subcollectionProductOrderMap,
        bestSellingMetalProductIds: bestMetalList.map(p => p.id),
      });
      showToast("Website content saved! Refresh the site to see changes.", "success");
      loadAllAdminData();
    } catch (err) {
      showToast("Could not save content.", "error");
    }
  };

  const handleAddBrand = () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) return;
    if (brandModels[trimmed]) { alert("This brand already exists!"); return; }
    const updated = { ...brandModels, [trimmed]: [] };
    setBrandModels(updated); setBrandOrder(prev => [...prev, trimmed]); setActiveBrandName(trimmed); setNewBrandName("");
  };

  const handleRemoveBrand = (brandToRemove: string) => {
    if (!confirm(`Delete brand "${brandToRemove}" and all its models?`)) return;
    const copied = { ...brandModels }; delete copied[brandToRemove]; setBrandModels(copied);
    setBrandOrder(prev => prev.filter(b => b !== brandToRemove));
    if (activeBrandName === brandToRemove) setActiveBrandName(Object.keys(copied)[0] || "");
  };

  const handleAddModel = () => {
    if (!newModelName.trim() || !activeBrandName) return;
    const currentList = brandModels[activeBrandName] || [];
    const entries = newModelName.split(",").map(s => s.trim()).filter(Boolean);
    const toAdd = entries.filter(e => !currentList.includes(e));
    const dupes = entries.filter(e => currentList.includes(e));
    if (dupes.length > 0 && toAdd.length === 0) { alert(`Already exists: ${dupes.join(", ")}`); return; }
    setBrandModels({ ...brandModels, [activeBrandName]: [...currentList, ...toAdd] });
    setNewModelName("");
  };

  const handleRemoveModel = (modelToRemove: string) => {
    if (!activeBrandName) return;
    setBrandModels({ ...brandModels, [activeBrandName]: (brandModels[activeBrandName] || []).filter(m => m !== modelToRemove) });
  };

  const handleSaveBrandModels = async () => {
    if (!settings) return;
    try {
      const currentSettings = await getSettings();
      // Rebuild brandModels in the drag-reordered order
      const orderedBrandModels: Record<string, string[]> = {};
      const orderedKeys = brandOrder.length > 0 ? brandOrder : Object.keys(brandModels);
      for (const k of orderedKeys) { if (brandModels[k]) orderedBrandModels[k] = brandModels[k]; }
      await saveSettings({ ...currentSettings, brandModels: orderedBrandModels });
      setBrandModels(orderedBrandModels);
      showToast("Brands & models saved!", "success");
      loadAllAdminData();
    } catch (err) { showToast("Could not save brands.", "error"); }
  };

  const handleLoadDefaultModels = () => {
    if (!confirm("This will REPLACE all current brands & models with 596+ models from the master Excel sheet (14 brands). Continue?")) return;
    setBrandModels(DEFAULT_BRAND_MODELS);
    setBrandOrder(Object.keys(DEFAULT_BRAND_MODELS));
    setActiveBrandName(Object.keys(DEFAULT_BRAND_MODELS)[0]);
    showToast("596+ models loaded! Click 'Save changes' to persist.", "success");
  };

  const handleSaveShipping = async () => {
    try {
      const cur = await getSettings();
      await saveSettings({ ...cur, codEnabled, deliveryMessage: deliveryMessage.trim(), estimatedDeliveryDays: estimatedDeliveryDays.trim() });
      showToast("Shipping settings saved!", "success"); loadAllAdminData();
    } catch { showToast("Could not save shipping settings.", "error"); }
  };

  const handleAddCoupon = async () => {
    if (!cpCode.trim() || cpValue <= 0) { showToast("Enter a valid code and discount value.", "error"); return; }
    const newCoupon: CouponCode = {
      id: "cp-" + Date.now(),
      code: cpCode.trim().toUpperCase(),
      discountType: cpType,
      discountValue: cpValue,
      minOrder: cpMinOrder || undefined,
      maxUses: cpMaxUses || undefined,
      usedCount: 0,
      active: true,
      expiresAt: cpExpiry || undefined,
    };
    const updated = [...coupons, newCoupon];
    try {
      const cur = await getSettings();
      await saveSettings({ ...cur, coupons: updated });
      setCoupons(updated); setCpCode(""); setCpValue(10); setCpMinOrder(0); setCpMaxUses(0); setCpExpiry("");
      showToast("Coupon added!", "success");
    } catch { showToast("Could not save coupon.", "error"); }
  };

  const handleToggleCoupon = async (id: string) => {
    const updated = coupons.map(c => c.id === id ? { ...c, active: !c.active } : c);
    try {
      const cur = await getSettings();
      await saveSettings({ ...cur, coupons: updated });
      setCoupons(updated); showToast("Coupon updated!", "success");
    } catch { showToast("Could not update coupon.", "error"); }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const updated = coupons.filter(c => c.id !== id);
    try {
      const cur = await getSettings();
      await saveSettings({ ...cur, coupons: updated });
      setCoupons(updated); showToast("Coupon deleted.", "success");
    } catch { showToast("Could not delete coupon.", "error"); }
  };

  const handleSaveSocial = async () => {
    try {
      const cur = await getSettings();
      await saveSettings({ ...cur, whatsappNumber: whatsappNumber.trim(), whatsappEnabled, twitterUrl: twitterUrl.trim(), youtubeUrl: youtubeUrl.trim() });
      showToast("Social settings saved!", "success"); loadAllAdminData();
    } catch { showToast("Could not save social settings.", "error"); }
  };

  const handleSaveStoreConfig = async () => {
    try {
      const cur = await getSettings();
      await saveSettings({ ...cur, maintenanceMode, maintenanceMessage: maintenanceMessage.trim(), currencySymbol: currencySymbol.trim(), taxRate, storeTimezone });
      showToast("Store config saved!", "success"); loadAllAdminData();
    } catch { showToast("Could not save store config.", "error"); }
  };
const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banImageUrl) return;
    const autoTitle = `Banner ${Date.now()}`;
    const bannerPayload = { title: autoTitle, subtitle: "", badge: "", imageUrl: banImageUrl.trim(), mobileImageUrl: banMobileImageUrl.trim(), link: "", order: Number(banOrder), active: true };
    try {
      if (editingBanner) { await updateBanner(editingBanner.id, bannerPayload); showToast("Banner updated!", "success"); }
      else { const randomId = "banner-" + Date.now(); await addBanner({ ...bannerPayload, id: randomId } as any); showToast("Banner published!", "success"); }
      resetBannerForm(); loadAllAdminData();
    } catch (err) { showToast("Failed to save banner.", "error"); }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm("Delete this banner?")) return;
    try { await deleteBanner(id); showToast("Banner deleted.", "success"); loadAllAdminData(); }
    catch (err) { showToast("Could not delete banner.", "error"); }
  };

  const resetBannerForm = () => { setEditingBanner(null); setBanTitle(""); setBanSubtitle(""); setBanImageUrl(""); setBanMobileImageUrl(""); setBanLink(""); setBanOrder(1); setBanBadge(""); };

  const handleEditBannerClick = (b: Banner) => { setEditingBanner(b); setBanTitle(b.title); setBanSubtitle(""); setBanBadge(""); setBanImageUrl(b.imageUrl); setBanMobileImageUrl(b.mobileImageUrl || ""); setBanLink("/collections/all"); setBanOrder(b.order); };

  // Stats
  const getPeriodMs = () => { switch (statsPeriod) { case "day": return 86400000; case "week": return 604800000; case "month": return 2592000000; case "six_months": return 15552000000; case "year": return 31536000000; default: return 2592000000; } };
  const nowTime = Date.now();
  const filteredOrders = orders.filter(o => (nowTime - new Date(o.createdAt).getTime()) <= getPeriodMs());
  const periodSales = filteredOrders.filter(o => ["delivered","processing","shipped","pending","waiting_for_manufacturing","waiting_for_customer_confirmation","ready_to_ship","waiting_for_pickup","out_for_delivery"].includes(o.status)).reduce((acc, curr) => acc + curr.total, 0);
  const periodAov = filteredOrders.length > 0 ? Math.round(periodSales / filteredOrders.length) : 0;
  const totalItemsSold = filteredOrders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const statusCounts = {
    pending: filteredOrders.filter(o => o.status === "pending").length,
    waiting_for_manufacturing: filteredOrders.filter(o => o.status === "waiting_for_manufacturing").length,
    waiting_for_customer_confirmation: filteredOrders.filter(o => o.status === "waiting_for_customer_confirmation").length,
    processing: filteredOrders.filter(o => o.status === "processing").length,
    ready_to_ship: filteredOrders.filter(o => o.status === "ready_to_ship").length,
    waiting_for_pickup: filteredOrders.filter(o => o.status === "waiting_for_pickup").length,
    shipped: filteredOrders.filter(o => o.status === "shipped").length,
    out_for_delivery: filteredOrders.filter(o => o.status === "out_for_delivery").length,
    delivered: filteredOrders.filter(o => o.status === "delivered").length,
    cancelled: filteredOrders.filter(o => o.status === "cancelled").length,
    returned: filteredOrders.filter(o => o.status === "returned").length,
  };

  // Content Editor states
  const [ceAboutTitle, setCeAboutTitle] = useState("");
  const [ceAboutSubtitle, setCeAboutSubtitle] = useState("");
  const [ceAboutDesc1, setCeAboutDesc1] = useState("");
  const [ceAboutDesc2, setCeAboutDesc2] = useState("");
  const [ceAboutBadge, setCeAboutBadge] = useState("");
  const [ceTrendingTitle, setCeTrendingTitle] = useState("");
  const [ceTrendingSubtitle, setCeTrendingSubtitle] = useState("");
  const [ceBestsellerBadge, setCeBestsellerBadge] = useState("");
  const [ceBestsellerTitle, setCeBestsellerTitle] = useState("");
  const [ceBestsellerSubtitle, setCeBestsellerSubtitle] = useState("");
  const [ceReviewsBadge, setCeReviewsBadge] = useState("");
  const [ceReviewsTitle, setCeReviewsTitle] = useState("");
  const [ceReviewsSubtitle, setCeReviewsSubtitle] = useState("");
  const [ceContactBadge, setCeContactBadge] = useState("");
  const [ceContactTitle, setCeContactTitle] = useState("");
  const [ceContactSubtitle, setCeContactSubtitle] = useState("");
  const [ceNewsletterBadge, setCeNewsletterBadge] = useState("");
  const [ceNewsletterTitle, setCeNewsletterTitle] = useState("");
  const [ceNewsletterSubtitle, setCeNewsletterSubtitle] = useState("");
  const [ceNewsletterDisclaimer, setCeNewsletterDisclaimer] = useState("");
  const [ceFooterDisclaimer, setCeFooterDisclaimer] = useState("");
  const [ceFreeShipping, setCeFreeShipping] = useState(499);
  const [ceTopSellingTitle, setCeTopSellingTitle] = useState("Top Selling Products");
  const [ceTopSellingIds, setCeTopSellingIds] = useState("");
  const [ceCollectionOrder, setCeCollectionOrder] = useState("");

  // Drag & drop: Top Selling Products picker (max 12)
  const [topSellingList, setTopSellingList] = useState<typeof products>([]);
  const [dragTopIdx, setDragTopIdx] = useState<number | null>(null);
  const [dragTopOver, setDragTopOver] = useState<number | null>(null);
  const [topSellingSearch, setTopSellingSearch] = useState("");

  // Drag & drop: Best Selling Metal Glossy picker (max 12)
  const [bestMetalList, setBestMetalList] = useState<typeof products>([]);
  const [dragMetalIdx, setDragMetalIdx] = useState<number | null>(null);
  const [dragMetalOver, setDragMetalOver] = useState<number | null>(null);
  const [bestMetalSearch, setBestMetalSearch] = useState("");

  // Drag & drop state for collection reorder
  const [orderedCollections, setOrderedCollections] = useState<typeof collections>([]);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragColOver, setDragColOver] = useState<number | null>(null);

  // Drag & drop state for subcollection reorder within a collection
  const [dragSubColIdx, setDragSubColIdx] = useState<number | null>(null);
  const [dragSubColOver, setDragSubColOver] = useState<number | null>(null);

  // Drag & drop state for product reorder within a collection
  const [productOrderMap, setProductOrderMap] = useState<Record<string, string[]>>({});
  const [dragProdIdx, setDragProdIdx] = useState<number | null>(null);
  const [dragProdOver, setDragProdOver] = useState<number | null>(null);
  const [productOrderCollSlug, setProductOrderCollSlug] = useState<string>("");
  const [productOrderList, setProductOrderList] = useState<typeof products>([]);

  // Drag & drop state for product reorder within a subcollection
  const [subcollectionProductOrderMap, setSubcollectionProductOrderMap] = useState<Record<string, string[]>>({});
  const [dragSubProdIdx, setDragSubProdIdx] = useState<number | null>(null);
  const [dragSubProdOver, setDragSubProdOver] = useState<number | null>(null);
  const [subProdOrderCollSlug, setSubProdOrderCollSlug] = useState<string>("");
  const [subProdOrderSubId, setSubProdOrderSubId] = useState<string>("");
  const [subProdOrderList, setSubProdOrderList] = useState<typeof products>([]);

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: "products", label: "Products", icon: <Package2 className="w-4 h-4" /> },
    { key: "collections", label: "Collections", icon: <FolderOpen className="w-4 h-4" /> },
    { key: "orders", label: "Orders", icon: <ShoppingCart className="w-4 h-4" /> },
    { key: "phone_models", label: "Phone Models", icon: <Smartphone className="w-4 h-4" /> },
    { key: "serviceability", label: "Serviceability", icon: <MapPin className="w-4 h-4" /> },
    { key: "our_snaps", label: "Our Snaps", icon: <Image className="w-4 h-4" /> },
    { key: "content_editor", label: "Website Content", icon: <FileText className="w-4 h-4" /> },
    { key: "settings", label: "Content", icon: <Settings className="w-4 h-4" /> },
    { key: "faqs", label: "FAQs", icon: <HelpCircle className="w-4 h-4" /> },
    { key: "reviews", label: "Reviews", icon: <Star className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f6f6f7]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#000000] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-[#6d7175]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4" style={{fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'SF Pro', 'Inter', ui-sans-serif, system-ui, sans-serif"}}>
        <div className="w-full max-w-sm">
          {/* Logo + heading */}
          <div className="text-center mb-8">
            <img src={logoUrl || "/assets/logo/logo.png"} alt="FabCoverz" className="h-14 w-auto object-contain mx-auto mb-4 rounded-xl" referrerPolicy="no-referrer" />
            <h1 className="text-2xl font-black text-[#202223] tracking-tight">FabCoverz Admin</h1>
            <p className="text-sm text-[#6d7175] mt-1">Sign in to access your dashboard</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#e1e3e5] p-7">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">

              {/* Email field */}
              <div>
                <label className="block text-xs font-semibold text-[#202223] uppercase tracking-wide mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input
                    type="email"
                    required
                    value={adminEmailInput}
                    onChange={(e) => { setAdminEmailInput(e.target.value); setPasswordError(""); }}
                    placeholder="admin@fabcoverz.in"
                    className="w-full border border-[#c9cccf] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#202223] outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/20 transition bg-[#fafafa] focus:bg-white"
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-[#202223] uppercase tracking-wide mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input
                    type="password"
                    required
                    value={adminPasswordInput}
                    onChange={(e) => { setAdminPasswordInput(e.target.value); setPasswordError(""); }}
                    placeholder="Enter admin password"
                    className="w-full border border-[#c9cccf] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#202223] outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/20 transition bg-[#fafafa] focus:bg-white"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Error */}
              {passwordError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{passwordError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!adminEmailInput.trim() || !adminPasswordInput.trim()}
                className="w-full bg-[#000000] hover:bg-[#0066cc] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-all cursor-pointer mt-1"
              >
                Sign in to Admin
              </button>

            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-[11px] text-[#9ca3af] mt-5">
            Restricted access — FabCoverz team only
          </p>
        </div>
      </div>
    );
  }

  // SHOPIFY-STYLE ADMIN DASHBOARD
  return (
    <div className="flex h-screen bg-[#f6f6f7] font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-[220px] shrink-0 bg-[#1a1a19] flex-col">
        {/* Store name */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
          <img src={logoUrl || "/assets/logo/logo.png"} alt="FabCoverz" className="h-8 w-auto object-contain shrink-0 rounded-lg" referrerPolicy="no-referrer" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate leading-none">FabCoverz</p>
            <p className="text-[#9ca3af] text-[10px] mt-0.5">fabcoverz.store</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {/* Main section */}
          <p className="text-[9px] font-black uppercase tracking-widest text-[#4b5563] px-3 pt-1 pb-1.5">Main</p>
          {navItems.slice(0, 4).map(item => (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key as any); if (item.key === "orders") setNewOrderCount(0); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer text-left group ${
                activeTab === item.key
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-[#9ca3af] hover:text-white hover:bg-white/8"
              }`}
            >
              <span className={`transition-colors ${activeTab === item.key ? "text-white" : "text-[#6b7280] group-hover:text-white"}`}>{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.key === "orders" && newOrderCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                  {newOrderCount}
                </span>
              )}
              {item.key === "orders" && newOrderCount === 0 && (() => {
                const unfulfilledCount = orders.filter(o => ["pending","waiting_for_manufacturing","waiting_for_customer_confirmation","processing","ready_to_ship","waiting_for_pickup"].includes(o.status)).length;
                return unfulfilledCount > 0 ? (
                  <span className="ml-auto bg-amber-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unfulfilledCount}
                  </span>
                ) : null;
              })()}
              {item.key === "products" && (() => {
                const lowStockCount = products.filter(p => p.stockStatus !== "in_stock").length;
                return lowStockCount > 0 ? (
                  <span className="ml-auto bg-[#d82c0d] text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {lowStockCount}
                  </span>
                ) : null;
              })()}
            </button>
          ))}

          {/* Catalog section */}
          <p className="text-[9px] font-black uppercase tracking-widest text-[#4b5563] px-3 pt-3 pb-1.5">Catalog</p>
          {navItems.slice(4).map(item => (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key as any); if (item.key === "serviceability" && !svcLoaded && !svcLoading) loadSvcPincodes(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer text-left group ${
                activeTab === item.key
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-[#9ca3af] hover:text-white hover:bg-white/8"
              }`}
            >
              <span className={`transition-colors ${activeTab === item.key ? "text-white" : "text-[#6b7280] group-hover:text-white"}`}>{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer spacer */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[#4b5563] text-[10px] text-center">Admin Panel</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP BAR */}
        <header className="bg-white border-b border-[#e1e3e5] px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
          {/* Page title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-bold text-[#202223] truncate">
              {navItems.find(n => n.key === activeTab)?.label}
            </span>
            {activeTab === "dashboard" && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-[#e8f0ff] text-[#2c6ecb] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span></span>
                Live
              </span>
            )}
          </div>

          {/* Center: today's revenue (dashboard only) */}
          {activeTab === "dashboard" && (() => {
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const todaySales = orders.filter(o => new Date(o.createdAt) >= todayStart).reduce((s,o) => s+o.total, 0);
            const todayOrderCount = orders.filter(o => new Date(o.createdAt) >= todayStart).length;
            return todayOrderCount > 0 ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#f0fdf4] border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-black">₹{todaySales.toLocaleString()}</span>
                  <span className="text-[10px] font-medium opacity-70">today · {todayOrderCount} orders</span>
                </div>
              </div>
            ) : null;
          })()}

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Pending orders pill */}
            {orders.filter(o => o.status === "pending").length > 0 && (
              <button
                onClick={() => setActiveTab("orders")}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1.5 cursor-pointer hover:bg-amber-100 transition"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{orders.filter(o => o.status === "pending").length} pending</span>
              </button>
            )}
            {/* View site */}
            {onExitAdmin && (
              <button
                onClick={onExitAdmin}
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[#6d7175] hover:text-[#202223] bg-[#f6f6f7] border border-[#e1e3e5] px-3 py-1.5 rounded-full transition cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                View Site
              </button>
            )}
            {/* Log out */}
            <button
              onClick={() => { sessionStorage.removeItem("admin_verified"); sessionStorage.removeItem("admin_name"); setIsAdmin(false); setAdminName(""); setAdminNameInput(""); setAdminEmailInput(""); setAdminPasswordInput(""); setPasswordError(""); setNameStep(true); }}
              className="flex items-center gap-1.5 text-xs font-medium text-[#6d7175] hover:text-[#d82c0d] bg-[#f6f6f7] border border-[#e1e3e5] px-3 py-1.5 rounded-full transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 lg:pb-6">



          {/* ===== DASHBOARD ===== */}
          {activeTab === "dashboard" && (
            <div className="space-y-5">
              <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                <div>
                  <h1 className="text-xl font-black text-[#202223] tracking-tight">Welcome back, <span className="text-[#000000]">{adminName || "Admin"}</span></h1>
                  <p className="text-xs text-[#6d7175] mt-0.5 font-medium">
                    {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto scrollbar-none">
                  {(["day","week","month","six_months","year"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setStatsPeriod(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 ${
                        statsPeriod === p ? "bg-[#000000] text-white" : "bg-white text-[#6d7175] border border-[#e1e3e5] hover:bg-[#f6f6f7]"
                      }`}
                    >
                      {p === "six_months" ? "6M" : p === "year" ? "1Y" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── QUICK ACTIONS ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Add Product", icon: <Plus className="w-4 h-4" />, color: "text-[#000000] bg-[#f0f7ff] border-[#d4e0fc]", action: () => { resetProdForm(); setProductModalOpen(true); } },
                  { label: "View Orders", icon: <ShoppingCart className="w-4 h-4" />, color: "text-amber-700 bg-amber-50 border-amber-200", action: () => setActiveTab("orders") },
                  { label: "Manage Stock", icon: <Package2 className="w-4 h-4" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200", action: () => setActiveTab("products") },
                  { label: "Settings", icon: <Settings2 className="w-4 h-4" />, color: "text-[#6d7175] bg-[#f6f6f7] border-[#e1e3e5]", action: () => setActiveTab("settings") },
                ].map((qa, i) => (
                  <button key={i} onClick={qa.action}
                    className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border font-semibold text-sm transition cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${qa.color}`}>
                    {qa.icon}
                    <span className="text-xs">{qa.label}</span>
                  </button>
                ))}
              </div>

              {/* Enhanced KPI Cards with Sparklines */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(() => {
                  // Build daily data for sparklines (last 7 days)
                  const days = 7;
                  const dayMs = 86400000;
                  const now = Date.now();
                  const dailySales = Array.from({ length: days }, (_, i) => {
                    const start = now - (days - 1 - i) * dayMs;
                    const end = start + dayMs;
                    return orders
                      .filter(o => { const t = new Date(o.createdAt).getTime(); return t >= start && t < end && ["delivered","processing","shipped","pending","waiting_for_manufacturing","waiting_for_customer_confirmation","ready_to_ship","waiting_for_pickup","out_for_delivery"].includes(o.status); })
                      .reduce((s, o) => s + o.total, 0);
                  });
                  const dailyOrders = Array.from({ length: days }, (_, i) => {
                    const start = now - (days - 1 - i) * dayMs;
                    const end = start + dayMs;
                    return orders.filter(o => { const t = new Date(o.createdAt).getTime(); return t >= start && t < end; }).length;
                  });
                  const dailyVisitorsArr = Array.from({ length: days }, (_, i) => {
                    // Approximate: use weeklyVisitors spread evenly, or 0
                    return i === days - 1 ? (dailyVisitors ?? 0) : i === days - 2 ? (yesterdayVisitors ?? 0) : 0;
                  });
                  // Conversion: orders/visitors per day
                  const dailyConv = dailyOrders.map((ord, i) => {
                    const vis = dailyVisitorsArr[i] || 0;
                    return vis > 0 ? Math.round((ord / vis) * 100) : 0;
                  });

                  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
                    const max = Math.max(...data, 1);
                    const w = 80; const h = 32;
                    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
                    return (
                      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
                        <polyline
                          points={pts}
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                        />
                        {/* Gradient fill */}
                        <defs>
                          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon
                          points={`0,${h} ${pts} ${w},${h}`}
                          fill={`url(#grad-${color.replace('#','')})`}
                        />
                        {/* Last point dot */}
                        {data.length > 0 && (() => {
                          const last = data[data.length - 1];
                          const x = w;
                          const y = h - (last / max) * h;
                          return <circle cx={x} cy={y} r="3" fill={color} />;
                        })()}
                      </svg>
                    );
                  };

                  const trend = (arr: number[]) => {
                    const last = arr[arr.length - 1] ?? 0;
                    const prev = arr[arr.length - 2] ?? 0;
                    if (prev === 0) return null;
                    const pct = Math.round(((last - prev) / prev) * 100);
                    return pct;
                  };

                  const TrendBadge = ({ pct }: { pct: number | null }) => {
                    if (pct === null) return null;
                    const up = pct >= 0;
                    return (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                        {up ? "↑" : "↓"} {Math.abs(pct)}%
                      </span>
                    );
                  };

                  // Conversion rate (total orders / total visitors)
                  const totalVisitorsForPeriod = (dailyVisitors ?? 0) + (yesterdayVisitors ?? 0);
                  const convRate = totalVisitorsForPeriod > 0
                    ? ((filteredOrders.length / totalVisitorsForPeriod) * 100).toFixed(1)
                    : "—";

                  const cards = [
                    {
                      label: "Total Sales",
                      value: `₹${periodSales.toLocaleString()}`,
                      sub: `${filteredOrders.length} orders`,
                      color: "#000000",
                      bg: "from-[#000000]/5 to-white",
                      border: "border-[#000000]/20",
                      sparkData: dailySales,
                      trendPct: trend(dailySales),
                    },
                    {
                      label: "Orders",
                      value: filteredOrders.length.toString(),
                      sub: `${statusCounts.pending} pending`,
                      color: "#8c50ff",
                      bg: "from-[#8c50ff]/5 to-white",
                      border: "border-[#8c50ff]/20",
                      sparkData: dailyOrders,
                      trendPct: trend(dailyOrders),
                    },
                    {
                      label: "Visitors",
                      value: dailyVisitors !== null ? dailyVisitors.toLocaleString() : "—",
                      sub: yesterdayVisitors !== null ? `${yesterdayVisitors} yesterday` : "Today",
                      color: "#f59e0b",
                      bg: "from-[#f59e0b]/5 to-white",
                      border: "border-[#f59e0b]/20",
                      sparkData: dailyVisitorsArr,
                      trendPct: trend(dailyVisitorsArr),
                    },
                    {
                      label: "Conversion",
                      value: convRate === "—" ? "—" : `${convRate}%`,
                      sub: "Orders / Visitors",
                      color: "#10b981",
                      bg: "from-[#10b981]/5 to-white",
                      border: "border-[#10b981]/20",
                      sparkData: dailyConv,
                      trendPct: trend(dailyConv),
                    },
                  ];

                  return cards.map((card, i) => (
                    <div key={i} className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-4 flex flex-col justify-between min-h-[120px] hover:shadow-md transition-shadow`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#6d7175] uppercase tracking-wider truncate">{card.label}</p>
                          <p className="text-2xl font-black text-[#202223] mt-1 leading-none">{card.value}</p>
                          <p className="text-[10px] text-[#9ca3af] mt-0.5">{card.sub}</p>
                        </div>
                        <TrendBadge pct={card.trendPct} />
                      </div>
                      <div className="mt-3">
                        <Sparkline data={card.sparkData} color={card.color} />
                        <p className="text-[9px] text-[#c9cccf] mt-1">Last 7 days</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Order Fulfillment */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[#f0f7ff] flex items-center justify-center shrink-0"><Activity className="w-3.5 h-3.5 text-[#000000]" /></div>
                  <h3 className="font-bold text-[#202223] text-sm">Order Fulfillment</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[string]][]).map(([key, cfg]) => {
                    const cnt = (statusCounts as any)[key] ?? 0;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className={`font-bold text-xs ${cfg.badge.split(" ")[1]}`}>{cfg.label}</span>
                          <span className="font-bold text-[#202223]">{cnt}</span>
                        </div>
                        <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                          <div className={`h-full ${cfg.dot} rounded-full`} style={{ width: `${filteredOrders.length > 0 ? Math.round((cnt / filteredOrders.length) * 100) : 0}%` }} />
                        </div>
                        <p className="text-xs text-[#6d7175]">{filteredOrders.length > 0 ? Math.round((cnt / filteredOrders.length) * 100) : 0}% of orders</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1e3e5]">
                  <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><ShoppingCart className="w-3.5 h-3.5 text-amber-600" /></div><h3 className="font-bold text-[#202223] text-sm">Recent Orders</h3></div>
                  <button onClick={() => setActiveTab("orders")} className="text-sm text-[#2c6ecb] hover:underline cursor-pointer">View all</button>
                </div>
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" />
                    <p className="text-sm text-[#6d7175]">No orders in this period</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f6f6f7]">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Order</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Customer</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Total</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Status</th>
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f1f1]">
                      {filteredOrders.slice(0, 5).map(ord => (
                        <tr key={ord.id} className="hover:bg-[#f6f8ff] transition-colors">
                          <td className="px-5 py-3 font-sans text-xs text-[#2c6ecb] font-bold">{ord.id.startsWith("FC") ? ord.id : "#" + ord.id.slice(-6)}</td>
                          <td className="px-5 py-3 text-[#202223] font-medium">{ord.customerName}</td>
                          <td className="px-5 py-3 text-[#202223] font-semibold">₹{ord.total}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusCfg(ord.status).border}`}>
                              {getStatusCfg(ord.status).label}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={ord.status}
                              onChange={e => handleStatusChange(ord, e.target.value as any)}
                              className="bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg px-2 py-1 text-xs font-medium text-[#202223] outline-none cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="waiting_for_manufacturing">Waiting for Manufacturing</option>
                              <option value="waiting_for_customer_confirmation">Waiting for Customer Confirmation</option>
                              <option value="processing">Processing</option>
                              <option value="ready_to_ship">Ready to Ship</option>
                              <option value="waiting_for_pickup">Waiting for Pickup</option>
                              <option value="shipped">Shipped</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="returned">Returned</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ── Live Activity — Enhanced ── */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#f1f1f1] bg-[#fafafa]">
                  <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><Radio className="w-3.5 h-3.5 text-green-600" /></div>
                  <h3 className="font-bold text-[#202223] text-sm">Live Store Activity</h3>
                  <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                    </span>
                    Live
                  </span>
                </div>

                {/* ── TOP STATS BAR ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#f1f1f1] border-b border-[#e1e3e5]">
                  {[
                    { label: "Live Now", value: liveVisitors.length, accent: "text-green-600", bg: "bg-green-50", dot: true },
                    { label: "Today", value: dailyVisitors ?? "—", accent: "text-blue-600", bg: "bg-blue-50", dot: false },
                    { label: "Yesterday", value: yesterdayVisitors ?? "—", accent: "text-indigo-600", bg: "bg-indigo-50", dot: false },
                    { label: "This Week", value: weeklyVisitors ?? "—", accent: "text-violet-600", bg: "bg-violet-50", dot: false },
                  ].map((s, i) => (
                    <div key={i} className={`px-4 py-3 flex flex-col gap-0.5 ${s.bg}`}>
                      <div className="flex items-center gap-1.5">
                        {s.dot && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#6d7175] uppercase tracking-wider">{s.label}</span>
                      </div>
                      <span className={`text-2xl font-black ${s.accent}`}>{s.value}</span>
                    </div>
                  ))}
                </div>

                {/* ── FUNNEL + CONTROLS ── */}
                {(() => {
                  const pc: Record<string,number> = {};
                  liveVisitors.forEach(v => { const k = v.page === "/" ? "home" : v.page; pc[k] = (pc[k]||0)+1; });
                  const total = liveVisitors.length || 1;
                  const funnelSteps = [
                    { label: "Home",       count: pc["home"]||0,              color: "bg-blue-100 text-blue-700",   bar: "bg-blue-400",   dot: "bg-blue-400" },
                    { label: "Collections", count: (pc["collections"]||0)+(pc["collection_detail"]||0), color: "bg-amber-100 text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" },
                    { label: "Product",    count: pc["product_detail"]||0,    color: "bg-purple-100 text-purple-700", bar: "bg-purple-400", dot: "bg-purple-400" },
                    { label: "Checkout",   count: pc["checkout"]||0,          color: "bg-green-100 text-green-700",  bar: "bg-green-500",  dot: "bg-green-400" },
                  ];
                  return (
                    <div className="px-5 py-3 border-b border-[#f1f1f1]">
                      {/* Funnel pills */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {funnelSteps.map((s, i) => (
                          <React.Fragment key={s.label}>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${s.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                              {s.label}
                              <span className="font-black text-base leading-none ml-0.5">{s.count}</span>
                              <span className="text-[9px] opacity-70">({Math.round((s.count/total)*100)}%)</span>
                            </div>
                            {i < funnelSteps.length - 1 && <span className="text-[#c9cccf] text-xs font-bold">→</span>}
                          </React.Fragment>
                        ))}
                        <div className="ml-auto flex items-center gap-1">
                          {(["visitors","abandoned"] as const).map(t => (
                            <button key={t} onClick={() => setLiveTab(t)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${liveTab === t ? "bg-[#000000] text-white" : "bg-[#f6f6f7] text-[#6d7175] hover:bg-[#e1e3e5]"}`}>
                              {t === "visitors" ? `Visitors (${liveVisitors.length})` : `Abandoned (${abandonedCarts.length})`}
                            </button>
                          ))}
                          <button onClick={fetchLiveData} className={`ml-1 p-1.5 rounded-lg bg-[#f6f6f7] hover:bg-[#e1e3e5] text-[#6d7175] transition-all cursor-pointer ${liveLoading ? "animate-spin" : ""}`}>
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Mini funnel bar */}
                      {liveVisitors.length > 0 && (
                        <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                          {funnelSteps.map(s => (
                            <div key={s.label} className={`${s.bar} transition-all duration-500`} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Error */}
                {liveError && (
                  <div className="mx-4 my-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Could not load live data</p>
                    <p className="text-xs text-red-600 font-mono break-all">{liveError}</p>
                  </div>
                )}

                {/* ── VISITORS TAB ── */}
                {liveTab === "visitors" && !liveError && (() => {
                  const checkoutVisitors = liveVisitors.filter(v => v.page === "checkout");
                  const parseFields = (raw?: string | null): string[] => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };
                  const fieldLabel: Record<string, string> = { phone: "Phone", name: "Name", email: "Email", address: "Address", pincode: "PIN", city: "City" };
                  const pageLabel: Record<string,string> = { home:"Homepage", product_detail:"Product Page", collections:"Collections", collection_detail:"Collection Detail", checkout:"Checkout", "/":"Homepage" };
                  const pageBg: Record<string,string> = {
                    home:"bg-blue-100 text-blue-700 border-blue-200",
                    product_detail:"bg-purple-100 text-purple-700 border-purple-200",
                    collections:"bg-amber-100 text-amber-700 border-amber-200",
                    collection_detail:"bg-amber-100 text-amber-700 border-amber-200",
                    checkout:"bg-green-100 text-green-700 border-green-200"
                  };
                  const pageIcon: Record<string, string> = {
                    home: "H", product_detail: "P", collections: "C", collection_detail: "C", checkout: "Pay"
                  };

                  return liveVisitors.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 bg-[#f6f6f7] rounded-full flex items-center justify-center mx-auto mb-3">
                        <Globe className="w-6 h-6 text-[#c9cccf]" />
                      </div>
                      <p className="text-sm font-semibold text-[#6d7175]">{liveLoading ? "Loading..." : "No active visitors right now"}</p>
                      <p className="text-xs text-[#9ca3af] mt-1">Auto-refreshes every second</p>
                    </div>
                  ) : (
                    <div>
                      {/* Checkout alert banner */}
                      {checkoutVisitors.length > 0 && (
                        <div className="mx-4 mt-3 bg-green-50 border border-green-300 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                          </span>
                          <span className="text-sm font-black text-green-800">
                            {checkoutVisitors.length} customer{checkoutVisitors.length !== 1 ? "s" : ""} actively in checkout
                          </span>
                          <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">HIGH INTENT</span>
                        </div>
                      )}

                      {/* Visitor rows */}
                      <div className="divide-y divide-[#f1f1f1] mt-2">
                        {liveVisitors.map((v, idx) => {
                          const secsAgo = Math.floor((Date.now() - new Date(v.last_seen).getTime()) / 1000);
                          const isCheckout = v.page === "checkout";
                          const fields = isCheckout ? parseFields(v.checkout_fields) : [];
                          const pctFilled = Math.min(100, (fields.length / 6) * 100);
                          const hasPayment = fields.some((f: string) => f.startsWith("payment:"));
                          const locationStr = [v.city, v.country].filter(x => x && x !== "unknown").join(", ");

                          return (
                            <div key={v.id} className={`px-5 py-4 transition-colors ${isCheckout ? "bg-green-50/40 hover:bg-green-50/70" : "hover:bg-[#fafafa]"}`}>
                              {/* Row 1: Avatar + page + location + time + cart */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {/* Visitor number avatar */}
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black ${isCheckout ? "bg-green-200 text-green-800" : "bg-[#e8f0ff] text-[#2c6ecb]"}`}>
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    {/* Page + status badges */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${pageBg[v.page] || "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                                        {pageLabel[v.page] || v.page}
                                      </span>
                                      {isCheckout && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500 text-white animate-pulse">
                                          LIVE CHECKOUT
                                        </span>
                                      )}
                                      {hasPayment && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                          PAYMENT SELECTED
                                        </span>
                                      )}
                                    </div>

                                    {/* Location + IP */}
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                      {locationStr && (
                                        <span className="flex items-center gap-1 text-xs text-[#6d7175]">
                                          <MapPin className="w-3 h-3 shrink-0 text-[#9ca3af]" />
                                          {locationStr}
                                        </span>
                                      )}
                                      {v.ip_address && v.ip_address !== "unknown" && (
                                        <span className="font-mono text-[10px] bg-[#f1f1f1] text-[#6d7175] px-1.5 py-0.5 rounded border border-[#e1e3e5]">
                                          {v.ip_address}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-[#b0b3b8]">{secsAgo}s ago</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Cart + pulse */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {v.cart_count > 0 && (
                                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 text-xs px-2 py-1 rounded-lg font-bold">
                                      <ShoppingCart className="w-3 h-3" />
                                      {v.cart_count} in cart
                                    </span>
                                  )}
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                </div>
                              </div>

                              {/* Checkout progress (only for checkout visitors) */}
                              {isCheckout && (
                                <div className="mt-3 ml-11 bg-white border border-green-200 rounded-xl p-3 space-y-2.5">
                                  {/* Field completion badges */}
                                  <div>
                                    <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-wider mb-1.5">Checkout Fields Filled</p>
                                    {fields.length === 0 ? (
                                      <p className="text-[11px] text-[#9ca3af] italic">Just opened — no fields filled yet</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {["name","phone","email","address","city","pincode"].map((f) => {
                                          const paymentF = fields.find((x: string) => x.startsWith("payment:"));
                                          const isFilled = fields.includes(f) || (f === "pincode" && fields.includes("pincode"));
                                          return (
                                            <span key={f} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isFilled ? "bg-green-100 text-green-700 border-green-300" : "bg-[#f6f6f7] text-[#c9cccf] border-[#e1e3e5]"}`}>
                                              {fieldLabel[f] || f} {isFilled ? "[Done]" : ""}
                                            </span>
                                          );
                                        })}
                                        {fields.filter((f: string) => f.startsWith("payment:")).map((f: string) => (
                                          <span key={f} className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                                            {f.split(":")[1]?.toUpperCase()} [Done]
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Progress bar */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-[#6d7175]">Checkout completion</span>
                                      <span className="text-[10px] font-black text-[#202223]">{Math.round(pctFilled)}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[#e1e3e5] overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-700 ${hasPayment ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-green-400 to-green-500"}`}
                                        style={{ width: `${pctFilled}%` }}
                                      />
                                    </div>
                                    {hasPayment && (
                                      <p className="text-[10px] font-black text-emerald-700 mt-1">Payment method selected — likely to place order!</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer summary */}
                      <div className="px-5 py-3 border-t border-[#f1f1f1] bg-[#f9fafb] flex items-center justify-between">
                        <p className="text-[10px] text-[#9ca3af]">
                          Showing {liveVisitors.length} active visitor{liveVisitors.length !== 1 ? "s" : ""} — live heartbeat 1s
                        </p>
                        <p className="text-[10px] text-[#9ca3af]">
                          {checkoutVisitors.length} in checkout · {liveVisitors.filter(v => v.cart_count > 0).length} with items in cart
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* ── ABANDONED CARTS TAB ── */}
                {liveTab === "abandoned" && !liveError && (
                  abandonedCarts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 bg-[#f6f6f7] rounded-full flex items-center justify-center mx-auto mb-3">
                        <ShoppingCart className="w-6 h-6 text-[#c9cccf]" />
                      </div>
                      <p className="text-sm font-semibold text-[#6d7175]">No abandoned carts</p>
                      <p className="text-xs text-[#9ca3af] mt-1">Saved when customers fill address but don't complete payment</p>
                    </div>
                  ) : (
                    <div>
                      {/* Summary bar */}
                      <div className="px-5 py-2.5 border-b border-[#f1f1f1] bg-amber-50 flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-black text-amber-800">{abandonedCarts.length} abandoned cart{abandonedCarts.length !== 1 ? "s" : ""}</span>
                        <span className="text-xs text-amber-700">
                          Total value: <strong>₹{abandonedCarts.reduce((s, ac) => s + ac.total, 0).toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="divide-y divide-[#f1f1f1]">
                        {abandonedCarts.map(ac => {
                          const secsAgo = Math.floor((Date.now() - new Date(ac.updated_at).getTime()) / 1000);
                          const timeStr = secsAgo < 60 ? `${secsAgo}s ago` : secsAgo < 3600 ? `${Math.floor(secsAgo/60)}m ago` : secsAgo < 86400 ? `${Math.floor(secsAgo/3600)}h ago` : `${Math.floor(secsAgo/86400)}d ago`;
                          const urgency = secsAgo < 600 ? "border-l-4 border-l-red-400" : secsAgo < 3600 ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-[#e1e3e5]";
                          return (
                            <div key={ac.id} className={`px-5 py-4 hover:bg-[#fafafa] space-y-2.5 ${urgency}`}>
                              {/* Row 1: Name + urgency badge + time + total */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <p className="text-sm font-black text-[#202223]">{ac.customer_name || "Anonymous"}</p>
                                  {secsAgo < 600 && <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full">RECENT</span>}
                                  <span className="text-xs text-[#9ca3af]">{timeStr}</span>
                                </div>
                                <span className="text-base font-black text-[#202223] shrink-0">₹{ac.total.toLocaleString()}</span>
                              </div>
                              {/* Row 2: Phone + Email */}
                              <div className="flex flex-wrap gap-2">
                                {ac.customer_phone && (
                                  <a href={`tel:${ac.customer_phone}`} className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#000000] hover:bg-[#0052cc] px-3 py-1.5 rounded-lg transition">
                                    <Phone className="w-3 h-3" /> {ac.customer_phone}
                                  </a>
                                )}
                                {(ac as any).customer_email && (
                                  <a href={`mailto:${(ac as any).customer_email}`} className="flex items-center gap-1.5 text-xs font-semibold text-[#6d7175] border border-[#e1e3e5] bg-white hover:bg-[#f6f6f7] px-3 py-1.5 rounded-lg transition truncate max-w-[220px]">
                                    <Mail className="w-3 h-3 shrink-0" />{(ac as any).customer_email}
                                  </a>
                                )}
                              </div>
                              {/* Row 3: Address */}
                              {(ac.city || (ac as any).state || (ac as any).pincode) && (
                                <div className="flex items-center gap-1.5 bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg px-3 py-1.5 text-xs text-[#6d7175]">
                                  <MapPin className="w-3 h-3 shrink-0 text-[#9ca3af]" />
                                  <span>{[ac.city, (ac as any).state].filter(Boolean).join(", ")}</span>
                                  {(ac as any).pincode && <span className="font-mono font-black text-[#202223] ml-1">PIN {(ac as any).pincode}</span>}
                                </div>
                              )}
                              {/* Row 4: Items */}
                              {ac.items && ac.items.length > 0 && (
                                <div className="space-y-1">
                                  {ac.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 bg-white border border-[#e1e3e5] rounded-lg px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[#202223] truncate">{item.name || item.id}</p>
                                        {((item as any).brand || (item as any).model) && (
                                          <p className="text-[10px] text-[#9ca3af]">{[(item as any).brand, (item as any).model].filter(Boolean).join(" · ")}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="bg-[#f6f6f7] border border-[#e1e3e5] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#6d7175]">×{item.qty}</span>
                                        <span className="text-sm font-black text-[#202223]">₹{item.price * item.qty}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>



              {/* ── DEEP ANALYTICS ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#000000]" />
                  <h2 className="text-base font-bold text-[#202223]">Deep Analytics</h2>
                  <span className="text-xs text-[#6d7175] bg-[#f6f6f7] border border-[#e1e3e5] px-2 py-0.5 rounded-full">
                    {statsPeriod === "day" ? "Today" : statsPeriod === "week" ? "This Week" : statsPeriod === "month" ? "This Month" : statsPeriod === "six_months" ? "Last 6 Months" : "This Year"}
                  </span>
                </div>

                {/* Revenue by Collection */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5">
                  <h3 className="font-semibold text-[#202223] mb-4 text-sm">Revenue by Collection</h3>
                  {(() => {
                    const byCol: Record<string, { revenue: number; count: number }> = {};
                    filteredOrders.forEach(ord => {
                      ord.items.forEach(it => {
                        const col = it.product.collectionId || "Unknown";
                        if (!byCol[col]) byCol[col] = { revenue: 0, count: 0 };
                        byCol[col].revenue += it.product.price * it.quantity;
                        byCol[col].count += it.quantity;
                      });
                    });
                    const sorted = Object.entries(byCol).sort((a, b) => b[1].revenue - a[1].revenue);
                    const maxRev = sorted[0]?.[1].revenue || 1;
                    if (sorted.length === 0) return (
                      <p className="text-sm text-[#6d7175] text-center py-8">No sales data yet for this period</p>
                    );
                    return (
                      <div className="space-y-3">
                        {sorted.map(([col, data]) => (
                          <div key={col} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-[#202223] capitalize">{col.replace(/-/g, " ")}</span>
                              <span className="font-bold text-[#202223]">₹{data.revenue.toLocaleString()} <span className="text-[#6d7175] font-normal">({data.count} units)</span></span>
                            </div>
                            <div className="h-2.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#000000] to-[#2c6ecb] rounded-full transition-all duration-700"
                                style={{ width: `${(data.revenue / maxRev) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Top Products by Revenue */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1e3e5]">
                    <h3 className="font-semibold text-[#202223] text-sm">Top Products by Revenue</h3>
                    <TrendingUp className="w-4 h-4 text-[#000000]" />
                  </div>
                  {(() => {
                    const prodMap: Record<string, { title: string; revenue: number; units: number; image?: string }> = {};
                    filteredOrders.forEach(ord => {
                      ord.items.forEach(it => {
                        const id = it.product.id;
                        if (!prodMap[id]) prodMap[id] = { title: it.product.title, revenue: 0, units: 0, image: it.product.images?.[0] };
                        prodMap[id].revenue += it.product.price * it.quantity;
                        prodMap[id].units += it.quantity;
                      });
                    });
                    const sorted = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                    if (sorted.length === 0) return (
                      <div className="text-center py-10 text-sm text-[#6d7175]">No product sales yet</div>
                    );
                    return (
                      <div className="divide-y divide-[#f1f1f1]">
                        {sorted.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 px-5 py-3">
                            <span className="text-lg font-black text-[#c9cccf] w-5 shrink-0">#{i + 1}</span>
                            <div className="w-9 h-11 bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg overflow-hidden shrink-0">
                              {p.image ? <img src={p.image} alt="" className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" /> : <Smartphone className="w-4 h-4 text-[#c9cccf] m-auto mt-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#202223] truncate">{p.title}</p>
                              <p className="text-[10px] text-[#6d7175]">{p.units} units sold</p>
                            </div>
                            <span className="text-sm font-bold text-[#202223] shrink-0">₹{p.revenue.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Order Payment Methods + Conversion Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payment Methods */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5">
                    <h3 className="font-semibold text-[#202223] mb-4 text-sm">Payment Methods</h3>
                    {(() => {
                      const methods: Record<string, number> = { cod: 0, card: 0, upi: 0, razorpay: 0 };
                      filteredOrders.forEach(o => { if (methods[o.paymentMethod] !== undefined) methods[o.paymentMethod]++; });
                      const total = filteredOrders.length || 1;
                      const labels: Record<string, string> = { cod: "Cash on Delivery", card: "Card / Online", upi: "UPI", razorpay: "Razorpay (Online)" };
                      const colors: Record<string, string> = { cod: "bg-[#ffc453]", card: "bg-[#000000]", upi: "bg-[#8c50ff]", razorpay: "bg-[#004aad]" };
                      return (
                        <div className="space-y-3">
                          {Object.entries(methods).map(([method, count]) => (
                            <div key={method} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-[#202223]">{labels[method]}</span>
                                <span className="font-bold text-[#202223]">{count} <span className="text-[#6d7175] font-normal">({Math.round((count / total) * 100)}%)</span></span>
                              </div>
                              <div className="h-1.5 bg-[#f6f6f7] rounded-full overflow-hidden">
                                <div className={`h-full ${colors[method]} rounded-full`} style={{ width: `${(count / total) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Store Stats */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5">
                    <h3 className="font-semibold text-[#202223] mb-4 text-sm">Store Health</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Total Products", value: products.length, max: Math.max(products.length, 50), icon: <Package2 className="w-4 h-4" />, color: "bg-[#000000]", tab: "products" as const },
                        { label: "Collections", value: collections.length, max: Math.max(collections.length, 20), icon: <FolderOpen className="w-4 h-4" />, color: "bg-[#2c6ecb]", tab: "collections" as const },
                        { label: "Active Reviews", value: reviews.length, max: Math.max(reviews.length, 20), icon: <Star className="w-4 h-4" />, color: "bg-amber-400", tab: "reviews" as const },
                        { label: "Active FAQs", value: faqs.length, max: Math.max(faqs.length, 20), icon: <HelpCircle className="w-4 h-4" />, color: "bg-[#8c50ff]", tab: "faqs" as const },
                        { label: "In Stock", value: products.filter(p => p.stockStatus === "in_stock").length, max: Math.max(products.length, 1), icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-emerald-500", tab: "products" as const },
                        { label: "Low / Out of Stock", value: products.filter(p => p.stockStatus !== "in_stock").length, max: Math.max(products.length, 1), icon: <AlertCircle className="w-4 h-4" />, color: "bg-[#d82c0d]", tab: "products" as const },
                      ].map((s, i) => (
                        <button key={i} onClick={() => setActiveTab(s.tab)}
                          className="w-full flex items-center gap-3 group hover:bg-[#f9f9f9] rounded-lg px-1 py-0.5 -mx-1 transition cursor-pointer">
                          <span className={i >= 4 ? (i === 5 ? "text-[#d82c0d]" : "text-emerald-600") : i === 3 ? "text-[#8c50ff]" : i === 2 ? "text-amber-500" : "text-[#000000]"}>{s.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#6d7175]">{s.label}</span>
                              <span className="font-bold text-[#202223]">{s.value}</span>
                            </div>
                            <div className="h-1 bg-[#f1f1f1] rounded-full overflow-hidden">
                              <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Low Stock Alert */}
                {products.filter(p => p.stockStatus !== "in_stock").length > 0 && (
                  <div className="bg-[#fffbe6] border border-[#ffd79d] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-[#b98900]" />
                      <h3 className="font-semibold text-[#b98900] text-sm">Stock Alerts</h3>
                    </div>
                    <div className="space-y-2">
                      {products.filter(p => p.stockStatus !== "in_stock").slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-[#202223] truncate flex-1 mr-3">{p.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.stockStatus === "low_stock" ? "bg-[#ffd79d] text-[#b98900]" : "bg-[#fed3d1] text-[#d82c0d]"}`}>
                            {p.stockStatus.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setActiveTab("products")} className="text-xs text-[#b98900] font-semibold hover:underline mt-2 cursor-pointer">
                      Manage stock →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== PRODUCTS ===== */}
          {activeTab === "products" && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[#202223]">Products</h1>
                  <p className="text-xs text-[#6d7175] mt-0.5">{products.length} items</p>
                </div>
                <div className="flex items-center gap-2">
                  {bulkSelected.length > 0 && (
                    <button
                      onClick={() => setBulkModalOpen(true)}
                      className="flex items-center gap-1.5 bg-[#f4f8ff] border border-[#2c6ecb] text-[#2c6ecb] text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" /> Bulk Edit ({bulkSelected.length})
                    </button>
                  )}
                  <button
                    onClick={() => { resetProdForm(); setProductModalOpen(true); }}
                    className="flex items-center gap-2 bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Product
                  </button>
                </div>
              </div>

              {/* Search + Filter bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={prodListSearch}
                  onChange={e => setProdListSearch(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 border border-[#c9cccf] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                />
                <select
                  value={prodListColFilter}
                  onChange={e => { setProdListColFilter(e.target.value); setBulkSelected([]); }}
                  className="border border-[#c9cccf] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#458fff] bg-white"
                >
                  <option value="all">All Collections</option>
                  {collections.map(c => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Bulk Collection Edit Modal */}
              {bulkModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
                    <h3 className="font-bold text-[#202223]">Bulk Edit Collections</h3>
                    <p className="text-xs text-[#6d7175]">{bulkSelected.length} products selected. Choose collections to assign:</p>
                    <div className="border border-[#c9cccf] rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-[#f1f2f3]">
                      {collections.map(c => {
                        const checked = bulkCollectionIds.includes(c.slug);
                        return (
                          <label key={c.slug} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#f4f8ff]">
                            <input type="checkbox" checked={checked} onChange={() =>
                              setBulkCollectionIds(prev => checked ? prev.filter(s => s !== c.slug) : [...prev, c.slug])
                            } className="w-3.5 h-3.5 accent-[#458fff]" />
                            <span className="text-xs text-[#202223]">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setBulkModalOpen(false); setBulkCollectionIds([]); }} className="flex-1 border border-[#c9cccf] text-[#202223] text-sm font-semibold py-2 rounded-xl cursor-pointer hover:bg-[#f6f6f7]">Cancel</button>
                      <button
                        onClick={async () => {
                          if (bulkCollectionIds.length === 0) { showToast("Select at least one collection", "error"); return; }
                          try {
                            await Promise.all(bulkSelected.map(id =>
                              updateProduct(id, { collectionId: bulkCollectionIds[0], collectionIds: bulkCollectionIds } as any)
                            ));
                            showToast(`Updated ${bulkSelected.length} products!`, "success");
                            setBulkSelected([]); setBulkCollectionIds([]); setBulkModalOpen(false);
                            loadAllAdminData();
                          } catch { showToast("Bulk update failed", "error"); }
                        }}
                        className="flex-1 bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold py-2 rounded-xl cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* List */}
              <div className="space-y-4">
              <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                  {(() => {
                    const filtered = products.filter(p => {
                      const matchSearch = prodListSearch === "" || p.title.toLowerCase().includes(prodListSearch.toLowerCase());
                      const pIds = p.collectionIds?.length ? p.collectionIds : [p.collectionId];
                      const matchCol = prodListColFilter === "all" || pIds.includes(prodListColFilter);
                      return matchSearch && matchCol;
                    });
                    if (filtered.length === 0) return (
                      <div className="text-center py-12">
                        <Package2 className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" />
                        <p className="text-sm text-[#6d7175]">{products.length === 0 ? "No products yet" : "No products match filter"}</p>
                      </div>
                    );
                    return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#f6f6f7] border-b border-[#e1e3e5]">
                          <th className="px-4 py-2.5">
                            <input type="checkbox"
                              checked={bulkSelected.length === filtered.length && filtered.length > 0}
                              onChange={e => setBulkSelected(e.target.checked ? filtered.map(p => p.id) : [])}
                              className="w-3.5 h-3.5 accent-[#458fff]"
                            />
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Product</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Price</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Stock</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f1f1]">
                        {filtered.map(p => (
                          <tr key={p.id} className={`hover:bg-[#fafafa] ${bulkSelected.includes(p.id) ? "bg-[#f0f6ff]" : ""}`}>
                            <td className="px-4 py-3">
                              <input type="checkbox"
                                checked={bulkSelected.includes(p.id)}
                                onChange={e => setBulkSelected(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                                className="w-3.5 h-3.5 accent-[#458fff]"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-11 bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                  {p.images && p.images[0] ? (
                                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Smartphone className="w-4 h-4 text-[#8c9196]" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-[#202223] leading-tight text-xs">{p.title}</p>
                                  <p className="text-[10px] text-[#8c9196] mt-0.5 uppercase">
                                    {(p.collectionIds?.length ? p.collectionIds : [p.collectionId]).join(" · ")}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#202223]">₹{p.price}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                p.stockStatus === "in_stock" ? "bg-[#c4edd8] text-[#000000]" :
                                p.stockStatus === "low_stock" ? "bg-[#ffd79d] text-[#b98900]" :
                                "bg-[#fed3d1] text-[#d82c0d]"
                              }`}>
                                {p.stockStatus.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => handleEditProductClick(p)} className="p-1.5 text-[#6d7175] hover:text-[#2c6ecb] hover:bg-[#f4f8ff] rounded-lg transition cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    );
                  })()} 
                </div>
              </div>
            </div>
          )}

          {/* ===== COLLECTIONS ===== */}
          {activeTab === "collections" && (
            <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-[#202223]">Collections</h1>
                  <span className="text-sm text-[#6d7175]">{collections.length} collections</span>
                </div>
                <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden">
                  {collections.length === 0 ? (
                    <div className="text-center py-12"><FolderOpen className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" /><p className="text-sm text-[#6d7175]">No collections yet</p></div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="bg-[#f6f6f7] border-b border-[#e1e3e5]"><th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase">Collection</th><th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase">Products</th><th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase">Slug</th><th className="text-right px-4 py-2.5 text-xs font-semibold text-[#6d7175] uppercase">Actions</th></tr></thead>
                      <tbody className="divide-y divide-[#f1f1f1]">
                        {collections.map(c => (
                          <tr key={c.id} className="hover:bg-[#fafafa]">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                  {c.image && c.image !== "default" && (c.image.startsWith("data:") || c.image.startsWith("http")) ? (
                                    <img src={c.image} alt={c.name} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                                  ) : (
                                    <FolderOpen className="w-3.5 h-3.5 text-[#8c9196]" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-[#202223] text-xs">{c.name}</span>
                                  {c.isVisible === false && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide bg-[#ffd2cc] text-[#d82c0d] px-1.5 py-0.5 rounded-full">Hidden</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center bg-[#f0f6ff] text-[#2c6ecb] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {products.filter(p => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(c.slug)).length}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-sans text-xs text-[#6d7175]">{c.slug}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => { setEditingCollection(c); setCollName(c.name); setCollSlug(c.slug); setCollImage(c.image); setCollImageType(c.image.startsWith("data:") ? "upload" : "preset"); setCollDesc(c.description); setCollIsVisible(c.isVisible !== false); }} className="p-1.5 text-[#6d7175] hover:text-[#2c6ecb] hover:bg-[#f4f8ff] rounded-lg transition cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteCollection(c.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e1e3e5]">
                    <h3 className="font-semibold text-[#202223]">{editingCollection ? "Edit collection" : "Add collection"}</h3>
                    {editingCollection && <button onClick={() => { setEditingCollection(null); setCollName(""); setCollSlug(""); setCollImage("default"); setCollDesc(""); }} className="text-xs text-[#6d7175] hover:text-[#202223] cursor-pointer">Cancel</button>}
                  </div>
                  <form onSubmit={handleSaveCollection} className="space-y-3 text-sm">
                    <div><label className="block text-xs font-medium text-[#202223] mb-1">Name</label><input type="text" required value={collName} onChange={e => { setCollName(e.target.value); if (!editingCollection) setCollSlug(e.target.value.toLowerCase().replace(/\s+/g,"-").replace(/[^\w\-]+/g,"")); }} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" /></div>
                    <div><label className="block text-xs font-medium text-[#202223] mb-1">Slug</label><input type="text" required disabled={!!editingCollection} value={collSlug} onChange={e => setCollSlug(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none font-sans disabled:opacity-50" /></div>
                    <div>
                      <label className="block text-xs font-medium text-[#202223] mb-1">Collection Image</label>
                      <div className="flex gap-1 mb-2">
                        {(["preset","upload"] as const).map(t => (
                          <button key={t} type="button" onClick={() => { setCollImageType(t); if (t === "preset") setCollImage("default"); }} className={`text-xs px-3 py-1 rounded-md font-medium cursor-pointer capitalize ${collImageType === t ? "bg-[#2c6ecb] text-white" : "bg-white text-[#6d7175] border border-[#e1e3e5]"}`}>{t === "preset" ? "Preset/Key" : "Upload Image"}</button>
                        ))}
                      </div>
                      {collImageType === "preset" && (
                        <input type="text" value={collImage} onChange={e => setCollImage(e.target.value)} placeholder="e.g. god-ganesh or https://..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      )}
                      {collImageType === "upload" && (
                        <div>
                          <label className="flex flex-col items-center gap-2 border-2 border-dashed border-[#c9cccf] hover:border-[#458fff] rounded-lg p-4 cursor-pointer transition">
                            {collImage.startsWith("data:") ? (
                              <img src={collImage} alt="Preview" className="w-24 h-24 object-contain rounded-lg" />
                            ) : (
                              <><Image className="w-6 h-6 text-[#8c9196]" /><span className="text-xs text-[#6d7175]">Click to upload image (max 10MB)</span></>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setCollImage); }} />
                          </label>
                        </div>
                      )}
                    </div>
                    <div><label className="block text-xs font-medium text-[#202223] mb-1">Description</label><textarea value={collDesc} onChange={e => setCollDesc(e.target.value)} rows={2} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"></textarea></div>

                    {/* Visibility Toggle */}
                    <div className="flex items-center justify-between bg-[#f6f6f7] rounded-xl px-3.5 py-2.5 border border-[#e1e3e5]">
                      <div>
                        <p className="text-xs font-semibold text-[#202223]">Website Visibility</p>
                        <p className="text-[10px] text-[#6d7175] mt-0.5">{collIsVisible ? "Visible to customers" : "Hidden from website"}</p>
                      </div>
                      <div className="flex rounded-lg border border-[#c9cccf] overflow-hidden text-xs font-semibold">
                        <button type="button" onClick={() => setCollIsVisible(true)} className={`px-3 py-1.5 transition cursor-pointer ${collIsVisible ? "bg-[#000000] text-white" : "bg-white text-[#6d7175] hover:bg-[#f4f8ff]"}`}>Visible</button>
                        <button type="button" onClick={() => setCollIsVisible(false)} className={`px-3 py-1.5 transition cursor-pointer ${!collIsVisible ? "bg-[#d82c0d] text-white" : "bg-white text-[#6d7175] hover:bg-[#fff4f4]"}`}>Hide</button>
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold py-2.5 rounded-lg transition cursor-pointer">{editingCollection ? "Save changes" : "Add collection"}</button>
                  </form>
                </div>

                {/* ── SUBCOLLECTIONS MANAGER ── */}
                {editingCollection && (
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 mt-4">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e1e3e5]">
                      <div>
                        <h3 className="font-semibold text-[#202223]">Subcollections</h3>
                        <p className="text-xs text-[#6d7175] mt-0.5">Inside <span className="font-bold text-[#202223]">{editingCollection.name}</span></p>
                      </div>
                      <button
                        onClick={() => { setEditingSubCollId(null); setSubCollName(""); setSubCollProductIds([]); setSubCollSearch(""); }}
                        className="flex items-center gap-1 text-xs font-bold text-[#000000] bg-[#f4f8ff] border border-[#d4e0fc] px-3 py-1.5 rounded-lg hover:bg-[#000000] hover:text-white transition cursor-pointer"
                      >
                        + New Subcollection
                      </button>
                    </div>

                    {/* Existing subcollections list */}
                    {(editingCollection.subcollections ?? []).length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-[10px] text-[#6d7175] font-bold uppercase tracking-wider">Drag to reorder subcollections</p>
                        {editingCollection.subcollections!.map((sub, idx) => {
                          const count = products.filter(p => sub.productIds.includes(p.id)).length;
                          return (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={() => setDragSubColIdx(idx)}
                              onDragOver={(e) => { e.preventDefault(); setDragSubColOver(idx); }}
                              onDrop={() => {
                                if (dragSubColIdx === null || dragSubColIdx === idx) { setDragSubColIdx(null); setDragSubColOver(null); return; }
                                const reordered = [...(editingCollection.subcollections ?? [])];
                                const [moved] = reordered.splice(dragSubColIdx, 1);
                                reordered.splice(idx, 0, moved);
                                setEditingCollection({ ...editingCollection, subcollections: reordered });
                                setDragSubColIdx(null);
                                setDragSubColOver(null);
                              }}
                              onDragEnd={() => { setDragSubColIdx(null); setDragSubColOver(null); }}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all ${
                                dragSubColOver === idx && dragSubColIdx !== idx ? "border-[#000000] bg-[#f0f7ff] shadow-md" : editingSubCollId === sub.id ? "border-[#000000] bg-[#f4f8ff]" : "border-[#e1e3e5] bg-[#fafafa]"
                              } ${dragSubColIdx === idx ? "opacity-40" : "opacity-100"}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[#6d7175] text-xs select-none">⠿⠿</span>
                                <span className="w-4 h-4 rounded-full bg-[#000000]/10 text-[#000000] text-[9px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                                <span className="text-sm font-bold text-[#202223]">{sub.name}</span>
                                <span className="text-[10px] font-black text-[#6d7175] bg-[#e1e3e5] px-1.5 py-0.5 rounded-full">{count} products</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditingSubCollId(sub.id); setSubCollName(sub.name); setSubCollProductIds(sub.productIds); setSubCollSearch(""); setSubCollImage(sub.image || ""); setSubCollImageType(sub.image?.startsWith("data:") ? "upload" : "url"); }}
                                  className="p-1.5 text-[#6d7175] hover:text-[#2c6ecb] hover:bg-[#f4f8ff] rounded-lg transition cursor-pointer"
                                ><Edit className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={() => handleDeleteSubCollection(sub.id)}
                                  className="p-1.5 text-[#6d7175] hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                ><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          onClick={async () => {
                            try {
                              await updateCollection(editingCollection.id, { subcollections: editingCollection.subcollections });
                              showToast("Subcollection order saved!", "success");
                              loadAllAdminData();
                            } catch { showToast("Could not save order.", "error"); }
                          }}
                          className="w-full mt-1 bg-[#f4f8ff] hover:bg-[#000000] hover:text-white text-[#000000] border border-[#d4e0fc] text-xs font-bold py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> Save Subcollection Order
                        </button>
                      </div>
                    )}

                    {/* Subcollection Add/Edit form */}
                    <div className="border border-[#e1e3e5] rounded-xl p-4 bg-[#fafafa] space-y-3">
                      <p className="text-xs font-black text-[#6d7175] uppercase tracking-wider">{editingSubCollId ? "Edit Subcollection" : "New Subcollection"}</p>
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Subcollection Name</label>
                        <input
                          type="text"
                          value={subCollName}
                          onChange={e => setSubCollName(e.target.value)}
                          placeholder="e.g. Murugan Cases, Shivan Cases..."
                          className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                        />
                      </div>

                      {/* Image */}
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Cover Image</label>
                        <div className="flex gap-1 mb-2">
                          {(["url", "upload"] as const).map(t => (
                            <button key={t} type="button"
                              onClick={() => { setSubCollImageType(t); if (t === "url") setSubCollImage(""); }}
                              className={`text-xs px-3 py-1 rounded-md font-medium cursor-pointer capitalize ${subCollImageType === t ? "bg-[#2c6ecb] text-white" : "bg-white text-[#6d7175] border border-[#e1e3e5]"}`}
                            >{t === "url" ? "Image URL" : "Upload Image"}</button>
                          ))}
                        </div>
                        {subCollImageType === "url" ? (
                          <input
                            type="text"
                            value={subCollImage}
                            onChange={e => setSubCollImage(e.target.value)}
                            placeholder="https://... or leave blank"
                            className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#458fff]"
                          />
                        ) : (
                          <label className="flex flex-col items-center gap-2 border-2 border-dashed border-[#c9cccf] hover:border-[#458fff] rounded-lg p-3 cursor-pointer transition">
                            {subCollImage.startsWith("data:") ? (
                              <img src={subCollImage} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                            ) : (
                              <><Image className="w-5 h-5 text-[#8c9196]" /><span className="text-xs text-[#6d7175]">Click to upload (max 10MB)</span></>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setSubCollImage); }} />
                          </label>
                        )}
                        {subCollImage && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <img src={subCollImage} alt="Preview" className="w-8 h-8 object-cover rounded border border-[#e1e3e5]" />
                            <span className="text-[10px] text-[#6d7175]">Preview</span>
                            <button onClick={() => setSubCollImage("")} className="text-[10px] text-red-500 hover:underline cursor-pointer ml-auto">Remove</button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">
                          Add Products <span className="text-[#6d7175] font-normal">({subCollProductIds.length} selected)</span>
                        </label>
                        {/* Search within collection products */}
                        <input
                          type="text"
                          value={subCollSearch}
                          onChange={e => setSubCollSearch(e.target.value)}
                          placeholder="Search products..."
                          className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#458fff] mb-2"
                        />
                        <div className="border border-[#e1e3e5] rounded-lg overflow-hidden max-h-52 overflow-y-auto bg-white">
                          {products
                            .filter(p => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(editingCollection.slug) && (subCollSearch === "" || p.title.toLowerCase().includes(subCollSearch.toLowerCase())))
                            .map(p => {
                              const checked = subCollProductIds.includes(p.id);
                              return (
                                <label key={p.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#f4f8ff] border-b border-[#f1f1f1] last:border-0 ${checked ? "bg-[#f0f7ff]" : ""}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setSubCollProductIds(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                    className="w-4 h-4 accent-[#000000] shrink-0"
                                  />
                                  {p.images?.[0] && (
                                    <img src={p.images[0]} alt={p.title} className="w-8 h-8 object-contain rounded border border-[#e1e3e5] shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-[#202223] truncate">{p.title}</p>
                                    <p className="text-[10px] text-[#6d7175]">₹{p.price}</p>
                                  </div>
                                </label>
                              );
                            })}
                          {products.filter(p => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(editingCollection.slug)).length === 0 && (
                            <p className="text-xs text-[#6d7175] text-center py-4">No products in this collection yet.</p>
                          )}
                        </div>
                        {subCollProductIds.length > 0 && (
                          <button onClick={() => setSubCollProductIds([])} className="text-[10px] text-red-500 hover:underline mt-1 cursor-pointer">Clear all selections</button>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveSubCollection}
                          disabled={!subCollName.trim()}
                          className="flex-1 bg-[#000000] hover:bg-[#0052cc] disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition cursor-pointer"
                        >
                          {editingSubCollId ? "Update Subcollection" : "Save Subcollection"}
                        </button>
                        {editingSubCollId && (
                          <button
                            onClick={() => { setEditingSubCollId(null); setSubCollName(""); setSubCollProductIds([]); setSubCollImage(""); setSubCollImageType("url"); }}
                            className="px-3 py-2 text-xs font-bold text-[#6d7175] border border-[#e1e3e5] rounded-lg hover:text-[#202223] cursor-pointer"
                          >Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── REORDER SECTIONS ── */}
            <div className="space-y-6 mt-8">

              {/* Collection Display Order */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#8c50ff]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Collection Display Order — Drag & Drop</h3>
                </div>
                <p className="text-[11px] text-[#6d7175]">Drag collections to reorder. This order is used on the Homepage and Collections page.</p>
                <div className="space-y-1.5">
                  {orderedCollections.map((col, idx) => (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={() => setDragColIdx(idx)}
                      onDragOver={(e) => { e.preventDefault(); setDragColOver(idx); }}
                      onDrop={() => {
                        if (dragColIdx === null || dragColIdx === idx) { setDragColIdx(null); setDragColOver(null); return; }
                        const reordered = [...orderedCollections];
                        const [moved] = reordered.splice(dragColIdx, 1);
                        reordered.splice(idx, 0, moved);
                        setOrderedCollections(reordered);
                        setDragColIdx(null);
                        setDragColOver(null);
                      }}
                      onDragEnd={() => { setDragColIdx(null); setDragColOver(null); }}
                      className={`flex items-center gap-3 bg-[#f9f9f9] border rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-all ${
                        dragColOver === idx && dragColIdx !== idx ? "border-[#000000] bg-[#f0f7ff] shadow-md" : "border-[#e1e3e5]"
                      } ${dragColIdx === idx ? "opacity-40" : "opacity-100"}`}
                    >
                      <span className="text-[#6d7175] text-xs select-none">⠿⠿</span>
                      <span className="w-5 h-5 rounded-full bg-[#8c50ff]/10 text-[#8c50ff] text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                      {col.image && (col.image.startsWith("http") || col.image.startsWith("data:")) && (
                        <img src={col.image} alt={col.name} className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                      )}
                      <span className="text-sm font-semibold text-[#202223] flex-1">{col.name}</span>
                      <span className="text-[10px] text-[#6d7175] bg-[#f1f1f1] rounded px-2 py-0.5 font-mono">{col.slug}</span>
                    </div>
                  ))}
                  {orderedCollections.length === 0 && (
                    <p className="text-[11px] text-[#6d7175] italic">No collections found. Add some collections first.</p>
                  )}
                </div>
              </div>

              {/* Product Display Order Within Collection */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Product Display Order Within Collections — Drag & Drop</h3>
                </div>
                <p className="text-[11px] text-[#6d7175]">Select a collection, then drag products to set their display order.</p>
                <div>
                  <label className="block text-xs font-medium text-[#6d7175] mb-1">Select Collection</label>
                  <select
                    value={productOrderCollSlug}
                    onChange={(e) => {
                      const slug = e.target.value;
                      setProductOrderCollSlug(slug);
                      if (!slug) { setProductOrderList([]); return; }
                      const collProds = products.filter(p => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(slug));
                      const savedOrder = productOrderMap[slug] ?? [];
                      if (savedOrder.length > 0) {
                        const sorted = [...collProds].sort((a, b) => {
                          const ia = savedOrder.indexOf(a.id);
                          const ib = savedOrder.indexOf(b.id);
                          return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
                        });
                        setProductOrderList(sorted);
                      } else {
                        setProductOrderList(collProds);
                      }
                    }}
                    className="border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] bg-white"
                  >
                    <option value="">— Pick a collection —</option>
                    {collections.map(col => (
                      <option key={col.id} value={col.slug}>{col.name} ({products.filter(p => (p.collectionIds?.length ? p.collectionIds : [p.collectionId]).includes(col.slug)).length} products)</option>
                    ))}
                  </select>
                </div>
                {productOrderCollSlug && productOrderList.length > 0 && (
                  <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                    {productOrderList.map((prod, idx) => (
                      <div
                        key={prod.id}
                        draggable
                        onDragStart={() => setDragProdIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); setDragProdOver(idx); }}
                        onDrop={() => {
                          if (dragProdIdx === null || dragProdIdx === idx) { setDragProdIdx(null); setDragProdOver(null); return; }
                          const reordered = [...productOrderList];
                          const [moved] = reordered.splice(dragProdIdx, 1);
                          reordered.splice(idx, 0, moved);
                          setProductOrderList(reordered);
                          setProductOrderMap(prev => ({ ...prev, [productOrderCollSlug]: reordered.map(p => p.id) }));
                          setDragProdIdx(null);
                          setDragProdOver(null);
                        }}
                        onDragEnd={() => { setDragProdIdx(null); setDragProdOver(null); }}
                        className={`flex items-center gap-3 bg-[#f9f9f9] border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all ${
                          dragProdOver === idx && dragProdIdx !== idx ? "border-[#000000] bg-[#f0f7ff] shadow-md" : "border-[#e1e3e5]"
                        } ${dragProdIdx === idx ? "opacity-40" : "opacity-100"}`}
                      >
                        <span className="text-[#6d7175] text-xs select-none">⠿⠿</span>
                        <span className="w-5 h-5 rounded-full bg-[#000000]/10 text-[#000000] text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        {prod.images?.[0] && (prod.images[0].startsWith("http") || prod.images[0].startsWith("data:")) ? (
                          <img src={prod.images[0]} alt={prod.title} className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0"><Package2 className="w-4 h-4 text-zinc-400" /></div>
                        )}
                        <span className="text-xs font-semibold text-[#202223] flex-1 truncate">{prod.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${prod.stockStatus === "in_stock" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                          {prod.stockStatus === "in_stock" ? "IN STOCK" : prod.stockStatus === "low_stock" ? "LOW" : "OUT"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {productOrderCollSlug && productOrderList.length === 0 && (
                  <p className="text-[11px] text-[#6d7175] italic">No products in this collection yet.</p>
                )}
              </div>

              {/* Product Display Order Within Sub-Collection */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Product Display Order Within Sub-Collection — Drag & Drop</h3>
                </div>
                <p className="text-[11px] text-[#6d7175]">Select a collection, then a sub-collection to reorder products inside it.</p>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6d7175] mb-1">Collection</label>
                    <select
                      value={subProdOrderCollSlug}
                      onChange={(e) => {
                        const slug = e.target.value;
                        setSubProdOrderCollSlug(slug);
                        setSubProdOrderSubId("");
                        setSubProdOrderList([]);
                      }}
                      className="border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] bg-white"
                    >
                      <option value="">— Pick a collection —</option>
                      {collections.filter(c => (c.subcollections?.length ?? 0) > 0).map(col => (
                        <option key={col.id} value={col.slug}>{col.name}</option>
                      ))}
                    </select>
                  </div>
                  {subProdOrderCollSlug && (() => {
                    const coll = collections.find(c => c.slug === subProdOrderCollSlug);
                    const subs = coll?.subcollections ?? [];
                    if (subs.length === 0) return <p className="text-[11px] text-[#6d7175] italic self-end pb-2">No subcollections found.</p>;
                    return (
                      <div>
                        <label className="block text-xs font-medium text-[#6d7175] mb-1">Sub-Collection</label>
                        <select
                          value={subProdOrderSubId}
                          onChange={(e) => {
                            const subId = e.target.value;
                            setSubProdOrderSubId(subId);
                            if (!subId) { setSubProdOrderList([]); return; }
                            const sub = subs.find(s => s.id === subId);
                            if (!sub) { setSubProdOrderList([]); return; }
                            const subProds = products.filter(p => sub.productIds.includes(p.id));
                            const savedOrder = subcollectionProductOrderMap[subId] ?? [];
                            if (savedOrder.length > 0) {
                              const sorted = [...subProds].sort((a, b) => {
                                const ia = savedOrder.indexOf(a.id);
                                const ib = savedOrder.indexOf(b.id);
                                return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
                              });
                              setSubProdOrderList(sorted);
                            } else {
                              setSubProdOrderList(subProds);
                            }
                          }}
                          className="border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] bg-white"
                        >
                          <option value="">— Pick a sub-collection —</option>
                          {subs.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name} ({products.filter(p => sub.productIds.includes(p.id)).length} products)</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
                {subProdOrderSubId && subProdOrderList.length > 0 && (
                  <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                    {subProdOrderList.map((prod, idx) => (
                      <div
                        key={prod.id}
                        draggable
                        onDragStart={() => setDragSubProdIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); setDragSubProdOver(idx); }}
                        onDrop={() => {
                          if (dragSubProdIdx === null || dragSubProdIdx === idx) { setDragSubProdIdx(null); setDragSubProdOver(null); return; }
                          const reordered = [...subProdOrderList];
                          const [moved] = reordered.splice(dragSubProdIdx, 1);
                          reordered.splice(idx, 0, moved);
                          setSubProdOrderList(reordered);
                          setSubcollectionProductOrderMap(prev => ({ ...prev, [subProdOrderSubId]: reordered.map(p => p.id) }));
                          setDragSubProdIdx(null);
                          setDragSubProdOver(null);
                        }}
                        onDragEnd={() => { setDragSubProdIdx(null); setDragSubProdOver(null); }}
                        className={`flex items-center gap-3 bg-[#f9f9f9] border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all ${
                          dragSubProdOver === idx && dragSubProdIdx !== idx ? "border-[#f59e0b] bg-amber-50 shadow-md" : "border-[#e1e3e5]"
                        } ${dragSubProdIdx === idx ? "opacity-40" : "opacity-100"}`}
                      >
                        <span className="text-[#6d7175] text-xs select-none">⠿⠿</span>
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        {prod.images?.[0] && (prod.images[0].startsWith("http") || prod.images[0].startsWith("data:")) ? (
                          <img src={prod.images[0]} alt={prod.title} className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0"><Package2 className="w-4 h-4 text-zinc-400" /></div>
                        )}
                        <span className="text-xs font-semibold text-[#202223] flex-1 truncate">{prod.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${prod.stockStatus === "in_stock" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                          {prod.stockStatus === "in_stock" ? "IN STOCK" : prod.stockStatus === "low_stock" ? "LOW" : "OUT"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {subProdOrderSubId && subProdOrderList.length === 0 && (
                  <p className="text-[11px] text-[#6d7175] italic">No products in this sub-collection yet.</p>
                )}
              </div>

              {/* Save Reorder Button */}
              <div className="pb-4">
                <button
                  onClick={async () => {
                    try {
                      const currentSettings = await getSettings();
                      await saveSettings({
                        ...currentSettings,
                        collectionOrder: orderedCollections.map(c => c.slug),
                        productOrder: productOrderMap,
                        subcollectionProductOrder: subcollectionProductOrderMap,
                      });
                      showToast("Reorder saved! Refresh site to see changes.", "success");
                    } catch {
                      showToast("Could not save reorder.", "error");
                    }
                  }}
                  className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-8 py-3 rounded-lg transition cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Reorder Settings
                </button>
              </div>
            </div>
            </div>
          )}

          {/* ===== ORDERS ===== */}
          {activeTab === "orders" && (() => {
            const now = new Date();
            const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const todayStart = startOfDay(now).getTime();
            const yesterdayStart = todayStart - 86400000;
            const weekStart = todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const dateFilteredOrders = orders.filter(o => {
              const t = new Date(o.createdAt).getTime();
              if (orderDateFilter === "today") return t >= todayStart;
              if (orderDateFilter === "yesterday") return t >= yesterdayStart && t < todayStart;
              if (orderDateFilter === "this_week") return t >= weekStart;
              if (orderDateFilter === "this_month") return t >= monthStart;
              return true;
            });
            const searchQ = orderSearch.trim().toLowerCase();
            const searchFilteredOrders = searchQ ? dateFilteredOrders.filter(o =>
              o.customerName?.toLowerCase().includes(searchQ) ||
              o.customerPhone?.includes(searchQ) ||
              o.id.toLowerCase().includes(searchQ) ||
              o.pincode?.includes(searchQ) ||
              o.city?.toLowerCase().includes(searchQ)
            ) : dateFilteredOrders;
            const statusFilteredOrders = searchFilteredOrders.filter(o => {
              if (orderStatusFilter === "all") return true;
              return o.status === orderStatusFilter;
            });
            const paymentFilteredOrders = statusFilteredOrders.filter(o => {
              if (orderPaymentFilter === "cod") return o.paymentMethod === "cod";
              if (orderPaymentFilter === "prepaid") return o.paymentMethod !== "cod";
              return true;
            });
            const codCount = searchFilteredOrders.filter(o => o.paymentMethod === "cod").length;
            const prepaidCount = searchFilteredOrders.filter(o => o.paymentMethod !== "cod").length;
            const pendingCount = searchFilteredOrders.filter(o => o.status === "pending").length;
            const processingCount = searchFilteredOrders.filter(o => o.status === "processing").length;
            const shippedCount = searchFilteredOrders.filter(o => o.status === "shipped").length;
            const deliveredCount = searchFilteredOrders.filter(o => o.status === "delivered").length;
            const waitingMfgCount = searchFilteredOrders.filter(o => o.status === "waiting_for_manufacturing").length;
            const waitingCustCount = searchFilteredOrders.filter(o => o.status === "waiting_for_customer_confirmation").length;
            const readyToShipCount = searchFilteredOrders.filter(o => o.status === "ready_to_ship").length;
            const waitingPickupCount = searchFilteredOrders.filter(o => o.status === "waiting_for_pickup").length;
            const outForDeliveryCount = searchFilteredOrders.filter(o => o.status === "out_for_delivery").length;
            const cancelledCount = searchFilteredOrders.filter(o => o.status === "cancelled").length;
            const returnedCount = searchFilteredOrders.filter(o => o.status === "returned").length;
            const filterLabels: Record<string, string> = { today: "Today", yesterday: "Yesterday", this_week: "This Week", this_month: "This Month", all: "All Time" };
            const totalRevenue = paymentFilteredOrders.reduce((s, o) => s + o.total, 0);
            const pendingRevenue = paymentFilteredOrders.filter(o => ["pending","waiting_for_manufacturing","waiting_for_customer_confirmation","processing","ready_to_ship","waiting_for_pickup"].includes(o.status)).reduce((s, o) => s + o.total, 0);
            return (
            <div className="space-y-4">
              {/* ── HEADER ── */}
              <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-xl font-bold text-[#202223]">Orders</h1>
                  <span className="text-sm text-[#6d7175]">
                    {paymentFilteredOrders.length} order{paymentFilteredOrders.length !== 1 ? "s" : ""}
                    {totalRevenue > 0 && <> · <span className="font-semibold text-[#202223]">₹{totalRevenue.toLocaleString()}</span></>}
                    {" · "}{filterLabels[orderDateFilter]}
                  </span>
                </div>
                {/* COD / Prepaid tabs */}
                <div className="flex items-center gap-1.5 bg-[#f6f6f7] border border-[#e1e3e5] rounded-xl p-1 w-fit">
                  {([["all","All",searchFilteredOrders.length],["cod","COD",codCount],["prepaid","Prepaid",prepaidCount]] as const).map(([val, label, cnt]) => (
                    <button
                      key={val}
                      onClick={() => setOrderPaymentFilter(val as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${orderPaymentFilter === val ? "bg-white shadow-sm text-[#202223]" : "text-[#6d7175] hover:text-[#202223]"}`}
                    >
                      {label === "COD" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                      {label === "Prepaid" && <span className="w-1.5 h-1.5 rounded-full bg-[#000000] shrink-0" />}
                      {label}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${orderPaymentFilter === val ? "bg-[#000000] text-white" : "bg-[#e1e3e5] text-[#6d7175]"}`}>{cnt}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── STATUS SUMMARY STRIP ── */}
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {([
                  { key: "pending",                           count: pendingCount },
                  { key: "waiting_for_manufacturing",         count: waitingMfgCount },
                  { key: "waiting_for_customer_confirmation", count: waitingCustCount },
                  { key: "processing",                        count: processingCount },
                  { key: "ready_to_ship",                     count: readyToShipCount },
                  { key: "waiting_for_pickup",                count: waitingPickupCount },
                  { key: "shipped",                           count: shippedCount },
                  { key: "out_for_delivery",                  count: outForDeliveryCount },
                  { key: "delivered",                         count: deliveredCount },
                  { key: "cancelled",                         count: cancelledCount },
                  { key: "returned",                          count: returnedCount },
                ] as { key: Order["status"]; count: number }[]).map(s => {
                  const cfg = STATUS_CONFIG[s.key];
                  const isActive = orderStatusFilter === s.key;
                  const rev = searchFilteredOrders.filter(o => o.status === s.key).reduce((a, o) => a + o.total, 0);
                  return (
                    <button key={s.key}
                      onClick={() => setOrderStatusFilter(isActive ? "all" : s.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition cursor-pointer text-left ${isActive ? cfg.border + " shadow-sm" : "bg-white border-[#e1e3e5] hover:border-[#c9cccf]"}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[9px] font-black uppercase tracking-widest truncate ${isActive ? cfg.badge.split(" ")[1] : "text-[#6d7175]"}`}>{cfg.label}</p>
                        <p className={`text-base font-black leading-none mt-0.5 ${isActive ? cfg.badge.split(" ")[1] : "text-[#202223]"}`}>{s.count}</p>
                        {rev > 0 && <p className="text-[9px] text-[#9ca3af] mt-0.5 truncate">₹{rev.toLocaleString()}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── SEARCH + CONTROLS ROW ── */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c9cccf]" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    placeholder="Search by name, phone, order ID, city..."
                    className="w-full pl-9 pr-3 py-2 border border-[#e1e3e5] rounded-xl text-sm outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/15 bg-white"
                  />
                  {orderSearch && (
                    <button onClick={() => setOrderSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#c9cccf] hover:text-[#6d7175] cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* ── STATUS FILTER ACTIVE PILL ── */}
              {orderStatusFilter !== "all" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6d7175]">Filtering by:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusCfg(orderStatusFilter).border}`}>
                    {getStatusCfg(orderStatusFilter).label}
                    <button onClick={() => setOrderStatusFilter("all")} className="cursor-pointer opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
                  </span>
                </div>
              )}

              {/* ── TOOLBAR (expand/archive/date filters) ── */}
              <div className="flex gap-1.5 flex-wrap items-center">
                  <button
                    onClick={() => { playOrderSound(); showToast("Notification sound test!", "success"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-[#e1e3e5] text-[#6d7175] hover:text-[#202223] hover:border-[#c9cccf] rounded-lg transition cursor-pointer"
                    title="Test notification sound"
                  >
                    <Bell className="w-3.5 h-3.5" /> Test Sound
                  </button>
                  <div className="w-px h-5 bg-[#e1e3e5]" />
                  <button
                    onClick={() => {
                      if (expandedOrderIds.size === paymentFilteredOrders.length) {
                        setExpandedOrderIds(new Set());
                      } else {
                        setExpandedOrderIds(new Set(paymentFilteredOrders.map(o => o.id)));
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-[#e1e3e5] text-[#6d7175] hover:text-[#202223] hover:border-[#c9cccf] rounded-lg transition cursor-pointer"
                    title={expandedOrderIds.size === paymentFilteredOrders.length ? "Collapse all orders" : "Expand all orders"}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expandedOrderIds.size === paymentFilteredOrders.length ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}/></svg>
                    {expandedOrderIds.size === paymentFilteredOrders.length ? "Collapse All" : "Expand All"}
                  </button>
                  <div className="w-px h-5 bg-[#e1e3e5]" />
                  <button
                    onClick={async () => {
                      if (!confirm("Archive all current orders? They will be hidden from the dashboard but not permanently deleted.")) return;
                      try {
                        const allOrders = await getOrders();
                        await Promise.all(allOrders.map(o => updateOrder(o.id, { status: "archived" as any })));
                        setOrders([]);
                        prevOrderIdsRef.current = new Set();
                        setNewOrderCount(0);
                        showToast("Orders archived for the new day!", "success");
                      } catch {
                        showToast("Archive failed. Try again.", "error");
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#e1e3e5] text-[#6d7175] hover:text-[#d82c0d] hover:border-[#d82c0d] rounded-lg transition cursor-pointer"
                  >
                    Archive All Orders
                  </button>
                  <div className="w-px h-5 bg-[#e1e3e5]" />
                  {(["today","yesterday","this_week","this_month","all"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setOrderDateFilter(f)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${orderDateFilter === f ? "bg-[#000000] text-white border-[#000000]" : "bg-white text-[#6d7175] border-[#e1e3e5] hover:border-[#000000] hover:text-[#000000]"}`}
                    >
                      {filterLabels[f]}
                    </button>
                  ))}
              </div>
              {paymentFilteredOrders.length === 0 ? (
                <div className="bg-white border border-[#e1e3e5] rounded-xl text-center py-16">
                  <ShoppingCart className="w-10 h-10 text-[#c9cccf] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#6d7175]">
                    {orderSearch ? `No orders matching "${orderSearch}"` : orderStatusFilter !== "all" ? `No ${orderStatusFilter} orders for ${filterLabels[orderDateFilter].toLowerCase()}` : `No orders for ${filterLabels[orderDateFilter].toLowerCase()}`}
                  </p>
                  {(orderSearch || orderStatusFilter !== "all") && (
                    <button onClick={() => { setOrderSearch(""); setOrderStatusFilter("all"); }} className="mt-3 text-xs font-semibold text-[#000000] hover:underline cursor-pointer">Clear filters</button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentFilteredOrders.map(ord => {
                    const ordDate = new Date(ord.createdAt);
                    const fullAddress = `${ord.shippingAddress}, ${ord.city}, ${ord.state} - ${ord.pincode}`;
                    const isExpanded = expandedOrderIds.has(ord.id);
                    const phoneModel = ord.items[0]?.selectedModel || "—";
                    const totalItems = ord.items.reduce((s, i) => s + i.quantity, 0);
                    const hasCustom = ord.items.some(i => i.customText || i.customerImage);
                    const firstImg = ord.items[0]?.product?.images?.[0];
                    const ageMs = nowTime - new Date(ord.createdAt).getTime();
                    const ageMin = Math.floor(ageMs / 60000);
                    const ageLabel = ageMin < 60 ? `${ageMin}m ago` : ageMin < 1440 ? `${Math.floor(ageMin/60)}h ago` : `${Math.floor(ageMin/1440)}d ago`;
                    const isNew = ageMin < 30;
                    const waMsg = encodeURIComponent(`Hi ${ord.customerName}, your FabCoverz order ${ord.id.startsWith("FC") ? ord.id : "#" + ord.id.slice(-8)} (₹${ord.total}) is ${ord.status}. ${ord.awb ? `AWB: ${ord.awb}` : "We will update you soon!"}`);
                    return (
                    <div key={ord.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${isNew ? "border-amber-300 ring-1 ring-amber-200" : "border-[#e1e3e5]"}`}>

                      {/* ── COLLAPSED SUMMARY ROW (always visible) ── */}
                      <div
                        onClick={() => toggleOrderExpand(ord.id)}
                        className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer select-none hover:bg-[#fafafa] transition-colors"
                      >
                        {/* Status color strip */}
                        <div className={`w-1 self-stretch rounded-full shrink-0 ${getStatusCfg(ord.status).dot}`} />

                        {/* Product thumbnail */}
                        <div className="w-10 h-11 rounded-lg border border-[#e1e3e5] bg-[#f6f6f7] flex items-center justify-center shrink-0 overflow-hidden">
                          {firstImg ? (
                            <img src={firstImg} alt="" className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                          ) : (
                            <Smartphone className="w-4 h-4 text-[#c9cccf]" />
                          )}
                        </div>

                        {/* Order ID + Customer */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-[#202223] font-sans tracking-wide">
                              {ord.id.startsWith("FC") ? ord.id : "#" + ord.id.slice(-8)}
                            </span>
                            {isNew && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-white uppercase tracking-wide animate-pulse">NEW</span>}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusCfg(ord.status).badge}`}>{getStatusCfg(ord.status).label}</span>
                            <span className={`hidden sm:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ord.paymentMethod === "cod" ? "text-amber-700 bg-amber-50 border border-amber-200" : "text-[#2c6ecb] bg-[#f4f8ff] border border-[#d4e0fc]"}`}>
                              {ord.paymentMethod === "cod" ? "COD" : ord.paymentMethod === "razorpay" ? "Razorpay" : ord.paymentMethod === "upi" ? "UPI" : "Card"}
                            </span>
                            <span className="hidden sm:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f6f6f7] text-[#6d7175] border border-[#e1e3e5]">
                              {totalItems} item{totalItems !== 1 ? "s" : ""}
                            </span>
                            {hasCustom && <span className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fff8e1] text-[#b98900] border border-[#ffd54f]"><Edit className="w-2.5 h-2.5"/>Custom</span>}
                          </div>
                          <p className="text-xs text-[#6d7175] mt-0.5 truncate">
                            <span className="font-semibold text-[#202223]">{ord.customerName}</span>
                            <span className="hidden sm:inline text-[#9ca3af]"> · {ord.customerPhone}</span>
                            {phoneModel !== "—" && <span className="hidden sm:inline text-[#9ca3af]"> · {phoneModel}</span>}
                            {ord.city && <span className="hidden md:inline text-[#9ca3af]"> · {ord.city}</span>}
                          </p>
                        </div>

                        {/* Amount + Age */}
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="text-sm font-black text-[#202223]">₹{ord.total}</p>
                          <p className="text-[10px] text-[#9ca3af]">{ageLabel}</p>
                        </div>

                        {/* Quick status update */}
                        <div onClick={e => e.stopPropagation()} className="shrink-0 hidden sm:block">
                          <select
                            value={ord.status}
                            onChange={e => handleStatusChange(ord, e.target.value as any)}
                            className={`border rounded-lg px-2 py-1 text-xs font-semibold outline-none cursor-pointer ${getStatusCfg(ord.status).border}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="waiting_for_manufacturing">Waiting for Manufacturing</option>
                            <option value="waiting_for_customer_confirmation">Waiting for Customer Confirmation</option>
                            <option value="processing">Processing</option>
                            <option value="ready_to_ship">Ready to Ship</option>
                            <option value="waiting_for_pickup">Waiting for Pickup</option>
                            <option value="shipped">Shipped</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="returned">Returned</option>
                          </select>
                        </div>

                        {/* WhatsApp quick msg */}
                        <div onClick={e => e.stopPropagation()} className="shrink-0 hidden md:block">
                          <a
                            href={`https://wa.me/${(ord.customerPhone || "").replace(/\D/g,"").replace(/^0/,"91")}?text=${waMsg}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition cursor-pointer"
                            title="WhatsApp customer"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.114.554 4.1 1.524 5.82L.057 23.854a.5.5 0 0 0 .614.614l6.086-1.455A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.371l-.36-.214-3.733.893.909-3.624-.235-.372A9.868 9.868 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1S21.9 6.533 21.9 12 17.467 21.9 12 21.9z"/></svg>
                            WA
                          </a>
                        </div>

                        {/* Copy all details */}
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <button
                            onClick={() => {
                              const itemsSummary = ord.items.map(it => `  - ${it.product.title} | Model: ${it.selectedModel || "—"} | Qty: ${it.quantity} | ₹${it.product.price * it.quantity}${it.customText ? ` | Custom: "${it.customText}"` : ""}`).join("\n");
                              const text = `ORDER: ${ord.id.startsWith("FC") ? ord.id : "#" + ord.id.slice(-8)}\nName: ${ord.customerName}\nPhone: ${ord.customerPhone}${ord.customerAltPhone ? `\nAlt Phone: ${ord.customerAltPhone}` : ""}\nEmail: ${ord.customerEmail}\nAddress: ${ord.shippingAddress}\nCity: ${ord.city}, ${ord.state}\nPincode: ${ord.pincode}\nPayment: ${ord.paymentMethod.toUpperCase()}\nTotal: ₹${ord.total}\nStatus: ${ord.status}${ord.awb ? `\nAWB: ${ord.awb}` : ""}\nItems:\n${itemsSummary}`;
                              navigator.clipboard.writeText(text);
                              showToast("Order details copied!", "success");
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-[#6d7175] hover:text-[#000000] bg-[#f6f6f7] hover:bg-[#e8f0ff] border border-[#e1e3e5] hover:border-[#000000] px-2 py-1 rounded-lg transition cursor-pointer"
                            title="Copy all order details"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            Copy
                          </button>
                        </div>

                        {/* Expand chevron */}
                        <svg className={`w-3.5 h-3.5 text-[#c9cccf] shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
                      </div>

                      {/* ── EXPANDED FULL DETAILS ── */}
                      {isExpanded && <>

                      {/* ── ORDER HEADER BAR ── */}
                      <div className={`px-5 py-3 border-b border-[#e1e3e5] ${getStatusCfg(ord.status).row}`}>
                        {/* Top row: ID + actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-black text-[#202223] font-sans tracking-wide">
                              {ord.id.startsWith("FC") ? ord.id : "#" + ord.id.slice(-8)}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getStatusCfg(ord.status).badge}`}>
                              {getStatusCfg(ord.status).label}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ord.paymentMethod === "cod" ? "text-amber-700 bg-amber-50" : "text-[#2c6ecb] bg-[#f4f8ff]"}`}>{ord.paymentMethod === "cod" ? "COD" : ord.paymentMethod === "razorpay" ? "Razorpay" : ord.paymentMethod === "upi" ? "UPI" : "Card"}</span>
                            <span className="text-[10px] text-[#9ca3af]">{ordDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {ordDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={ord.status}
                              onChange={e => handleStatusChange(ord, e.target.value as any)}
                              className="bg-white border border-[#e1e3e5] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#202223] outline-none cursor-pointer shadow-sm"
                            >
                              <option value="pending">Pending</option>
                              <option value="waiting_for_manufacturing">Waiting for Manufacturing</option>
                              <option value="waiting_for_customer_confirmation">Waiting for Customer Confirmation</option>
                              <option value="processing">Processing</option>
                              <option value="ready_to_ship">Ready to Ship</option>
                              <option value="waiting_for_pickup">Waiting for Pickup</option>
                              <option value="shipped">Shipped</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="returned">Returned</option>
                            </select>
                            <button onClick={() => openEditOrder(ord)} className="p-1.5 text-[#6d7175] hover:text-[#000000] hover:bg-[#f0f7ff] rounded-lg transition cursor-pointer border border-[#e1e3e5]" title="Edit order details"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => openMergeModal(ord)} className="p-1.5 text-[#6d7175] hover:text-[#7c3aed] hover:bg-[#f5f3ff] rounded-lg transition cursor-pointer border border-[#e1e3e5]" title="Merge with another order"><GitMerge className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteOrder(ord.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg transition cursor-pointer border border-[#e1e3e5]" title="Delete order"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        {/* Status timeline */}
                        <div className="flex items-center gap-0">
                          {(["pending","processing","shipped","delivered"] as const).map((step, i) => {
                            const steps = ["pending","processing","shipped","delivered"];
                            const curIdx = steps.indexOf(ord.status);
                            const isDone = i <= curIdx;
                            const isActive = i === curIdx;
                            const stepColors = ["bg-amber-400","bg-blue-500","bg-sky-400","bg-emerald-500"];
                            const stepLabels = ["Pending","Processing","Shipped","Delivered"];
                            return (
                              <React.Fragment key={step}>
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${isDone ? `${stepColors[i]} border-transparent` : "bg-white border-[#e1e3e5]"} ${isActive ? "ring-2 ring-offset-1 ring-current" : ""}`}>
                                    {isDone && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                                  </div>
                                  <span className={`text-[9px] font-bold whitespace-nowrap ${isDone ? "text-[#202223]" : "text-[#9ca3af]"}`}>{stepLabels[i]}</span>
                                </div>
                                {i < 3 && <div className={`h-0.5 flex-1 mb-4 mx-1 rounded-full transition-all ${i < curIdx ? stepColors[i+1] : "bg-[#e1e3e5]"}`} />}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

                        {/* Customer */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest">Customer</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-[#e8f0ff] flex items-center justify-center shrink-0">
                                <span className="text-xs font-black text-[#2c6ecb]">{ord.customerName?.charAt(0).toUpperCase()}</span>
                              </div>
                              <p className="font-bold text-[#202223] text-sm flex-1">{ord.customerName}</p>
                              <button
                                onClick={() => { navigator.clipboard.writeText(ord.customerName || ""); showToast("Name copied!", "success"); }}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#6d7175] hover:text-[#202223] cursor-pointer bg-[#f6f6f7] border border-[#e1e3e5] rounded px-1.5 py-0.5 transition shrink-0"
                                title="Copy name"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                Copy
                              </button>
                            </div>

                            {/* Phone with call + copy + WA button */}
                            <div className="flex items-center gap-2 bg-[#f6f6f7] rounded-lg px-3 py-2">
                              <svg className="w-3.5 h-3.5 text-[#6d7175] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              <span className="text-xs text-[#202223] flex-1 font-mono">{ord.customerPhone}</span>
                              <button
                                onClick={() => { navigator.clipboard.writeText(ord.customerPhone || ""); showToast("Phone copied!", "success"); }}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#6d7175] hover:text-[#202223] cursor-pointer bg-white border border-[#e1e3e5] rounded px-1.5 py-0.5 transition shrink-0"
                                title="Copy phone"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                Copy
                              </button>
                              <a href={`tel:${ord.customerPhone}`} className="text-[#000000] hover:text-[#0052cc] shrink-0" title="Call customer">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                              </a>
                              <a
                                href={`https://wa.me/${(ord.customerPhone || "").replace(/\D/g,"").replace(/^0/,"91")}?text=${waMsg}`}
                                target="_blank" rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-800 shrink-0"
                                title="WhatsApp customer"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.114.554 4.1 1.524 5.82L.057 23.854a.5.5 0 0 0 .614.614l6.086-1.455A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.371l-.36-.214-3.733.893.909-3.624-.235-.372A9.868 9.868 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1S21.9 6.533 21.9 12 17.467 21.9 12 21.9z"/></svg>
                              </a>
                            </div>

                            {/* Alternate Phone — shown only if provided */}
                            {ord.customerAltPhone && (
                              <div className="flex items-center gap-2 bg-[#f0f7ff] border border-[#d4e0fc] rounded-lg px-3 py-2">
                                <svg className="w-3.5 h-3.5 text-[#2c6ecb] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                <span className="text-[10px] font-bold text-[#2c6ecb] uppercase tracking-wide shrink-0">Alt</span>
                                <span className="text-xs text-[#202223] flex-1 font-mono">{ord.customerAltPhone}</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(ord.customerAltPhone || ""); showToast("Alt phone copied!", "success"); }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-[#2c6ecb] hover:text-[#0052cc] cursor-pointer bg-white border border-[#d4e0fc] rounded px-1.5 py-0.5 transition shrink-0"
                                  title="Copy alt phone"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                  Copy
                                </button>
                                <a href={`tel:${ord.customerAltPhone}`} className="text-[#000000] hover:text-[#0052cc] shrink-0" title="Call alternate number">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                                </a>
                              </div>
                            )}

                            {/* AWB / Tracking ID — shown if order is shipped */}
                            {ord.awb ? (
                              <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                                <svg className="w-3.5 h-3.5 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wide shrink-0">AWB</span>
                                <span className="text-xs text-[#202223] flex-1 font-mono font-bold">{ord.awb}</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(ord.awb!); showToast("AWB copied!", "success"); }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-sky-600 hover:text-sky-800 cursor-pointer bg-white border border-sky-200 rounded px-1.5 py-0.5 transition"
                                  title="Copy AWB"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                  Copy
                                </button>
                                <button
                                  onClick={() => { setAwbInput(ord.awb || ""); setAwbModal({ orderId: ord.id, customerName: ord.customerName }); }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-800 cursor-pointer bg-white border border-zinc-200 rounded px-1.5 py-0.5 transition"
                                  title="Edit AWB"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => openTrackModal(ord)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer bg-white border border-emerald-200 hover:bg-emerald-50 rounded px-1.5 py-0.5 transition"
                                  title="Track Shipment"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                                  Track
                                </button>
                              </div>
                            ) : ord.status === "shipped" ? (
                              <button
                                onClick={() => { setAwbInput(""); setAwbModal({ orderId: ord.id, customerName: ord.customerName }); }}
                                className="w-full flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg px-3 py-2 hover:bg-amber-100 transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                Add Shipment ID (AWB)
                              </button>
                            ) : null}

                            {/* Push to NimbusPost — only if no AWB yet and order is not yet shipped */}
                            {!ord.awb && ["pending","waiting_for_manufacturing","waiting_for_customer_confirmation","processing","ready_to_ship","waiting_for_pickup"].includes(ord.status) && (
                              <button
                                onClick={() => pushToNimbusPost(ord)}
                                disabled={npPushingOrderId === ord.id}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2 transition cursor-pointer"
                              >
                                {npPushingOrderId === ord.id ? (
                                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating Shipment…</>
                                ) : (
                                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> Push to NimbusPost</>
                                )}
                              </button>
                            )}

                            {/* Shipping address with copy button */}
                            <div className="bg-[#f6f6f7] rounded-lg px-3 py-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-wide">Ship To</p>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(fullAddress); showToast("Address copied!", "success"); }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-[#2c6ecb] hover:text-[#0052cc] cursor-pointer bg-white border border-[#d4e0fc] rounded px-1.5 py-0.5 transition"
                                  title="Copy address"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                  Copy
                                </button>
                              </div>
                              <p className="text-xs text-[#202223] font-medium leading-relaxed">{ord.shippingAddress}</p>
                              <p className="text-xs text-[#6d7175]">{ord.city}, {ord.state}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-[#202223] font-sans">PIN: {ord.pincode}</p>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(ord.pincode || ""); showToast("Pincode copied!", "success"); }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-[#2c6ecb] hover:text-[#0052cc] cursor-pointer bg-white border border-[#d4e0fc] rounded px-1.5 py-0.5 transition"
                                  title="Copy pincode"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                  Copy
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── COL 2 & 3: ITEMS ── */}
                        <div className="lg:col-span-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest">Order Items ({ord.items.length})</p>
                            <p className="text-base font-black text-[#202223]">₹{ord.total}</p>
                          </div>
                          <div className="space-y-2.5">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="border border-[#e1e3e5] rounded-xl overflow-hidden">
                                {/* Item header */}
                                <div className="flex items-start gap-3 p-3 bg-[#fafafa]">
                                  {/* Product image */}
                                  <div className="w-14 h-16 rounded-lg border border-[#e1e3e5] bg-white flex items-center justify-center shrink-0 overflow-hidden">
                                    {it.product.images && it.product.images[0] ? (
                                      <img src={it.product.images[0]} alt={it.product.title} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                                    ) : (
                                      <Smartphone className="w-5 h-5 text-[#c9cccf]" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <p className="text-xs font-bold text-[#202223] leading-snug">{it.product.title}</p>
                                    {/* Model pill */}
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="inline-flex items-center gap-1 bg-[#e8f0ff] text-[#2c6ecb] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        <Smartphone className="w-2.5 h-2.5" />
                                        {it.selectedModel || "—"}
                                      </span>
                                      {it.selectedModel && it.selectedModel !== "—" && (
                                        <button
                                          onClick={() => { navigator.clipboard.writeText(it.selectedModel || ""); showToast("Model copied!", "success"); }}
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2c6ecb] hover:text-[#0052cc] cursor-pointer bg-white border border-[#d4e0fc] rounded-full px-2 py-0.5 transition"
                                          title="Copy phone model"
                                        >
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                          Copy
                                        </button>
                                      )}
                                      <span className="inline-flex items-center bg-[#f6f6f7] text-[#6d7175] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#e1e3e5]">
                                        Qty: {it.quantity}
                                      </span>
                                      <span className="inline-flex items-center bg-[#202223] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        ₹{it.product.price * it.quantity}
                                      </span>
                                    </div>
                                    {it.customText && (
                                      <div className="flex items-center gap-1.5 bg-[#fff8e1] border border-[#ffd54f] rounded-lg px-2 py-1">
                                        <Edit className="w-3 h-3 text-[#b98900] shrink-0" />
                                        <span className="text-[10px] font-bold text-[#b98900]">CUSTOM PRINT: "{it.customText}"</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Customer photo if any */}
                                {it.customerImage && (
                                  <div className="flex items-center gap-3 px-3 py-2.5 border-t border-[#e1e3e5] bg-[#fffbeb]">
                                    <img src={it.customerImage} alt="Customer photo" className="w-14 h-14 object-cover rounded-lg border border-[#e1e3e5] shrink-0" />
                                    <div className="space-y-1 flex-1">
                                      <p className="text-[10px] font-black text-[#b98900] uppercase tracking-wide">Customer Uploaded Photo</p>
                                      <a
                                        href={it.customerImage}
                                        download={`photo_${ord.id}_item${idx + 1}.jpg`}
                                        className="inline-flex items-center gap-1.5 bg-[#000000] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#0066cc] transition cursor-pointer"
                                      >
                                        <Download className="w-3 h-3" /> Download Photo
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                      </>}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })()}

          {/* ===== CONTENT / SETTINGS ===== */}
          {activeTab === "settings" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-[#202223]">Content settings</h1>
                <p className="text-xs text-[#6d7175] mt-0.5">Manage your store branding, banners, announcements and phone models</p>
              </div>
              <div className="flex gap-0 border-b border-[#e1e3e5] overflow-x-auto">
                {[
                  ["branding","Branding"],
                  ["banners","Banners"],
                  ["announcements","Announcements"],
                  ["shipping","Shipping"],
                  ["promotions","Promotions"],
                  ["social","Social & Chat"],
                  ["storeconfig","Store Config"],
                  ["seo","SEO Tools"],
                ].map(([k,l]) => (
                  <button key={k} onClick={() => setSettingsSec(k as any)} className={`shrink-0 text-sm font-medium px-4 py-2.5 border-b-2 transition cursor-pointer ${settingsSec === k ? "border-[#000000] text-[#000000]" : "border-transparent text-[#6d7175] hover:text-[#202223]"}`}>{l}</button>
                ))}
              </div>

              {settingsSec === "branding" && (
                <form onSubmit={handleSaveLogoSettings} className="space-y-5 pt-2">

                  {/* Row 1: Brand Identity + Logo Image side by side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Brand Identity */}
                    <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                        <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                        <h3 className="font-semibold text-[#202223] text-sm">Brand identity</h3>
                      </div>
                      {[["Logo text", logoText, setLogoText, "FabCoverz"],["Tagline", logoSubtext, setLogoSubtext, "CUSTOM CASES"]].map(([label,val,setter,ph]: any) => (
                        <div key={label}>
                          <label className="block text-xs font-medium text-[#202223] mb-1">{label}</label>
                          <input type="text" value={val} onChange={e => setter(e.target.value)} placeholder={ph} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                        </div>
                      ))}
                    </div>

                    {/* Logo Image */}
                    <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                        <div className="w-2 h-2 rounded-full bg-[#2c6ecb]"></div>
                        <h3 className="font-semibold text-[#202223] text-sm">Logo image</h3>
                      </div>
                      {logoUrl ? (
                        <div className="flex items-center gap-3 p-3 border border-[#e1e3e5] rounded-xl bg-[#f6f6f7]">
                          <img src={logoUrl} alt="Logo preview" className="h-12 w-auto object-contain rounded-lg border border-[#e1e3e5] bg-white p-1" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#000000]">Logo set</p>
                            <p className="text-[10px] text-[#6d7175] truncate mt-0.5">{logoUrl.startsWith("https://") ? "Uploaded to CDN" : "URL saved"}</p>
                          </div>
                          <label className="text-xs font-medium text-[#2c6ecb] hover:underline cursor-pointer shrink-0">
                            Replace
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRawImageUpload(f, setLogoUrl); }} />
                          </label>
                          <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-[#d82c0d] hover:underline cursor-pointer shrink-0">Remove</button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center gap-3 border-2 border-dashed border-[#c9cccf] hover:border-[#458fff] hover:bg-[#eef2ff] rounded-xl p-5 cursor-pointer transition-all">
                          <div className="w-10 h-10 rounded-full bg-[#e8f0ff] flex items-center justify-center">
                            <Image className="w-5 h-5 text-[#2c6ecb]" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-[#202223]">Upload logo image</p>
                            <p className="text-xs text-[#6d7175] mt-0.5">PNG with transparency recommended · Max 5MB</p>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRawImageUpload(f, setLogoUrl); }} />
                        </label>
                      )}
                      <input type="text" value={logoUrl.startsWith("data:") ? "" : logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="or paste logo URL (https://...)" className="w-full mt-1.5 border border-[#c9cccf] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#458fff]" />
                    </div>
                  </div>

                  {/* Row 2: Contact Info (full width) */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Contact info</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[["Phone",contactPhone,setContactPhone,"required"],["Email",contactEmail,setContactEmail,"required"],["Address",contactAddress,setContactAddress,"required"],["Instagram URL",instagramUrl,setInstagramUrl,""],["Facebook URL",facebookUrl,setFacebookUrl,""]].map(([label,val,setter,req]: any) => (
                        <div key={label}>
                          <label className="block text-xs font-medium text-[#202223] mb-1">{label}</label>
                          <input type="text" required={!!req} value={val} onChange={e => setter(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 3: Reassurance Cards (full width, cards in a grid) */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#b98900]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Reassurance cards</h3>
                      <span className="text-xs text-[#6d7175] ml-1">— Shown as trust badges on the product page</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[[reassuranceCard1Title,setReassuranceCard1Title,reassuranceCard1Body,setReassuranceCard1Body,"Card 1"],[reassuranceCard2Title,setReassuranceCard2Title,reassuranceCard2Body,setReassuranceCard2Body,"Card 2"],[reassuranceCard3Title,setReassuranceCard3Title,reassuranceCard3Body,setReassuranceCard3Body,"Card 3"]].map(([t,st,b,sb,label]: any) => (
                        <div key={label} className="bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg p-4 space-y-2">
                          <p className="text-[11px] font-bold text-[#2c6ecb] uppercase tracking-wide">{label}</p>
                          <input required type="text" value={t} onChange={e => st(e.target.value)} placeholder="Heading" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" />
                          <textarea required rows={3} value={b} onChange={e => sb(e.target.value)} placeholder="Description" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center gap-2">
                      <Save className="w-4 h-4" /> Save branding settings
                    </button>
                  </div>
                </form>
              )}

              {settingsSec === "banners" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
                  <div className="lg:col-span-5">
                    <div className="bg-white border border-[#e1e3e5] rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e1e3e5]">
                        <h3 className="font-semibold text-[#202223]">{editingBanner ? "Edit banner" : "Add banner"}</h3>
                        {editingBanner && <button onClick={resetBannerForm} className="text-xs text-[#6d7175] cursor-pointer">Cancel</button>}
                      </div>
                      <form onSubmit={handleSaveBanner} className="space-y-3 text-sm">
                        <div>
                          <label className="block text-xs font-medium text-[#202223] mb-1">Desktop Banner Image</label>
                          {(banImageUrl.startsWith("data:") || banImageUrl.startsWith("http")) ? (
                            <div className="relative rounded-xl overflow-hidden border border-[#e1e3e5] bg-[#f6f6f7]">
                              <img src={banImageUrl} alt="Banner preview" className="w-full h-36 object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-2">
                                <label className="bg-white text-[#202223] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#f6f6f7] flex items-center gap-1.5">
                                  <RefreshCw className="w-3 h-3" /> Replace
                                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerImageUpload(f, setBanImageUrl); }} />
                                </label>
                                <button type="button" onClick={() => setBanImageUrl("")} className="bg-white text-[#d82c0d] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#fff4f4] flex items-center gap-1.5">
                                  <Trash2 className="w-3 h-3" /> Remove
                                </button>
                              </div>
                              <div className="absolute top-2 right-2 bg-[#000000] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Image set</div>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-[#c9cccf] hover:border-[#458fff] hover:bg-[#eef2ff] rounded-xl p-6 cursor-pointer transition-all">
                              <div className="w-10 h-10 rounded-full bg-[#e8f0ff] flex items-center justify-center">
                                <Image className="w-5 h-5 text-[#2c6ecb]" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-semibold text-[#202223]">Click to upload banner</p>
                                <p className="text-xs text-[#6d7175] mt-0.5">JPG, PNG, WEBP · Max 5MB</p>
                              </div>
                              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerImageUpload(f, setBanImageUrl); }} />
                            </label>
                          )}
                          <input type="text" value={banImageUrl.startsWith("data:") ? "" : banImageUrl} onChange={e => setBanImageUrl(e.target.value)} placeholder="or paste image URL (https://...)" className="w-full mt-1.5 border border-[#c9cccf] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#458fff]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#202223] mb-1">Mobile Banner Image <span className="text-[#8c9196] font-normal">(shown on phones — if empty, desktop image is used)</span></label>
                          {(banMobileImageUrl.startsWith("data:") || banMobileImageUrl.startsWith("http")) ? (
                            <div className="relative rounded-xl overflow-hidden border border-[#e1e3e5] bg-[#f6f6f7]">
                              <img src={banMobileImageUrl} alt="Mobile banner preview" className="w-full h-36 object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-2">
                                <label className="bg-white text-[#202223] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#f6f6f7] flex items-center gap-1.5">
                                  <RefreshCw className="w-3 h-3" /> Replace
                                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerImageUpload(f, setBanMobileImageUrl); }} />
                                </label>
                                <button type="button" onClick={() => setBanMobileImageUrl("")} className="bg-white text-[#d82c0d] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#fff4f4] flex items-center gap-1.5">
                                  <Trash2 className="w-3 h-3" /> Remove
                                </button>
                              </div>
                              <div className="absolute top-2 right-2 bg-[#000000] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Image set</div>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-[#c9cccf] hover:border-[#458fff] hover:bg-[#eef2ff] rounded-xl p-6 cursor-pointer transition-all">
                              <div className="w-10 h-10 rounded-full bg-[#e8f0ff] flex items-center justify-center">
                                <Image className="w-5 h-5 text-[#2c6ecb]" />
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-semibold text-[#202223]">Click to upload mobile banner</p>
                                <p className="text-xs text-[#6d7175] mt-0.5">JPG, PNG, WEBP · Max 5MB</p>
                              </div>
                              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerImageUpload(f, setBanMobileImageUrl); }} />
                            </label>
                          )}
                          <input type="text" value={banMobileImageUrl.startsWith("data:") ? "" : banMobileImageUrl} onChange={e => setBanMobileImageUrl(e.target.value)} placeholder="or paste image URL (https://...)" className="w-full mt-1.5 border border-[#c9cccf] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#458fff]" />
                        </div>
                        <button type="submit" className="w-full bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold py-2.5 rounded-lg transition cursor-pointer">{editingBanner ? "Save changes" : "Add banner"}</button>
                      </form>
                    </div>
                  </div>
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="font-semibold text-[#202223]">Active banners ({banners.length})</h3>
                    <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden divide-y divide-[#f1f1f1]">
                      {banners.length === 0 ? <div className="text-center py-10"><Image className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" /><p className="text-sm text-[#6d7175]">No banners yet</p></div> : banners.map(b => (
                        <div key={b.id} className="flex items-center gap-3 p-4 hover:bg-[#fafafa]">
                          <div className="w-16 h-10 bg-[#f6f6f7] rounded-lg overflow-hidden border border-[#e1e3e5] shrink-0"><img src={b.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#202223] truncate">{b.title}</p>
                            <p className="text-xs text-[#6d7175] truncate">{b.link} · Order {b.order}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => handleEditBannerClick(b)} className="p-1.5 text-[#6d7175] hover:text-[#2c6ecb] hover:bg-[#f4f8ff] rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteBanner(b.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {settingsSec === "announcements" && (
                <div className="max-w-2xl space-y-4 pt-5">
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Header announcements</h3>
                      <span className="text-xs text-[#6d7175] ml-1">— Displayed in the top announcement bar</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="e.g. Code FLASH75: Get 75% off today!" className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      <button onClick={handleAddAnnouncement} className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"><Plus className="w-4 h-4" />Add</button>
                    </div>
                    <div className="space-y-2">
                      {settings?.announcements.map(ann => (
                        <div key={ann.id} className="flex items-center justify-between bg-[#f6f6f7] border border-[#e1e3e5] rounded-lg px-4 py-2.5">
                          <span className="text-sm font-medium text-[#202223]">{ann.text}</span>
                          <button onClick={() => handleRemoveAnnouncement(ann.id)} className="text-[#6d7175] hover:text-[#d82c0d] p-1 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Phone Models moved to dedicated top-level tab in sidebar */}

              {/* ===== SHIPPING ===== */}
              {settingsSec === "shipping" && (
                <div className="space-y-5 pt-2 max-w-2xl">
                  {/* Free Shipping Threshold */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Free Shipping</h3>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#202223] mb-1">Free shipping threshold (₹)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#6d7175] font-semibold">₹</span>
                        <input type="number" value={ceFreeShipping} onChange={e => setCeFreeShipping(Number(e.target.value))} min={0} className="w-40 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      </div>
                      <p className="text-xs text-[#6d7175] mt-1">Orders above this amount get free shipping. Set 0 to always show free shipping.</p>
                    </div>
                  </div>

                  {/* COD & Delivery */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Cash on Delivery & Delivery Info</h3>
                    </div>
                    <div className="flex items-center justify-between bg-[#f6f6f7] border border-[#e1e3e5] rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#202223]">Cash on Delivery (COD)</p>
                        <p className="text-xs text-[#6d7175] mt-0.5">Allow customers to pay on delivery</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCodEnabled(!codEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${codEnabled ? "bg-[#000000]" : "bg-[#c9cccf]"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${codEnabled ? "left-6" : "left-1"}`}></span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#202223] mb-1">Delivery message (shown on product page)</label>
                      <input type="text" value={deliveryMessage} onChange={e => setDeliveryMessage(e.target.value)} placeholder="Delivered in 3-5 business days" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#202223] mb-1">Estimated delivery days</label>
                      <input type="text" value={estimatedDeliveryDays} onChange={e => setEstimatedDeliveryDays(e.target.value)} placeholder="3-5" className="w-40 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={handleSaveShipping} className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center gap-2">
                      <Save className="w-4 h-4" /> Save Shipping Settings
                    </button>
                  </div>
                </div>
              )}

              {/* ===== PROMOTIONS / COUPONS ===== */}
              {settingsSec === "promotions" && (
                <div className="space-y-5 pt-2">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Add Coupon Form */}
                    <div className="lg:col-span-5">
                      <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                          <div className="w-2 h-2 rounded-full bg-[#b98900]"></div>
                          <h3 className="font-semibold text-[#202223] text-sm">Create Coupon Code</h3>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#202223] mb-1">Coupon Code</label>
                          <input type="text" value={cpCode} onChange={e => setCpCode(e.target.value.toUpperCase())} placeholder="FLASH75" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20 uppercase" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#202223] mb-1">Discount Type</label>
                            <select value={cpType} onChange={e => setCpType(e.target.value as any)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] bg-white cursor-pointer">
                              <option value="percent">Percent (%)</option>
                              <option value="flat">Flat (₹)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#202223] mb-1">Discount Value</label>
                            <input type="number" value={cpValue} onChange={e => setCpValue(Number(e.target.value))} min={1} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#202223] mb-1">Min Order (₹) <span className="text-[#8c9196] font-normal">optional</span></label>
                            <input type="number" value={cpMinOrder} onChange={e => setCpMinOrder(Number(e.target.value))} min={0} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#202223] mb-1">Max Uses <span className="text-[#8c9196] font-normal">0 = unlimited</span></label>
                            <input type="number" value={cpMaxUses} onChange={e => setCpMaxUses(Number(e.target.value))} min={0} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#202223] mb-1">Expiry Date <span className="text-[#8c9196] font-normal">optional</span></label>
                          <input type="date" value={cpExpiry} onChange={e => setCpExpiry(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" />
                        </div>
                        <button onClick={handleAddCoupon} className="w-full bg-[#b98900] hover:bg-[#9a7400] text-white text-sm font-semibold py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-2">
                          <Plus className="w-4 h-4" /> Create Coupon
                        </button>
                      </div>
                    </div>

                    {/* Coupons List */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[#202223]">Active coupons ({coupons.filter(c => c.active).length}/{coupons.length})</h3>
                      </div>
                      <div className="bg-white border border-[#e1e3e5] rounded-xl overflow-hidden divide-y divide-[#f1f1f1]">
                        {coupons.length === 0 ? (
                          <div className="text-center py-12">
                            <Tag className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" />
                            <p className="text-sm text-[#6d7175]">No coupons yet — create your first one</p>
                          </div>
                        ) : coupons.map(cp => (
                          <div key={cp.id} className={`flex items-center gap-3 p-4 ${!cp.active ? "opacity-50" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-[#202223] bg-[#f6f6f7] px-2 py-0.5 rounded">{cp.code}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cp.active ? "bg-emerald-100 text-emerald-700" : "bg-[#f6f6f7] text-[#6d7175]"}`}>{cp.active ? "Active" : "Paused"}</span>
                              </div>
                              <p className="text-xs text-[#6d7175] mt-1">
                                {cp.discountType === "percent" ? `${cp.discountValue}% off` : `₹${cp.discountValue} off`}
                                {cp.minOrder ? ` · Min ₹${cp.minOrder}` : ""}
                                {cp.maxUses ? ` · ${cp.usedCount || 0}/${cp.maxUses} used` : ""}
                                {cp.expiresAt ? ` · Expires ${cp.expiresAt}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => handleToggleCoupon(cp.id)} className={`p-1.5 rounded-lg cursor-pointer transition text-xs font-semibold px-2 ${cp.active ? "bg-[#f6f6f7] text-[#6d7175] hover:bg-[#e1e3e5]" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>{cp.active ? "Pause" : "Enable"}</button>
                              <button onClick={() => handleDeleteCoupon(cp.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== SOCIAL & CHAT ===== */}
              {settingsSec === "social" && (
                <div className="space-y-5 pt-2 max-w-2xl">
                  {/* WhatsApp */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">WhatsApp Chat Widget</h3>
                    </div>
                    <div className="flex items-center justify-between bg-[#f6f6f7] border border-[#e1e3e5] rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#202223]">WhatsApp Chat Button</p>
                        <p className="text-xs text-[#6d7175] mt-0.5">Show floating WhatsApp button on storefront</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${whatsappEnabled ? "bg-emerald-500" : "bg-[#c9cccf]"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${whatsappEnabled ? "left-6" : "left-1"}`}></span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#202223] mb-1">WhatsApp Number (with country code)</label>
                      <input type="text" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="+917418152926" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      <p className="text-xs text-[#6d7175] mt-1">Include + and country code, no spaces (e.g. +917418152926)</p>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Social Media Links</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Instagram URL</label>
                        <input type="url" value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/fabcoverz.store" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Facebook URL</label>
                        <input type="url" value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/fabcoverz" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Twitter / X URL <span className="text-[#8c9196] font-normal">optional</span></label>
                        <input type="url" value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)} placeholder="https://x.com/fabcoverz" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">YouTube URL <span className="text-[#8c9196] font-normal">optional</span></label>
                        <input type="url" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@fabcoverz" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={handleSaveSocial} className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center gap-2">
                      <Save className="w-4 h-4" /> Save Social Settings
                    </button>
                  </div>
                </div>
              )}

              {/* ===== STORE CONFIG ===== */}
              {settingsSec === "storeconfig" && (
                <div className="space-y-5 pt-2 max-w-2xl">
                  {/* Maintenance Mode */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#d82c0d]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Maintenance Mode</h3>
                    </div>
                    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${maintenanceMode ? "bg-red-50 border-red-200" : "bg-[#f6f6f7] border-[#e1e3e5]"}`}>
                      <div>
                        <p className="text-sm font-semibold text-[#202223]">Maintenance Mode</p>
                        <p className="text-xs text-[#6d7175] mt-0.5">{maintenanceMode ? "Store is OFFLINE — customers see maintenance page" : "Store is live and accepting orders"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMaintenanceMode(!maintenanceMode)}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${maintenanceMode ? "bg-[#d82c0d]" : "bg-[#c9cccf]"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${maintenanceMode ? "left-6" : "left-1"}`}></span>
                      </button>
                    </div>
                    {maintenanceMode && (
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Maintenance Message</label>
                        <textarea rows={2} value={maintenanceMessage} onChange={e => setMaintenanceMessage(e.target.value)} placeholder="We are updating our store. Back shortly!" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none" />
                      </div>
                    )}
                  </div>

                  {/* Currency & Tax */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#2c6ecb]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Currency & Tax</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">Currency Symbol</label>
                        <input type="text" value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} placeholder="₹" maxLength={3} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#202223] mb-1">GST / Tax Rate (%)</label>
                        <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} min={0} max={100} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                        <p className="text-xs text-[#6d7175] mt-1">Set 0 if prices are already inclusive of tax</p>
                      </div>
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-[#b98900]"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Store Timezone</h3>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#202223] mb-1">Timezone</label>
                      <select value={storeTimezone} onChange={e => setStoreTimezone(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] bg-white cursor-pointer">
                        <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                      <p className="text-xs text-[#6d7175] mt-1">Used for order timestamps and analytics reports</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={handleSaveStoreConfig} className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center gap-2">
                      <Save className="w-4 h-4" /> Save Store Config
                    </button>
                  </div>
                </div>
              )}

              {settingsSec === "seo" && (
                <div className="space-y-5 pt-5">

                  {/* ── Dynamic Homepage SEO ── */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#f1f1f1]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                        <h3 className="font-semibold text-[#202223] text-sm">Homepage SEO — Title & Meta</h3>
                      </div>
                      <button onClick={handleSaveSEOSettings} className="bg-[#000000] hover:bg-[#0052cc] text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5">
                        <Save className="w-3 h-3" /> Save SEO
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6d7175] mb-1">Homepage Title Tag <span className="text-zinc-400">(Google search result title)</span></label>
                      <input
                        type="text"
                        value={seoHomeTitle}
                        onChange={e => setSeoHomeTitle(e.target.value)}
                        placeholder="FabCoverz – Custom Phone Cases India | Murugan, TVK, Photo Cases Online"
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]"
                        maxLength={70}
                      />
                      <p className="text-[11px] text-[#6d7175] mt-1">{seoHomeTitle.length}/70 chars. Leave empty to use default.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6d7175] mb-1">Homepage Meta Description <span className="text-zinc-400">(shown under title in Google)</span></label>
                      <textarea
                        rows={3}
                        value={seoHomeDescription}
                        onChange={e => setSeoHomeDescription(e.target.value)}
                        placeholder="Buy premium custom phone cases in India at FabCoverz. Murugan cases, TVK Vijay cases, photo print covers..."
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none"
                        maxLength={160}
                      />
                      <p className="text-[11px] text-[#6d7175] mt-1">{seoHomeDescription.length}/160 chars. Aim for 120–160.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#6d7175] mb-1">Homepage Keywords <span className="text-zinc-400">(comma separated, for internal tracking)</span></label>
                      <input
                        type="text"
                        value={seoHomeKeywords}
                        onChange={e => setSeoHomeKeywords(e.target.value)}
                        placeholder="murugan phone case, TVK vijay case, custom phone cover India..."
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]"
                      />
                    </div>
                  </div>

                  {/* ── Per-Collection SEO Overrides ── */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#f1f1f1]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <h3 className="font-semibold text-[#202223] text-sm">Collection SEO Overrides</h3>
                      </div>
                      <button onClick={handleSaveSEOSettings} className="bg-[#000000] hover:bg-[#0052cc] text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5">
                        <Save className="w-3 h-3" /> Save SEO
                      </button>
                    </div>
                    <p className="text-xs text-[#6d7175]">Override the default SEO title and description for any collection. Leave blank to use the built-in defaults.</p>
                    {collections.length === 0 && <p className="text-xs text-[#6d7175] italic">No collections found.</p>}
                    <div className="space-y-4">
                      {collections.map(col => (
                        <div key={col.slug} className="border border-[#e1e3e5] rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#202223] uppercase tracking-wide">{col.name}</span>
                            <span className="text-[10px] text-[#6d7175] bg-zinc-100 px-2 py-0.5 rounded font-mono">/collections/{col.slug}</span>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6d7175] mb-1">Title</label>
                            <input
                              type="text"
                              value={seoCollectionOverrides[col.slug]?.title ?? ""}
                              onChange={e => setSeoCollectionOverrides(prev => ({
                                ...prev,
                                [col.slug]: { ...prev[col.slug], title: e.target.value }
                              }))}
                              placeholder={`${col.name} – Buy Online India | FabCoverz`}
                              className="w-full border border-[#c9cccf] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#458fff]"
                              maxLength={70}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6d7175] mb-1">Meta Description</label>
                            <textarea
                              rows={2}
                              value={seoCollectionOverrides[col.slug]?.description ?? ""}
                              onChange={e => setSeoCollectionOverrides(prev => ({
                                ...prev,
                                [col.slug]: { ...prev[col.slug], description: e.target.value }
                              }))}
                              placeholder={`Shop the best ${col.name} phone cases in India...`}
                              className="w-full border border-[#c9cccf] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#458fff] resize-none"
                              maxLength={160}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#6d7175] mb-1">Keywords</label>
                            <input
                              type="text"
                              value={seoCollectionOverrides[col.slug]?.keywords ?? ""}
                              onChange={e => setSeoCollectionOverrides(prev => ({
                                ...prev,
                                [col.slug]: { ...prev[col.slug], keywords: e.target.value }
                              }))}
                              placeholder={`${col.name} phone case India, buy ${col.name} online...`}
                              className="w-full border border-[#c9cccf] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#458fff]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Google Merchant Feed ── */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Google Merchant Center Feed</h3>
                    </div>
                    <p className="text-xs text-[#6d7175] leading-relaxed">
                      Download a Google Merchant Center XML product feed. Submit this at{" "}
                      <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="text-[#000000] underline">merchants.google.com</a>
                      {" "}→ Products → Feeds to get your products listed in Google Shopping results.
                    </p>
                    <button
                      onClick={async () => {
                        if (products.length === 0) {
                          alert("Products still loading — wait a few seconds and try again.");
                          return;
                        }
                        const { downloadMerchantFeed } = await import("../utils/generateMerchantFeed");
                        downloadMerchantFeed(products);
                      }}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Download Product Feed XML
                      {products.length > 0 && <span className="ml-1 bg-emerald-500 px-1.5 py-0.5 rounded text-xs">{products.length} products</span>}
                    </button>
                  </div>

                  {/* ── Google Search Console Links ── */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">Google Search Console — Quick Links</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { label: "Submit Sitemap", url: "https://search.google.com/search-console/sitemaps", desc: "Submit fabcoverz.store/sitemap.xml" },
                        { label: "URL Inspection", url: "https://search.google.com/search-console/inspect", desc: "Request indexing for new pages" },
                        { label: "Performance Report", url: "https://search.google.com/search-console/performance/search-analytics", desc: "See which keywords bring traffic" },
                        { label: "Rich Results Test", url: "https://search.google.com/test/rich-results", desc: "Test FAQ & Product schema" },
                      ].map(item => (
                        <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col gap-1 border border-[#e1e3e5] rounded-lg p-3 hover:border-[#000000] transition group">
                          <span className="text-sm font-semibold text-[#000000] group-hover:underline">{item.label}</span>
                          <span className="text-xs text-[#6d7175]">{item.desc}</span>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* ── SEO Checklist ── */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <h3 className="font-semibold text-[#202223] text-sm">SEO Checklist</h3>
                    </div>
                    {[
                      { done: true,  text: "index.html — title, meta description, OG tags [Done]" },
                      { done: true,  text: "Dynamic useSEO.ts — per-page title & keywords [Done]" },
                      { done: true,  text: "Admin-editable homepage & collection SEO meta [Done]" },
                      { done: true,  text: "sitemap.xml — all pages + product URLs [Done]" },
                      { done: true,  text: "robots.txt — crawl rules set [Done]" },
                      { done: true,  text: "FAQ JSON-LD schema on homepage [Done]" },
                      { done: true,  text: "Collection page SEO content + FAQ schema [Done]" },
                      { done: true,  text: "Product JSON-LD schema [Done]" },
                      { done: false, text: "Google Search Console — submit sitemap (do this now!)" },
                      { done: false, text: "Google Merchant Center — submit product feed XML" },
                      { done: false, text: "Request Indexing for: /, /collections, /collections/god-cases, /collections/tvk-cases" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 text-sm ${item.done ? "text-emerald-500" : "text-orange-400"}`}>{item.done ? "Done" : "Pending"}</span>
                        <span className={`text-xs ${item.done ? "text-[#6d7175]" : "text-[#202223] font-semibold"}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ===== WEBSITE CONTENT EDITOR ===== */}
          {activeTab === "content_editor" && (
            <form onSubmit={handleSaveContentEditor} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[#202223]">Website Content Editor</h1>
                  <p className="text-sm text-[#6d7175] mt-0.5">Edit every text section visible on your website</p>
                </div>
                <button type="submit" className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save All Content
                </button>
              </div>

              {/* About Section */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">About / Brand Story Section</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Badge Text</label><input type="text" value={ceAboutBadge} onChange={e => setCeAboutBadge(e.target.value)} placeholder="OUR BRAND STORY" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Section Title</label><input type="text" value={ceAboutTitle} onChange={e => setCeAboutTitle(e.target.value)} placeholder="Premium Durability Meets Modern Aesthetics" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                </div>
                <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Subtitle</label><input type="text" value={ceAboutSubtitle} onChange={e => setCeAboutSubtitle(e.target.value)} placeholder="At FabCoverz, we believe your phone is an extension of your personality..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Paragraph 1</label><textarea rows={2} value={ceAboutDesc1} onChange={e => setCeAboutDesc1(e.target.value)} placeholder="Based proudly in Chennai, India..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none" /></div>
                <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Paragraph 2</label><textarea rows={2} value={ceAboutDesc2} onChange={e => setCeAboutDesc2(e.target.value)} placeholder="Standard order processing takes 24 hours..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none" /></div>
              </div>

              {/* Trending Section */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#2c6ecb]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Trending Now Section (Homepage)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Section Title</label><input type="text" value={ceTrendingTitle} onChange={e => setCeTrendingTitle(e.target.value)} placeholder="Trending Now" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Subtitle</label><input type="text" value={ceTrendingSubtitle} onChange={e => setCeTrendingSubtitle(e.target.value)} placeholder="Highly requested collections" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                </div>
              </div>

              {/* Bestseller Section */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#b98900]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Bestseller Products Section (Homepage)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Badge</label><input type="text" value={ceBestsellerBadge} onChange={e => setCeBestsellerBadge(e.target.value)} placeholder="EXCLUSIVE DESIGN CATALOG" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Title</label><input type="text" value={ceBestsellerTitle} onChange={e => setCeBestsellerTitle(e.target.value)} placeholder="Bestselling Metal Glossy Cases" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Subtitle</label><input type="text" value={ceBestsellerSubtitle} onChange={e => setCeBestsellerSubtitle(e.target.value)} placeholder="Symmetric triple protection lens grids..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                </div>
              </div>

              {/* Reviews Section */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#8c50ff]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Customer Reviews Section</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Badge</label><input type="text" value={ceReviewsBadge} onChange={e => setCeReviewsBadge(e.target.value)} placeholder="COMMUNITY LOVE" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Title</label><input type="text" value={ceReviewsTitle} onChange={e => setCeReviewsTitle(e.target.value)} placeholder="Verified Customer Reviews" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Subtitle</label><input type="text" value={ceReviewsSubtitle} onChange={e => setCeReviewsSubtitle(e.target.value)} placeholder="See what our 45,000+ customers say..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                </div>
              </div>

              {/* Contact Section */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#d82c0d]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Contact / Support Section</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Badge</label><input type="text" value={ceContactBadge} onChange={e => setCeContactBadge(e.target.value)} placeholder="SUPPORT ASSISTANCE" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Title</label><input type="text" value={ceContactTitle} onChange={e => setCeContactTitle(e.target.value)} placeholder="Get In Touch With Support" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Subtitle</label><input type="text" value={ceContactSubtitle} onChange={e => setCeContactSubtitle(e.target.value)} placeholder="Have any questions about compatible models..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                </div>
              </div>

              {/* Newsletter Section */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Newsletter Section (Bottom of Homepage)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Badge</label><input type="text" value={ceNewsletterBadge} onChange={e => setCeNewsletterBadge(e.target.value)} placeholder="UNLOCK EXCLUSIVE DROPS" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                  <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Title</label><input type="text" value={ceNewsletterTitle} onChange={e => setCeNewsletterTitle(e.target.value)} placeholder="Subscribe & Save 10% On Your First Cover" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                </div>
                <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Subtitle</label><textarea rows={2} value={ceNewsletterSubtitle} onChange={e => setCeNewsletterSubtitle(e.target.value)} placeholder="Join 45,000+ custom cover collectors!..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none" /></div>
                <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Disclaimer Text</label><input type="text" value={ceNewsletterDisclaimer} onChange={e => setCeNewsletterDisclaimer(e.target.value)} placeholder="Unsubscribe instantly at any time. No spam..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
              </div>

              {/* Top Selling Section — Drag & Drop Picker */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#000000]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Top Selling Products (Scroll Section)</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6d7175] mb-1">Section Title</label>
                  <input type="text" value={ceTopSellingTitle} onChange={e => setCeTopSellingTitle(e.target.value)} placeholder="Top Selling Products" className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6d7175] mb-1">
                    Selected Products ({topSellingList.length}/16) — Drag to reorder, click × to remove
                  </label>
                  {/* Selected list */}
                  <div className="space-y-1.5 mb-3 min-h-[40px]">
                    {topSellingList.length === 0 && (
                      <p className="text-[11px] text-[#6d7175] italic">No products selected. Auto-shows bestsellers/trending.</p>
                    )}
                    {topSellingList.map((prod, idx) => (
                      <div
                        key={prod.id}
                        draggable
                        onDragStart={() => setDragTopIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); setDragTopOver(idx); }}
                        onDrop={() => {
                          if (dragTopIdx === null || dragTopIdx === idx) { setDragTopIdx(null); setDragTopOver(null); return; }
                          const reordered = [...topSellingList];
                          const [moved] = reordered.splice(dragTopIdx, 1);
                          reordered.splice(idx, 0, moved);
                          setTopSellingList(reordered);
                          setDragTopIdx(null); setDragTopOver(null);
                        }}
                        onDragEnd={() => { setDragTopIdx(null); setDragTopOver(null); }}
                        className={`flex items-center gap-2 bg-[#f9f9f9] border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all ${dragTopOver === idx && dragTopIdx !== idx ? "border-[#000000] bg-[#f0f7ff] shadow-md" : "border-[#e1e3e5]"} ${dragTopIdx === idx ? "opacity-40" : "opacity-100"}`}
                      >
                        <span className="text-[#6d7175] text-xs select-none">⠿⠿</span>
                        <span className="w-5 h-5 rounded-full bg-[#000000]/10 text-[#000000] text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        {prod.images?.[0] && (prod.images[0].startsWith("http") || prod.images[0].startsWith("data:")) ? (
                          <img src={prod.images[0]} alt={prod.title} className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0"><Package2 className="w-4 h-4 text-zinc-400" /></div>}
                        <span className="text-xs font-semibold text-[#202223] flex-1 truncate">{prod.title}</span>
                        <span className="text-xs font-bold text-zinc-500">₹{prod.price}</span>
                        <button type="button" onClick={() => setTopSellingList(topSellingList.filter(p => p.id !== prod.id))} className="text-red-400 hover:text-red-600 text-sm font-bold ml-1 cursor-pointer bg-transparent border-none">×</button>
                      </div>
                    ))}
                  </div>
                  {/* Product search & add */}
                  {topSellingList.length < 16 && (
                    <div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={topSellingSearch}
                          onChange={e => setTopSellingSearch(e.target.value)}
                          placeholder="Search by name..."
                          className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]"
                        />
                        <select
                          value={topSellingSearch.startsWith("__col:") ? topSellingSearch : ""}
                          onChange={e => setTopSellingSearch(e.target.value ? `__col:${e.target.value}` : "")}
                          className="border border-[#c9cccf] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#458fff] bg-white"
                        >
                          <option value="">All Collections</option>
                          {collections.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="max-h-64 overflow-y-auto border border-[#e1e3e5] rounded-lg bg-[#f6f6f7]">
                        {(() => {
                          const isColFilter = topSellingSearch.startsWith("__col:");
                          const colSlug = isColFilter ? topSellingSearch.replace("__col:", "") : "";
                          return products
                            .filter(p => !topSellingList.find(s => s.id === p.id))
                            .filter(p => isColFilter ? p.collectionId === colSlug : (!topSellingSearch || p.title.toLowerCase().includes(topSellingSearch.toLowerCase())))
                            .map(p => {
                              const colName = collections.find(c => c.slug === p.collectionId)?.name || p.collectionId;
                              return (
                                <button key={p.id} type="button" onClick={() => { if (topSellingList.length < 16) setTopSellingList([...topSellingList, p]); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white text-left border-b border-[#e1e3e5] last:border-0 cursor-pointer transition-colors">
                                  {p.images?.[0] && (p.images[0].startsWith("http") || p.images[0].startsWith("data:")) ? (
                                    <img src={p.images[0]} alt={p.title} className="w-7 h-7 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                                  ) : <div className="w-7 h-7 rounded bg-zinc-200 flex items-center justify-center shrink-0"><Package2 className="w-3.5 h-3.5 text-zinc-400" /></div>}
                                  <span className="text-xs font-medium text-[#202223] flex-1 truncate">{p.title}</span>
                                  <span className="text-[9px] bg-[#e9f3ff] text-[#000000] px-1.5 py-0.5 rounded font-semibold shrink-0">{colName}</span>
                                  <span className="text-[10px] text-[#6d7175]">₹{p.price}</span>
                                  <span className="text-[#000000] text-xs font-bold ml-1">+</span>
                                </button>
                              );
                            });
                        })()}
                      </div>
                    </div>
                  )}
                  {topSellingList.length >= 16 && <p className="text-[11px] text-amber-600 font-semibold">Maximum 16 products reached.</p>}
                </div>
              </div>

              {/* Best Selling Metal Glossy Products — Drag & Drop Picker */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Best Selling Metal Glossy Products (Homepage Grid)</h3>
                </div>
                <p className="text-[11px] text-[#6d7175]">These products appear in the homepage "Bestselling Metal Glossy Cases" grid. Max 16. Drag to reorder.</p>
                <div>
                  <label className="block text-xs font-medium text-[#6d7175] mb-1">
                    Selected Products ({bestMetalList.length}/16) — Drag to reorder, click × to remove
                  </label>
                  {/* Selected list */}
                  <div className="space-y-1.5 mb-3 min-h-[40px]">
                    {bestMetalList.length === 0 && (
                      <p className="text-[11px] text-[#6d7175] italic">No products selected. Auto-shows first 8 products.</p>
                    )}
                    {bestMetalList.map((prod, idx) => (
                      <div
                        key={prod.id}
                        draggable
                        onDragStart={() => setDragMetalIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); setDragMetalOver(idx); }}
                        onDrop={() => {
                          if (dragMetalIdx === null || dragMetalIdx === idx) { setDragMetalIdx(null); setDragMetalOver(null); return; }
                          const reordered = [...bestMetalList];
                          const [moved] = reordered.splice(dragMetalIdx, 1);
                          reordered.splice(idx, 0, moved);
                          setBestMetalList(reordered);
                          setDragMetalIdx(null); setDragMetalOver(null);
                        }}
                        onDragEnd={() => { setDragMetalIdx(null); setDragMetalOver(null); }}
                        className={`flex items-center gap-2 bg-[#f9f9f9] border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-all ${dragMetalOver === idx && dragMetalIdx !== idx ? "border-amber-400 bg-amber-50 shadow-md" : "border-[#e1e3e5]"} ${dragMetalIdx === idx ? "opacity-40" : "opacity-100"}`}
                      >
                        <span className="text-[#6d7175] text-xs select-none">⠿⠿</span>
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        {prod.images?.[0] && (prod.images[0].startsWith("http") || prod.images[0].startsWith("data:")) ? (
                          <img src={prod.images[0]} alt={prod.title} className="w-8 h-8 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0"><Package2 className="w-4 h-4 text-zinc-400" /></div>}
                        <span className="text-xs font-semibold text-[#202223] flex-1 truncate">{prod.title}</span>
                        <span className="text-xs font-bold text-zinc-500">₹{prod.price}</span>
                        <button type="button" onClick={() => setBestMetalList(bestMetalList.filter(p => p.id !== prod.id))} className="text-red-400 hover:text-red-600 text-sm font-bold ml-1 cursor-pointer bg-transparent border-none">×</button>
                      </div>
                    ))}
                  </div>
                  {/* Product search & add */}
                  {bestMetalList.length < 16 && (
                    <div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={bestMetalSearch}
                          onChange={e => setBestMetalSearch(e.target.value)}
                          placeholder="Search by name..."
                          className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]"
                        />
                        <select
                          value={bestMetalSearch.startsWith("__col:") ? bestMetalSearch : ""}
                          onChange={e => setBestMetalSearch(e.target.value ? `__col:${e.target.value}` : "")}
                          className="border border-[#c9cccf] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#458fff] bg-white"
                        >
                          <option value="">All Collections</option>
                          {collections.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="max-h-64 overflow-y-auto border border-[#e1e3e5] rounded-lg bg-[#f6f6f7]">
                        {(() => {
                          const isColFilter = bestMetalSearch.startsWith("__col:");
                          const colSlug = isColFilter ? bestMetalSearch.replace("__col:", "") : "";
                          return products
                            .filter(p => !bestMetalList.find(s => s.id === p.id))
                            .filter(p => isColFilter ? p.collectionId === colSlug : (!bestMetalSearch || p.title.toLowerCase().includes(bestMetalSearch.toLowerCase())))
                            .map(p => {
                              const colName = collections.find(c => c.slug === p.collectionId)?.name || p.collectionId;
                              return (
                                <button key={p.id} type="button" onClick={() => { if (bestMetalList.length < 16) setBestMetalList([...bestMetalList, p]); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white text-left border-b border-[#e1e3e5] last:border-0 cursor-pointer transition-colors">
                                  {p.images?.[0] && (p.images[0].startsWith("http") || p.images[0].startsWith("data:")) ? (
                                    <img src={p.images[0]} alt={p.title} className="w-7 h-7 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                                  ) : <div className="w-7 h-7 rounded bg-zinc-200 flex items-center justify-center shrink-0"><Package2 className="w-3.5 h-3.5 text-zinc-400" /></div>}
                                  <span className="text-xs font-medium text-[#202223] flex-1 truncate">{p.title}</span>
                                  <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-semibold shrink-0">{colName}</span>
                                  <span className="text-[10px] text-[#6d7175]">₹{p.price}</span>
                                  <span className="text-amber-500 text-xs font-bold ml-1">+</span>
                                </button>
                              );
                            });
                        })()}
                      </div>
                    </div>
                  )}
                  {bestMetalList.length >= 16 && <p className="text-[11px] text-amber-600 font-semibold">Maximum 16 products reached.</p>}
                </div>
              </div>

              {/* Reorder moved to Collections tab */}
              <div className="bg-[#f0f7ff] border border-[#d4e0fc] rounded-xl p-4 flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-[#2c6ecb] shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#202223]">Collection & Product Reorder Settings</p>
                  <p className="text-xs text-[#6d7175] mt-0.5">Reorder settings moved to the <strong>Collections</strong> tab for easy access.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("collections")}
                  className="text-xs font-bold text-white bg-[#2c6ecb] hover:bg-[#1f5ab5] px-4 py-2 rounded-lg transition cursor-pointer shrink-0"
                >
                  Go to Collections →
                </button>
              </div>

              {/* Footer & Misc */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#f1f1f1]">
                  <div className="w-2 h-2 rounded-full bg-[#6d7175]"></div>
                  <h3 className="font-semibold text-[#202223] text-sm">Footer & Store Settings</h3>
                </div>
                <div><label className="block text-xs font-medium text-[#6d7175] mb-1">Footer Brand Description</label><textarea rows={2} value={ceFooterDisclaimer} onChange={e => setCeFooterDisclaimer(e.target.value)} placeholder="India's leading e-commerce hub for premium Metal Glossy Cases..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] resize-none" /></div>
                <div className="max-w-xs"><label className="block text-xs font-medium text-[#6d7175] mb-1">Free Shipping Threshold (₹)</label><input type="number" value={ceFreeShipping} onChange={e => setCeFreeShipping(Number(e.target.value))} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
              </div>

              <div className="pb-6">
                <button type="submit" className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-8 py-3 rounded-lg transition cursor-pointer flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save All Website Content
                </button>
              </div>
            </form>
          )}

          {/* ===== FAQs ===== */}
          {activeTab === "faqs" && (
            <div className="space-y-5">
              <h1 className="text-xl font-bold text-[#202223]">FAQs</h1>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-[#202223] text-sm">{editingFaq ? "Edit FAQ" : "Add FAQ"}</h3>
                  <form onSubmit={handleSaveFaq} className="space-y-3 text-sm">
                    <div><label className="block text-xs font-medium text-[#202223] mb-1">Question</label><input type="text" required value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)} placeholder="Customer question..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" /></div>
                    <div><label className="block text-xs font-medium text-[#202223] mb-1">Answer</label><textarea required rows={4} value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} placeholder="Detailed answer..." className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"></textarea></div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold py-2 rounded-lg transition cursor-pointer">{editingFaq ? "Update" : "Publish"}</button>
                      {editingFaq && <button type="button" onClick={() => { setEditingFaq(null); setFaqQuestion(""); setFaqAnswer(""); }} className="px-4 border border-[#e1e3e5] text-[#6d7175] text-sm rounded-lg cursor-pointer">Cancel</button>}
                    </div>
                  </form>
                </div>
                <div className="lg:col-span-2 space-y-3">
                  <p className="text-sm text-[#6d7175]">{faqs.length} FAQs</p>
                  {faqs.length === 0 ? <div className="bg-white border border-[#e1e3e5] rounded-xl text-center py-12"><HelpCircle className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" /><p className="text-sm text-[#6d7175]">No FAQs yet</p></div> : faqs.map(f => (
                    <div key={f.id} className="bg-white border border-[#e1e3e5] rounded-xl p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1"><p className="text-sm font-semibold text-[#202223]">{f.question}</p><p className="text-xs text-[#6d7175] leading-relaxed">{f.answer}</p></div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => { setEditingFaq(f); setFaqQuestion(f.question); setFaqAnswer(f.answer); }} className="p-1.5 text-[#6d7175] hover:text-[#2c6ecb] hover:bg-[#f4f8ff] rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteFaq(f.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== REVIEWS ===== */}
          {activeTab === "reviews" && (
            <div className="space-y-5">
              <h1 className="text-xl font-bold text-[#202223]">Reviews</h1>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-[#202223] text-sm">{editingReview ? "Edit review" : "Add review"}</h3>
                  <form onSubmit={handleSaveReview} className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium text-[#202223] mb-1">Customer name</label><input type="text" required value={revName} onChange={e => setRevName(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                      <div><label className="block text-xs font-medium text-[#202223] mb-1">Location</label><input type="text" required value={revLocation} onChange={e => setRevLocation(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium text-[#202223] mb-1">Rating</label>
                        <select value={revRating} onChange={e => setRevRating(Number(e.target.value))} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]">
                          <option value={5}>5 Stars</option><option value={4}>4 Stars</option><option value={3}>3 Stars</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-xs text-[#202223] cursor-pointer"><input type="checkbox" checked={revVerified} onChange={e => setRevVerified(e.target.checked)} className="accent-[#000000]" />Verified buyer</label></div>
                    </div>
                    <div><label className="block text-xs font-medium text-[#202223] mb-1">Review text</label><textarea required rows={4} value={revReview} onChange={e => setRevReview(e.target.value)} className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff]"></textarea></div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold py-2 rounded-lg transition cursor-pointer">{editingReview ? "Update" : "Publish"}</button>
                      {editingReview && <button type="button" onClick={() => { setEditingReview(null); setRevName(""); setRevLocation(""); setRevReview(""); setRevRating(5); setRevVerified(true); }} className="px-4 border border-[#e1e3e5] text-[#6d7175] text-sm rounded-lg cursor-pointer">Cancel</button>}
                    </div>
                  </form>
                </div>
                <div className="lg:col-span-2 space-y-3">
                  <p className="text-sm text-[#6d7175]">{reviews.length} reviews</p>
                  {reviews.length === 0 ? <div className="bg-white border border-[#e1e3e5] rounded-xl text-center py-12"><Star className="w-8 h-8 text-[#c9cccf] mx-auto mb-2" /><p className="text-sm text-[#6d7175]">No reviews yet</p></div> : reviews.map(r => (
                    <div key={r.id} className="bg-white border border-[#e1e3e5] rounded-xl p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-0.5 text-amber-400">{[...Array(r.rating || 5)].map((_,i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />)}</div>
                        <p className="text-sm italic text-[#202223]">"{r.review}"</p>
                        <div className="flex items-center gap-2 text-xs text-[#6d7175]">
                          <span className="font-semibold text-[#202223]">{r.name}</span>
                          <span>·</span>
                          <span>{r.location}</span>
                          {r.verified && <span className="text-[#000000] bg-[#e8f0ff] px-1.5 py-0.5 rounded-full font-semibold text-[10px]">Verified</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => { setEditingReview(r); setRevName(r.name); setRevLocation(r.location); setRevReview(r.review); setRevRating(r.rating || 5); setRevVerified(r.verified !== false); }} className="p-1.5 text-[#6d7175] hover:text-[#2c6ecb] hover:bg-[#f4f8ff] rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteReview(r.id)} className="p-1.5 text-[#6d7175] hover:text-[#d82c0d] hover:bg-[#fff4f4] rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== PHONE MODELS ===== */}
          {activeTab === "phone_models" && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                <div>
                  <h1 className="text-xl font-bold text-[#202223]">Phone Models</h1>
                  <p className="text-xs text-[#6d7175] mt-0.5">Manage brands and model names available for product selection. Drag to reorder.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadDefaultModels}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    title="Load 596+ models from master list"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Load All Models (596+)
                  </button>
                  <button
                    onClick={handleSaveBrandModels}
                    className="bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              </div>

              {/* Add Brand */}
              <div className="bg-white border border-[#e1e3e5] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#6d7175] uppercase tracking-wide mb-3">Add New Brand</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    placeholder="e.g. Nothing, Realme, Motorola..."
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddBrand(); } }}
                    className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                  />
                  <button
                    onClick={handleAddBrand}
                    className="bg-[#2c6ecb] hover:bg-[#1f5ab5] text-white text-sm font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Brand
                  </button>
                </div>
              </div>

              {/* Two-panel layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

                {/* Left: Brands list with drag reorder */}
                <div className="md:col-span-4 bg-white border border-[#e1e3e5] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[#6d7175] uppercase tracking-wide">
                      Brands ({(brandOrder.length > 0 ? brandOrder : Object.keys(brandModels)).length})
                    </p>
                    <p className="text-[10px] text-[#9ca3af]">Drag to reorder</p>
                  </div>
                  {(brandOrder.length > 0 ? brandOrder : Object.keys(brandModels)).length === 0 ? (
                    <p className="text-sm text-[#6d7175] text-center py-8">No brands added yet</p>
                  ) : (
                    <div className="space-y-1">
                      {(brandOrder.length > 0 ? brandOrder : Object.keys(brandModels)).map((brand, idx) => (
                        <div
                          key={brand}
                          draggable
                          onDragStart={() => setDragBrandIdx(idx)}
                          onDragOver={e => { e.preventDefault(); setDragBrandOver(idx); }}
                          onDrop={() => {
                            if (dragBrandIdx === null || dragBrandIdx === idx) { setDragBrandIdx(null); setDragBrandOver(null); return; }
                            const arr = brandOrder.length > 0 ? [...brandOrder] : [...Object.keys(brandModels)];
                            const [moved] = arr.splice(dragBrandIdx, 1);
                            arr.splice(idx, 0, moved);
                            setBrandOrder(arr);
                            setDragBrandIdx(null); setDragBrandOver(null);
                          }}
                          onDragEnd={() => { setDragBrandIdx(null); setDragBrandOver(null); }}
                          onClick={() => setActiveBrandName(brand)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition select-none ${
                            dragBrandOver === idx && dragBrandIdx !== idx ? "border-[#000000] bg-[#f0f7ff] shadow-md" :
                            activeBrandName === brand ? "border-[#000000] bg-[#e8f0ff]" : "border-[#e1e3e5] hover:bg-[#f6f6f7]"
                          } ${dragBrandIdx === idx ? "opacity-40" : "opacity-100"}`}
                        >
                          {/* Drag handle */}
                          <svg className="w-3.5 h-3.5 text-[#c9cccf] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
                            <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                            <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
                          </svg>
                          <span className={`text-sm font-medium flex-1 truncate ${activeBrandName === brand ? "text-[#000000]" : "text-[#202223]"}`}>{brand}</span>
                          <span className="text-[10px] text-[#9ca3af] shrink-0">{brandModels[brand]?.length || 0}</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleRemoveBrand(brand); }}
                            className="text-[#c9cccf] hover:text-[#d82c0d] p-0.5 cursor-pointer shrink-0 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Models for selected brand with drag reorder */}
                <div className="md:col-span-8 bg-white border border-[#e1e3e5] rounded-xl p-4">
                  {activeBrandName ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-[#202223]">{activeBrandName}</h4>
                          <p className="text-[10px] text-[#9ca3af] mt-0.5">{brandModels[activeBrandName]?.length || 0} models &mdash; drag to reorder</p>
                        </div>
                        <span className="text-[10px] text-[#9ca3af] bg-[#f6f6f7] border border-[#e1e3e5] px-2 py-0.5 rounded-full">{brandModels[activeBrandName]?.length || 0} total</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newModelName}
                          onChange={e => setNewModelName(e.target.value)}
                          placeholder="iPhone 15 Pro, iPhone 14... (comma-separated)"
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddModel(); } }}
                          className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                        />
                        <button
                          onClick={handleAddModel}
                          className="bg-[#202223] hover:bg-black text-white text-sm font-semibold px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                        {!brandModels[activeBrandName] || brandModels[activeBrandName].length === 0 ? (
                          <div className="text-center py-10 text-sm text-[#6d7175]">
                            <Smartphone className="w-7 h-7 text-[#e1e3e5] mx-auto mb-2" />
                            No models added yet
                          </div>
                        ) : brandModels[activeBrandName].map((model, midx) => (
                          <div
                            key={model}
                            draggable
                            onDragStart={() => setDragModelIdx(midx)}
                            onDragOver={e => { e.preventDefault(); setDragModelOver(midx); }}
                            onDrop={() => {
                              if (dragModelIdx === null || dragModelIdx === midx) { setDragModelIdx(null); setDragModelOver(null); return; }
                              const arr = [...(brandModels[activeBrandName] || [])];
                              const [moved] = arr.splice(dragModelIdx, 1);
                              arr.splice(midx, 0, moved);
                              setBrandModels({ ...brandModels, [activeBrandName]: arr });
                              setDragModelIdx(null); setDragModelOver(null);
                            }}
                            onDragEnd={() => { setDragModelIdx(null); setDragModelOver(null); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing select-none transition ${
                              dragModelOver === midx && dragModelIdx !== midx ? "border-[#000000] bg-[#f0f7ff] shadow-sm" : "border-[#e1e3e5] bg-[#fafafa] hover:bg-[#f6f6f7]"
                            } ${dragModelIdx === midx ? "opacity-40" : "opacity-100"}`}
                          >
                            <svg className="w-3 h-3 text-[#c9cccf] shrink-0" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
                              <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
                              <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                            </svg>
                            <span className="text-xs font-medium text-[#202223] flex-1 truncate">{model}</span>
                            <button
                              onClick={() => handleRemoveModel(model)}
                              className="text-[#c9cccf] hover:text-[#d82c0d] cursor-pointer transition shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-16 gap-2">
                      <Smartphone className="w-10 h-10 text-[#e1e3e5]" />
                      <p className="text-sm text-[#6d7175]">Select a brand to manage its models</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SERVICEABILITY TAB ──────────────────────────────────────────── */}
          {activeTab === "serviceability" && (
            <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#202223]">Delivery Serviceability</h2>
                  <p className="text-sm text-[#6d7175] mt-0.5">Check COD & Prepaid availability by pincode</p>
                </div>
                <button
                  onClick={() => { setSvcLoaded(false); setSvcResult(null); setSvcCheckPin(""); loadSvcPincodes(); }}
                  disabled={svcLoading}
                  className="flex items-center gap-2 bg-[#000000] hover:bg-[#0052cc] text-white text-sm font-bold px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${svcLoading ? "animate-spin" : ""}`} />
                  {svcLoaded ? "Refresh" : "Load Pincodes"}
                </button>
              </div>

              {!svcLoaded && !svcLoading && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                  <MapPin className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-amber-800">Loading serviceability data…</p>
                  <p className="text-xs text-amber-600">29,000+ pincodes with COD / Prepaid / Zone info synced from your Supabase table.</p>
                </div>
              )}

              {svcLoading && (
                <div className="flex items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-4 border-[#000000] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-bold text-[#6d7175]">Loading pincodes from database…</p>
                </div>
              )}

              {svcLoaded && (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: "Total Pincodes", value: svcStats.total.toLocaleString(), color: "bg-[#e8f0ff] text-[#2c6ecb]", icon: <MapPin className="w-4 h-4" /> },
                      { label: "COD + Prepaid", value: svcStats.both.toLocaleString(), color: "bg-green-50 text-green-700", icon: <CheckCircle2 className="w-4 h-4" /> },
                      { label: "Prepaid Only", value: svcStats.prepaidOnly.toLocaleString(), color: "bg-blue-50 text-blue-700", icon: <Tag className="w-4 h-4" /> },
                      { label: "COD Only", value: (svcStats.codY - svcStats.both).toLocaleString(), color: "bg-orange-50 text-orange-700", icon: <Package className="w-4 h-4" /> },
                      { label: "Not Serviceable", value: svcStats.none.toLocaleString(), color: "bg-red-50 text-red-600", icon: <AlertCircle className="w-4 h-4" /> },
                    ].map(s => (
                      <div key={s.label} className={`${s.color} rounded-xl p-4 space-y-1`}>
                        <div className="flex items-center gap-1.5 opacity-70">{s.icon}<span className="text-[10px] font-black uppercase tracking-wide">{s.label}</span></div>
                        <p className="text-2xl font-black">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Pincode Checker */}
                  <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                    <p className="text-sm font-black text-[#202223] uppercase tracking-wide">Check a Pincode</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={svcCheckPin}
                        onChange={e => { setSvcCheckPin(e.target.value.replace(/\D/g,"")); setSvcResult(null); }}
                        onKeyDown={e => e.key === "Enter" && checkSvcPin()}
                        placeholder="Enter 6-digit pincode…"
                        className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-sm text-[#202223] outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/20 font-mono transition"
                      />
                      <button
                        onClick={checkSvcPin}
                        className="flex items-center gap-2 bg-[#202223] hover:bg-[#303030] text-white text-sm font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                      >
                        <Search className="w-4 h-4" /> Check
                      </button>
                    </div>

                    {svcResult === "not_found" && (
                      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                          <p className="text-sm font-black text-red-700">Not Serviceable</p>
                          <p className="text-xs text-red-500 mt-0.5">Pincode {svcCheckPin} is not in the serviceability list — neither COD nor Prepaid delivery available.</p>
                        </div>
                      </div>
                    )}

                    {svcResult && svcResult !== "not_found" && (
                      <div className="space-y-3">
                        {/* Location info */}
                        <div className="flex items-center gap-2 bg-[#f6f6f7] rounded-lg px-3 py-2">
                          <MapPin className="w-4 h-4 text-[#6d7175] shrink-0" />
                          <span className="text-sm font-bold text-[#202223]">
                            {svcResult.city ? `${svcResult.city}, ` : ""}{svcResult.state || "—"}
                          </span>
                          {svcResult.zone && (
                            <span className="ml-auto text-[10px] font-black bg-[#e8f0ff] text-[#2c6ecb] px-2 py-0.5 rounded-full">Zone {svcResult.zone}</span>
                          )}
                        </div>

                        {/* Service pills */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* COD */}
                          <div className={`rounded-xl p-3 text-center space-y-1.5 border-2 ${svcResult.cod ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200 opacity-60"}`}>
                            {svcResult.cod
                              ? <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                              : <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />}
                            <p className="text-[11px] font-black text-[#202223]">COD</p>
                            <p className={`text-xs font-bold ${svcResult.cod ? "text-green-700" : "text-red-600"}`}>
                              {svcResult.cod ? "Available" : "Not Available"}
                            </p>
                            {svcResult.cod && <p className="text-[10px] text-[#6d7175]">₹50 fee applies</p>}
                          </div>
                          {/* Prepaid */}
                          <div className={`rounded-xl p-3 text-center space-y-1.5 border-2 ${svcResult.prepaid ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200 opacity-60"}`}>
                            {svcResult.prepaid
                              ? <CheckCircle2 className="w-5 h-5 text-blue-600 mx-auto" />
                              : <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />}
                            <p className="text-[11px] font-black text-[#202223]">Prepaid / Razorpay</p>
                            <p className={`text-xs font-bold ${svcResult.prepaid ? "text-blue-700" : "text-red-600"}`}>
                              {svcResult.prepaid ? "Available" : "Not Available"}
                            </p>
                            {svcResult.prepaid && <p className="text-[10px] text-[#6d7175]">Free shipping</p>}
                          </div>
                          {/* Pickup */}
                          <div className={`rounded-xl p-3 text-center space-y-1.5 border-2 ${svcResult.pickup ? "bg-purple-50 border-purple-200" : "bg-[#f6f6f7] border-[#e1e3e5] opacity-60"}`}>
                            {svcResult.pickup
                              ? <CheckCircle2 className="w-5 h-5 text-purple-600 mx-auto" />
                              : <AlertCircle className="w-5 h-5 text-[#c9cccf] mx-auto" />}
                            <p className="text-[11px] font-black text-[#202223]">Pickup</p>
                            <p className={`text-xs font-bold ${svcResult.pickup ? "text-purple-700" : "text-[#6d7175]"}`}>
                              {svcResult.pickup ? "Available" : "Not Available"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="bg-[#f6f6f7] border border-[#e1e3e5] rounded-xl p-4 space-y-2">
                    <p className="text-xs font-black text-[#202223] uppercase tracking-wide">How this works</p>
                    <ul className="text-xs text-[#6d7175] space-y-1 list-disc list-inside">
                      <li>This data is stored in your Supabase <span className="font-mono text-[#202223]">serviceable_pincodes</span> table</li>
                      <li>Checkout page fetches serviceability in real-time when customer enters pincode</li>
                      <li>COD option is hidden if the pincode doesn't support it</li>
                      <li>Razorpay / Prepaid is shown only if <span className="font-mono text-[#202223]">prepaid = true</span></li>
                      <li>If pincode not found → only Prepaid shown (fallback)</li>
                      <li>To update data, re-upload your CSV to Supabase and click Refresh</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── OUR SNAPS TAB ────────────────────────────────────────────────── */}
          {activeTab === "our_snaps" && (() => {
            const snaps: { url: string; imageUrl: string; caption?: string }[] = settings?.instagramSnaps ?? [];

            const handleAddSnap = async () => {
              if (!snapNewUrl.trim() || !snapNewImageUrl.trim()) return;
              setSnapSaving(true);
              try {
                const updated = [...snaps, { url: snapNewUrl.trim(), imageUrl: snapNewImageUrl.trim(), caption: snapNewCaption.trim() }];
                const newSettings = { ...settings!, instagramSnaps: updated };
                await saveSettings(newSettings);
                setSettings(newSettings);
                setSnapNewUrl(""); setSnapNewImageUrl(""); setSnapNewCaption("");
                showToast("Snap added!");
              } catch { showToast("Failed to save snap.", "error"); }
              finally { setSnapSaving(false); }
            };

            const handleDeleteSnap = async (index: number) => {
              const updated = snaps.filter((_, i) => i !== index);
              const newSettings = { ...settings!, instagramSnaps: updated };
              await saveSettings(newSettings);
              setSettings(newSettings);
              showToast("Snap removed.");
            };

            return (
              <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
                <div>
                  <h2 className="text-xl font-black text-[#202223]">Our Snaps Gallery</h2>
                  <p className="text-sm text-[#6d7175] mt-0.5">Manage photos shown in the "Our Snaps" page. Upload a photo and add the matching Instagram post link.</p>
                </div>

                {/* Add new snap */}
                <div className="bg-white border border-[#e1e3e5] rounded-xl p-5 space-y-4">
                  <p className="text-sm font-black text-[#202223] uppercase tracking-wide">Add New Snap</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-[#6d7175] mb-1 block">Snap Image</label>
                      {snapNewImageUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-[#e1e3e5] bg-[#f6f6f7]">
                          <img src={snapNewImageUrl} alt="Preview" className="w-full h-44 object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-2">
                            <label className="bg-white text-[#202223] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#f6f6f7] flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3" /> Replace
                              <input type="file" accept="image/*" className="hidden" disabled={snapImageUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleSnapImageUpload(f); e.target.value = ""; }} />
                            </label>
                            <button type="button" onClick={() => setSnapNewImageUrl("")} className="bg-white text-[#d82c0d] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#fff4f4] flex items-center gap-1.5">
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                          <div className="absolute top-2 right-2 bg-[#000000] text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Uploaded to Cloudinary
                          </div>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center gap-3 border-2 border-dashed rounded-xl p-6 transition-all ${snapImageUploading ? "border-[#c9cccf] bg-[#f6f6f7] cursor-wait" : "border-[#c9cccf] hover:border-[#458fff] hover:bg-[#eef2ff] cursor-pointer"}`}>
                          <div className="w-10 h-10 rounded-full bg-[#e8f0ff] flex items-center justify-center">
                            <Image className="w-5 h-5 text-[#2c6ecb]" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-[#202223]">{snapImageUploading ? "Uploading…" : "Click to upload image"}</p>
                            <p className="text-xs text-[#6d7175] mt-0.5">JPG, PNG, WEBP · Max 15MB · Auto-saved to Cloudinary</p>
                          </div>
                          <input type="file" accept="image/*" className="hidden" disabled={snapImageUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleSnapImageUpload(f); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#6d7175] mb-1 block">Instagram Post URL</label>
                      <input
                        type="url"
                        value={snapNewUrl}
                        onChange={e => setSnapNewUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/ABC123/"
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/20 transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#6d7175] mb-1 block">Caption (optional)</label>
                      <input
                        type="text"
                        value={snapNewCaption}
                        onChange={e => setSnapNewCaption(e.target.value)}
                        placeholder="Custom TVK case for Pixel 8 Pro..."
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/20 transition"
                      />
                    </div>
                    <button
                      onClick={handleAddSnap}
                      disabled={snapSaving || snapImageUploading || !snapNewUrl.trim() || !snapNewImageUrl.trim()}
                      className="flex items-center gap-2 bg-[#000000] hover:bg-[#222] disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      {snapSaving ? "Saving..." : snapImageUploading ? "Uploading image..." : "Add Snap"}
                    </button>
                  </div>
                </div>

                {/* Current snaps grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-[#202223]">{snaps.length} Snap{snaps.length !== 1 ? "s" : ""}</p>
                    {snaps.length > 0 && (
                      <p className="text-xs text-[#6d7175]">Click the trash icon to remove a snap</p>
                    )}
                  </div>

                  {snaps.length === 0 ? (
                    <div className="bg-[#f6f6f7] border border-dashed border-[#c9cccf] rounded-xl p-10 text-center">
                      <Image className="w-10 h-10 text-[#c9cccf] mx-auto mb-3" />
                      <p className="text-sm font-bold text-[#6d7175]">No snaps added yet</p>
                      <p className="text-xs text-[#6d7175] mt-1">Add your first Instagram snap above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {snaps.map((snap, i) => (
                        <div key={i} className="relative group rounded-xl overflow-hidden border border-[#e1e3e5] aspect-square bg-[#f6f6f7]">
                          <img
                            src={snap.imageUrl}
                            alt={snap.caption || `Snap ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteSnap(i)}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                            title="Remove snap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {snap.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1.5">
                              <p className="text-[10px] text-white font-medium truncate">{snap.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Help note */}
                <div className="bg-[#e8f0ff] border border-[#a4c0f4] rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-black text-[#2c6ecb] uppercase tracking-wide">How adding a snap works</p>
                  <ul className="text-xs text-[#2c6ecb]/80 space-y-1 list-disc list-inside">
                    <li>Click the upload box and pick a photo — it's uploaded to <strong>Cloudinary</strong> automatically</li>
                    <li>Once it's done you'll see a preview with an "Uploaded to Cloudinary" badge</li>
                    <li>For the Instagram Post URL: open the post on Instagram and copy the link from the address bar</li>
                    <li>Click "Add Snap" to publish it on the "Our Snaps" page</li>
                  </ul>
                </div>
              </div>
            );
          })()}

        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#1f1f1e] border-t border-white/10 flex items-center justify-around px-1 py-1 safe-area-pb">
        {[
          { key: "dashboard", label: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
          { key: "products", label: "Products", icon: <Package2 className="w-5 h-5" /> },
          { key: "orders", label: "Orders", icon: <ShoppingCart className="w-5 h-5" /> },
          { key: "serviceability", label: "Delivery", icon: <MapPin className="w-5 h-5" /> },
          { key: "settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => { setActiveTab(item.key as any); if (item.key === "orders") setNewOrderCount(0); if (item.key === "serviceability" && !svcLoaded && !svcLoading) loadSvcPincodes(); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all cursor-pointer min-w-0 ${
              activeTab === item.key ? "text-white" : "text-[#6b7280]"
            }`}
          >
            <span className={`relative ${activeTab === item.key ? "text-[#000000]" : ""}`}>
              {item.icon}
              {item.key === "orders" && newOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                  {newOrderCount}
                </span>
              )}
              {item.key === "orders" && newOrderCount === 0 && (() => {
                const unfulfilledCount = orders.filter(o => ["pending","waiting_for_manufacturing","waiting_for_customer_confirmation","processing","ready_to_ship","waiting_for_pickup"].includes(o.status)).length;
                return unfulfilledCount > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-black rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {unfulfilledCount}
                  </span>
                ) : null;
              })()}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide">{item.label}</span>
            {activeTab === item.key && <span className="w-1 h-1 rounded-full bg-[#000000]" />}
          </button>
        ))}
      </nav>

      {/* ── MERGE ORDER MODAL ── */}
      {mergeModalOpen && mergeSourceOrder && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) { setMergeModalOpen(false); setMergeSourceOrder(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1e3e5] sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#f5f3ff] flex items-center justify-center">
                  <GitMerge className="w-4 h-4 text-[#7c3aed]" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#202223]">Merge Orders</h2>
                  <p className="text-xs text-[#6d7175]">Merging INTO <span className="font-bold text-[#202223]">{mergeSourceOrder.id.startsWith("FC") ? mergeSourceOrder.id : "#" + mergeSourceOrder.id.slice(-8)}</span></p>
                </div>
              </div>
              <button onClick={() => { setMergeModalOpen(false); setMergeSourceOrder(null); }} className="p-2 hover:bg-[#f6f6f7] rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-[#6d7175]" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Source Order Info */}
              <div className="bg-[#f5f3ff] border border-[#e9d5ff] rounded-xl p-4">
                <p className="text-[10px] font-black text-[#7c3aed] uppercase tracking-widest mb-2">Base Order (kept)</p>
                <p className="text-sm font-black text-[#202223]">{mergeSourceOrder.id.startsWith("FC") ? mergeSourceOrder.id : "#" + mergeSourceOrder.id.slice(-8)} · {mergeSourceOrder.customerName}</p>
                <p className="text-xs text-[#6d7175] mt-0.5">{mergeSourceOrder.customerPhone} · {mergeSourceOrder.items.length} item{mergeSourceOrder.items.length !== 1 ? "s" : ""} · ₹{mergeSourceOrder.total}</p>
                <p className="text-xs text-[#6d7175] mt-0.5 truncate">{mergeSourceOrder.shippingAddress}, {mergeSourceOrder.city} - {mergeSourceOrder.pincode}</p>
              </div>

              {/* Auto suggestions */}
              {mergeSuggestions.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest mb-2">
                    Suggested — Same Phone / Address
                  </p>
                  <div className="space-y-2">
                    {mergeSuggestions.map(sug => (
                      <button
                        key={sug.id}
                        onClick={() => setMergeTargetId(sug.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                          mergeTargetId === sug.id
                            ? "border-[#7c3aed] bg-[#faf5ff]"
                            : "border-[#e1e3e5] bg-white hover:border-[#c4b5fd]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-black text-[#202223]">{sug.id.startsWith("FC") ? sug.id : "#" + sug.id.slice(-8)} · {sug.customerName}</p>
                            <p className="text-xs text-[#6d7175] mt-0.5">{sug.customerPhone} · {sug.items.length} item{sug.items.length !== 1 ? "s" : ""} · ₹{sug.total}</p>
                            <p className="text-xs text-[#6d7175] truncate">{sug.shippingAddress}, {sug.city} - {sug.pincode}</p>
                          </div>
                          {mergeTargetId === sug.id && (
                            <div className="w-5 h-5 rounded-full bg-[#7c3aed] flex items-center justify-center shrink-0 ml-2">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual select — pick any other order */}
              <div>
                <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest mb-2">
                  {mergeSuggestions.length > 0 ? "Or pick manually" : "Select order to merge"}
                </p>
                <div className="relative">
                  <select
                    value={mergeTargetId}
                    onChange={e => setMergeTargetId(e.target.value)}
                    className="w-full border border-[#c9cccf] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20 appearance-none cursor-pointer pr-8"
                  >
                    <option value="">— Select an order —</option>
                    {orders
                      .filter(o => o.id !== mergeSourceOrder.id && o.status !== ("archived" as any))
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(o => (
                        <option key={o.id} value={o.id}>
                          {o.id.startsWith("FC") ? o.id : "#" + o.id.slice(-8)} · {o.customerName} · {o.customerPhone} · ₹{o.total}
                        </option>
                      ))
                    }
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d7175] pointer-events-none text-[10px]">▾</span>
                </div>
              </div>

              {/* Preview what will happen */}
              {mergeTargetId && (() => {
                const target = orders.find(o => o.id === mergeTargetId);
                if (!target) return null;
                const totalItems = mergeSourceOrder.items.length + target.items.length;
                const totalAmt = mergeSourceOrder.items.reduce((s, it) => s + it.product.price * it.quantity, 0)
                               + target.items.reduce((s, it) => s + it.product.price * it.quantity, 0)
                               + mergeSourceOrder.shipping;
                return (
                  <div className="bg-[#fff8f0] border border-[#fed7aa] rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-[#c2410c] uppercase tracking-widest">After Merge Preview</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-black text-[#202223]">{mergeSourceOrder.id.startsWith("FC") ? mergeSourceOrder.id : "#" + mergeSourceOrder.id.slice(-8)}</span>
                      <span className="text-[#6d7175]">← absorbs →</span>
                      <span className="font-black text-[#202223]">{target.id.startsWith("FC") ? target.id : "#" + target.id.slice(-8)}</span>
                    </div>
                    <p className="text-xs text-[#6d7175]">Total items: <span className="font-bold text-[#202223]">{totalItems}</span> · New total: <span className="font-bold text-[#202223]">₹{totalAmt}</span></p>
                    <p className="text-[10px] text-[#c2410c] font-semibold">{target.id.startsWith("FC") ? target.id : "#" + target.id.slice(-8)} will be permanently deleted after merge.</p>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e1e3e5] flex items-center justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => { setMergeModalOpen(false); setMergeSourceOrder(null); }}
                className="px-4 py-2 text-sm font-semibold text-[#6d7175] hover:text-[#202223] border border-[#e1e3e5] rounded-lg hover:bg-[#f6f6f7] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={!mergeTargetId}
                className="flex items-center gap-2 px-5 py-2 text-sm font-black bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg transition cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GitMerge className="w-4 h-4" /> Merge Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT ORDER MODAL ── */}
      {editingOrder && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setEditingOrder(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1e3e5] sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-black text-[#202223]">Edit Order</h2>
                <p className="text-xs text-[#6d7175] mt-0.5">{editingOrder.id.startsWith("FC") ? editingOrder.id : "#" + editingOrder.id.slice(-8)}</p>
              </div>
              <button onClick={() => setEditingOrder(null)} className="p-2 hover:bg-[#f6f6f7] rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-[#6d7175]" />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Customer Info */}
              <div>
                <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest mb-3">Customer Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editOrderData.customerName || ""}
                      onChange={e => setEditOrderData(d => ({ ...d, customerName: e.target.value }))}
                      className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1">Email</label>
                    <input
                      type="email"
                      value={editOrderData.customerEmail || ""}
                      onChange={e => setEditOrderData(d => ({ ...d, customerEmail: e.target.value }))}
                      className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editOrderData.customerPhone || ""}
                      onChange={e => setEditOrderData(d => ({ ...d, customerPhone: e.target.value }))}
                      className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1">Alternate Phone</label>
                    <input
                      type="tel"
                      value={editOrderData.customerAltPhone || ""}
                      onChange={e => setEditOrderData(d => ({ ...d, customerAltPhone: e.target.value }))}
                      className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest mb-3">Shipping Address</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1">Address Line</label>
                    <input
                      type="text"
                      value={editOrderData.shippingAddress || ""}
                      onChange={e => setEditOrderData(d => ({ ...d, shippingAddress: e.target.value }))}
                      className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#202223] mb-1">City</label>
                      <input
                        type="text"
                        value={editOrderData.city || ""}
                        onChange={e => setEditOrderData(d => ({ ...d, city: e.target.value }))}
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#202223] mb-1">State</label>
                      <input
                        type="text"
                        value={editOrderData.state || ""}
                        onChange={e => setEditOrderData(d => ({ ...d, state: e.target.value }))}
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#202223] mb-1">Pincode</label>
                      <input
                        type="text"
                        value={editOrderData.pincode || ""}
                        onChange={e => setEditOrderData(d => ({ ...d, pincode: e.target.value }))}
                        className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest mb-3">Payment Method</p>
                <div className="relative inline-block">
                  <select
                    value={editOrderData.paymentMethod || "cod"}
                    onChange={e => setEditOrderData(d => ({ ...d, paymentMethod: e.target.value as any }))}
                    className="border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] appearance-none pr-8 cursor-pointer"
                  >
                    <option value="cod">COD</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6d7175] pointer-events-none text-[10px]">▾</span>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <p className="text-[10px] font-black text-[#6d7175] uppercase tracking-widest mb-3">Order Items</p>
                <div className="space-y-3">
                  {editOrderData.items.map((it, idx) => (
                    <div key={idx} className="border border-[#e1e3e5] rounded-xl p-4 bg-[#fafafa] space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-12 rounded-lg border border-[#e1e3e5] bg-white flex items-center justify-center shrink-0 overflow-hidden">
                          {it.product.images?.[0] ? (
                            <img src={it.product.images[0]} alt="" className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                          ) : (
                            <Smartphone className="w-4 h-4 text-[#c9cccf]" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-[#202223] flex-1 leading-snug">{it.product.title}</p>
                        <span className="text-xs font-black text-[#202223]">₹{299 * it.quantity}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#202223] mb-1">Phone Model</label>
                          <input
                            type="text"
                            value={it.selectedModel || ""}
                            onChange={e => {
                              const newItems = [...editOrderData.items];
                              newItems[idx] = { ...newItems[idx], selectedModel: e.target.value };
                              setEditOrderData(d => ({ ...d, items: newItems }));
                            }}
                            className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                            placeholder="e.g. iPhone 15 Pro"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#202223] mb-1">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={e => {
                              const newItems = [...editOrderData.items];
                              newItems[idx] = { ...newItems[idx], quantity: parseInt(e.target.value) || 1 };
                              setEditOrderData(d => ({ ...d, items: newItems }));
                            }}
                            className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                          />
                        </div>
                      </div>

                      {/* Custom Text */}
                      <div>
                        <label className="block text-xs font-semibold text-[#202223] mb-1">Custom Print Text</label>
                        <input
                          type="text"
                          value={it.customText || ""}
                          onChange={e => {
                            const newItems = [...editOrderData.items];
                            newItems[idx] = { ...newItems[idx], customText: e.target.value };
                            setEditOrderData(d => ({ ...d, items: newItems }));
                          }}
                          className="w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                          placeholder="Leave blank if none"
                        />
                      </div>

                      {/* Customer Photo URL */}
                      {it.customerImage && (
                        <div>
                          <label className="block text-xs font-semibold text-[#202223] mb-1">Customer Photo URL</label>
                          <div className="flex items-center gap-2">
                            <img src={it.customerImage} alt="Customer photo" className="w-10 h-10 object-cover rounded-lg border border-[#e1e3e5] shrink-0" />
                            <input
                              type="text"
                              value={it.customerImage || ""}
                              onChange={e => {
                                const newItems = [...editOrderData.items];
                                newItems[idx] = { ...newItems[idx], customerImage: e.target.value };
                                setEditOrderData(d => ({ ...d, items: newItems }));
                              }}
                              className="flex-1 border border-[#c9cccf] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Order Summary */}
            {(() => {
              const { subtotal, shipping, total } = calcEditOrderTotals(
                editOrderData.items,
                editOrderData.paymentMethod || "cod",
                editOrderData.state || ""
              );
              const isCOD = (editOrderData.paymentMethod || "cod") === "cod";
              const isTN = (editOrderData.state || "").trim().toLowerCase().replace(/\s+/g, "") === "tamilnadu";
              return (
                <div className="px-6 py-3 border-t border-[#e1e3e5] bg-[#fafafa]">
                  <div className="flex items-center justify-between text-xs text-[#6d7175] mb-1">
                    <span>Subtotal ({editOrderData.items.reduce((s, i) => s + i.quantity, 0)} item{editOrderData.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} × ₹299)</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6d7175] mb-1">
                    <span>Shipping {isCOD ? `(COD · ${isTN ? "Tamil Nadu" : "Other State"})` : "(Prepaid · Free)"}</span>
                    <span className={shipping === 0 ? "text-green-600 font-semibold" : ""}>{shipping === 0 ? "FREE" : `₹${shipping}`}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-black text-[#202223]">
                    <span>Total</span>
                    <span>₹{total}</span>
                  </div>
                </div>
              );
            })()}

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-[#e1e3e5] sticky bottom-0 bg-white rounded-b-2xl">
              {/* Push to NimbusPost checkbox */}
              {!editingOrder?.awb && (
                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={editSaveAndPush}
                    onChange={e => setEditSaveAndPush(e.target.checked)}
                    className="w-4 h-4 rounded border-[#c9cccf] accent-[#000000] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-[#6d7175] group-hover:text-[#202223] transition">
                    Save &amp; Push to NimbusPost
                  </span>
                </label>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setEditingOrder(null); setEditSaveAndPush(false); }}
                  className="px-4 py-2 text-sm font-semibold text-[#6d7175] hover:text-[#202223] border border-[#e1e3e5] rounded-lg hover:bg-[#f6f6f7] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOrderEdit}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-black bg-[#000000] hover:bg-[#0052cc] text-white rounded-lg transition cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" /> {editSaveAndPush ? "Save & Push" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Track Order Modal (NimbusPost Status) ── */}
      {trackModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#202223]">Track Shipment</h3>
                  <p className="text-xs text-[#6d7175] mt-0.5">{trackModal.customerName} · <span className="font-mono font-bold text-sky-600">{trackModal.awb}</span></p>
                </div>
              </div>
              <button
                onClick={() => { setTrackModal(null); setTrackData(null); setTrackError(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f6f6f7] text-[#6d7175] transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Content */}
            {trackLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
                <p className="text-xs text-[#6d7175] font-medium">Fetching tracking info…</p>
              </div>
            ) : trackError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center">
                <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <p className="text-sm font-bold text-red-700 mb-1">Tracking Failed</p>
                <p className="text-xs text-red-500">{trackError}</p>
                <button
                  onClick={() => openTrackModal({ awb: trackModal.awb, id: trackModal.orderId, customerName: trackModal.customerName } as any)}
                  className="mt-3 text-xs font-bold text-red-600 underline cursor-pointer"
                >Retry</button>
              </div>
            ) : trackData ? (
              <div className="space-y-3">
                {/* Current Status Banner */}
                {trackData.data && trackData.data.length > 0 && (() => {
                  const latest = trackData.data[0];
                  const statusColors: Record<string, string> = {
                    DL: "bg-emerald-50 border-emerald-200 text-emerald-700",
                    OFD: "bg-sky-50 border-sky-200 text-sky-700",
                    IT: "bg-blue-50 border-blue-200 text-blue-700",
                    PK: "bg-indigo-50 border-indigo-200 text-indigo-700",
                    RD: "bg-violet-50 border-violet-200 text-violet-700",
                    RT: "bg-red-50 border-red-200 text-red-700",
                    PP: "bg-amber-50 border-amber-200 text-amber-700",
                  };
                  const dotColors: Record<string, string> = {
                    DL: "bg-emerald-500", OFD: "bg-sky-500", IT: "bg-blue-500",
                    PK: "bg-indigo-500", RD: "bg-violet-500", RT: "bg-red-500", PP: "bg-amber-500",
                  };
                  const code = latest.status_code || "PP";
                  const cls = statusColors[code] || statusColors.PP;
                  const dot = dotColors[code] || dotColors.PP;
                  return (
                    <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${cls}`}>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${dot}`} />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Current Status</p>
                        <p className="text-sm font-black mt-0.5">{latest.status || latest.status_code || "In Transit"}</p>
                        {latest.location && <p className="text-xs opacity-70 mt-0.5">{latest.location}</p>}
                      </div>
                    </div>
                  );
                })()}

                {/* Timeline */}
                {trackData.data && trackData.data.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#6d7175] uppercase tracking-wide mb-2 px-1">Timeline</p>
                    <div className="border border-[#e1e3e5] rounded-xl overflow-hidden divide-y divide-[#f1f1f1] max-h-56 overflow-y-auto">
                      {trackData.data.map((scan: any, i: number) => (
                        <div key={i} className={`flex gap-3 px-4 py-2.5 ${i === 0 ? "bg-emerald-50" : "bg-white"}`}>
                          <div className="flex flex-col items-center shrink-0 pt-1">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-emerald-500" : "bg-[#c9cccf]"}`} />
                            {i < trackData.data.length - 1 && <div className="w-px flex-1 bg-[#e1e3e5] mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <p className={`text-xs font-bold truncate ${i === 0 ? "text-emerald-700" : "text-[#202223]"}`}>
                              {scan.status || scan.status_code || "Update"}
                            </p>
                            {scan.location && <p className="text-[10px] text-[#6d7175] mt-0.5 truncate">{scan.location}</p>}
                            {scan.timestamp && (
                              <p className="text-[10px] text-[#9ca3af] mt-0.5">
                                {new Date(scan.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trackData.data && trackData.data.length === 0 && (
                  <div className="text-center py-6 text-[#6d7175]">
                    <svg className="w-8 h-8 mx-auto mb-2 text-[#c9cccf]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                    <p className="text-xs font-medium">No tracking events yet</p>
                  </div>
                )}

                {/* Refresh button */}
                <button
                  onClick={() => openTrackModal({ awb: trackModal.awb, id: trackModal.orderId, customerName: trackModal.customerName } as any)}
                  className="w-full flex items-center justify-center gap-2 border border-[#e1e3e5] text-[#6d7175] text-xs font-bold py-2.5 rounded-xl hover:bg-[#f6f6f7] transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Refresh Status
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* AWB / Shipment ID Modal */}
      {awbModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-[#202223]">Enter Shipment ID (AWB)</h3>
                <p className="text-xs text-[#6d7175] mt-0.5">Order: <span className="font-bold text-[#202223]">{awbModal.customerName}</span></p>
              </div>
            </div>

            <p className="text-xs text-[#6d7175] mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              Copy the <strong>AWB / Tracking number</strong> from NimbusPost after booking the shipment and paste it here. This will be saved with the order.
            </p>

            <input
              type="text"
              value={awbInput}
              onChange={e => setAwbInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSaveAwbAndShip()}
              placeholder="e.g. NP1234567890"
              autoFocus
              className="w-full border border-[#e1e3e5] rounded-xl px-4 py-3 text-sm font-mono font-bold text-[#202223] placeholder-[#b0b3b8] focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] mb-4 transition"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setAwbModal(null); setAwbInput(""); }}
                className="flex-1 border border-[#e1e3e5] text-[#6d7175] text-sm font-semibold py-2.5 rounded-xl hover:bg-[#f6f6f7] transition bg-transparent cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAwbAndShip}
                disabled={awbSaving || !awbInput.trim()}
                className="flex-1 bg-[#000000] hover:bg-[#0066cc] disabled:bg-[#e1e3e5] disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {awbSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {awbSaving ? "Saving..." : "Mark as Shipped"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT ADD / EDIT MODAL ── */}
      {productModalOpen && (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) resetProdForm(); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1e3e5] shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${editingProduct ? "bg-[#f4f8ff]" : "bg-[#e8f0ff]"}`}>
                  {editingProduct ? <Edit className="w-4 h-4 text-[#2c6ecb]" /> : <Plus className="w-4 h-4 text-[#000000]" />}
                </div>
                <div>
                  <h2 className="text-base font-black text-[#202223]">{editingProduct ? "Edit Product" : "Add New Product"}</h2>
                  {editingProduct && <p className="text-xs text-[#6d7175] mt-0.5 truncate max-w-[250px]">{editingProduct.title}</p>}
                </div>
              </div>
              <button onClick={resetProdForm} className="p-2 hover:bg-[#f6f6f7] rounded-lg transition cursor-pointer">
                <X className="w-4 h-4 text-[#6d7175]" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="prod-modal-form" onSubmit={handleSaveProduct} className="space-y-4 text-sm">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#202223] mb-1.5">Product Title</label>
                  <input type="text" required value={prodTitle} onChange={e => setProdTitle(e.target.value)} placeholder="e.g. Divine Murugan Ultra Glossy" className="w-full border border-[#c9cccf] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                </div>

                {/* Price + Compare + Collection */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1.5">Price (₹)</label>
                    <input type="number" required value={prodPrice} onChange={e => setProdPrice(Number(e.target.value))} className="w-full border border-[#c9cccf] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#202223] mb-1.5">Compare at (₹)</label>
                    <input type="number" required value={prodCompare} onChange={e => setProdCompare(Number(e.target.value))} className="w-full border border-[#c9cccf] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-[#202223] mb-1.5">Collections</label>
                    <div className="border border-[#c9cccf] rounded-xl bg-white max-h-32 overflow-y-auto divide-y divide-[#f1f2f3]">
                      {collections.map(c => {
                        const checked = prodCollectionIds.includes(c.slug);
                        return (
                          <label key={c.slug} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[#f4f8ff] transition">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setProdCollectionIds(prev =>
                                  checked ? prev.filter(s => s !== c.slug) : [...prev, c.slug]
                                );
                              }}
                              className="w-3.5 h-3.5 accent-[#458fff]"
                            />
                            <span className="text-xs text-[#202223]">{c.name}</span>
                            {prodCollectionIds[0] === c.slug && (
                              <span className="ml-auto text-[9px] font-semibold text-[#458fff] uppercase tracking-wide">Primary</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {prodCollectionIds.length === 0 && (
                      <p className="text-[10px] text-red-500 mt-1">Select at least one collection</p>
                    )}
                  </div>
                </div>

                {/* Product Images */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#202223]">
                      Product Images
                      <span className="ml-1.5 text-[#6d7175] font-normal">({prodImages.length}/3) — min 1, max 3</span>
                    </label>
                    {prodImages.length < 3 && (
                      <button type="button" onClick={() => setProdImages(prev => [...prev, ""])} className="flex items-center gap-1 text-xs text-[#2c6ecb] hover:text-[#0052cc] font-medium cursor-pointer">
                        <Plus className="w-3 h-3" /> Add image
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {prodImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative group">
                        <div className="relative w-full aspect-square rounded-xl overflow-hidden border-2 border-[#e1e3e5] bg-[#f6f6f7]">
                          {imgUrl && (imgUrl.startsWith("http") || imgUrl.startsWith("data:")) ? (
                            <img src={imgUrl} alt={`Product image ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : imgUrl ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                              <div className="w-8 h-8 rounded-full bg-[#e8f0ff] flex items-center justify-center"><Image className="w-4 h-4 text-[#2c6ecb]" /></div>
                              <span className="text-[9px] text-[#6d7175] text-center px-1 leading-tight">{imgUrl}</span>
                            </div>
                          ) : imageUploading[idx] ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                              <div className="w-5 h-5 border-2 border-[#2c6ecb] border-t-transparent rounded-full animate-spin" />
                              <span className="text-[9px] text-[#6d7175]">Uploading…</span>
                            </div>
                          ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[#eef2ff] transition">
                              <div className="w-8 h-8 rounded-full bg-[#e8f0ff] flex items-center justify-center"><Plus className="w-4 h-4 text-[#2c6ecb]" /></div>
                              <span className="text-[9px] text-[#6d7175]">Upload</span>
                              <input type="file" accept="image/*" className="hidden" onChange={e => {
                                const f = e.target.files?.[0]; if (!f) return;
                                setImageUploading(prev => { const n = [...prev]; n[idx] = true; return n; });
                                processAndUpload(f, 800, 1000, "fabcoverz/products")
                                  .then(url => { setProdImages(prev => { const n = [...prev]; n[idx] = url; return n; }); setImageUploading(prev => { const n = [...prev]; n[idx] = false; return n; }); showToast("Image uploaded!", "success"); })
                                  .catch(err => { setImageUploading(prev => { const n = [...prev]; n[idx] = false; return n; }); showToast(err?.message || "Upload failed", "error"); });
                              }} />
                            </label>
                          )}
                          {imgUrl && !imageUploading[idx] && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
                              <label className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:bg-white transition" title="Replace image">
                                <RefreshCw className="w-3.5 h-3.5 text-[#202223]" />
                                <input type="file" accept="image/*" className="hidden" onChange={e => {
                                  const f = e.target.files?.[0]; if (!f) return;
                                  setImageUploading(prev => { const n = [...prev]; n[idx] = true; return n; });
                                  processAndUpload(f, 800, 1000, "fabcoverz/products")
                                    .then(url => { setProdImages(prev => { const n = [...prev]; n[idx] = url; return n; }); setImageUploading(prev => { const n = [...prev]; n[idx] = false; return n; }); showToast("Image replaced!", "success"); })
                                    .catch(err => { setImageUploading(prev => { const n = [...prev]; n[idx] = false; return n; }); showToast(err?.message || "Upload failed", "error"); });
                                }} />
                              </label>
                              {prodImages.length > 1 && (
                                <button type="button" title="Remove image" className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:bg-red-50 transition" onClick={() => setProdImages(prev => prev.filter((_, i) => i !== idx))}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              )}
                            </div>
                          )}
                          <div className="absolute top-1 left-1 bg-black/50 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
                            {idx === 0 ? "Main" : `#${idx + 1}`}
                          </div>
                        </div>
                        <input type="text" value={imgUrl} placeholder={idx === 0 ? "https:// or preset key" : "https://..."} onChange={e => setProdImages(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })} className="mt-1 w-full border border-[#e1e3e5] rounded-lg px-2 py-1 text-[10px] text-[#6d7175] outline-none focus:border-[#458fff] truncate" />
                      </div>
                    ))}
                    {prodImages.length < 3 && (
                      <button type="button" onClick={() => setProdImages(prev => [...prev, ""])} className="aspect-square rounded-xl border-2 border-dashed border-[#c9cccf] hover:border-[#458fff] hover:bg-[#eef2ff] flex flex-col items-center justify-center gap-1 transition cursor-pointer">
                        <Plus className="w-5 h-5 text-[#8c9196]" />
                        <span className="text-[9px] text-[#8c9196]">Add image</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Stock */}
                <div>
                  <label className="block text-xs font-semibold text-[#202223] mb-1.5">Stock status</label>
                  <div className="flex gap-2">
                    {["in_stock","low_stock","out_of_stock"].map(st => (
                      <button key={st} type="button" onClick={() => setProdStock(st as any)} className={`flex-1 py-2 text-[10px] font-semibold rounded-xl border cursor-pointer transition ${prodStock === st ? "border-[#000000] bg-[#e8f0ff] text-[#000000]" : "border-[#e1e3e5] text-[#6d7175] hover:bg-[#f6f6f7]"}`}>{st.replace("_"," ")}</button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-[#202223] mb-1.5">Tags (comma separated)</label>
                  <input type="text" value={prodTags} onChange={e => setProdTags(e.target.value)} placeholder="god, trending, custom" className="w-full border border-[#c9cccf] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#458fff] focus:ring-2 focus:ring-[#458fff]/20" />
                </div>

                {/* Flags */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[["Featured", prodFeatured, setProdFeatured], ["Trending", prodTrending, setProdTrending], ["New Arrival", prodNew, setProdNew], ["Best Seller", prodBest, setProdBest]].map(([label, val, setter]: any) => (
                    <label key={label as string} className={`flex items-center gap-2 text-xs font-semibold cursor-pointer select-none border rounded-xl px-3 py-2.5 transition ${val ? "bg-[#e8f0ff] border-[#000000] text-[#000000]" : "border-[#e1e3e5] text-[#6d7175] hover:bg-[#f6f6f7]"}`}>
                      <input type="checkbox" checked={val as boolean} onChange={e => setter(e.target.checked)} className="rounded accent-[#000000] hidden" />
                      {label as string}
                    </label>
                  ))}
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e1e3e5] flex items-center justify-end gap-3 shrink-0">
              <button onClick={resetProdForm} className="px-4 py-2.5 text-sm font-semibold text-[#6d7175] hover:text-[#202223] border border-[#e1e3e5] rounded-xl hover:bg-[#f6f6f7] transition cursor-pointer">
                Cancel
              </button>
              <button form="prod-modal-form" type="submit" className="flex items-center gap-2 px-6 py-2.5 text-sm font-black bg-[#000000] hover:bg-[#0052cc] text-white rounded-xl transition cursor-pointer shadow-sm">
                <Save className="w-4 h-4" />
                {editingProduct ? "Save Changes" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm transition-all animate-in slide-in-from-bottom-2 ${
            toast.type === "success"
              ? "bg-white/95 border-emerald-200 shadow-emerald-100/50"
              : "bg-[#fff4f4]/95 border-[#fed3d1] shadow-red-100/50"
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${toast.type === "success" ? "bg-emerald-100" : "bg-red-100"}`}>
              {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-[#d82c0d]" />}
            </div>
            <span className={`text-sm font-semibold flex-1 ${toast.type === "success" ? "text-[#202223]" : "text-[#d82c0d]"}`}>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck, CreditCard, Zap, CheckCircle,
  ChevronDown, MapPin, ArrowLeft, Truck, Lock, Banknote
} from "lucide-react";
import { CartItem, Order } from "../types";
import { addOrder, getNextOrderId } from "../utils/remoteStore";
import { trackInitiateCheckout, trackPurchase, generateEventId, getFbCookies } from "../utils/metaPixel";
import { saveAbandonedCart, deleteAbandonedCart, getVisitorSessionId, useVisitorTracking } from "../utils/useVisitorTracking";

// ─── Razorpay type declarations ────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
interface RazorpayOptions {
  key: string; amount: number; currency: string;
  name: string; description: string; image?: string; order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}
interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (r: { error: RazorpayErrorDetail }) => void): void;
}
interface RazorpayErrorDetail {
  code: string; description: string; source: string;
  step: string; reason: string;
  metadata: { order_id?: string; payment_id?: string };
}

const SUPABASE_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";
const EDGE_FN_URL      = `${SUPABASE_URL}/functions/v1/create-razorpay-order`;
const CAPI_EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/meta-capi`;

// ─── Payment methods ──────────────────────────────────────────────────────────
type PaymentMethod = "razorpay" | "cod" | null;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function createRazorpayOrder(
  amountInPaise: number
): Promise<{ order_id: string; key_id: string; amount: number; currency: string } | null> {
  try {
    const res = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ amount: amountInPaise, receipt: "rcpt_" + Date.now() }),
    });
    if (!res.ok) { const err = await res.json(); console.error("Edge fn error:", err); return null; }
    return await res.json();
  } catch (err) {
    console.error("Edge fn call error:", err);
    return null;
  }
}

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar Islands","Chandigarh","Delhi","Jammu & Kashmir","Ladakh",
  "Lakshadweep","Puducherry",
];

const COD_SHIPPING_FEE_TN    = 50;  // Tamil Nadu
const COD_SHIPPING_FEE_OTHER = 100;  // Rest of India

// ─── Reusable input styles ────────────────────────────────────────────────────
const inputCls =
  "w-full border border-zinc-300 rounded-xl px-4 py-3.5 text-sm text-zinc-900 bg-white outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/20 transition-all placeholder:text-zinc-400";

interface CheckoutPageProps {
  cartItems: CartItem[];
  onClearCart: () => void;
  onBack: () => void;
  freeShippingThreshold: number;
  onNavigate?: (page: string) => void;
  codEnabled?: boolean;
  coupons?: import("../types").CouponCode[];
  currencySymbol?: string;
  taxRate?: number;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  cartItems, onClearCart, onBack, freeShippingThreshold, onNavigate,
  codEnabled = true,
  coupons = [],
  currencySymbol = "₹",
  taxRate = 0,
}) => {
  const [pageStep, setPageStep] = useState<"form" | "success">("form");
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Contact
  const [email, setEmail]           = useState("");
  const [newsOffers, setNewsOffers] = useState(true);

  // Delivery
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [address, setAddress]       = useState("");
  const [apt, setApt]               = useState("");
  const [city, setCity]             = useState("");
  const [state, setState]           = useState("Tamil Nadu");
  const [pincode, setPincode]       = useState("");
  const [phone, setPhone]           = useState("");
  const [altPhone, setAltPhone]     = useState("");
  const [saveInfo, setSaveInfo]     = useState(false);

  // Payment method selection — COD disabled for new orders, Razorpay only
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("razorpay");

  // ── Pincode Serviceability ─────────────────────────────────────────────────
  const [svcInfo, setSvcInfo] = useState<{cod:boolean;prepaid:boolean;city:string;state:string} | null>(null);
  const [svcChecking, setSvcChecking] = useState(false);

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) { setSvcInfo(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSvcChecking(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/serviceable_pincodes?select=cod,prepaid,city,state&pincode=eq.${pincode}&limit=1`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok || cancelled) return;
        const rows: any[] = await res.json();
        if (cancelled) return;
        if (rows.length > 0) {
          setSvcInfo({ cod: rows[0].cod, prepaid: rows[0].prepaid, city: rows[0].city || "", state: rows[0].state || "" });
          // If Razorpay (only available method) becomes unavailable for this pincode, reset
          if (!rows[0].prepaid) setSelectedPayment(null);
          else if (!selectedPayment) setSelectedPayment("razorpay");
        } else {
          // Pincode not in table → allow prepaid only (safe fallback)
          setSvcInfo({ cod: false, prepaid: true, city: "", state: "" });
          if (!selectedPayment) setSelectedPayment("razorpay");
        }
      } catch { /* network error — don't block checkout */ }
      finally { if (!cancelled) setSvcChecking(false); }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); setSvcChecking(false); };
  }, [pincode]);

  // ── Live checkout field tracking for admin dashboard ─────────────────────
  const checkoutFieldsFilled = React.useMemo(() => {
    const filled: string[] = [];
    if (phone.length >= 10)         filled.push("phone");
    if (firstName.trim())           filled.push("name");
    if (email.includes("@"))        filled.push("email");
    if (address.trim().length > 3)  filled.push("address");
    if (/^\d{6}$/.test(pincode))    filled.push("pincode");
    if (city.trim())                filled.push("city");
    if (selectedPayment)            filled.push(`payment:${selectedPayment}`);
    return filled;
  }, [phone, firstName, email, address, pincode, city, selectedPayment]);

  useVisitorTracking({
    page: "checkout",
    cartCount: cartItems.reduce((a, i) => a + i.quantity, 0),
    checkoutFields: checkoutFieldsFilled,
  });

  // Payment
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [paymentError, setPaymentError]   = useState<string | null>(null);
  const [createdOrder, setCreatedOrder]   = useState<Order | null>(null);
  const [purchaseEventId, setPurchaseEventId] = useState<string>("");
  const purchaseFiredRef = useRef(false); // Guard: ensures Purchase fires ONLY ONCE

  // ─── Coupon state ─────────────────────────────────────────────────────────
  const [couponInput, setCouponInput]     = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<import("../types").CouponCode | null>(null);
  const [couponError, setCouponError]     = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  const subtotalRaw = cartItems.reduce((a, i) => a + i.product.price * i.quantity, 0);
  const totalQty    = cartItems.reduce((a, i) => a + i.quantity, 0);

  // ─── Multi-item automatic discount ───────────────────────────────────────
  // ₹50 off automatically when 2 or more items are in the cart
  const MULTI_ITEM_DISCOUNT = 50;
  const multiItemDiscount = totalQty >= 2 ? Math.min(MULTI_ITEM_DISCOUNT, subtotalRaw) : 0;

  const handleApplyCoupon = () => {
    setCouponError(""); setCouponSuccess("");
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find(c => c.code === code && c.active);
    if (!found) { setCouponError("Invalid or expired coupon code."); setAppliedCoupon(null); return; }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) { setCouponError("This coupon has expired."); setAppliedCoupon(null); return; }
    if (found.minOrder && subtotalRaw < found.minOrder) { setCouponError(`Min order ${currencySymbol}${found.minOrder} required for this coupon.`); setAppliedCoupon(null); return; }
    setAppliedCoupon(found);
    const disc = found.discountType === "percent" ? Math.round(subtotalRaw * found.discountValue / 100) : found.discountValue;
    setCouponSuccess(`Coupon applied! You save ${currencySymbol}${disc}.`);
  };

  const handleRemoveCoupon = () => { setAppliedCoupon(null); setCouponInput(""); setCouponError(""); setCouponSuccess(""); };

  const couponDiscount = appliedCoupon
    ? appliedCoupon.discountType === "percent"
      ? Math.round(subtotalRaw * appliedCoupon.discountValue / 100)
      : Math.min(appliedCoupon.discountValue, subtotalRaw)
    : 0;
  const subtotal = Math.max(0, subtotalRaw - couponDiscount - multiItemDiscount);
  const taxAmount = taxRate > 0 ? Math.round(subtotal * taxRate / 100) : 0;

  // ─── Shipping logic ───────────────────────────────────────────────────────
  // ALL payment methods → ₹50 for Tamil Nadu, ₹100 for all other states
  const isTamilNadu   = state === "Tamil Nadu";
  const codShippingFee = isTamilNadu ? COD_SHIPPING_FEE_TN : COD_SHIPPING_FEE_OTHER;

  const shippingCharge = (() => {
    if (subtotal === 0) return 0;
    return codShippingFee; // ₹50 TN / ₹100 other — applies to ALL payment methods
  })();
  // Safety: total must always include shipping fee
  const grandTotal = subtotal + shippingCharge + taxAmount;
  // Safety: COD total must always include shipping fee (guard against stale state)
  const codTotalGuard = selectedPayment === "cod" ? Math.max(grandTotal, subtotal + codShippingFee) : grandTotal;

  useEffect(() => {
    loadRazorpayScript();
    window.scrollTo(0, 0);
    trackInitiateCheckout({
      cartItems: cartItems.map((i) => ({
        productId: i.product.id,
        price: i.product.price,
        quantity: i.quantity,
      })),
      total: grandTotal,
    });

    // LOW-4: Pre-fill saved address on mount
    try {
      const saved = localStorage.getItem("fc_saved_address");
      if (saved) {
        const d = JSON.parse(saved);
        if (d.firstName) setFirstName(d.firstName);
        if (d.lastName) setLastName(d.lastName);
        if (d.address) setAddress(d.address);
        if (d.apt) setApt(d.apt);
        if (d.city) setCity(d.city);
        if (d.state) setState(d.state);
        if (d.pincode) setPincode(d.pincode);
        if (d.phone) setPhone(d.phone);
        if (d.altPhone) setAltPhone(d.altPhone);
        if (d.email) setEmail(d.email);
        setSaveInfo(true);
      }
    } catch {}
  }, []);

  // Meta Pixel + CAPI: Purchase
  useEffect(() => {
    if (pageStep === "success" && createdOrder && purchaseEventId && !purchaseFiredRef.current) {
      purchaseFiredRef.current = true;
      const timer = setTimeout(async () => {
        const cartPayload = cartItems.map((i) => ({
          productId: i.product.id,
          productName: i.product.title,
          price: i.product.price,
          quantity: i.quantity,
        }));

        trackPurchase({
          orderId: String(createdOrder.id),
          total: createdOrder.total,
          eventId: purchaseEventId,
          cartItems: cartPayload,
        });

        try {
          const { fbp, fbc } = getFbCookies();
          await fetch(CAPI_EDGE_FN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventName: "Purchase",
              eventId: purchaseEventId,
              eventTime: Math.floor(Date.now() / 1000),
              orderId: String(createdOrder.id),
              total: createdOrder.total,
              currency: "INR",
              contentIds: cartPayload.map((i) => i.productId),
              numItems: cartPayload.reduce((s, i) => s + i.quantity, 0),
              customerEmail: createdOrder.customerEmail,
              customerPhone: createdOrder.customerPhone,
              customerName: createdOrder.customerName,
              clientUserAgent: navigator.userAgent,
              fbp,
              fbc,
            }),
          });
        } catch (err) {
          if (import.meta.env.DEV) console.error("[CAPI] Server-side call failed:", err);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pageStep, createdOrder, purchaseEventId]);

  // Save abandoned cart (debounced 2s)
  const abandonedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!phone || phone.length < 6) return;
    if (abandonedTimer.current) clearTimeout(abandonedTimer.current);
    abandonedTimer.current = setTimeout(() => {
      saveAbandonedCart({
        sessionId:      getVisitorSessionId(),
        customerName:   `${firstName} ${lastName}`.trim(),
        customerPhone:  phone,
        customerAltPhone: altPhone.length === 10 ? altPhone : undefined,
        customerEmail:  email,
        city, state, pincode,
        items: cartItems.map(i => ({ id: i.product.id, name: i.product.title, qty: i.quantity, price: i.product.price })),
        total: grandTotal,
      });
    }, 2000);
    return () => { if (abandonedTimer.current) clearTimeout(abandonedTimer.current); };
  }, [phone, firstName, lastName, email, city, state, pincode]);

  const validate = (): boolean => {
    if (!selectedPayment)            { setPaymentError("Pincode serviceable ஆ இல்ல check பண்ணுங்க — prepaid delivery இந்த pincode-க்கு available இல்ல."); return false; }
    if (!lastName.trim())            { setPaymentError("Last name enter பண்ணுங்க.");           return false; }
    if (!address.trim())             { setPaymentError("Address enter பண்ணுங்க.");             return false; }
    if (!city.trim())                { setPaymentError("City enter பண்ணுங்க.");               return false; }
    if (!/^\d{6}$/.test(pincode))    { setPaymentError("6-digit PIN code enter பண்ணுங்க.");   return false; }
    if (!/^\d{10}$/.test(phone) || !/^[6-9]/.test(phone)) { setPaymentError("Enter a valid 10-digit mobile number starting with 6-9 (no leading 0 or country code)."); return false; }
    if (altPhone && (!/^\d{10}$/.test(altPhone) || !/^[6-9]/.test(altPhone))) { setPaymentError("Alternate phone must also be a valid 10-digit number starting with 6-9."); return false; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPaymentError("Enter a valid email address.");
      return false;
    }
    setPaymentError(null);
    return true;
  };

  // ─── COD order handler ────────────────────────────────────────────────────
  const handleCODOrder = async () => {
    setIsSubmitting(true);
    setPaymentError(null);
    try {
      // MEDIUM-4: Validate customText lengths
      for (const item of cartItems) {
        if (item.customText && item.customText.length > 30) {
          setPaymentError("Custom text is too long for one of your items. Max 30 characters.");
          setIsSubmitting(false);
          return;
        }
      }
      const fullName    = `${firstName} ${lastName}`.trim();
      const fullAddress = `${address}${apt ? ", " + apt : ""}`;

      const orderData: Omit<Order, "id"> = {
        items: cartItems, subtotal, shipping: codShippingFee, total: codTotalGuard,
        customerName: fullName, customerEmail: email, customerPhone: phone,
        customerAltPhone: altPhone.length === 10 ? altPhone : undefined,
        shippingAddress: fullAddress, city, state, pincode,
        paymentMethod: "cod", status: "pending",
        createdAt: new Date().toISOString(),
      };
      const orderId  = await getNextOrderId();
      const newOrder: Order = { id: orderId, ...orderData };
      await addOrder(newOrder);
      deleteAbandonedCart(getVisitorSessionId());
      // LOW-4: Save address if requested
      if (saveInfo) {
        localStorage.setItem("fc_saved_address", JSON.stringify({
          firstName, lastName, address, apt, city, state, pincode, phone, altPhone, email
        }));
      }
      setPurchaseEventId(generateEventId());
      setCreatedOrder(newOrder);
      setPageStep("success");
      onClearCart();

      // Auto-push to NimbusPost (non-blocking — success screen shows immediately)
      fetch(`${SUPABASE_URL}/functions/v1/nimbuspost-create-shipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ order: newOrder }),
      }).catch(() => { /* Admin can manually push if this fails */ });
    } catch (err) {
      if (import.meta.env.DEV) console.error("COD order error:", err);
      setPaymentError("Order place பண்ண முடியல. திரும்ப try பண்ணுங்க.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Razorpay signature verification ─────────────────────────────────────
  async function verifyRazorpaySignature(
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
    order?: Order
  ): Promise<{ verified: boolean; awb?: string; label?: string }> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-razorpay-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, order }),
        }
      );
      if (!res.ok) return { verified: false };
      const data = await res.json();
      return { verified: data.verified === true, awb: data.awb ?? undefined, label: data.label ?? undefined };
    } catch {
      return { verified: false };
    }
  }

  // ─── Razorpay order handler ───────────────────────────────────────────────
  const handleRazorpayOrder = async () => {
    setIsSubmitting(true);
    setPaymentError(null);
    try {
      // MEDIUM-4: Validate customText lengths
      for (const item of cartItems) {
        if (item.customText && item.customText.length > 30) {
          setPaymentError("Custom text is too long for one of your items. Max 30 characters.");
          setIsSubmitting(false);
          return;
        }
      }
      const rzpOrder = await createRazorpayOrder(grandTotal * 100);
      if (!rzpOrder) {
        setPaymentError("Payment gateway error. திரும்ப try பண்ணுங்க.");
        setIsSubmitting(false);
        return;
      }
      // MEDIUM-1: Proper SDK load check with user-facing error
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        setPaymentError("Payment gateway could not load. Please check your internet connection and try again.");
        setIsSubmitting(false);
        return;
      }

      const fullName    = `${firstName} ${lastName}`.trim();
      const fullAddress = `${address}${apt ? ", " + apt : ""}`;

      const options: RazorpayOptions = {
        key:         rzpOrder.key_id,
        amount:      rzpOrder.amount,
        currency:    rzpOrder.currency,
        name:        "FabCoverz",
        description: `${cartItems.length} item(s) — Premium Phone Cover`,
        image:       window.location.origin + "/assets/logo/logo.png",
        order_id:    rzpOrder.order_id,
        prefill:     { name: fullName, email, contact: phone },
        notes:       { shipping_address: fullAddress, city, state, pincode },
        theme:       { color: "#000000" },
        handler: async (response: RazorpaySuccessResponse) => {
          // Build order object first so we can pass it to verify for auto NimbusPost push
          const orderData: Omit<Order, "id"> = {
            items: cartItems, subtotal, shipping: shippingCharge, total: grandTotal,
            customerName: fullName, customerEmail: email, customerPhone: phone,
            customerAltPhone: altPhone.length === 10 ? altPhone : undefined,
            shippingAddress: fullAddress, city, state, pincode,
            paymentMethod: "razorpay", status: "pending",
            createdAt: new Date().toISOString(),
          };
          const orderId = await getNextOrderId();
          const newOrder: Order = { id: orderId, ...orderData };

          // Step 1: Verify Razorpay signature only (no NimbusPost yet — order not in DB)
          const { verified } = await verifyRazorpaySignature(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
            // intentionally NOT passing newOrder here — order must be saved first
          );
          if (!verified) {
            setPaymentError("Payment verification failed. Please contact support.");
            setIsSubmitting(false);
            return;
          }

          // Step 2: Save order to DB first (NimbusPost DB patch needs order to exist)
          await addOrder({ ...newOrder, status: "pending" });
          deleteAbandonedCart(getVisitorSessionId());
          // LOW-4: Save address if requested
          if (saveInfo) {
            localStorage.setItem("fc_saved_address", JSON.stringify({
              firstName, lastName, address, apt, city, state, pincode, phone, altPhone, email
            }));
          }

          // Step 3: Push to NimbusPost (non-blocking — order exists in DB now)
          fetch(`${SUPABASE_URL}/functions/v1/nimbuspost-create-shipment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ order: newOrder }),
          }).catch(() => { /* Admin can manually push if this fails */ });

          setPurchaseEventId(generateEventId());
          setCreatedOrder({ ...newOrder, status: "pending" });
          setPageStep("success");
          onClearCart();
          setIsSubmitting(false);
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            setPaymentError("Your payment was canceled. You can try again.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r: { error: RazorpayErrorDetail }) => {
        setPaymentError(`Payment failed: ${r.error.description}`);
        setIsSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      if (import.meta.env.DEV) console.error("Payment error:", err);
      setPaymentError("Unexpected error. திரும்ப try பண்ணுங்க.");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // HIGH-1: guard against double-submit
    if (cartItems.length === 0 || !validate()) return;
    if (selectedPayment === "cod") {
      await handleCODOrder();
    } else if (selectedPayment === "razorpay") {
      await handleRazorpayOrder();
    }
  };

  // ─── Shipping display helper ──────────────────────────────────────────────
  const ShippingDisplay = () => {
    if (shippingCharge === 0) return <span className="text-emerald-600 font-black italic">Free</span>;
    return <span className="font-bold text-zinc-900">₹{shippingCharge}.00</span>;
  };

  // ─── SUCCESS ──────────────────────────────────────────────────────────────
  if (pageStep === "success" && createdOrder) {
    const isCOD = createdOrder.paymentMethod === "cod";
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-[#000000]/10 border border-[#000000]/20 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle className="w-9 h-9 text-[#000000]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-950 tracking-tight">
              {isCOD ? "Order Placed!" : "Payment Successful!"}
            </h2>
            <p className="text-xs text-zinc-400 uppercase tracking-widest font-sans mt-2">
              Order ID: <span className="text-zinc-900 bg-zinc-100 px-2 py-1 rounded">{createdOrder.id}</span>
            </p>
          </div>

          {/* COD info banner */}
          {isCOD && (
            <div className="bg-[#000000]/5 border border-[#000000]/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <Banknote className="w-4 h-4 text-[#000000] shrink-0 mt-0.5" />
              <p className="text-xs text-[#000000] font-medium text-left leading-snug">
                Cash on Delivery order — ₹{createdOrder.total} (including ₹{createdOrder.shipping} shipping). Our delivery agent will collect the amount at your doorstep.
              </p>
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 text-left space-y-3">
            <h4 className="text-[10px] tracking-widest font-sans font-bold text-zinc-900 uppercase border-b border-zinc-200 pb-2">Order Confirmation</h4>
            <div className="space-y-2 text-xs font-sans font-semibold text-zinc-600">
              <div className="flex justify-between"><span>Recipient:</span><span className="text-zinc-950">{createdOrder.customerName}</span></div>
              {createdOrder.customerEmail && (
                <div className="flex justify-between"><span>Email:</span><span className="text-zinc-950">{createdOrder.customerEmail}</span></div>
              )}
              <div className="flex justify-between items-start gap-4">
                <span className="shrink-0">Delivery:</span>
                <span className="text-zinc-950 text-right">{createdOrder.shippingAddress}, {createdOrder.city}, {createdOrder.state} — {createdOrder.pincode}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                {isCOD
                  ? <span className="text-[#000000] font-sans font-black">CASH ON DELIVERY</span>
                  : <span className="text-[#000000] font-sans font-black">RAZORPAY — PAID</span>
                }
              </div>
              <div className="flex justify-between border-t border-dashed border-zinc-200 pt-2 font-black text-zinc-950 text-sm">
                <span>Grand Total:</span><span>₹{createdOrder.total}</span>
              </div>
            </div>
          </div>
          <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-4 text-[11px] font-medium text-zinc-500 flex items-center gap-2.5">
            <MapPin className="w-4 h-4 shrink-0 text-zinc-800" />
            <span className="text-left">
              {isCOD
                ? "Your order has been placed. You will receive a call for two-step confirmation shortly. Kindly attend the call."
                : "Your cover is in the print queue. Tracking details will be sent via SMS within 24 hours."
              }
            </span>
          </div>
          <div className="bg-[#000000]/5 border border-[#000000]/20 rounded-xl p-4 text-[11px] font-semibold text-[#000000] flex items-center gap-2.5">
            <Truck className="w-4 h-4 shrink-0 text-[#000000]" />
            <span className="text-left">
              Expected delivery: 5–7 working days from order confirmation.
            </span>
          </div>
          <button
            onClick={onBack}
            className="w-full bg-zinc-950 hover:bg-[#000000] text-white text-xs font-black tracking-widest uppercase py-4 rounded-xl transition-all"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // ─── CHECKOUT FORM ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── TOP BAR ── */}
      <div className="relative border-b border-zinc-200 px-4 py-4 flex items-center max-w-5xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#000000] text-xs font-semibold hover:underline z-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          <img src="/assets/logo/logo.png" alt="FabCoverz" className="h-8 w-auto object-contain" />
        </div>
      </div>

      {/* ── MULTI-ITEM DISCOUNT BANNER ── */}
      {multiItemDiscount > 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-gradient-to-r from-emerald-100 to-emerald-50 border-2 border-emerald-400 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm sm:text-base font-black text-emerald-800 leading-snug">
              Congratulations! ₹{multiItemDiscount} OFF applied — your bill is reduced for ordering more than one item.
            </p>
          </div>
        </div>
      )}


      {/* ── MOBILE ORDER SUMMARY TOGGLE ── */}
      <button
        type="button"
        onClick={() => setSummaryOpen(!summaryOpen)}
        className="lg:hidden w-full border-b border-zinc-200 bg-zinc-50 px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 text-[#000000] text-sm font-semibold">
          <span>Order summary</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${summaryOpen ? "rotate-180" : ""}`} />
        </div>
        <span
          key={grandTotal}
          className="text-zinc-900 font-black text-base animate-pulse"
          style={{ animationDuration: "0.5s", animationIterationCount: "1" }}
        >₹{grandTotal}.00</span>
      </button>

      {/* ── MOBILE ORDER SUMMARY DROPDOWN ── */}
      {summaryOpen && (
        <div className="lg:hidden border-b border-zinc-200 bg-zinc-50 px-4 py-4 space-y-4">
          {cartItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-14 h-14 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <img src={item.product.images?.[0] || "/placeholder.png"} alt={item.product.title} className="w-full h-full object-contain" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 truncate">{item.product.title}</p>
                <p className="text-[10px] text-zinc-400 font-sans">{item.selectedModel}</p>
              </div>
              <span className="text-sm font-black text-zinc-900 shrink-0">₹{item.product.price * item.quantity}.00</span>
            </div>
          ))}
          <div className="border-t border-zinc-200 pt-3 space-y-1.5 text-xs font-sans">
            <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span className="font-bold text-zinc-900">₹{subtotalRaw}.00</span></div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold"><span>Coupon ({appliedCoupon?.code})</span><span>-₹{couponDiscount}.00</span></div>
            )}
            {multiItemDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-black text-sm"><span>Multi-item discount</span><span>-₹{multiItemDiscount}.00</span></div>
            )}
            <div className="flex justify-between text-zinc-500">
              <span>Shipping</span>
              <span className="font-bold"><ShippingDisplay /></span>
            </div>
            <div className="flex justify-between font-black text-zinc-950 text-sm border-t border-dashed border-zinc-200 pt-2">
              <span>Total</span>
              <span><span className="text-xs text-zinc-400 font-normal mr-1">INR</span>₹{grandTotal}.00</span>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN 2-COL LAYOUT ── */}
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row">

        {/* LEFT — FORM */}
        <div className="flex-1 px-4 sm:px-8 lg:pr-14 py-8 lg:border-r border-zinc-200">
          <form onSubmit={handleSubmit} className="space-y-8" id="checkout-form">

            {/* ══ DELIVERY ══ */}
            <section className="space-y-3">
              <h2 className="text-xl font-black text-zinc-950">Delivery</h2>

              {/* Country/Region */}
              <div className="relative border border-zinc-300 rounded-xl bg-white overflow-hidden">
                <label className="absolute top-2 left-4 text-[10px] text-zinc-400 font-semibold pointer-events-none">Country/Region</label>
                <select className="w-full pt-6 pb-3 px-4 text-sm text-zinc-900 bg-transparent outline-none appearance-none cursor-pointer">
                  <option>India</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name (optional)" className={inputCls} />
                <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className={inputCls} />
              </div>

              {/* Address */}
              <input type="text" required value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className={inputCls} />

              {/* Apt */}
              <input type="text" value={apt} onChange={e => setApt(e.target.value)} placeholder="Apartment, suite, etc. (optional)" className={inputCls} />

              {/* City */}
              <input type="text" required value={city} onChange={e => setCity(e.target.value)} placeholder="City" className={inputCls} />

              {/* State */}
              <div className="relative border border-zinc-300 rounded-xl bg-white overflow-hidden">
                <label className="absolute top-2 left-4 text-[10px] text-zinc-400 font-semibold pointer-events-none">State</label>
                <select
                  value={state} onChange={e => setState(e.target.value)}
                  className="w-full pt-6 pb-3 px-4 text-sm text-zinc-900 bg-transparent outline-none appearance-none cursor-pointer"
                >
                  {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              </div>

              {/* PIN code */}
              <div className="space-y-1.5">
                <input
                  type="text" required maxLength={6} value={pincode}
                  onChange={e => setPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN code"
                  className={inputCls}
                />
                {/* Serviceability badge */}
                {svcChecking && /^\d{6}$/.test(pincode) && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400 px-1">
                    <div className="w-3 h-3 border-2 border-zinc-300 border-t-[#000000] rounded-full animate-spin" />
                    Checking delivery availability…
                  </div>
                )}
                {!svcChecking && svcInfo && /^\d{6}$/.test(pincode) && svcInfo.city && (
                  <div className="flex flex-wrap gap-2 px-1">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{svcInfo.city}{svcInfo.state ? `, ${svcInfo.state}` : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Phone (Primary — required) */}
              <div className="relative">
                <input
                  type="tel" required value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Phone number *"
                  className={`${inputCls} pr-12`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-zinc-300 rounded-full flex items-center justify-center">
                  <span className="text-zinc-400 text-[10px] font-black">?</span>
                </div>
              </div>

              {/* Alternate Phone */}
              <div className="space-y-2">
                <input
                  type="tel" value={altPhone}
                  onChange={e => setAltPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Alternate phone number (optional)"
                  className={inputCls}
                />
                <div className="flex items-start gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5">
                  <p className="text-[11px] text-zinc-500 font-medium leading-snug">
                    Adding an alternate number helps our delivery partner reach you faster.
                  </p>
                </div>
              </div>

              {/* Save info */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox" checked={saveInfo}
                  onChange={e => setSaveInfo(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#000000]"
                />
                <span className="text-sm text-zinc-700">Save this information for next time</span>
              </label>
            </section>

            {/* ══ PAYMENT ══ */}
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-black text-zinc-950">Payment</h2>
                <p className="text-xs text-zinc-400 mt-0.5">All transactions are secure and encrypted.</p>
              </div>

              {/* Not serviceable warning */}
              {svcInfo && !svcInfo.cod && !svcInfo.prepaid && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  <div>
                    <p className="text-sm font-black text-red-700">Delivery not available for this pincode</p>
                    <p className="text-xs text-red-500 mt-0.5">Unfortunately we can't deliver to {pincode} right now. Please try a nearby pincode or contact us for help.</p>
                  </div>
                </div>
              )}

              {/* No COD note — customizable product */}
              <div className="flex items-start gap-2.5 bg-[#000000]/5 border border-[#000000]/20 rounded-xl px-3.5 py-2.5">
                <Banknote className="w-4 h-4 text-[#000000] shrink-0 mt-0.5" />
                <p className="text-xs text-[#000000] font-semibold leading-snug">
                  Hence this is a customisable product, so we don't offer Cash on Delivery. Pay securely online via Razorpay.
                </p>
              </div>

              <div className="border border-zinc-200 rounded-2xl overflow-hidden">

                {/* ─── Razorpay (only payment option — no radio needed) ─── */}
                {(svcInfo === null || svcInfo.prepaid) && (
                <div className="flex items-start gap-3 px-4 py-4 bg-[#000000]/5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-sm font-bold text-zinc-900">Razorpay Payments</span>
                        <span className="text-xs text-zinc-500 ml-1">(UPI, Cards, Wallets)</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <img src="/assets/icons/upi.svg" alt="UPI" className="h-5 w-auto" />
                        <img src="/assets/icons/visa.svg" alt="VISA" className="h-5 w-auto" />
                        <img src="/assets/icons/mastercard.svg" alt="Mastercard" className="h-5 w-auto" />
                        <div className="bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 h-5 flex items-center">
                          <span className="text-[9px] font-black text-zinc-600">+18</span>
                        </div>
                      </div>
                    </div>
                    {/* Shipping charge badge for Razorpay */}
                    <div className="mt-1.5 inline-flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-0.5">
                      <Truck className="w-3 h-3 text-zinc-600" />
                      <span className="text-[10px] font-bold text-zinc-700">
                        Shipping: ₹{isTamilNadu ? 50 : 100} ({isTamilNadu ? "Tamil Nadu" : "Other States"})
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-100 text-center space-y-1.5">
                      <p className="text-xs text-zinc-500">
                        You'll be redirected to Razorpay to complete your purchase securely.
                      </p>
                      <div className="flex items-center justify-center gap-2 text-zinc-400">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-sans">UPI · Card · Net Banking · Wallets</span>
                      </div>
                    </div>
                  </div>
                </div>
                )}

              </div>
            </section>

            {/* ══ COUPON CODE ══ */}
            {coupons.length > 0 && (
              <section className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Coupon Code</p>
                </div>
                <div className="px-4 py-4 space-y-2">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black text-sm">{appliedCoupon.code}</span>
                        <span className="text-xs text-emerald-700 font-medium">{couponSuccess}</span>
                      </div>
                      <button onClick={handleRemoveCoupon} className="text-xs text-red-500 hover:underline cursor-pointer font-semibold">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                        placeholder="Enter coupon code"
                        className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#000000] focus:ring-2 focus:ring-[#000000]/10 uppercase"
                        onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                      />
                      <button onClick={handleApplyCoupon} className="bg-zinc-900 hover:bg-black text-white text-sm font-bold px-4 py-2.5 rounded-xl transition cursor-pointer">Apply</button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-500 font-medium">{couponError}</p>}
                </div>
              </section>
            )}

            {/* ══ TOTAL AMOUNT TO BE PAID ══ */}
            <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">
              <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Total Amount to be Paid</p>
              </div>
              <div className="px-4 py-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Product Price</span>
                  <span className="font-bold text-zinc-900">{currencySymbol}{subtotalRaw}.00</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600 font-semibold">Coupon ({appliedCoupon?.code})</span>
                    <span className="font-bold text-emerald-600">-{currencySymbol}{couponDiscount}.00</span>
                  </div>
                )}
                {multiItemDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600 font-black">Multi-item discount</span>
                    <span className="font-black text-emerald-600">-{currencySymbol}{multiItemDiscount}.00</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">GST / Tax ({taxRate}%)</span>
                    <span className="font-bold text-zinc-900">{currencySymbol}{taxAmount}.00</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Shipping</span>
                  <span className="font-bold text-zinc-900">₹{shippingCharge}.00</span>
                </div>
                <div className="border-t border-zinc-200 pt-2.5 flex items-center justify-between">
                  <span className="text-sm font-black text-zinc-900">Total</span>
                  <span className="text-lg font-black text-zinc-950">{currencySymbol}{grandTotal}.00</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {paymentError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-bold flex items-start gap-2">
                <span className="shrink-0 text-red-600 font-bold text-sm">!</span>
                <span>{paymentError}</span>
              </div>
            )}

            {/* SSL badge */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-[11px] font-semibold text-zinc-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-700 shrink-0" />
              <span>256-bit SSL · Razorpay Vault Protected · PCI-DSS Compliant</span>
            </div>

            {/* CTA BUTTON — changes label based on payment method */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-black tracking-widest uppercase py-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-[0.98] bg-[#007eff] hover:bg-[#0066cc] shadow-[0_4px_20px_rgba(0,126,255,0.3)]"
            >
              {isSubmitting ? (
                <span>OPENING PAYMENT GATEWAY...</span>
              ) : (
                <span>PAY NOW →</span>
              )}
            </button>

            {/* Footer links */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#000000] font-semibold pb-10">
              {[
                { label: "Refund policy", page: "policy-refund" },
                { label: "Shipping", page: "policy-shipping" },
                { label: "Privacy policy", page: "policy-privacy" },
                { label: "Terms of service", page: "policy-terms" },
                { label: "Contact", page: "home" },
              ].map(({ label, page }) => (
                <button key={label} type="button" onClick={() => onNavigate?.(page)} className="hover:underline">{label}</button>
              ))}
            </div>

          </form>
        </div>

        {/* RIGHT — ORDER SUMMARY (desktop) */}
        <div className="hidden lg:block w-[400px] shrink-0 bg-zinc-50 border-l border-zinc-200 px-8 py-10">
          <div className="sticky top-8 space-y-6">

            {/* Items list */}
            <div className="space-y-4">
              {cartItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                      <img
                        src={item.product.images?.[0] || "/placeholder.png"}
                        alt={item.product.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{item.product.title}</p>
                    <p className="text-[11px] text-zinc-400 font-sans">{item.selectedModel}</p>
                    {item.customText && (
                      <p className="text-[10px] text-[#000000] font-sans font-bold">"{item.customText}"</p>
                    )}
                  </div>
                  <span className="text-sm font-black text-zinc-900 shrink-0">₹{item.product.price * item.quantity}.00</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-zinc-200 pt-4 space-y-2 text-sm font-sans">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal · {totalQty} item{totalQty !== 1 ? "s" : ""}</span>
                <span className="font-black text-zinc-900">₹{subtotalRaw}.00</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Coupon ({appliedCoupon?.code})</span>
                  <span>-₹{couponDiscount}.00</span>
                </div>
              )}
              {multiItemDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-black">
                  <span>Multi-item discount</span>
                  <span>-₹{multiItemDiscount}.00</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-500">
                <span>Shipping</span>
                <ShippingDisplay />
              </div>
              {/* Shipping info */}
              <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 mt-1">
                <Truck className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span className="text-[10px] text-zinc-700 font-bold">
                  Shipping: ₹{isTamilNadu ? 50 : 100} ({isTamilNadu ? "Tamil Nadu" : "Other states"})
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4 flex justify-between items-center">
              <span className="text-base font-black text-zinc-950">Total</span>
              <div className="text-right">
                <span className="text-xs text-zinc-400 font-sans mr-1">INR</span>
                <span className="text-2xl font-black text-zinc-950">₹{grandTotal}.00</span>
              </div>
            </div>

            {/* Trust badge */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                Secured by Razorpay. Your payment info is encrypted and never stored on our servers.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
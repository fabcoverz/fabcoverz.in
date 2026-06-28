
import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

interface PolicyPageProps {
  page: "privacy" | "shipping" | "terms" | "refund";
  onGoBack: () => void;
}

export const PolicyPage: React.FC<PolicyPageProps> = ({
  page,
  onGoBack,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const pages = {
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "May 28, 2026",

      content: (
        <>
          <p className="text-xs text-zinc-500 mb-6">
            Last updated: May 28, 2026
          </p>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            FabCoverz independently operates and manages this website,
            including all products, services, payment systems, and customer
            experiences provided through the platform. This Privacy Policy
            explains how we collect, use, store, and protect your personal
            information when you browse our website, place orders, contact
            customer support, or interact with our services.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Information We Collect
          </h2>

          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-600 mb-6">
            <li>Name, phone number, email address, and shipping address.</li>
            <li>Order and payment related details.</li>
            <li>Device information such as browser and IP address.</li>
            <li>Website usage and interaction analytics.</li>
            <li>Customer support messages and inquiries.</li>
          </ul>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            How We Use Your Information
          </h2>

          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-600 mb-6">
            <li>To process and deliver your orders.</li>
            <li>To improve our website and shopping experience.</li>
            <li>To provide customer support.</li>
            <li>To send updates regarding orders and offers.</li>
            <li>To prevent fraud and unauthorized activity.</li>
          </ul>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Third-Party Services
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-4">
            We may share limited information with trusted third-party providers
            who help us operate our business efficiently.
          </p>

          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-600 mb-6">
            <li>Payment gateway providers.</li>
            <li>Shipping and logistics partners.</li>
            <li>Analytics and website performance tools.</li>
            <li>Communication and support platforms.</li>
          </ul>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Data Security
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            We use reasonable security practices to protect your information.
            However, no online service can guarantee absolute security.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Contact Us
          </h2>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 space-y-1">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:fabcoverz.in@gmail.com"
                className="text-[#000000] hover:underline"
              >
                fabcoverz.in@gmail.com
              </a>
            </p>

            <p>
              <strong>WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/917418152926"
                target="_blank"
                rel="noreferrer"
                className="text-[#000000] hover:underline"
              >
                +91 7418152926
              </a>
            </p>

            <p>
              <strong>Location:</strong> Tiruppur, Tamil Nadu, India
            </p>
          </div>
        </>
      ),
    },

    shipping: {
      title: "Shipping Policy",
      lastUpdated: "May 28, 2026",

      content: (
        <>
          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            Thank you for shopping with FabCoverz. We aim to deliver your
            customized products safely and efficiently across India.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Processing Time
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            Orders are generally processed within 24–72 hours after successful
            payment confirmation.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Delivery Time
          </h2>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-bold text-zinc-900">
              Estimated Delivery:
              <span className="text-[#000000]">
                {" "}
                7 – 15 Business Days
              </span>
            </p>

            <p className="text-xs text-zinc-500 mt-2">
              Delivery times may vary based on location, courier delays, or
              unexpected circumstances.
            </p>
          </div>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Order Tracking
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            Tracking details will be shared once your order has been shipped.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Address Accuracy
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            Customers are responsible for providing accurate shipping details.
            FabCoverz is not responsible for delivery issues caused by
            incorrect addresses or unavailable recipients.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Contact Us
          </h2>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 space-y-1">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:fabcoverz.in@gmail.com"
                className="text-[#000000] hover:underline"
              >
                fabcoverz.in@gmail.com
              </a>
            </p>

            <p>
              <strong>WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/917418152926"
                target="_blank"
                rel="noreferrer"
                className="text-[#000000] hover:underline"
              >
                +91 7418152926
              </a>
            </p>
          </div>
        </>
      ),
    },

    terms: {
      title: "Terms of Service",
      lastUpdated: "May 28, 2026",

      content: (
        <>
          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Acceptance of Terms
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            By accessing or using FabCoverz, you agree to comply with these
            Terms of Service.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Website Usage
          </h2>

          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-600 mb-6">
            <li>Unauthorized use of the website is prohibited.</li>
            <li>Fraudulent activities may result in legal action.</li>
            <li>
              Website content may not be copied without permission.
            </li>
          </ul>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Customized Products
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            All FabCoverz products are custom-made or printed on demand.
            Orders cannot be canceled once production begins.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Product Variations
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            Slight differences in color, brightness, or print placement may
            occur due to manufacturing processes and screen settings.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Limitation of Liability
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            FabCoverz strives to provide accurate product previews and reliable
            customer support. Minor technical interruptions or visual
            variations may occasionally occur.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Branding
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            FabCoverz may include subtle branding elements on packaging or
            inserts for brand identification and quality assurance purposes.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Contact Us
          </h2>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 space-y-1">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:fabcoverz.in@gmail.com"
                className="text-[#000000] hover:underline"
              >
                fabcoverz.in@gmail.com
              </a>
            </p>

            <p>
              <strong>WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/917418152926"
                target="_blank"
                rel="noreferrer"
                className="text-[#000000] hover:underline"
              >
                +91 7418152926
              </a>
            </p>
          </div>
        </>
      ),
    },

    refund: {
      title: "Refund Policy",
      lastUpdated: "May 28, 2026",

      content: (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-800 font-semibold">
              Customized products cannot be canceled once the order is placed.
            </p>
          </div>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            Since all FabCoverz products are custom-made, slight differences
            in color, brightness, texture, or placement may occur.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Damaged Products
          </h2>

          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            If you receive a damaged, defective, or incorrect product,
            contact us within 48 hours with photos and an unboxing video.
          </p>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Eligible For Replacement
          </h2>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 space-y-2">
            <p className="text-xs text-emerald-800 font-semibold">
              [YES] Wrong product received
            </p>

            <p className="text-xs text-emerald-800 font-semibold">
              [YES] Damaged product received
            </p>

            <p className="text-xs text-emerald-800 font-semibold">
              [YES] Incorrect mobile model delivered
            </p>
          </div>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Not Eligible For Refund
          </h2>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-6 space-y-2">
            <p className="text-xs text-zinc-600">
              [NO] Minor color differences
            </p>

            <p className="text-xs text-zinc-600">
              [NO] Low-quality uploaded images
            </p>

            <p className="text-xs text-zinc-600">
              [NO] Slight print alignment variations
            </p>

            <p className="text-xs text-zinc-600">
              [NO] Incorrect model selected by customer
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
            <p className="text-xs text-amber-800 font-bold">
              WARNING: Unboxing video is mandatory for all damage claims.
            </p>
          </div>

          <h2 className="text-base font-bold text-zinc-900 uppercase tracking-wide mt-8 mb-3">
            Contact Us
          </h2>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 space-y-1">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:fabcoverz.in@gmail.com"
                className="text-[#000000] hover:underline"
              >
                fabcoverz.in@gmail.com
              </a>
            </p>

            <p>
              <strong>WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/917418152926"
                target="_blank"
                rel="noreferrer"
                className="text-[#000000] hover:underline"
              >
                +91 7418152926
              </a>
            </p>
          </div>
        </>
      ),
    },
  };

  const { title, lastUpdated, content } = pages[page];

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
          <button
            onClick={onGoBack}
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-700 uppercase tracking-wide bg-transparent border-none cursor-pointer mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase rounded-md mb-3">
            Legal
          </span>

          <h1 className="text-2xl md:text-3xl font-sans font-black uppercase tracking-tight text-zinc-900">
            {title}
          </h1>

          {lastUpdated && (
            <p className="text-xs text-zinc-400 mt-2 font-sans">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
        <div className="prose-sm max-w-none">{content}</div>
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-10 pb-16">
        <div className="border-t border-zinc-100 pt-8 text-center">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} FabCoverz. All rights reserved.
          </p>

          <p className="text-xs text-zinc-400 mt-1">
            <a
              href="mailto:fabcoverz.in@gmail.com"
              className="text-[#000000] hover:underline"
            >
              fabcoverz.in@gmail.com
            </a>
            {" · "}
            <a
              href="tel:+917418152926"
              className="text-[#000000] hover:underline"
            >
              +91 7418152926
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { getFAQs } from "../utils/localStore";
import { FAQItem } from "../types";

const FALLBACK_FAQS: FAQItem[] = [
  {
    id: "faq-1",
    question: "Are these covers hard or soft? What material is used?",
    answer: "FabCoverz utilizes premium 'Metal Glossy Cases'. The sides are made of soft impact-absorbent TPU bumper nodes (providing legendary 10ft drop protection) whereas the back print face is a toughened premium scratch-resistant panel with a magnificent glossy metallic finish. This prevents fading and turns your phone case into a stunning glossy showcase."
  },
  {
    id: "faq-2",
    question: "How do I customize my name on Name Cases?",
    answer: "Choose any product inside our 'Name Cases' collection. On that product page, a text field named 'Enter Name/Initial' will appear. Simply type your initials or name! The live preview will dynamically update to reflect your name in cursive lettering. We will print it exactly as configured."
  },
  {
    id: "faq-3",
    question: "What is your Shipping Timeline & Delivery Cost?",
    answer: "We support FREE online payment delivery across India! Secure electronic payments are supported with all major Credit/Debit Cards, UPI (GPay, PhonePe, Paytm, BHIM), and NetBanking. Standard order processing takes 24 hours and delivery takes 3 to 5 business days depending on your location."
  },
  {
    id: "faq-4",
    question: "What is your Refund & Exchange policy?",
    answer: "Since customizable name cases and initial covers are uniquely crafted to order, we do not support standard buyer-remorse refunds. However, if your cover arrives damaged or has print defects, we provide a 100% Free Replacements guarantee! Simply photograph the defect and notify our support team within 7 days."
  },
  {
    id: "faq-5",
    question: "Murugan phone case FabCoverz-ல கிடைக்குமா?",
    answer: "ஆமா! FabCoverz-ல Lord Murugan, Ganesha, Shiva, Hanuman, Durga, Krishna உட்பட அனைத்து god phone cases கிடைக்கும். Premium metal glossy finish-ல high-definition print பண்ணி India across fast delivery பண்றோம்."
  },
  {
    id: "faq-6",
    question: "TVK phone case எங்க கிடைக்கும்? (Where to buy TVK phone cases?)",
    answer: "FabCoverz-ல TVK Vijay party themed phone cases கிடைக்கும். Premium glossy finish, vibrant colors, fast delivery across Tamil Nadu and India. iPhone, Samsung, OnePlus உட்பட 15+ brands support பண்றோம்."
  },
  {
    id: "faq-7",
    question: "Which phone models are supported by FabCoverz?",
    answer: "FabCoverz supports 15+ brands including Apple iPhone (13 to 16 Pro Max), Samsung Galaxy (S21 to S25 series), OnePlus, Realme, Redmi, Poco, Vivo, Oppo, Motorola and more — over 900 models in total."
  },
  {
    id: "faq-8",
    question: "FabCoverz cases price என்ன? (What is the price?)",
    answer: "FabCoverz phone cases ₹199 முதல் கிடைக்கும். ₹499-க்கு மேல் order பண்ணா free shipping கிடைக்கும். UPI, Card, Net Banking, Wallets எல்லா online payment methods (Razorpay) support பண்றோம். இது customisable product ஆனதால் Cash on Delivery இல்ல."
  },
];

// Inject FAQ JSON-LD for Google rich results
function injectFAQSchema(faqs: FAQItem[]) {
  const old = document.getElementById("homepage-faq-ld");
  if (old) old.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "homepage-faq-ld";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer },
    })),
  });
  document.head.appendChild(script);
}

export const FAQSection: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQItem[]>(FALLBACK_FAQS);
  const [openId, setOpenId] = useState<string | null>("faq-1");

  useEffect(() => {
    getFAQs().then(localFaqs => {
      const active = localFaqs.length > 0 ? localFaqs : FALLBACK_FAQS;
      setFaqs(active);
      injectFAQSchema(active);
    });
    // Inject immediately with fallback too
    injectFAQSchema(FALLBACK_FAQS);
    return () => { document.getElementById("homepage-faq-ld")?.remove(); };
  }, []);

  return (
    <section className="py-16 bg-white border-t border-zinc-200" id="faqs">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-zinc-900 text-white text-[9px] font-sans tracking-[0.2em] uppercase select-none mb-3 rounded-md">
            CUSTOMER QUERIES
          </span>
          <h2 className="text-3xl font-sans tracking-tight font-black text-zinc-900 mt-4 uppercase">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-zinc-400 mt-2 max-w-xl mx-auto">
            Everything you need to know about our premium glossy casings and standard checkout procedures.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div 
                key={faq.id} 
                className={`bg-white rounded-xl border border-zinc-200 transition-all duration-300 ${
                  isOpen ? "border-zinc-400" : "border-zinc-200"
                }`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left font-sans font-semibold text-zinc-850 hover:text-zinc-950 transition-colors cursor-pointer select-none"
                  id={`faq-btn-${faq.id}`}
                >
                  <div className="flex items-center gap-4">
                     <span className="text-sm font-bold uppercase tracking-wide">{faq.question}</span>
                  </div>
                  <div className="shrink-0 p-1.5 rounded-lg bg-zinc-100 text-zinc-500">
                    {isOpen ? <Minus className="w-3.5 h-3.5 text-zinc-900" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-0 text-xs text-zinc-500 leading-relaxed font-sans animate-fade-in border-t border-zinc-100 mt-1">
                    <p className="pt-3 font-normal">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

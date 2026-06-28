import React, { useEffect, useRef, useState } from "react";
import { X, ChevronsRight } from "lucide-react";

interface UpsellModalProps {
  isOpen: boolean;
  onAddAnother: () => void;
  onCheckout: () => void;
  discount: number;
}

const AUTO_CHECKOUT_SECONDS = 10;

export const UpsellModal: React.FC<UpsellModalProps> = ({
  isOpen,
  onAddAnother,
  onCheckout,
  discount,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CHECKOUT_SECONDS);

  const onCheckoutRef = useRef(onCheckout);
  onCheckoutRef.current = onCheckout;

  useEffect(() => {
    if (!isOpen) return;
    setSecondsLeft(AUTO_CHECKOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCheckoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"
        onClick={onCheckout}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden">

        {/* Close button */}
        <button
          onClick={onCheckout}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-zinc-900 hover:bg-zinc-700 rounded-full transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="px-7 py-8 flex flex-col items-center text-center">
          {/* Special Offer badge image */}
          <img
            src="/assets/upsell/special-offer.png"
            alt="Special Offer"
            className="w-40 sm:w-44 select-none pointer-events-none mb-3"
            draggable={false}
          />

          {/* Headline */}
          <h2 className="text-xl font-extrabold text-zinc-900 leading-snug mb-6">
            Add One More Product On Cart
            <br />
            To Get &#8377;{discount} Discount
          </h2>

          {/* Action buttons */}
          <div className="w-full space-y-3">
            {/* Add another product — orange gradient pill with circular arrow */}
            <button
              onClick={onAddAnother}
              className="relative w-full flex items-center justify-center text-zinc-900 text-base font-extrabold py-3.5 rounded-full cursor-pointer transition-transform hover:scale-[1.02]"
              style={{
                background: "linear-gradient(180deg, #ffd23f 0%, #ffa800 100%)",
                boxShadow: "0 4px 14px rgba(255,168,0,0.45)",
              }}
            >
              <span>Add One More Product</span>
              <span
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center bg-white"
              >
                <ChevronsRight className="w-5 h-5" style={{ color: "#ffa800" }} />
              </span>
            </button>

            {/* No thanks — outlined pill */}
            <button
              onClick={onCheckout}
              className="w-full flex flex-col items-center justify-center text-zinc-900 text-base font-extrabold py-3.5 rounded-full cursor-pointer border-2 border-zinc-900 transition-colors hover:bg-zinc-50"
            >
              <span>No Thanks, Proceed To Checkout</span>
              <span className="text-[11px] font-bold tracking-normal opacity-70 tabular-nums mt-0.5">
                00:{String(secondsLeft).padStart(2, "0")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

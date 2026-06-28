import React, { useState } from "react";
import {
  X, ShoppingBag, Trash2, ArrowRight, Truck, Tag
} from "lucide-react";
import { CartItem } from "../types";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  freeShippingThreshold: number;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  freeShippingThreshold,
  onCheckout,
}) => {
  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const grandTotal = subtotal;
  const totalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const MULTI_ITEM_DISCOUNT = 50;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <div
        className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl flex flex-col rounded-l-2xl border-l border-zinc-200">

        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-200 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-zinc-900" />
            <h2 className="text-sm font-black text-zinc-900 tracking-tight uppercase">
              SHOPPING CART ({cartItems.length} items)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer border border-transparent hover:border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 uppercase font-sans select-none">
              <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto animate-pulse" />
              <p className="text-xs font-bold text-zinc-900 mt-4 tracking-widest uppercase">Your cart is empty</p>
              <p className="text-[10px] text-zinc-400 mt-1 font-sans tracking-tight lowercase">Add beautiful templates from our categories</p>
              <button
                onClick={onClose}
                className="mt-8 bg-zinc-900 hover:bg-zinc-800 text-[10px] text-white uppercase font-black tracking-widest py-3 px-6 rounded-xl cursor-pointer"
              >
                Start Exploring
              </button>
            </div>
          ) : (
            <>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-xs font-semibold text-zinc-600 flex items-center gap-2.5">
                <Truck className="w-4 h-4 shrink-0 text-zinc-500" />
                <span>Shipping: ₹50 (Tamil Nadu) · ₹100 (Other States)</span>
              </div>

              {totalQty === 1 ? (
                <div className="relative bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-400 rounded-lg p-2.5 flex items-center gap-2 shadow-sm animate-pulse" style={{ animationDuration: "2s" }}>
                  <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                    <Tag className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-xs font-bold text-amber-800 leading-snug">
                    Add one more product to get <span className="text-xs underline">₹{MULTI_ITEM_DISCOUNT} OFF</span> on your order!
                  </p>
                </div>
              ) : (
                <div className="relative bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-400 rounded-lg p-2.5 flex items-center gap-2 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Tag className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-xs font-bold text-emerald-800 leading-snug">
                    ₹{MULTI_ITEM_DISCOUNT} multi-item discount applied — you're saving on this order!
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {cartItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-zinc-50/50 hover:bg-zinc-50 transition-all"
                  >
                    <div className="w-16 h-16 bg-zinc-100/40 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      <img
                        src={item.product.images?.[0] || "/placeholder.png"}
                        alt={item.product.title}
                        className="w-full h-full object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-zinc-900 tracking-tight truncate">{item.product.title}</h4>
                      <p className="text-[10px] font-sans font-bold text-zinc-400 mt-1 uppercase">Model: {item.selectedModel}</p>
                      {item.customText && (
                        <p className="text-[10px] font-sans font-black text-[#000000] mt-0.5 uppercase">Text: "{item.customText}"</p>
                      )}
                      {item.customerImage && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <img src={item.customerImage} alt="Your photo" className="w-8 h-8 rounded object-cover border border-zinc-200" />
                          <span className="text-[9px] text-zinc-400 font-bold">Your photo added</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3.5">
                        <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => onUpdateQty(index, item.quantity - 1)}
                            className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold border-r border-zinc-200 cursor-pointer text-xs"
                          >-</button>
                          <span className="px-3 text-xs font-sans font-black text-zinc-800">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQty(index, item.quantity + 1)}
                            className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold border-l border-zinc-200 cursor-pointer text-xs"
                          >+</button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-sans font-black text-zinc-900">₹{item.product.price * item.quantity}</span>
                          <button
                            onClick={() => onRemoveItem(index)}
                            className="text-zinc-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-xl cursor-pointer border border-transparent hover:border-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-zinc-200 bg-zinc-50 sticky bottom-0 z-20 space-y-4 rounded-tl-2xl">
            <div className="space-y-2 font-sans text-[11px] font-bold text-zinc-500">
              <div className="flex justify-between">
                <span>CART SUBTOTAL:</span>
                <span className="text-zinc-950">₹{subtotal}</span>
              </div>
              {totalQty >= 2 && (
                <div className="flex justify-between text-emerald-600 text-sm font-black">
                  <span>MULTI-ITEM DISCOUNT:</span>
                  <span>-₹{Math.min(MULTI_ITEM_DISCOUNT, subtotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>DELIVERY:</span>
                <span className="text-zinc-700 font-black">₹50–₹100</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-black text-zinc-950">
                <span>TOTAL:</span>
                <span>₹{Math.max(0, subtotal - (totalQty >= 2 ? Math.min(MULTI_ITEM_DISCOUNT, subtotal) : 0))}</span>
              </div>
            </div>
            <button
              onClick={() => { onClose(); onCheckout(); }}
              className="w-full bg-zinc-950 hover:bg-[#000000] text-white text-xs font-black tracking-widest uppercase py-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <span>PROCEED TO SECURE CHECKOUT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

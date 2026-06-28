import React, { useState } from "react";
import { 
  ShoppingBag, Search,
  Menu, X
} from "lucide-react";
import { CartItem, StoreSettings } from "../types";

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  cartCount: number;
  onOpenCart: () => void;
  onOpenSearch: () => void;
  settings?: StoreSettings | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  currentPage,
  cartCount,
  onOpenCart,
  onOpenSearch,
  settings,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: "Home", page: "home" },
    { label: "Collections", page: "collections" },
    { label: "Our Snaps", page: "our_snaps" },
    { label: "Track Order", page: "track_order" },
    { label: "About Us", page: "#about-us" },
    { label: "Customer Reviews", page: "#reviews" },
    { label: "Contact", page: "#contact" },
  ];

  const handleLinkClick = (page: string) => {
    setMobileMenuOpen(false);
    if (page.startsWith("#")) {
      if (currentPage === "home") {
        const el = document.getElementById(page.replace("#", ""));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        onNavigate("home");
        setTimeout(() => {
          const el = document.getElementById(page.replace("#", ""));
          if (el) {
            el.scrollIntoView({ behavior: "smooth" });
          }
        }, 300);
      }
    } else {
      onNavigate(page);
    }
  };

  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-zinc-100 z-40 transition-shadow select-none">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex justify-between items-center h-16 md:h-18">
          
          {/* Logo Brand Title (Editorial style) */}
          <div className="flex items-center gap-10">
            <button
              onClick={() => handleLinkClick("home")}
              className="flex items-center gap-3 bg-transparent border-none p-0 cursor-pointer select-none text-left"
              id="brand-logo-btn"
            >
              <img 
                src={settings?.logoUrl || "/assets/logo/logo.png"} 
                alt="FabCoverz Logo" 
                className="h-10 w-auto object-contain shrink-0 rounded-xl"
                referrerPolicy="no-referrer"
              />
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-8 text-[15px] font-black italic text-zinc-600 uppercase tracking-wide">
              {menuItems.map((item) => {
                const isActive = currentPage === item.page || (item.page === "collections" && currentPage === "collection_detail");
                return (
                  <button
                    key={item.page}
                    onClick={() => handleLinkClick(item.page)}
                    className={`hover:text-zinc-900 bg-transparent border-none py-1 cursor-pointer transition-all ${
                      isActive ? "text-zinc-900 border-b-2 border-[#000000]" : "text-zinc-500"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Action Icons right margin */}
          <div className="flex items-center gap-5">
            
            {/* Search icon */}
            <button
              onClick={onOpenSearch}
              className="p-2 text-zinc-700 hover:text-[#000000] transition-colors border-none cursor-pointer flex items-center justify-center bg-transparent"
              id="nav-search-btn"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Shopping cart trigger drawer badge */}
            <button
              onClick={onOpenCart}
              className="relative p-2 text-zinc-700 hover:text-[#000000] transition-colors border-none cursor-pointer flex items-center justify-center bg-transparent"
              id="nav-cart-btn"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#000000] text-white font-sans text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-ping-once">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Nav Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-zinc-50 rounded text-zinc-700 transition-colors bg-transparent border-none cursor-pointer"
              id="mobile-nav-toggle"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>
      </div>

      {/* MOBILE VERTICAL NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-100 bg-white p-6 space-y-4 animate-slide-up shadow-lg select-text absolute left-0 right-0">
          <ul className="space-y-4 text-xs font-sans font-black tracking-widest uppercase">
            {menuItems.map((item) => {
              const isActive = currentPage === item.page;
              return (
                <li key={item.page}>
                  <button
                    onClick={() => handleLinkClick(item.page)}
                    className={`w-full text-left py-1 hover:text-[#000000] bg-transparent border-none cursor-pointer transition-colors ${
                      isActive ? "text-[#000000] font-black" : "text-zinc-600"
                    }`}
                  >
                    ● {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </header>
  );
};

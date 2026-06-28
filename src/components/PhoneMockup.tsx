import React from "react";
import { Eye, Heart, Flame, Sparkles, Gamepad2, Camera, Palette, Moon } from "lucide-react";

interface PhoneMockupProps {
  designId?: string; // e.g. 'mandala', 'ganesha', 'anime', 'tvk-vijay', 'minimal-slate', 'islamic-sabr', 'girly-love'
  customText?: string; // Custom typed text for Name Cases
  accentColor?: string; // Optional backing color
  size?: "sm" | "md" | "lg" | "xl"; // sizing preset
  phoneModel?: string; // 'iPhone', 'Samsung S24', etc.
  className?: string;
  gradientSeed?: string; // For rendering beautiful SVG/CSS procedural backings
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  designId = "default",
  customText = "",
  size = "md",
  phoneModel = "iPhone 15 Pro",
  className = "",
}) => {
  // Map size classes
  const sizeMap = {
    sm: "w-32 h-[260px]",
    md: "w-48 h-[390px]",
    lg: "w-64 h-[510px]",
    xl: "w-72 h-[570px]",
  };

  const selectedSize = sizeMap[size];

  // Specific sizing config to ensure perfect proportions of the iPhone details
  const config = {
    sm: {
      innerInset: "inset-[3.5px]",
      innerRadius: "rounded-[25px]",
      bezelRadius: "rounded-[28px]",
      cameraBump: "w-[30px] h-[30px] rounded-[9px] top-[10px] left-[10px] p-[1.5px]",
      lensSize: "w-[10px] h-[10px]",
      lensInner: "inset-[0.3px]",
      lensDot: "w-1 h-1",
      flashSize: "w-[4.5px] h-[4.5px]",
      lidarSize: "w-[4px] h-[4px]",
      micSize: "w-[2px] h-[2px]",
      lensPositions: {
        l1: { top: "2px", left: "2px" },
        l2: { bottom: "2px", left: "2px" },
        l3: { top: "8px", right: "2px" },
        flash: { top: "2px", right: "9px" },
        lidar: { bottom: "2.5px", right: "9px" },
      },
      textBottom: "bottom-[42px]",
      textFontSize: "text-[9px] tracking-normal",
      modelTag: "bottom-[5px] scale-[0.75]",
      btn1: "top-[40px] h-[15px]", // Action
      btn2: "top-[62px] h-[12px]", // Vol Up
      btn3: "top-[80px] h-[12px]", // Vol Down
      btnPower: "top-[52px] h-[18px]", // Power
    },
    md: {
      innerInset: "inset-[4.5px]",
      innerRadius: "rounded-[27px]",
      bezelRadius: "rounded-[31px]",
      cameraBump: "w-[46px] h-[46px] rounded-[13px] top-[14px] left-[14px] p-[2px]",
      lensSize: "w-[15px] h-[15px]",
      lensInner: "inset-[0.6px]",
      lensDot: "w-1.5 h-1.5",
      flashSize: "w-[7px] h-[7px]",
      lidarSize: "w-[6px] h-[6px]",
      micSize: "w-[3px] h-[3px]",
      lensPositions: {
        l1: { top: "3px", left: "3px" },
        l2: { bottom: "3px", left: "3px" },
        l3: { top: "12.5px", right: "3px" },
        flash: { top: "3px", right: "14px" },
        lidar: { bottom: "4px", right: "14px" },
      },
      textBottom: "bottom-[52px]",
      textFontSize: "text-[12px] tracking-wide",
      modelTag: "bottom-[6px] scale-[0.88]",
      btn1: "top-[60px] h-[22px]",
      btn2: "top-[90px] h-[16px]",
      btn3: "top-[112px] h-[16px]",
      btnPower: "top-[80px] h-[26px]",
    },
    lg: {
      innerInset: "inset-[5.5px]",
      innerRadius: "rounded-[30px]",
      bezelRadius: "rounded-[34px]",
      cameraBump: "w-[60px] h-[60px] rounded-[17px] top-[18px] left-[18px] p-[2.5px]",
      lensSize: "w-[20px] h-[20px]",
      lensInner: "inset-[0.8px]",
      lensDot: "w-2.5 h-2.5",
      flashSize: "w-[9px] h-[9px]",
      lidarSize: "w-[8px] h-[8px]",
      micSize: "w-[4px] h-[4px]",
      lensPositions: {
        l1: { top: "4px", left: "4px" },
        l2: { bottom: "4px", left: "4px" },
        l3: { top: "16px", right: "4px" },
        flash: { top: "4px", right: "18px" },
        lidar: { bottom: "5px", right: "18px" },
      },
      textBottom: "bottom-[64px]",
      textFontSize: "text-[16px] tracking-widest",
      modelTag: "bottom-[7px]",
      btn1: "top-[75px] h-[28px]",
      btn2: "top-[115px] h-[20px]",
      btn3: "top-[142px] h-[20px]",
      btnPower: "top-[100px] h-[34px]",
    },
    xl: {
      innerInset: "inset-[6px]",
      innerRadius: "rounded-[32px]",
      bezelRadius: "rounded-[36px]",
      cameraBump: "w-[68px] h-[68px] rounded-[19px] top-[20px] left-[20px] p-[3px]",
      lensSize: "w-[22px] h-[22px]",
      lensInner: "inset-[1px]",
      lensDot: "w-3 h-3",
      flashSize: "w-[10.5px] h-[10.5px]",
      lidarSize: "w-[9px] h-[9px]",
      micSize: "w-[4.5px] h-[4.5px]",
      lensPositions: {
        l1: { top: "4.5px", left: "4.5px" },
        l2: { bottom: "4.5px", left: "4.5px" },
        l3: { top: "18px", right: "4.5px" },
        flash: { top: "4.5px", right: "20.5px" },
        lidar: { bottom: "5.5px", right: "20.5px" },
      },
      textBottom: "bottom-[72px]",
      textFontSize: "text-[18px] tracking-widest",
      modelTag: "bottom-[8px]",
      btn1: "top-[85px] h-[32px]",
      btn2: "top-[130px] h-[22px]",
      btn3: "top-[160px] h-[22px]",
      btnPower: "top-[110px] h-[38px]",
    }
  };

  const c = config[size];

  // Procedural design renderers
  const renderDesignBacking = () => {
    // Standard checks for base64 data strings or full web URLs
    const isUploadedOrUrl = 
      designId.startsWith("http://") || 
      designId.startsWith("https://") || 
      designId.startsWith("data:") || 
      designId.startsWith("/") || 
      designId.includes(".") || 
      designId.includes("/");

    if (isUploadedOrUrl) {
      return (
        <div 
          className="absolute inset-0 bg-cover bg-center select-none" 
          style={{ backgroundImage: `url(${designId})` }}
        ></div>
      );
    }

    switch (designId) {
      case "god-ganesh":
      case "devotional-cases":
      case "cute-small-murugan":
        return (
          <div className="absolute inset-0 bg-gradient-to-b from-[#ff8c00] via-[#ff4500] to-[#b22222] flex flex-col items-center justify-center p-4">
            {/* Spiritual Mandala sun / abstract representation */}
            <div className="absolute w-32 h-32 rounded-full border border-orange-300 opacity-20 animate-spin-slow"></div>
            <div className="absolute w-24 h-24 rounded-full bg-yellow-400 opacity-10 filter blur-xl"></div>
            <div className="z-10 text-center text-yellow-100 flex flex-col items-center">
              <svg className="w-16 h-16 text-yellow-200 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2C6.477,2,2,6.477,2,12s4.477,10,10,10s10-4.477,10-10S17.523,2,12,2z M12,18c-1.105,0-2-0.895-2-2s0.895-2,2-2 s2,0.895,2,2S13.105,18,12,18z M12,12c-1.105,0-2-0.895-2-2s0.895-2,2-2s2,0.895,2,2S13.105,12,12,12z" />
              </svg>
              <p className="font-serif text-xs uppercase tracking-widest mt-2 font-bold text-yellow-300">DIVINE SHREE</p>
              <p className="text-[9px] text-yellow-100 opacity-80 italic mt-1 font-sans">Premium Faith series</p>
            </div>
          </div>
        );

      case "mandala-eye":
      case "trippy-mandala":
        return (
          <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center overflow-hidden">
            {/* Visual trippy circles */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(110,0,255,0.4)_0%,transparent_70%)]"></div>
            <div className="absolute w-44 h-44 rounded-full border border-purple-500 opacity-35 animate-spin-slow"></div>
            <div className="absolute w-36 h-36 rounded-full border border-dashed border-cyan-400 opacity-30 animate-spin-reverse-slow"></div>
            <div className="absolute w-24 h-24 rounded-full border border-pink-500 opacity-40"></div>
            <div className="z-10 text-center">
              <Eye className="w-8 h-8 text-cyan-400 animate-pulse mx-auto filter drop-shadow-[0_0_8px_rgba(0,126,255,0.8)]" />
              <p className="text-[10px] text-cyan-300 tracking-widest font-sans uppercase mt-2">TRIPPY MIND</p>
            </div>
          </div>
        );

      case "tvk-vijay":
      case "tvk-cases":
        return (
          <div className="absolute inset-0 bg-gradient-to-b from-[#8B0000] via-[#FF0000] to-[#FFD700] flex flex-col items-center justify-end p-6">
            {/* Elephant and star emblem background elements derived from TVK flag */}
            <div className="absolute top-1/3 w-28 h-28 rounded-full border border-yellow-400 opacity-20"></div>
            <div className="z-10 text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-200">
                <Sparkles className="w-8 h-8 text-yellow-100 animate-pulse mx-auto" />
              </div>
              <p className="font-sans font-black text-sm tracking-widest text-yellow-100 mt-2 leading-none drop-shadow-md">TVK LEADER</p>
              <p className="text-[9px] text-yellow-300 uppercase tracking-widest mt-1 font-sans">Official Glory Premium</p>
            </div>
          </div>
        );

      case "girly-love":
      case "girly-cases":
        return (
          <div className="absolute inset-0 bg-gradient-to-b from-pink-400 via-rose-300 to-pink-100 flex flex-col items-center justify-center p-4">
            <div className="absolute w-32 h-32 rounded-full bg-white opacity-20 filter blur-xl"></div>
            <div className="z-10 text-center">
              <Heart className="w-10 h-10 text-rose-500 fill-rose-500 filter drop-shadow-md animate-bounce mx-auto" />
              <p className="font-serif text-sm italic text-rose-600 mt-2 font-bold">Charming Love</p>
              <p className="text-[8px] uppercase tracking-widest text-rose-500 mt-1 font-sans">Sweet Edition</p>
            </div>
          </div>
        );

      case "anime-goku":
      case "anime-cases":
        return (
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500 via-orange-600 to-red-700 flex flex-col items-center justify-center p-4 overflow-hidden">
            {/* Radial blast lines */}
            <div className="absolute w-44 h-44 rounded-full border-4 border-yellow-400 opacity-20 animate-ping"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)]"></div>
            <div className="z-10 text-center">
              <Flame className="w-10 h-10 text-amber-400 fill-amber-500 filter drop-shadow-lg mx-auto" />
              <p className="font-sans font-extrabold text-[#ffd700] text-sm italic tracking-tighter uppercase mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">SAIYAN FORCE</p>
              <p className="text-[8px] text-white opacity-70 tracking-widest mt-1 font-sans">ULTRA ANIME</p>
            </div>
          </div>
        );

      case "islamic-sabr":
      case "sab-islamic":
        return (
          <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center p-4">
            <div className="w-20 h-20 rounded-full border border-amber-600/30 flex items-center justify-center">
              <Moon className="w-8 h-8 text-amber-500 fill-amber-500" />
            </div>
            <div className="z-10 text-center mt-3">
              <p className="font-serif text-xs tracking-[0.2em] text-amber-500 uppercase font-black">S A B R</p>
              <p className="text-[8px] text-neutral-400 font-sans tracking-widest mt-1">Faith & Patience Series</p>
            </div>
          </div>
        );

      case "minimal-slate":
      case "minimal-cases":
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-4">
            <div className="z-10 text-center">
              <p className="font-sans text-xs tracking-[0.4em] text-slate-400 uppercase font-bold">MINIMALIST</p>
              <div className="w-6 h-[1px] bg-slate-500 mx-auto my-2"></div>
              <p className="text-[8px] text-slate-500 font-sans">STEALTH EDITION</p>
            </div>
          </div>
        );

      case "transparent-cases":
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-white/95 to-slate-200/90 flex flex-col items-center justify-center p-4 border border-white/40">
            {/* Battery circle representing standard wireless magsafe magnet */}
            <div className="w-16 h-16 rounded-full border-2 border-slate-300 opacity-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-400 opacity-30"></div>
            </div>
            <div className="w-[2px] h-10 bg-slate-400/50 mt-1"></div>
            <div className="z-10 text-center mt-4">
              <p className="text-[8px] text-slate-500 font-sans uppercase tracking-widest font-semibold">Magsafe Metal Glossy</p>
            </div>
          </div>
        );

      case "gamer-neon":
      case "gaming-cases":
        return (
          <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center p-4 overflow-hidden">
            <div className="absolute inset-0 border-[2px] border-cyan-500/20 m-2 rounded-xl animate-pulse"></div>
            <div className="z-10 text-center">
              <Gamepad2 className="w-10 h-10 text-cyan-400 filter drop-shadow-[0_0_8px_rgba(0,255,255,0.8)] mx-auto" />
              <p className="font-sans font-black text-xs text-cyan-400 tracking-widest mt-2 uppercase">LEVEL UP</p>
              <p className="text-[8px] text-purple-400 tracking-widest font-sans">GAMING ARMOR</p>
            </div>
          </div>
        );

      case "custom-cases":
        return (
          <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300">
            <div className="z-10 text-center p-3 rounded-xl bg-white/70 backdrop-blur-xs">
              <Camera className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="font-sans text-[10px] text-slate-600 font-bold mt-1">Your Image Here</p>
              <p className="text-[8px] text-slate-400 font-sans mt-0.5">Drag & Drop print</p>
            </div>
          </div>
        );

      default:
        // Default standard eye-catching clean product design
        return (
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0052d4] via-[#4364f7] to-[#6fb1fc] flex flex-col items-center justify-center p-4">
            <div className="absolute -inset-10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2)_0%,transparent_50%50)]"></div>
            <div className="z-10 text-center">
              <Palette className="w-10 h-10 text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] mx-auto" />
              <p className="font-sans text-xs tracking-[0.2em] font-bold text-white uppercase mt-2">FAB COVERZ</p>
              <p className="text-[8px] text-white/70 font-sans tracking-wider mt-0.5">METAL GLOSSY</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className={`relative ${selectedSize} ${c.bezelRadius} bg-gradient-to-b from-[#2a2a2a] via-[#3d3d3d] to-[#121212] p-[1.5px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),_0_0_40px_rgba(0,0,0,0.1)] flex flex-col items-center justify-between overflow-hidden box-border select-none group transition-all duration-300 hover:scale-[1.03] ${className}`}
      style={{
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.65), inset 0 0 12px rgba(255,255,255,0.25)",
      }}
    >
      {/* Outer Titanium Trim Bezel Highlight */}
      <div className={`absolute ${c.innerInset} ${c.innerRadius} bg-[#0b0b0b] overflow-hidden flex flex-col items-center justify-between`}>
        
        {/* Dynamic Case Backing Design */}
        {renderDesignBacking()}

        {/* Diagonal Realistic 3D Glossy Finish Reflections (Gives extremely premium glass coat look) */}
        <div 
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.08] to-white/[0.22] pointer-events-none z-10"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 78%)"
          }}
        ></div>
        
        {/* Secondary subtle side reflections (adds curvilinear plastic look) */}
        <div className="absolute left-[3px] top-0 bottom-0 w-[1.5px] bg-white/10 pointer-events-none z-10"></div>
        <div className="absolute right-[3px] top-0 bottom-0 w-[1px] bg-white/5 pointer-events-none z-10"></div>

        {/* Ultra-realistic premium iPhone 15 Pro / 16 Pro triangular camera bump plate */}
        <div 
          className={`absolute ${c.cameraBump} bg-neutral-900/90 backdrop-blur-xl border border-white/15 shadow-xl z-30 transition-transform`}
          style={{
            boxShadow: "3px 3px 12px rgba(0,0,0,0.65), inset 1.5px 1.5px 3px rgba(255,255,255,0.25)"
          }}
        >
          {/* Concentric brushed metal backing plate for lens mounts */}
          <div className="relative w-full h-full rounded-[inherit] bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-800 flex items-center justify-center p-0.5 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]"></div>
            
            {/* LENS 1: Top-Left (Main Camera) */}
            <div 
              className={`${c.lensSize} absolute rounded-full bg-neutral-900 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.85),_0_1.5px_1px_rgba(255,255,255,0.2)] flex items-center justify-center border border-neutral-700`}
              style={{ top: c.lensPositions.l1.top, left: c.lensPositions.l1.left }}
            >
              <div className={`absolute ${c.lensInner} rounded-full ring-1 ring-white/15 bg-gradient-to-b from-neutral-500 to-neutral-800 p-[0.3px]`}>
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center relative overflow-hidden shadow-inner">
                  {/* Glass tint element */}
                  <div className="absolute top-0.5 left-0.5 w-[70%] h-[70%] bg-gradient-to-tr from-cyan-500/25 to-blue-500/40 rounded-full filter blur-[0.2px] pointer-events-none"></div>
                  <div className="absolute bottom-0.5 right-0.5 w-[50%] h-[50%] bg-gradient-to-br from-purple-500/15 to-transparent rounded-full filter blur-[0.2px] pointer-events-none"></div>
                  {/* Shiny central lens hole */}
                  <div className={`absolute ${c.lensDot} rounded-full bg-black border border-teal-500/40 flex items-center justify-center shadow-lg`}>
                    <div className="w-[1.5px] h-[1.5px] rounded-full bg-white/90 absolute top-0.5 left-0.5"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* LENS 2: Bottom-Left (Telephoto Main) */}
            <div 
              className={`${c.lensSize} absolute rounded-full bg-neutral-900 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.85),_0_1.5px_1px_rgba(255,255,255,0.2)] flex items-center justify-center border border-neutral-700`}
              style={{ bottom: c.lensPositions.l2.bottom, left: c.lensPositions.l2.left }}
            >
              <div className={`absolute ${c.lensInner} rounded-full ring-1 ring-white/15 bg-gradient-to-b from-neutral-500 to-neutral-800 p-[0.3px]`}>
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center relative overflow-hidden shadow-inner">
                  {/* Glass coating flare reflection */}
                  <div className="absolute top-0.5 left-0.5 w-[70%] h-[70%] bg-gradient-to-tr from-cyan-400/20 to-teal-500/35 rounded-full filter blur-[0.2px] pointer-events-none"></div>
                  <div className="absolute bottom-0.5 right-0.5 w-[50%] h-[50%] bg-gradient-to-br from-rose-500/20 to-transparent rounded-full filter blur-[0.2px] pointer-events-none"></div>
                  {/* Central physical lens */}
                  <div className={`absolute ${c.lensDot} rounded-full bg-black border border-sky-400/30 flex items-center justify-center shadow-lg`}>
                    <div className="w-[1.5px] h-[1.5px] rounded-full bg-white/95 absolute top-0.5 left-0.5"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* LENS 3: Middle-Right (Ultra Wide) */}
            <div 
              className={`${c.lensSize} absolute rounded-full bg-neutral-900 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.85),_0_1.5px_1px_rgba(255,255,255,0.2)] flex items-center justify-center border border-neutral-700`}
              style={{ top: c.lensPositions.l3.top, right: c.lensPositions.l3.right }}
            >
              <div className={`absolute ${c.lensInner} rounded-full ring-1 ring-white/15 bg-gradient-to-b from-neutral-500 to-neutral-800 p-[0.3px]`}>
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center relative overflow-hidden shadow-inner">
                  {/* Multi-coated antireflective glare */}
                  <div className="absolute top-0.5 left-0.5 w-[70%] h-[70%] bg-gradient-to-tr from-blue-500/30 to-rose-400/25 rounded-full filter blur-[0.2px] pointer-events-none"></div>
                  {/* Aperture central eye */}
                  <div className={`absolute ${c.lensDot} rounded-full bg-black border border-cyan-400/40 flex items-center justify-center shadow-lg`}>
                    <div className="w-[1.5px] h-[1.5px] rounded-full bg-white/90 absolute top-0.5 left-0.5"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dual True Tone LED Flash */}
            <div 
              className="absolute bg-neutral-950 rounded-full border border-neutral-800 flex items-center justify-center"
              style={{ 
                top: c.lensPositions.flash.top, 
                right: c.lensPositions.flash.right,
                width: c.flashSize,
                height: c.flashSize
              }}
            >
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-orange-200 via-yellow-105 to-orange-400 border border-yellow-300/30 flex items-center justify-center shadow-sm">
                <div className="w-1/3 h-1/3 rounded-full bg-yellow-500"></div>
              </div>
            </div>

            {/* LiDAR Depth Sensor */}
            <div 
              className="absolute bg-[#151515] rounded-full border border-neutral-800 flex items-center justify-center shadow-inner"
              style={{ 
                bottom: c.lensPositions.lidar.bottom, 
                right: c.lensPositions.lidar.right,
                width: c.lidarSize,
                height: c.lidarSize
              }}
            >
              <div className="w-4/5 h-4/5 rounded-full bg-[#050505] border border-neutral-900 flex items-center justify-center">
                {/* Subtle deep purple sensor reflection */}
                <div className="w-[1.5px] h-[1.5px] rounded-full bg-indigo-500/50"></div>
              </div>
            </div>

            {/* Tiny microphone mesh port */}
            <div 
              className="absolute bg-zinc-950 rounded-full shadow-inner flex items-center justify-center"
              style={{
                top: "50%",
                right: "22%",
                transform: "translateY(-50%)",
                width: c.micSize,
                height: c.micSize
              }}
            >
              <div className="w-[1px] h-[1px] rounded-full bg-zinc-800"></div>
            </div>

          </div>
        </div>

        {/* Dynamic Name Custom Lettering (For Personalized customized text name-cases) */}
        {(customText || designId.includes("name")) && (
          <div className={`absolute ${c.textBottom} left-0 right-0 px-3 py-1 flex justify-center z-20 pointer-events-none`}>
            <div className="w-full text-center py-1.5 px-0.5">
              <span 
                className={`font-serif italic ${c.textFontSize} tracking-wide block drop-shadow-[0_2.5px_5px_rgba(0,0,0,0.9)] filter text-white text-center font-bold`}
                style={{
                  fontFamily: "'Playfair Display', 'Brush Script MT', cursive, serif",
                  textShadow: "1.5px 1.5px 4px rgba(0,0,0,0.95), 0 0 10px rgba(255,255,255,0.45)"
                }}
              >
                {customText ? customText : "My Design"}
              </span>
            </div>
          </div>
        )}

        {/* Elegant Model tag on bottom trim margin is removed as per request */}
      </div>

      {/* Titanium Physical Button Trims - Perfectly Scaled & Positioned */}
      <div className={`absolute left-[-1px] w-[2px] bg-[#1a1a1a] border-r border-[#3d3d3d] rounded-r-xs shadow-xs ${c.btn1}`}></div>
      <div className={`absolute left-[-1px] w-[2px] bg-[#1a1a1a] border-r border-[#3d3d3d] rounded-r-xs shadow-xs ${c.btn2}`}></div>
      <div className={`absolute left-[-1px] w-[2px] bg-[#1a1a1a] border-r border-[#3d3d3d] rounded-r-xs shadow-xs ${c.btn3}`}></div>
      <div className={`absolute right-[-1px] w-[2px] bg-[#1a1a1a] border-l border-[#3d3d3d] rounded-l-xs shadow-xs ${c.btnPower}`}></div>

    </div>
  );
};

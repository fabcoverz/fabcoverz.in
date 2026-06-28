import React from "react";
import { Announcement } from "../types";

interface AnnouncementBarProps {
  announcements: Announcement[];
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ announcements }) => {
  if (!announcements || announcements.length === 0) return null;

  // Repeat items enough times to create seamless loop
  const items = [...announcements, ...announcements, ...announcements, ...announcements];

  return (
    <div className="bg-zinc-950 text-white py-2.5 relative overflow-hidden select-none border-b border-zinc-800">
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll ${announcements.length * 10}s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="marquee-track">
        {items.map((ann, idx) => (
          <span
            key={`${ann.id}-${idx}`}
            className="flex items-center gap-2 px-8 text-[12px] font-black italic tracking-[0.15em] uppercase whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#000000] inline-block shrink-0" />
            <span className="text-white">{ann.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

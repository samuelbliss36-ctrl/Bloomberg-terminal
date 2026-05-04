import { useState, useEffect } from 'react';

const SESSIONS = [
  { name: "NYSE",  open: { h:14, m:30 }, close: { h:21, m:0  }, tz: "America/New_York", flag: "🇺🇸" },
  { name: "LSE",   open: { h:8,  m:0  }, close: { h:16, m:30 }, tz: "Europe/London",    flag: "🇬🇧" },
  { name: "TSE",   open: { h:0,  m:0  }, close: { h:6,  m:0  }, tz: "Asia/Tokyo",       flag: "🇯🇵" },
  { name: "HKEx",  open: { h:1,  m:30 }, close: { h:8,  m:0  }, tz: "Asia/Hong_Kong",   flag: "🇭🇰" },
];

const OFFSETS = {
  "America/New_York": -240,
  "Europe/London":    60,
  "Asia/Tokyo":       540,
  "Asia/Hong_Kong":   480,
};

export function MarketSessionBadges() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center gap-3">
      {SESSIONS.map(s => {
        const now      = new Date();
        const utcMins  = now.getUTCHours() * 60 + now.getUTCMinutes();
        const off      = OFFSETS[s.tz] || 0;
        const local    = ((utcMins + off) % 1440 + 1440) % 1440;
        const openM    = s.open.h  * 60 + s.open.m;
        const closeM   = s.close.h * 60 + s.close.m;
        const isOpen   = local >= openM && local < closeM;
        return (
          <span key={s.name} className="font-mono" style={{ color: isOpen ? "#059669" : "var(--text-3)", fontSize: 9 }}>
            {s.flag} {s.name} {isOpen ? "●" : "○"}
          </span>
        );
      })}
    </div>
  );
}

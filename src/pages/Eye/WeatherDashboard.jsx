import { useState, useEffect } from "react";

const CITIES = [
  { name: "New York", lat: 40.71, lon: -74.01, tz: "America/New_York", flag: "🇺🇸" },
  { name: "London", lat: 51.51, lon: -0.13, tz: "Europe/London", flag: "🇬🇧" },
  { name: "Tokyo", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo", flag: "🇯🇵" },
  { name: "Hong Kong", lat: 22.32, lon: 114.17, tz: "Asia/Hong_Kong", flag: "🇭🇰" },
  { name: "Dubai", lat: 25.20, lon: 55.27, tz: "Asia/Dubai", flag: "🇦🇪" },
  { name: "Shanghai", lat: 31.23, lon: 121.47, tz: "Asia/Shanghai", flag: "🇨🇳" },
  { name: "Frankfurt", lat: 50.11, lon: 8.68, tz: "Europe/Berlin", flag: "🇩🇪" },
  { name: "Singapore", lat: 1.35, lon: 103.82, tz: "Asia/Singapore", flag: "🇸🇬" },
  { name: "Sydney", lat: -33.87, lon: 151.21, tz: "Australia/Sydney", flag: "🇦🇺" },
  { name: "Toronto", lat: 43.65, lon: -79.38, tz: "America/Toronto", flag: "🇨🇦" },
  { name: "Riyadh", lat: 24.69, lon: 46.72, tz: "Asia/Riyadh", flag: "🇸🇦" },
  { name: "Mumbai", lat: 19.08, lon: 72.88, tz: "Asia/Kolkata", flag: "🇮🇳" },
];

const WMO = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mostly Clear", icon: "🌤" },
  2: { label: "Partly Cloudy", icon: "⛅️" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫" },
  48: { label: "Icy Fog", icon: "🌫" },
  51: { label: "Light Drizzle", icon: "🌦" },
  53: { label: "Drizzle", icon: "🌦" },
  55: { label: "Heavy Drizzle", icon: "🌧" },
  61: { label: "Light Rain", icon: "🌧" },
  63: { label: "Rain", icon: "🌧" },
  65: { label: "Heavy Rain", icon: "🌧" },
  71: { label: "Light Snow", icon: "🌨" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy Snow", icon: "❄️" },
  80: { label: "Showers", icon: "🌦" },
  81: { label: "Showers", icon: "🌧" },
  82: { label: "Heavy Showers", icon: "⛈" },
  95: { label: "Thunderstorm", icon: "⛈" },
  99: { label: "Hail Storm", icon: "⛈" },
};

export default function WeatherDashboard() {
  const [weather, setWeather] = useState({});
  const [active, setActive] = useState("New York");
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lats = CITIES.map(c => c.lat).join(",");
    const lons = CITIES.map(c => c.lon).join(",");
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons + "&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&temperature_unit=celsius&windspeed_unit=mph")
      .then(r => r.json())
      .then(results => {
        const arr = Array.isArray(results) ? results : [results];
        const weatherMap = {};
        CITIES.forEach((c, i) => {
          const d = arr[i];
          weatherMap[c.name] = {
            temp: d?.current?.temperature_2m,
            code: d?.current?.weathercode,
            wind: d?.current?.windspeed_10m,
            humidity: d?.current?.relativehumidity_2m,
          };
        });
        setWeather(weatherMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => {
    const city = CITIES.find(c => c.name === active);
    if (!city) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + city.lat + "&longitude=" + city.lon + "&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=celsius&timezone=" + city.tz)
      .then(r => r.json())
      .then(d => {
        if (d.daily) {
          const days = d.daily.time.map((t, i) => ({
            date: new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            max: d.daily.temperature_2m_max[i],
            min: d.daily.temperature_2m_min[i],
            code: d.daily.weathercode[i],
          }));
          setForecast(days);
        }
      })
      .catch(() => {});
  }, [active]); // eslint-disable-line

  const activeCity = CITIES.find(c => c.name === active);
  // const activeWeather = weather[active];
  const wmo = (code) => WMO[code] || WMO[Math.floor(code/10)*10] || { label: "Clear", icon: "🌤" };

  return (
    <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "auto auto" }}>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "1/2" }}>
        <div className="terminal-header mb-3">🌍 Global Financial Centers — Weather</div>
        <div className="grid grid-cols-3 gap-2">
          {CITIES.slice(0, 6).map(c => {
            const w = weather[c.name];
            const isActive = active === c.name;
            return (
              <div key={c.name} onClick={() => setActive(c.name)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#eff6ff" : "#f8fafc", border: "1px solid", borderColor: isActive ? "#2563eb33" : "#e2e8f0" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isActive ? "#2563eb" : "#0f172a" }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 16 }}>{wmo(w?.code).icon}</span>
                </div>
                <div className="text-lg font-mono font-bold" style={{ color: "var(--text-1)" }}>{w ? w.temp + "°C" : "..."}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{wmo(w?.code).label}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>💨 {w?.wind || "—"} mph</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "3/5", gridRow: "1/2" }}>
        <div className="terminal-header mb-3">🌍 Asia Pacific & Middle East</div>
        <div className="grid grid-cols-3 gap-2">
          {CITIES.slice(6, 12).map(c => {
            const w = weather[c.name];
            const isActive = active === c.name;
            return (
              <div key={c.name} onClick={() => setActive(c.name)}
                className="p-2 rounded cursor-pointer transition-colors"
                style={{ background: isActive ? "#eff6ff" : "#f8fafc", border: "1px solid", borderColor: isActive ? "#2563eb33" : "#e2e8f0" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isActive ? "#2563eb" : "#0f172a" }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 16 }}>{wmo(w?.code).icon}</span>
                </div>
                <div className="text-lg font-mono font-bold" style={{ color: "var(--text-1)" }}>{w ? w.temp + "°C" : "..."}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{wmo(w?.code).label}</div>
                <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>💨 {w?.wind || "—"} mph</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "1/3", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">{activeCity?.flag} {active} — 7 Day Forecast</div>
        <div className="grid grid-cols-7 gap-1">
          {forecast.slice(0, 7).map((f, i) => (
            <div key={i} className="flex flex-col items-center p-1.5 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
              <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{f.date.split(",")[0]}</div>
              <div style={{ fontSize: 20, margin: "4px 0" }}>{wmo(f.code).icon}</div>
              <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>{f.max}°</div>
              <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{f.min}°</div>
            </div>
          ))}
        </div>
      </div>

      <div className="terminal-panel terminal-glow p-3" style={{ gridColumn: "3/5", gridRow: "2/3" }}>
        <div className="terminal-header mb-3">⚠️ Market Weather Alerts</div>
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="text-xs font-mono animate-pulse" style={{ color: "var(--text-3)" }}>Loading weather data...</div>
          ) : (
            CITIES.map(c => {
              const w = weather[c.name];
              if (!w) return null;
              const alerts = [];
              if (w.temp > 38) alerts.push({ msg: "Extreme heat may affect energy demand", color: "#e11d48" });
              if (w.temp < -10) alerts.push({ msg: "Extreme cold driving heating demand", color: "#4444ff" });
              if (w.wind > 40) alerts.push({ msg: "High winds may disrupt operations", color: "#b45309" });
              if ([95, 99, 82].includes(w.code)) alerts.push({ msg: "Severe storms reported", color: "#e11d48" });
              if (alerts.length === 0) return null;
              return alerts.map((alert, i) => (
                <div key={c.name + i} className="flex items-start gap-2 p-2 rounded" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
                  <span className="text-xs" style={{ color: alert.color }}>⚠</span>
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: "var(--text-1)" }}>{c.flag} {c.name}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>{alert.msg}</div>
                  </div>
                </div>
              ));
            })
          )}
          {!loading && CITIES.every(c => {
            const w = weather[c.name];
            if (!w) return true;
            return w.temp <= 38 && w.temp >= -10 && w.wind <= 40 && ![95,99,82].includes(w.code);
          }) && (
            <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>✓ No significant weather alerts across major financial centers</div>
          )}
        </div>
      </div>
    </div>
  );
}

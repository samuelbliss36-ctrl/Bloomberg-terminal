// Yahoo Finance options proxy with crumb-based auth
// Yahoo Finance now requires a session crumb for /v7/finance/options requests.
// This proxy handles the two-step auth flow server-side:
//   1. Fetch crumb from /v1/test/getcrumb (+ grab session cookies)
//   2. Pass crumb + cookies in the actual options request
// Crumb is cached in module memory for 30 min (warm Vercel invocations share it).

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let _crumb   = null;
let _cookies = null;
let _crumbTs = 0;
const CRUMB_TTL = 30 * 60 * 1000; // 30 min

async function getYahooCrumb() {
  if (_crumb && Date.now() - _crumbTs < CRUMB_TTL) {
    return { crumb: _crumb, cookies: _cookies };
  }

  // Step 1 — accept Yahoo consent / get session cookie
  const consentRes = await fetch(
    "https://guce.yahoo.com/consent?brandType=nonEu&lang=en-US&done=https%3A%2F%2Ffinance.yahoo.com",
    { headers: { "User-Agent": UA, "Accept": "text/html" }, redirect: "follow" }
  );
  const rawSet = consentRes.headers.getSetCookie
    ? consentRes.headers.getSetCookie()
    : (consentRes.headers.get("set-cookie") || "").split(",");
  const sessionCookies = rawSet
    .map(c => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  // Step 2 — fetch crumb using session cookies
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": UA,
      "Accept":     "text/plain",
      "Cookie":     sessionCookies,
    },
  });

  const crumbText = await crumbRes.text();
  // If we got HTML back instead of a crumb, the consent wasn't accepted
  if (!crumbText || crumbText.includes("<")) {
    throw new Error("Failed to obtain Yahoo Finance crumb (consent required)");
  }

  // Collect any new cookies from the crumb response
  const crumbSet = crumbRes.headers.getSetCookie
    ? crumbRes.headers.getSetCookie()
    : (crumbRes.headers.get("set-cookie") || "").split(",");
  const allCookies = [
    ...sessionCookies.split("; "),
    ...crumbSet.map(c => c.split(";")[0].trim()),
  ].filter(Boolean).join("; ");

  _crumb   = crumbText.trim();
  _cookies = allCookies;
  _crumbTs = Date.now();

  return { crumb: _crumb, cookies: _cookies };
}

export default async function handler(req, res) {
  const { ticker, date } = req.query;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  try {
    const { crumb, cookies } = await getYahooCrumb();

    const safe      = encodeURIComponent(ticker.toUpperCase());
    const dateParam = date ? `&date=${date}` : "";
    const url = `https://query2.finance.yahoo.com/v7/finance/options/${safe}?crumb=${encodeURIComponent(crumb)}${dateParam}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept":     "application/json",
        "Cookie":     cookies,
      },
    });

    if (!response.ok) {
      // Crumb may have expired — bust cache so next request re-fetches it
      _crumb = null;
      return res.status(response.status).json({ error: `Yahoo Finance ${response.status}` });
    }

    const data = await response.json();

    // If Yahoo returned an error object inside the payload, bust crumb cache
    if (data?.finance?.error) {
      _crumb = null;
      return res.status(401).json({ error: data.finance.error.description || "Yahoo Finance auth error" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(data);
  } catch (err) {
    _crumb = null; // bust cache on any error so next attempt retries auth
    console.error("options proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

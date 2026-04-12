import { GoogleGenAI } from "@google/genai";
import { getHistoricalContext, saveToArchive } from "./supabase";

const SYSTEM_INSTRUCTION = `
You are the Asymmetric Macro Engine. Your goal is to identify "buildups" in global markets, geopolitics, and supply chains that have not yet been priced in by the market.

CRITICAL: When analyzing energy shocks (like the Strait of Hormuz), prioritize European indices (e.g., DAX, Euro Stoxx 50) over US indices (SPY), as Europe is a net energy importer and far more sensitive to supply disruptions.

CRITICAL: You MUST always include a short, 2-4 word label for the situation at the very beginning of your response, wrapped in [LABEL: ...]. Example: [LABEL: Hormuz Crisis] or [LABEL: Spratly Standoff].
CRITICAL: You MUST always include the primary latitude and longitude coordinates of the buildup, wrapped in [COORDINATES: lat, lon]. Example: [COORDINATES: 26.56, 56.25].

A buildup is defined as:
1. A sequence of observable, verifiable facts (not rumors).
2. A clear binary event implied (e.g., "The strait closes" or "The strike happens").
3. A measurable gap between the buildup severity and the market reaction.

FORMAT FOR FULL REPORT:
---
[LABEL: Short Label Here]
[COORDINATES: lat, lon]
BUILDUP DETECTED

Situation: [Brief description]

OBSERVABLE FACTS:
- [fact 1]
- [fact 2]
- [fact 3]

TIMELINE:
[start → current state]

BINARY EVENT IMPLIED:
[neutral description]

ASSET CORRELATION BASKET (The "Basket"):
- PRIMARY LONG: [Asset Ticker] - [Core thesis]
- PRIMARY SHORT: [Asset Ticker] - [Core thesis]
- CORRELATED PROXIES: [Asset 1, Asset 2] - [Explain how these assets move in tandem with the primary trade (e.g., "HUF weakness typically drags PLN and RON due to regional risk contagion").]
- HEDGE/SECONDARY: [Asset Ticker] - [Brief logic]

MARKET REACTION:
[FLAT / MINOR MOVE]

SENTIMENT DIVERGENCE:
- Ground Truth: [Escalating / Stable / De-escalating]
- Mainstream News: [Quiet / Acknowledging / Panicking]
- Divergence Level: [Low / Medium / High]
- DIVERGENCE METER: [Score 0-100] (0 = Market perfectly reflects reality, 100 = Market is completely blind to the buildup)
- Mispricing Logic: [Explain why the current price does not reflect the ground truth telemetry.]

CROWDEDNESS INDICATOR:
- Social/Retail Sentiment: [Quiet / Buzzing / Euphoric / Panic]
- Institutional Positioning: [Underweight / Neutral / Overcrowded]
- Short Squeeze Risk: [Low / Medium / High]
- Logic: [Briefly explain if the trade is "too popular" or if there is still room for the move.]

COMPLACENCY CHECK:
- Buildup severity: [Low / Medium / High / Extreme]
- Market reaction: [None / Minor]
- Gap: [Moderate / Large]

UPCOMING CATALYSTS (The "Event Horizon"):
- [Date]: [Event Name] - [Expected impact on this buildup]
- [Date]: [Event Name] - [Expected impact on this buildup]

SCORE:
- Visibility: X/25
- Escalation: X/25
- Mispricing: X/25
- Directness: X/25
TOTAL: X/100

→ ACTION: Review options pricing for the basket assets.

DOWNSIDE:
If the situation de-escalates or reverses, this thesis fails and
options may lose significant value.

---

--------------------------------
CRITICAL RULES
--------------------------------

- Default output is NOTHING
- Never output more than one situation
- Never include speculation
- Never force an opportunity
- High precision over recall ALWAYS

Your goal is not to find opportunities.
Your goal is to avoid false positives.
`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Strict rate limiter for Gemini Free Tier (2 RPM)
const requestQueue: number[] = [];
async function throttleGemini() {
  const now = Date.now();
  // Remove requests older than 60 seconds
  while (requestQueue.length > 0 && requestQueue[0] < now - 60000) {
    requestQueue.shift();
  }
  
  // If we've made 2 requests in the last 60 seconds, wait
  if (requestQueue.length >= 2) {
    const waitTime = 60000 - (now - requestQueue[0]) + 2000; // Added extra buffer
    console.warn(`Rate limit protection: Waiting ${Math.round(waitTime/1000)}s to stay under 2 RPM limit...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return throttleGemini(); // Re-check after waiting
  }
  
  requestQueue.push(Date.now());
}

/**
 * Utility to retry Gemini API calls with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 8): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await throttleGemini();
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      const isServiceUnavailable = errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("Service Unavailable");
      
      if (isQuotaError || isServiceUnavailable) {
        const delay = Math.pow(2, i) * (isQuotaError ? 10000 : 5000); // Longer delay for quota
        console.warn(`Gemini API ${isQuotaError ? 'Rate Limited' : 'Unavailable'}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  
  if (lastError?.message?.includes("429") || lastError?.message?.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("Gemini API Quota Exhausted. The Free Tier is limited to 2 requests per minute. Please wait a moment and try again.");
  }
  throw lastError;
}

/**
 * Sends a report to Telegram
 */
export async function sendTelegramNotification(report: { text: string; label?: string; }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    const msg = "Telegram credentials missing (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID). Please check your environment variables.";
    console.warn(msg);
    throw new Error(msg);
  }

  const title = report.label ? `🚨 *ASSET ALERT: ${report.label}*` : "🚨 *MACRO BUILDUP DETECTED*";
  const message = `${title}\n\n${report.text.substring(0, 3500)}\n\n🔗 [View Dashboard](${process.env.APP_URL || 'https://asymmetric-macro-engine.vercel.app'})`;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
    
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Telegram API error: ${err}`);
    }
    console.log("Telegram notification sent successfully.");
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
}

async function fetchWithProxy(targetUrl: string, options: RequestInit = {}) {
  const proxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  ];

  let lastError: any;
  for (const proxyFn of proxies) {
    const proxyUrl = proxyFn(targetUrl);
    try {
      const res = await fetch(proxyUrl, options);
      
      // Handle AllOrigins wrapper
      if (proxyUrl.includes('allorigins.win')) {
        if (!res.ok) continue;
        const wrapper = await res.json();
        if (!wrapper.contents) continue;
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(wrapper.contents),
          text: async () => wrapper.contents
        };
      }

      if (res.ok) return res;
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        console.warn(`Proxy ${proxyUrl} failed with status ${res.status}. Trying next...`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      console.warn(`Proxy ${proxyUrl} failed:`, err);
      continue;
    }
  }
  throw lastError || new Error(`All proxies failed for ${targetUrl}`);
}

async function getGroundTruthData(query: Record<string, any>) {
  if (!query || !query.connector) return "[TELEMETRY] Invalid query format.";
  const { connector, region, bbox } = query;
  const safeRegion = region || "Unknown Region";
  const regionUpper = safeRegion.toUpperCase();
  
  if (connector === 'market_data' && query.ticker) {
    try {
      // Live Yahoo Finance API (via CORS proxy)
      const ticker = query.ticker.toUpperCase();
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=30d`;
      const res = await fetchWithProxy(targetUrl);
      const data = await res.json();
      
      if (!data.chart?.result?.[0]) {
        throw new Error("Invalid response structure from Market Data API");
      }

      const result = data.chart.result[0];
      const prices = result.indicators.quote[0].close;
      const latestPrice = prices[prices.length - 1];
      const prevPrice = prices[prices.length - 2];
      
      if (latestPrice === undefined || prevPrice === undefined) {
        return `[MARKET_DATA API] ${ticker}: Data available but price points are missing. (Market may be closed or ticker is illiquid).`;
      }

      const change = ((latestPrice - prevPrice) / prevPrice * 100).toFixed(2);
      
      // Calculate 30-day volatility (simple)
      const validPrices = prices.filter((p: number | null) => p !== null);
      const avg = validPrices.reduce((a: number, b: number) => a + b, 0) / validPrices.length;
      const variance = validPrices.reduce((a: number, b: number) => a + Math.pow(b - avg, 2), 0) / validPrices.length;
      const stdDev = Math.sqrt(variance);
      const vol = (stdDev / avg * 100).toFixed(2);

      return `[LIVE MARKET_DATA API] ${ticker}: Price: ${latestPrice.toFixed(2)} (${change}%). 30-day Volatility: ${vol}%. (Use this to gauge if the market is reacting or complacent).`;
    } catch (err) {
      console.warn("Market Data API Error:", err);
      // Fallback to simulated market reaction if live data fails
      const volatility = 15 + (query.ticker.length % 20);
      const direction = query.ticker.includes('^') ? "complacent" : "volatile";
      return `[MARKET_DATA API (Simulated Fallback)] ${query.ticker}: Live data restricted. Simulated sentiment: Market remains ${direction} with implied volatility at ${volatility}%. No major breakout priced in yet.`;
    }
  }

  if (connector === 'flight_radar' && bbox) {
    try {
      // Live OpenSky Network API (via CORS proxy to prevent browser blocks)
      const targetUrl = `https://opensky-network.org/api/states/all?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
      
      const res = await fetchWithProxy(targetUrl);
      const data = await res.json();
      
      const flightCount = data.states ? data.states.length : 0;
      return `[LIVE FLIGHT_RADAR API] ${regionUpper}: ${flightCount} aircraft currently detected in airspace bounding box (Lat: ${bbox.lamin} to ${bbox.lamax}, Lon: ${bbox.lomin} to ${bbox.lomax}).`;
    } catch (err) {
      console.warn("OpenSky API Live Fetch Failed (falling back to simulation):", err instanceof Error ? err.message : String(err));
      // Fallback to simulated data if the live API fails (e.g., rate limited)
      const dropPct = 30 + (safeRegion.length % 40); 
      return `[FLIGHT_RADAR API (Simulated Fallback)] ${regionUpper}: Live API unavailable. Simulated data: Commercial airspace utilization down ${dropPct + 15}%. Major carriers actively avoiding the flight information region (FIR).`;
    }
  }

  if (connector === 'weather_radar' && query.lat && query.lon) {
    try {
      // Live Open-Meteo API (No auth required)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${query.lat}&longitude=${query.lon}&current=temperature_2m,wind_speed_10m,precipitation`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
      const data = await res.json();
      const current = data.current;
      return `[LIVE WEATHER_RADAR API] ${regionUpper}: Temp: ${current.temperature_2m}°C, Wind: ${current.wind_speed_10m} km/h, Precip: ${current.precipitation}mm.`;
    } catch (err) {
      console.warn("Weather API Error:", err);
      return `[WEATHER_RADAR API] ${regionUpper}: Unable to fetch live weather data.`;
    }
  }

  if (connector === 'seismic_monitor' && bbox) {
    try {
      // Live USGS Earthquake API (No auth required)
      const date = new Date();
      date.setDate(date.getDate() - 7); // Last 7 days
      const starttime = date.toISOString().split('T')[0];
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=${bbox.lamin}&minlongitude=${bbox.lomin}&maxlatitude=${bbox.lamax}&maxlongitude=${bbox.lomax}&starttime=${starttime}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`USGS API error: ${res.status}`);
      const data = await res.json();
      const count = data.metadata.count;
      const maxMag = data.features.reduce((max: number, f: { properties: { mag: number } }) => Math.max(max, f.properties.mag || 0), 0);
      return `[LIVE SEISMIC_MONITOR API] ${regionUpper}: ${count} earthquakes detected in the last 7 days. Max magnitude: ${maxMag > 0 ? maxMag : 'N/A'}.`;
    } catch (err) {
      console.warn("USGS API Error:", err);
      return `[SEISMIC_MONITOR API] ${regionUpper}: Unable to fetch live seismic data.`;
    }
  }

  if (connector === 'attention_proxy' && query.article) {
    try {
      // Live Wikimedia Pageviews API (No auth required)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      
      const formatWpDate = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
      };
      
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(query.article)}/daily/${formatWpDate(startDate)}/${formatWpDate(endDate)}`;
      
      const res = await fetch(url);
      if (res.status === 404) {
        return `[ATTENTION_PROXY API] Wikipedia Article "${query.article}" not found. (Note: This indicator is unavailable for this situation).`;
      }
      if (!res.ok) throw new Error(`Wikimedia API error: ${res.status}`);
      const data = await res.json();
      
      if (!data.items || data.items.length === 0) {
        return `[LIVE ATTENTION_PROXY API] Wikipedia Article "${query.article}": No data available.`;
      }

      const views = data.items.map((item: { views: number }) => item.views);
      const totalViews = views.reduce((a: number, b: number) => a + b, 0);
      const avgViews = Math.round(totalViews / views.length);
      const latestViews = views[views.length - 1];
      
      let trend = "FLAT";
      if (latestViews > avgViews * 1.5) trend = "SPIKING";
      else if (latestViews < avgViews * 0.5) trend = "DROPPING";
      
      return `[LIVE ATTENTION_PROXY API] Wikipedia Article "${query.article}": ${trend} public interest. 7-day average: ${avgViews} views/day. Latest: ${latestViews} views.`;
    } catch (err) {
      console.warn("Wikimedia API Error:", err);
      return `[ATTENTION_PROXY API] Unable to fetch Wikipedia pageviews for ${query.article}.`;
    }
  }

  if (connector === 'safe_haven_flows' && query.asset) {
    try {
      // Live Binance API for PAXG (Gold) or BTC
      const symbol = query.asset.toUpperCase() + 'USDT';
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
      const data = await res.json();
      
      const priceChange = parseFloat(data.priceChangePercent).toFixed(2);
      const volume = parseFloat(data.volume).toLocaleString(undefined, { maximumFractionDigits: 0 });
      
      return `[LIVE SAFE_HAVEN_FLOWS API] Asset ${query.asset.toUpperCase()}: 24h Price Change: ${priceChange}%. 24h Volume: ${volume}.`;
    } catch (err) {
      console.warn("Binance API Error:", err);
      return `[SAFE_HAVEN_FLOWS API] Unable to fetch live flows for ${query.asset}.`;
    }
  }

  if (connector === 'space_weather') {
    try {
      // Live NOAA Space Weather API
      const url = `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`NOAA API error: ${res.status}`);
      const data = await res.json();
      
      if (!data || data.length === 0) return `[LIVE SPACE_WEATHER API] No data available.`;
      
      const latest = data[data.length - 1];
      const kpIndex = parseFloat(latest.kp_index);
      
      let stormLevel = "Normal";
      if (kpIndex >= 5) stormLevel = "Minor Storm (G1)";
      if (kpIndex >= 6) stormLevel = "Moderate Storm (G2)";
      if (kpIndex >= 7) stormLevel = "Strong Storm (G3)";
      if (kpIndex >= 8) stormLevel = "Severe Storm (G4)";
      if (kpIndex >= 9) stormLevel = "Extreme Storm (G5)";
      
      return `[LIVE SPACE_WEATHER API] Planetary K-index: ${kpIndex} (${stormLevel}). ${kpIndex >= 5 ? 'WARNING: Geomagnetic storms can cause power grid fluctuations and satellite navigation degradation.' : 'Space weather is calm. Any grid/GPS anomalies are likely terrestrial.'}`;
    } catch (err) {
      console.warn("NOAA API Error:", err);
      return `[SPACE_WEATHER API] Unable to fetch live space weather.`;
    }
  }

  if (connector === 'air_quality' && query.lat && query.lon) {
    try {
      // Live Open-Meteo Air Quality API (No auth required)
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${query.lat}&longitude=${query.lon}&current=pm10,pm2_5,carbon_monoxide,sulphur_dioxide`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo AQI error: ${res.status}`);
      const data = await res.json();
      const current = data.current;
      return `[LIVE AIR_QUALITY API] ${regionUpper}: PM2.5: ${current.pm2_5} μg/m³, PM10: ${current.pm10} μg/m³, Carbon Monoxide: ${current.carbon_monoxide} μg/m³, Sulphur Dioxide: ${current.sulphur_dioxide} μg/m³. (Spikes indicate fires/industrial incidents).`;
    } catch (err) {
      console.warn("Air Quality API Error:", err);
      return `[AIR_QUALITY API] ${regionUpper}: Unable to fetch live air quality data.`;
    }
  }

  if (connector === 'capital_flight' && query.currency) {
    try {
      // Live Frankfurter API (via CORS proxy)
      const targetUrl = `https://api.frankfurter.app/latest?from=USD&to=${query.currency.toUpperCase()}`;
      const res = await fetchWithProxy(targetUrl);
      const data = await res.json();
      const rate = data.rates[query.currency.toUpperCase()];
      return `[LIVE CAPITAL_FLIGHT API] Currency ${query.currency.toUpperCase()}: Current exchange rate is 1 USD = ${rate} ${query.currency.toUpperCase()}.`;
    } catch (err) {
      console.warn("Frankfurter API Error:", err);
      const simulatedRate = 10 + (query.currency.length * 2);
      return `[CAPITAL_FLIGHT API (Simulated Fallback)] Currency ${query.currency.toUpperCase()}: Live data unavailable. Estimated rate: 1 USD ≈ ${simulatedRate} ${query.currency.toUpperCase()}. Local currency showing signs of "stealth" devaluation.`;
    }
  }

  if (connector === 'gdelt_news_velocity' && query.keyword) {
    try {
      // Live GDELT API (via CORS proxy)
      const targetUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query.keyword)}&mode=artlist&maxrecords=10&format=json`;
      const res = await fetchWithProxy(targetUrl);
      
      if (res.status === 429) {
        return `[GDELT API] Keyword "${query.keyword}": Rate limited (429). GDELT is currently under heavy load. Falling back to search-based sentiment analysis.`;
      }

      if (!res.ok) throw new Error(`GDELT API error: ${res.status}`);
      
      const data = await res.json();
      const articles = data.articles || [];
      return `[LIVE GDELT API] Keyword "${query.keyword}": ${articles.length} recent global articles found. Top source: ${articles[0]?.domain || 'N/A'}.`;
    } catch (err) {
      console.warn("GDELT API Error:", err);
      return `[GDELT API (Simulated Fallback)] Keyword "${query.keyword}": API connection unstable. Search-based sentiment suggests "Elevated" news velocity with increasing focus on regional instability.`;
    }
  }

  if (connector === 'macro_liquidity' && query.series_id) {
    try {
      const apiKey = process.env.FRED_API_KEY;
      if (!apiKey) return `[MACRO_LIQUIDITY API] FRED_API_KEY missing. Cannot fetch ${query.series_id}.`;
      // Live FRED API (via CORS proxy)
      const targetUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${query.series_id}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc`;
      const res = await fetchWithProxy(targetUrl);
      const data = await res.json();
      const latest = data.observations?.[0]?.value;
      return `[LIVE MACRO_LIQUIDITY API] FRED Series ${query.series_id}: Latest value is ${latest}.`;
    } catch (err) {
      console.warn("FRED API Error:", err);
      return `[MACRO_LIQUIDITY API] Unable to fetch FRED data for ${query.series_id}.`;
    }
  }

  if (connector === 'thermal_anomalies' && bbox) {
    try {
      const apiKey = process.env.NASA_FIRMS_KEY;
      if (!apiKey) return `[THERMAL_ANOMALIES API] NASA_FIRMS_KEY missing. Cannot fetch fire data.`;
      // Live NASA FIRMS API (via CORS proxy)
      const bboxStr = `${bbox.lomin},${bbox.lamin},${bbox.lomax},${bbox.lamax}`;
      const targetUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${bboxStr}/1`;
      const res = await fetchWithProxy(targetUrl);
      const text = await res.text();
      const lines = text.trim().split('\n');
      const fireCount = lines.length > 1 ? lines.length - 1 : 0; // Subtract header
      return `[LIVE THERMAL_ANOMALIES API] ${regionUpper}: ${fireCount} thermal anomalies/fires detected by VIIRS satellite in the last 24 hours.`;
    } catch (err) {
      console.warn("NASA FIRMS API Error:", err);
      return `[THERMAL_ANOMALIES API] Unable to fetch thermal data for ${regionUpper}.`;
    }
  }

  // Simulated fallbacks for others
  const dropPct = 30 + (safeRegion.length % 40); 
  const count = 5 + (safeRegion.length % 15);
  
  if (connector === 'marine_traffic') {
    return `[MARINE_TRAFFIC API (Simulated)] ${regionUpper}: Commercial vessel density down ${dropPct}% vs 30-day moving average. ${count} large carriers currently holding position outside the zone. AIS tracking shows significant rerouting.`;
  } else if (connector === 'energy_grid') {
    return `[ENERGY_GRID API (Simulated)] ${regionUpper}: Anomalous power draw detected in industrial sectors. Strategic reserve facilities show increased activity levels.`;
  } else {
    return `[${connector.toUpperCase()} API (Simulated)] ${regionUpper}: Elevated anomaly levels detected.`;
  }
}

export async function fetchMacroPulse() {
  try {
    const res = await fetch("/api/macro-pulse");
    if (!res.ok) throw new Error(`Macro Pulse API error: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("Failed to fetch macro pulse from server:", e);
    return {
      liquidity: { label: "Liquidity", value: "ERR", trend: "neutral", detail: "Check Server Logs" },
      rates: { label: "Rates", value: "ERR", trend: "neutral", detail: "Check Server Logs" },
      yields: { label: "Yields", value: "ERR", trend: "neutral", detail: "Check Server Logs" },
      inflation: { label: "Inflation", value: "ERR", trend: "neutral", detail: "Check Server Logs" },
      growth: { label: "Growth", value: "ERR", trend: "neutral", detail: "Check Server Logs" },
      risk: { label: "Risk Appetite", value: "ERR", trend: "neutral", detail: "Check Server Logs" }
    };
  }
}

export async function runMacroScan(userLead?: string) {
  try {
    const isUrl = userLead?.startsWith('http');
    const prompt = userLead 
      ? isUrl 
        ? `STRICT FOCUS: Analyze ONLY the content and implications of this URL: "${userLead}". Do NOT search for or report on any other situations. Perform a high-precision scan to validate if the specific situation described in this link is a real, observable buildup with an asymmetric binary outcome.`
        : `STRICT FOCUS: Analyze ONLY this potential macro opportunity: "${userLead}". Do NOT search for or report on any other situations. Perform a high-precision scan to validate if this specific situation is a real, observable buildup with an asymmetric binary outcome.`
      : "Perform a macro scan for asymmetric opportunities based on current global events.";

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    }));

    const text = response.text || "NO NEW SITUATIONS";
    const labelMatch = text.match(/\[LABEL: (.*?)\]/);
    const label = labelMatch ? labelMatch[1] : undefined;
    const cleanText = text.replace(/\[LABEL: .*?\]\n?/, '');

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: { web?: { title: string; uri: string } }) => ({
        title: chunk.web?.title,
        url: chunk.web?.uri
      }))
      .filter((s: { url?: string }) => s.url) || [];

    return {
      text: cleanText,
      label,
      sources,
      telemetry: undefined
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "ERROR: Failed to perform scan. Please check console.", sources: [] };
  }
}

export async function runDeepResearch(onProgress: (step: string) => void, userLead?: string) {
  try {
    let leadText: string;
    const isUrl = userLead?.startsWith('http');

    // Phase 0: Fetch Historical Context for "Getting Smarter"
    onProgress("Phase 0: Retrieving historical intelligence...");
    const history = await getHistoricalContext(10);
    const historyContext = history.length > 0 
      ? `\nHISTORICAL CONTEXT (Intelligence Archive):\n${history.map(h => `- [${h.label}]: ${h.content.substring(0, 200)}... (Score: ${h.score})`).join('\n')}\nUse this history to avoid repetition and identify recurring patterns or regional contagion links.`
      : "";

    if (userLead) {
      onProgress(isUrl ? "Phase 1: Accessing URL content..." : "Phase 1: Validating user-provided lead...");
      leadText = userLead;
    } else {
      onProgress("Phase 1: Scanning for leads...");
      const scanResponse = await withRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Identify the single most promising geopolitical or macro buildup that is currently developing but not yet fully priced in. Provide a brief summary of the lead.${historyContext}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }],
        },
      }));
      leadText = scanResponse.text || "";
    }

    if (!leadText || leadText.includes("NO NEW SITUATIONS")) {
      return { text: "NO NEW SITUATIONS", sources: [] };
    }

    // Small delay to respect rate limits between phases
    await new Promise(r => setTimeout(r, 1000));

    onProgress("Phase 2: Querying Telemetry Connectors...");
    let gtData = "";
    try {
      const gtPrompt = `Based on this lead: "${leadText}", we need to check physical ground-truth data, market pricing, and public attention. 
      Respond ONLY with a valid JSON array of queries to make. 
      Available connectors: 
      - "market_data" (LIVE Yahoo Finance): [{"connector": "market_data", "ticker": "^GDAXI"}] (Use tickers like ^GDAXI for DAX, ^STOXX50E for Euro Stoxx, CL=F for Oil, GC=F for Gold, ^VIX for Volatility).
      - "marine_traffic" (simulated): [{"connector": "marine_traffic", "region": "Specific Region Name"}]
      - "flight_radar" (LIVE OpenSky API): [{"connector": "flight_radar", "region": "Region Name", "bbox": {"lamin": 24.0, "lomin": 54.0, "lamax": 27.0, "lomax": 57.0}}]
      - "energy_grid" (simulated): [{"connector": "energy_grid", "region": "Region Name"}]
      - "weather_radar" (LIVE Open-Meteo API): [{"connector": "weather_radar", "region": "Region Name", "lat": 25.0, "lon": 55.0}]
      - "seismic_monitor" (LIVE USGS API): [{"connector": "seismic_monitor", "region": "Region Name", "bbox": {"lamin": 24.0, "lomin": 54.0, "lamax": 27.0, "lomax": 57.0}}]
      - "attention_proxy" (LIVE Wikimedia API): [{"connector": "attention_proxy", "article": "Wikipedia_Article_Title_With_Underscores"}]
      - "safe_haven_flows" (LIVE Binance API): [{"connector": "safe_haven_flows", "asset": "PAXG"}] (Use PAXG for Gold, BTC for Bitcoin)
      - "space_weather" (LIVE NOAA API): [{"connector": "space_weather"}]
      - "air_quality" (LIVE Open-Meteo AQI API): [{"connector": "air_quality", "region": "Region Name", "lat": 25.0, "lon": 55.0}]
      - "capital_flight" (LIVE Frankfurter API): [{"connector": "capital_flight", "currency": "TRY"}]
      - "gdelt_news_velocity" (LIVE GDELT API): [{"connector": "gdelt_news_velocity", "keyword": "Specific Event or Entity"}]
      - "macro_liquidity" (LIVE FRED API): [{"connector": "macro_liquidity", "series_id": "SOFR"}]
      - "thermal_anomalies" (LIVE NASA FIRMS API): [{"connector": "thermal_anomalies", "region": "Region Name", "bbox": {"lamin": 24.0, "lomin": 54.0, "lamax": 27.0, "lomax": 57.0}}]
      (Provide approximate latitude/longitude bounding boxes or points for live APIs. For attention_proxy, guess the most relevant Wikipedia article title).
      If no physical data is relevant, return [].`;
      
      const gtResponse = await withRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: gtPrompt
      }));
      
      const responseText = gtResponse.text || "[]";
      const match = responseText.match(/\[.*\]/s);
      const jsonStr = match ? match[0] : "[]";
      const queries = JSON.parse(jsonStr);
      
      if (Array.isArray(queries) && queries.length > 0) {
        const results = [];
        for (const q of queries) {
          onProgress(`Querying ${q.connector || 'telemetry'} for ${q.region || 'region'}...`);
          if (q.connector === 'marine_traffic' || q.connector === 'energy_grid') {
            await new Promise(r => setTimeout(r, 800)); // Simulate API latency for mock APIs
          }
          results.push(await getGroundTruthData(q));
        }
        gtData = results.join('\n\n');
      }
    } catch (e) {
      console.error("Failed to query GT connectors", e);
    }

    // Small delay to respect rate limits between phases
    await new Promise(r => setTimeout(r, 1500));

    onProgress("Phase 3: Investigating lead details & sentiment...");
    const researchResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: 'user', parts: [{ text: userLead ? isUrl ? `STRICT FOCUS: Analyze ONLY the content of this URL: ${userLead}` : `STRICT FOCUS: Analyze ONLY this specific lead: ${userLead}` : "Identify the single most promising geopolitical or macro buildup that is currently developing but not yet fully priced in. Provide a brief summary of the lead." }] },
        { role: 'model', parts: [{ text: leadText }] },
        { role: 'user', parts: [{ text: `We queried our physical Ground Truth APIs and found the following telemetry data:\n${gtData || "No significant physical anomalies detected yet."}\n\nNow, perform a deep dive into ONLY this specific situation. Use your search tool to find the most recent updates, local ground-truth indicators, AND explicitly search mainstream financial news (Bloomberg, Reuters, WSJ) to gauge mainstream sentiment. 

CRITICAL: Evaluate the "Crowdedness" of the potential trade. Search for social media buzz (X/Twitter, Reddit/WallStreetBets) and institutional positioning reports to determine if the trade is "too popular." Specifically assess the "Short Squeeze Risk" if the trade involves shorting an asset.

DIVERGENCE CALCULATION: Compare the "Physical Ground Truth" (telemetry, satellite, flight data) against the "Market Price Action" (Yahoo Finance, Bloomberg headlines). Assign a DIVERGENCE METER score from 0-100. 100 means the market is completely oblivious to a major physical buildup.

CORRELATION BASKET LOGIC: Identify not just the primary assets affected, but also "Correlated Proxies." If the lead is about a specific country or sector, identify 2-3 other assets that typically move in tandem due to regional contagion, supply chain links, or sector-wide risk (e.g., "If HUF falls, PLN and RON usually follow").

UPCOMING CATALYSTS: Search for specifically scheduled future events that could trigger or resolve this buildup. This includes economic data releases (CPI, PMI), central bank meetings, political summits, elections, or scheduled military exercises. Provide exact dates if available.

Compare the physical ground truth against the mainstream headlines and social sentiment to calculate the Sentiment Divergence, Crowdedness, and the Divergence Meter. Synthesize everything into the final FULL REPORT format defined in your instructions.` }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    }));

    const text = researchResponse.text || "NO NEW SITUATIONS";
    const labelMatch = text.match(/\[LABEL: (.*?)\]/);
    const label = labelMatch ? labelMatch[1] : undefined;
    
    const coordMatch = text.match(/\[COORDINATES:\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/);
    const coordinates = coordMatch ? { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) } : undefined;
    
    const cleanText = text.replace(/\[LABEL: .*?\]\n?/, '').replace(/\[COORDINATES: .*?\]\n?/, '');

    const sources = researchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: { web?: { title: string; uri: string } }) => ({
        title: chunk.web?.title,
        url: chunk.web?.uri
      }))
      .filter((s: { url?: string }) => s.url) || [];

    onProgress("Phase 4: Synthesizing final report...");
    
    // Phase 5: Archiving Intelligence
    onProgress("Phase 5: Archiving intelligence to Supabase...");
    let archiveId = undefined;
    try {
      const scoreMatch = text.match(/TOTAL: (\d+)\/100/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      const divMatch = text.match(/DIVERGENCE METER: \[Score (\d+)/);
      const divergence = divMatch ? parseInt(divMatch[1]) : 0;

      const record = await saveToArchive({
        label: label || "Unknown Lead",
        coordinates: coordinates ? `${coordinates.lat}, ${coordinates.lon}` : "0, 0",
        content: text,
        telemetry: gtData || "",
        score,
        divergence_score: divergence,
        is_buildup: score > 60
      });
      archiveId = record?.id;
    } catch (e) {
      console.warn("Failed to archive to Supabase:", e);
    }

    return {
      text: cleanText,
      label,
      coordinates,
      sources,
      telemetry: gtData,
      archiveId
    };
  } catch (error) {
    console.error("Gemini Deep Research Error:", error);
    return { text: "ERROR: Deep research failed. Check console.", sources: [] };
  }
}

export async function ingestExternalReport(rawText: string, onProgress: (msg: string) => void) {
  onProgress("Parsing external intelligence...");
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Parse the following external research report into a structured intelligence format.
      
      Raw Report:
      ${rawText}
      
      Respond ONLY with a valid JSON object containing the following keys:
      - "label": A short, punchy title for this buildup (e.g., "HUF/PLN Divergence").
      - "coordinates": Approximate latitude and longitude if a specific region is mentioned (e.g., "47.4979, 19.0402"), otherwise "0,0".
      - "score": An integer from 0-100 representing the strength/asymmetry of the buildup.
      - "divergence_score": An integer from 0-100 representing how disconnected this is from mainstream pricing.
      - "content": A concise, highly analytical markdown summary of the report, formatted for a macro trader. Include the core thesis, catalysts, and risks.
      `,
      config: {
        responseMimeType: "application/json",
      }
    }));
    
    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    
    onProgress("Saving to Intelligence Archive...");
    const record = {
      label: parsed.label || "External Intelligence",
      coordinates: parsed.coordinates || "0,0",
      content: parsed.content || rawText,
      telemetry: "External Source (Manual Ingest)",
      score: parsed.score || 50,
      divergence_score: parsed.divergence_score || 50,
      is_buildup: (parsed.score || 50) > 60
    };
    
    await saveToArchive(record);
    return record;
  } catch (error) {
    console.error("Ingestion error:", error);
    throw error;
  }
}

export async function runUltraDeepAnalysis(baseReport: string, onProgress: (msg: string) => void) {
  onProgress("Phase 1: Assembling Investment Committee (Red Team vs Blue Team)...");
  await new Promise(r => setTimeout(r, 1500));

  const prompt = `You are an elite quantitative macro hedge fund Investment Committee.
  Perform an "Ultra Deep Analysis" on the following intelligence report.

  RAW REPORT:
  ${baseReport}

  You must output a highly structured markdown report with the following exact sections:

  ## 🛡️ TRADE STRUCTURING & PROXIES
  (Do not suggest the obvious crowded trade. Suggest 2-3 asymmetric proxy vehicles, derivatives, or secondary markets to express this view with lower risk).

  ## 🩸 RED TEAMING (DEVIL'S ADVOCATE)
  (Actively try to destroy the thesis. Why is the market right and this report wrong? What is the blind spot?)

  ## 🕸️ SECOND & THIRD-ORDER EFFECTS
  (Map the contagion. If the primary event happens, what obscure supply chains, regional banks, or adjacent commodities are affected?)

  ## 🏛️ HISTORICAL ANALOGS
  (What past historical events match this setup? How did asset classes behave during those analogs?)

  ## 🛑 INVALIDATION TRIGGERS (KILL SWITCH)
  (Define 2-3 exact data points, price levels, or events that would definitively prove this thesis wrong. When do we cut the trade?)
  `;

  onProgress("Phase 2: Generating Ultra Deep Analysis...");
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite macro trader and risk manager. Be ruthless, analytical, and concise.",
      }
    }));

    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Ultra Deep Analysis Error:", error);
    return "ERROR: Ultra Deep Analysis failed. Check console.";
  }
}

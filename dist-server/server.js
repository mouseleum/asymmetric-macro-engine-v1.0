import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(express.json());
  app.get("/api/macro-pulse", async (req, res) => {
    const results = {
      liquidity: { label: "Liquidity", value: "---", trend: "neutral", detail: "Fed Balance Sheet" },
      rates: { label: "Rates", value: "---", trend: "neutral", detail: "Real Rates" },
      yields: { label: "Yields", value: "---", trend: "neutral", detail: "10Y-2Y Spread" },
      inflation: { label: "Inflation", value: "---", trend: "neutral", detail: "CPI Trend" },
      growth: { label: "Growth", value: "---", trend: "neutral", detail: "Industrial Production" },
      risk: { label: "Risk Appetite", value: "---", trend: "neutral", detail: "VIX / DXY / Credit" }
    };
    const fredKey = process.env.FRED_API_KEY;
    if (fredKey) {
      const fredSeries = [
        { id: "WALCL", key: "liquidity" },
        { id: "T10Y2Y", key: "yields" },
        { id: "CPIAUCSL", key: "inflation" },
        { id: "INDPRO", key: "growth" },
        { id: "REAINTRATREARAT10Y", key: "rates" }
      ];
      for (const series of fredSeries) {
        try {
          const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${fredKey}&file_type=json&limit=2&sort_order=desc`;
          const response = await fetch(url);
          const data = await response.json();
          const obs = data.observations || [];
          if (obs.length >= 2) {
            const current = parseFloat(obs[0].value);
            const prev = parseFloat(obs[1].value);
            const trend = current > prev ? "up" : current < prev ? "down" : "neutral";
            let displayValue = current.toString();
            if (series.id === "WALCL") displayValue = `${(current / 1e6).toFixed(2)}T`;
            if (series.id === "T10Y2Y") displayValue = `${current.toFixed(2)}%`;
            if (series.id === "REAINTRATREARAT10Y") displayValue = `${current.toFixed(2)}%`;
            results[series.key].value = displayValue;
            results[series.key].trend = trend;
          }
        } catch (e) {
          console.error(`Server: Failed to fetch FRED series ${series.id}:`, e);
        }
      }
    }
    try {
      const tickers = [
        { id: "^VIX", key: "vix" },
        { id: "DX-Y.NYB", key: "dxy" }
      ];
      let vixValue = 0;
      let dxyValue = 0;
      for (const ticker of tickers) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.id}?interval=1d&range=2d`;
        const response = await fetch(url);
        const data = await response.json();
        const price = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.slice(-1)[0];
        if (ticker.id === "^VIX") vixValue = price;
        if (ticker.id === "DX-Y.NYB") dxyValue = price;
      }
      if (vixValue && dxyValue) {
        results.risk.value = vixValue > 25 ? "PANIC" : vixValue > 20 ? "RISK-OFF" : "RISK-ON";
        results.risk.trend = vixValue > 20 ? "down" : "up";
        results.risk.detail = `VIX: ${vixValue.toFixed(1)} / DXY: ${dxyValue.toFixed(1)}`;
      }
    } catch (e) {
      console.error("Server: Failed to fetch Yahoo Risk data:", e);
    }
    res.json(results);
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();

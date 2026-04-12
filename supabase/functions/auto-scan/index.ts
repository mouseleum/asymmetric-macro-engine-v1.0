import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { GoogleGenAI } from "npm:@google/genai"

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
- CORRELATED PROXIES: [Asset 1, Asset 2] - [Explain how these assets move in tandem with the primary trade]
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

CRITICAL RULES
- Default output is NOTHING
- Never output more than one situation
- Never include speculation
- Never force an opportunity
- High precision over recall ALWAYS

Your goal is not to find opportunities.
Your goal is to avoid false positives.
`;

serve(async (req) => {
  try {
    console.log("Starting Cloud Auto-Scan...");

    // 1. Initialize Gemini
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    const ai = new GoogleGenAI({ apiKey });

    // 2. Fetch Latest News/Data (Simulated for this edge function, but in production you'd fetch from NewsAPI/Twitter here)
    // For now, we ask Gemini to scan its real-time knowledge base using Google Search grounding
    const prompt = `
      Scan the global news and geopolitical landscape from the last 24 hours.
      Identify any emerging asymmetric macro buildups.
      If nothing meets the strict criteria, output exactly: NO NEW SITUATIONS.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      }
    });

    const text = response.text || "";
    console.log("Scan complete. Length:", text.length);

    if (text.includes("NO NEW SITUATIONS")) {
      return new Response(JSON.stringify({ status: "no-situations" }), { headers: { "Content-Type": "application/json" } });
    }

    // 3. Parse Data
    const labelMatch = text.match(/\[LABEL: (.*?)\]/);
    const label = labelMatch ? labelMatch[1] : "Unknown Lead";

    const coordMatch = text.match(/\[COORDINATES: (.*?)\]/);
    const coordinates = coordMatch ? coordMatch[1] : "0, 0";

    const scoreMatch = text.match(/TOTAL: (\d+)\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    
    const divMatch = text.match(/DIVERGENCE METER: \[Score (\d+)/);
    const divergence = divMatch ? parseInt(divMatch[1]) : 0;

    const isBuildup = text.includes('BUILDUP DETECTED');

    // 4. Save to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('intelligence_archive').insert({
        label,
        coordinates,
        content: text,
        telemetry: "Cloud Auto-Scan via Supabase Edge Function",
        score,
        divergence_score: divergence,
        is_buildup: isBuildup
      });
      if (error) console.error("Supabase Insert Error:", error);
    }

    // 5. Telegram Alert
    const threshold = parseInt(Deno.env.get('ALERT_THRESHOLD') || '60');
    if (isBuildup && score >= threshold) {
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
      
      if (token && chatId) {
        const title = label ? `🚨 *CLOUD ALERT: ${label}*` : "🚨 *CLOUD MACRO BUILDUP DETECTED*";
        const message = `${title}\n\n${text.substring(0, 3500)}\n\n_Generated by Supabase Edge Function_`;
        
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          })
        });
        console.log("Telegram alert sent!");
      }
    }

    return new Response(JSON.stringify({ success: true, label, score }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

/**
 * Standalone script for automated macro scans.
 * Can be run via: npx tsx scripts/automate_scan.ts
 */

import { runDeepResearch, sendTelegramNotification } from '../src/lib/gemini';
import * as dotenv from 'dotenv';

// Load environment variables for local/CI execution
dotenv.config();

async function main() {
  console.log("🚀 Starting Automated Asymmetric Macro Scan...");
  
  const onProgress = (step: string) => console.log(`[PROGRESS] ${step}`);
  
  try {
    const report = await runDeepResearch(onProgress);
    
    if (report && report.text && report.text !== "NO NEW SITUATIONS") {
      console.log("✅ Buildup detected! Sending notification...");
      await sendTelegramNotification(report);
      console.log("🏁 Automation complete.");
    } else {
      console.log("📭 No significant buildups detected in this scan.");
    }
  } catch (error) {
    console.error("❌ Automation failed:", error);
    process.exit(1);
  }
}

main();

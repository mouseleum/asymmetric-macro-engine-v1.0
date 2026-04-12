import React, { useState, useEffect } from 'react';
import { runMacroScan, runDeepResearch, sendTelegramNotification, fetchMacroPulse, ingestExternalReport, runUltraDeepAnalysis } from '../lib/gemini';
import { cn } from '../lib/utils';
import { Radar, History, AlertCircle, CheckCircle2, Loader2, ChevronRight, ExternalLink, Pin, Activity, MapPin, Send, TrendingUp, TrendingDown, Minus, Globe, Users, BarChart3, Calendar, Database, Upload, ShieldAlert, Cloud } from 'lucide-react';
import { supabase, updateArchiveRecord } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom radar blip icon
const radarIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="relative w-6 h-6">
          <div class="absolute inset-0 bg-accent rounded-full animate-ping opacity-75"></div>
          <div class="absolute inset-1 bg-accent rounded-full border-2 border-white"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

interface ReportUpdate {
  id: string;
  timestamp: string;
  content: string;
  telemetry?: string;
  sources?: { title: string; url: string }[];
}

interface ScanResult {
  id: string;
  timestamp: string;
  content: string;
  label?: string;
  sources?: { title: string; url: string }[];
  telemetry?: string;
  coordinates?: { lat: number; lon: number };
  status: 'success' | 'no-situations' | 'error';
  updates?: ReportUpdate[];
  lastChecked?: string;
}

export default function Dashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [researchStep, setResearchStep] = useState<string | null>(null);
  const [userInputLead, setUserInputLead] = useState("");
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [watchlist, setWatchlist] = useState<ScanResult[]>([]);
  const [currentScan, setCurrentScan] = useState<{ 
    text: string; 
    label?: string; 
    timestamp?: string;
    sources: { title: string; url: string }[]; 
    telemetry?: string; 
    coordinates?: { lat: number; lon: number };
    updates?: ReportUpdate[];
    archiveId?: string;
    ultraDeepAnalysis?: string;
  } | null>(null);
  const [nextScanIn, setNextScanIn] = useState<number | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [macroPulse, setMacroPulse] = useState<any>(null);
  const [isRefreshingPulse, setIsRefreshingPulse] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isUltraDeepRunning, setIsUltraDeepRunning] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState<number>(60);
  const [showCloudSetup, setShowCloudSetup] = useState(false);
  
  // Ingest State
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestInput, setIngestInput] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState("");

  const SCAN_INTERVAL_SECONDS = 300; // 5 minutes
  const WATCHLIST_INTERVAL_MS = 3600 * 1000; // 1 hour

  useEffect(() => {
    const savedHistory = localStorage.getItem('macro_scan_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedWatchlist = localStorage.getItem('macro_watchlist');
    if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));

    refreshMacroPulse();
    setIsSupabaseConnected(!!supabase);
  }, []);

  const refreshMacroPulse = async () => {
    setIsRefreshingPulse(true);
    try {
      const pulse = await fetchMacroPulse();
      setMacroPulse(pulse);
    } catch (e) {
      console.error("Failed to refresh macro pulse:", e);
    } finally {
      setIsRefreshingPulse(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  };

  // Watchlist background monitoring
  useEffect(() => {
    const interval = setInterval(async () => {
      if (watchlist.length === 0) return;
      
      console.log("Running background watchlist scan...");
      for (const item of watchlist) {
        // We use runMacroScan for background updates to save tokens/time
        const result = await runMacroScan(item.label || item.content.slice(0, 100));
        
        setWatchlist(prev => {
          const updated = prev.map(w => {
            if (w.id === item.id) {
              const baseUpdate = { ...w, lastChecked: new Date().toISOString() };
              if (result.text.includes('BUILDUP DETECTED')) {
                const newUpdate: ReportUpdate = {
                  id: Math.random().toString(36).substring(7),
                  timestamp: new Date().toISOString(),
                  content: result.text,
                  telemetry: result.telemetry,
                  sources: result.sources
                };
                return { 
                  ...baseUpdate, 
                  timestamp: newUpdate.timestamp, // Update parent timestamp to latest activity
                  updates: [...(w.updates || []), newUpdate] 
                };
              }
              return baseUpdate;
            }
            return w;
          });
          localStorage.setItem('macro_watchlist', JSON.stringify(updated));
          return updated;
        });
      }
    }, WATCHLIST_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [watchlist]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let countdown: NodeJS.Timeout;

    if (isAutoScanning && !isScanning) {
      setNextScanIn(SCAN_INTERVAL_SECONDS);
      
      countdown = setInterval(() => {
        setNextScanIn(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);

      timer = setTimeout(() => {
        handleScan();
      }, SCAN_INTERVAL_SECONDS * 1000);
    } else {
      setNextScanIn(null);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(countdown);
    };
  }, [isAutoScanning, isScanning]);

  const saveToHistory = (content: string, sources: { title: string; url: string }[], label?: string, telemetry?: string, coordinates?: { lat: number; lon: number }) => {
    const status = content.includes('BUILDUP DETECTED') 
      ? 'success' 
      : content.includes('NO NEW SITUATIONS') 
        ? 'no-situations' 
        : 'error';

    const newScan: ScanResult = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      content,
      label,
      sources,
      telemetry,
      coordinates,
      status
    };

    setHistory(prev => {
      if (isAutoScanning && status === 'no-situations' && prev[0]?.status === 'no-situations') {
        const updated = [newScan, ...prev.slice(1)].slice(0, 20);
        localStorage.setItem('macro_scan_history', JSON.stringify(updated));
        return updated;
      }
      
      const updated = [newScan, ...prev].slice(0, 20);
      localStorage.setItem('macro_scan_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleScan = async () => {
    setIsScanning(true);
    setResearchStep(isDeepResearch ? "Initializing Agent..." : "Scanning...");
    
    let result: { text: string; label?: string; sources: { title: string; url: string }[]; telemetry?: string; coordinates?: { lat: number; lon: number } };
    if (isDeepResearch) {
      result = await runDeepResearch((step) => setResearchStep(step), userInputLead || undefined);
    } else {
      result = await runMacroScan(userInputLead || undefined);
    }
    
    setCurrentScan({
      ...result,
      timestamp: new Date().toISOString()
    });
    saveToHistory(result.text, result.sources, result.label, result.telemetry, result.coordinates);
    
    // Auto-alert via Telegram if a buildup is detected during an auto-scan
    const scoreMatch = result.text.match(/TOTAL: (\d+)\/100/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    if (isAutoScanning && result.text.includes('BUILDUP DETECTED') && score >= alertThreshold) {
      try {
        await sendTelegramNotification(result);
      } catch (e) {
        console.error("Auto-Telegram alert failed:", e);
      }
    }

    setIsScanning(false);
    setResearchStep(null);
  };

  const toggleWatchlist = (item: { text: string; label?: string; sources: { title: string; url: string }[] }) => {
    const isPinned = watchlist.some(w => w.label === item.label);
    if (isPinned) {
      const updated = watchlist.filter(w => w.label !== item.label);
      setWatchlist(updated);
      localStorage.setItem('macro_watchlist', JSON.stringify(updated));
    } else {
      const newItem: ScanResult = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        content: item.text,
        label: item.label,
        sources: item.sources,
        status: 'success'
      };
      const updated = [...watchlist, newItem];
      setWatchlist(updated);
      localStorage.setItem('macro_watchlist', JSON.stringify(updated));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramStatus('sending');
    try {
      await sendTelegramNotification({
        label: "System Test",
        text: "This is a test notification from your Asymmetric Macro Engine. If you see this, your Telegram integration is working correctly."
      });
      setTelegramStatus('success');
      setTimeout(() => setTelegramStatus('idle'), 3000);
    } catch (error) {
      console.error("Telegram test failed:", error);
      setTelegramStatus('error');
      setTimeout(() => setTelegramStatus('idle'), 3000);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleIngest = async () => {
    if (!ingestInput.trim()) return;
    setIsIngesting(true);
    try {
      await ingestExternalReport(ingestInput, setIngestStatus);
      setIngestStatus("Successfully archived!");
      setTimeout(() => {
        setShowIngestModal(false);
        setIngestInput("");
        setIngestStatus("");
      }, 2000);
    } catch (e) {
      setIngestStatus("Error parsing report.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleUltraDeep = async () => {
    if (!currentScan) return;
    setIsUltraDeepRunning(true);
    setResearchStep("Initializing Ultra Deep Analysis...");
    try {
      const ultraDeepResult = await runUltraDeepAnalysis(currentScan.text, setResearchStep);
      setCurrentScan(prev => prev ? { ...prev, ultraDeepAnalysis: ultraDeepResult } : null);
      
      if (currentScan.archiveId) {
        setResearchStep("Updating Intelligence Archive...");
        await updateArchiveRecord(currentScan.archiveId, `\n\n---\n\n# ULTRA DEEP ANALYSIS\n\n${ultraDeepResult}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUltraDeepRunning(false);
      setResearchStep(null);
    }
  };

  const handleSendToTelegram = async (scan: any) => {
    setTelegramStatus('sending');
    try {
      await sendTelegramNotification(scan);
      setTelegramStatus('success');
      setTimeout(() => setTelegramStatus('idle'), 3000);
    } catch (error) {
      console.error("Telegram send failed:", error);
      setTelegramStatus('error');
      setTimeout(() => setTelegramStatus('idle'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-accent selection:text-white">
      {/* Macro Pulse Bar */}
      <div className="bg-ink text-bg py-2 px-4 md:px-6 overflow-x-auto whitespace-nowrap border-b border-white/10 flex items-center gap-8 no-scrollbar">
        <div className="flex items-center gap-2 border-r border-white/20 pr-8">
          <Globe className={cn("w-3 h-3 text-accent", isRefreshingPulse && "animate-spin")} />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Global Macro Pulse</span>
        </div>
        
        {macroPulse ? (
          Object.entries(macroPulse).map(([key, data]: [string, any]) => (
            <div key={key} className="flex items-center gap-3 group cursor-help" title={data.detail}>
              <span className="text-[9px] font-mono uppercase opacity-50 group-hover:opacity-100 transition-opacity">{data.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold">{data.value}</span>
                {data.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-400" />}
                {data.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
                {data.trend === 'neutral' && <Minus className="w-3 h-3 opacity-30" />}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-4 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-3 w-20 bg-white/10 rounded-sm" />
            ))}
          </div>
        )}

        <button 
          onClick={refreshMacroPulse}
          disabled={isRefreshingPulse}
          className="ml-auto text-[9px] font-mono uppercase opacity-30 hover:opacity-100 transition-opacity flex items-center gap-1"
        >
          {isRefreshingPulse ? <Loader2 className="w-2 h-2 animate-spin" /> : <Activity className="w-2 h-2" />}
          Refresh Pulse
        </button>
      </div>

      {/* Header */}
      <header className="border-b border-line p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tighter uppercase">Asymmetric Macro Engine</h1>
          <p className="text-[10px] md:text-[11px] opacity-50 font-mono mt-1">SYSTEM STATUS: OPERATIONAL // SCANNER: ACTIVE</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 border border-line/10 rounded-sm w-full md:w-64">
            <input 
              type="text"
              value={userInputLead}
              onChange={(e) => setUserInputLead(e.target.value)}
              placeholder="Target Opportunity (Optional)..."
              className="bg-transparent border-none outline-none text-[10px] md:text-xs font-mono w-full placeholder:opacity-30"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-4 bg-white/50 px-3 py-1.5 border border-line/10 rounded-sm w-full sm:w-auto">
            <div className="hidden lg:flex items-center gap-2 pr-4 border-r border-line/10">
              <span className="text-[10px] font-mono uppercase text-accent flex items-center gap-1">
                <Activity className="w-3 h-3" /> Telemetry Active
              </span>
            </div>

            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[10px] font-mono font-bold uppercase transition-colors",
              isSupabaseConnected ? "border-green-500/20 text-green-600 bg-green-500/5" : "border-line/10 text-line/40 bg-line/5"
            )}>
              <Database className="w-3 h-3" />
              {isSupabaseConnected ? "Archive Active" : "Local Only"}
            </div>

            {isSupabaseConnected && (
              <button 
                onClick={() => setShowIngestModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-accent/20 text-[10px] font-mono font-bold uppercase text-accent hover:bg-accent hover:text-white transition-colors"
                title="Ingest External Intelligence"
              >
                <Upload className="w-3 h-3" />
                Ingest
              </button>
            )}

            <div className="flex items-center gap-2 pr-4 border-r border-line/10">
              <span className={cn("text-[10px] font-mono uppercase transition-opacity", !isDeepResearch ? "opacity-100 text-accent font-bold" : "opacity-50")}>Quick</span>
              <button 
                onClick={() => setIsDeepResearch(!isDeepResearch)}
                className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  isDeepResearch ? "bg-accent" : "bg-ink/20"
                )}
              >
                <div className={cn(
                  "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all",
                  isDeepResearch ? "left-4.5" : "left-0.5"
                )} />
              </button>
              <span className={cn("text-[10px] font-mono uppercase transition-opacity", isDeepResearch ? "opacity-100 text-accent font-bold" : "opacity-50")}>Deep</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase opacity-50">Auto-Scan</span>
              <button 
                onClick={() => setIsAutoScanning(!isAutoScanning)}
                className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  isAutoScanning ? "bg-accent" : "bg-ink/20"
                )}
              >
                <div className={cn(
                  "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all",
                  isAutoScanning ? "left-4.5" : "left-0.5"
                )} />
              </button>
              {isAutoScanning && nextScanIn !== null && (
                <span className="text-[10px] font-mono text-accent animate-pulse ml-2">
                  NEXT: {formatTime(nextScanIn)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-line/10">
              <span className="text-[10px] font-mono uppercase opacity-50" title="Minimum score required to trigger a Telegram alert">Alert Threshold:</span>
              <input 
                type="number" 
                min="0" 
                max="100" 
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="bg-transparent border border-line/20 rounded-sm w-12 text-center text-[10px] font-mono outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-line/10">
              <button 
                onClick={() => setShowCloudSetup(true)}
                className="text-[10px] font-mono uppercase px-2 py-1 border border-accent/50 text-accent rounded-sm transition-all hover:bg-accent hover:text-white flex items-center gap-1"
              >
                <Cloud className="w-3 h-3" /> Deploy to Cloud
              </button>
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-line/10">
              <button 
                onClick={handleTestTelegram}
                disabled={isTestingTelegram}
                className={cn(
                  "text-[10px] font-mono uppercase px-2 py-1 border rounded-sm transition-all flex items-center gap-1",
                  telegramStatus === 'success' ? "bg-green-500 text-white border-green-500" :
                  telegramStatus === 'error' ? "bg-red-500 text-white border-red-500" :
                  "hover:bg-ink hover:text-bg border-line/20"
                )}
              >
                {isTestingTelegram ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {telegramStatus === 'success' ? 'Sent' : telegramStatus === 'error' ? 'Failed' : 'Test Telegram'}
              </button>
            </div>
          </div>
          <button 
            onClick={handleScan}
            disabled={isScanning}
            className={cn(
              "px-4 md:px-6 py-2 bg-ink text-bg font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 w-full sm:w-auto",
              "hover:bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed",
              isScanning && "animate-pulse"
            )}
          >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isDeepResearch ? 'Agent Working...' : 'Scanning...'}
            </>
          ) : (
            <>
              <Radar className="w-4 h-4" />
              {isDeepResearch ? 'Run Deep Research' : 'Quick Scan'}
            </>
          )}
        </button>
      </div>
    </header>

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_350px] min-h-[calc(100vh-89px)]">
        {/* Main Content Area */}
        <div className="border-r border-line p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {!currentScan && !isScanning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center opacity-30"
              >
                <Radar className="w-16 h-16 mb-4" />
                <p className="font-mono text-sm uppercase tracking-widest">Awaiting Command // System Idle</p>
              </motion.div>
            )}

            {isScanning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-ink/10 rounded-full animate-ping absolute inset-0" />
                  <div className="w-24 h-24 border-4 border-accent rounded-full animate-spin border-t-transparent" />
                </div>
                <p className="font-mono text-sm uppercase tracking-widest mt-8 animate-pulse">
                  {researchStep || "Processing..."}
                </p>
                <p className="text-[10px] opacity-50 mt-2 max-w-xs">
                  {isDeepResearch 
                    ? "The agent is performing multi-step research, following links, and verifying ground truth indicators."
                    : "Validating buildups, scoring asymmetry, and filtering noise."}
                </p>
              </motion.div>
            )}

            {currentScan && !isScanning && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
              >
                <div className={cn(
                  "p-8 border border-line bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] mb-12",
                  currentScan.text.includes('BUILDUP DETECTED') ? "border-accent" : "border-line"
                )}>
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-line/10">
                    <div className="flex items-center gap-3">
                      {currentScan.text.includes('BUILDUP DETECTED') ? (
                        <CheckCircle2 className="w-6 h-6 text-accent" />
                      ) : (
                        <AlertCircle className="w-6 h-6 opacity-50" />
                      )}
                      <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight">
                          {currentScan.label || (currentScan.text.includes('BUILDUP DETECTED') ? 'Opportunity Identified' : 'Scan Complete')}
                        </h2>
                        {currentScan.label && (
                          <p className="text-[10px] font-mono uppercase opacity-50">
                            {currentScan.text.includes('BUILDUP DETECTED') ? 'Opportunity Identified' : 'Scan Complete'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleWatchlist(currentScan)}
                        className={cn(
                          "text-[10px] font-mono uppercase transition-all flex items-center gap-1 px-2 py-1 border rounded-sm",
                          watchlist.some(w => w.label === currentScan.label)
                            ? "bg-accent text-white border-accent"
                            : "opacity-50 hover:opacity-100 border-line/20"
                        )}
                      >
                        {watchlist.some(w => w.label === currentScan.label) ? 'Pinned to Watchlist' : 'Pin to Watchlist'}
                      </button>
                      <button 
                        onClick={() => handleSendToTelegram(currentScan)}
                        className="text-[10px] font-mono uppercase opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Send to Telegram
                      </button>
                      <button 
                        onClick={() => navigator.clipboard.writeText(currentScan.text)}
                        className="text-[10px] font-mono uppercase opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        Copy Raw
                      </button>
                    </div>
                  </div>

                  {currentScan.coordinates && (
                    <div className="mb-8 border border-line/10 bg-ink/5 p-1">
                      <div className="h-64 w-full relative z-0">
                        <MapContainer 
                          center={[currentScan.coordinates.lat, currentScan.coordinates.lon]} 
                          zoom={5} 
                          scrollWheelZoom={false}
                          className="w-full h-full"
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          />
                          <Marker position={[currentScan.coordinates.lat, currentScan.coordinates.lon]} icon={radarIcon}>
                            <Popup className="font-mono text-xs">
                              {currentScan.label || 'Anomaly Detected'} <br />
                              Lat: {currentScan.coordinates.lat}, Lon: {currentScan.coordinates.lon}
                            </Popup>
                          </Marker>
                        </MapContainer>
                      </div>
                      <div className="flex items-center gap-2 p-2 text-[10px] font-mono uppercase opacity-50">
                        <MapPin className="w-3 h-3" />
                        Geospatial Lock: {currentScan.coordinates.lat}, {currentScan.coordinates.lon}
                      </div>
                    </div>
                  )}

                  <div className="mb-8 pb-4 border-b border-line/10">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">Initial Analysis</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-50">{new Date(currentScan.timestamp || Date.now()).toLocaleString()}</span>
                    </div>
                    <div className="prose prose-sm max-w-none font-sans">
                      <ReactMarkdown 
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-2xl font-bold uppercase tracking-tighter mb-4" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold uppercase tracking-tight mt-8 mb-2" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mt-6 mb-1" {...props} />,
                          p: ({node, ...props}) => {
                            const text = props.children?.toString() || '';
                            if (text.startsWith('DIVERGENCE METER:')) {
                              const scoreMatch = text.match(/\[Score (\d+)-?(\d+)?\]/) || text.match(/(\d+)/);
                              const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
                              return (
                                <div className="mt-4 mb-6 bg-ink/5 p-4 rounded-sm border border-line/5">
                                  <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50">Divergence Meter</span>
                                    <span className={cn(
                                      "text-xl font-mono font-bold",
                                      score > 70 ? "text-accent" : score > 40 ? "text-yellow-600" : "text-green-600"
                                    )}>{score}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-ink/10 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${score}%` }}
                                      transition={{ duration: 1, ease: "easeOut" }}
                                      className={cn(
                                        "h-full rounded-full",
                                        score > 70 ? "bg-accent" : score > 40 ? "bg-yellow-500" : "bg-green-500"
                                      )}
                                    />
                                  </div>
                                  <p className="text-[10px] mt-2 opacity-50 italic">
                                    {score > 70 ? "CRITICAL MISPRICING: Market is ignoring physical reality." : 
                                     score > 40 ? "MODERATE DIVERGENCE: Market is starting to react but lags telemetry." : 
                                     "LOW DIVERGENCE: Market is largely aligned with ground truth."}
                                  </p>
                                </div>
                              );
                            }
                            if (text.startsWith('ASSET CORRELATION BASKET') || text.startsWith('SENTIMENT DIVERGENCE:') || text.startsWith('CROWDEDNESS INDICATOR:') || text.startsWith('UPCOMING CATALYSTS')) {
                              return <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mt-6 mb-1" {...props} />;
                            }
                            return <p className="mb-4 leading-relaxed text-ink/80" {...props} />;
                          },
                          ul: ({node, ...props}) => <ul className="list-none space-y-2 mb-6" {...props} />,
                          li: ({node, ...props}) => {
                            const text = props.children?.toString() || '';
                            if (text.startsWith('PRIMARY LONG:') || text.startsWith('LONG:')) {
                              return <li className="flex gap-2 items-start before:content-['▲'] before:text-green-500 before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.startsWith('PRIMARY SHORT:') || text.startsWith('SHORT:')) {
                              return <li className="flex gap-2 items-start before:content-['▼'] before:text-red-500 before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.startsWith('CORRELATED PROXIES:')) {
                              return <li className="flex gap-2 items-start before:content-['🔗'] before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.startsWith('HEDGE/SECONDARY:')) {
                              return <li className="flex gap-2 items-start before:content-['◆'] before:text-yellow-500 before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.startsWith('Social/Retail Sentiment:')) {
                              return <li className="flex gap-2 items-start before:content-['💬'] before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.startsWith('Institutional Positioning:')) {
                              return <li className="flex gap-2 items-start before:content-['🏛️'] before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.startsWith('Short Squeeze Risk:')) {
                              return <li className="flex gap-2 items-start before:content-['⚡'] before:font-mono before:text-xs before:mt-1" {...props} />;
                            }
                            if (text.match(/^\d{4}-\d{2}-\d{2}/) || text.match(/^[A-Z][a-z]+ \d{1,2}/)) {
                              return (
                                <li className="flex gap-4 items-start p-3 bg-accent/5 border border-accent/10 rounded-sm mb-2 group hover:bg-accent/10 transition-colors" {...props}>
                                  <div className="flex flex-col items-center justify-center min-w-[50px] py-1 bg-accent text-white rounded-sm shadow-sm">
                                    <Calendar className="w-3 h-3 mb-0.5" />
                                    <span className="text-[8px] font-mono font-bold uppercase">Event</span>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-xs font-sans leading-relaxed">{text}</span>
                                  </div>
                                </li>
                              );
                            }
                            return <li className="flex gap-2 items-start before:content-['//'] before:text-accent before:font-mono before:text-xs before:mt-1" {...props} />;
                          },
                          hr: ({node, ...props}) => <hr className="border-line/10 my-8" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-ink" {...props} />,
                        }}
                      >
                        {currentScan.text}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Ultra Deep Analysis Section */}
                  {currentScan.ultraDeepAnalysis ? (
                    <div className="mb-8 pb-4 border-b border-line/10 bg-accent/5 p-6 rounded-sm border border-accent/20">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-accent" />
                          <span className="text-xs font-mono font-bold uppercase tracking-widest text-accent">Ultra Deep Analysis (Pro)</span>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none font-sans prose-headings:text-ink prose-p:text-ink/80 prose-li:text-ink/80">
                        <ReactMarkdown
                          components={{
                            h2: ({node, ...props}) => <h2 className="text-md font-bold uppercase tracking-tight mt-8 mb-3 text-accent border-b border-accent/20 pb-2 flex items-center gap-2" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                            ul: ({node, ...props}) => <ul className="space-y-2 mb-6" {...props} />,
                            li: ({node, ...props}) => <li className="flex gap-2 items-start before:content-['//'] before:text-accent before:font-mono before:text-xs before:mt-1" {...props} />,
                          }}
                        >
                          {currentScan.ultraDeepAnalysis}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8 flex justify-center">
                      <button
                        onClick={handleUltraDeep}
                        disabled={isUltraDeepRunning}
                        className="group relative overflow-hidden bg-ink text-bg px-8 py-4 rounded-sm font-mono text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-3"
                      >
                        {isUltraDeepRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Assembling Investment Committee...
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-4 h-4 text-accent group-hover:text-white transition-colors" />
                            Run Ultra Deep Analysis (Pro)
                          </>
                        )}
                        {!isUltraDeepRunning && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Crisis Timeline / Updates Stream */}
                  {currentScan.updates && currentScan.updates.length > 0 && (
                    <div className="mt-16 pt-12 border-t-2 border-accent/30 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white px-4 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] rounded-full shadow-lg">
                        Crisis Timeline
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 mb-12">
                        <History className="w-5 h-5 text-accent" />
                        <h2 className="text-xl font-bold uppercase tracking-tighter">Intelligence Evolution</h2>
                      </div>

                      <div className="relative space-y-16 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-accent before:via-line/20 before:to-line/5">
                        {currentScan.updates.map((update, idx) => {
                          const marketReaction = update.content.match(/MARKET REACTION:\n(.*)/)?.[1] || "STABLE";
                          const isLatest = idx === 0;
                          
                          return (
                            <div key={update.id} className="relative pl-12 group">
                              {/* Timeline Node */}
                              <div className={cn(
                                "absolute left-0 top-1 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10",
                                isLatest ? "bg-accent border-accent text-white shadow-[0_0_15px_rgba(242,125,38,0.5)]" : "bg-bg border-line/20 text-line/40 group-hover:border-accent/50 group-hover:text-accent"
                              )}>
                                {isLatest ? <Activity className="w-4 h-4 animate-pulse" /> : <div className="w-1.5 h-1.5 bg-current rounded-full" />}
                              </div>

                              {/* Header */}
                              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider",
                                    isLatest ? "bg-accent/10 text-accent" : "bg-ink/5 opacity-50"
                                  )}>
                                    {isLatest ? "Latest Intelligence" : `Update #${currentScan.updates!.length - idx}`}
                                  </span>
                                  <span className="text-[10px] font-mono opacity-30">{new Date(update.timestamp).toLocaleString()}</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono uppercase opacity-30">Market Impact:</span>
                                  <span className={cn(
                                    "text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm border",
                                    marketReaction.includes('FLAT') ? "border-line/10 opacity-50" : "border-accent text-accent bg-accent/5"
                                  )}>
                                    {marketReaction}
                                  </span>
                                </div>
                              </div>

                              {/* Content Card */}
                              <div className={cn(
                                "p-6 border transition-all",
                                isLatest ? "bg-white border-accent/30 shadow-[4px_4px_0px_0px_rgba(242,125,38,0.1)]" : "bg-white/50 border-line/5 hover:border-line/20"
                              )}>
                                <div className="prose prose-sm max-w-none font-sans opacity-90">
                                  <ReactMarkdown
                                    components={{
                                      h1: ({node, ...props}) => <h1 className="text-lg font-bold uppercase tracking-tighter mb-4" {...props} />,
                                      h2: ({node, ...props}) => <h2 className="text-md font-bold uppercase tracking-tight mt-6 mb-2" {...props} />,
                                      p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-ink/80" {...props} />,
                                      ul: ({node, ...props}) => <ul className="list-none space-y-2 mb-6" {...props} />,
                                      li: ({node, ...props}) => <li className="flex gap-2 items-start before:content-['//'] before:text-accent before:font-mono before:text-xs before:mt-1" {...props} />,
                                    }}
                                  >
                                    {update.content.split('MARKET REACTION:')[0]}
                                  </ReactMarkdown>
                                </div>

                                {update.telemetry && (
                                  <details className="mt-6 group/telemetry">
                                    <summary className="text-[9px] font-mono uppercase opacity-30 group-hover/telemetry:opacity-100 cursor-pointer transition-opacity flex items-center gap-1">
                                      <Activity className="w-3 h-3" /> Telemetry Log
                                    </summary>
                                    <div className="mt-2 bg-ink/5 p-3 border border-line/10 font-mono text-[9px] whitespace-pre-wrap">
                                      {update.telemetry}
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Origin Point */}
                        <div className="relative pl-12 pt-4">
                          <div className="absolute left-1.5 top-0 w-5 h-5 rounded-full bg-line/10 border-4 border-bg flex items-center justify-center">
                            <div className="w-1 h-1 bg-line/30 rounded-full" />
                          </div>
                          <div className="text-[10px] font-mono uppercase opacity-30 tracking-widest">
                            Signal Origin Detected
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentScan.telemetry && (
                    <div className="mt-8 pt-8 border-t border-line/10">
                      <h3 className="text-[10px] font-mono uppercase opacity-50 mb-4 tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Raw Telemetry Data
                      </h3>
                      <div className="bg-ink/5 p-4 border border-line/10 font-mono text-[10px] whitespace-pre-wrap leading-relaxed">
                        {currentScan.telemetry}
                      </div>
                    </div>
                  )}

                  {currentScan.sources.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-line/10">
                      <h3 className="text-[10px] font-mono uppercase opacity-50 mb-4 tracking-widest">Grounding Sources</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {currentScan.sources.map((source, idx) => (
                          <a 
                            key={idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 bg-bg border border-line/5 hover:border-accent/30 transition-colors group"
                          >
                            <span className="text-[10px] font-mono truncate max-w-[200px]">{source.title || source.url}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentScan.text.includes('BUILDUP DETECTED') && (
                    <div className="mt-12 pt-8 border-t border-line flex justify-between items-center">
                      <div className="text-[10px] font-mono opacity-50 uppercase">
                        Confidence Score: {currentScan.text.match(/TOTAL: (\d+)\/100/)?.[1] || 'N/A'}
                      </div>
                      <button 
                        onClick={() => {
                          const blob = new Blob([currentScan.text + (currentScan.ultraDeepAnalysis ? `\n\n---\n\n# ULTRA DEEP ANALYSIS\n\n${currentScan.ultraDeepAnalysis}` : '')], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${currentScan.label?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'macro_report'}.md`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-accent transition-colors"
                      >
                        Export Analysis <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar / History */}
        <aside className="bg-white/50 overflow-y-auto flex flex-col">
          {/* Watchlist Section */}
          {watchlist.length > 0 && (
            <div className="border-b border-line">
              <div className="p-6 pb-3 flex items-center gap-2">
                <Radar className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Live Watchlist</h3>
              </div>
              <div className="divide-y divide-line/10">
                {watchlist.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => setCurrentScan({ 
                      text: item.content, 
                      label: item.label, 
                      timestamp: item.timestamp,
                      sources: item.sources || [], 
                      telemetry: item.telemetry,
                      coordinates: item.coordinates,
                      updates: item.updates 
                    })}
                    className={cn(
                      "w-full p-4 text-left transition-all hover:bg-accent/5 group relative cursor-pointer",
                      currentScan?.label === item.label && "bg-accent/10"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono opacity-50">
                          Last Activity: {formatRelativeTime(item.timestamp)}
                        </span>
                        {item.lastChecked && (
                          <span className="text-[8px] font-mono opacity-30 uppercase">
                            Last Checked: {new Date(item.lastChecked).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.updates && item.updates.length > 0 && (
                          <span className="text-[9px] font-mono bg-accent text-white px-1 rounded-sm">
                            +{item.updates.length}
                          </span>
                        )}
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      </div>
                    </div>
                    <p className="text-xs font-bold uppercase truncate pr-12">
                      {item.label || 'Unnamed Opportunity'}
                    </p>
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          // Manual refresh logic
                          const result = await runDeepResearch(() => {}, item.label || item.content.slice(0, 100));
                          if (result.text.includes('BUILDUP DETECTED')) {
                            const newUpdate: ReportUpdate = {
                              id: Math.random().toString(36).substring(7),
                              timestamp: new Date().toISOString(),
                              content: result.text,
                              telemetry: result.telemetry,
                              sources: result.sources
                            };
                            setWatchlist(prev => {
                              const updated = prev.map(w => w.id === item.id ? { 
                                ...w, 
                                timestamp: newUpdate.timestamp,
                                lastChecked: newUpdate.timestamp,
                                updates: [...(w.updates || []), newUpdate] 
                              } : w);
                              localStorage.setItem('macro_watchlist', JSON.stringify(updated));
                              return updated;
                            });
                          } else {
                            // Even if no buildup, update the lastChecked time
                            setWatchlist(prev => {
                              const updated = prev.map(w => w.id === item.id ? { 
                                ...w, 
                                lastChecked: new Date().toISOString() 
                              } : w);
                              localStorage.setItem('macro_watchlist', JSON.stringify(updated));
                              return updated;
                            });
                          }
                        }}
                        className="p-1 hover:bg-accent hover:text-white rounded-sm transition-colors"
                        title="Force Refresh Update"
                      >
                        <Activity className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist({ text: item.content, label: item.label, sources: item.sources || [] });
                        }}
                        className="p-1 hover:bg-red-500 hover:text-white rounded-sm transition-colors"
                        title="Unpin from Watchlist"
                      >
                        <AlertCircle className="w-3 h-3 rotate-45" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Scan History</h3>
            </div>
            {history.length > 0 && (
              <button 
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('macro_scan_history');
                }}
                className="text-[9px] font-mono uppercase opacity-50 hover:opacity-100 transition-opacity"
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="divide-y divide-line/10">
            {history.length === 0 ? (
              <div className="p-8 text-center opacity-30">
                <p className="text-[10px] font-mono uppercase">No history records</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setCurrentScan({ 
                    text: item.content, 
                    label: item.label, 
                    timestamp: item.timestamp,
                    sources: item.sources || [], 
                    telemetry: item.telemetry,
                    coordinates: item.coordinates
                  })}
                  className={cn(
                    "w-full p-4 text-left transition-all hover:bg-ink hover:text-bg group cursor-pointer",
                    currentScan?.text === item.content && "bg-ink text-bg"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-mono opacity-50 group-hover:opacity-70">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist({ text: item.content, label: item.label, sources: item.sources || [] });
                          }}
                          className={cn(
                            "opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity",
                            watchlist.some(w => w.label === item.label) && "opacity-100 text-accent"
                          )}
                          title={watchlist.some(w => w.label === item.label) ? "Unpin from Watchlist" : "Pin to Watchlist"}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      )}
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        item.status === 'success' ? "bg-accent" : "bg-ink/20 group-hover:bg-bg/20"
                      )} />
                    </div>
                  </div>
                  <p className="text-xs font-bold uppercase truncate">
                    {item.label || (item.status === 'success' ? 'Opportunity Detected' : 'No Situations Found')}
                  </p>
                  {item.label && (
                    <p className="text-[9px] font-mono uppercase opacity-30 mt-0.5">
                      {item.status === 'success' ? 'Opportunity Detected' : 'No Situations Found'}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] font-mono uppercase">View Report</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-line bg-ink text-bg p-2 px-6 flex justify-between items-center text-[9px] font-mono uppercase tracking-widest">
        <div className="flex gap-6">
          <span>Scanner: v1.0.6</span>
          <span>Engine: Gemini-3-Flash</span>
          <span>Grounding: Search + Market + Telemetry APIs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          Live Feed Connected
        </div>
      </footer>

      {/* Cloud Setup Modal */}
      <AnimatePresence>
        {showCloudSetup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-line/20 shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-accent" />
                  <h2 className="text-lg font-bold uppercase tracking-tighter">Deploy Cloud Auto-Scan</h2>
                </div>
                <button onClick={() => setShowCloudSetup(false)} className="text-ink/50 hover:text-ink">
                  <Minus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none font-sans text-ink/80">
                <p>
                  To run the engine 24/7 without keeping your browser open, we have generated a <strong>Supabase Edge Function</strong> and a <strong>pg_cron</strong> script.
                </p>
                
                <h3 className="text-sm font-bold uppercase tracking-widest mt-6 mb-2 text-ink">Step 1: Deploy the Edge Function</h3>
                <p>Open your terminal in the root of this project and run the following Supabase CLI commands:</p>
                <pre className="bg-ink/5 p-3 rounded-sm text-[10px] font-mono border border-line/10 whitespace-pre-wrap">
{`# 1. Login to Supabase CLI
supabase login

# 2. Link your project
supabase link --project-ref <YOUR_PROJECT_REF>

# 3. Set your environment variables securely
supabase secrets set GEMINI_API_KEY="your_key" TELEGRAM_BOT_TOKEN="your_token" TELEGRAM_CHAT_ID="your_chat_id" ALERT_THRESHOLD="60"

# 4. Deploy the function
supabase functions deploy auto-scan --no-verify-jwt`}
                </pre>

                <h3 className="text-sm font-bold uppercase tracking-widest mt-6 mb-2 text-ink">Step 2: Schedule the Cron Job</h3>
                <p>Go to your Supabase Dashboard → SQL Editor, and run this script to trigger the function every 5 minutes:</p>
                <pre className="bg-ink/5 p-3 rounded-sm text-[10px] font-mono border border-line/10 whitespace-pre-wrap">
{`CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'macro-auto-scan',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
      url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/auto-scan',
      headers:='{"Content-Type": "application/json"}'::jsonb
  );
  $$
);`}
                </pre>
                
                <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-sm">
                  <p className="text-xs m-0">
                    <strong>Note:</strong> The code for these files has already been generated in your project under <code>/supabase/functions/auto-scan/index.ts</code> and <code>/supabase/setup-cron.sql</code>.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIngestModal && (
          <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-ink text-bg w-full max-w-2xl rounded-sm border border-white/20 p-6 flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                  <Upload className="w-4 h-4 text-accent" />
                  Ingest External Intelligence
                </h2>
                <button onClick={() => setShowIngestModal(false)} className="opacity-50 hover:opacity-100 transition-opacity">
                  <Minus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] opacity-70 font-mono">
                Paste raw research from Perplexity, Bloomberg, or analyst notes. The engine will parse, score, and format it into the Global Archive.
              </p>
              <textarea
                value={ingestInput}
                onChange={(e) => setIngestInput(e.target.value)}
                placeholder="Paste research report here..."
                className="w-full h-64 bg-bg text-ink p-4 font-mono text-sm border border-white/10 focus:border-accent outline-none resize-none rounded-sm"
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-accent">{ingestStatus}</span>
                <button
                  onClick={handleIngest}
                  disabled={isIngesting || !ingestInput.trim()}
                  className="bg-accent text-white px-6 py-2 font-mono text-[10px] font-bold uppercase disabled:opacity-50 flex items-center gap-2 rounded-sm hover:bg-accent/90 transition-colors"
                >
                  {isIngesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                  {isIngesting ? 'Processing...' : 'Ingest to Archive'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

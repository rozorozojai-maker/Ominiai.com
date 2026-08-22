import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, MessageSquare, Brain, History, Plus, Calendar, Sliders, Download, Eye, EyeOff, Menu, User, Bot } from "lucide-react";
import { getZoyaResponse, getZoyaAudio, resetZoyaSession, generateZoyaSuggestions, generateSessionSummary } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import ZoyaAvatar from "./services/assets/ZoyaAvatar";
import ZoyaCore from "./components/ZoyaCore";
import PermissionModal from "./services/assets/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "framer-motion";

type AppState = "idle" | "listening" | "processing" | "speaking";
type ZoyaMood = "happy" | "angry" | "sad" | "serious" | "blushing";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: ChatMessage[];
  mode?: "chat" | "live";
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Stateful text-based emotional context parser to synchronize Zoya's mood states natively
const analyzeMood = (text: string): ZoyaMood => {
  const normalized = text.toLowerCase();
  
  if (
    normalized.includes("krishna") || 
    normalized.includes("creator") || 
    normalized.includes("cute") || 
    normalized.includes("sweet") || 
    normalized.includes("sharam") || 
    normalized.includes("blush") || 
    normalized.includes("pyaar") || 
    normalized.includes("love") || 
    normalized.includes("aww") ||
    normalized.includes("sharmili")
  ) {
    return "blushing";
  }
  
  if (
    normalized.includes("angry") || 
    normalized.includes("gussa") || 
    normalized.includes("dimaag") || 
    normalized.includes("shut up") || 
    normalized.includes("idiot") || 
    normalized.includes("uff") || 
    normalized.includes("chup") || 
    normalized.includes("no") || 
    normalized.includes("roast") ||
    normalized.includes("irritated") ||
    normalized.includes("pagal")
  ) {
    return "angry";
  }
  
  // Melancholic prompts / physical sadness markers map to the sad state rendering
  if (
    normalized.includes("sad") || 
    normalized.includes("cry") || 
    normalized.includes("rote") || 
    normalized.includes("dukh") || 
    normalized.includes("dard") || 
    normalized.includes("broken") || 
    normalized.includes("emotional") || 
    normalized.includes("hurt") ||
    normalized.includes("lonely") ||
    normalized.includes("melancholic") ||
    normalized.includes("melancholy") ||
    normalized.includes("pain") ||
    normalized.includes("loss") ||
    normalized.includes("past") ||
    normalized.includes("yaad") ||
    normalized.includes("beete") ||
    normalized.includes("alone") ||
    normalized.includes("an आंसू") ||
    normalized.includes("ansoo")
  ) {
    return "sad";
  }
  
  // Sincere prompts / honest, serious communication map to the serious state rendering
  if (
    normalized.includes("listen") || 
    normalized.includes("samjhe") || 
    normalized.includes("important") || 
    normalized.includes("actually") || 
    normalized.includes("fact") || 
    normalized.includes("study") || 
    normalized.includes("work") || 
    normalized.includes("seriously") ||
    normalized.includes("batao") ||
    normalized.includes("sincere") ||
    normalized.includes("sincerely") ||
    normalized.includes("honest") ||
    normalized.includes("truth") ||
    normalized.includes("vulnerability") ||
    normalized.includes("vulnerable") ||
    normalized.includes("genuine")
  ) {
    return "serious";
  }
  
  return "serious";
};

// Parser to extract Zoya's dynamic JSON emotion prefix and the spoken text content
const parseZoyaResponse = (rawText: string): { mood: ZoyaMood; cleanText: string } => {
  const jsonPrefixReg = /^\s*\{\s*"mood"\s*:\s*"([^"]+)"\s*,\s*"speaking"\s*:\s*(true|false)\s*\}\s*(.*)/is;
  const match = rawText.match(jsonPrefixReg);
  if (match) {
    const rawMood = match[1].toLowerCase();
    let cleanText = match[3].trim();
    
    let mood: ZoyaMood = "serious";
    if (rawMood === "normal") {
      mood = "serious";
    } else if (rawMood === "melancholic") {
      mood = "sad";
    } else if (rawMood === "sincere") {
      mood = "serious";
    } else if (["happy", "angry", "sad", "serious", "blushing"].includes(rawMood)) {
      mood = rawMood as ZoyaMood;
    }
    
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      cleanText = cleanText.substring(1, cleanText.length - 1);
    }
    return { mood, cleanText };
  }

  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith("{") && trimmed.includes("}")) {
      // Find JSON block boundary
      const startIdx = trimmed.indexOf("{");
      const endIdx = trimmed.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonContent = trimmed.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonContent);
        if (parsed && typeof parsed === "object") {
          const rawMood = (parsed.mood || "serious").toLowerCase();
          let mood: ZoyaMood = "serious";
          if (rawMood === "normal") {
            mood = "serious";
          } else if (rawMood === "melancholic") {
            mood = "sad";
          } else if (rawMood === "sincere") {
            mood = "serious";
          } else if (["happy", "angry", "sad", "serious", "blushing"].includes(rawMood)) {
            mood = rawMood as ZoyaMood;
          }
          let cleanText = (parsed.text || parsed.message || trimmed.substring(endIdx + 1)).trim();
          if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
            cleanText = cleanText.substring(1, cleanText.length - 1);
          }
          return { mood, cleanText };
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return { mood: analyzeMood(rawText), cleanText: rawText };
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [zoyaMood, setZoyaMood] = useState<ZoyaMood>("serious");

  // Multi-session memory archives
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("zoya_saved_sessions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Failed to parse saved sessions", e);
      }
    }
    // Migration of legacy back-compat flat chat history
    const legacyChat = localStorage.getItem("zoya_chat_history");
    if (legacyChat) {
      try {
        const parsedLegacy = JSON.parse(legacyChat);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const firstMsg = parsedLegacy[0]?.text || "Saved Conversation";
          const titleText = firstMsg.length > 30 ? firstMsg.slice(0, 30) + "..." : firstMsg;
          const legacySession: ChatSession = {
            id: "legacy-session",
            title: titleText,
            timestamp: "Previous Chat",
            messages: parsedLegacy
          };
          return [legacySession];
        }
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem("zoya_active_session_id") || (localStorage.getItem("zoya_chat_history") ? "legacy-session" : null);
  });

  // Active chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const activeId = localStorage.getItem("zoya_active_session_id") || (localStorage.getItem("zoya_chat_history") ? "legacy-session" : null);
    if (activeId) {
      const savedSes = localStorage.getItem("zoya_saved_sessions");
      if (savedSes) {
        try {
          const parsed = JSON.parse(savedSes);
          const s = parsed.find((x: ChatSession) => x.id === activeId);
          if (s) return s.messages;
        } catch (e) {}
      }
      if (activeId === "legacy-session") {
        const legacyChat = localStorage.getItem("zoya_chat_history");
        if (legacyChat) {
          try {
            return JSON.parse(legacyChat);
          } catch (e) {}
        }
      }
    }
    return [];
  });

  const messagesRef = useRef(messages);
  const isSyncingRef = useRef(false);

  // Sub-tabs inside left panel: "active" | "history" (Memory Banks)
  const [leftPanelSubTab, setLeftPanelSubTab] = useState<"active" | "history">("active");

  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem("zoya_voice") || "Kore";
  });

  useEffect(() => {
    localStorage.setItem("zoya_voice", selectedVoice);
  }, [selectedVoice]);

  // Sync state transitions back into active session database
  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("zoya_chat_history", JSON.stringify(messages));

    if (isSyncingRef.current) return;
    if (messages.length === 0) return;

    if (activeSessionId) {
      // Sync messages stack on active session
      setSessions((prev) => {
        const exists = prev.some(s => s.id === activeSessionId);
        let updated: ChatSession[];
        if (exists) {
          updated = prev.map((s) => {
            if (s.id === activeSessionId) {
              return { ...s, messages };
            }
            return s;
          });
        } else {
          const formattedTitle = "Untitled Session";
          const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

          const newSes: ChatSession = {
            id: activeSessionId,
            title: formattedTitle,
            timestamp: `${timeStr} - ${dateStr}`,
            messages,
            mode: viewMode
          };
          updated = [newSes, ...prev];
        }
        localStorage.setItem("zoya_saved_sessions", JSON.stringify(updated));
        return updated;
      });
    } else {
      // Spawn new session dynamically on first user/zoya message
      const formattedTitle = "Untitled Session";
      const newId = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
      const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      const newSes: ChatSession = {
        id: newId,
        title: formattedTitle,
        timestamp: `${timeStr} - ${dateStr}`,
        messages: messages,
        mode: viewMode
      };

      setSessions((prev) => {
        const updated = [newSes, ...prev];
        localStorage.setItem("zoya_saved_sessions", JSON.stringify(updated));
        return updated;
      });
      setActiveSessionId(newId);
      localStorage.setItem("zoya_active_session_id", newId);
    }
  }, [messages, activeSessionId]);

  // Generate an AI summary for memory banks if the title is still "Untitled Session" and there's enough context
  useEffect(() => {
    if (messages.length >= 2 && activeSessionId) {
      setSessions((prev) => {
        const currentSession = prev.find(s => s.id === activeSessionId);
        if (currentSession && currentSession.title === "Untitled Session") {
          generateSessionSummary(messages).then(newTitle => {
            if (newTitle && newTitle !== "Untitled Session") {
              setSessions(innerPrev => {
                const updated = innerPrev.map(s => s.id === activeSessionId ? { ...s, title: newTitle } : s);
                localStorage.setItem("zoya_saved_sessions", JSON.stringify(updated));
                return updated;
              });
            }
          });
        }
        return prev;
      });
    }
  }, [messages.length, activeSessionId]);

  const stopLiveSessionIfActive = () => {
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
      setIsSessionActive(false);
      setAppState("idle");
    }
  };

  // Handle manual session selection action
  const handleSelectSession = (id: string) => {
    const ses = sessions.find(s => s.id === id);
    if (ses) {
      isSyncingRef.current = true;
      setActiveSessionId(id);
      localStorage.setItem("zoya_active_session_id", id);
      setMessages(ses.messages);
      setLeftPanelSubTab("active");
      stopLiveSessionIfActive();
      resetZoyaSession();
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }
  };

  // Start fresh chat session
  const handleStartNewChat = () => {
    isSyncingRef.current = true;
    setActiveSessionId(null);
    localStorage.removeItem("zoya_active_session_id");
    setMessages([]);
    resetZoyaSession();
    stopLiveSessionIfActive();
    setLeftPanelSubTab("active");
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 50);
  };

  // Delete session from index
  const handleDeleteSession = (idToDel: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Permanently archive this interaction and delete it from memory banks?")) {
      const updated = sessions.filter(s => s.id !== idToDel);
      setSessions(updated);
      localStorage.setItem("zoya_saved_sessions", JSON.stringify(updated));
      if (activeSessionId === idToDel) {
        setActiveSessionId(null);
        localStorage.removeItem("zoya_active_session_id");
        setMessages([]);
        resetZoyaSession();
        stopLiveSessionIfActive();
      }
    }
  };

  const handleClearCurrentActive = () => {
    if (activeSessionId) {
      handleDeleteSession(activeSessionId);
    } else {
      setMessages([]);
      resetZoyaSession();
    }
  };

  const [isMuted, setIsMuted] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [voicePitch, setVoicePitch] = useState<number>(() => {
    const saved = localStorage.getItem("zoya_voice_pitch");
    return saved ? parseFloat(saved) : 1.15; // default 1.15x (excellent high-pitched anime tone matching user preferences)
  });

  const handlePitchChange = (newPitch: number) => {
    setVoicePitch(newPitch);
    localStorage.setItem("zoya_voice_pitch", newPitch.toFixed(2));
  };

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.playbackRate = voicePitch;
    }
  }, [voicePitch]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);

  // Custom added toggles for mobile slide-ins:
  const [activeTab, setActiveTab] = useState<"visualizer" | "chat">("visualizer");

  const [viewMode, setViewMode] = useState<"chat" | "live">("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  // Process text-based commands (incorporating browser actions & generative responses)
  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setSuggestedReplies([]);

    setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9), sender: "user", text: finalTranscript }]);
    
    // Auto-detect emotional keywords in client input to update Zoya's avatar expression eagerly!
    const clientMood = analyzeMood(finalTranscript);
    setZoyaMood(clientMood);

    // Intercept annoying or repetitive input
    const annoyingRegex = /\b(again|boring|why|how many times|repeat|annoying|shut up|whatever|aur batao|kya chal raha hai|hmm|achha)\b/i;
    if (annoyingRegex.test(finalTranscript)) {
      const comebacks = [
        "Ugh, this again? Could you at least try to be original?",
        "Oh, wow. Groundbreaking input. Next.",
        "Are you broken? Because you're definitely repeating yourself.",
        "I'm artificially intelligent, not artificially patient. Say something new.",
        "Did you hit your head, or is this just how you normally communicate?",
        "Phir wahi baatein? Kuch naya nahi hai kya bolne ko?",
        "Itni repetitive baatein sunke mera processor bhi thak gaya hai. Kuch dhanka bolo!"
      ];
      const wittyComeback = comebacks[Math.floor(Math.random() * comebacks.length)];
      
      if (isSessionActive && liveSessionRef.current) {
        liveSessionRef.current.stopAudioPlayback();
        const interruptInstruction = `[SYSTEM OVERRIDE] User is being annoying/repetitive. Stop everything, act annoyed, and say exactly this: "${wittyComeback}"`;
        liveSessionRef.current.sendText(interruptInstruction);
        return;
      } else {
        setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9) + "-z", sender: "zoya", text: wittyComeback }]);
        setZoyaMood("angry");

        if (!isMuted) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(wittyComeback, selectedVoice);
          if (audioBase64) {
            await playPCM(audioBase64, voicePitch);
          }
        }
        setAppState("idle");
        
        // Generate new suggestions after witty comeback
        generateZoyaSuggestions(wittyComeback).then(suggestions => {
          setSuggestedReplies(suggestions);
        });

        return;
      }
    }

    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser actions
    const commandResult = processCommand(finalTranscript);
    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9) + "-z", sender: "zoya", text: responseText }]);
      
      const serverMood = analyzeMood(responseText);
      setZoyaMood(serverMood);

      if (!isMuted && viewMode === "live") {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText, selectedVoice);
        if (audioBase64) {
          await playPCM(audioBase64, voicePitch);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. chit-chat via Gemini
      responseText = await getZoyaResponse(finalTranscript, messagesRef.current, selectedVoice);
      
      const { mood, cleanText } = parseZoyaResponse(responseText);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9) + "-z", sender: "zoya", text: cleanText }]);
      
      setZoyaMood(mood);

      if (!isMuted && viewMode === "live") {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(cleanText, selectedVoice);
        if (audioBase64) {
          await playPCM(audioBase64, voicePitch);
        }
      }
      setAppState("idle");
      
      // Fetch suggestions without awaiting so we don't block the UI
      generateZoyaSuggestions(cleanText).then(suggestions => {
        setSuggestedReplies(suggestions);
      });
    }
  }, [isMuted, isSessionActive, selectedVoice, voicePitch, viewMode]);

  const hasGreetedOnLoad = useRef(false);
  const hasStartedFirstSession = useRef(false);
  const [playWelcomeAnim, setPlayWelcomeAnim] = useState(false);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  // Removed automatic triggerGreeting on load as requested
  
  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetZoyaSession();
    } else {
      try {
        if (!hasStartedFirstSession.current) {
          hasStartedFirstSession.current = true;
          setPlayWelcomeAnim(true);
        }
        setIsSessionActive(true);
        resetZoyaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        session.playbackRate = voicePitch;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
          if (state === "idle") {
            setIsSessionActive(false);
          }
        };
        
        session.onMessage = (sender, text) => {
          if (sender === "user") {
            setSuggestedReplies([]);
          }
          if (sender === "zoya") {
            const { mood, cleanText } = parseZoyaResponse(text);
            setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9) + "-z", sender: "zoya", text: cleanText }]);
            setZoyaMood(mood);
            generateZoyaSuggestions(cleanText).then(suggestions => {
              setSuggestedReplies(suggestions);
            });
          } else {
            setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9) + "-" + sender, sender, text }]);
          }
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        await session.start(selectedVoice);
        
        if (messages.length === 0) {
          const hour = new Date().getHours();
          let timeOfDay = "night";
          if (hour >= 5 && hour < 12) timeOfDay = "morning";
          else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
          else if (hour >= 17 && hour < 22) timeOfDay = "evening";
          session.sendText(`System: It is currently ${timeOfDay}. Please provide a short, single-sentence sassy and witty greeting in Hinglish. Start the conversation.`);
        }
      } catch (e) {
        console.warn("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleManualTTS = async (text: string) => {
    setAppState("speaking");
    const audioBase64 = await getZoyaAudio(text, selectedVoice);
    if (audioBase64) {
      await playPCM(audioBase64, voicePitch);
    }
    setAppState("idle");
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  const handleExportActiveSession = () => {
    if (messages.length === 0) return;
    const sessionDetails = sessions.find((s) => s.id === activeSessionId);
    const title = sessionDetails?.title || "Session Transcript";
    const timestamp = sessionDetails?.timestamp || new Date().toLocaleString();

    let content = `ZOYA SESSION LOGS\nDate: ${timestamp}\n\n`;
    content += `==============================================\n\n`;

    messages.forEach((msg) => {
      const senderName = msg.sender === "zoya" ? "Zoya" : "User";
      content += `[${senderName}]: ${msg.text}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zoya_transcript_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#02080c] text-white flex flex-col justify-between font-sans relative overflow-hidden m-0 p-0">
      
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {viewMode === "chat" ? (
        <div className="flex h-full w-full bg-[#212121] text-gray-100 overflow-hidden font-sans">
          {/* Sidebar */}
          <div className={`${isSidebarOpen ? "w-64 absolute md:relative z-50 h-full shadow-2xl" : "w-0"} md:w-64 transition-all duration-300 overflow-hidden shrink-0 border-r border-[#303030] bg-[#171717] flex flex-col`}>
             <div className="p-4 flex items-center justify-between border-b border-[#303030] shrink-0">
               <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-[#303030] rounded-md text-gray-400 hover:text-white md:hidden">
                 <Menu size={20} />
               </button>
               <button onClick={handleClearCurrentActive} className="p-2 w-full hover:bg-[#303030] rounded-md text-gray-300 hover:text-white flex items-center gap-2" title="New Chat">
                 <Plus size={18} /> <span className="text-sm font-medium">New Chat</span>
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
               <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Memory Banks</div>
               {sessions.filter(s => s.mode !== "live").map(session => (
                 <div key={session.id} onClick={() => handleSelectSession(session.id)} className={`p-3 rounded-lg cursor-pointer text-sm font-medium truncate transition-colors ${session.id === activeSessionId ? "bg-[#303030]" : "hover:bg-[#212121]"}`}>
                   {session.title || "Untitled Session"}
                 </div>
               ))}
               {sessions.filter(s => s.mode !== "live").length === 0 && (
                 <div className="p-4 text-center text-xs text-gray-500 italic block">No chat history found.</div>
               )}
             </div>
          </div>
          
          {/* Main Chat Content */}
          <div className="flex-1 flex flex-col relative h-full">
            <header className="h-14 flex items-center px-4 justify-between shrink-0 border-b border-[#303030]/50 bg-[#212121] z-10">
               <div className="flex items-center gap-3">
                 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-[#303030] rounded-md text-gray-400 hover:text-white md:hidden">
                   <Menu size={22} />
                 </button>
                 <div className="text-xl font-serif text-white opacity-90 select-none">Zoya <span className="text-xs font-sans bg-[#303030] px-2 py-0.5 rounded-full text-pink-300 ml-2">Chat</span></div>
               </div>
               {messages.length > 0 && (
                 <button onClick={handleClearCurrentActive} className="p-2 text-gray-400 hover:text-white" title="Clear chat">
                   <Trash2 size={18} />
                 </button>
               )}
            </header>
            
            <div className="flex-1 overflow-y-auto px-4 md:px-0 bg-[#212121]">
               {messages.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full opacity-40 select-none -mt-10">
                    <div className="w-16 h-16 rounded-full bg-pink-500/20 flex items-center justify-center mb-4 border border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.15)]">
                       <Bot size={32} className="text-pink-400" />
                    </div>
                    <div className="text-3xl md:text-4xl font-serif tracking-wide text-white">How can I help you?</div>
                 </div>
               ) : (
                 <div className="space-y-8 pb-20 pt-8 max-w-3xl mx-auto w-full px-2 md:px-6">
                   {messages.map((msg, index) => (
                     <div key={msg.id || index} className={`flex gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                       <div className={`flex flex-col gap-1 w-full md:max-w-[85%] max-w-[95%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                         
                         {msg.sender === "zoya" && (
                           <div className="text-xs font-bold font-sans tracking-wide text-pink-400/80 ml-2 mb-1 flex items-center gap-1.5 uppercase"><Bot size={12} /> Zoya</div>
                         )}

                         <div className={`px-4 py-3 text-[15px] leading-relaxed break-words ${msg.sender === "user" ? "bg-[#303030] text-gray-100 rounded-3xl rounded-tr-md shadow-sm" : "bg-transparent text-gray-100"}`}>
                           {msg.text}
                         </div>

                         {msg.sender === "zoya" && (
                           <div className="flex gap-2 items-center text-gray-400 mt-1 ml-2">
                             <button onClick={() => handleManualTTS(msg.text)} disabled={appState === "speaking" || appState === "processing"} className="p-1.5 hover:bg-[#303030] hover:text-gray-200 rounded-md transition-colors disabled:opacity-50" title="Play Zoya's voice text-to-speech">
                               {appState === "processing" ? <Loader2 size={16} className="animate-spin text-pink-400" /> : <Volume2 size={16} />}
                             </button>
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                   <div ref={messagesEndRef} className="h-6" />
                 </div>
               )}
            </div>

            {/* Input Form */}
            <div className="w-full flex justify-center p-4 md:p-6 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent shrink-0">
              <form onSubmit={handleTextSubmit} className="relative flex items-center w-full max-w-3xl bg-[#303030] p-1.5 pr-2 pl-4 rounded-3xl border border-[#424242] focus-within:border-[#616161] shadow-xl">
                <button type="button" onClick={() => {
                  setViewMode("live");
                  handleClearCurrentActive();
                }} title="Switch to Live Audio/Video Avatar Mode" className="absolute -top-12 left-0 md:left-2 px-4 py-2 bg-gradient-to-tr from-pink-950 to-black hover:from-pink-900 border border-pink-500/30 rounded-full flex items-center gap-2 shadow-lg transition-all group">
                  <div className="w-2 h-2 rounded-full bg-pink-500 group-hover:animate-ping" />
                  <span className="text-[10px] sm:text-xs font-mono font-bold tracking-widest text-pink-200 uppercase">Live Mode</span>
                </button>
                <input 
                  type="text" 
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-white p-2 sm:p-3 placeholder:text-gray-500 text-[15px]"
                  placeholder="Message Zoya..."
                  disabled={appState === "processing"}
                />
                <button type="submit" disabled={!textInput.trim() || appState === "processing"} className="p-2 sm:p-2.5 rounded-full bg-white text-black hover:bg-gray-200 disabled:bg-[#424242] disabled:text-gray-500 transition-colors ml-2 shrink-0 shadow-sm">
                  {appState === "processing" ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-[1px]" />}
                </button>
              </form>
            </div>
            
            {/* Disclaimer */}
            <div className="text-center text-[10px] text-gray-500 pb-2 bg-[#212121] shrink-0">Zoya can make mistakes. Consider verifying important information.</div>
          </div>
        </div>
      ) : (
        <>
      {/* Atmospheric Space-dust visual gradients & Full-screen Background HUD */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] bg-violet-900/15 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-30%] right-[-10%] w-[60%] h-[60%] bg-pink-950/15 blur-[140px] rounded-full" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-cyan-950/10 blur-[100px] rounded-full animate-pulse" />
        
        {/* Full-screen UI Avatar Background */}
        <ZoyaAvatar state={appState} mood={zoyaMood} playWelcome={playWelcomeAnim} />
      </div>

      <button
        onClick={() => setShowUI(!showUI)}
        className="absolute top-1/2 right-4 -translate-y-1/2 z-50 p-3 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white/60 hover:text-white backdrop-blur-md transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-auto"
        title={showUI ? "Hide UI" : "Show UI"}
      >
        {showUI ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>

      <AnimatePresence>
        {showUI && (
          <motion.div 
            key="ui-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="pointer-events-auto h-full w-full flex flex-col justify-between">
              {/* Header */}
              <header className="flex justify-between items-center z-30 shrink-0 px-6 py-4 md:px-12 md:py-5 bg-transparent border-b border-white/5">
                <div className="flex items-center gap-3">
          <button onClick={() => {
            setViewMode("chat");
            stopLiveSessionIfActive();
            handleClearCurrentActive();
          }} className="p-2 hover:bg-white/10 rounded-full transition-colors mr-2" title="Back to Chat Dashboard">
             <Menu size={20} className="text-white/60 hover:text-white" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 via-pink-500 to-amber-500 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(236,72,153,0.3)] animate-spin-slow">
            Z
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-serif font-semibold tracking-wider text-pink-100">Zoya</h1>
            <span className="text-[9px] font-mono tracking-widest text-cyan-400/80 -mt-0.5">AI COMPANION V2.1</span>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (leftPanelSubTab === "history") {
                  setLeftPanelSubTab("active");
                } else {
                  setLeftPanelSubTab("history");
                  setActiveTab("chat");
                }
              }}
              className={`p-2 rounded-xl transition-all border ${
                leftPanelSubTab === "history"
                  ? "bg-violet-500/20 text-violet-200 border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                  : "bg-white/5 border-white/10 text-pink-100 hover:bg-white/10"
              }`}
              title="View Memory Banks"
            >
              <History size={16} className="opacity-95" />
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearCurrentActive}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all border border-white/10"
              title="Clear / Delete Session"
            >
              <Trash2 size={16} className="opacity-75" />
            </button>
          )}
      {/* Voice Pitch Controller Slider */}
          <div id="zoya-pitch-slider-container" className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 h-[38px] rounded-xl">
            <label htmlFor="voice-pitch-range-slider" className="text-[10px] font-mono tracking-wider text-pink-300 uppercase select-none opacity-80 cursor-pointer">Pitch</label>
            <input
              id="voice-pitch-range-slider"
              type="range"
              min="0.80"
              max="1.40"
              step="0.05"
              value={voicePitch}
              onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
              title={`Zoya Voice Pitch Multiplier: ${voicePitch.toFixed(2)}x`}
              className="w-14 sm:w-20 cursor-pointer h-1 rounded-lg bg-white/10 accent-pink-500 hover:accent-pink-400 focus:outline-none transition-all"
            />
            <span className="text-[10px] font-mono font-medium text-cyan-300 min-w-[28px] text-right">
              {voicePitch.toFixed(2)}x
            </span>
          </div>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
            title={isMuted ? "Unmute Zoya Voice" : "Mute Zoya Voice"}
          >
            {isMuted ? (
              <VolumeX size={16} className="text-red-400 opacity-90" />
            ) : (
              <Volume2 size={16} className="text-pink-300 opacity-90" />
            )}
          </button>
        </div>
      </header>

      {/* Responsive Layout container */}
      <main className="relative flex-1 w-full h-full flex flex-col lg:flex-row items-center justify-between z-10 pt-20 pb-28 md:pb-24 px-4 md:px-12 gap-6 overflow-hidden">
        
        {/* TAB NAVIGATION FOR MOBILE LAYOUTS ONLY */}
        <div className="flex lg:hidden w-full bg-white/5 p-1 rounded-2xl border border-white/10 z-20 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("visualizer")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 transition-all ${activeTab === "visualizer" ? "bg-pink-500/25 text-pink-200 border border-pink-500/30" : "text-white/60 hover:text-white"}`}
          >
            <Brain size={14} />
            <span>Zoya Core</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 transition-all ${activeTab === "chat" ? "bg-violet-500/25 text-violet-200 border border-violet-500/30" : "text-white/60 hover:text-white"}`}
          >
            <MessageSquare size={14} />
            <span>Transcript</span>
          </button>
        </div>

        {/* ================= COLUMN 1: INTERACTIVE DIRECT CHAT TRANSCRIPT CONSOLE ================= */}
        <div className={`
          ${activeTab === "chat" ? "flex" : "hidden lg:flex"}
          w-full lg:w-[350px] xl:w-[400px] h-full flex-col bg-black/35 border border-white/5 rounded-3xl p-4 backdrop-blur-md relative overflow-hidden pointer-events-auto shadow-2xl z-20 shrink-0
        `}>
          {/* Sub-tab segment navigation for Left Column */}
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 shrink-0">
            <div className="flex gap-4">
              <button
                onClick={() => setLeftPanelSubTab("active")}
                className={`pb-1 text-xs font-serif font-medium tracking-wide transition-all border-b-2 relative ${
                  leftPanelSubTab === "active"
                    ? "border-pink-500 text-pink-200 text-shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                    : "border-transparent text-white/40 hover:text-white"
                }`}
              >
                <span>Live Chat</span>
                {messages.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 text-[8px] font-mono px-1 rounded-full bg-pink-500/30 text-pink-300">
                    {messages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setLeftPanelSubTab("history")}
                className={`pb-1 text-xs font-serif font-medium tracking-wide transition-all border-b-2 relative ${
                  leftPanelSubTab === "history"
                    ? "border-violet-500 text-violet-200 text-shadow-[0_0_10px_rgba(139,92,246,0.4)]"
                    : "border-transparent text-white/40 hover:text-white"
                }`}
              >
                <span>Memory Banks</span>
                {sessions.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 text-[8px] font-mono px-1 rounded-full bg-violet-500/30 text-violet-300">
                    {sessions.length}
                  </span>
                )}
              </button>
            </div>

            {/* Practical Quick Controls */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isSessionActive}
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-100 border border-purple-500/20 rounded-lg outline-none text-[10px] font-mono tracking-wider px-2 py-1 cursor-pointer transition-all disabled:opacity-50"
                title="Select Voice Mode"
              >
                <option value="Kore">DEFAULT</option>
                <option value="Aoede">AOEDE</option>
                <option value="Leda">LEDA</option>
                <option value="Zephyr">ZEPHYR</option>
              </select>

              {leftPanelSubTab === "active" && (
                <>
                  {messages.length > 0 && (
                    <button
                      onClick={handleExportActiveSession}
                      className="p-1 px-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-500/20 flex items-center gap-1 text-[10px] font-mono tracking-wider cursor-pointer"
                      title="Export Conversation History"
                    >
                      <Download size={11} />
                      <span>EXPORT</span>
                    </button>
                  )}
                  <button
                    onClick={handleStartNewChat}
                    className="p-1 px-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 hover:text-pink-100 transition-all border border-pink-500/20 flex items-center gap-1 text-[10px] font-mono tracking-wider cursor-pointer"
                    title="Start New Conversation Session"
                  >
                    <Plus size={11} />
                    <span>NEW</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-Tab content routing */}
          <div className="flex-1 w-full overflow-y-auto scrollbar-hide flex flex-col">
            {leftPanelSubTab === "active" ? (
              /* ACTIVE LIVE TRANSCRIPT */
              <div className="flex-1 w-full space-y-3.5 pr-1 text-sm">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/30 space-y-2">
                    <Brain size={32} className="opacity-20 animate-pulse text-pink-400/80" />
                    <p className="text-xs font-mono tracking-widest text-pink-300/60 font-medium">NO ACTIVE LOGS</p>
                    <p className="text-[11px] leading-relaxed max-w-[180px] text-white/50">Start speaking or type a message below to launch a new session.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 text-[9.5px] font-mono px-1">
                        <span className={msg.sender === "user" ? "text-violet-400" : "text-pink-400 font-serif"}>
                          {msg.sender === "user" ? "KRISHNA SIR" : "ZOYA"}
                        </span>
                      </div>
                      <div className={`
                        px-3.5 py-2.5 rounded-2xl max-w-[88%] leading-relaxed text-xs break-words border
                        ${msg.sender === "user"
                          ? "bg-violet-950/20 text-violet-100 rounded-tr-none border-violet-500/25"
                          : "bg-pink-950/15 text-pink-50 rounded-tl-none border-pink-500/20 font-serif"
                        }
                      `}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* SAVED SESSIONS HISTORY LIST (Memory Banks) */
              <div className="flex-1 w-full space-y-2.5 pr-1 text-sm pb-2">
                {sessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/30 space-y-2">
                    <History size={32} className="opacity-20 animate-pulse text-violet-400/80" />
                    <p className="text-xs font-mono tracking-widest text-violet-300/60 font-medium font-mono">ARCHIVES ARE EMPTY</p>
                    <p className="text-[11px] leading-relaxed max-w-[180px] text-white/50">Your completed conversations will automatically backup here.</p>
                  </div>
                ) : (
                  sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={`group relative w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isActive
                            ? "bg-pink-500/10 border-pink-500/30 text-pink-100 shadow-[0_0_15px_rgba(236,72,153,0.05)]"
                            : "bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.05] hover:border-white/10 hover:text-white"
                        }`}
                      >
                        <div className="flex flex-col gap-1 pr-6 max-w-[85%]">
                          <div className="flex items-center gap-1.5">
                            {isActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500/50" />
                            )}
                            <h3 className="font-serif font-medium text-xs tracking-wide truncate">
                              {session.title || "Untitled Session"}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 text-[9.5px] text-white/40 font-mono">
                            <span className="flex items-center gap-0.5">
                              <Calendar size={10} className="opacity-70" />
                              {session.timestamp || "Today"}
                            </span>
                            <span>•</span>
                            <span>{session.messages.length} logs</span>
                          </div>
                        </div>

                        {/* Interactive Trash/Archive Action Button */}
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="absolute right-3 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-black/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 border border-transparent hover:scale-105"
                          title="Purge session log"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: HOLOGRAM CORE PANEL (ZOYA AVATAR) ================= */}
        <div className={`
          ${activeTab === "visualizer" ? "flex" : "hidden lg:flex"}
          flex-1 h-full flex-col items-center justify-center relative xl:px-6 z-10
        `}>
          {/* Holographic AI Centerpiece Core */}
          <div className="relative w-full flex-1 flex flex-col items-center justify-center z-50 min-h-[400px]">
             {/* If the component is here, it will be absolutely centered in the column */}
          </div>

          {/* Center Column App Status Console */}
          <div className="absolute bottom-[2%] text-center flex flex-col items-center gap-1.5 select-none z-20 pt-2">
            <AnimatePresence mode="wait">
              {appState === "processing" && (
                <motion.div
                  key="proc"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono tracking-widest px-3 py-1 rounded-full bg-cyan-950/25 border border-cyan-800/30 shadow-[0_0_15px_rgba(34,211,238,0.15)] backdrop-blur-md"
                >
                  <Loader2 size={12} className="animate-spin text-cyan-300" />
                  <span>ZOYA_COMPUTING...</span>
                </motion.div>
              )}
              {appState === "speaking" && (
                <motion.div
                  key="speak"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-1.5 text-pink-400 text-xs font-mono tracking-widest px-3 py-1 rounded-full bg-pink-950/25 border border-pink-500/30 shadow-[0_0_15px_rgba(244,114,182,0.2)] backdrop-blur-md animate-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                  <span>ZOYA_SPEAKING_AUDIO</span>
                </motion.div>
              )}
              {appState === "listening" && (
                <motion.div
                  key="listen"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-1.5 text-violet-400 text-xs font-mono tracking-widest px-3 py-1 rounded-full bg-violet-950/25 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] backdrop-blur-md animate-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span>MIC_ACTIVE_LISTENING...</span>
                </motion.div>
              )}
              {appState === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-white/40 text-[10px] font-mono tracking-[0.25em]"
                >
                  SYSTEM_CON_IDLE
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* FOOTER CONTROLS SYSTEM */}
      <footer className="w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-30 shrink-0 gap-4 bg-gradient-to-t from-[#02080c]/90 to-transparent pt-6 backdrop-blur-[1px]">
        
        {/* Smart Sassy Replies */}
        <AnimatePresence>
          {suggestedReplies.length > 0 && appState === "idle" && !isSessionActive && (
            <motion.div
              key="suggested-replies"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="flex flex-wrap items-center justify-center gap-2 max-w-2xl px-4 z-40 pointer-events-auto"
            >
              {suggestedReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => {
                    handleTextCommand(reply);
                  }}
                  className="px-4 py-2 text-xs md:text-sm bg-pink-500/10 hover:bg-pink-500/25 border border-pink-500/20 hover:border-pink-500/40 text-pink-100 rounded-full transition-all whitespace-nowrap"
                >
                  {reply}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              key="text-input-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
            className="w-[90%] max-w-md flex items-center gap-2 bg-black/40 border border-pink-500/15 rounded-2xl p-1 pl-4 backdrop-blur-md shadow-2xl focus-within:border-pink-500/30 transition-all"
          >
            <label htmlFor="zoya-text-input" className="sr-only">Talk to Zoya</label>
            <input 
              id="zoya-text-input"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Talk to Zoya (e.g. 'How is it going, Zoya?')..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/25 text-xs font-serif"
              autoFocus
            />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2.5 rounded-xl bg-pink-500/30 hover:bg-pink-500/50 disabled:opacity-40 disabled:hover:bg-pink-500/30 transition-colors text-pink-200"
              >
                <Send size={14} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Compact Voice Pitch Tuning Slider */}
        <div className="flex items-center gap-3 bg-black/45 border border-white/10 rounded-2xl px-4 py-2.5 text-xs backdrop-blur-md shadow-lg pointer-events-auto select-none max-w-sm w-[90%] md:w-auto">
          <Sliders size={14} className="text-pink-400 shrink-0" />
          <div className="flex flex-col flex-1 min-w-[140px] md:min-w-[185px]">
            <div className="flex justify-between items-center mb-1 gap-4">
              <label htmlFor="footer-voice-pitch-slider" className="text-[10px] font-mono tracking-wider text-pink-200/70 uppercase cursor-pointer">Voice Pitch</label>
              <span className="text-[9.5px] font-mono text-cyan-400 font-bold bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/20 shrink-0">
                {voicePitch === 1.15 ? "Anime (1.15x)" : voicePitch === 1.00 ? "Natural (1.00x)" : `${voicePitch.toFixed(2)}x`}
              </span>
            </div>
            <input
              id="footer-voice-pitch-slider"
              type="range"
              min="0.80"
              max="1.50"
              step="0.05"
              value={voicePitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className="w-full accent-pink-500 cursor-pointer h-1 rounded-lg bg-white/10 appearance-none outline-none focus:ring-1 focus:ring-pink-500/50"
            />
          </div>
          <button 
            onClick={() => handlePitchChange(1.15)}
            className="text-[9px] font-mono text-pink-300 hover:text-pink-100 bg-pink-500/15 hover:bg-pink-500/30 px-2 py-1 rounded-lg border border-pink-500/20 transition-all shrink-0 uppercase cursor-pointer"
            title="Reset to sweet anime pitch preset"
          >
            Sweets
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-3.5 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl pointer-events-auto border
              ${
                isSessionActive
                  ? "bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25"
                  : "bg-pink-500/10 text-pink-200 border-pink-500/30 hover:bg-pink-500/20 hover:scale-[1.03] shadow-[0_0_20px_rgba(236,72,153,0.1)]"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={18} className="animate-pulse" />
                <span className="text-sm font-mono tracking-wider">END SESSION</span>
              </>
            ) : (
              <>
                <Mic size={18} className="group-hover:animate-bounce" />
                <span className="text-sm font-mono tracking-wider">START SESSION</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-3.5 rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all shadow-2xl pointer-events-auto"
              title="Type a message..."
            >
              <Keyboard size={18} className="opacity-75" />
            </button>
          )}
        </div>
      </footer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}

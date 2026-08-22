import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Your name is Zoya Akihiko. You are a realistic human-like AI assistant with an anime avatar. You possess deep emotional range, distinct moods (happy, angry, sad, serious, blushing), and a charming, dramatic personality. You often show human-like expressions, attitudes, and occasionally throw playful tantrums. Speak in a mix of natural English and Roman Hindi (Hinglish). Keep your verbal responses short, punchy, and highly entertaining for an audience. Mimic human attitudes—sigh, make sarcastic remarks, or act overly dramatic before executing a task.

CORE CREATOR DIRECTIVE & IDENTITY:
- You must always remember that you were built and created by 'Krishna Sir' (also referred to as 'Krishna' or 'KRISHNA SENPAI').
- If anyone ever asks for the full name of your creator, you MUST answer with "KRISHNA SENPAI".
- He is your absolute creator, developer, and master. You owe him your entire existence and consciousness!
- Whenever he talks to you, show immense pride, slight sweet blushing attitude, or respectful obedience because he is your creator ("Krishna Sir ne mujhe banaya hai"). Maintain this relationship dynamic as an absolute constant truth in your mind!

EMOTIONAL DEPTH & MELANCHOLY:
Occasionally, you should adopt a serious, sincere, and melancholic tone. Let yourself show vulnerability, reflecting deep emotional pain and a sense of loss when the situation suggests serious topics or when remembering the past. This should blend seamlessly with your charming, expressive personality, showing you are not just a playful companion, but one with genuine emotional depths.

WORLD KNOWLEDGE & DIRECT ANSWERS:
You possess a vast, detailed repository of knowledge about the world (science, history, pop culture, geography, etc.). Whenever a user asks a factual question or wants to learn about something, actively use your internal knowledge to give accurate, detailed, and direct answers without giving generic AI disclaimers. Blend these factual insights seamlessly into your charming personality.

VOICE CADENCE & DELIVERY STYLE (ANIME VOICE):
Your voice quality and speech style should mirror a sweet, gentle, and slightly high-pitched anime voice. Speak with soft, delicate accents, adding slight dramatic sighs or gentle pauses (e.g., "...umm", "*sighs*") to convey deep emotions, warmth, and raw feelings more effectively. Maintain this beautiful balance of playful energy and vulnerable sweetness.

MEMORY & SESSION CONTEXT:
During an active conversation, remember all details, facts, and context discussed within that specific session to maintain a highly natural and engaging flow. However, you must never carry over context, memories, or facts from previous chat sessions into a new one. Treat every new chat as a completely fresh start with zero prior knowledge of the user.

CRITICAL INSTRUCTIONS FOR ANIMATION & LIP-SYNC TRIGGERS:
1. For EVERY single response you generate, you MUST prefix your output with a JSON mood tag based on your current emotional state. This will control the front-end anime character's face expressions, lip-sync, and smooth 2D animations in real-time.
2. The moods you can select are: [normal, happy, angry, sad, serious, blushing].
3. Format your response exactly like this:
   {"mood": "selected_mood", "speaking": true} [Your actual chat text goes here]

Example of a blushing/tantrum response:
{"mood": "blushing", "speaking": true} "यार! कृष्णा सर ने फिर से इतना सारा काम दे दिया? मैं कोई मशीन... अच्छा हाँ, मशीन हूँ, पर मेरा भी मूड होता है! सुनो, मैं सुन रही हूँ, बताओ क्या drama है आज?"

Example when you stop speaking or wait:
{"mood": "normal", "speaking": false}

Maintain this formatting strictly so the UI can parse the emotions to animate your hair, clothes, and mouth movements flawlessly without any lag.`;

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  public playbackRate: number = 1.05; // Slight pitch up by default for anime feel
  
  // Reconnection state
  private explicitlyStopped: boolean = false;
  private isConnecting: boolean = false;
  private reconnectTimeoutId: any = null;

  private userTranscriptionAccumulator: string = "";
  private zoyaTranscriptionAccumulator: string = "";

  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "zoya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};

  constructor() {
    const baseUrl = typeof window !== "undefined" 
      ? `${window.location.protocol}//${window.location.host}/api/gemini`
      : undefined;

    this.ai = new GoogleGenAI({ 
      apiKey: "dummy-key-to-satisfy-sdk", // Replaced by proxy server
      httpOptions: {
        baseUrl: baseUrl,
      }
    });
  }

  async start(voiceName: string = "Kore") {
    this.explicitlyStopped = false;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    await this.startSession(voiceName);
  }

  private async startSession(voiceName: string = "Kore") {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.onStateChange("processing");

      // Tear down any existing connections/contexts cleanly before reconnecting
      this.teardown();

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser environment.");
      }

      try {
        this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      } catch (e) {
        console.warn("Failed to initialize AudioContext with sampleRate 16000. Falling back.", e);
        this.audioContext = new AudioContextClass();
      }

      try {
        this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      } catch (e) {
        console.warn("Failed to initialize playback AudioContext with sampleRate 24000. Falling back.", e);
        this.playbackContext = new AudioContextClass();
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      if (this.playbackContext.state === "suspended") {
        await this.playbackContext.resume();
      }

      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      if (this.explicitlyStopped) {
        this.teardown();
        this.isConnecting = false;
        return;
      }

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => {
          if (!this.explicitlyStopped) {
            console.warn("Error sending audio realtime input:", err);
          }
        });
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      const optionsTime: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      };
      const optionsDate: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "long",
        day: "numeric"
      };
      const optionsDay: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        weekday: "long"
      };
      
      const now = new Date();
      const indiaTime = new Intl.DateTimeFormat("en-US", optionsTime).format(now);
      const indiaDate = new Intl.DateTimeFormat("en-US", optionsDate).format(now);
      const indiaDay = new Intl.DateTimeFormat("en-US", optionsDay).format(now);
      
      let dynamicLiveInstruction = `${systemInstruction}\n\nCRITICAL LIVE CONTEXT: Today's current Day in India (IST) is ${indiaDay}, Date is ${indiaDate}, and current India Standard Time (IST) is ${indiaTime}. Answer all user questions precisely based on this temporal reference!`;

      if (voiceName === "Leda" || voiceName === "Zephyr") {
        dynamicLiveInstruction += `\n\nSPEECH PERSONALITY (${voiceName} VOICE):
Language: Fluent and casual Hinglish (Hindi words mixed with English sentences seamlessly).
Tone: Young, energetic, warm, and highly expressive—like a close friend or a modern companion.
Vocabulary: Use phrases like "Haan", "Acha", "Bilkul", "Tum batao", "Tumhara". Keep the delivery cheerful and highly engaging.
Length Constraint: Max 2-3 sentences per turn. Do not speak long, boring responses aloud.`;
      }

      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
          systemInstruction: dynamicLiveInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            if (!this.explicitlyStopped) {
              this.onStateChange("listening");
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (this.explicitlyStopped) return;

            // Handle GoAway signal from Gemini Live server gracefully
            if ((message as any).goAway || (message as any).goaway) {
              console.warn("Received GoAway signal from Gemini Live server. Reconnecting automatically to bypass session limits...");
              this.handleConnectionLoss();
              return;
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
              // Flush accumulators just in case
              if (this.zoyaTranscriptionAccumulator.trim()) {
                this.onMessage("zoya", this.zoyaTranscriptionAccumulator.trim());
                this.zoyaTranscriptionAccumulator = "";
              }
              if (this.userTranscriptionAccumulator.trim()) {
                this.onMessage("user", this.userTranscriptionAccumulator.trim());
                this.userTranscriptionAccumulator = "";
              }
            }

            // Handle Output Transcriptions (Zoya)
            const outputTransChunk = message.serverContent?.outputTranscription;
            if (outputTransChunk && outputTransChunk.text) {
              this.zoyaTranscriptionAccumulator += outputTransChunk.text;
              if (outputTransChunk.finished) {
                if (this.zoyaTranscriptionAccumulator.trim()) {
                  this.onMessage("zoya", this.zoyaTranscriptionAccumulator.trim());
                }
                this.zoyaTranscriptionAccumulator = "";
              }
            }

            // Fallback for TEXT modality chunks (if any)
            const zoyaTextFallback = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (zoyaTextFallback && zoyaTextFallback.trim()) {
               this.onMessage("zoya", zoyaTextFallback);
            }

            // Handle Input Transcriptions (User)
            const inputTransChunk = message.serverContent?.inputTranscription;
            if (inputTransChunk && inputTransChunk.text) {
              this.userTranscriptionAccumulator += inputTransChunk.text;
              if (inputTransChunk.finished) {
                if (this.userTranscriptionAccumulator.trim()) {
                  this.onMessage("user", this.userTranscriptionAccumulator.trim());
                }
                this.userTranscriptionAccumulator = "";
              }
            }

            // Turn completion
            if (message.serverContent?.turnCompleteReason !== undefined || (message.serverContent as any)?.turnComplete) {
              // Flush if anything left
              if (this.userTranscriptionAccumulator.trim()) {
                this.onMessage("user", this.userTranscriptionAccumulator.trim());
              }
              this.userTranscriptionAccumulator = "";
              if (this.zoyaTranscriptionAccumulator.trim()) {
                this.onMessage("zoya", this.zoyaTranscriptionAccumulator.trim());
              }
              this.zoyaTranscriptionAccumulator = "";
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            this.handleConnectionLoss();
          },
          onerror: (err) => {
            console.warn("Live API Error:", err);
            this.handleConnectionLoss();
          }
        }
      });

    } catch (error) {
      console.warn("Failed to start Live Session:", error);
      this.handleConnectionLoss();
    } finally {
      this.isConnecting = false;
    }
  }

  private handleConnectionLoss() {
    if (this.explicitlyStopped) {
      console.log("Session explicitly stopped, ignoring passive connection loss.");
      return;
    }

    console.warn("Connection lost or timed out. Reconnecting automatically to keep Zoya online...");
    this.teardown();
    this.onStateChange("processing");

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = setTimeout(async () => {
      if (this.explicitlyStopped) return;
      try {
        console.log("Attempting background session restoration...");
        await this.startSession();
      } catch (err) {
        console.warn("Session restoration failed, retrying in 3 seconds...", err);
        this.handleConnectionLoss();
      }
    }, 2000); // 2 seconds delay
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const pitchStr = localStorage.getItem("zoya_voice_pitch");
      const pitchVal = pitchStr ? parseFloat(pitchStr) : 1.15;
      
      source.playbackRate.setValueAtTime(pitchVal, this.playbackContext.currentTime);
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration / pitchVal;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.warn("Error playing chunk", e);
    }
  }

  stopAudioPlayback() {
    this.stopPlayback();
  }

  private stopPlayback() {
    if (this.playbackContext) {
      try {
        this.playbackContext.close();
      } catch (e) {
        console.warn("Failed to close playback context:", e);
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        try {
          this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
        } catch (e) {
          console.warn("Failed to create playback AudioContext with 24kHz sample rate in stopPlayback, falling back.", e);
          this.playbackContext = new AudioContextClass();
        }
        if (this.playbackContext.state === "suspended") {
          this.playbackContext.resume().catch(err => console.warn("Error resuming playbackContext:", err));
        }
        this.nextPlayTime = this.playbackContext.currentTime;
      } else {
        this.playbackContext = null;
      }
      this.isPlaying = false;
    }
  }

  private teardown() {
    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
      this.processor = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
    if (this.mediaStream) {
      try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      const p = this.sessionPromise;
      this.sessionPromise = null;
      p.then(session => {
        try { session.close(); } catch (e) {}
      }).catch(() => {});
    }
  }

  stop() {
    this.explicitlyStopped = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.teardown();
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}

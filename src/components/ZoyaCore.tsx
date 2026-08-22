import React from "react";
import { motion, AnimatePresence } from "motion/react";

type CoreState = "idle" | "listening" | "processing" | "speaking";
type CoreMood = "happy" | "angry" | "sad" | "serious" | "blushing";

interface ZoyaCoreProps {
  state: CoreState;
  mood: CoreMood;
}

export default function ZoyaCore({ state, mood }: ZoyaCoreProps) {
  // Determine primary colors and theme based on current mood
  const getMoodColors = () => {
    switch (mood) {
      case "angry":
        return {
          glow: "rgba(239, 68, 68, 0.8)", // Red-500
          border: "border-red-500/50",
          bgGlow: "shadow-red-500/40",
          coreBg: "bg-red-500",
          particles: ["#f87171", "#ef4444", "#dc2626", "#b91c1c"]
        };
      case "blushing":
        return {
          glow: "rgba(244, 114, 182, 0.85)", // Pink-400
          border: "border-pink-500/50",
          bgGlow: "shadow-pink-400/40",
          coreBg: "bg-pink-400",
          particles: ["#f472b6", "#ec4899", "#db2777", "#fb7185"]
        };
      case "sad":
        return {
          glow: "rgba(59, 130, 246, 0.75)", // Blue-500
          border: "border-blue-500/50",
          bgGlow: "shadow-blue-500/35",
          coreBg: "bg-blue-500",
          particles: ["#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"]
        };
      case "serious":
        return {
          glow: "rgba(168, 85, 247, 0.8)", // Purple-500
          border: "border-purple-500/50",
          bgGlow: "shadow-purple-500/35",
          coreBg: "bg-purple-500",
          particles: ["#c084fc", "#a855f7", "#9333ea", "#7e22ce"]
        };
      case "happy":
      default:
        return {
          glow: "rgba(244, 143, 177, 0.8)", // Soft pink/rose-300
          border: "border-rose-300/40",
          bgGlow: "shadow-pink-500/30",
          coreBg: "bg-rose-300",
          particles: ["#f472b6", "#fbcfe8", "#fda4af", "#f43f5e"]
        };
    }
  };

  const currentTheme = getMoodColors();

  // Animation variants depending on state
  const getOrbAnimation = () => {
    if (state === "speaking") {
      return {
        scale: [1, 1.25, 1.05, 1.3, 1],
        borderRadius: ["42% 58% 70% 30% / 45% 45% 55% 55%", "70% 30% 52% 48% / 60% 40% 60% 40%", "42% 58% 70% 30%"],
        transition: {
          duration: 0.6,
          repeat: Infinity,
          ease: "easeInOut"
        }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.08, 1],
        borderRadius: ["50%", "45% 55% 45% 55% / 55% 45% 55% 45%", "50%"],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.95, 1.05, 0.95],
        rotate: [0, 360],
        borderRadius: ["40% 60% 40% 60% / 60% 40% 60% 40%", "60% 40% 60% 40% / 40% 60% 40% 60%", "40% 60% 40% 60%"],
        transition: {
          scale: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 2, repeat: Infinity, ease: "linear" }
        }
      };
    }
    // Idle (Default breathing floating)
    return {
      scale: [1, 1.04, 1],
      y: [0, -10, 0],
      rotate: [0, 5, -5, 0],
      transition: {
        scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" }
      }
    };
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none select-none">
      {/* Outer Glow Shield layer */}
      <div className="absolute w-[360px] h-[360px] flex items-center justify-center">
        <motion.div
          animate={{
            scale: state === "speaking" ? [1, 1.15, 1] : [1, 1.03, 1],
            opacity: state === "listening" ? 0.35 : 0.2
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute w-[280px] h-[280px] rounded-full blur-[70px] ${currentTheme.bgGlow}`}
          style={{ backgroundColor: currentTheme.glow }}
        />
      </div>

      {/* Orbiting Quantum Electrons Ring */}
      <AnimatePresence>
        {state !== "idle" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute w-[240px] h-[240px] border border-white/[0.04] rounded-full flex items-center justify-center"
          >
            {/* Spinning ring node */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: state === "processing" ? 2 : 4, repeat: Infinity, ease: "linear" }}
              className="absolute w-full h-full"
            >
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow-[0_0_15px_3px_rgba(255,255,255,0.7)]" 
                style={{ backgroundColor: currentTheme.glow, boxShadow: `0 0 16px 4px ${currentTheme.glow}` }}
              />
            </motion.div>

            {/* Reverse spinning inner ring node */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: state === "processing" ? 1.5 : 3.5, repeat: Infinity, ease: "linear" }}
              className="absolute w-[80%] h-[80%] border border-white/[0.03] rounded-full"
            >
              <div 
                className="absolute bottom-0 right-1/2 translate-x-1/2 w-2 h-2 rounded-full shadow-[0_0_12px_2px_rgba(255,255,255,0.7)]" 
                style={{ backgroundColor: currentTheme.glow, boxShadow: `0 0 12px 3px ${currentTheme.glow}` }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Futuristic Holographic Sphere Core Wrapper */}
      <motion.div
        className="relative w-[160px] h-[160px] flex items-center justify-center z-10"
        animate={getOrbAnimation()}
      >
        {/* Ring lines that shift morph */}
        <div className={`absolute inset-0 border-[2px] ${currentTheme.border} rounded-full opacity-35 animate-pulse`} />
        
        {/* Speaking fluid shockwave rings */}
        {state === "speaking" && (
          <>
            <motion.div
              initial={{ scale: 0.9, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              className={`absolute inset-0 border border-current rounded-full`}
              style={{ color: currentTheme.glow }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 2.3, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
              className={`absolute inset-0 border border-current rounded-full`}
              style={{ color: currentTheme.glow }}
            />
          </>
        )}

        {/* 3D Core Sphere body */}
        <div 
          className={`w-[90%] h-[90%] rounded-full relative overflow-hidden flex items-center justify-center border border-white/20 shadow-2xl bg-radial from-slate-950/80 to-black/95 backdrop-blur-xl`}
          style={{ boxShadow: `0 0 45px ${currentTheme.glow}, inset 0 0 25px ${currentTheme.glow}` }}
        >
          {/* Internal rotating digital radar sweep sweep */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-t from-transparent via-white/[0.06] to-transparent opacity-85"
          />

          {/* Glowing center neural matrix node */}
          <motion.div
            animate={{
              scale: state === "speaking" ? [1, 1.4, 0.9, 1.2, 1] : [1, 1.1, 1]
            }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            className={`w-[45%] h-[45%] rounded-full ${currentTheme.coreBg} blur-[4px] opacity-90 relative flex items-center justify-center`}
          >
            {/* Center digital tiny core node */}
            <div className="w-[40%] h-[40%] rounded-full bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.9)]" />
          </motion.div>

          {/* Matrix style particle layer floating inside core */}
          <div className="absolute inset-0 flex items-center justify-center">
            {currentTheme.particles.slice(0, 3).map((color, i) => (
              <motion.div
                key={i}
                animate={{
                  x: [Math.sin(i) * 30, Math.cos(i) * -30, Math.sin(i) * 30],
                  y: [Math.cos(i) * -30, Math.sin(i) * 30, Math.cos(i) * -30],
                  scale: [0.6, 1.1, 0.6]
                }}
                transition={{
                  duration: 3 + i * 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute w-2 h-2 rounded-full blur-[1px]"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Glowing aura edge lines */}
          <div className="absolute inset-0 border border-white/15 rounded-full pointer-events-none" />
        </div>

        {/* Small floating HUD text block above core */}
        <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none select-none">
          <span className="text-[10px] font-mono tracking-[0.2em] text-cyan-400 font-bold opacity-80 uppercase animate-pulse">
            CORE_{mood}
          </span>
          <div className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[8px] font-mono text-white/50 tracking-[0.1em]">{state.toUpperCase()}</span>
          </div>
        </div>
      </motion.div>

      {/* Footer dynamic voice/thought sound bars beneath the core */}
      <div className="flex gap-1 h-[24px] items-center mt-8 z-10">
        {Array.from({ length: 9 }).map((_, i) => {
          // Adjust height of bars based on conversational state
          const getBarHeight = () => {
            if (state === "speaking") {
              return [6, [14, 28, 10, 24, 6][i % 5], 6];
            }
            if (state === "listening") {
              return [4, [8, 12, 10, 6][i % 4], 4];
            }
            if (state === "processing") {
              return [4, 18, 4]; // stable rhythm
            }
            return [4, 6, 4]; // idle subtle breath
          };

          const delay = i * 0.08;

          return (
            <motion.div
              key={i}
              animate={{
                height: getBarHeight()
              }}
              transition={{
                duration: state === "speaking" ? 0.35 : state === "listening" ? 1 : 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: delay
              }}
              className="w-[3px] rounded-full"
              style={{
                backgroundColor: currentTheme.glow,
                boxShadow: `0 0 6px ${currentTheme.glow}`
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

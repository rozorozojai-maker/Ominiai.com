import { motion } from "motion/react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";

interface VisualizerProps {
  state: VisualizerState;
}

export default function Visualizer({ state }: VisualizerProps) {
  const getRingAnimation = (index: number, reverse: boolean = false) => {
    const baseSpeed = state === "listening" ? 3 : state === "processing" ? 1.5 : state === "speaking" ? 2 : 15;
    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      transition: { duration: baseSpeed + index * 2, repeat: Infinity, ease: "linear" }
    };
  };

  const getPulseAnimation = () => {
    if (state === "speaking") {
      return {
        scale: [1, 1.05, 0.98, 1.02, 1],
        opacity: [0.8, 1, 0.8, 1, 0.8],
        transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.02, 1],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.98, 1.02, 0.98],
        opacity: [0.6, 0.9, 0.6],
        transition: { duration: 0.8, repeat: Infinity, ease: "linear" }
      };
    }
    return {
      scale: [1, 1.01, 1],
      opacity: [0.4, 0.6, 0.4],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };
  };

  // JARVIS color palette (Cyan/Blue) with Zoya's personality (Violet/Pink hints)
  const getTheme = () => {
    switch (state) {
      case "listening": return { color: "rgba(139, 92, 246, 1)", glow: "shadow-violet-500/60", border: "border-violet-400" };
      case "processing": return { color: "rgba(56, 189, 248, 1)", glow: "shadow-sky-400/80", border: "border-sky-400" };
      case "speaking": return { color: "rgba(236, 72, 153, 1)", glow: "shadow-pink-500/80", border: "border-pink-400" };
      default: return { color: "rgba(6, 182, 212, 0.8)", glow: "shadow-cyan-500/40", border: "border-cyan-500/50" }; // Cyan for idle
    }
  };

  const theme = getTheme();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Ambient Glow */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[70vmin] h-[70vmin] rounded-full blur-[80px] ${theme.glow} opacity-0`}
        style={{ backgroundColor: theme.color, opacity: 0.05 }}
      />

      {/* Ring 1: Massive Outer Dashed */}
      <motion.div
        animate={getRingAnimation(4, false)}
        className={`absolute w-[95vmin] h-[95vmin] rounded-full border-[1.5px] border-dashed ${theme.border} opacity-20`}
      />

      {/* Ring 2: Segmented Thick Ring */}
      <motion.div
        animate={getRingAnimation(3, true)}
        className={`absolute w-[82vmin] h-[82vmin] rounded-full border-[2.5px] border-dotted ${theme.border} opacity-30`}
      />

      {/* Ring 3: Scanner Ring (Solid with gaps) */}
      <motion.div
        animate={getRingAnimation(2, false)}
        className={`absolute w-[68vmin] h-[68vmin] rounded-full border-[1.5px] ${theme.border} border-t-transparent border-b-transparent opacity-45`}
      />

      {/* Ring 4: Inner Dashed */}
      <motion.div
        animate={getRingAnimation(1, true)}
        className={`absolute w-[52vmin] h-[52vmin] rounded-full border-[2px] border-dashed ${theme.border} opacity-50`}
      />
      
      {/* Ring 5: Core HUD Ring */}
      <motion.div
        animate={getRingAnimation(0, false)}
        className={`absolute w-[38vmin] h-[38vmin] rounded-full border-[4px] border-dotted ${theme.border} opacity-65`}
      />

      {/* Core Circle */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[24vmin] h-[24vmin] rounded-full border-[1.5px] ${theme.border} bg-transparent flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,0,0,0.2)]`}
        style={{ boxShadow: `0 0 35px ${theme.color}, inset 0 0 25px ${theme.color}` }}
      >
        {/* Center Text */}
        <div 
          className="font-bold tracking-[0.3em] font-sans text-sm md:text-base lg:text-lg text-white"
          style={{ textShadow: `0 0 10px ${theme.color}, 0 0 20px ${theme.color}` }}
        >
          ZOYA
        </div>
      </motion.div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const AnimatedHeart = ({ delay = 0, left = "50%" }) => (
  <motion.div
    initial={{ opacity: 0, y: 0, scale: 0.5 }}
    animate={{ opacity: [0, 0.8, 0], y: -150, scale: [0.5, 1.2, 1] }}
    transition={{ duration: 2.5, delay, repeat: Infinity, ease: "easeOut" }}
    className="absolute bottom-1/4 text-pink-400 pointer-events-none drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]"
    style={{ left }}
  >
    ❤
  </motion.div>
);

const AnimatedSparkle = ({ delay = 0, left = "50%", top = "50%" }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0, rotate: 0 }}
    animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], rotate: 180 }}
    transition={{ duration: 2, delay, repeat: Infinity, ease: "easeInOut" }}
    className="absolute text-yellow-300 pointer-events-none drop-shadow-[0_0_5px_rgba(253,224,71,0.8)] text-xl"
    style={{ left, top }}
  >
    ✨
  </motion.div>
);

const AnimatedWeep = ({ delay = 0, left = "50%" }) => (
  <motion.div
    initial={{ opacity: 0, y: 0, scale: 0.8 }}
    animate={{ opacity: [0, 0.7, 0], y: 100 }}
    transition={{ duration: 2, delay, repeat: Infinity, ease: "easeIn" }}
    className="absolute top-1/3 text-blue-400 pointer-events-none drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] text-sm"
    style={{ left }}
  >
    💧
  </motion.div>
);

const RandomBlink = () => {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const triggerBlink = () => {
      setIsBlinking(true);
      
      // Blink duration between 100ms and 150ms
      setTimeout(() => {
        setIsBlinking(false);
      }, 100 + Math.random() * 50);

      // Next blink between 2s and 6s
      const nextBlink = 2000 + Math.random() * 4000;
      timeoutId = setTimeout(triggerBlink, nextBlink);
    };

    timeoutId = setTimeout(triggerBlink, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <AnimatePresence>
      {isBlinking && (
        <motion.div
          key="blink"
          initial={{ scaleY: 1, opacity: 0 }}
          animate={{ scaleY: 0, opacity: 0.4 }}
          exit={{ scaleY: 1, opacity: 0 }}
          transition={{ duration: 0.05 }}
          className="absolute inset-0 bg-black/80 z-30 pointer-events-none origin-center mix-blend-overlay"
        />
      )}
    </AnimatePresence>
  );
};

interface ZoyaAvatarProps {
  state: "idle" | "listening" | "processing" | "speaking";
  mood: "happy" | "sad" | "angry" | "serious" | "blushing";
  playWelcome?: boolean;
}

export default function ZoyaAvatar({ state, mood, playWelcome }: ZoyaAvatarProps) {
  const [renderList, setRenderList] = useState<{ id: number; src: string }[]>([
    { id: 1, src: "/videos/01_listening_mode_202606210953.mp4" }
  ]);
  const [activeId, setActiveId] = useState<number>(1);
  const nextIdRef = useRef(2);
  const currentSrcRef = useRef("/videos/01_listening_mode_202606210953.mp4");

  const [showWelcomeAnim, setShowWelcomeAnim] = useState(false);
  const hasTriggeredWelcome = useRef(false);

  useEffect(() => {
    if (playWelcome && !hasTriggeredWelcome.current) {
      hasTriggeredWelcome.current = true;
      setShowWelcomeAnim(true);
      setTimeout(() => setShowWelcomeAnim(false), 2500); // Hide after an animation duration
    }
  }, [playWelcome]);

  useEffect(() => {
    let newVideos: string[] = [];
    
    if (state === "speaking") {
      newVideos = [
        "/videos/01_talking_mode_202606210918.mp4",
        "/videos/02_talking_mode_202606210918.mp4"
      ];
    } else {
      newVideos = [
        "/videos/01_listening_mode_202606210953.mp4",
        "/videos/02_listening_mode_202606210915.mp4"
      ];
    }

    if (newVideos.includes(currentSrcRef.current)) {
       return;
    }
    const randomIndex = Math.floor(Math.random() * newVideos.length);
    const newSrc = newVideos[randomIndex];
    
    currentSrcRef.current = newSrc;
    const newId = nextIdRef.current++;
    
    setRenderList((prev) => {
      // Keep only the currently active one, plus the new one
      const currentlyActive = prev.find(v => v.id === activeId) || prev[prev.length - 1];
      return [currentlyActive, { id: newId, src: newSrc }];
    });
  }, [state, mood]);

  const handlePlaying = (id: number) => {
    setActiveId(id);
    setTimeout(() => {
      setRenderList((prev) => prev.filter((v) => v.id === id || v.id > id));
    }, 1000);
  };


  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-black">
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`absolute inset-0 w-full h-full overflow-hidden transition-colors duration-700 select-none bg-black ${
          mood === "angry"
            ? "shadow-red-500/20 shadow-[inset_0_0_80px_rgba(239,68,68,0.15)]"
            : mood === "blushing"
            ? "shadow-pink-500/30 shadow-[inset_0_0_80px_rgba(236,72,153,0.15)]"
            : mood === "sad"
            ? "shadow-blue-500/20 shadow-[inset_0_0_80px_rgba(59,130,246,0.1)]"
            : mood === "serious"
            ? "shadow-purple-500/20 shadow-[inset_0_0_80px_rgba(168,85,247,0.1)]"
            : "shadow-pink-500/10 shadow-[inset_0_0_80px_rgba(244,143,177,0.05)]"
        }`}
      >
        <AnimatePresence>
          {showWelcomeAnim && (
            <motion.div
              key="welcome-anim"
              initial={{ scale: 0.8, opacity: 0, filter: "brightness(2)" }}
              animate={{ scale: 1, opacity: 1, filter: "brightness(1.2)" }}
              exit={{ scale: 1.1, opacity: 0, filter: "brightness(0.5) blur(10px)" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
              <div className="px-5 py-2 rounded-xl bg-pink-500/10 backdrop-blur-md border border-pink-500/50 shadow-[0_0_40px_rgba(236,72,153,0.4)]">
                <p className="text-pink-100 font-mono tracking-[0.25em] text-sm md:text-base font-bold uppercase drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]">
                  System Online
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mood === "angry" && (
            <motion.div
              key="mood-angry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-red-900/60 to-transparent z-10 pointer-events-none"
            />
          )}
          {mood === "sad" && (
            <motion.div
              key="mood-sad"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-blue-950/70 to-transparent z-10 pointer-events-none"
            />
          )}
          {mood === "serious" && (
            <motion.div
              key="mood-serious"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-purple-950/60 to-transparent z-10 pointer-events-none"
            />
          )}
          {state === "listening" && (
            <motion.div
              key="state-listening"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.2, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-white/10 z-10 pointer-events-none mix-blend-overlay border border-white/20"
            />
          )}
          {state === "speaking" && (
            <motion.div
              key="state-speaking"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-pink-500/10 z-10 pointer-events-none mix-blend-overlay"
            />
          )}
        </AnimatePresence>

        <div className="relative w-full h-full flex items-center justify-center bg-[#050505]">
          {renderList.map((videoEntry, idx) => (
            <video
              key={videoEntry.id}
              src={videoEntry.src}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onPlaying={() => handlePlaying(videoEntry.id)}
              className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-700 ease-in-out ${
                videoEntry.id === activeId ? "opacity-100 z-20" : "opacity-0 z-10"
              }`}
              style={{ objectPosition: "center 20%" }}
            />
          ))}
          <RandomBlink />
        </div>

        {/* AMBIENT EXTRA MOOD PARTICLES OVERLAY */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-20">
          {mood === "blushing" && (
            <div className="absolute inset-0">
              <AnimatedHeart delay={0} left="15%" />
              <AnimatedHeart delay={1.5} left="45%" />
              <AnimatedHeart delay={0.7} left="75%" />
              <AnimatedHeart delay={2.2} left="30%" />
            </div>
          )}

          {mood === "happy" && (
            <div className="absolute inset-0">
              <AnimatedSparkle delay={0.2} left="12%" top="25%" />
              <AnimatedSparkle delay={0.9} left="80%" top="35%" />
              <AnimatedSparkle delay={1.7} left="68%" top="15%" />
              <AnimatedSparkle delay={0.4} left="25%" top="55%" />
            </div>
          )}

          {mood === "sad" && (
            <div className="absolute inset-0">
              <AnimatedWeep delay={0.1} left="36%" />
              <AnimatedWeep delay={0.8} left="51%" />
              <AnimatedWeep delay={1.6} left="39%" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

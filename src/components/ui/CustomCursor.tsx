"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    const update = () => setEnabled(!mq.matches && fine.matches);
    update();
    mq.addEventListener("change", update);
    fine.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      fine.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    const handleEnter = () => setVisible(true);
    const handleLeave = () => setVisible(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseenter", handleEnter);
    window.addEventListener("mouseleave", handleLeave);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseenter", handleEnter);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 hidden md:block" aria-hidden>
      <motion.div
        className="absolute h-1.5 w-1.5 rounded-full bg-eoe-gold"
        animate={{ x: position.x - 3, y: position.y - 3, opacity: visible ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 35, mass: 0.4 }}
      />
      <motion.div
        className="absolute h-8 w-8 rounded-full border border-eoe-gold/50"
        animate={{ x: position.x - 16, y: position.y - 16, opacity: visible ? 0.8 : 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 30, mass: 0.6 }}
      />
    </div>
  );
}

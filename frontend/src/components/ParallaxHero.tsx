"use client";
import { motion, useScroll, useTransform } from "framer-motion";

export default function ParallaxHero() {
  const { scrollY } = useScroll();
  const yBg = useTransform(scrollY, [0, 300], [0, 100]);
  const yFg = useTransform(scrollY, [0, 300], [0, -50]);

  return (
    <section className="relative h-screen overflow-hidden">
      <motion.div
        style={{ y: yBg }}
        className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-500 to-purple-700"
      />
      <motion.div
        style={{ y: yFg }}
        className="flex h-full items-center justify-center"
      >
        <h1 className="text-5xl font-bold text-white drop-shadow-lg">HashApp</h1>
      </motion.div>
    </section>
  );
}

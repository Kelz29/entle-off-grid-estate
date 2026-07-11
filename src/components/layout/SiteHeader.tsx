"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const navItems = [
  { href: "#estate", label: "The Estate" },
  { href: "#spaces", label: "Spaces" },
  { href: "#experiences", label: "Experiences" },
  { href: "#food", label: "The Table" },
  { href: "#booking", label: "Book" },
  { href: "#gallery", label: "Gallery" },
  { href: "#contact", label: "Contact" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4"
    >
      <div
        className={`flex w-full max-w-6xl items-center justify-between rounded-full border border-eoe-espresso/10 px-5 py-3 text-sm tracking-[0.18em] uppercase ${
          scrolled
            ? "bg-eoe-ivory/80 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
            : "bg-eoe-ivory/40 backdrop-blur-sm"
        } transition-colors`}
      >
        <Link href="/" className="font-display text-base font-semibold">
          Entle Off-Grid Estate
        </Link>
        <nav className="hidden gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[11px] text-eoe-espresso/80 hover:text-eoe-espresso"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#booking"
          className="rounded-full border border-eoe-gold/70 bg-eoe-gold/10 px-4 py-2 text-[11px] font-medium text-eoe-espresso hover:bg-eoe-gold/20"
        >
          Book a Date
        </a>
      </div>
    </motion.header>
  );
}


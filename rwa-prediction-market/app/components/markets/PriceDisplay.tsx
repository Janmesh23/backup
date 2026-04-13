"use client";
import { useEffect, useRef, useState } from "react";
import { usePythPrice } from "@/hooks/usePythPrice";

interface PriceDisplayProps {
  feedAddress: string;
  strikePrice: number; // human-readable (e.g., 70000)
  label?: string;
}

export default function PriceDisplay({ feedAddress, strikePrice, label }: PriceDisplayProps) {
  const data = usePythPrice(feedAddress);
  const prevRef = useRef<number | null>(null);
  const [blinkClass, setBlinkClass] = useState("");

  useEffect(() => {
    if (!data?.price) return;
    if (prevRef.current !== null) {
      setBlinkClass(data.price > prevRef.current ? "price-blink-up" : "price-blink-down");
      const t = setTimeout(() => setBlinkClass(""), 600);
      return () => clearTimeout(t);
    }
    prevRef.current = data.price;
  }, [data?.price]);

  const isAbove = data ? data.price >= strikePrice : null;
  const formattedPrice = data
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(data.price)
    : "—";

  return (
    <div className={`rounded-xl p-4 ${blinkClass} gradient-card transition-all`}>
      {label && <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">{label}</p>}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold tracking-tight">{formattedPrice}</p>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              ±{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 3 }).format(data.confidence)} confidence
            </p>
          )}
        </div>
        {isAbove !== null && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
              isAbove ? "bg-[--yes-color]/20 text-[--yes-color]" : "bg-[--no-color]/20 text-[--no-color]"
            }`}
          >
            {isAbove ? "▲ ABOVE STRIKE" : "▼ BELOW STRIKE"}
          </span>
        )}
      </div>

      {!data && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <p className="text-xs text-muted-foreground">Connecting to Pyth...</p>
        </div>
      )}
    </div>
  );
}

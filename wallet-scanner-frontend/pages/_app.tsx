import "../styles/globals.css";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DynamicParallaxProvider = dynamic(
  () => import("react-scroll-parallax").then((m) => m.ParallaxProvider),
  { ssr: false }
);

export default function App({ Component, pageProps }: AppProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(!!mql.matches);
    apply();
    mql.addEventListener?.('change', apply);
    return () => mql.removeEventListener?.('change', apply);
  }, []);

  return (
    <DynamicParallaxProvider disabled={reducedMotion}>
      <Component {...pageProps} />
    </DynamicParallaxProvider>
  );
}

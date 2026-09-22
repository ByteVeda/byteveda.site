"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CanvasField } from "./canvas-field";
import { StaticField } from "./static-field";
import { detectTier, type Tier } from "./tier";

/**
 * The shader is worth ~150 kB, and the hero is the first thing that has to
 * paint, so it is never on the critical path: the 2D field renders immediately
 * (on the server too), and the WebGL chunk replaces it only once it has loaded
 * on a device that asked for it.
 */
const WebglField = dynamic(() => import("./webgl-field").then((m) => m.WebglField), {
  ssr: false,
  loading: () => <CanvasField />,
});

export function HeroField() {
  const [tier, setTier] = useState<Tier>("canvas");

  useEffect(() => {
    setTier(detectTier());
  }, []);

  if (tier === "static") return <StaticField />;
  if (tier === "webgl") return <WebglField />;
  return <CanvasField />;
}

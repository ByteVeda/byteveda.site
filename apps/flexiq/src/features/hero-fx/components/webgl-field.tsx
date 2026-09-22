"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, Color } from "three";
import { hash01 } from "./scatter";
import { accentColor } from "./tier";

const COUNT = 1600;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec3 p = position;
    // Positions live in a unit square and wrap, so the field is seamless at any
    // viewport size — the object's scale does the mapping to pixels.
    p.x = mod(p.x + uTime * aSpeed + 0.5, 1.0) - 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, vAlpha * smoothstep(0.5, 0.1, d));
  }
`;

function Field() {
  const { viewport, gl } = useThree();

  const attributes = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const alphas = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = hash01(i, "x") - 0.5;
      positions[i * 3 + 1] = hash01(i, "y") - 0.5;
      positions[i * 3 + 2] = 0;
      speeds[i] = 0.012 + hash01(i, "speed") * 0.055;
      sizes[i] = 1.2 + hash01(i, "size") * 2.6;
      alphas[i] = 0.08 + hash01(i, "alpha") * 0.42;
    }
    return { positions, speeds, sizes, alphas };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color(accentColor()) },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uPixelRatio.value = gl.getPixelRatio();
  }, [gl, uniforms]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      uniforms.uColor.value = new Color(accentColor());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [uniforms]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points scale={[viewport.width, viewport.height, 1]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.positions, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[attributes.speeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attributes.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[attributes.alphas, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export function WebglField() {
  return (
    <div className="hero-fx" aria-hidden>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        // Freezes the loop when the hero scrolls away; r3f resumes on demand.
        frameloop="always"
      >
        <Field />
      </Canvas>
    </div>
  );
}

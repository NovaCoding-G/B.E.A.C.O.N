"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import type { Group } from "three";
import type { ApproachGeometry, ApproachMarker } from "@/lib/orbit-geometry";

const GREEN = "#3dff8a";
const AMBER = "#e8a317";
const EARTH = "#3a6ea5";
const MUTED = "#6a7d94";

function Earth() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial
          color={EARTH}
          emissive="#0a1a2e"
          emissiveIntensity={0.35}
          roughness={0.55}
          metalness={0.15}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.04, 32, 32]} />
        <meshStandardMaterial
          color="#7ec8ff"
          transparent
          opacity={0.12}
          roughness={1}
        />
      </mesh>
      <Html position={[0, -1.35, 0]} center style={{ pointerEvents: "none" }}>
        <span className="num text-[0.6rem] text-[var(--text-muted)] tracking-wider uppercase">
          Terra (not to scale)
        </span>
      </Html>
    </group>
  );
}

function ReferenceRing({
  radius,
  color,
  label,
}: {
  radius: number;
  color: string;
  label: string;
}) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return pts;
  }, [radius]);

  return (
    <group>
      <Line points={points} color={color} lineWidth={1} transparent opacity={0.55} />
      <Html
        position={[radius * 0.72, 0.15, radius * 0.72]}
        style={{ pointerEvents: "none" }}
      >
        <span
          className="num text-[0.55rem] tracking-wider uppercase whitespace-nowrap"
          style={{ color }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
}

function UncertaintyBand({
  minScene,
  maxScene,
}: {
  minScene: number;
  maxScene: number;
}) {
  const inner = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = -0.35 + (i / 48) * 0.7;
      pts.push([Math.cos(a) * minScene, 0, Math.sin(a) * minScene]);
    }
    return pts;
  }, [minScene]);

  const outer = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = -0.35 + (i / 48) * 0.7;
      pts.push([Math.cos(a) * maxScene, 0, Math.sin(a) * maxScene]);
    }
    return pts;
  }, [maxScene]);

  return (
    <group>
      <Line points={inner} color={AMBER} lineWidth={1} transparent opacity={0.4} />
      <Line points={outer} color={AMBER} lineWidth={1} transparent opacity={0.4} />
    </group>
  );
}

function AsteroidMarker({
  marker,
  divergent,
}: {
  marker: ApproachMarker;
  divergent: boolean;
}) {
  const ref = useRef<Group>(null);
  const color = divergent ? AMBER : GREEN;
  const x = Math.cos(marker.angle) * marker.sceneRadius;
  const z = Math.sin(marker.angle) * marker.sceneRadius;

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.6;
    }
  });

  const radial: [number, number, number][] = [
    [0, 0, 0],
    [x, 0, z],
  ];

  return (
    <group>
      <Line points={radial} color={color} lineWidth={1} transparent opacity={0.35} />
      <group position={[x, 0, z]}>
        <group ref={ref}>
          <mesh>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.45}
              roughness={0.35}
            />
          </mesh>
        </group>
        <Html position={[0.35, 0.45, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded-none border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-elevated)_92%,transparent)] px-2 py-1 backdrop-blur-sm">
            <div className="num text-[0.65rem]" style={{ color }}>
              {marker.label}
            </div>
            <div className="num text-[0.6rem] text-[var(--text-muted)]">
              {marker.distanceAu.toFixed(6)} au · {marker.distanceLd.toFixed(2)} LD
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}

function SceneContent({ geometry }: { geometry: ApproachGeometry }) {
  const cam = Math.max(geometry.frameRadius * 2.2, 8);

  return (
    <>
      <color attach="background" args={["#030507"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 10, 4]} intensity={1.1} color="#dce3ec" />
      <pointLight position={[-6, 4, -4]} intensity={0.35} color={GREEN} />

      <gridHelper args={[cam * 1.4, 16, "#1a2738", "#121a26"]} position={[0, -0.02, 0]} />

      <Earth />
      <ReferenceRing
        radius={geometry.ldRingRadius}
        color={MUTED}
        label="1 LD"
      />

      {geometry.uncertainty && (
        <UncertaintyBand
          minScene={geometry.uncertainty.minScene}
          maxScene={geometry.uncertainty.maxScene}
        />
      )}

      {geometry.markers.map((m) => (
        <AsteroidMarker
          key={m.source}
          marker={m}
          divergent={geometry.hasDivergence}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={cam * 2.5}
        target={[0, 0, 0]}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </>
  );
}

interface OrbitSceneProps {
  geometry: ApproachGeometry;
}

export function OrbitScene({ geometry }: OrbitSceneProps) {
  const cam = Math.max(geometry.frameRadius * 2.2, 8);

  return (
    <Canvas
      camera={{ position: [cam * 0.75, cam * 0.45, cam * 0.75], fov: 42, near: 0.1, far: 200 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <SceneContent geometry={geometry} />
    </Canvas>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { HologramCanvas } from "./hologram-canvas";

export function ActTwoParadox() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStarted, setVideoStarted] = useState(false);
  const [canvasOff, setCanvasOff] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const triggerVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoStarted) return;
    if (reducedMotion) return;
    video.play().then(() => setVideoStarted(true)).catch(() => {});
  }, [videoStarted, reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry!.isIntersecting) {
          triggerVideo();
          setCanvasOff(false);
        } else {
          setCanvasOff(true);
        }
      },
      { threshold: 0.5 },
    );

    io.observe(section);
    return () => io.disconnect();
  }, [triggerVideo]);

  const { eyebrow, headline, closer } = COPY.paradoxAct;

  return (
    <section
      ref={sectionRef}
      id="act-two-paradox"
      aria-labelledby="act-two-heading"
      className="relative isolate h-screen w-full overflow-hidden bg-[#050505]"
    >
      {/* Layer 0 — Shader */}
      <HologramCanvas paused={canvasOff} />

      {/* Layer 1 — Video */}
      <div className="absolute inset-0 z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          loop
          preload="metadata"
          poster=""
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Layer 2 — Text */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-5 md:px-8">
        {/* Eyebrow — fades out when video starts */}
        <p
          className="font-mono text-xs uppercase tracking-[0.08em] text-stone transition-opacity duration-[400ms]"
          style={{ opacity: videoStarted ? 0 : 1 }}
        >
          {eyebrow}
        </p>

        {/* Headline — centered initially, migrates to top when video starts */}
        <DisplayHeading
          id="act-two-heading"
          level="xl"
          className="mt-4 max-w-[18ch] text-center text-white transition-all duration-[600ms] ease-out"
          style={{
            textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            transform: videoStarted ? "translateY(-40vh) scale(0.8)" : "translateY(0) scale(1)",
            ...(videoStarted ? { position: "absolute", top: "50%" } : {}),
          }}
        >
          {headline}
        </DisplayHeading>

        {/* Closer — always visible (video TBD), fades in with delay once video plays */}
        <p
          className="absolute bottom-12 font-mono text-sm tracking-[0.06em] text-white/80 transition-opacity duration-[800ms]"
          style={{
            opacity: videoStarted ? 1 : 0.8,
            transitionDelay: videoStarted ? "1500ms" : "0ms",
          }}
        >
          {closer}
        </p>
      </div>

      {/* Unmute toggle — bottom-right corner */}
      {videoStarted && (
        <UnmuteToggle videoRef={videoRef} />
      )}

      {/* Reduced-motion fallback: manual play button */}
      {reducedMotion && !videoStarted && (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (video) video.play().then(() => setVideoStarted(true)).catch(() => {});
          }}
          className="absolute inset-0 z-30 flex items-center justify-center"
          aria-label="Play video"
        >
          <span className="rounded-full border border-white/40 bg-black/50 p-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
              <path d="M12 8L26 16L12 24V8Z" fill="white" fillOpacity="0.8" />
            </svg>
          </span>
        </button>
      )}
    </section>
  );
}

function UnmuteToggle({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [muted, setMuted] = useState(true);

  return (
    <button
      type="button"
      className="absolute bottom-4 right-4 z-30 rounded-full border border-white/20 bg-black/40 p-2 text-white/50 transition-colors hover:bg-black/60 hover:text-white/80"
      aria-label={muted ? "Unmute video" : "Mute video"}
      onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setMuted(video.muted);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        {muted ? (
          <path d="M8 2L4 6H1v4h3l4 4V2zm3 3.5v5m2.5-7.5v10" stroke="currentColor" strokeWidth="1.2" fill="none" />
        ) : (
          <path d="M8 2L4 6H1v4h3l4 4V2zm3 4.5c.5.5.5 1.5 0 2m1.5-4c1.2 1.2 1.2 3.8 0 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        )}
      </svg>
    </button>
  );
}

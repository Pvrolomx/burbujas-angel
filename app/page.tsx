'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  wobbleOffset: number;
  wobbleSpeed: number;
  isSpecial: boolean;
  opacity: number;
  popping: boolean;
  createdAt: number;
}

interface Sparkle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const COLORS = [
  'rgba(255, 182, 193, 0.45)', // rosa
  'rgba(173, 216, 230, 0.45)', // azul
  'rgba(144, 238, 144, 0.45)', // verde
  'rgba(255, 255, 150, 0.45)', // amarillo
  'rgba(200, 162, 255, 0.45)', // morado
  'rgba(255, 200, 150, 0.45)', // naranja
];

const HIGHLIGHT_COLORS = [
  'rgba(255, 220, 230, 0.7)',
  'rgba(210, 240, 255, 0.7)',
  'rgba(200, 255, 200, 0.7)',
  'rgba(255, 255, 210, 0.7)',
  'rgba(230, 210, 255, 0.7)',
  'rgba(255, 230, 210, 0.7)',
];

export default function BubblePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const scoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const [calmMode, setCalmMode] = useState(false);
  const calmModeRef = useRef(false);
  const [photo, setPhoto] = useState<string | null>('/angel.jpg');
  const photoRef = useRef<HTMLImageElement | null>(null);
  const defaultPhotoLoaded = useRef(false);
  const nextIdRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);
  const starsRef = useRef<{ x: number; y: number; size: number; twinkleSpeed: number; phase: number }[]>([]);
  const [showInstall, setShowInstall] = useState(false);
  const deferredPromptRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playPop = useCallback((isSpecial: boolean) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const freq = isSpecial ? 600 + Math.random() * 200 : 320 + Math.random() * 480;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(calmModeRef.current ? 0.08 : 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }, [getAudioCtx]);

  const spawnBubble = useCallback((x?: number, y?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const calm = calmModeRef.current;
    const size = 40 + Math.random() * 70;
    const colorIdx = Math.floor(Math.random() * COLORS.length);
    const isSpecial = Math.random() < 0.12;
    const bubble: Bubble = {
      id: nextIdRef.current++,
      x: x ?? Math.random() * (canvas.width - size) + size / 2,
      y: y ?? canvas.height + size,
      size,
      color: COLORS[colorIdx],
      speedY: calm ? 0.3 + Math.random() * 0.4 : 0.6 + Math.random() * 0.8,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      isSpecial,
      opacity: 1,
      popping: false,
      createdAt: Date.now(),
    };
    bubblesRef.current.push(bubble);
  }, []);

  const spawnSparkles = useCallback((x: number, y: number, isSpecial: boolean) => {
    const count = isSpecial ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2 + Math.random() * 3;
      sparklesRef.current.push({
        id: nextIdRef.current++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: isSpecial ? 'rgba(255, 215, 0, 0.9)' : COLORS[Math.floor(Math.random() * COLORS.length)].replace('0.45', '0.9'),
        size: isSpecial ? 4 : 3,
      });
    }
  }, []);

  const popBubble = useCallback((bubble: Bubble) => {
    if (bubble.popping) return;
    bubble.popping = true;
    playPop(bubble.isSpecial);
    spawnSparkles(bubble.x, bubble.y, bubble.isSpecial);
    const pts = bubble.isSpecial ? 5 : 1;
    if (!calmModeRef.current) {
      scoreRef.current += pts;
      setScore(scoreRef.current);
    }
  }, [playPop, spawnSparkles]);

  // Handle touch/click
  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    // Check if we hit a bubble (check from top/newest first)
    const bubbles = bubblesRef.current;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.popping) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.size / 2 + 10) {
        popBubble(b);
        return;
      }
    }
    // Touched empty space — create bubble
    spawnBubble(x, y);
  }, [popBubble, spawnBubble]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Generate stars
      starsRef.current = Array.from({ length: 30 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 1 + Math.random() * 2,
        twinkleSpeed: 0.005 + Math.random() * 0.015,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        handleInteraction(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      }
    };
    const onClick = (e: MouseEvent) => {
      handleInteraction(e.clientX, e.clientY);
    };

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('mousedown', onClick);

    // Animation loop
    let time = 0;
    const loop = () => {
      time++;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const calm = calmModeRef.current;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0a2e');
      grad.addColorStop(0.5, '#1a1a4e');
      grad.addColorStop(1, '#2d1b69');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      starsRef.current.forEach(star => {
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(time * star.twinkleSpeed + star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });

      // Spawn bubbles
      const spawnInterval = calm ? 1200 : 600;
      if (time - lastSpawnRef.current > spawnInterval / 16.67 && bubblesRef.current.filter(b => !b.popping).length < 35) {
        spawnBubble();
        lastSpawnRef.current = time;
      }

      // Update and draw bubbles
      const bubbles = bubblesRef.current;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.popping) {
          b.opacity -= 0.08;
          b.size += 3;
          if (b.opacity <= 0) {
            bubbles.splice(i, 1);
            continue;
          }
        } else {
          b.y -= b.speedY;
          b.x += Math.sin(time * b.wobbleSpeed + b.wobbleOffset) * 0.5;
          if (b.y < -b.size) {
            bubbles.splice(i, 1);
            continue;
          }
        }

        // Draw bubble
        ctx.save();
        ctx.globalAlpha = b.opacity;

        if (b.isSpecial && photoRef.current) {
          // Photo bubble
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(photoRef.current, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = b.opacity;
          // Gold glow
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size / 2 + 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.3 * Math.sin(time * 0.05)})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          // Gold shadow glow
          ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
          ctx.shadowBlur = 15;
          ctx.stroke();
        } else if (b.isSpecial) {
          // Emoji special bubble
          const radGrad = ctx.createRadialGradient(
            b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.05,
            b.x, b.y, b.size / 2
          );
          radGrad.addColorStop(0, 'rgba(255, 240, 200, 0.6)');
          radGrad.addColorStop(1, 'rgba(255, 215, 0, 0.3)');
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = radGrad;
          ctx.fill();
          // Gold border
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.3 * Math.sin(time * 0.05)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          // Emoji
          ctx.font = `${b.size * 0.5}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('😊', b.x, b.y);
        } else {
          // Normal bubble
          const colorIdx = COLORS.indexOf(b.color);
          const radGrad = ctx.createRadialGradient(
            b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.05,
            b.x, b.y, b.size / 2
          );
          radGrad.addColorStop(0, HIGHLIGHT_COLORS[colorIdx >= 0 ? colorIdx : 0]);
          radGrad.addColorStop(1, b.color);
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = radGrad;
          ctx.fill();
          // Subtle border
          ctx.strokeStyle = b.color.replace('0.45', '0.2');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Update and draw sparkles
      const sparkles = sparklesRef.current;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05; // gravity
        s.life -= 0.025;
        if (s.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = s.life;
        ctx.beginPath();
        // Star shape
        const spikes = 4;
        const outerR = s.size;
        const innerR = s.size * 0.4;
        for (let j = 0; j < spikes * 2; j++) {
          const r = j % 2 === 0 ? outerR : innerR;
          const angle = (j * Math.PI) / spikes - Math.PI / 2;
          const sx = s.x + Math.cos(angle) * r;
          const sy = s.y + Math.sin(angle) * r;
          if (j === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.restore();
      }

      // Score badge (only if not calm mode)
      if (!calm) {
        const scoreText = `⭐ ${scoreRef.current}`;
        ctx.save();
        ctx.font = '600 24px Fredoka, sans-serif';
        const metrics = ctx.measureText(scoreText);
        const pw = 16;
        const bw = metrics.width + pw * 2;
        const bh = 44;
        const bx = w / 2 - bw / 2;
        const by = 16;
        // Backdrop
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 22);
        ctx.fill();
        // Outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scoreText, w / 2, by + bh / 2);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    // PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onClick);
    };
  }, [handleInteraction, spawnBubble]);

  // Sync calm mode ref
  useEffect(() => { calmModeRef.current = calmMode; }, [calmMode]);

  // Load default Angel photo
  useEffect(() => {
    if (!defaultPhotoLoaded.current) {
      defaultPhotoLoaded.current = true;
      const img = new Image();
      img.onload = () => { photoRef.current = img; };
      img.src = '/angel.jpg';
    }
  }, []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPhoto(url);
      const img = new Image();
      img.onload = () => { photoRef.current = img; };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      await deferredPromptRef.current.userChoice;
      setShowInstall(false);
      deferredPromptRef.current = null;
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, touchAction: 'none', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Bottom controls */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {/* Calm mode toggle */}
        <button
          onClick={() => setCalmMode(!calmMode)}
          style={{
            pointerEvents: 'auto',
            background: calmMode ? 'rgba(100, 200, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)',
            border: `1px solid ${calmMode ? 'rgba(100, 200, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
            borderRadius: 22,
            padding: '10px 18px',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 14,
            fontFamily: 'Fredoka, sans-serif',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {calmMode ? '🌙 Calma' : '✨ Normal'}
        </button>

        {/* Photo upload */}
        <label style={{
          pointerEvents: 'auto',
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 22,
          padding: '10px 18px',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: 14,
          fontFamily: 'Fredoka, sans-serif',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>
          {photo ? '📷 Cambiar foto' : '📷 Subir foto para burbujas'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />
        </label>

        {/* Install button */}
        {showInstall && (
          <button
            onClick={handleInstall}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(100, 255, 150, 0.2)',
              border: '1px solid rgba(100, 255, 150, 0.4)',
              borderRadius: 22,
              padding: '10px 18px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: 14,
              fontFamily: 'Fredoka, sans-serif',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            📲 Instalar App
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 2,
        right: 8,
        color: 'rgba(255,255,255,0.2)',
        fontSize: 10,
        fontFamily: 'Fredoka, sans-serif',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        Hecho por duendes.app 2026
      </div>
    </div>
  );
}

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
  familyIdx: number; // -1 = normal, 0+ = family member index
  opacity: number;
  popping: boolean;
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

interface NameReveal {
  name: string;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  life: number;
}

const FAMILY = [
  { name: 'Angel', file: 'Angel.jpg' },
  { name: 'Diana', file: 'Diana.jpg' },
  { name: 'Hector', file: 'Hector.jpg' },
  { name: 'Irma', file: 'Irma.jpg' },
  { name: 'Israel', file: 'Israel.jpg' },
  { name: 'Santiago', file: 'Santiago.jpg' },
  { name: 'Tía Alba', file: 'Tia_Alba.jpg' },
  { name: 'Tía Chely', file: 'Tia_Chely.jpg' },
  { name: 'Tía Jessy', file: 'Tia_Jessy.jpg' },
  { name: 'Ada', file: 'Ada.jpg' },
];

const COLORS = [
  'rgba(255, 182, 193, 0.45)',
  'rgba(173, 216, 230, 0.45)',
  'rgba(144, 238, 144, 0.45)',
  'rgba(255, 255, 150, 0.45)',
  'rgba(200, 162, 255, 0.45)',
  'rgba(255, 200, 150, 0.45)',
];

const HIGHLIGHT_COLORS = [
  'rgba(255, 220, 230, 0.7)',
  'rgba(210, 240, 255, 0.7)',
  'rgba(200, 255, 200, 0.7)',
  'rgba(255, 255, 210, 0.7)',
  'rgba(230, 210, 255, 0.7)',
  'rgba(255, 230, 210, 0.7)',
];

const BORDER_COLORS = [
  'rgba(255, 100, 150, 0.7)',
  'rgba(100, 180, 255, 0.7)',
  'rgba(100, 220, 100, 0.7)',
  'rgba(255, 215, 0, 0.7)',
  'rgba(180, 130, 255, 0.7)',
  'rgba(255, 160, 100, 0.7)',
  'rgba(255, 130, 200, 0.7)',
  'rgba(130, 255, 200, 0.7)',
  'rgba(200, 200, 255, 0.7)',
  'rgba(255, 200, 200, 0.7)',
];

export default function BubblePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const nameRevealsRef = useRef<NameReveal[]>([]);
  const scoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const [calmMode, setCalmMode] = useState(false);
  const calmModeRef = useRef(false);
  const nextIdRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);
  const bgStarsRef = useRef<{ x: number; y: number; size: number; twinkleSpeed: number; phase: number }[]>([]);
  const [showInstall, setShowInstall] = useState(false);
  const deferredPromptRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const familyImagesRef = useRef<(HTMLImageElement | null)[]>(FAMILY.map(() => null));
  const imagesLoadedRef = useRef(false);

  // Load all family images
  useEffect(() => {
    if (imagesLoadedRef.current) return;
    imagesLoadedRef.current = true;
    FAMILY.forEach((member, idx) => {
      const img = new Image();
      img.onload = () => { familyImagesRef.current[idx] = img; };
      img.src = `/family/${member.file}`;
    });
  }, []);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playPop = useCallback((isFamily: boolean) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const freq = isFamily ? 600 + Math.random() * 200 : 320 + Math.random() * 480;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(calmModeRef.current ? 0.08 : 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }, [getAudioCtx]);

  const playNameSound = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + 0.6);
      });
    } catch (e) {}
  }, [getAudioCtx]);

  const spawnBubble = useCallback((x?: number, y?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const calm = calmModeRef.current;
    const isFamily = Math.random() < 0.18; // ~18% chance for family bubble
    const familyIdx = isFamily ? Math.floor(Math.random() * FAMILY.length) : -1;
    const size = isFamily ? 70 + Math.random() * 50 : 40 + Math.random() * 70;
    const colorIdx = Math.floor(Math.random() * COLORS.length);
    const bubble: Bubble = {
      id: nextIdRef.current++,
      x: x ?? Math.random() * (canvas.width - size) + size / 2,
      y: y ?? canvas.height + size,
      size,
      color: COLORS[colorIdx],
      speedY: calm ? 0.3 + Math.random() * 0.4 : 0.5 + Math.random() * 0.7,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      familyIdx,
      opacity: 1,
      popping: false,
    };
    bubblesRef.current.push(bubble);
  }, []);

  const spawnSparkles = useCallback((x: number, y: number, isFamily: boolean, familyIdx: number) => {
    const count = isFamily ? 14 : 8;
    const sparkleColor = isFamily
      ? BORDER_COLORS[familyIdx % BORDER_COLORS.length]
      : COLORS[Math.floor(Math.random() * COLORS.length)].replace('0.45', '0.9');
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2 + Math.random() * (isFamily ? 4 : 3);
      sparklesRef.current.push({
        id: nextIdRef.current++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: isFamily ? sparkleColor : COLORS[Math.floor(Math.random() * COLORS.length)].replace('0.45', '0.9'),
        size: isFamily ? 5 : 3,
      });
    }
  }, []);

  const popBubble = useCallback((bubble: Bubble) => {
    if (bubble.popping) return;
    bubble.popping = true;
    const isFamily = bubble.familyIdx >= 0;
    playPop(isFamily);
    spawnSparkles(bubble.x, bubble.y, isFamily, bubble.familyIdx);

    if (isFamily) {
      // Show family member name
      playNameSound();
      nameRevealsRef.current.push({
        name: FAMILY[bubble.familyIdx].name,
        x: bubble.x,
        y: bubble.y,
        opacity: 0,
        scale: 0.3,
        life: 1,
      });
    }

    const pts = isFamily ? 5 : 1;
    if (!calmModeRef.current) {
      scoreRef.current += pts;
      setScore(scoreRef.current);
    }
  }, [playPop, playNameSound, spawnSparkles]);

  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

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
    spawnBubble(x, y);
  }, [popBubble, spawnBubble]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      bgStarsRef.current = Array.from({ length: 40 }, () => ({
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

    let time = 0;
    const loop = () => {
      time++;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const calm = calmModeRef.current;

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0a2e');
      grad.addColorStop(0.5, '#1a1a4e');
      grad.addColorStop(1, '#2d1b69');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Background stars
      bgStarsRef.current.forEach(star => {
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
          if (b.opacity <= 0) { bubbles.splice(i, 1); continue; }
        } else {
          b.y -= b.speedY;
          b.x += Math.sin(time * b.wobbleSpeed + b.wobbleOffset) * 0.5;
          if (b.y < -b.size) { bubbles.splice(i, 1); continue; }
        }

        ctx.save();
        ctx.globalAlpha = b.opacity;

        const isFamily = b.familyIdx >= 0;
        const familyImg = isFamily ? familyImagesRef.current[b.familyIdx] : null;

        if (isFamily && familyImg) {
          // Family photo bubble
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(familyImg, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
          ctx.restore();

          // Colored glow border
          ctx.save();
          ctx.globalAlpha = b.opacity;
          const borderColor = BORDER_COLORS[b.familyIdx % BORDER_COLORS.length];
          const glowAlpha = 0.5 + 0.3 * Math.sin(time * 0.05 + b.familyIdx);
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size / 2 + 3, 0, Math.PI * 2);
          ctx.strokeStyle = borderColor.replace('0.7', String(glowAlpha));
          ctx.lineWidth = 3;
          ctx.shadowColor = borderColor;
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        } else if (isFamily) {
          // Family bubble without loaded image — show initial
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
          ctx.strokeStyle = BORDER_COLORS[b.familyIdx % BORDER_COLORS.length];
          ctx.lineWidth = 2;
          ctx.stroke();
          // Initial letter
          ctx.font = `600 ${b.size * 0.4}px Fredoka, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(FAMILY[b.familyIdx].name[0], b.x, b.y);
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
          ctx.strokeStyle = b.color.replace('0.45', '0.2');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Sparkles
      const sparkles = sparklesRef.current;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx; s.y += s.vy; s.vy += 0.05; s.life -= 0.025;
        if (s.life <= 0) { sparkles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = s.life;
        const spikes = 4;
        const outerR = s.size;
        const innerR = s.size * 0.4;
        ctx.beginPath();
        for (let j = 0; j < spikes * 2; j++) {
          const r = j % 2 === 0 ? outerR : innerR;
          const angle = (j * Math.PI) / spikes - Math.PI / 2;
          const sx = s.x + Math.cos(angle) * r;
          const sy = s.y + Math.sin(angle) * r;
          if (j === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.restore();
      }

      // Name reveals (floating up from popped family bubbles)
      const reveals = nameRevealsRef.current;
      for (let i = reveals.length - 1; i >= 0; i--) {
        const nr = reveals[i];
        if (nr.opacity < 1 && nr.life > 0.5) {
          nr.opacity = Math.min(1, nr.opacity + 0.05);
          nr.scale = Math.min(1, nr.scale + 0.04);
        }
        nr.y -= 0.8; // float up
        nr.life -= 0.006;
        if (nr.life < 0.3) {
          nr.opacity = Math.max(0, nr.opacity - 0.02);
        }
        if (nr.life <= 0 || nr.opacity <= 0) {
          reveals.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = nr.opacity;
        ctx.font = `600 ${36 * nr.scale}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(nr.name, nr.x, nr.y);
        ctx.shadowBlur = 30;
        ctx.fillText(nr.name, nr.x, nr.y);
        ctx.restore();
      }

      // Score badge
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scoreText, w / 2, by + bh / 2);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

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

  useEffect(() => { calmModeRef.current = calmMode; }, [calmMode]);

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      await deferredPromptRef.current.userChoice;
      setShowInstall(false);
      deferredPromptRef.current = null;
    }
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    pointerEvents: 'auto',
    background: active ? 'rgba(100, 200, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)',
    border: `1px solid ${active ? 'rgba(100, 200, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
    borderRadius: 22,
    padding: '10px 18px',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontFamily: 'Fredoka, sans-serif',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, touchAction: 'none', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      <div style={{
        position: 'fixed', bottom: 16, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 10, zIndex: 10, pointerEvents: 'none', flexWrap: 'wrap', padding: '0 10px',
      }}>
        <button onClick={() => setCalmMode(!calmMode)} style={btnStyle(calmMode)}>
          {calmMode ? '🌙 Calma' : '✨ Normal'}
        </button>

        {showInstall && (
          <button onClick={handleInstall} style={{ ...btnStyle(), background: 'rgba(100, 255, 150, 0.2)', border: '1px solid rgba(100, 255, 150, 0.4)' }}>
            📲 Instalar App
          </button>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 2, right: 8,
        color: 'rgba(255,255,255,0.2)', fontSize: 10,
        fontFamily: 'Fredoka, sans-serif', zIndex: 10, pointerEvents: 'none',
      }}>
        Hecho por duendes.app 2026
      </div>
    </div>
  );
}

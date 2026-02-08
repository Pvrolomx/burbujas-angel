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

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
}

interface NameReveal {
  name: string;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  life: number;
}

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

const STAR_COLORS = [
  'rgba(255, 255, 255, 1)',
  'rgba(200, 220, 255, 1)',
  'rgba(255, 240, 200, 1)',
  'rgba(200, 255, 255, 1)',
  'rgba(255, 200, 255, 1)',
];

const FAMILY_NAMES = ['Angel', 'Tia Chely', 'Tia Jessy', 'Diana', 'Hector', 'Israel'];
const NAME_THRESHOLDS = [10, 20, 35, 50, 70, 90];

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
  const bgStarsRef = useRef<{ x: number; y: number; size: number; twinkleSpeed: number; phase: number }[]>([]);
  const [showInstall, setShowInstall] = useState(false);
  const deferredPromptRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Star mode
  const [starMode, setStarMode] = useState(false);
  const starModeRef = useRef(false);
  const userStarsRef = useRef<Star[]>([]);
  const starClickCountRef = useRef(0);
  const nameRevealsRef = useRef<NameReveal[]>([]);
  const revealedNamesRef = useRef<Set<number>>(new Set());

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

  const playStarSound = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      const freq = 800 + Math.random() * 600;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }, [getAudioCtx]);

  const playNameRevealSound = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + 0.8);
      });
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

  const spawnUserStars = useCallback((x: number, y: number) => {
    const count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 60;
      userStarsRef.current.push({
        id: nextIdRef.current++,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        size: 1.5 + Math.random() * 3,
        twinkleSpeed: 0.01 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      });
    }
    if (userStarsRef.current.length > 500) {
      userStarsRef.current = userStarsRef.current.slice(-500);
    }
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

  const handleInteraction = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (starModeRef.current) {
      spawnUserStars(x, y);
      playStarSound();
      starClickCountRef.current++;
      const clickCount = starClickCountRef.current;
      for (let i = 0; i < NAME_THRESHOLDS.length; i++) {
        if (clickCount === NAME_THRESHOLDS[i] && !revealedNamesRef.current.has(i)) {
          revealedNamesRef.current.add(i);
          nameRevealsRef.current.push({
            name: FAMILY_NAMES[i],
            x: canvas.width / 2,
            y: canvas.height / 2,
            opacity: 0,
            scale: 0.5,
            life: 1,
          });
          playNameRevealSound();
        }
      }
      return;
    }

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
  }, [popBubble, spawnBubble, spawnUserStars, playStarSound, playNameRevealSound]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      bgStarsRef.current = Array.from({ length: 50 }, () => ({
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
      const inStarMode = starModeRef.current;

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      if (inStarMode) {
        grad.addColorStop(0, '#050520');
        grad.addColorStop(0.5, '#0a0a30');
        grad.addColorStop(1, '#15103a');
      } else {
        grad.addColorStop(0, '#0a0a2e');
        grad.addColorStop(0.5, '#1a1a4e');
        grad.addColorStop(1, '#2d1b69');
      }
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

      if (inStarMode) {
        // User stars
        userStarsRef.current.forEach(star => {
          const alpha = 0.4 + 0.6 * Math.abs(Math.sin(time * star.twinkleSpeed + star.phase));
          ctx.save();
          ctx.globalAlpha = alpha;
          const spikes = 4;
          const outerR = star.size;
          const innerR = star.size * 0.4;
          ctx.beginPath();
          for (let j = 0; j < spikes * 2; j++) {
            const r = j % 2 === 0 ? outerR : innerR;
            const angle = (j * Math.PI) / spikes - Math.PI / 2 + time * 0.005;
            const sx = star.x + Math.cos(angle) * r;
            const sy = star.y + Math.sin(angle) * r;
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fillStyle = star.color;
          ctx.shadowColor = star.color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.restore();
        });

        // Name reveals
        const reveals = nameRevealsRef.current;
        for (let i = reveals.length - 1; i >= 0; i--) {
          const nr = reveals[i];
          if (nr.opacity < 1 && nr.life > 0.5) {
            nr.opacity = Math.min(1, nr.opacity + 0.03);
            nr.scale = Math.min(1, nr.scale + 0.02);
          }
          nr.life -= 0.004;
          if (nr.life < 0.3) {
            nr.opacity = Math.max(0, nr.opacity - 0.015);
            nr.y -= 0.3;
          }
          if (nr.life <= 0 || nr.opacity <= 0) {
            reveals.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = nr.opacity;
          ctx.font = `600 ${48 * nr.scale}px Fredoka, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
          ctx.shadowBlur = 20;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillText(nr.name, nr.x, nr.y);
          ctx.shadowBlur = 40;
          ctx.fillText(nr.name, nr.x, nr.y);
          ctx.restore();
        }

        // Star counter badge
        const starCount = userStarsRef.current.length;
        const clickCount = starClickCountRef.current;
        const nextIdx = NAME_THRESHOLDS.findIndex((t, i) => !revealedNamesRef.current.has(i));
        const nextThreshold = nextIdx >= 0 ? NAME_THRESHOLDS[nextIdx] : null;
        let badgeText = `⭐ ${starCount} estrellas`;
        if (nextThreshold) {
          badgeText += `  ·  ${clickCount}/${nextThreshold} ✨`;
        } else if (revealedNamesRef.current.size === FAMILY_NAMES.length) {
          badgeText += `  ·  ¡Familia completa! 💫`;
        }
        ctx.save();
        ctx.font = '600 20px Fredoka, sans-serif';
        const metrics = ctx.measureText(badgeText);
        const pw = 16;
        const bw = metrics.width + pw * 2;
        const bh = 40;
        const bx = w / 2 - bw / 2;
        const by = 16;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, w / 2, by + bh / 2);
        ctx.restore();

      } else {
        // BUBBLE MODE
        const spawnInterval = calm ? 1200 : 600;
        if (time - lastSpawnRef.current > spawnInterval / 16.67 && bubblesRef.current.filter(b => !b.popping).length < 35) {
          spawnBubble();
          lastSpawnRef.current = time;
        }

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

          if (b.isSpecial && photoRef.current) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(photoRef.current, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = b.opacity;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size / 2 + 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.3 * Math.sin(time * 0.05)})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
            ctx.shadowBlur = 15;
            ctx.stroke();
          } else if (b.isSpecial) {
            const radGrad = ctx.createRadialGradient(b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.05, b.x, b.y, b.size / 2);
            radGrad.addColorStop(0, 'rgba(255, 240, 200, 0.6)');
            radGrad.addColorStop(1, 'rgba(255, 215, 0, 0.3)');
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = radGrad;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + 0.3 * Math.sin(time * 0.05)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = `${b.size * 0.5}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('😊', b.x, b.y);
          } else {
            const colorIdx = COLORS.indexOf(b.color);
            const radGrad = ctx.createRadialGradient(b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.05, b.x, b.y, b.size / 2);
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
  useEffect(() => { starModeRef.current = starMode; }, [starMode]);

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
        {!starMode && (
          <button onClick={() => setCalmMode(!calmMode)} style={btnStyle(calmMode)}>
            {calmMode ? '🌙 Calma' : '✨ Normal'}
          </button>
        )}

        <button onClick={() => setStarMode(!starMode)} style={btnStyle(starMode)}>
          {starMode ? '🫧 Burbujas' : '🌟 Estrellas'}
        </button>

        {!starMode && (
          <label style={btnStyle()}>
            {photo ? '📷 Cambiar foto' : '📷 Subir foto'}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          </label>
        )}

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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, ShieldCheck, Skull, Zap } from 'lucide-react';
import { 
  Entity, 
  Bullet, 
  Obstacle, 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  TANK_SIZE, 
  TANK_SPEED, 
  BULLET_SPEED, 
  FIRE_RATE 
} from './types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'naming' | 'start' | 'playing' | 'gameover' | 'victory'>('naming');
  const [playerName, setPlayerName] = useState('');
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState({ good: 9, enemies: 10 });
  const [score, setScore] = useState(0);

  // Game state refs to avoid re-renders during loop
  const playerRef = useRef<Entity | null>(null);
  const goodTanksRef = useRef<Entity[]>([]);
  const enemiesRef = useRef<Entity[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());

  const initGame = (targetLevel: number) => {
    setLevel(targetLevel);
    
    // Level-based difficulty scaling
    const difficultyMult = 1 + (targetLevel - 1) * 0.15;
    const obstacleCount = 10 + Math.min(targetLevel * 2, 20); // More obstacles each level
    
    // Random Obstacle Generation (Increasingly complex)
    const obstacles: Obstacle[] = [];
    for (let i = 0; i < obstacleCount; i++) {
        const isVertical = Math.random() > 0.4;
        const width = isVertical ? 25 : 80 + Math.random() * 120;
        const height = isVertical ? 80 + Math.random() * 120 : 25;
        
        // Avoid spawning areas
        const x = 50 + Math.random() * (GAME_WIDTH - 150);
        const y = 120 + Math.random() * (GAME_HEIGHT - 240);
        
        obstacles.push({ x, y, width, height });
    }
    obstaclesRef.current = obstacles;

    // Player
    playerRef.current = {
      id: 'player',
      x: 50,
      y: GAME_HEIGHT - 50,
      rotation: -Math.PI / 2,
      targetRotation: -Math.PI / 2,
      type: 'player',
      health: 200,
      lastShot: 0,
    };

    // Good Tanks
    const goodTanks: Entity[] = [];
    for (let i = 0; i < 8; i++) {
      goodTanks.push({
        id: `good-${i}`,
        x: 120 + i * 80,
        y: GAME_HEIGHT - 50,
        rotation: -Math.PI / 2,
        targetRotation: -Math.PI / 2,
        type: 'good',
        health: 150,
        lastShot: 0,
      });
    }
    goodTanksRef.current = goodTanks;

    // Enemies (Scaling health and numbers slightly)
    const enemies: Entity[] = [];
    const enemyCount = 10;
    for (let i = 0; i < enemyCount; i++) {
      enemies.push({
        id: `enemy-${i}`,
        x: 100 + (i * 85),
        y: 60,
        rotation: Math.PI / 2,
        targetRotation: Math.PI / 2,
        type: 'enemy',
        health: 150 * difficultyMult,
        lastShot: 0,
      });
    }
    enemiesRef.current = enemies;
    bulletsRef.current = [];
    
    setStats({ good: 9, enemies: enemyCount });
    if (targetLevel === 1) setScore(0);
    setGameState('playing');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;

    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      if (gameState !== 'playing') return;

      const player = playerRef.current;
      if (player) {
        // Player Movement
        if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) {
          player.x += Math.cos(player.rotation) * TANK_SPEED;
          player.y += Math.sin(player.rotation) * TANK_SPEED;
          checkCol(player);
        }
        if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) {
          player.x -= Math.cos(player.rotation) * TANK_SPEED;
          player.y -= Math.sin(player.rotation) * TANK_SPEED;
          checkCol(player);
        }
        if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) {
          player.rotation -= 0.05;
        }
        if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) {
          player.rotation += 0.05;
        }

        // Shooting
        if (keysRef.current.has('Space')) {
          const now = Date.now();
          if (now - player.lastShot > FIRE_RATE) {
            bulletsRef.current.push({
              id: Math.random().toString(),
              x: player.x + Math.cos(player.rotation) * 20,
              y: player.y + Math.sin(player.rotation) * 20,
              dx: Math.cos(player.rotation) * BULLET_SPEED,
              dy: Math.sin(player.rotation) * BULLET_SPEED,
              ownerType: 'player'
            });
            player.lastShot = now;
          }
        }
      }

      // AI for allies and enemies
      [...goodTanksRef.current, ...enemiesRef.current].forEach(tank => {
        // Find nearest opponent
        const opponents = tank.type === 'good' ? enemiesRef.current : (playerRef.current ? [playerRef.current, ...goodTanksRef.current] : goodTanksRef.current);
        
        let nearestOpponent: Entity | null = null;
        let minDist = Infinity;
        
        opponents.forEach(opp => {
          const d = Math.sqrt((tank.x - opp.x)**2 + (tank.y - opp.y)**2);
          if (d < minDist) {
            minDist = d;
            nearestOpponent = opp;
          }
        });

        // Simple AI: Aim at nearest opponent if within range, otherwise move randomly
        if (nearestOpponent && minDist < 600) { // Increased detection range for both
          const targetAngle = Math.atan2(nearestOpponent.y - tank.y, nearestOpponent.x - tank.x);
          tank.targetRotation = targetAngle;
        } else if (Math.random() < 0.01) {
          tank.targetRotation = Math.random() * Math.PI * 2;
        }
        
        // Rotation smoothing - Both categories now more agile
        const rotationSpeed = tank.type === 'good' ? 0.08 : 0.07;
        const diff = (tank.targetRotation - tank.rotation + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        tank.rotation += diff * rotationSpeed;

        // Only move if not very close to target or if moving randomly
        const moveSpeed = tank.type === 'good' ? TANK_SPEED * 0.8 : TANK_SPEED * 0.75;
        if (minDist > 100) {
          tank.x += Math.cos(tank.rotation) * moveSpeed;
          tank.y += Math.sin(tank.rotation) * moveSpeed;
        }
        
        if (checkCol(tank)) {
          tank.targetRotation = Math.random() * Math.PI * 2;
        }

        // AI Shooting
        const now = Date.now();
        // Enemies now also shoot more aggressively
        const shootChance = tank.type === 'good' ? 0.3 : 0.2;
        const shootDelay = tank.type === 'good' ? FIRE_RATE * 1.0 : FIRE_RATE * 1.5;

        if (now - tank.lastShot > shootDelay && Math.random() < shootChance && Math.abs(diff) < 0.25) {
          bulletsRef.current.push({
            id: Math.random().toString(),
            x: tank.x + Math.cos(tank.rotation) * 25,
            y: tank.y + Math.sin(tank.rotation) * 25,
            dx: Math.cos(tank.rotation) * BULLET_SPEED,
            dy: Math.sin(tank.rotation) * BULLET_SPEED,
            ownerType: tank.type
          });
          tank.lastShot = now;
        }
      });

      // Update Bullets
      bulletsRef.current = bulletsRef.current.filter(bullet => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // Wall collisions
        if (bullet.x < 0 || bullet.x > GAME_WIDTH || bullet.y < 0 || bullet.y > GAME_HEIGHT) return false;
        
        // Obstacle collisions
        for (const obs of obstaclesRef.current) {
          if (bullet.x > obs.x && bullet.x < obs.x + obs.width && bullet.y > obs.y && bullet.y < obs.y + obs.height) return false;
        }

        // Hit detection
        let hit = false;
        const allTanks = player ? [player, ...goodTanksRef.current, ...enemiesRef.current] : [...goodTanksRef.current, ...enemiesRef.current];
        
        for (const tank of allTanks) {
          if (bullet.ownerType === 'player' && (tank.type === 'player' || tank.type === 'good')) continue;
          if (bullet.ownerType === 'good' && (tank.type === 'player' || tank.type === 'good')) continue;
          if (bullet.ownerType === 'enemy' && tank.type === 'enemy') continue;

          const dist = Math.sqrt((bullet.x - tank.x)**2 + (bullet.y - tank.y)**2);
          if (dist < TANK_SIZE / 2) {
            // Damage calculation: Allies deal 40, Enemies deal 35 (up from 25)
            const damage = (bullet.ownerType === 'player' || bullet.ownerType === 'good') ? 40 : 35;
            tank.health -= damage;
            hit = true;
            if (bullet.ownerType === 'player') setScore(s => s + 10);
            break;
          }
        }

        return !hit;
      });

      // Cleanup dead tanks
      const preEnemies = enemiesRef.current.length;
      enemiesRef.current = enemiesRef.current.filter(t => t.health > 0);
      goodTanksRef.current = goodTanksRef.current.filter(t => t.health > 0);
      if (playerRef.current && playerRef.current.health <= 0) {
        playerRef.current = null;
        setGameState('gameover');
      }

      setStats({
        good: (playerRef.current ? 1 : 0) + goodTanksRef.current.length,
        enemies: enemiesRef.current.length
      });

      if (enemiesRef.current.length === 0) setGameState('victory');

      draw();
      animationId = requestAnimationFrame(update);
    };

    const checkCol = (tank: Entity) => {
      let collided = false;
      // Boundaries
      if (tank.x < TANK_SIZE/2) { tank.x = TANK_SIZE/2; collided = true; }
      if (tank.x > GAME_WIDTH - TANK_SIZE/2) { tank.x = GAME_WIDTH - TANK_SIZE/2; collided = true; }
      if (tank.y < TANK_SIZE/2) { tank.y = TANK_SIZE/2; collided = true; }
      if (tank.y > GAME_HEIGHT - TANK_SIZE/2) { tank.y = GAME_HEIGHT - TANK_SIZE/2; collided = true; }

      // Obstacles
      for (const obs of obstaclesRef.current) {
        if (tank.x + 15 > obs.x && tank.x - 15 < obs.x + obs.width && 
            tank.y + 15 > obs.y && tank.y - 15 < obs.y + obs.height) {
          collided = true;
          // Simple push out
          const dx = tank.x - (obs.x + obs.width/2);
          const dy = tank.y - (obs.y + obs.height/2);
          if (Math.abs(dx) > Math.abs(dy)) {
            tank.x = dx > 0 ? obs.x + obs.width + 16 : obs.x - 16;
          } else {
            tank.y = dy > 0 ? obs.y + obs.height + 16 : obs.y - 16;
          }
        }
      }
      return collided;
    };

    const draw = () => {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Grid
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      for (let i = 0; i < GAME_WIDTH; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); ctx.stroke();
      }
      for (let i = 0; i < GAME_HEIGHT; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); ctx.stroke();
      }

      // Obstacles
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      obstaclesRef.current.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      });

      // Bullets
      ctx.fillStyle = '#fde047';
      bulletsRef.current.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Tanks
      const drawTank = (tank: Entity) => {
        ctx.save();
        ctx.translate(tank.x, tank.y);
        ctx.rotate(tank.rotation);

        // Color based on type
        const color = tank.type === 'player' ? '#22c55e' : (tank.type === 'good' ? '#4ade80' : '#ef4444');
        const secondary = tank.type === 'player' ? '#166534' : (tank.type === 'good' ? '#14532d' : '#7f1d1d');

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(-15, -15, 30, 30);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);

        // Turret
        ctx.fillStyle = secondary;
        ctx.fillRect(0, -4, 20, 8);
        ctx.strokeRect(0, -4, 20, 8);
        
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Health bar
        ctx.restore();
        ctx.fillStyle = '#333';
        ctx.fillRect(tank.x - 15, tank.y - 25, 30, 4);
        ctx.fillStyle = color;
        ctx.fillRect(tank.x - 15, tank.y - 25, 30 * (tank.health / 100), 4);
      };

      if (playerRef.current) drawTank(playerRef.current);
      goodTanksRef.current.forEach(drawTank);
      enemiesRef.current.forEach(drawTank);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  return (
    <div className="game-container bg-zinc-950 font-sans h-screen w-screen flex flex-col items-center justify-center p-4">
      {/* HUD */}
      <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none z-10">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 p-3 rounded-xl shadow-lg">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">O'YINCHI</p>
              <p className="text-xl font-mono font-bold text-blue-400">{playerName.toUpperCase() || 'ASKAR'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 p-3 rounded-xl shadow-lg">
            <div className="bg-yellow-500/20 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">BOSQICH</p>
              <p className="text-xl font-mono font-bold text-yellow-400">{level}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 p-3 rounded-xl">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Yaxshilar</p>
              <p className="text-xl font-mono font-bold text-green-400">{stats.good} / 9</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 p-3 rounded-xl">
            <div className="bg-red-500/20 p-2 rounded-lg">
              <Skull className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Dushmanlar</p>
              <p className="text-xl font-mono font-bold text-red-400">{stats.enemies} / 10</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-4 rounded-xl flex flex-col items-center">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">BALL</p>
          <p className="text-3xl font-mono font-bold text-yellow-400 tabular-nums">
            {score.toString().padStart(6, '0')}
          </p>
        </div>
      </div>

      <div className="relative border-4 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 bg-black">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="max-h-[80vh] w-auto aspect-[1000/800]"
        />

        <AnimatePresence>
          {gameState === 'naming' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-50"
            >
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl max-w-md w-full">
                <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-6 tracking-tight">ISMINGIZNI KIRITING</h2>
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Sizning ismingiz..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 mb-6 focus:border-yellow-400 outline-none transition-all text-center text-xl font-medium"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && playerName.trim() && setGameState('start')}
                />
                <button 
                  disabled={!playerName.trim()}
                  onClick={() => setGameState('start')}
                  className="w-full bg-yellow-400 disabled:bg-zinc-700 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl hover:scale-105 active:scale-95 transition-all text-lg"
                >
                  TASDIQLASH
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'start' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <Zap className="w-16 h-16 text-yellow-400 mb-6" />
              <h2 className="text-2xl text-yellow-500 font-mono mb-2">XUSH KELIBSiz, {playerName.toUpperCase()}!</h2>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">TANKLAR MAYDONI</h1>
              <p className="text-zinc-400 max-w-md mb-8 text-lg">
                Yashil tanklarni boshqarib dushmanni yo'q qiling. To'siqlardan foydalaning!
              </p>
              <button 
                onClick={() => initGame(1)}
                className="bg-zinc-100 text-zinc-950 px-10 py-4 rounded-full font-bold text-xl hover:scale-105 active:scale-95 transition-transform flex items-center gap-3"
              >
                O'yinni Boshlash
              </button>
              <div className="mt-8 grid grid-cols-2 gap-4 text-xs font-mono text-zinc-500">
                <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-300">WASD / ARROWS</span><br/>Harakat
                </div>
                <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-300">SPACE</span><br/>O'q uzish
                </div>
              </div>
            </motion.div>
          )}

          {(gameState === 'gameover' || gameState === 'victory') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              {gameState === 'victory' ? (
                <>
                  <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6 border-4 border-yellow-500/50">
                    <Trophy className="w-12 h-12 text-yellow-400" />
                  </div>
                  <h2 className="text-5xl font-bold text-yellow-400 mb-2">{level}-BOSQICH YENGILDI!</h2>
                  <p className="text-zinc-400 mb-8">Keyingi bosqich yanada murakkab bo'ladi.</p>
                  
                  <button 
                    onClick={() => initGame(level + 1)}
                    className="bg-yellow-400 text-zinc-950 px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 mb-4"
                  >
                    <Zap className="w-5 h-5" />
                    Keyingi Bosqich
                  </button>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border-4 border-red-500/50">
                    <Skull className="w-12 h-12 text-red-500" />
                  </div>
                  <h2 className="text-5xl font-bold text-red-500 mb-2">MAG'LUBIYAT</h2>
                  <p className="text-zinc-400 mb-8">{level}-bosqichda to'xtadingiz...</p>
                  
                  <button 
                    onClick={() => initGame(1)}
                    className="bg-zinc-100 text-zinc-950 px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 mb-4"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Qayta Boshlash
                  </button>
                </>
              )}

              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-8">
                <p className="text-[10px] uppercase font-bold text-zinc-500 mb-2">YAKUNIY BALL</p>
                <p className="text-4xl font-mono font-bold text-zinc-100">{score}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 text-zinc-600 text-[10px] uppercase tracking-[0.2em] font-bold">
        Tank Battle Engine v1.0 • AI-Powered Bots
      </div>
    </div>
  );
}

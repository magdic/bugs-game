import { gameState } from './GameState.js';
import { generateUUID } from './utils.js';

export class BugController {
    constructor(roomManager) {
        this.roomManager = roomManager;
        this.bugs = {};
        this.lastSync = 0;
        this.totalBugs = 100;

        if (gameState.isHost) {
            this.initBugs();
        }
    }

    initBugs() {
        // Start all bugs outside (free) initially based on rules,
        // but we need wolves to appear until we have 50/50 inside/outside.
        // Let's start with 50 inside, 50 outside.
        for (let i = 0; i < this.totalBugs; i++) {
            const id = generateUUID();
            const isFree = i < 50;
            this.bugs[id] = {
                id,
                x: isFree ? Math.random() * window.innerWidth : window.innerWidth / 2,
                y: isFree ? Math.random() * window.innerHeight : window.innerHeight / 2,
                isFree,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                aggressive: true // Free bugs are aggressive
            };
        }
        gameState.bugs = this.bugs;
    }

    update(dt) {
        if (!gameState.isHost || gameState.status !== 'playing') return;

        const now = Date.now();
        let bugsChanged = false;

        for (const id in this.bugs) {
            const bug = this.bugs[id];

            if (bug.isFree) {
                // Fly randomly or chase lumberjacks
                let targetLumberjack = null;
                let minDist = 200; // aggro radius

                if (bug.aggressive) {
                    for (const pid in gameState.players) {
                        const p = gameState.players[pid];
                        if (p.role === 'lumberjack' && p.state === 'active') {
                            const dist = Math.hypot(p.x - bug.x, p.y - bug.y);
                            if (dist < minDist) {
                                minDist = dist;
                                targetLumberjack = p;
                            }
                        }
                    }
                }

                if (targetLumberjack) {
                    const dx = targetLumberjack.x - bug.x;
                    const dy = targetLumberjack.y - bug.y;
                    const len = Math.hypot(dx, dy);
                    bug.vx = (dx / len) * 3;
                    bug.vy = (dy / len) * 3;

                    // Attack
                    if (minDist < 20) {
                        targetLumberjack.health -= 0.5; // Damage per frame
                    }
                } else {
                    // Random wander
                    if (Math.random() < 0.05) {
                        bug.vx += (Math.random() - 0.5);
                        bug.vy += (Math.random() - 0.5);
                        // clamp speed
                        const speed = Math.hypot(bug.vx, bug.vy);
                        if (speed > 4) {
                            bug.vx = (bug.vx / speed) * 4;
                            bug.vy = (bug.vy / speed) * 4;
                        }
                    }
                }

                bug.x += bug.vx;
                bug.y += bug.vy;

                // Bounce off walls
                if (bug.x < 0 || bug.x > window.innerWidth) bug.vx *= -1;
                if (bug.y < 0 || bug.y > window.innerHeight) bug.vy *= -1;

                bug.x = Math.max(0, Math.min(window.innerWidth, bug.x));
                bug.y = Math.max(0, Math.min(window.innerHeight, bug.y));

                // Catch bugs (Lumberjacks with light)
                for (const pid in gameState.players) {
                    const p = gameState.players[pid];
                    if (p.role === 'lumberjack' && p.lightActive) {
                        const dist = Math.hypot(p.x - bug.x, p.y - bug.y);
                        if (dist < 100) { // light radius
                            bug.isFree = false;
                            bug.x = window.innerWidth / 2; // Move to cabin
                            bug.y = window.innerHeight / 2;
                            gameState.score.lumberjacks += 1;
                            bugsChanged = true;
                        }
                    }
                }

            } else {
                // Bug is in cabin
                // Check if wolf frees it
                const cabinX = window.innerWidth / 2;
                const cabinY = window.innerHeight / 2 + 100; // Door
                for (const pid in gameState.players) {
                    const p = gameState.players[pid];
                    if (p.role === 'wolf' && p.state === 'active') {
                        const distToDoor = Math.hypot(p.x - cabinX, p.y - cabinY);
                        if (distToDoor < 50 && Math.random() < 0.05) { // Slow release
                            bug.isFree = true;
                            bug.aggressive = true;
                            bug.x = cabinX;
                            bug.y = cabinY;
                            bug.vx = (Math.random() - 0.5) * 4;
                            bug.vy = Math.random() * 4; // emerge outwards
                            gameState.score.wolves += 1;
                            bugsChanged = true;
                        }

                        // Wolf teleportation logic: if lumberjack shines light on wolf near cabin
                        for (const lpid in gameState.players) {
                            const lp = gameState.players[lpid];
                            if (lp.role === 'lumberjack' && lp.lightActive) {
                                const distL2W = Math.hypot(lp.x - p.x, lp.y - p.y);
                                if (distL2W < 100) { // Hit by light
                                    // Teleport wolf far away
                                    p.x = Math.random() > 0.5 ? 50 : window.innerWidth - 50;
                                    p.y = Math.random() > 0.5 ? 50 : window.innerHeight - 50;
                                    p.state = 'paused';
                                    // Hacky way to set pause for remote clients: host dictates it
                                    // They will resync their own paused state based on health, but we can force move them.
                                    this.roomManager.channel.send({
                                        type: 'broadcast',
                                        event: 'teleport',
                                        payload: { id: pid, x: p.x, y: p.y }
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Sync bugs periodically or if state changed significantly
        if (now - this.lastSync > 50 || bugsChanged) {
            this.roomManager.channel.send({
                type: 'broadcast',
                event: 'sync_bugs',
                payload: { bugs: this.bugs, score: gameState.score }
            });
            this.lastSync = now;
        }
    }
}

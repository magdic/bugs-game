import { gameState } from './GameState.js';
import { InputManager } from './InputManager.js';

export class PlayerController {
    constructor(roomManager) {
        this.roomManager = roomManager;
        this.input = new InputManager();
        this.speed = 5;
        this.lastSync = 0;

        // abilities
        this.lightActive = false;
        this.lightCooldown = 0; // ms

        // state
        this.pausedUntil = 0;

        this.localPos = {
            x: window.innerWidth / 2 + (Math.random() * 100 - 50),
            y: window.innerHeight / 2 + (Math.random() * 100 - 50)
        };
    }

    update(dt) {
        if (gameState.status !== 'playing' || !gameState.playerId) return;

        const myData = gameState.players[gameState.playerId];
        if (!myData) return;

        const now = Date.now();
        if (now < this.pausedUntil) {
            myData.state = 'paused';
            return;
        } else {
            myData.state = 'active';
        }

        let moved = false;
        let dx = 0;
        let dy = 0;

        if (this.input.isPressed('KeyW') || this.input.isPressed('ArrowUp')) dy -= 1;
        if (this.input.isPressed('KeyS') || this.input.isPressed('ArrowDown')) dy += 1;
        if (this.input.isPressed('KeyA') || this.input.isPressed('ArrowLeft')) dx -= 1;
        if (this.input.isPressed('KeyD') || this.input.isPressed('ArrowRight')) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;

            this.localPos.x += dx * this.speed;
            this.localPos.y += dy * this.speed;

            // Bounds check
            this.localPos.x = Math.max(0, Math.min(window.innerWidth, this.localPos.x));
            this.localPos.y = Math.max(0, Math.min(window.innerHeight, this.localPos.y));

            moved = true;
        }

        // Abilities
        if (myData.role === 'lumberjack') {
            if (this.input.isPressed('Space') && now > this.lightCooldown) {
                this.lightActive = true;
                this.lightCooldown = now + 7000; // 7s cooldown
                setTimeout(() => { this.lightActive = false; }, 3000); // 3s duration
            }

            // Health recovery in river (x < 150)
            if (this.localPos.x < 150 && myData.health < 100) {
                myData.health += 0.5;
                if (myData.health > 100) myData.health = 100;
            }

            if (myData.health <= 0) {
                this.pausedUntil = now + 5000;
                myData.health = 100; // reset health after death pause starts
            }
        } else if (myData.role === 'wolf') {
            // Wolves freeing bugs logic (near cabin door: center, slightly down)
            const cabinX = window.innerWidth / 2;
            const cabinY = window.innerHeight / 2 + 100;
            if (Math.abs(this.localPos.x - cabinX) < 50 && Math.abs(this.localPos.y - cabinY) < 50) {
                // Free a bug (handled by Host or event)
            }
        }

        // Sync to state
        myData.x = this.localPos.x;
        myData.y = this.localPos.y;
        myData.lightActive = this.lightActive;

        if (moved || now - this.lastSync > 100) { // sync every 100ms or on move
            this.roomManager.channel.track(myData);
            this.lastSync = now;
        }
    }
}

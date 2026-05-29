import * as PIXI from 'pixi.js';
import { gameState } from './GameState.js';

export class GameEngine {
    constructor() {
        this.app = new PIXI.Application({
            resizeTo: window,
            backgroundColor: 0x1a2e1c, // Dark woods green
        });
        document.getElementById('app').appendChild(this.app.view);

        this.container = new PIXI.Container();
        this.app.stage.addChild(this.container);

        this.players = {};
        this.bugs = {};

        // Environment
        this.cabin = null;
        this.river = null;

        this.setupEnvironment();
    }

    setupEnvironment() {
        // Draw River (Left side)
        this.river = new PIXI.Graphics();
        this.river.beginFill(0x2a5d84, 0.5); // water color
        this.river.drawRect(0, 0, 150, window.innerHeight * 2);
        this.river.endFill();
        this.container.addChild(this.river);

        // Draw Cabin (Center)
        this.cabin = new PIXI.Graphics();
        this.cabin.beginFill(0x5c4033); // brown wood
        this.cabin.drawRect(-100, -100, 200, 200);
        this.cabin.endFill();

        // Cabin Door
        this.cabin.beginFill(0x3a2013);
        this.cabin.drawRect(-30, 100, 60, 20); // bottom door
        this.cabin.endFill();

        this.cabin.x = window.innerWidth / 2;
        this.cabin.y = window.innerHeight / 2;
        this.container.addChild(this.cabin);

        // Some trees
        for(let i=0; i<30; i++) {
            const tree = new PIXI.Graphics();
            tree.beginFill(0x0e2411); // dark tree
            tree.drawCircle(0, 0, Math.random() * 20 + 20);
            tree.endFill();
            tree.x = Math.random() * window.innerWidth;
            tree.y = Math.random() * window.innerHeight;

            // avoid cabin
            if (Math.abs(tree.x - this.cabin.x) < 150 && Math.abs(tree.y - this.cabin.y) < 150) continue;
            this.container.addChild(tree);
        }
    }

    initPlayers() {
        for (const id in gameState.players) {
            this.addPlayer(id, gameState.players[id]);
        }
    }

    addPlayer(id, data) {
        const p = new PIXI.Container();

        const body = new PIXI.Graphics();
        if (data.role === 'lumberjack') {
            body.beginFill(0xffaa00); // orange
            body.drawCircle(0, 0, 15);
        } else {
            body.beginFill(0x555555); // grey
            body.drawCircle(0, 0, 15);
        }
        body.endFill();
        p.addChild(body);

        const name = new PIXI.Text(data.name, { fill: 0xffffff, fontSize: 12 });
        name.anchor.set(0.5);
        name.y = -25;
        p.addChild(name);

        if (data.role === 'lumberjack') {
            const hpBg = new PIXI.Graphics();
            hpBg.beginFill(0xff0000);
            hpBg.drawRect(-15, -40, 30, 5);
            hpBg.endFill();

            const hpFg = new PIXI.Graphics();
            hpFg.beginFill(0x00ff00);
            hpFg.drawRect(-15, -40, 30, 5);
            hpFg.endFill();

            p.addChild(hpBg);
            p.addChild(hpFg);
            p.hpFg = hpFg;
        }

        const light = new PIXI.Graphics();
        light.beginFill(0xffff00, 0.3);
        light.drawCircle(0, 0, 100);
        light.endFill();
        light.visible = false;
        p.addChildAt(light, 0);
        p.light = light;

        // Random start position
        p.x = Math.random() * window.innerWidth;
        p.y = Math.random() * window.innerHeight;

        this.container.addChild(p);
        this.players[id] = p;
    }

    updatePlayerState(id, data) {
        if (!this.players[id]) {
            this.addPlayer(id, data);
        }
        const p = this.players[id];
        // simple interpolation or direct set
        p.x = data.x;
        p.y = data.y;

        if (data.role === 'lumberjack' && p.hpFg) {
            p.hpFg.width = 30 * (data.health / 100);
        }
        if (p.light) p.light.visible = !!data.lightActive;
        p.alpha = data.state === "paused" ? 0.5 : 1.0;
    }


    update(dt) {
        // sync bugs visually
        for (const id in gameState.bugs) {
            const bugData = gameState.bugs[id];
            if (!this.bugs[id]) {
                const b = new PIXI.Graphics();
                b.beginFill(0x00ffff); // cyan bug
                b.drawCircle(0, 0, 3);
                b.endFill();
                this.container.addChild(b);
                this.bugs[id] = b;
            }
            const b = this.bugs[id];
            b.x = bugData.x;
            b.y = bugData.y;
            b.visible = bugData.isFree;
            if (bugData.aggressive) {
                b.tint = 0xff0000; // red if aggressive
            } else {
                b.tint = 0xffffff;
            }
        }
    }

}

import Player from './Player.js';
import Renderer from './Renderer.js';
import Network from './Network.js';

class Game {
    constructor() {
        this.renderer = new Renderer('gameCanvas');
        this.network = new Network();

        // Generate a random ID for this session
        this.localPlayerId = 'player_' + Math.random().toString(36).substr(2, 9);

        // Assign a random team (for boilerplate purposes)
        const team = Math.random() > 0.5 ? 'red' : 'blue';
        const startX = team === 'red' ? 100 : 700;
        const startY = 300;

        this.localPlayer = new Player(this.localPlayerId, startX, startY, team);

        this.otherPlayers = {};
        this.bugs = {};
        this.gameState = { redScore: 0, blueScore: 0 };

        this.keys = {};

        this.lastUpdateTime = 0;
        this.networkUpdateInterval = 50; // Sync to server every 50ms

        this.setupInput();
        this.setupNetwork();

        // Initial sync
        this.network.updatePlayerState(this.localPlayer.id, this.localPlayer.getState());

        // Handle disconnect
        window.addEventListener('beforeunload', () => {
            this.network.removePlayer(this.localPlayer.id);
        });

        // Start loop
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    setupNetwork() {
        this.network.callbacks.onGameStateUpdate = (data) => {
            this.gameState = data;
        };

        this.network.callbacks.onPlayersUpdate = (data) => {
            this.otherPlayers = data;

            // Sync specific state back to local player if needed (e.g., carrying count)
            if (data[this.localPlayerId]) {
                this.localPlayer.setState(data[this.localPlayerId]);
            }
        };

        this.network.callbacks.onBugsUpdate = (data) => {
            this.bugs = data;
        };

        this.network.initListeners();
    }

    checkCollisions() {
        // Bug collection logic
        for (const bugId in this.bugs) {
            const bug = this.bugs[bugId];
            const dx = this.localPlayer.x - bug.x;
            const dy = this.localPlayer.y - bug.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.localPlayer.radius + 5) {
                // Collect bug
                this.localPlayer.carryingCount++;
                this.network.removeBug(bugId); // Note: Simple implementation, susceptible to race conditions
            }
        }

        // Base deposit logic
        if (this.localPlayer.team === 'red' && this.localPlayer.x < this.renderer.width / 4) {
            if (this.localPlayer.carryingCount > 0) {
                const newScore = (this.gameState.redScore || 0) + this.localPlayer.carryingCount;
                this.network.updateScore('red', newScore);
                this.localPlayer.carryingCount = 0;
            }
        } else if (this.localPlayer.team === 'blue' && this.localPlayer.x > this.renderer.width * 0.75) {
             if (this.localPlayer.carryingCount > 0) {
                const newScore = (this.gameState.blueScore || 0) + this.localPlayer.carryingCount;
                this.network.updateScore('blue', newScore);
                this.localPlayer.carryingCount = 0;
            }
        }

        // Combat logic would go here
    }

    loop(timestamp) {
        // Update local player position (prediction)
        const moved = this.localPlayer.updatePosition(this.keys, this.renderer.width, this.renderer.height);

        this.checkCollisions();

        // Network sync rate limiting
        if (moved && timestamp - this.lastUpdateTime > this.networkUpdateInterval) {
            this.network.updatePlayerState(this.localPlayer.id, this.localPlayer.getState());
            this.lastUpdateTime = timestamp;
        }

        // Render
        this.renderer.render(this.localPlayer, this.otherPlayers, this.bugs, this.gameState);

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Initialize game when DOM is loaded
window.onload = () => {
    new Game();
};

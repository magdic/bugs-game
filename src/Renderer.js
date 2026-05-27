export default class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    drawBases() {
        // Red Team Base (Left)
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.width / 4, this.height);

        // Blue Team Base (Right)
        this.ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        this.ctx.fillRect(this.width * 0.75, 0, this.width / 4, this.height);

        // Neutral Zone (Center)
        // No fill needed, canvas background handles this

        // Dividing Lines
        this.ctx.strokeStyle = '#555';
        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 4, 0);
        this.ctx.lineTo(this.width / 4, this.height);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.width * 0.75, 0);
        this.ctx.lineTo(this.width * 0.75, this.height);
        this.ctx.stroke();
    }

    drawPlayer(player, isLocal) {
        this.ctx.fillStyle = player.team === 'red' ? '#ff4444' : '#4444ff';
        if (isLocal) {
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
        }

        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
        this.ctx.fill();
        if (isLocal) {
            this.ctx.stroke();
        }

        // Draw carrying count
        if (player.carryingCount > 0) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(player.carryingCount, player.x, player.y);
        }
    }

    drawBug(bug) {
        this.ctx.fillStyle = '#44ff44';
        this.ctx.beginPath();
        this.ctx.arc(bug.x, bug.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawUI(gameState) {
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';

        // Red Score
        this.ctx.fillText(`Red: ${gameState.redScore || 0}`, this.width / 8, 30);

        // Blue Score
        this.ctx.fillText(`Blue: ${gameState.blueScore || 0}`, this.width * 0.875, 30);
    }

    render(localPlayer, otherPlayers, bugs, gameState) {
        this.clear();
        this.drawBases();

        // Draw bugs
        for (const bugId in bugs) {
            this.drawBug(bugs[bugId]);
        }

        // Draw other players
        for (const playerId in otherPlayers) {
            if (playerId !== localPlayer.id) {
                this.drawPlayer(otherPlayers[playerId], false);
            }
        }

        // Draw local player on top
        if (localPlayer) {
            this.drawPlayer(localPlayer, true);
        }

        this.drawUI(gameState);
    }
}

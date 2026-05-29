export class GameState {
    constructor() {
        this.roomCode = null;
        this.playerId = null;
        this.playerName = null;
        this.isHost = false;
        this.players = {}; // { id: { name, role, x, y, health, state } }
        this.bugs = {}; // { id: { x, y, isFree } }
        this.status = 'lobby'; // lobby, playing, finished
        this.score = { wolves: 0, lumberjacks: 0 };
    }
}
export const gameState = new GameState();

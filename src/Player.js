export default class Player {
    constructor(id, x, y, team) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.team = team;
        this.carryingCount = 0;
        this.speed = 5;
        this.radius = 15;
    }

    updatePosition(keys, canvasWidth, canvasHeight) {
        let dx = 0;
        let dy = 0;

        if (keys['ArrowUp'] || keys['w']) dy -= this.speed;
        if (keys['ArrowDown'] || keys['s']) dy += this.speed;
        if (keys['ArrowLeft'] || keys['a']) dx -= this.speed;
        if (keys['ArrowRight'] || keys['d']) dx += this.speed;

        // Diagonal normalization could go here, but omitted for simplicity

        if (dx !== 0 || dy !== 0) {
            this.x += dx;
            this.y += dy;

            // Boundaries
            this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
            this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));

            return true; // Moved
        }
        return false; // Did not move
    }

    getState() {
        return {
            x: this.x,
            y: this.y,
            team: this.team,
            carryingCount: this.carryingCount
        };
    }

    setState(state) {
        // Typically we only update what the server says if we aren't doing strict client prediction
        // For a simple version, we might just update carryingCount or force sync position
        this.carryingCount = state.carryingCount !== undefined ? state.carryingCount : this.carryingCount;

        // In a real game with prediction, you'd handle position sync carefully here
        // this.x = state.x;
        // this.y = state.y;
    }
}

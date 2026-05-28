export default class Player {
    constructor(id, name, gender, team) {
        this.id = id;
        this.name = name;
        this.gender = gender;
        this.team = team;

        // 3D coordinates
        this.x = team === 'red' ? -50 : 50;
        this.y = 0;
        this.z = 0;

        this.speed = 1.0;
        this.radius = 4; // Collision radius roughly matching the funko body
    }

    updatePosition(keys, boundsX, boundsZ) {
        let dx = 0;
        let dz = 0;

        if (keys['ArrowUp'] || keys['w']) dz -= this.speed;
        if (keys['ArrowDown'] || keys['s']) dz += this.speed;
        if (keys['ArrowLeft'] || keys['a']) dx -= this.speed;
        if (keys['ArrowRight'] || keys['d']) dx += this.speed;

        // Diagonal normalization
        if (dx !== 0 && dz !== 0) {
            const length = Math.sqrt(dx * dx + dz * dz);
            dx = (dx / length) * this.speed;
            dz = (dz / length) * this.speed;
        }

        if (dx !== 0 || dz !== 0) {
            this.x += dx;
            this.z += dz;

            // Boundaries (Half pitch is boundsX, boundsZ)
            this.x = Math.max(-boundsX + this.radius, Math.min(boundsX - this.radius, this.x));
            this.z = Math.max(-boundsZ + this.radius, Math.min(boundsZ - this.radius, this.z));

            return true; // Moved
        }
        return false; // Did not move
    }

    getState() {
        return {
            id: this.id,
            name: this.name,
            gender: this.gender,
            team: this.team,
            x: this.x,
            z: this.z
        };
    }

    setState(state) {
        this.team = state.team;
        this.x = state.x;
        this.z = state.z;
    }
}

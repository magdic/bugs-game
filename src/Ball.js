import * as THREE from 'three';

export default class Ball {
    constructor(scene) {
        this.radius = 3;
        this.x = 0;
        this.y = this.radius; // Resting on ground
        this.z = 0;

        this.vx = 0;
        this.vz = 0;
        this.friction = 0.98; // Multiplier applied each frame

        // Setup Mesh
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);

        // Simple bug emoji texture approach (canvas trick)
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 128, 128);
        ctx.font = '80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐛', 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshStandardMaterial({ map: texture });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.position.set(this.x, this.y, this.z);

        if (scene) {
            scene.add(this.mesh);
        }
    }

    updatePhysics(boundsX, boundsZ, delta = 1) {
        // Apply velocity
        this.x += this.vx * delta;
        this.z += this.vz * delta;

        // Apply friction
        this.vx *= this.friction;
        this.vz *= this.friction;

        // Stop completely if very slow to avoid endless micro-sliding
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vz) < 0.05) this.vz = 0;

        // Pitch boundaries (bounce)
        // Adjust bounce logic to account for goals later in Game.js
        if (this.x < -boundsX + this.radius) {
            this.x = -boundsX + this.radius;
            this.vx *= -0.8;
        } else if (this.x > boundsX - this.radius) {
            this.x = boundsX - this.radius;
            this.vx *= -0.8;
        }

        if (this.z < -boundsZ + this.radius) {
            this.z = -boundsZ + this.radius;
            this.vz *= -0.8;
        } else if (this.z > boundsZ - this.radius) {
            this.z = boundsZ - this.radius;
            this.vz *= -0.8;
        }

        // Spin mesh based on velocity (simple approximation)
        const speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
        if (speed > 0) {
            // axis of rotation is perpendicular to velocity
            const axis = new THREE.Vector3(-this.vz, 0, this.vx).normalize();
            // distance moved = angle * radius => angle = distance / radius
            const angle = speed / this.radius;
            this.mesh.rotateOnWorldAxis(axis, angle);
        }

        // Update mesh position
        this.mesh.position.set(this.x, this.y, this.z);
    }

    getState() {
        return {
            x: this.x,
            z: this.z,
            vx: this.vx,
            vz: this.vz
        };
    }

    setState(state) {
        this.x = state.x;
        this.z = state.z;
        this.vx = state.vx;
        this.vz = state.vz;
        this.mesh.position.set(this.x, this.y, this.z);
    }
}

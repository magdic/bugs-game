import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class Renderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // Setup Three.js Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

        // Setup Camera
        const aspect = window.innerWidth / window.innerHeight;
        // Typical isometric-ish soccer camera
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 150, 150);
        this.camera.lookAt(0, 0, 0);

        // Setup WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.setupLights();

        this.stadiumGroup = new THREE.Group();
        this.scene.add(this.stadiumGroup);

        this.playersGroup = new THREE.Group();
        this.scene.add(this.playersGroup);

        this.playerMeshes = {}; // Map of playerId to Object3D
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;

        // Shadow map properties
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;

        this.scene.add(dirLight);
    }

    buildStadium(stadiumType) {
        // Clear previous stadium
        while(this.stadiumGroup.children.length > 0){
            this.stadiumGroup.remove(this.stadiumGroup.children[0]);
        }

        let stadiumName = "Con Classic Stadium";
        let pitchColor = 0x4CAF50; // Green

        if (stadiumType === 'flag_arena') {
            stadiumName = "FLAG Arena";
            pitchColor = 0x388E3C; // Darker green
        } else if (stadiumType === 'ccp_arena') {
            stadiumName = "CCP Arena";
            pitchColor = 0x81C784; // Lighter green
        }

        // 1. Pitch
        const pitchGeo = new THREE.PlaneGeometry(200, 120);
        const pitchMat = new THREE.MeshStandardMaterial({ color: pitchColor });
        const pitch = new THREE.Mesh(pitchGeo, pitchMat);
        pitch.rotation.x = -Math.PI / 2;
        pitch.receiveShadow = true;
        this.stadiumGroup.add(pitch);

        // Pitch Lines (simplified)
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        // Center line
        const centerLineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.1, -60),
            new THREE.Vector3(0, 0.1, 60)
        ]);
        const centerLine = new THREE.Line(centerLineGeo, lineMat);
        this.stadiumGroup.add(centerLine);
        // Center Circle
        const circleGeo = new THREE.RingGeometry(19.5, 20.5, 32);
        const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(circleGeo, circleMat);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = 0.1;
        this.stadiumGroup.add(circle);

        // 2. Goals (Simple boxes for now)
        const goalGeo = new THREE.BoxGeometry(10, 15, 30);

        // Red Goal (Left)
        const redGoalMat = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        const redGoal = new THREE.Mesh(goalGeo, redGoalMat);
        redGoal.position.set(-100, 7.5, 0);
        this.stadiumGroup.add(redGoal);

        // Blue Goal (Right)
        const blueGoalMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 });
        const blueGoal = new THREE.Mesh(goalGeo, blueGoalMat);
        blueGoal.position.set(100, 7.5, 0);
        this.stadiumGroup.add(blueGoal);

        // 3. Side Walls with Stadium Name
        const wallGeo = new THREE.BoxGeometry(200, 20, 5);

        // Create text texture for walls
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stadiumName, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const wallMat = new THREE.MeshStandardMaterial({ map: texture });

        const topWall = new THREE.Mesh(wallGeo, wallMat);
        topWall.position.set(0, 10, -62.5);
        this.stadiumGroup.add(topWall);

        const bottomWall = new THREE.Mesh(wallGeo, wallMat);
        bottomWall.position.set(0, 10, 62.5);
        this.stadiumGroup.add(bottomWall);
    }

    addPlayerMesh(player) {
        if (this.playerMeshes[player.id]) return;

        const group = new THREE.Group();

        // Colors
        const teamColor = player.team === 'red' ? 0xff4444 : 0x4444ff;
        const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor });
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa }); // Skin tone approx

        // "Funko" Style
        // Large Head
        const headGeo = new THREE.BoxGeometry(8, 8, 8); // Box head for funko look
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 10;
        head.castShadow = true;
        group.add(head);

        // Small Body
        const bodyGeo = new THREE.CylinderGeometry(3, 3, 6, 16);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 3;
        body.castShadow = true;
        group.add(body);

        // Gender Diff (e.g. Hair)
        if (player.gender === 'woman') {
            const hairGeo = new THREE.BoxGeometry(8.5, 3, 8.5);
            const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3000 }); // Brown hair
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.y = 13;
            group.add(hair);
        } else {
             // Short hair
            const hairGeo = new THREE.BoxGeometry(8.2, 1, 8.2);
            const hairMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Black hair
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.y = 14;
            group.add(hair);
        }

        // Name Sprite
        const nameSprite = this.createTextSprite(player.name);
        nameSprite.position.y = 18;
        group.add(nameSprite);

        // Position
        group.position.set(player.x, 0, player.z);

        this.playersGroup.add(group);
        this.playerMeshes[player.id] = group;
    }

    removePlayerMesh(playerId) {
        const mesh = this.playerMeshes[playerId];
        if (mesh) {
            this.playersGroup.remove(mesh);
            delete this.playerMeshes[playerId];
        }
    }

    createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = '32px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(20, 5, 1);
        return sprite;
    }

    updatePlayerPositions(players) {
        // Add new players, update existing
        for (const id in players) {
            const p = players[id];
            if (!this.playerMeshes[id]) {
                this.addPlayerMesh(p);
            } else {
                // Smooth interpolation could go here
                this.playerMeshes[id].position.set(p.x, 0, p.z);
            }
        }

        // Remove stale players
        for (const id in this.playerMeshes) {
            if (!players[id]) {
                this.removePlayerMesh(id);
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render(sceneElements) {
        // Optional: dynamic camera tracking
        // if (sceneElements.localPlayer && this.playerMeshes[sceneElements.localPlayer.id]) {
        //     const target = this.playerMeshes[sceneElements.localPlayer.id].position;
        //     this.camera.position.lerp(new THREE.Vector3(target.x, 150, target.z + 100), 0.1);
        //     this.camera.lookAt(target);
        // }

        this.renderer.render(this.scene, this.camera);
    }
}

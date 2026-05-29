import Player from './Player.js';
import Ball from './Ball.js';
import Renderer from './Renderer.js';
import Network from './Network.js';
import AudioManager from './AudioManager.js';

class Game {
    constructor() {
        this.network = new Network();
        this.renderer = null;
        this.ball = null;
        this.audio = new AudioManager();

        this.localPlayerId = 'player_' + Math.random().toString(36).substr(2, 9);
        this.localPlayer = null;

        this.players = {};
        this.isHost = false;
        this.roomCode = null;

        this.gameState = {
            status: 'lobby',
            timeRemaining: 4.5 * 60,
            half: 1,
            redScore: 0,
            blueScore: 0,
            stadium: 'con_classic'
        };

        this.keys = {};
        this.lastActionTime = 0;
        this.lastTime = performance.now();

        this.boundsX = 100;
        this.boundsZ = 60;

        this.setupDOM();
    }

    setupDOM() {
        this.uiLayer = document.getElementById('ui-layer');
        this.lobbyPanel = document.getElementById('lobby');
        this.stadiumPanel = document.getElementById('stadium-selection');
        this.gameUI = document.getElementById('game-ui');
        this.postMatchPanel = document.getElementById('post-match-ui');
        this.roomControls = document.getElementById('room-controls');

        document.getElementById('createGameBtn').addEventListener('click', () => this.createGame());
        document.getElementById('joinGameBtn').addEventListener('click', () => this.joinGame());
        document.getElementById('startMatchBtn').addEventListener('click', () => this.startMatch());
        document.getElementById('rematchBtn').addEventListener('click', () => this.restartMatch(false));
        document.getElementById('swapTeamsBtn').addEventListener('click', () => this.restartMatch(true));

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.handleInput(e.code);
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        const savedName = sessionStorage.getItem('playerName');
        if (savedName) {
            document.getElementById('playerName').value = savedName;
        }
        const savedGender = sessionStorage.getItem('playerGender');
        if (savedGender) {
            document.getElementById('playerGender').value = savedGender;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            document.getElementById('roomCodeInput').value = roomParam.toUpperCase();
            if (savedName) {
                this.roomCode = roomParam.toUpperCase();
                setTimeout(() => this.joinRoom(), 100);
            }
        }
    }

    handleInput(code) {
        if (this.gameState.status !== 'playing') return;

        const now = performance.now();
        if (now - this.lastActionTime < 500) return;

        const dx = this.ball.x - this.localPlayer.x;
        const dz = this.ball.z - this.localPlayer.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < this.localPlayer.radius + this.ball.radius + 5) {
            let kickForce = 0;
            let actionType = '';

            if (code === 'Space') {
                kickForce = 3;
                actionType = 'pass';
            } else if (code === 'Enter') {
                kickForce = 6;
                actionType = 'shoot';
            }

            if (kickForce > 0) {
                const dirX = dx / dist;
                const dirZ = dz / dist;

                this.network.broadcastAction({
                    type: actionType,
                    playerId: this.localPlayerId,
                    dirX: dirX,
                    dirZ: dirZ,
                    force: kickForce
                });

                this.lastActionTime = now;
            }
        }
    }

    createGame() {
        this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.joinRoom();
    }

    joinGame() {
        const inputCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (!inputCode) {
            alert('Please enter a valid room code.');
            return;
        }
        this.roomCode = inputCode;
        this.joinRoom();
    }

    joinRoom() {
        const nameInput = document.getElementById('playerName').value || 'Player';
        const genderInput = document.getElementById('playerGender').value;
        const team = Math.random() > 0.5 ? 'red' : 'blue';

        sessionStorage.setItem('playerName', nameInput);
        sessionStorage.setItem('playerGender', genderInput);

        const url = new URL(window.location);
        url.searchParams.set('room', this.roomCode);
        window.history.pushState({}, '', url);

        this.localPlayer = new Player(this.localPlayerId, nameInput, genderInput, team);
        this.players[this.localPlayerId] = this.localPlayer;

        document.getElementById('playerName').disabled = true;
        document.getElementById('playerGender').disabled = true;
        this.roomControls.classList.add('hidden');
        document.getElementById('lobbyStatus').classList.remove('hidden');
        document.getElementById('displayRoomCode').innerText = this.roomCode;

        this.setupNetwork();
        
        // Optimistically update the UI instantly so it never hangs at 0/4
        this.handlePresenceUpdate({});
        
        const pState = this.localPlayer.getState();
        pState.joinedAt = Date.now();
        this.network.joinRoom(this.roomCode, pState);

        this.audio.init();
    }

    setupNetwork() {
        this.network.callbacks.onPresenceSync = (state) => this.handlePresenceUpdate(state);
        this.network.callbacks.onGameStateUpdate = (state) => {
            if (!this.isHost) this.syncGameState(state);
        };
        this.network.callbacks.onPlayerAction = (action) => {
            if (action.type === 'shoot') this.audio.playShoot();
            if (action.type === 'pass') this.audio.playPass();

            if (this.isHost && this.ball) {
                this.ball.vx += action.dirX * action.force;
                this.ball.vz += action.dirZ * action.force;
            }
        };

        this.network.callbacks.onPlayerTransform = (payload) => {
            if (payload.id !== this.localPlayerId && this.players[payload.id]) {
                this.players[payload.id].setState(payload);
            }
        };
    }

    handlePresenceUpdate(presenceState) {
        let sortedIds = Object.keys(presenceState).sort();
        let allPlayersData = [];

        // Optimistically keep track of the local player even if presence echo is delayed
        let newPlayersDict = { [this.localPlayerId]: true };

        sortedIds.forEach((key, index) => {
            const presenceData = presenceState[key][0];
            if (presenceData) {
                allPlayersData.push(presenceData);
                newPlayersDict[presenceData.id] = true;
                if (!this.players[presenceData.id]) {
                    this.players[presenceData.id] = new Player(
                        presenceData.id, presenceData.name, presenceData.gender, presenceData.team
                    );
                }
            }
        });

        // Determine host by join time to prevent host migration on random ID checks
        if (allPlayersData.length > 0) {
            allPlayersData.sort((a, b) => {
                const timeA = a.joinedAt || 0;
                const timeB = b.joinedAt || 0;
                if (timeA !== timeB) return timeA - timeB;
                return a.id.localeCompare(b.id);
            });
            this.isHost = (allPlayersData[0].id === this.localPlayerId);
        } else {
            this.isHost = true;
        }

        allPlayersData.forEach((presenceData, index) => {
            if (this.isHost && this.gameState.status === 'lobby') {
                 this.players[presenceData.id].team = index % 2 === 0 ? 'red' : 'blue';
            }
        });

        const listDOM = document.getElementById('playerList');
        listDOM.innerHTML = '';

        for (let id in this.players) {
            if (!newPlayersDict[id] && id !== this.localPlayerId) {
                if (this.renderer) this.renderer.removePlayerMesh(id);
                delete this.players[id];
            } else if (this.players[id]) {
                // Render the player in the list
                const p = this.players[id];
                const li = document.createElement('li');
                li.innerText = `${p.name} (${p.team})`;
                if (id === this.localPlayerId) li.innerText += " (You)";
                listDOM.appendChild(li);
            }
        }

        const count = Object.keys(newPlayersDict).length;
        document.getElementById('playerCount').innerText = count;

        if (this.gameState.status === 'lobby') {
            if (count >= 4) {
                document.getElementById('waitingMessage').innerText = "Ready!";
                if (this.isHost) {
                    this.stadiumPanel.style.display = 'block';
                    document.getElementById('startMatchBtn').disabled = false;
                } else {
                     document.getElementById('waitingMessage').innerText = "Waiting for Host to start...";
                     this.stadiumPanel.style.display = 'none';
                }
            } else {
                 document.getElementById('waitingMessage').innerText = "Waiting for more players...";
                 this.stadiumPanel.style.display = 'none';
            }
        }
    }

    startMatch() {
        if (!this.isHost) return;
        this.gameState.stadium = document.getElementById('stadiumSelect').value;
        this.gameState.status = 'playing';
        this.gameState.half = 1;
        this.gameState.timeRemaining = 4.5 * 60;
        this.gameState.redScore = 0;
        this.gameState.blueScore = 0;
        this.resetPositions();
        this.network.broadcastGameState(this.getSyncState());
        this.initGameMode();
    }

    syncGameState(state) {
        const oldStatus = this.gameState.status;
        this.gameState = state.gameState;

        if (this.ball && state.ball) {
            const dx = this.ball.x - state.ball.x;
            const dz = this.ball.z - state.ball.z;
            if (dx*dx + dz*dz > 25) {
                this.ball.setState(state.ball);
            } else {
                this.ball.x = state.ball.x;
                this.ball.z = state.ball.z;
            }
        }

        if (oldStatus === 'lobby' && this.gameState.status === 'playing') this.initGameMode();
        else if (this.gameState.status === 'finished') this.showPostMatch();

        this.updateScoreboard();
    }

    getSyncState() {
        return {
            gameState: this.gameState,
            ball: this.ball ? this.ball.getState() : null
        };
    }

    initGameMode() {
        this.uiLayer.style.pointerEvents = 'none';
        this.lobbyPanel.classList.add('hidden');
        this.stadiumPanel.style.display = 'none';
        this.postMatchPanel.style.display = 'none';
        this.gameUI.style.display = 'flex';

        if (!this.renderer) {
            this.renderer = new Renderer('canvas-container'); // Pass ID instead of element
            this.ball = new Ball(this.renderer.scene);
        }

        this.renderer.buildStadium(this.gameState.stadium);
        if (!this.isHost) this.resetPositions();

        this.audio.playCrowd();

        if (!this.loopRunning) {
            this.loopRunning = true;
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    resetPositions() {
        let redCount = 0;
        let blueCount = 0;

        for (let id in this.players) {
            const p = this.players[id];
            let isRedSide = p.team === 'red';
            if (this.gameState.half === 2) isRedSide = !isRedSide;

            if (isRedSide) {
                p.x = -30;
                p.z = (redCount * 15) - 15;
                redCount++;
            } else {
                p.x = 30;
                p.z = (blueCount * 15) - 15;
                blueCount++;
            }
        }

        if (this.ball) {
            this.ball.x = 0;
            this.ball.z = 0;
            this.ball.vx = 0;
            this.ball.vz = 0;
        }
    }

    updateScoreboard() {
        document.getElementById('scoreBoard').innerText = `Red: ${this.gameState.redScore} - Blue: ${this.gameState.blueScore}`;
        const m = Math.floor(this.gameState.timeRemaining / 60);
        const s = Math.floor(this.gameState.timeRemaining % 60);
        document.getElementById('timer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    showPostMatch() {
        this.gameUI.style.display = 'none';
        this.uiLayer.style.pointerEvents = 'auto';
        this.postMatchPanel.style.display = 'block';

        let result = "Draw!";
        if (this.gameState.redScore > this.gameState.blueScore) result = "Red Team Wins!";
        if (this.gameState.blueScore > this.gameState.redScore) result = "Blue Team Wins!";
        document.getElementById('matchResult').innerText = result;

        if (this.isHost) {
            document.getElementById('hostControls').classList.remove('hidden');
            document.getElementById('waitingHostMessage').style.display = 'none';
        } else {
            document.getElementById('hostControls').classList.add('hidden');
            document.getElementById('waitingHostMessage').style.display = 'block';
        }
    }

    restartMatch(swapTeams) {
        if (!this.isHost) return;
        if (swapTeams) {
            for (let id in this.players) {
                this.players[id].team = this.players[id].team === 'red' ? 'blue' : 'red';
            }
        }
        this.gameState.status = 'playing';
        this.gameState.half = 1;
        this.gameState.timeRemaining = 4.5 * 60;
        this.gameState.redScore = 0;
        this.gameState.blueScore = 0;
        this.resetPositions();
        this.network.broadcastGameState(this.getSyncState());
        this.initGameMode();
    }

    handleInteractions(delta) {
        for (let id in this.players) {
            const p = this.players[id];
            const dx = this.ball.x - p.x;
            const dz = this.ball.z - p.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const minDist = this.ball.radius + p.radius;

            if (dist < minDist) {
                const overlap = minDist - dist;
                const dirX = dx / dist;
                const dirZ = dz / dist;

                this.ball.x += dirX * overlap;
                this.ball.z += dirZ * overlap;

                this.ball.vx += dirX * 0.5;
                this.ball.vz += dirZ * 0.5;
            }
        }

        this.ball.updatePhysics(this.boundsX, this.boundsZ, delta);

        if (Math.abs(this.ball.x) > this.boundsX - 5 && Math.abs(this.ball.z) < 15) {
            if (this.ball.x > 0) {
                this.gameState.redScore++;
            } else {
                this.gameState.blueScore++;
            }

            this.audio.playGoal();
            this.resetPositions();
            this.network.broadcastGameState(this.getSyncState());
        }
    }

    loop(timestamp) {
        if (!this.loopRunning) return;

        const delta = (timestamp - this.lastTime) / 16.66;
        this.lastTime = timestamp;

        if (this.gameState.status === 'playing') {
            const moved = this.localPlayer.updatePosition(this.keys, this.boundsX, this.boundsZ);

            if (moved) {
                this.network.broadcastPlayerTransform(this.localPlayer.getState());
            }

            if (this.isHost) {
                this.gameState.timeRemaining -= (delta * 16.66) / 1000;

                if (this.gameState.timeRemaining <= 0) {
                    if (this.gameState.half === 1) {
                        this.gameState.half = 2;
                        this.gameState.timeRemaining = 4.5 * 60;
                        this.resetPositions();
                    } else {
                        this.gameState.status = 'finished';
                    }
                }

                this.handleInteractions(delta);

                if (Math.random() < 0.1) {
                    this.network.broadcastGameState(this.getSyncState());
                }

                this.updateScoreboard();
            } else if (this.ball) {
                this.ball.updatePhysics(this.boundsX, this.boundsZ, delta);
            }

            this.renderer.updatePlayerPositions(this.players);
            this.renderer.render({ localPlayer: this.localPlayer });
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}

window.onload = () => { window.gameInstance = new Game(); };

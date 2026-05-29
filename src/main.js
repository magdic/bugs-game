import { RoomManager } from './RoomManager.js';
import { gameState } from './GameState.js';

const uiLobby = document.getElementById('lobby');
const uiRoom = document.getElementById('room');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const btnStartGame = document.getElementById('btnStartGame');
const playerList = document.getElementById('playerList');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');

let roomManager;

function updateLobbyUI() {
    uiLobby.style.display = 'none';
    uiRoom.style.display = 'block';
    roomCodeDisplay.innerText = gameState.roomCode;

    playerList.innerHTML = '';
    for (const id in gameState.players) {
        const p = gameState.players[id];
        const el = document.createElement('div');
        el.innerText = `${p.name} ${id === gameState.playerId ? '(You)' : ''}`;
        playerList.appendChild(el);
    }

    if (gameState.isHost) {
        btnStartGame.style.display = 'inline-block';
    }
}

function init() {
    roomManager = new RoomManager(
        updateLobbyUI,
        () => {
            uiRoom.style.display = 'none';

            document.getElementById('scoreboard').style.display = 'block';

            // Audio setup
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            // wind effect
            setInterval(() => {
                if(gameState.status === 'playing') {
                    osc.frequency.linearRampToValueAtTime(100 + Math.random()*100, audioCtx.currentTime + 2);
                    gain.gain.linearRampToValueAtTime(0.01 + Math.random()*0.02, audioCtx.currentTime + 2);
                }
            }, 2000);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.value = 0.01;
            osc.start();

            console.log("Game started!", gameState.players);
            engine = new GameEngine();
            engine.init().then(() => {
                engine.initPlayers();
            });
            playerController = new PlayerController(roomManager);
            window.playerController = playerController;
            bugController = new BugController(roomManager);
            requestAnimationFrame(gameLoop);
        }
    );
    roomManager.init();

    btnCreateRoom.addEventListener('click', () => {
        const name = document.getElementById('playerName').value;
        roomManager.createRoom(name);
    });

    btnJoinRoom.addEventListener('click', () => {
        const name = document.getElementById('playerName').value;
        const code = document.getElementById('roomCodeInput').value;
        if (code.length === 4) {
            roomManager.joinRoom(code, name);
        } else {
            alert('Enter a 4-letter code');
        }
    });

    btnStartGame.addEventListener('click', () => {
        roomManager.startGame();
    });
}

init();

import { GameEngine } from './GameEngine.js';
import { BugController } from './BugController.js';
import { PlayerController } from './PlayerController.js';

let engine;
let playerController;
let bugController;

let lastTime = performance.now();
function gameLoop(now) {
    const dt = now - lastTime;
    lastTime = now;


    if (gameState.status === 'playing') {
        document.getElementById('scoreLumberjacks').innerText = gameState.score.lumberjacks;
        document.getElementById('scoreWolves').innerText = gameState.score.wolves;

        if (playerController) playerController.update(dt);

        if (bugController) bugController.update(dt);
        if (engine) {
            // sync remote players
            for (const id in gameState.players) {
                engine.updatePlayerState(id, gameState.players[id]);
            }
            engine.update(dt);
        }
    }
    requestAnimationFrame(gameLoop);
}

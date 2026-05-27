export default class Network {
    constructor() {
        // Initialize Firebase
        // Replace with your actual Firebase config
        const firebaseConfig = {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_AUTH_DOMAIN",
            databaseURL: "YOUR_DATABASE_URL",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_STORAGE_BUCKET",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
        };

        if (!window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
        }

        this.db = window.firebase.database();

        this.callbacks = {
            onGameStateUpdate: null,
            onPlayersUpdate: null,
            onBugsUpdate: null
        };
    }

    initListeners() {
        // Listen to Game State (scores, time)
        this.db.ref('gameState').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && this.callbacks.onGameStateUpdate) {
                this.callbacks.onGameStateUpdate(data);
            }
        });

        // Listen to Players
        this.db.ref('players').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && this.callbacks.onPlayersUpdate) {
                this.callbacks.onPlayersUpdate(data);
            }
        });

        // Listen to Bugs
        this.db.ref('bugs').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && this.callbacks.onBugsUpdate) {
                this.callbacks.onBugsUpdate(data);
            }
        });
    }

    updatePlayerState(playerId, state) {
        this.db.ref(`players/${playerId}`).set(state);
    }

    removePlayer(playerId) {
        this.db.ref(`players/${playerId}`).remove();
    }

    removeBug(bugId) {
        this.db.ref(`bugs/${bugId}`).remove();
    }

    updateScore(team, score) {
         this.db.ref(`gameState/${team}Score`).set(score);
    }

    // Additional methods for combat, bug dropping, etc., would go here
    // In a fully authoritative setup, some of these actions might be handled via Cloud Functions
}

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};

// MASSIVE MAPS (1600 x 1200) - Double the original size
const MAPS = {
    ASYLUM: {
        name: "Asylum (Dark & Narrow)",
        color: "#111116",
        width: 1600,
        height: 1200,
        walls: [
            // Outer Boundaries
            { x: 0, y: 0, w: 1600, h: 30 },
            { x: 0, y: 1170, w: 1600, h: 30 },
            { x: 0, y: 0, w: 30, h: 1200 },
            { x: 1570, y: 0, w: 30, h: 1200 },
            // Interior Obstacles
            { x: 400, y: 300, w: 800, h: 40 },
            { x: 200, y: 600, w: 400, h: 40 },
            { x: 1000, y: 600, w: 400, h: 40 },
            { x: 780, y: 700, w: 40, h: 300 }
        ],
        equipment: [
            { id: 'e1', type: 'Flashlight', x: 200, y: 200, pickedUp: false },
            { id: 'e2', type: 'EMF Reader', x: 1400, y: 200, pickedUp: false },
            { id: 'e3', type: 'UV Light', x: 800, y: 1000, pickedUp: false },
            { id: 'e4', type: 'Camera', x: 100, y: 1000, pickedUp: false }
        ]
    },
    CABIN: {
        name: "Woodland Cabin (Open Structure)",
        color: "#1a120b",
        width: 1600,
        height: 1200,
        walls: [
            { x: 0, y: 0, w: 1600, h: 30 },
            { x: 0, y: 1170, w: 1600, h: 30 },
            { x: 0, y: 0, w: 30, h: 1200 },
            { x: 1570, y: 0, w: 30, h: 1200 },
            // Cabin Center Structure
            { x: 600, y: 400, w: 400, h: 400 }
        ],
        equipment: [
            { id: 'e1', type: 'Flashlight', x: 700, y: 300, pickedUp: false },
            { id: 'e2', type: 'Crucifix', x: 800, y: 500, pickedUp: false },
            { id: 'e3', type: 'Camera', x: 900, y: 900, pickedUp: false }
        ]
    }
};

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('createRoomRequest', (playerName) => {
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[code] = {
            code: code,
            players: {},
            gameState: "LOBBY_ROOM",
            selectedMap: "ASYLUM", 
            mapData: JSON.parse(JSON.stringify(MAPS["ASYLUM"]))
        };
        joinRoomHandler(code, playerName);
    });

    socket.on('joinRoom', (data) => {
        if (rooms[data.roomCode] && rooms[data.roomCode].gameState === "LOBBY_ROOM") {
            joinRoomHandler(data.roomCode, data.name);
        } else {
            socket.emit('errorMsg', 'Room not found or game already started.');
        }
    });

    function joinRoomHandler(code, name) {
        currentRoom = code;
        socket.join(code);

        rooms[code].players[socket.id] = {
            id: socket.id,
            name: name,
            x: 100 + Object.keys(rooms[code].players).length * 50,
            y: 150,
            inventory: ["Empty", "Empty", "Empty"],
            activeSlot: 0,
            isUsingItem: false
        };

        socket.emit('init', socket.id);
        io.to(code).emit('roomUpdate', rooms[code]);
    }

    socket.on('changeMap', (mapType) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        if (MAPS[mapType]) {
            rooms[currentRoom].selectedMap = mapType;
            rooms[currentRoom].mapData = JSON.parse(JSON.stringify(MAPS[mapType]));
            io.to(currentRoom).emit('roomUpdate', rooms[currentRoom]);
        }
    });

    socket.on('startGameSignal', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].gameState = "PLAY";
            io.to(currentRoom).emit('gameStarted', rooms[currentRoom]);
        }
    });

    socket.on('playerMove', (moveData) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (!player) return;

        const walls = rooms[currentRoom].mapData.walls;
        let collision = false;
        const radius = 15;

        for (let wall of walls) {
            let closestX = Math.max(wall.x, Math.min(moveData.x, wall.x + wall.w));
            let closestY = Math.max(wall.y, Math.min(moveData.y, wall.y + wall.h));
            let distanceX = moveData.x - closestX;
            let distanceY = moveData.y - closestY;
            if ((distanceX * distanceX + distanceY * distanceY) < (radius * radius)) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            player.x = moveData.x;
            player.y = moveData.y;
        }

        // Auto pickup loop into empty inventory slot
        const equipmentList = rooms[currentRoom].mapData.equipment;
        for (let item of equipmentList) {
            if (!item.pickedUp) {
                let dx = player.x - item.x;
                let dy = player.y - item.y;
                if (Math.sqrt(dx*dx + dy*dy) < 25) {
                    let emptyIndex = player.inventory.indexOf("Empty");
                    if (emptyIndex !== -1) {
                        item.pickedUp = true;
                        player.inventory[emptyIndex] = item.type;
                        io.to(currentRoom).emit('roomUpdate', rooms[currentRoom]);
                        break;
                    }
                }
            }
        }
        io.to(currentRoom).emit('serverUpdate', rooms[currentRoom].players);
    });

    // Change slot system
    socket.on('changeSlot', (slotIdx) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (player && slotIdx >= 0 && slotIdx < 3) {
            player.activeSlot = slotIdx;
            io.to(currentRoom).emit('serverUpdate', rooms[currentRoom].players);
        }
    });

    // Use Item activation state toggle
    socket.on('useItem', (state) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (player && player.inventory[player.activeSlot] !== "Empty") {
            player.isUsingItem = state;
            io.to(currentRoom).emit('serverUpdate', rooms[currentRoom].players);
        }
    });

    // Place / Drop current active item down
    socket.on('dropItem', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (player) {
            let itemType = player.inventory[player.activeSlot];
            if (itemType !== "Empty") {
                player.inventory[player.activeSlot] = "Empty";
                player.isUsingItem = false;
                
                // Drop it back into the persistent map list
                rooms[currentRoom].mapData.equipment.push({
                    id: 'dropped_' + Math.random().toString(36).substring(2, 7),
                    type: itemType,
                    x: player.x,
                    y: player.y,
                    pickedUp: false
                });

                io.to(currentRoom).emit('roomUpdate', rooms[currentRoom]);
            }
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
            } else {
                io.to(currentRoom).emit('roomUpdate', rooms[currentRoom]);
            }
        }
    });
}); // This closing bracket correctly terminates the io.on('connection') block

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Night Terrors server running on port ${PORT}`);
});

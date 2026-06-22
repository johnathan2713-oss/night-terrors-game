const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};

const MAPS = {
    ASYLUM: {
        name: "Asylum (Dark & Narrow)",
        color: "#08080c",
        width: 1600,
        height: 1200,
        walls: [
            { x: 0, y: 0, w: 1600, h: 30 },
            { x: 0, y: 1170, w: 1600, h: 30 },
            { x: 0, y: 0, w: 30, h: 1200 },
            { x: 1570, y: 0, w: 30, h: 1200 },
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
        color: "#0d0a07",
        width: 1600,
        height: 1200,
        walls: [
            { x: 0, y: 0, w: 1600, h: 30 },
            { x: 0, y: 1170, w: 1600, h: 30 },
            { x: 0, y: 0, w: 30, h: 1200 },
            { x: 1570, y: 0, w: 30, h: 1200 },
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
            mapData: JSON.parse(JSON.stringify(MAPS["ASYLUM"])),
            ghost: { x: 800, y: 600, targetId: null, speed: 2.2, pulse: 0 }
        };
        joinRoomHandler(code, playerName);
    });

    socket.on('joinRoom', (data) => {
        if (rooms[data.roomCode] && rooms[data.roomCode].gameState === "LOBBY_ROOM") {
            joinRoomHandler(data.roomCode, data.name);
        } else {
            socket.emit('errorMsg', 'Room not found.');
        }
    });

    function joinRoomHandler(code, name) {
        currentRoom = code;
        socket.join(code);
        rooms[code].players[socket.id] = {
            id: socket.id, name: name, x: 200, y: 150,
            inventory: ["Empty", "Empty", "Empty"], activeSlot: 0, isUsingItem: false
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
            startGhostLoop(currentRoom);
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
        io.to(currentRoom).emit('serverUpdate', { players: rooms[currentRoom].players, ghost: rooms[currentRoom].ghost });
    });

    socket.on('changeSlot', (slotIdx) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (player && slotIdx >= 0 && slotIdx < 3) {
            player.activeSlot = slotIdx;
            io.to(currentRoom).emit('serverUpdate', { players: rooms[currentRoom].players, ghost: rooms[currentRoom].ghost });
        }
    });

    socket.on('useItem', (state) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (player && player.inventory[player.activeSlot] !== "Empty") {
            player.isUsingItem = state;
            io.to(currentRoom).emit('serverUpdate', { players: rooms[currentRoom].players, ghost: rooms[currentRoom].ghost });
        }
    });

    socket.on('dropItem', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const player = rooms[currentRoom].players[socket.id];
        if (player) {
            let itemType = player.inventory[player.activeSlot];
            if (itemType !== "Empty") {
                player.inventory[player.activeSlot] = "Empty";
                player.isUsingItem = false;
                rooms[currentRoom].mapData.equipment.push({
                    id: 'dropped_' + Math.random().toString(36).substring(2, 7),
                    type: itemType, x: player.x, y: player.y, pickedUp: false
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
});

// Server-side AI logic processing for the Ghost tracking loop
function startGhostLoop(roomCode) {
    const loopInterval = setInterval(() => {
        const room = rooms[roomCode];
        if (!room || room.gameState !== "PLAY") {
            clearInterval(loopInterval);
            return;
        }

        const pIds = Object.keys(room.players);
        if (pIds.length === 0) return;

        // Find closest player to stalk
        let closestPlayer = null;
        let minDist = Infinity;
        pIds.forEach(id => {
            let p = room.players[id];
            let dx = p.x - room.ghost.x;
            let dy = p.y - room.ghost.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < minDist) {
                minDist = dist;
                closestPlayer = p;
            }
        });

        if (closestPlayer) {
            let dx = closestPlayer.x - room.ghost.x;
            let dy = closestPlayer.y - room.ghost.y;
            let angle = Math.atan2(dy, dx);
            
            // Creep ghost towards player target
            room.ghost.x += Math.cos(angle) * room.ghost.speed;
            room.ghost.y += Math.sin(angle) * room.ghost.speed;
            room.ghost.pulse += 0.05;
        }

        io.to(roomCode).emit('serverUpdate', { players: room.players, ghost: room.ghost });
    }, 50); // 20 times per second ticks
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Night Terrors running on port ${PORT}`);
});

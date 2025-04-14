const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const PORT = 3000;
const users = {};
const selectedBoards = {};
let drawnNumbers = new Set();
let gameStarted = false;
let drawTimeout = null;

// Generate a single bingo board
function generateRandomBoard() {
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const board = [];
    for (let row = 0; row < 5; row++) {
        const rowArr = [];
        for (let col = 0; col < 5; col++) {
            if (row === 2 && col === 2) {
                rowArr.push('FREE');
            } else {
                const randIndex = Math.floor(Math.random() * numbers.length);
                rowArr.push(numbers.splice(randIndex, 1)[0]);
            }
        }
        board.push(rowArr);
    }
    return board;
}

// Generate multiple boards (default 4)
function generateMultipleBoards(count = 4) {
    const boards = [];
    for (let i = 0; i < count; i++) {
        const board = generateRandomBoard();
        const sum = board.flat().reduce((acc, val) => val !== 'FREE' ? acc + val : acc, 0);
        boards.push({ board, sum });
    }
    return boards;
}

// Draw next number with 5-second delay
function drawNextNumber() {
    if (drawnNumbers.size >= 75) return null;

    let num;
    do {
        num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.has(num));

    drawnNumbers.add(num);
    io.emit('numberDrawn', num);

    // Reset timer
    if (drawTimeout) clearTimeout(drawTimeout);
    drawTimeout = setTimeout(drawNextNumber, 5000);
    return num;
}

// Start game
function startGame() {
    if (gameStarted) return;

    gameStarted = true;
    drawnNumbers = new Set();

    io.emit('startTimer', { duration: 180 }); // 3 min
    setTimeout(() => {
        if (drawTimeout) clearTimeout(drawTimeout);
        io.emit('gameOver');
        gameStarted = false;
    }, 180000);

    drawNextNumber(); // Start drawing
}

// Socket setup
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send fresh boards to each user
    socket.on('joinGame', (username) => {
        users[socket.id] = { username };
        const boards = generateMultipleBoards(4); // fresh set of 4 boards
        users[socket.id].boards = boards; // store per user
        socket.emit('boardOptions', boards);
    });

    socket.on('selectBoard', (boardIndex) => {
        const boards = users[socket.id]?.boards;
        if (boards && boards[boardIndex]) {
            const selected = boards[boardIndex];
            selectedBoards[socket.id] = selected;
            socket.emit('boardSelected', selected);
        }
    });

    socket.on('readyToPlay', () => {
        startGame();
    });

    socket.on('numberMatched', () => {
        drawNextNumber(); // Reset timer and send next number
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        delete selectedBoards[socket.id];
        console.log('User disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

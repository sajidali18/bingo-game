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

const targetSums = [821, 889, 949, 1009];

// Generate bingo boards with specific sums
function generateRandomBoard(targetSums) {
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

function generateMultipleBoards(count = 4) {
    const boards = [];
    for (let i = 0; i < count; i++) {
        const board = generateRandomBoard();
        const sum = board.flat().reduce((acc, val) => val !== 'FREE' ? acc + val : acc, 0);
        boards.push({ board, sum });
    }
    return boards;
}

module.exports = { generateMultipleBoards };


const bingoBoards = targetSums.map(sum => generateBingoBoardWithTargetSum(sum));

// Draw next number with 5-second delay
function drawNextNumber() {
    if (drawnNumbers.size >= 75) return null;

    let num;
    do {
        num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.has(num));

    drawnNumbers.add(num);
    io.emit('numberDrawn', num);

    // Clear old timer and start a new one
    if (drawTimeout) clearTimeout(drawTimeout);

    drawTimeout = setTimeout(() => {
        drawNextNumber();
    }, 5000);

    return num;
}

// Start game
function startGame() {
    if (gameStarted) return;

    gameStarted = true;
    drawnNumbers = new Set();

    io.emit('startTimer', { duration: 180 }); // 3 minutes
    setTimeout(() => {
        if (drawTimeout) clearTimeout(drawTimeout);
        io.emit('gameOver');
        gameStarted = false;
    }, 180000); // End after 3 minutes

    drawNextNumber(); // First number
}

// Socket setup
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinGame', (username) => {
        users[socket.id] = { username };
        socket.emit('boardOptions', bingoBoards);
    });

    socket.on('selectBoard', (boardIndex) => {
        const selected = bingoBoards[boardIndex];
        selectedBoards[socket.id] = selected;
        socket.emit('boardSelected', selected);
    });

    socket.on('readyToPlay', () => {

        startGame();
    });

    // ✅ If user matched number, emit new number and reset 5-sec timer
    socket.on('numberMatched', () => {
        drawNextNumber();
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

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const socket = io('https://bingo-game-1.onrender.com');

const BingoGame = () => {
    const [username, setUsername] = useState('');
    const [boardOptions, setBoardOptions] = useState([]);
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [drawnNumbers, setDrawnNumbers] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(null);
    const [score, setScore] = useState(0);
    const [drawStartTime, setDrawStartTime] = useState(null);
    const [gameEnded, setGameEnded] = useState(false);
    const [timer, setTimer] = useState(null);
    const [gameStarted, setGameStarted] = useState(false);
    const [matchedCells, setMatchedCells] = useState(new Set());

    const joinGame = () => {
        if (!username.trim()) return alert('Please enter your name.');
        socket.emit('joinGame', username);
    };

    useEffect(() => {
        // Receive board options
        socket.on('boardOptions', (boards) => {
            setBoardOptions(boards);
        });

        // Selected board received
        socket.on('boardSelected', (board) => {
            setBoardOptions([]);
            setSelectedBoard(board);

            let count = 4;
            setCountdown(count);

            const interval = setInterval(() => {
                count -= 1;
                if (count <= 0) {
                    clearInterval(interval);
                    setCountdown(null);
                    setGameStarted(true);
                    socket.emit('readyToPlay');
                } else {
                    setCountdown(count);
                }
            }, 1000);
        });

        // Number drawn
        socket.on('numberDrawn', (num) => {
            if (!gameStarted || gameEnded) return;
            setCurrentNumber(num);
            setDrawStartTime(Date.now());
            setDrawnNumbers((prev) => [...prev, num]);
        });

        // Timer setup
        socket.on('startTimer', ({ duration }) => {
            let time = duration;
            const interval = setInterval(() => {
                if (gameEnded) {
                    clearInterval(interval);
                    return;
                }
                setTimer(time--);
                if (time < 0) clearInterval(interval);
            }, 1000);
        });

        // Game over
        socket.on('gameOver', () => {
            setGameEnded(true);
        });

        return () => {
            socket.off('boardOptions');
            socket.off('boardSelected');
            socket.off('numberDrawn');
            socket.off('startTimer');
            socket.off('gameOver');
        };
    }, [gameStarted, gameEnded]);

    const handleCellClick = (cell, index) => {
        if (gameEnded || matchedCells.has(index) || cell === 'FREE') return;

        const clickTime = Date.now();
        const timeTaken = (clickTime - drawStartTime) / 1000;
        const value = parseInt(cell);

        if (value === currentNumber) {
            let points = timeTaken <= 2 ? 100 : timeTaken <= 4 ? 70 : 20;
            setScore((prev) => prev + points);
            setMatchedCells((prev) => new Set(prev).add(index));
            socket.emit('numberMatched');
        } else {
            setScore((prev) => prev - 10);
        }
    };

    const isMatched = (index) => matchedCells.has(index);

    const checkBingo = () => {
        const matched = [...matchedCells];
        const size = 5;

        const isLineComplete = (indices) => indices.every(i => matched.includes(i));

        const lines = [];

        for (let i = 0; i < size; i++) {
            lines.push(Array.from({ length: size }, (_, j) => i * size + j)); // rows
            lines.push(Array.from({ length: size }, (_, j) => j * size + i)); // columns
        }

        lines.push([0, 6, 12, 18, 24]); // diagonal
        lines.push([4, 8, 12, 16, 20]); // anti-diagonal

        const completed = lines.filter(isLineComplete);

        if (completed.length > 0) {
            toast.success("congratulations bingo is completed ", { position: "top-center" });
            socket.emit("bingoSuccess");
        } else {
            toast.error(" still Bingo is not complete", { position: "top-center" });
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex flex-col items-center py-8">
            <h2 className="text-3xl font-bold text-blue-700 mb-6">MPL Bingo Game</h2>

            {!boardOptions.length && !selectedBoard && (
                <div className="space-x-2">
                    <input
                        type="text"
                        placeholder="Enter your name"
                        className="px-4 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <button
                        onClick={joinGame}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                    >
                        Join Game
                    </button>
                </div>
            )}

            {!!boardOptions.length && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                    {boardOptions.map((item, i) => (
                        <div
                            key={i}
                            className="bg-white shadow-lg rounded-lg p-4 border border-gray-200 hover:ring hover:ring-blue-400 cursor-pointer transition"
                            onClick={() => socket.emit('selectBoard', i)}
                        >
                            <h4 className="text-lg font-semibold text-center mb-2 text-blue-600">Board {i + 1}</h4>
                            {item.board.map((row, ri) => (
                                <div key={ri} className="flex justify-center">
                                    {row.map((cell, ci) => (
                                        <div
                                            key={ci}
                                            className={`w-10 h-10 flex items-center justify-center m-1 font-bold border rounded-md text-sm
                                                ${cell === 'FREE' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}
                                            `}
                                        >
                                            {cell}
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <div className="text-center mt-2 text-sm text-gray-500">Sum: {item.sum}</div>
                        </div>
                    ))}
                </div>
            )}

            {selectedBoard && (
                <div className="mt-8 w-full flex flex-col items-center">
                    {countdown !== null && (
                        <div className="text-center text-2xl font-semibold text-red-600 mb-2">
                            Game starts in {countdown}...
                        </div>
                    )}

                    {countdown === null && (
                        <>
                            <div className="text-center text-lg text-red-500 font-semibold mb-2">
                                Time Left: {timer !== null ? `${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, '0')}` : ''}
                            </div>

                            <div className="text-xl font-bold text-purple-600 mb-2">Score: {score}</div>

                            <div className="mb-4" id="bingoBoard">
                                {selectedBoard.board.map((row, rowIndex) => (
                                    <div key={rowIndex} className="flex justify-center">
                                        {row.map((cell, colIndex) => {
                                            const index = rowIndex * 5 + colIndex;
                                            const isFree = cell === 'FREE';
                                            const matched = isMatched(index);
                                            return (
                                                <div
                                                    key={colIndex}
                                                    className={`w-12 h-12 flex items-center justify-center m-1 font-bold border rounded-md text-base
                                                        ${isFree
                                                            ? 'bg-green-600 text-white'
                                                            : matched
                                                                ? 'bg-yellow-300 text-black'
                                                                : 'bg-white text-gray-800 cursor-pointer'
                                                        }`}
                                                    onClick={() => handleCellClick(cell, index)}
                                                    style={{ pointerEvents: isFree || matched || gameEnded ? 'none' : 'auto' }}
                                                >
                                                    {cell}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            <div id="currentNumber" className="mt-6 text-center">
                                <h4 className="font-semibold text-md text-blue-500 mb-2"> Number:</h4>
                                {currentNumber !== null && (
                                    <span className="inline-block m-1 px-4 py-2 text-2xl font-bold bg-blue-700 text-white rounded shadow">
                                        {currentNumber}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={checkBingo}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition"
                                >
                                    BINGO!
                                </button>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
                                >
                                    New Game
                                </button>
                            </div>

                            {gameEnded && (
                                <div className="text-center text-2xl text-red-600 font-bold mt-6">Game Over!</div>
                            )}
                        </>
                    )}
                </div>
            )}

            <ToastContainer />
        </div>
    );
};

export default BingoGame;

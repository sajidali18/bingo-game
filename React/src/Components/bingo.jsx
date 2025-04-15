    import React, { useEffect, useState } from 'react';
    import io from 'socket.io-client';
    import { ToastContainer, toast } from 'react-toastify';
    import 'react-toastify/dist/ReactToastify.css';
    import 'bootstrap/dist/css/bootstrap.min.css';

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
        const [bingoCompleted, setBingoCompleted] = useState(false);


        const joinGame = () => {
            if (!username.trim()) return alert('Please enter your name.');
            socket.emit('joinGame', username);
        };

        useEffect(() => {
            socket.on('boardOptions', (boards) => setBoardOptions(boards));

            socket.on('boardSelected', (board) => {
                setBoardOptions([]);
                setSelectedBoard(board);

                const freeIndex = 12; // Center of 5x5 grid
                setMatchedCells(new Set([freeIndex])); // Pre-match FREE cell

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

            socket.on('numberDrawn', (num) => {
                if (!gameStarted || gameEnded) return;
                setCurrentNumber(num);
                setDrawStartTime(Date.now());
                setDrawnNumbers((prev) => [...prev, num]);
            });

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

            socket.on('gameOver', () => setGameEnded(true));

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
            if (bingoCompleted || !selectedBoard) return;

            const size = 5;

            const isLineComplete = (indices) => indices.every(i => matchedCells.has(i));

            const lines = [];

            for (let i = 0; i < size; i++) {
                lines.push(Array.from({ length: size }, (_, j) => i * size + j)); // Rows
                lines.push(Array.from({ length: size }, (_, j) => j * size + i)); // Columns
            }

            // Diagonals
            lines.push([0, 6, 12, 18, 24]);
            lines.push([4, 8, 12, 16, 20]);

            const completed = lines.filter(isLineComplete);

            if (completed.length > 0) {
                toast.success("🎉 Congratulations! Bingo is completed!", { position: "top-center" });
                socket.emit("bingoSuccess");
                setBingoCompleted(true); // Prevent repeat toasts
            } else {
                toast.error("🚫 Bingo not complete yet!", { position: "top-center" });
            }
        };

        return (
            <div className="container py-5">
                <h2 className="text-center text-primary mb-4">MPL Bingo Game</h2>

                {!boardOptions.length && !selectedBoard && (
                    <div className="text-center mb-4">
                        <input
                            type="text"
                            className="form-control d-inline-block w-auto me-2"
                            placeholder="Enter your name"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <button onClick={joinGame} className="btn btn-primary">Join Game</button>
                    </div>
                )}

                {!!boardOptions.length && (
                    <div className="row">
                        {boardOptions.map((item, i) => (
                            <div className="col-md-3 mb-4" key={i}>
                                <div
                                    className="card h-100 shadow-sm cursor-pointer"
                                    onClick={() => socket.emit('selectBoard', i)}
                                >
                                    <div className="card-body text-center">
                                        <h5 className="card-title text-primary">Board {i + 1}</h5>
                                        {item.board.map((row, ri) => (
                                            <div className="d-flex justify-content-center mb-1" key={ri}>
                                                {row.map((_, ci) => (
                                                    <div key={ci} className="border bg-light rounded mx-1" style={{ width: '30px', height: '30px', opacity: 0.5 }}></div>
                                                ))}
                                            </div>
                                        ))}
                                        <div className="badge bg-primary mt-3">Sum: {item.sum}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {selectedBoard && (
                    <div className="text-center mt-5">
                        {countdown !== null ? (
                            <h4 className="text-danger mb-3">Game starts in {countdown}...</h4>
                        ) : (
                            <>
                                <div className="mb-2 text-danger fw-bold">
                                    Time Left: {timer !== null ? `${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, '0')}` : ''}
                                </div>
                                <div className="mb-3 h5 text-success">Score: {score}</div>

                                <div className="mb-4">
                                    {selectedBoard.board.map((row, rowIndex) => (
                                        <div className="d-flex justify-content-center" key={rowIndex}>
                                            {row.map((cell, colIndex) => {
                                                const index = rowIndex * 5 + colIndex;
                                                const isFree = cell === 'FREE';
                                                const matched = isMatched(index);
                                                return (
                                                    <div
                                                        key={colIndex}
                                                        className={`border rounded text-center fw-bold mx-1 my-1 d-flex align-items-center justify-content-center ${isFree ? 'bg-success text-white' : matched ? 'bg-warning text-dark' : 'bg-white text-dark'}`}
                                                        style={{
                                                            width: '48px',
                                                            height: '48px',
                                                            cursor: isFree || matched || gameEnded ? 'not-allowed' : 'pointer'
                                                        }}
                                                        onClick={() => handleCellClick(cell, index)}
                                                    >
                                                        {cell}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                <div className="mb-4">
                                    <h5 className="text-primary">Number:</h5>
                                    {currentNumber !== null && (
                                        <span className="badge bg-primary fs-4 p-2">{currentNumber}</span>
                                    )}
                                </div>

                                <div className="d-flex justify-content-center gap-3 mb-4">
                                    <button onClick={checkBingo} className="btn btn-warning">BINGO!</button>
                                    <button onClick={() => window.location.reload()} className="btn btn-success">New Game</button>
                                </div>

                                {gameEnded && <h4 className="text-danger">Game Over!</h4>}
                            </>
                        )}
                    </div>
                )}

                <ToastContainer />
            </div>
        );
    };

    export default BingoGame;

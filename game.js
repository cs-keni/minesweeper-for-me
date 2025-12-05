class MinesweeperGame {
    constructor() {
        this.difficulties = {
            beginner: { rows: 9, cols: 9, mines: 10 },
            intermediate: { rows: 16, cols: 16, mines: 40 },
            advanced: { rows: 16, cols: 30, mines: 99 }
        };
        
        this.rows = 16;
        this.cols = 30;
        this.mineCount = 99;
        this.difficulty = 'advanced';
        this.board = [];
        this.revealed = [];
        this.flagged = [];
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.currentRow = 0;
        this.currentCol = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.showProbabilities = false;
        this.darkTheme = false;
        this.probabilityCache = new Map();
        
        // Keybinds (default)
        this.keybinds = {
            open: 'x',
            flag: 'z'
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.loadKeybinds();
        this.createBoard();
        this.renderBoard();
        this.setupEventListeners();
        this.updateDisplay();
        this.applyTheme();
    }
    
    loadSettings() {
        const savedDifficulty = localStorage.getItem('minesweeper-difficulty');
        const savedTheme = localStorage.getItem('minesweeper-theme');
        
        if (savedDifficulty && this.difficulties[savedDifficulty]) {
            this.difficulty = savedDifficulty;
        }
        
        if (savedTheme === 'dark') {
            this.darkTheme = true;
            document.getElementById('theme-toggle').checked = true;
        }
        
        const config = this.difficulties[this.difficulty];
        this.rows = config.rows;
        this.cols = config.cols;
        this.mineCount = config.mines;
        
        const select = document.getElementById('difficulty-select');
        if (select) {
            select.value = this.difficulty;
        }
    }
    
    saveSettings() {
        localStorage.setItem('minesweeper-difficulty', this.difficulty);
        localStorage.setItem('minesweeper-theme', this.darkTheme ? 'dark' : 'light');
    }
    
    loadKeybinds() {
        const saved = localStorage.getItem('minesweeper-keybinds');
        if (saved) {
            this.keybinds = JSON.parse(saved);
        }
        this.updateKeybindDisplay();
    }
    
    saveKeybinds() {
        localStorage.setItem('minesweeper-keybinds', JSON.stringify(this.keybinds));
    }
    
    updateKeybindDisplay() {
        const openKey = document.getElementById('open-key');
        const flagKey = document.getElementById('flag-key');
        if (openKey) openKey.textContent = this.keybinds.open.toUpperCase();
        if (flagKey) flagKey.textContent = this.keybinds.flag.toUpperCase();
    }
    
    setDifficulty(difficulty) {
        if (!this.difficulties[difficulty]) return;
        this.difficulty = difficulty;
        const config = this.difficulties[difficulty];
        this.rows = config.rows;
        this.cols = config.cols;
        this.mineCount = config.mines;
        this.saveSettings();
        this.createBoard();
        this.renderBoard();
        this.updateDisplay();
    }
    
    toggleTheme() {
        this.darkTheme = !this.darkTheme;
        this.saveSettings();
        this.applyTheme();
    }
    
    applyTheme() {
        document.body.classList.toggle('dark-theme', this.darkTheme);
    }
    
    createBoard() {
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
        this.revealed = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        this.flagged = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.currentRow = Math.floor(this.rows / 2);
        this.currentCol = Math.floor(this.cols / 2);
        this.timer = 0;
        this.probabilityCache.clear();
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    placeMines(excludeRow, excludeCol) {
        let placed = 0;
        while (placed < this.mineCount) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);
            
            // Don't place mine on first clicked cell or if already a mine
            if ((row === excludeRow && col === excludeCol) || this.board[row][col] === -1) {
                continue;
            }
            
            this.board[row][col] = -1; // -1 represents a mine
            placed++;
        }
        
        // Calculate numbers for each cell
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== -1) {
                    this.board[row][col] = this.countAdjacentMines(row, col);
                }
            }
        }
        
        this.probabilityCache.clear();
    }
    
    countAdjacentMines(row, col) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && this.board[newRow][newCol] === -1) {
                    count++;
                }
            }
        }
        return count;
    }
    
    isValidCell(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }
    
    revealCell(row, col) {
        if (this.gameOver || this.gameWon || this.flagged[row][col]) {
            return;
        }
        
        if (this.firstClick) {
            this.placeMines(row, col);
            this.firstClick = false;
            this.startTimer();
        }
        
        if (this.revealed[row][col]) {
            return;
        }
        
        this.revealed[row][col] = true;
        this.probabilityCache.clear();
        
        if (this.board[row][col] === -1) {
            this.gameOver = true;
            this.endGame(false);
            return;
        }
        
        // Auto-reveal adjacent cells if this cell has no adjacent mines
        if (this.board[row][col] === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (this.isValidCell(newRow, newCol) && !this.revealed[newRow][newCol] && !this.flagged[newRow][newCol]) {
                        this.revealCell(newRow, newCol);
                    }
                }
            }
        }
        
        this.checkWin();
        this.renderBoard();
    }
    
    toggleFlag(row, col) {
        if (this.gameOver || this.gameWon || this.revealed[row][col]) {
            return;
        }
        
        this.flagged[row][col] = !this.flagged[row][col];
        this.probabilityCache.clear();
        this.checkWin();
        this.renderBoard();
        this.updateDisplay();
    }
    
    checkWin() {
        let revealedCount = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.revealed[row][col]) {
                    revealedCount++;
                }
            }
        }
        
        const totalCells = this.rows * this.cols;
        if (revealedCount === totalCells - this.mineCount) {
            this.gameWon = true;
            this.endGame(true);
        }
    }
    
    endGame(won) {
        this.gameOver = true;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Reveal all mines
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === -1) {
                    this.revealed[row][col] = true;
                }
            }
        }
        
        this.renderBoard();
        
        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-over-title');
        const message = document.getElementById('game-over-message');
        
        if (won) {
            title.textContent = 'You Won!';
            message.textContent = `Congratulations! You cleared the minefield in ${this.timer} seconds!`;
        } else {
            title.textContent = 'Game Over';
            message.textContent = 'You hit a mine! Better luck next time.';
        }
        
        modal.classList.add('active');
    }
    
    calculateProbability(row, col) {
        if (this.revealed[row][col] || this.flagged[row][col]) {
            return null;
        }
        
        const cacheKey = `${row},${col}`;
        if (this.probabilityCache.has(cacheKey)) {
            return this.probabilityCache.get(cacheKey);
        }
        
        // Find all revealed cells that constrain this cell
        const constraints = [];
        
        // Check all adjacent revealed cells
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && this.revealed[newRow][newCol]) {
                    const value = this.board[newRow][newCol];
                    if (value > 0) {
                        // Count unrevealed, unflagged cells adjacent to this revealed cell
                        const unrevealedAdjacent = [];
                        for (let dr2 = -1; dr2 <= 1; dr2++) {
                            for (let dc2 = -1; dc2 <= 1; dc2++) {
                                if (dr2 === 0 && dc2 === 0) continue;
                                const adjRow = newRow + dr2;
                                const adjCol = newCol + dc2;
                                if (this.isValidCell(adjRow, adjCol) && 
                                    !this.revealed[adjRow][adjCol] && 
                                    !this.flagged[adjRow][adjCol]) {
                                    unrevealedAdjacent.push({ row: adjRow, col: adjCol });
                                }
                            }
                        }
                        
                        if (unrevealedAdjacent.length > 0) {
                            // Check if current cell is in this constraint
                            const isInConstraint = unrevealedAdjacent.some(cell => cell.row === row && cell.col === col);
                            if (isInConstraint) {
                                const flaggedCount = this.countFlaggedAdjacent(newRow, newCol);
                                const minesNeeded = value - flaggedCount;
                                
                                if (minesNeeded < 0 || minesNeeded > unrevealedAdjacent.length) {
                                    continue; // Invalid constraint
                                }
                                
                                constraints.push({
                                    revealedRow: newRow,
                                    revealedCol: newCol,
                                    value: value,
                                    minesNeeded: minesNeeded,
                                    unrevealedCount: unrevealedAdjacent.length,
                                    probability: minesNeeded / unrevealedAdjacent.length
                                });
                            }
                        }
                    }
                }
            }
        }
        
        if (constraints.length === 0) {
            this.probabilityCache.set(cacheKey, null);
            return null;
        }
        
        // Use the maximum probability (if one constraint says 100%, it's 100%)
        // But also consider: if minesNeeded === unrevealedCount, it's 100%
        let maxProbability = 0;
        let hasCertainty = false;
        
        for (const constraint of constraints) {
            if (constraint.minesNeeded === constraint.unrevealedCount) {
                // All unrevealed cells must be mines
                maxProbability = 1;
                hasCertainty = true;
                break;
            } else if (constraint.minesNeeded === 0) {
                // None of the unrevealed cells are mines
                maxProbability = Math.max(maxProbability, 0);
            } else {
                maxProbability = Math.max(maxProbability, constraint.probability);
            }
        }
        
        // If we have certainty (100%), return it
        if (hasCertainty) {
            this.probabilityCache.set(cacheKey, 1);
            return 1;
        }
        
        // For overlapping constraints, use weighted average
        // Constraints with fewer possibilities get more weight
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (const constraint of constraints) {
            // Weight inversely proportional to number of possibilities
            const weight = 1 / constraint.unrevealedCount;
            weightedSum += constraint.probability * weight;
            totalWeight += weight;
        }
        
        const finalProbability = totalWeight > 0 ? weightedSum / totalWeight : maxProbability;
        const result = Math.min(1, Math.max(0, finalProbability));
        
        this.probabilityCache.set(cacheKey, result);
        return result;
    }
    
    getProbabilityExplanation(row, col) {
        if (this.revealed[row][col] || this.flagged[row][col]) {
            return null;
        }
        
        const constraints = [];
        
        // Find all revealed cells that constrain this cell
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && this.revealed[newRow][newCol]) {
                    const value = this.board[newRow][newCol];
                    if (value > 0) {
                        const unrevealedAdjacent = [];
                        for (let dr2 = -1; dr2 <= 1; dr2++) {
                            for (let dc2 = -1; dc2 <= 1; dc2++) {
                                if (dr2 === 0 && dc2 === 0) continue;
                                const adjRow = newRow + dr2;
                                const adjCol = newCol + dc2;
                                if (this.isValidCell(adjRow, adjCol) && 
                                    !this.revealed[adjRow][adjCol] && 
                                    !this.flagged[adjRow][adjCol]) {
                                    unrevealedAdjacent.push({ row: adjRow, col: adjCol });
                                }
                            }
                        }
                        
                        const isInConstraint = unrevealedAdjacent.some(cell => cell.row === row && cell.col === col);
                        if (isInConstraint && unrevealedAdjacent.length > 0) {
                            const flaggedCount = this.countFlaggedAdjacent(newRow, newCol);
                            const minesNeeded = value - flaggedCount;
                            
                            if (minesNeeded >= 0 && minesNeeded <= unrevealedAdjacent.length) {
                                constraints.push({
                                    revealedRow: newRow,
                                    revealedCol: newCol,
                                    value: value,
                                    minesNeeded: minesNeeded,
                                    unrevealedCount: unrevealedAdjacent.length,
                                    probability: minesNeeded / unrevealedAdjacent.length
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return constraints;
    }
    
    showProbabilityExplanation(row, col) {
        if (!this.showProbabilities) {
            return;
        }
        
        const explanation = this.getProbabilityExplanation(row, col);
        const explanationDiv = document.getElementById('probability-explanation');
        const contentDiv = document.getElementById('explanation-content');
        
        if (!explanation || explanation.length === 0) {
            explanationDiv.style.display = 'none';
            return;
        }
        
        const probability = this.calculateProbability(row, col);
        if (probability === null) {
            explanationDiv.style.display = 'none';
            return;
        }
        
        let html = `<p><strong>Cell (${row + 1}, ${col + 1}): ${Math.round(probability * 100)}%</strong></p>`;
        html += '<p>Based on constraints:</p><ul>';
        
        for (const constraint of explanation) {
            const cellLabel = `Cell (${constraint.revealedRow + 1}, ${constraint.revealedCol + 1})`;
            html += `<li>${cellLabel} shows ${constraint.value}. `;
            html += `Needs ${constraint.minesNeeded} mine(s) in ${constraint.unrevealedCount} unrevealed cell(s). `;
            html += `Probability: ${Math.round(constraint.probability * 100)}%</li>`;
        }
        
        html += '</ul>';
        contentDiv.innerHTML = html;
        explanationDiv.style.display = 'block';
    }
    
    countFlaggedAdjacent(row, col) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && this.flagged[newRow][newCol]) {
                    count++;
                }
            }
        }
        return count;
    }
    
    move(direction) {
        if (this.gameOver || this.gameWon) return;
        
        let newRow = this.currentRow;
        let newCol = this.currentCol;
        
        switch(direction) {
            case 'up':
                newRow = Math.max(0, this.currentRow - 1);
                break;
            case 'down':
                newRow = Math.min(this.rows - 1, this.currentRow + 1);
                break;
            case 'left':
                newCol = Math.max(0, this.currentCol - 1);
                break;
            case 'right':
                newCol = Math.min(this.cols - 1, this.currentCol + 1);
                break;
        }
        
        this.currentRow = newRow;
        this.currentCol = newCol;
        this.renderBoard();
    }
    
    renderBoard() {
        const boardElement = document.getElementById('game-board');
        boardElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        boardElement.innerHTML = '';
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                if (row === this.currentRow && col === this.currentCol) {
                    cell.classList.add('selected');
                }
                
                if (this.revealed[row][col]) {
                    cell.classList.add('opened');
                    if (this.board[row][col] === -1) {
                        cell.classList.add('mine');
                        cell.textContent = '💣';
                    } else if (this.board[row][col] > 0) {
                        cell.classList.add(`number-${this.board[row][col]}`);
                        cell.textContent = this.board[row][col];
                    }
                } else if (this.flagged[row][col]) {
                    cell.classList.add('flagged');
                    cell.textContent = '🚩';
                } else if (this.showProbabilities) {
                    const probability = this.calculateProbability(row, col);
                    if (probability !== null) {
                        cell.classList.add('probability');
                        cell.textContent = `${Math.round(probability * 100)}%`;
                    }
                }
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    updateDisplay() {
        let flagCount = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.flagged[row][col]) {
                    flagCount++;
                }
            }
        }
        
        document.getElementById('flag-count').textContent = flagCount;
        document.getElementById('mine-count').textContent = this.mineCount;
        document.getElementById('timer').textContent = this.timer;
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.updateDisplay();
        }, 1000);
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') {
                return;
            }
            
            const key = e.key.toLowerCase();
            
            // Navigation
            if (key === 'arrowup') {
                e.preventDefault();
                this.move('up');
            } else if (key === 'arrowdown') {
                e.preventDefault();
                this.move('down');
            } else if (key === 'arrowleft') {
                e.preventDefault();
                this.move('left');
            } else if (key === 'arrowright') {
                e.preventDefault();
                this.move('right');
            }
            
            // Actions
            if (key === this.keybinds.open) {
                e.preventDefault();
                this.revealCell(this.currentRow, this.currentCol);
                this.updateDisplay();
            } else if (key === this.keybinds.flag) {
                e.preventDefault();
                this.toggleFlag(this.currentRow, this.currentCol);
            } else if (key === 'c' && this.showProbabilities) {
                e.preventDefault();
                this.showProbabilityExplanation(this.currentRow, this.currentCol);
            }
        });
        
        // Difficulty selector
        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            this.setDifficulty(e.target.value);
        });
        
        // New game button
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.createBoard();
            this.renderBoard();
            this.updateDisplay();
        });
        
        // Probability toggle
        document.getElementById('probability-toggle').addEventListener('change', (e) => {
            this.showProbabilities = e.target.checked;
            this.probabilityCache.clear();
            this.renderBoard();
            if (!this.showProbabilities) {
                document.getElementById('probability-explanation').style.display = 'none';
            }
        });
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('change', (e) => {
            this.toggleTheme();
        });
        
        // Keybinds modal
        document.getElementById('keybinds-btn').addEventListener('click', () => {
            document.getElementById('keybind-modal').classList.add('active');
        });
        
        document.getElementById('close-keybinds').addEventListener('click', () => {
            document.getElementById('keybind-modal').classList.remove('active');
        });
        
        // Keybind rebinding
        const keybindButtons = document.querySelectorAll('.keybind-button');
        let waitingForKey = null;
        
        keybindButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (waitingForKey === button) {
                    // Cancel
                    waitingForKey.classList.remove('waiting');
                    waitingForKey = null;
                    return;
                }
                
                // Set waiting state
                if (waitingForKey) {
                    waitingForKey.classList.remove('waiting');
                }
                button.classList.add('waiting');
                waitingForKey = button;
                button.textContent = 'Press any key...';
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if (waitingForKey) {
                e.preventDefault();
                const key = e.key.toLowerCase();
                const action = waitingForKey.dataset.action;
                
                // Don't allow arrow keys or keys already in use
                if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                    return;
                }
                
                if (action === 'open' && key === this.keybinds.flag) {
                    alert('This key is already used for flagging!');
                    return;
                }
                
                if (action === 'flag' && key === this.keybinds.open) {
                    alert('This key is already used for opening!');
                    return;
                }
                
                this.keybinds[action] = key;
                waitingForKey.textContent = key.toUpperCase();
                waitingForKey.classList.remove('waiting');
                waitingForKey = null;
                
                this.saveKeybinds();
                this.updateKeybindDisplay();
            }
        });
        
        // Play again button
        document.getElementById('play-again-btn').addEventListener('click', () => {
            document.getElementById('game-over-modal').classList.remove('active');
            this.createBoard();
            this.renderBoard();
            this.updateDisplay();
        });
        
        // Close modal on outside click
        document.getElementById('keybind-modal').addEventListener('click', (e) => {
            if (e.target.id === 'keybind-modal') {
                document.getElementById('keybind-modal').classList.remove('active');
            }
        });
        
        document.getElementById('game-over-modal').addEventListener('click', (e) => {
            if (e.target.id === 'game-over-modal') {
                document.getElementById('game-over-modal').classList.remove('active');
            }
        });
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MinesweeperGame();
});

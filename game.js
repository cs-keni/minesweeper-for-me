class MinesweeperGame {
    constructor() {
        this.difficulties = {
            beginner: { rows: 9, cols: 9, mines: 10 },
            intermediate: { rows: 16, cols: 16, mines: 40 },
            advanced: { rows: 20, cols: 26, mines: 110 }
        };
        
        this.rows = 20;
        this.cols = 26;
        this.mineCount = 110;
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
        this.debugMode = false;
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
        this.setupEventListeners();
        this.updateDisplay();
        this.applyTheme();
        this.calculateCellSize();
        this.renderBoard();
        window.addEventListener('resize', () => {
            this.calculateCellSize();
            if (this.debugMode) {
                setTimeout(() => this.updateDebugOverlay(), 0);
            }
        });
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
        this.renderBoard(true);
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
    
    placeMines(excludeRow, excludeCol, isFirstClick = false) {
        let placed = 0;
        
        // Create a set of excluded cells (for first click, exclude clicked cell and all adjacent cells)
        const excludedCells = new Set();
        if (isFirstClick) {
            // Exclude the clicked cell and all its neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = excludeRow + dr;
                    const newCol = excludeCol + dc;
                    if (this.isValidCell(newRow, newCol)) {
                        excludedCells.add(`${newRow},${newCol}`);
                    }
                }
            }
        } else {
            excludedCells.add(`${excludeRow},${excludeCol}`);
        }
        
        while (placed < this.mineCount) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);
            
            // Don't place mine on excluded cells or if already a mine
            if (excludedCells.has(`${row},${col}`) || this.board[row][col] === -1) {
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
        
        const wasFirstClick = this.firstClick;
        
        if (this.firstClick) {
            this.placeMines(row, col, true);
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
        
        // On first click, reveal a larger area for a good starting position
        if (wasFirstClick) {
            this.revealStartingArea(row, col);
        }
        
        this.checkWin();
        this.renderBoard();
        if (this.debugMode) {
            this.updateDebugOverlay();
        }
    }
    
    revealStartingArea(startRow, startCol) {
        // Reveal all cells within 2 cells distance that are safe (have no adjacent mines)
        // This ensures a good starting area without relying on luck
        const cellsToCheck = [{ row: startRow, col: startCol }];
        const revealed = new Set();
        
        while (cellsToCheck.length > 0) {
            const { row, col } = cellsToCheck.shift();
            const key = `${row},${col}`;
            
            if (revealed.has(key) || !this.isValidCell(row, col) || this.revealed[row][col] || this.flagged[row][col]) {
                continue;
            }
            
            revealed.add(key);
            this.revealed[row][col] = true;
            
            // If this cell has no adjacent mines, check its neighbors
            if (this.board[row][col] === 0) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const newRow = row + dr;
                        const newCol = col + dc;
                        const newKey = `${newRow},${newCol}`;
                        
                        // Only add if within 2 cells distance from start and not already processed
                        const distance = Math.max(Math.abs(newRow - startRow), Math.abs(newCol - startCol));
                        if (distance <= 2 && !revealed.has(newKey) && this.isValidCell(newRow, newCol)) {
                            cellsToCheck.push({ row: newRow, col: newCol });
                        }
                    }
                }
            }
        }
        
        this.probabilityCache.clear();
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
        
        // Check for certainties first - these take absolute priority
        let hasZeroCertainty = false;
        let hasOneHundredCertainty = false;
        
        for (const constraint of constraints) {
            if (constraint.minesNeeded === constraint.unrevealedCount) {
                // All unrevealed cells must be mines - 100% certainty
                hasOneHundredCertainty = true;
                break;
            } else if (constraint.minesNeeded === 0) {
                // None of the unrevealed cells are mines - 0% certainty
                hasZeroCertainty = true;
            }
        }
        
        // If we have 100% certainty, return it immediately
        if (hasOneHundredCertainty) {
            this.probabilityCache.set(cacheKey, 1);
            return 1;
        }
        
        // If we have 0% certainty (any constraint says no mines needed), return 0 immediately
        if (hasZeroCertainty) {
            this.probabilityCache.set(cacheKey, 0);
            return 0;
        }
        
        // For overlapping constraints without certainties, use weighted average
        // Constraints with fewer possibilities get more weight
        let weightedSum = 0;
        let totalWeight = 0;
        let maxProbability = 0;
        
        for (const constraint of constraints) {
            // Weight inversely proportional to number of possibilities
            const weight = 1 / constraint.unrevealedCount;
            weightedSum += constraint.probability * weight;
            totalWeight += weight;
            maxProbability = Math.max(maxProbability, constraint.probability);
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
        const modal = document.getElementById('probability-modal');
        const contentDiv = document.getElementById('probability-modal-content');
        
        if (!explanation || explanation.length === 0) {
            modal.classList.remove('active');
            return;
        }
        
        const probability = this.calculateProbability(row, col);
        if (probability === null) {
            modal.classList.remove('active');
            return;
        }
        
        // Build the explanation HTML
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
        
        // Position the modal near the cell with arrow pointer
        const boardElement = document.getElementById('game-board');
        const cellElement = boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        if (cellElement) {
            const cellRect = cellElement.getBoundingClientRect();
            const modalContent = modal.querySelector('.probability-modal-content');
            
            // Remove any existing arrow classes
            modalContent.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
            
            // Force a reflow to get accurate dimensions (temporarily show modal)
            const wasVisible = modal.classList.contains('active');
            if (!wasVisible) {
                modal.style.visibility = 'hidden';
                modal.classList.add('active');
            }
            const modalRect = modalContent.getBoundingClientRect();
            if (!wasVisible) {
                modal.classList.remove('active');
                modal.style.visibility = '';
            }
            
            // Calculate available space
            const spaceAbove = cellRect.top;
            const spaceBelow = window.innerHeight - cellRect.bottom;
            const spaceLeft = cellRect.left;
            const spaceRight = window.innerWidth - cellRect.right;
            
            const arrowSize = 10;
            const gap = 15; // Gap between cell and modal
            
            let top, left, arrowPosition, arrowClass;
            
            // Prefer positioning above the cell
            if (spaceAbove >= modalRect.height + gap + arrowSize) {
                top = cellRect.top - modalRect.height - gap - arrowSize;
                left = cellRect.left + (cellRect.width / 2) - (modalRect.width / 2);
                arrowPosition = cellRect.left + (cellRect.width / 2) - left;
                arrowClass = 'arrow-bottom';
            }
            // Otherwise try below
            else if (spaceBelow >= modalRect.height + gap + arrowSize) {
                top = cellRect.bottom + gap + arrowSize;
                left = cellRect.left + (cellRect.width / 2) - (modalRect.width / 2);
                arrowPosition = cellRect.left + (cellRect.width / 2) - left;
                arrowClass = 'arrow-top';
            }
            // Try to the right
            else if (spaceRight >= modalRect.width + gap + arrowSize) {
                top = cellRect.top + (cellRect.height / 2) - (modalRect.height / 2);
                left = cellRect.right + gap + arrowSize;
                arrowPosition = cellRect.top + (cellRect.height / 2) - top;
                arrowClass = 'arrow-left';
            }
            // Try to the left
            else if (spaceLeft >= modalRect.width + gap + arrowSize) {
                top = cellRect.top + (cellRect.height / 2) - (modalRect.height / 2);
                left = cellRect.left - modalRect.width - gap - arrowSize;
                arrowPosition = cellRect.top + (cellRect.height / 2) - top;
                arrowClass = 'arrow-right';
            }
            // Fallback: position above even if tight
            else {
                top = Math.max(10, cellRect.top - modalRect.height - gap - arrowSize);
                left = cellRect.left + (cellRect.width / 2) - (modalRect.width / 2);
                arrowPosition = cellRect.left + (cellRect.width / 2) - left;
                arrowClass = 'arrow-bottom';
            }
            
            // Keep arrow within modal bounds
            arrowPosition = Math.max(20, Math.min(arrowPosition, modalRect.width - 20));
            
            // Adjust if modal would go off screen
            if (left < 10) {
                left = 10;
                arrowPosition = cellRect.left + (cellRect.width / 2) - left;
            } else if (left + modalRect.width > window.innerWidth - 10) {
                left = window.innerWidth - modalRect.width - 10;
                arrowPosition = cellRect.left + (cellRect.width / 2) - left;
            }
            
            if (top < 10) {
                top = 10;
            }
            
            modal.style.top = `${top}px`;
            modal.style.left = `${left}px`;
            modalContent.classList.add(arrowClass);
            modalContent.style.setProperty('--arrow-position', `${arrowPosition}px`);
        }
        
        modal.classList.add('active');
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
        
        // Close probability modal when moving
        document.getElementById('probability-modal').classList.remove('active');
        
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
    
    calculateCellSize() {
        const boardContainer = document.querySelector('.game-board-container');
        const container = document.querySelector('.container');
        if (!boardContainer || !container) return;
        
        // Get available space - use viewport dimensions for more accurate calculation
        const header = document.querySelector('header');
        const controls = document.querySelector('.controls');
        const instructions = document.querySelector('.instructions');
        
        // Calculate used vertical space more accurately
        const headerHeight = header ? header.offsetHeight : 120;
        const controlsHeight = controls ? controls.offsetHeight : 50;
        const instructionsHeight = instructions && instructions.offsetParent !== null ? instructions.offsetHeight : 0;
        const containerPadding = 60; // Container padding top + bottom
        const containerMargin = 20; // Margin bottom for board container
        
        // Get the actual container width, accounting for body padding
        const bodyPadding = 40; // 20px on each side
        const containerRect = container.getBoundingClientRect();
        const containerPaddingHorizontal = 60; // 30px on each side
        
        // Available width: use the actual container width minus its padding
        // This ensures we account for the container's max-width constraint
        let availableWidth = Math.min(
            window.innerWidth - bodyPadding,
            containerRect.width - containerPaddingHorizontal,
            container.offsetWidth - containerPaddingHorizontal
        );
        
        // Ensure we have a positive value
        if (availableWidth <= 0) {
            // Fallback: use a reasonable minimum
            availableWidth = Math.max(200, window.innerWidth - bodyPadding - containerPaddingHorizontal);
        }
        
        // Use viewport height minus all UI elements
        const availableHeight = window.innerHeight - headerHeight - controlsHeight - instructionsHeight - containerPadding - containerMargin;
        
        // Gap size scales with cell size (approximately 5.7% of cell size based on CSS)
        // gap = cellSize * 0.057, boardPadding = cellSize * 0.057
        // totalWidth = cols * cellSize + (cols - 1) * gap + 2 * boardPadding
        // totalWidth = cols * cellSize + (cols - 1) * cellSize * 0.057 + 2 * cellSize * 0.057
        // totalWidth = cellSize * (cols + (cols - 1) * 0.057 + 2 * 0.057)
        // totalWidth = cellSize * (cols + cols * 0.057 - 0.057 + 0.114)
        // totalWidth = cellSize * (cols * 1.057 + 0.057)
        
        // Solving for cellSize:
        // cellSize = totalWidth / (cols * 1.057 + 0.057)
        
        const widthFactor = this.cols * 1.057 + 0.057;
        const heightFactor = this.rows * 1.057 + 0.057;
        
        // Calculate max cell size that fits both width and height
        const maxWidthCellSize = availableWidth / widthFactor;
        const maxHeightCellSize = availableHeight / heightFactor;
        
        // Use the smaller of the two to ensure everything fits without scrolling
        let cellSize = Math.min(maxWidthCellSize, maxHeightCellSize);
        
        // Set minimum and maximum cell sizes for usability
        // Allow smaller cells for very small windows, but we'll adjust font size for readability
        const minCellSize = 16; // Absolute minimum (very small windows)
        const maxCellSize = 50; // Maximum cell size (prevents cells from getting too large)
        
        // Apply min/max constraints
        cellSize = Math.max(minCellSize, Math.min(maxCellSize, cellSize));
        
        // Calculate font size based on cell size with readability thresholds
        // Above 22px: use 40% of cell size for optimal readability
        // 18-22px: use 45% to maintain readability
        // Below 18px: use 50% to maximize readability in cramped spaces
        let fontSizeRatio;
        if (cellSize >= 22) {
            fontSizeRatio = 0.4; // Optimal readability
        } else if (cellSize >= 18) {
            fontSizeRatio = 0.45; // Good readability
        } else {
            fontSizeRatio = 0.5; // Maximum readability for small cells
        }
        
        // Calculate probability font size (75% of cell font size for readability)
        const probabilityFontSize = cellSize * fontSizeRatio * 0.75;
        
        // Apply the cell size and font sizes as CSS variables
        document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
        document.documentElement.style.setProperty('--cell-font-size', `${cellSize * fontSizeRatio}px`);
        document.documentElement.style.setProperty('--probability-font-size', `${probabilityFontSize}px`);
        
        // Ensure board container doesn't overflow
        boardContainer.style.overflow = 'visible';
        boardContainer.style.maxWidth = '100%';
        
        // Update debug overlay if enabled
        if (this.debugMode) {
            // Use setTimeout to ensure DOM has updated
            setTimeout(() => this.updateDebugOverlay(), 0);
        }
    }
    
    renderBoard(recalculateSize = false) {
        const boardElement = document.getElementById('game-board');
        boardElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        boardElement.innerHTML = '';
        
        // Only recalculate cell size if explicitly requested (e.g., on resize or difficulty change)
        if (recalculateSize) {
            this.calculateCellSize();
        }
        
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
        
        if (this.debugMode) {
            this.updateDebugOverlay();
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
    
    updateDebugOverlay() {
        const overlay = document.getElementById('debug-overlay');
        if (!overlay) return;
        
        if (!this.debugMode) {
            overlay.style.display = 'none';
            return;
        }
        
        overlay.style.display = 'block';
        
        // Calculate revealed and flagged counts
        let revealedCount = 0;
        let flaggedCount = 0;
        let mineRevealedCount = 0;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.revealed[row][col]) {
                    revealedCount++;
                    if (this.board[row][col] === -1) {
                        mineRevealedCount++;
                    }
                }
                if (this.flagged[row][col]) {
                    flaggedCount++;
                }
            }
        }
        
        const totalCells = this.rows * this.cols;
        const remainingCells = totalCells - revealedCount;
        const remainingMines = this.mineCount - flaggedCount;
        
        // Get current cell info
        const currentCell = this.board[this.currentRow][this.currentCol];
        const currentCellRevealed = this.revealed[this.currentRow][this.currentCol];
        const currentCellFlagged = this.flagged[this.currentRow][this.currentCol];
        const currentCellProbability = this.calculateProbability(this.currentRow, this.currentCol);
        
        // Build debug info HTML
        let html = '<h4>Debug Information</h4>';
        html += '<div class="debug-info">';
        
        html += '<div class="debug-section">';
        html += '<strong>Game State</strong>';
        html += `Game Over: ${this.gameOver ? 'Yes' : 'No'}<br>`;
        html += `Game Won: ${this.gameWon ? 'Yes' : 'No'}<br>`;
        html += `First Click: ${this.firstClick ? 'Yes' : 'No'}<br>`;
        html += `Timer: ${this.timer}s<br>`;
        html += '</div>';
        
        html += '<div class="debug-section">';
        html += '<strong>Board Statistics</strong>';
        html += `Total Cells: ${totalCells}<br>`;
        html += `Revealed: ${revealedCount}<br>`;
        html += `Remaining: ${remainingCells}<br>`;
        html += `Mines: ${this.mineCount}<br>`;
        html += `Flagged: ${flaggedCount}<br>`;
        html += `Remaining Mines: ${remainingMines}<br>`;
        html += `Mines Revealed: ${mineRevealedCount}<br>`;
        html += '</div>';
        
        html += '<div class="debug-section">';
        html += '<strong>Current Cell</strong>';
        html += `Position: (${this.currentRow + 1}, ${this.currentCol + 1})<br>`;
        html += `Value: ${currentCell === -1 ? 'MINE' : currentCell}<br>`;
        html += `Revealed: ${currentCellRevealed ? 'Yes' : 'No'}<br>`;
        html += `Flagged: ${currentCellFlagged ? 'Yes' : 'No'}<br>`;
        if (currentCellProbability !== null) {
            html += `Probability: ${Math.round(currentCellProbability * 100)}%<br>`;
        } else {
            html += `Probability: N/A<br>`;
        }
        html += '</div>';
        
        html += '<div class="debug-section">';
        html += '<strong>Settings</strong>';
        html += `Difficulty: ${this.difficulty}<br>`;
        html += `Rows: ${this.rows}, Cols: ${this.cols}<br>`;
        html += `Show Probabilities: ${this.showProbabilities ? 'Yes' : 'No'}<br>`;
        html += `Dark Theme: ${this.darkTheme ? 'Yes' : 'No'}<br>`;
        html += '</div>';
        
        html += '</div>';
        
        overlay.innerHTML = html;
        
        // Position the overlay in the top-right corner
        overlay.style.position = 'fixed';
        overlay.style.top = '20px';
        overlay.style.right = '20px';
        overlay.style.left = 'auto';
        overlay.style.bottom = 'auto';
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
                const modal = document.getElementById('probability-modal');
                // Toggle modal - close if already open for this cell, otherwise show
                if (modal.classList.contains('active')) {
                    modal.classList.remove('active');
                } else {
                    this.showProbabilityExplanation(this.currentRow, this.currentCol);
                }
            } else if (key === 'v') {
                e.preventDefault();
                // Toggle show probabilities
                this.showProbabilities = !this.showProbabilities;
                const toggle = document.getElementById('probability-toggle');
                if (toggle) {
                    toggle.checked = this.showProbabilities;
                }
                this.probabilityCache.clear();
                this.renderBoard(false);
                if (!this.showProbabilities) {
                    document.getElementById('probability-explanation').style.display = 'none';
                    document.getElementById('probability-modal').classList.remove('active');
                }
            } else if (e.key === 'Escape') {
                // Close probability modal on ESC
                document.getElementById('probability-modal').classList.remove('active');
            } else if (key === 'r' && (this.gameOver || this.gameWon)) {
                // Restart game with 'r' key when game is over
                e.preventDefault();
                document.getElementById('game-over-modal').classList.remove('active');
                this.createBoard();
                this.renderBoard(true);
                this.updateDisplay();
            }
        });
        
        // Difficulty selector
        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            this.setDifficulty(e.target.value);
        });
        
        // New game button
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.createBoard();
            this.renderBoard(true);
            this.updateDisplay();
        });
        
        // Probability toggle
        document.getElementById('probability-toggle').addEventListener('change', (e) => {
            this.showProbabilities = e.target.checked;
            this.probabilityCache.clear();
            this.renderBoard(false);
            if (!this.showProbabilities) {
                document.getElementById('probability-explanation').style.display = 'none';
                document.getElementById('probability-modal').classList.remove('active');
            }
        });
        
        // Debug toggle
        document.getElementById('debug-toggle').addEventListener('change', (e) => {
            this.debugMode = e.target.checked;
            this.updateDebugOverlay();
        });
        
        // Close probability modal
        document.getElementById('close-probability-modal').addEventListener('click', () => {
            document.getElementById('probability-modal').classList.remove('active');
        });
        
        // Close probability modal when clicking outside
        document.getElementById('probability-modal').addEventListener('click', (e) => {
            if (e.target.id === 'probability-modal') {
                document.getElementById('probability-modal').classList.remove('active');
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
            this.renderBoard(true);
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

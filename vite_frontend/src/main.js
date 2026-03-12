import "./style.css";

/**
 * Deterministic Tic-Tac-Toe (no AI, no randomness).
 * Goals:
 * - Stable DOM hooks for Playwright (data-testid).
 * - Accessible structure: semantic headings, buttons, ARIA where needed.
 * - Deterministic behavior: the same actions always yield the same state.
 */

/** @typedef {'X'|'O'} Player */
/** @typedef {Player|''} CellValue */

/**
 * @typedef GameState
 * @property {CellValue[]} board - 9 cells, row-major.
 * @property {Player} nextPlayer - Whose turn is next.
 * @property {number|null} winnerLineStart - Index of first cell in winning line (0..8) if winner exists.
 * @property {Player|null} winner - Winner if game is won.
 * @property {boolean} isDraw - True if board full and no winner.
 * @property {number} moves - Number of moves made.
 */

/**
 * @returns {GameState}
 */
function getInitialState() {
  return {
    board: Array(9).fill(""),
    nextPlayer: "X",
    winnerLineStart: null,
    winner: null,
    isDraw: false,
    moves: 0,
  };
}

/**
 * Winning lines (indices in row-major order).
 * Deterministic ordering is important: if multiple lines were possible (rare in standard play),
 * the first matching line here is used.
 */
const WINNING_LINES = [
  // rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // cols
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // diagonals
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * @param {CellValue[]} board
 * @returns {{ winner: Player|null, winningLine: number[]|null }}
 */
function calculateWinner(board) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return { winner: v, winningLine: line };
    }
  }
  return { winner: null, winningLine: null };
}

/**
 * @param {CellValue[]} board
 * @returns {boolean}
 */
function isBoardFull(board) {
  return board.every((c) => c !== "");
}

/**
 * @param {number} index
 * @returns {{ row: number, col: number }}
 */
function indexToRowCol(index) {
  return { row: Math.floor(index / 3), col: index % 3 };
}

/**
 * Create the application root markup once, then update via render().
 * Uses:
 * - data-testid for stable selectors
 * - role/aria-label for accessibility and robust Playwright queries by role
 */
function mountApp() {
  const app = document.querySelector("#app");
  if (!app) throw new Error("Missing #app root element");

  app.innerHTML = `
    <main class="app" data-testid="app-root">
      <header class="app__header">
        <h1 class="app__title" data-testid="app-title">Tic-Tac-Toe</h1>
        <p class="app__subtitle" data-testid="app-subtitle">
          Deterministic UI for Playwright E2E testing
        </p>
      </header>

      <section class="panel" aria-label="Game status and controls">
        <div class="status" data-testid="game-status" role="status" aria-live="polite"></div>

        <div class="controls" data-testid="controls">
          <button
            type="button"
            class="btn"
            data-testid="reset-button"
            aria-label="Reset game"
          >
            Reset
          </button>

          <label class="toggle" data-testid="highlight-toggle">
            <input
              type="checkbox"
              data-testid="highlight-winning-toggle"
              aria-label="Highlight winning line"
              checked
            />
            <span>Highlight win</span>
          </label>
        </div>
      </section>

      <section class="boardSection" aria-label="Tic-tac-toe board">
        <div
          class="board"
          data-testid="board"
          role="grid"
          aria-label="Tic-tac-toe board"
        >
          ${Array.from({ length: 9 })
            .map((_, i) => {
              const { row, col } = indexToRowCol(i);
              // role="gridcell" pairs well with a parent role="grid"
              return `
                <button
                  type="button"
                  class="cell"
                  data-testid="cell-${i}"
                  data-row="${row}"
                  data-col="${col}"
                  role="gridcell"
                  aria-label="Cell ${row + 1}, ${col + 1}"
                ></button>
              `;
            })
            .join("")}
        </div>

        <div class="meta" data-testid="game-meta" aria-label="Game metadata">
          <div class="meta__item">
            <span class="meta__label">Next:</span>
            <span class="meta__value" data-testid="next-player"></span>
          </div>
          <div class="meta__item">
            <span class="meta__label">Moves:</span>
            <span class="meta__value" data-testid="move-count"></span>
          </div>
        </div>
      </section>

      <footer class="footer" data-testid="footer">
        <details class="help" data-testid="help">
          <summary aria-label="Testing hooks and selectors help">Testing hooks</summary>
          <div class="help__content">
            <p>
              Prefer querying by role/label when possible:
              <code>getByRole('grid', { name: /tic-tac-toe board/i })</code>,
              <code>getByRole('button', { name: /reset game/i })</code>.
            </p>
            <p>
              Stable fallbacks via <code>data-testid</code>:
              <code>[data-testid="cell-0"]</code>,
              <code>[data-testid="game-status"]</code>.
            </p>
          </div>
        </details>
      </footer>
    </main>
  `;
}

/**
 * Centralized state and rendering.
 * No async work, no randomness.
 */
const model = {
  state: getInitialState(),
  highlightWin: true,
};

/**
 * @returns {HTMLElement}
 */
function elApp() {
  const el = document.querySelector('[data-testid="app-root"]');
  if (!el) throw new Error("App root not mounted");
  return /** @type {HTMLElement} */ (el);
}

/**
 * @param {string} testId
 * @returns {HTMLElement}
 */
function byTestId(testId) {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!el) throw new Error(`Missing element data-testid="${testId}"`);
  return /** @type {HTMLElement} */ (el);
}

/**
 * Render the full UI based on model.state.
 */
function render() {
  const { board, nextPlayer, winner, isDraw, moves } = model.state;

  const statusEl = byTestId("game-status");
  const nextEl = byTestId("next-player");
  const movesEl = byTestId("move-count");

  const statusText = winner
    ? `Winner: ${winner}`
    : isDraw
      ? "Draw"
      : `Next player: ${nextPlayer}`;

  statusEl.textContent = statusText;
  nextEl.textContent = winner || isDraw ? "—" : nextPlayer;
  movesEl.textContent = String(moves);

  // Apply board values and disable rules deterministically:
  // - A filled cell is not clickable
  // - No moves allowed after win/draw
  // - Provide aria-disabled to communicate state
  for (let i = 0; i < 9; i += 1) {
    const cellBtn = /** @type {HTMLButtonElement} */ (byTestId(`cell-${i}`));
    const value = board[i];

    cellBtn.textContent = value || "";
    cellBtn.dataset.value = value || "";
    cellBtn.setAttribute("aria-label", `${cellBtn.getAttribute("aria-label")}${value ? `, ${value}` : ""}`);

    const isGameOver = Boolean(winner) || isDraw;
    const disabled = isGameOver || value !== "";
    cellBtn.disabled = disabled;
    cellBtn.setAttribute("aria-disabled", disabled ? "true" : "false");

    // Winning highlight (toggleable)
    cellBtn.classList.toggle("cell--filled", value !== "");
    cellBtn.classList.remove("cell--win");

    if (model.highlightWin && winner) {
      const { winningLine } = calculateWinner(board);
      if (winningLine && winningLine.includes(i)) {
        cellBtn.classList.add("cell--win");
      }
    }
  }

  // Keep checkbox in sync
  const highlightToggle = /** @type {HTMLInputElement} */ (
    byTestId("highlight-winning-toggle")
  );
  highlightToggle.checked = model.highlightWin;

  // Provide deterministic state snapshot for E2E tests
  // (stringified board is stable and easy to assert)
  const root = elApp();
  root.dataset.nextPlayer = model.state.nextPlayer;
  root.dataset.winner = model.state.winner || "";
  root.dataset.isDraw = model.state.isDraw ? "true" : "false";
  root.dataset.moves = String(model.state.moves);
  root.dataset.board = model.state.board.map((c) => c || "-").join("");
}

/**
 * Attempt to play a move.
 * @param {number} index
 */
function playMove(index) {
  const state = model.state;

  // Ignore any move if game already ended or cell occupied.
  if (state.winner || state.isDraw || state.board[index]) return;

  /** @type {CellValue[]} */
  const nextBoard = state.board.slice();
  nextBoard[index] = state.nextPlayer;

  const { winner, winningLine } = calculateWinner(nextBoard);
  const draw = !winner && isBoardFull(nextBoard);

  model.state = {
    board: nextBoard,
    nextPlayer: state.nextPlayer === "X" ? "O" : "X",
    winnerLineStart: winningLine ? winningLine[0] : null,
    winner,
    isDraw: draw,
    moves: state.moves + 1,
  };

  render();
}

/**
 * Reset to initial state.
 */
function resetGame() {
  model.state = getInitialState();
  render();
}

/**
 * Wire up all event listeners exactly once.
 */
function bindEvents() {
  // Board cell clicks (event delegation; stable for E2E and performance)
  const boardEl = byTestId("board");
  boardEl.addEventListener("click", (e) => {
    // Avoid relying on global DOM constructors (HTMLElement/Element) so ESLint `no-undef` never triggers.
    const target = /** @type {unknown} */ (e.target);
    if (!target || typeof target !== "object") return;

    // Guard: only proceed if the target supports closest()
    const maybeElement = /** @type {{ closest?: (selector: string) => Element | null }} */ (target);
    if (typeof maybeElement.closest !== "function") return;

    const btn = maybeElement.closest('button[data-testid^="cell-"]');
    if (!btn) return;

    const testId = btn.getAttribute("data-testid") || "";
    const match = testId.match(/^cell-(\d)$/);
    if (!match) return;

    playMove(Number(match[1]));
  });

  // Reset button
  const resetBtn = /** @type {HTMLButtonElement} */ (byTestId("reset-button"));
  resetBtn.addEventListener("click", () => resetGame());

  // Highlight toggle
  const highlightToggle = /** @type {HTMLInputElement} */ (
    byTestId("highlight-winning-toggle")
  );
  highlightToggle.addEventListener("change", () => {
    model.highlightWin = highlightToggle.checked;
    render();
  });

  // Small keyboard helper: allow Enter/Space on focused cell (button already handles this),
  // but we keep it explicit and deterministic for safety across environments.
  const appRoot = elApp();
  appRoot.addEventListener("keydown", (e) => {
    const target = /** @type {unknown} */ (e.target);
    if (!target || typeof target !== "object") return;

    const maybeElement = /** @type {{ closest?: (selector: string) => Element | null }} */ (target);
    if (typeof maybeElement.closest !== "function") return;

    const btn = maybeElement.closest('button[data-testid^="cell-"]');
    if (!btn) return;
    if (e.key !== "Enter" && e.key !== " ") return;

    const testId = btn.getAttribute("data-testid") || "";
    const match = testId.match(/^cell-(\d)$/);
    if (!match) return;

    e.preventDefault();
    playMove(Number(match[1]));
  });
}

mountApp();
bindEvents();
render();

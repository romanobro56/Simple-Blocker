// DOM elements
const minutesInput = document.getElementById('minutesInput');
const goButton = document.getElementById('goButton');
const buttonText = document.getElementById('buttonText');
const statusText = document.getElementById('statusText');
const timerSection = document.getElementById('timerSection');
const timerDisplay = document.getElementById('timerDisplay');
const timerLabel = document.getElementById('timerLabel');
const mainProgressContainer = document.getElementById('mainProgressContainer');
const mainProgress = document.getElementById('mainProgress');
const tempProgressContainer = document.getElementById('tempProgressContainer');
const tempProgress = document.getElementById('tempProgress');

// Timer interval
let updateInterval = null;

// Current state
let currentState = null;

// Update UI based on current status
async function updateUI() {
  const state = await chrome.runtime.sendMessage({ action: 'getStatus' });
  currentState = state;

  if (!state.isBlocking) {
    // Default unblocked state
    showUnblockedState();
  } else if (state.tempUnblockActive) {
    // Temporary unblock during blocking session
    showTempUnblockState(state);
  } else {
    // Active blocking session
    showBlockingState(state);
  }
}

// Default unblocked state
function showUnblockedState() {
  buttonText.textContent = 'Go!';
  statusText.textContent = 'Enter minutes to start blocking';
  statusText.className = 'status-text';
  timerSection.classList.add('hidden');
  mainProgressContainer.classList.add('hidden');
  tempProgressContainer.classList.add('hidden');
  minutesInput.placeholder = '25';
}

// Blocking state (sites are blocked, timer counting down)
function showBlockingState(state) {
  buttonText.textContent = 'Unblock';
  statusText.textContent = 'LinkedIn & YouTube blocked';
  statusText.className = 'status-text blocking';
  timerSection.classList.remove('hidden');
  timerLabel.textContent = 'Blocking Time Remaining';
  mainProgressContainer.classList.remove('hidden');
  tempProgressContainer.classList.add('hidden');
  minutesInput.placeholder = 'Temp unblock mins';

  // Calculate remaining time and progress
  const now = Date.now();
  const remaining = Math.max(0, state.blockingEndTime - now);
  const progress = (remaining / state.blockingDuration) * 100;

  // Update progress bar (drains from right to left, so full = 100%, empty = 0%)
  mainProgress.style.width = `${progress}%`;

  // Update timer display
  updateTimerDisplay(remaining);
}

// Temporary unblock state (within blocking session)
function showTempUnblockState(state) {
  buttonText.textContent = 'Unblock';
  statusText.textContent = 'Temporarily unblocked (blocking paused)';
  statusText.className = 'status-text temp-unblock';
  timerSection.classList.remove('hidden');
  timerLabel.textContent = 'Temp Unblock Time Remaining';
  mainProgressContainer.classList.remove('hidden');
  tempProgressContainer.classList.remove('hidden');
  minutesInput.placeholder = 'Extend mins';

  // Main progress bar is frozen
  const mainRemaining = state.blockingDuration - state.blockingElapsed;
  const mainProgressPercent = (mainRemaining / state.blockingDuration) * 100;
  mainProgress.style.width = `${mainProgressPercent}%`;

  // Temp progress bar shows temp unblock countdown
  const now = Date.now();
  const tempRemaining = Math.max(0, state.tempUnblockEndTime - now);

  // Calculate temp duration by checking how much time has passed
  const tempElapsed = now - (state.tempUnblockEndTime - tempRemaining);
  const tempDuration = tempRemaining + tempElapsed;
  const tempProgressPercent = (tempRemaining / tempDuration) * 100;

  tempProgress.style.width = `${tempProgressPercent}%`;

  // Update timer display with temp unblock time
  updateTimerDisplay(tempRemaining);
}

// Update timer display
function updateTimerDisplay(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Handle Go/Unblock button click
goButton.addEventListener('click', async () => {
  const minutes = parseInt(minutesInput.value);

  if (!minutes || minutes < 1) {
    alert('Please enter a valid number of minutes');
    return;
  }

  // Trigger animation
  goButton.classList.add('animate');
  setTimeout(() => {
    goButton.classList.remove('animate');
  }, 700);

  if (!currentState.isBlocking) {
    // Start blocking session
    await chrome.runtime.sendMessage({
      action: 'startBlocking',
      minutes: minutes
    });
  } else {
    // Request temporary unblock
    await chrome.runtime.sendMessage({
      action: 'tempUnblock',
      minutes: minutes
    });
  }

  minutesInput.value = '';
  updateUI();
});

// Allow Enter key to trigger button
minutesInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    goButton.click();
  }
});

// Initialize
updateUI();

// Update UI every second when popup is open
updateInterval = setInterval(updateUI, 1000);

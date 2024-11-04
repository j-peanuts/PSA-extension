document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  loadSettings();

  // Set up event listeners
  setupEventListeners();
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get([
    'speechRate',
    'highlightColor',
    'keyBindings'
  ]);

  // Speech rate
  const speechRateInput = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  if (settings.speechRate) {
    speechRateInput.value = settings.speechRate;
    speechRateValue.textContent = `${settings.speechRate}x`;
  }

  // Highlight color
  const colorPicker = document.getElementById('highlightColor');
  if (settings.highlightColor) {
    colorPicker.value = settings.highlightColor;
  }

  // Key bindings
  if (settings.keyBindings) {
    Object.entries(settings.keyBindings).forEach(([action, key]) => {
      const input = document.getElementById(`${action}Key`);
      if (input) {
        input.value = key;
      }
    });
  }
}

function setupEventListeners() {
  // Speech rate slider
  const speechRateInput = document.getElementById('speechRate');
  const speechRateValue = document.getElementById('speechRateValue');
  
  speechRateInput.addEventListener('input', (e) => {
    const rate = e.target.value;
    speechRateValue.textContent = `${rate}x`;
    chrome.storage.sync.set({ speechRate: rate });
  });

  // Color picker
  const colorPicker = document.getElementById('highlightColor');
  colorPicker.addEventListener('change', (e) => {
    chrome.storage.sync.set({ highlightColor: e.target.value });
  });

  // Key binding inputs
  document.querySelectorAll('.key-binding input').forEach(input => {
    input.addEventListener('keydown', handleKeyBinding);
  });
}

function handleKeyBinding(e) {
  e.preventDefault();
  
  // Get the key pressed
  let key = e.key.toLowerCase();
  if (key === ' ') key = 'space';
  
  // Update the input value
  e.target.value = key;
  
  // Save the new key binding
  const action = e.target.id.replace('Key', '');
  chrome.storage.sync.get('keyBindings', (result) => {
    const keyBindings = result.keyBindings || {};
    keyBindings[action] = key;
    chrome.storage.sync.set({ keyBindings });
  });
}

// Function to reset all settings to default
function resetSettings() {
  const defaultSettings = {
    speechRate: 1.0,
    highlightColor: '#ff0000',
    keyBindings: {
      currentPokemon: 'z',
      opponentPokemon: 'x',
      teamPreview: 'c',
      fieldConditions: 'v',
      terastallize: 't',
      cancel: 'Escape',
      moves: ['1', '2', '3', '4'],
      pokemon: ['5', '6', '7', '8', '9', '0']
    }
  };

  chrome.storage.sync.set(defaultSettings, () => {
    loadSettings();
  });
}

// Add reset button functionality
document.getElementById('resetSettings')?.addEventListener('click', resetSettings);
// Wait for the page to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all managers
  const battleState = new BattleState();
  const speechify = new SpeechifyManager();
  const uiHandler = new UIHandler();
  const keyManager = new KeyBindingManager(battleState, speechify, uiHandler);

  // Load saved settings
  chrome.storage.sync.get(['speechRate', 'highlightColor'], (result) => {
    if (result.speechRate) {
      speechify.setSpeechRate(result.speechRate);
    }
    if (result.highlightColor) {
      uiHandler.setHighlightColor(result.highlightColor);
    }
  });

  // Set up battle message observer
  const battleLog = document.querySelector('.battle-log');
  if (battleLog) {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const message = node.textContent;
              
              // Skip player chat messages
              if (node.className.includes('chat') && !node.className.includes('battle-history')) {
                continue;
              }

              // Process battle message
              processMessage(message, battleState, speechify);
            }
          }
        }
      }
    });

    observer.observe(battleLog, { childList: true, subtree: true });
  }

  // Handle /dt commands
  const chatInput = document.querySelector('.battle-log-add');
  if (chatInput) {
    chatInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const input = chatInput.value;
        if (input.startsWith('/dt')) {
          const query = input.slice(4).trim();
          await handleDataQuery(query, speechify);
        }
      }
    });
  }
});

async function handleDataQuery(query, speechify) {
  // Wait for the data to appear in the battle log
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const details = document.querySelector('.message-log').lastElementChild;
  if (!details) return;

  let text = '';
  
  // Parse different types of data
  if (details.textContent.includes('Type:')) {
    // Pokemon data
    text = parsePokemonData(details.textContent);
  } else if (details.textContent.includes('Base Power:')) {
    // Move data
    text = parseMoveData(details.textContent);
  } else if (details.textContent.includes('Item:')) {
    // Item data
    text = parseItemData(details.textContent);
  } else {
    // Ability data
    text = parseAbilityData(details.textContent);
  }

  speechify.speak(text);
}

function processMessage(message, battleState, speechify) {
  // Format message by replacing player names
  const formattedMessage = formatMessage(message);
  
  // Skip certain messages
  if (shouldSkipMessage(formattedMessage)) {
    return;
  }

  // Speak the message
  speechify.speak(formattedMessage);
}

function formatMessage(message) {
  // Replace player names with "You" and "Opponent"
  const playerName = document.querySelector('.battle .rightbar .trainer strong')?.textContent;
  const opponentName = document.querySelector('.battle .leftbar .trainer strong')?.textContent;
  
  if (playerName) {
    message = message.replace(new RegExp(playerName, 'g'), 'You');
  }
  if (opponentName) {
    message = message.replace(new RegExp(opponentName, 'g'), 'Opponent');
  }

  return message;
}

function shouldSkipMessage(message) {
  // Skip chat messages and certain battle messages
  return message.startsWith('|chat|') || 
         message.includes('joined') || 
         message.includes('left') ||
         message.trim() === '';
}

function parsePokemonData(data) {
  const lines = data.split('\n');
  let text = '';

  // Extract relevant information
  for (const line of lines) {
    if (line.includes('Type:')) {
      text += `Type: ${line.split('Type:')[1].trim()}. `;
    } else if (line.includes('Base stats:')) {
      text += `Base stats: ${line.split('Base stats:')[1].trim()}. `;
    } else if (line.includes('Abilities:')) {
      text += `Abilities: ${line.split('Abilities:')[1].trim()}. `;
    }
  }

  return text;
}

function parseMoveData(data) {
  const lines = data.split('\n');
  let text = '';

  // Extract move information
  for (const line of lines) {
    if (line.includes('Type:')) {
      text += `Type: ${line.split('Type:')[1].trim()}. `;
    } else if (line.includes('Base Power:')) {
      text += `Base Power: ${line.split('Base Power:')[1].trim()}. `;
    } else if (line.includes('Description:')) {
      text += `${line.split('Description:')[1].trim()}`;
    }
  }

  return text;
}

function parseItemData(data) {
  // Extract item description
  const description = data.split('\n')[1];
  return description ? description.trim() : 'No description available.';
}

function parseAbilityData(data) {
  // Extract ability description
  const description = data.split('\n')[1];
  return description ? description.trim() : 'No description available.';
} 
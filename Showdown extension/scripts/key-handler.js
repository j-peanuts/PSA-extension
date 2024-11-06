console.log('Key handler script loaded');

class KeyBindingManager {
  constructor(battleState, speechify, uiHandler) {
    this.battleState = battleState;
    this.speechify = speechify;
    this.uiHandler = uiHandler;
    this.bindings = this.getDefaultBindings();
    this.loadBindings();
    this.setupListeners();
    this.lastHighlightedType = null;
    this.lastHighlightedIndex = null;
  }

  getDefaultBindings() {
    return {
      currentPokemon: 'z',
      opponentPokemon: 'x',
      teamPreview: 'c',
      fieldConditions: 'v',
      terastallize: 't',
      cancel: 'Backspace',
      moves: ['1', '2', '3', '4'],
      pokemon: ['5', '6', '7', '8', '9', '0']
    };
  }

  async loadBindings() {
    const stored = await chrome.storage.sync.get('keyBindings');
    this.bindings = stored.keyBindings || this.getDefaultBindings();
  }

  setupListeners() {
    let isShiftPressed = false;
    
    document.addEventListener('keydown', (e) => {
      // Prevent repeat events when key is held down
      if (e.repeat) return;
      
      // Track shift state
      if (e.key === 'Shift') {
        if (isShiftPressed) return; // Don't handle if already pressed
        isShiftPressed = true;
      }
      
      this.handleKeyPress(e);
    });

    // Reset shift state on key up
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        isShiftPressed = false;
      }
    });
  }

  handleKeyPress(e) {
    console.log('Key pressed:', e.key, 'Code:', e.code, 'Shift:', e.shiftKey);
    // Prevent handling if user is typing in chat
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      console.log('Input/textarea focused, ignoring key press');
      return;
  }

    const isShiftPressed = e.shiftKey;

    // Handle backspace key specifically
    if (e.key === 'Backspace') {
        console.log('Backspace key pressed');
        if (!this.uiHandler.clickCancelButton()) {
            this.clearHighlights();
        }
        return;
    }

    // For all other keys, convert to lowercase
    const key = e.key.toLowerCase();

    // Handle move keys (1-4) with shift using key codes
    if (isShiftPressed && e.code.match(/^Digit[1-4]$/)) {
        const moveIndex = parseInt(e.code.replace('Digit', ''));
        this.handleMoveKey(moveIndex, true);
        return;
    }

    // Handle Pokemon keys (5-0) with shift using key codes
    if (isShiftPressed && (e.code.match(/^Digit[5-9]$/) || e.code === 'Digit0')) {
        const pokemonIndex = e.code === 'Digit0' ? 6 : parseInt(e.code.replace('Digit', '')) - 4;
        this.handlePokemonKey(pokemonIndex, true);
        return;
    }

    // Regular move keys (1-4)
    if (!isShiftPressed && key >= '1' && key <= '4') {
        const moveIndex = parseInt(key);
        this.handleMoveKey(moveIndex, false);
        return;
    }

    // Regular Pokemon keys (5-0)
    if (!isShiftPressed && ((key >= '5' && key <= '9') || key === '0')) {
        const pokemonIndex = key === '0' ? 6 : parseInt(key) - 4;
        this.handlePokemonKey(pokemonIndex, false);
        return;
    }

    // Handle other bindings
    if (key === this.bindings.currentPokemon) {
        this.clearHighlights();
        this.handleCurrentPokemonInfo(isShiftPressed);
        return;
    }

    if (key === this.bindings.opponentPokemon) {
        this.clearHighlights();
        this.handleOpponentPokemonInfo(isShiftPressed);
        return;
    }

    if (key === this.bindings.teamPreview) {
        this.clearHighlights();
        this.handleTeamPreview(isShiftPressed);
        return;
    }

    if (key === this.bindings.fieldConditions) {
        this.clearHighlights();
        this.handleFieldConditions();
        return;
    }

    if (key === this.bindings.terastallize) {
        this.handleTerastallize();
        return;
    }

    if (key === this.bindings.cancel) {
        if (!this.uiHandler.clickCancelButton()) {
            this.clearHighlights();
        }
        return;
    }
  }

  handleCurrentPokemonInfo(withStats) {
    const pokemon = this.battleState.getCurrentPokemon();
    if (!pokemon) return;

    let text = `${pokemon.species}: ${pokemon.types.join(' ')} type. `;
    text += `${pokemon.currentHP}% HP remaining. `;
    text += `Speed stat ${pokemon.stats.spe}. `;
    text += `Ability: ${pokemon.ability}. `;

    if (withStats) {
      text += this.getStatChangesText(pokemon.statChanges);
      text += this.getStatusText(pokemon.status);
    }

    this.speechify.speak(text);
  }

  handleOpponentPokemonInfo(withStats) {
    const pokemon = this.battleState.getOpponentPokemon();
    if (!pokemon) return;

    let text = `${pokemon.species}: ${pokemon.types.join(' ')} type. `;
    text += `${pokemon.currentHP}% HP remaining. `;
    text += `Speed stat ${pokemon.stats.spe}. `;
    
    if (pokemon.ability) {
      text += `Ability: ${pokemon.ability}. `;
    } else {
      text += `Possible abilities: ${pokemon.possibleAbilities.join(', ')}. `;
    }

    if (pokemon.item) {
      text += `Holding: ${pokemon.item}. `;
    } else {
      text += `Item unknown. `;
    }

    if (withStats) {
      text += this.getStatChangesText(pokemon.statChanges);
      text += this.getStatusText(pokemon.status);
    }

    this.speechify.speak(text);
  }

  handleTeamPreview(withDetails) {
    const teamInfo = this.battleState.getRevealedOpponentPokemon();
    let text = `${teamInfo.unknown} pokemon still unknown. `;
    
    teamInfo.revealed.forEach(pokemon => {
      text += `${pokemon.species} with ${pokemon.currentHP}% HP. `;
      if (withDetails) {
        text += `${pokemon.types.join(' ')} type. Speed ${pokemon.stats.spe}. `;
      }
    });

    this.speechify.speak(text);
  }

  handleFieldConditions() {
    const conditions = this.battleState.getFieldConditions();
    let text = '';

    if (conditions.weather.type) {
      text += `Weather is ${conditions.weather.type}, ${conditions.weather.turnsLeft} turns remaining. `;
    } else {
      text += 'No weather active. ';
    }

    if (conditions.terrain.type) {
      text += `${conditions.terrain.type} terrain, ${conditions.terrain.turnsLeft} turns remaining. `;
    } else {
      text += 'No terrain active. ';
    }

    text += this.getHazardsText(conditions.playerHazards, 'your');
    text += this.getHazardsText(conditions.opponentHazards, 'opponent\'s');

    this.speechify.speak(text);
  }

  handleTerastallize() {
    const teraCheckbox = document.querySelector('input[name="terastallize"]');
    if (!teraCheckbox) return;

    const teraType = this.uiHandler.highlightTera();
    if (!teraType) return;
    
    if (this.lastHighlightedType === 'tera') {
        // Second press - toggle the checkbox
        teraCheckbox.click();
        this.clearHighlights();  // Clear highlight immediately after click
        this.lastHighlightedType = null;
        
        // Check if it's now checked or unchecked after the click
        if (teraCheckbox.checked) {
            this.speechify.speak(`${teraType} tera selected`);
        } else {
            this.speechify.speak('tera unselected');
            this.uiHandler.clearTeraHighlight();  // Explicitly clear tera highlight
        }
    } else {
        // First press - highlight and announce type
        this.speechify.speak(`${teraType} tera`);
        this.lastHighlightedType = 'tera';
    }
  }

  handleMoveKey(moveIndex, withDetails = false) {
    console.log('Handling move key:', moveIndex, 'with details:', withDetails);
    
    // Get the move buttons
    const moveButtons = document.querySelectorAll('.movemenu button');
    const button = moveButtons[moveIndex - 1];
    
    // Always try to highlight the move button
    this.uiHandler.highlightMove(moveIndex);
    
    if (button) {
        // Get move details from UI Handler
        const moveDetails = this.uiHandler.getMoveDetails(moveIndex);
        if (!moveDetails) {
            console.log('No move details found');
            return;
        }
        
        // Handle double-press to select
        if (this.lastHighlightedType === 'move' && this.lastHighlightedIndex === moveIndex) {
            this.uiHandler.clickHighlightedElement();
            this.clearHighlights();
            this.speechify.speak(`${moveDetails.name} selected`);
        } else {
            // First press - speak name or full details based on shift key
            if (withDetails) {
                this.speechify.speak(moveDetails.formattedText);
            } else {
                this.speechify.speak(moveDetails.name);
            }
            this.lastHighlightedType = 'move';
            this.lastHighlightedIndex = moveIndex;
        }
    }
  }

  handlePokemonKey(pokemonIndex, withDetails) {
    // Get the switch buttons
    const switchButtons = document.querySelectorAll('button[name="chooseSwitch"]');
    const button = switchButtons[pokemonIndex - 1];
    
    // Always try to highlight the switch button
    this.uiHandler.highlightSwitch(pokemonIndex);
    
    if (button) {
        // Get Pokemon name from the button's text content
        const pokemonName = button.textContent.trim();
        
        if (withDetails) {
            // Get Pokemon data from battle state if available
            const pokemon = this.battleState.getPokemonBySlot(pokemonIndex - 1);
            if (pokemon) {
                let text = `${pokemon.species}: ${pokemon.types.join(' ')} type with ${pokemon.currentHP}% HP remaining. `;
                text += `Ability: ${pokemon.ability}. `;
                if (pokemon.item) text += `Holding ${pokemon.item}. `;
                text += `Moves: ${pokemon.moves.map(m => m.name).join(', ')}. `;
                if (pokemon.status) text += this.getStatusText(pokemon.status);
                if (pokemon.teraType) text += `Tera type: ${pokemon.teraType}. `;
                this.speechify.speak(text);
            } else {
                // Fallback to just the name if no battle state data
                this.speechify.speak(pokemonName);
            }
        } else {
            // Just speak the Pokemon name
            this.speechify.speak(pokemonName);
        }
    }
    
    // Handle double-press to select
    if (this.lastHighlightedType === 'pokemon' && this.lastHighlightedIndex === pokemonIndex) {
        this.uiHandler.clickHighlightedElement();
        this.clearHighlights();
    } else {
        this.lastHighlightedType = 'pokemon';
        this.lastHighlightedIndex = pokemonIndex;
    }
  }

  getStatChangesText(statChanges) {
    if (!statChanges) return '';
    
    const statNames = {
      atk: 'Attack',
      def: 'Defense',
      spa: 'Special Attack',
      spd: 'Special Defense',
      spe: 'Speed'
    };

    let text = '';
    for (const [stat, stages] of Object.entries(statChanges)) {
      if (stages !== 0) {
        const multiplier = Math.pow(2, Math.abs(stages)) / (stages > 0 ? 1 : 2);
        text += `${multiplier}x ${statNames[stat]}. `;
      }
    }
    return text;
  }

  getStatusText(status) {
    if (!status) return '';
    
    let text = '';
    switch (status.condition) {
      case 'slp':
        text += `Asleep for ${status.turns} turns. `;
        break;
      case 'tox':
        const nextDamage = Math.min(15.625 * status.toxicCounter, 100);
        text += `Badly poisoned, will lose ${nextDamage}% HP next turn. `;
        break;
      case 'psn':
        text += 'Poisoned. ';
        break;
      case 'brn':
        text += 'Burned. ';
        break;
      case 'par':
        text += 'Paralyzed. ';
        break;
      case 'frz':
        text += 'Frozen. ';
        break;
    }
    return text;
  }

  getHazardsText(hazards, side) {
    let text = '';
    if (hazards.stealthRock) text += `Stealth Rocks on ${side} side. `;
    if (hazards.spikes) text += `${hazards.spikes} layer${hazards.spikes > 1 ? 's' : ''} of Spikes on ${side} side. `;
    if (hazards.toxicSpikes) text += `${hazards.toxicSpikes} layer${hazards.toxicSpikes > 1 ? 's' : ''} of Toxic Spikes on ${side} side. `;
    if (hazards.stickyWeb) text += `Sticky Web on ${side} side. `;
    return text || `No hazards on ${side} side. `;
  }

  clearHighlights() {
    this.uiHandler.clearHighlights();
    this.lastHighlightedType = null;
    this.lastHighlightedIndex = null;
  }
}

// Make KeyBindingManager available globally
if (typeof window !== 'undefined') {
    window.KeyBindingManager = KeyBindingManager;
} 
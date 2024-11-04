class BattleState {
  constructor() {
    this.reset();
    this.setupObservers();
  }

  reset() {
    this.currentState = {
      format: '',
      weather: { type: null, turnsLeft: 0 },
      terrain: { type: null, turnsLeft: 0 },
      playerSide: {
        pokemon: Array(6).fill(null),
        hazards: {
          spikes: 0,
          toxicSpikes: 0,
          stealthRock: false,
          stickyWeb: false
        },
        currentPokemon: null
      },
      opponentSide: {
        pokemon: Array(6).fill(null),
        hazards: {
          spikes: 0,
          toxicSpikes: 0,
          stealthRock: false,
          stickyWeb: false
        },
        currentPokemon: null,
        revealedCount: 0
      }
    };
  }

  setupObservers() {
    // Observer for battle log
    const battleLog = document.querySelector('.battle-log');
    if (battleLog) {
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.processBattleMessage(node.textContent);
              }
            });
          }
        }
      });
      observer.observe(battleLog, { childList: true, subtree: true });
    }
  }

  processBattleMessage(message) {
    // Format detection
    if (message.includes('Format:')) {
      this.currentState.format = message.split('Format:')[1].trim();
      return;
    }

    // Weather changes
    if (message.includes('The weather became')) {
      this.updateWeather(message);
      return;
    }

    // Terrain changes
    if (message.includes('terrain')) {
      this.updateTerrain(message);
      return;
    }

    // Pokemon switches
    if (message.includes('went back') || message.includes('switched in')) {
      this.handleSwitch(message);
      return;
    }

    // Move usage and damage
    if (message.includes('used')) {
      this.handleMove(message);
      return;
    }

    // Status conditions
    if (this.isStatusMessage(message)) {
      this.handleStatus(message);
      return;
    }

    // Stat changes
    if (message.includes('rose') || message.includes('fell')) {
      this.handleStatChange(message);
    }
  }

  getCurrentPokemon() {
    return this.currentState.playerSide.currentPokemon;
  }

  getOpponentPokemon() {
    return this.currentState.opponentSide.currentPokemon;
  }

  getPokemonBySlot(slot, isPlayer = true) {
    const side = isPlayer ? this.currentState.playerSide : this.currentState.opponentSide;
    return side.pokemon[slot];
  }

  getFieldConditions() {
    return {
      weather: this.currentState.weather,
      terrain: this.currentState.terrain,
      playerHazards: this.currentState.playerSide.hazards,
      opponentHazards: this.currentState.opponentSide.hazards
    };
  }

  getRevealedOpponentPokemon() {
    return {
      revealed: this.currentState.opponentSide.pokemon.filter(p => p !== null),
      unknown: 6 - this.currentState.opponentSide.revealedCount
    };
  }

  updatePokemonHP(pokemon, newHP) {
    if (!pokemon) return;
    pokemon.currentHP = newHP;
  }

  updatePokemonStatus(pokemon, status) {
    if (!pokemon) return;
    pokemon.status = {
      condition: status,
      turns: status === 'slp' ? 3 : 0, // Default sleep turns
      toxicCounter: status === 'tox' ? 1 : 0
    };
  }

  handleStatChange(message) {
    const isPlayer = !message.includes('The opposing');
    const pokemon = isPlayer ? this.getCurrentPokemon() : this.getOpponentPokemon();
    if (!pokemon) return;

    const stat = this.parseStatFromMessage(message);
    const direction = message.includes('rose') ? 1 : -1;
    const stages = (message.includes('sharply') ? 2 : 1) * direction;

    if (!pokemon.statChanges) pokemon.statChanges = {};
    pokemon.statChanges[stat] = (pokemon.statChanges[stat] || 0) + stages;
  }

  parseStatFromMessage(message) {
    if (message.includes('Attack')) return 'atk';
    if (message.includes('Defense')) return 'def';
    if (message.includes('Special Attack')) return 'spa';
    if (message.includes('Special Defense')) return 'spd';
    if (message.includes('Speed')) return 'spe';
    return null;
  }

  isStatusMessage(message) {
    return message.includes('was paralyzed') ||
           message.includes('was poisoned') ||
           message.includes('was badly poisoned') ||
           message.includes('fell asleep') ||
           message.includes('was burned') ||
           message.includes('was frozen');
  }

  updateWeather(message) {
    const weatherTypes = {
      'sun': 'harsh sunlight',
      'rain': 'rain',
      'sand': 'sandstorm',
      'hail': 'hail'
    };

    for (const [key, value] of Object.entries(weatherTypes)) {
      if (message.includes(value)) {
        this.currentState.weather = {
          type: key,
          turnsLeft: 5 // Default weather duration
        };
        break;
      }
    }
  }

  updateTerrain(message) {
    const terrainTypes = {
      'electric': 'Electric',
      'grassy': 'Grassy',
      'misty': 'Misty',
      'psychic': 'Psychic'
    };

    for (const [key, value] of Object.entries(terrainTypes)) {
      if (message.includes(value)) {
        this.currentState.terrain = {
          type: key,
          turnsLeft: 5 // Default terrain duration
        };
        break;
      }
    }
  }
} 
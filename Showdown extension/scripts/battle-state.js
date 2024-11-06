console.log('Battle state script loaded');

class BattleState {
  constructor(speechify) {
    this.speechify = speechify;
    this.currentState = {
      format: '',
      weather: { type: null, turnsLeft: 0 },
      terrain: { type: null, turnsLeft: 0 },
      playerSide: {
        currentPokemon: null,
        pokemon: new Array(6).fill(null),
        hazards: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false },
        revealedCount: 0
      },
      opponentSide: {
        currentPokemon: null,
        pokemon: new Array(6).fill(null),
        hazards: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false },
        revealedCount: 0
      }
    };
    this.moveData = null;
    this.initializeBattleData();
  }

  waitForElement(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  async initializeBattleData() {
    await this.waitForElement('.battle');
    await this.loadMoveData();
  }

  async loadMoveData() {
    try {
      // Load all data files
      const [moves, pokemon, items, abilities] = await Promise.all([
        fetch(chrome.runtime.getURL('data/moves.json')).then(r => r.json()),
        fetch(chrome.runtime.getURL('data/pokemon.json')).then(r => r.json()),
        fetch(chrome.runtime.getURL('data/items.json')).then(r => r.json()),
        fetch(chrome.runtime.getURL('data/abilities.json')).then(r => r.json())
      ]);

      // Store data in the battle state
      this.moveData = moves;
      this.pokemonData = pokemon;
      this.itemData = items;
      this.abilityData = abilities;

      // Make data globally available for compatibility
      window.BattleMovedex = moves;
      window.BattlePokedex = pokemon;
      window.BattleItems = items;
      window.BattleAbilities = abilities;

      console.log('Loaded battle data:', {
        moves: Object.keys(moves).length,
        pokemon: Object.keys(pokemon).length,
        items: Object.keys(items).length,
        abilities: Object.keys(abilities).length
      });

      return true;
    } catch (error) {
      console.error('Error loading battle data:', error);
      return false;
    }
  }

  getMoveData(moveName) {
    if (!this.moveData) {
      console.error('Move data not yet loaded');
      return {};
    }

    const moveId = this.toID(moveName);
    const moveData = this.moveData[moveId];
    
    if (!moveData) {
      console.log(`Move data not found for: ${moveName} (${moveId})`);
      return {};
    }
    
    return {
      name: moveData.name,
      basePower: moveData.basePower,
      accuracy: moveData.accuracy === true ? 100 : moveData.accuracy,
      category: moveData.category,
      type: moveData.type,
      description: moveData.shortDesc || moveData.desc,
      pp: moveData.pp,
      flags: moveData.flags || {},
      secondary: moveData.secondary,
      target: moveData.target
    };
  }

  toID(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
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

  getPokemonBySlot(slot) {
    // Return Pokemon data for the given slot (0-5)
    return this.currentState.playerSide.pokemon[slot] || null;
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

  handleMove(message) {
    if (message && typeof message === 'string') {
      const moveMatch = message.match(/(.*) used (.*)!/);
      if (moveMatch) {
        const [_, pokemon, move] = moveMatch;
      }
    }
  }

  handleSwitch(message) {
    const isOpponent = message.includes('The opposing');
    const pokemonMatch = message.match(/sent out (.*?)!/);
    
    if (pokemonMatch) {
        const pokemonName = pokemonMatch[1];
        const side = isOpponent ? this.currentState.opponentSide : this.currentState.playerSide;
        
        // Find first empty slot or update existing Pokemon
        let slot = side.pokemon.findIndex(p => !p || p.species === pokemonName);
        if (slot === -1) slot = side.pokemon.findIndex(p => !p);
        
        // Get base Pokemon data from loaded Pokemon data
        const baseData = this.pokemonData[this.toID(pokemonName)];
        
        // Create or update Pokemon data
        side.pokemon[slot] = {
            species: pokemonName,
            currentHP: 100,
            types: baseData ? baseData.types : [],
            ability: baseData ? baseData.abilities[0] : null, // Default to first ability
            item: null,
            moves: [],
            status: null,
            teraType: null,
            stats: baseData ? baseData.baseStats : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            statChanges: {}
        };
        
        // Update current Pokemon reference
        side.currentPokemon = side.pokemon[slot];
        
        // Update revealed count for opponent
        if (isOpponent && !side.pokemon.includes(null)) {
            side.revealedCount++;
        }

        console.log(`Pokemon data loaded for ${pokemonName}:`, side.pokemon[slot]);
    }
  }
} 
window.BattleState = BattleState; 
class KeyBindingManager {
  constructor(battleState, speechify, uiHandler) {
    this.battleState = battleState;
    this.speechify = speechify;
    this.uiHandler = uiHandler;
    this.bindings = this.getDefaultBindings();
    this.loadBindings();
    this.setupListeners();
  }

  getDefaultBindings() {
    return {
      currentPokemon: 'z',
      opponentPokemon: 'x',
      teamPreview: 'c',
      fieldConditions: 'v',
      terastallize: 't',
      cancel: 'Escape',
      moves: ['1', '2', '3', '4'],
      pokemon: ['5', '6', '7', '8', '9', '0']
    };
  }

  async loadBindings() {
    const stored = await chrome.storage.sync.get('keyBindings');
    this.bindings = stored.keyBindings || this.getDefaultBindings();
  }

  setupListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  handleKeyPress(e) {
    // Prevent handling if user is typing in chat
    if (document.activeElement.tagName === 'INPUT') return;

    const key = e.key.toLowerCase();
    const isShiftPressed = e.shiftKey;

    // Handle different key combinations
    if (key === this.bindings.currentPokemon) {
      this.handleCurrentPokemonInfo(isShiftPressed);
    } else if (key === this.bindings.opponentPokemon) {
      this.handleOpponentPokemonInfo(isShiftPressed);
    }
    // ... Add more key handling logic
  }

  handleCurrentPokemonInfo(withStats = false) {
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
} 
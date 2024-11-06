console.log('UI handler script loaded');

class UIHandler {
    constructor() {
        this.battleState = null;
        this.highlightColor = '#ff0000';
        this.highlightWidth = 2;
        this.loadSettings();
        this.setupEventListeners();
        this.preventChatFocus();
        this.setupDynamicStyles();
    }

    async loadSettings() {
        try {
            const stored = await chrome.storage.sync.get(['highlightColor', 'highlightWidth']);
            this.highlightColor = stored.highlightColor || '#ff0000';
            this.highlightWidth = stored.highlightWidth || 2;
            this.updateHighlightStyles();
            console.log('Loaded settings:', this.highlightColor, this.highlightWidth);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    setupEventListeners() {
        // Listen for battle format changes
        document.addEventListener('click', (event) => {
            const formatButton = event.target.closest('.button.cur');
            if (formatButton && this.battleState) {
                this.battleState.currentState.format = formatButton.textContent.trim();
            }
        });

        // Listen for team preview confirmations
        document.addEventListener('click', (event) => {
            if (event.target.matches('.button.current[name="chooseTeamPreview"]')) {
                console.log('Team preview confirmed');
            }
        });

        // Listen for move selections
        document.addEventListener('click', (event) => {
            const moveButton = event.target.closest('.movemenu button');
            if (moveButton) {
                const moveName = moveButton.getAttribute('data-move');
                if (moveName) {
                    console.log(`Selected move: ${moveName}`);
                }
            }
        });

        // Listen for switch selections
        document.addEventListener('click', (event) => {
            const switchButton = event.target.closest('.switchmenu button');
            if (switchButton) {
                const pokemonName = switchButton.getAttribute('data-pokemon');
                if (pokemonName) {
                    console.log(`Switching to: ${pokemonName}`);
                }
            }
        });

        // Listen for forfeit button
        document.addEventListener('click', (event) => {
            if (event.target.matches('button[name="forfeit"]')) {
                console.log('Forfeit button clicked');
            }
        });

        // Listen for chat input
        const chatInput = document.querySelector('.battle-log-add form textarea');
        if (chatInput) {
            chatInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    console.log('Chat message sent');
                }
            });
        }

        // Listen for timer updates
        const timerDisplay = document.querySelector('.timer');
        if (timerDisplay) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'characterData') {
                        console.log(`Timer updated: ${mutation.target.textContent}`);
                    }
                });
            });

            observer.observe(timerDisplay, {
                characterData: true,
                subtree: true
            });
        }

        // Listen for battle options (like timer toggle)
        document.addEventListener('click', (event) => {
            if (event.target.matches('.icon.button')) {
                console.log('Battle option toggled');
            }
        });

        console.log('UI Handler initialized');
    }

    setBattleState(battleState) {
        this.battleState = battleState;
    }

    // Method to handle team preview interactions
    handleTeamPreview() {
        const teamPreviewContainer = document.querySelector('.switchmenu');
        if (teamPreviewContainer) {
            const pokemonButtons = teamPreviewContainer.querySelectorAll('button');
            pokemonButtons.forEach(button => {
                const pokemonName = button.getAttribute('data-pokemon');
                if (pokemonName) {
                    console.log(`Team preview pokemon: ${pokemonName}`);
                }
            });
        }
    }

    // Method to update move buttons with accessibility information
    updateMoveButtons() {
        const moveButtons = document.querySelectorAll('.movemenu button');
        moveButtons.forEach(button => {
            const moveName = button.getAttribute('data-move');
            const moveType = button.querySelector('.type');
            const movePP = button.querySelector('.pp');
            
            if (moveName && moveType && movePP) {
                const accessibleText = `${moveName} - Type: ${moveType.textContent}, PP: ${movePP.textContent}`;
                button.setAttribute('aria-label', accessibleText);
            }
        });
    }

    // Method to update switch buttons with accessibility information
    updateSwitchButtons() {
        const switchButtons = document.querySelectorAll('.switchmenu button');
        switchButtons.forEach(button => {
            const pokemonName = button.getAttribute('data-pokemon');
            const hpDisplay = button.querySelector('.hpbar');
            
            if (pokemonName && hpDisplay) {
                const hp = hpDisplay.style.width;
                const accessibleText = `${pokemonName} - HP: ${hp}`;
                button.setAttribute('aria-label', accessibleText);
            }
        });
    }

    // Method to handle battle log accessibility
    setupBattleLogAccessibility() {
        const battleLog = document.querySelector('.battle-log');
        if (battleLog) {
            battleLog.setAttribute('role', 'log');
            battleLog.setAttribute('aria-live', 'polite');
        }
    }

    preventChatFocus() {
        const chatInput = document.querySelector('.battle-log-add form textarea');
        if (chatInput) {
            // Remove autofocus attribute
            chatInput.removeAttribute('autofocus');
            
            // Blur (unfocus) the chat input
            chatInput.blur();
            
            // Prevent the default focusing behavior
            const preventFocus = (e) => {
                if (!e.isTrusted) return; // Allow programmatic focus
                e.preventDefault();
                chatInput.blur();
            };
            
            chatInput.addEventListener('focus', preventFocus);

            // Add this to handle dynamic chat box updates
            const observer = new MutationObserver(() => {
                chatInput.blur();
                chatInput.removeAttribute('autofocus');
            });

            observer.observe(chatInput.parentElement, {
                attributes: true,
                childList: true,
                subtree: true
            });
        }
    }
    highlightMove(moveIndex) {
        const moveButtons = document.querySelectorAll('.movemenu button');
        console.log('Found move buttons:', moveButtons.length, moveButtons);
        this.clearHighlights();
        
        if (moveButtons[moveIndex - 1]) {
            console.log('Highlighting move:', moveIndex);
            moveButtons[moveIndex - 1].style.outline = `${this.highlightColor} solid 2px`;
            moveButtons[moveIndex - 1].style.outlineOffset = '2px';  // Make the outline more visible
            console.log('Button after highlight:', moveButtons[moveIndex - 1].outerHTML);
        } else {
            console.log('No move button found at index:', moveIndex);
        }
    }

    getMoveDetails(moveIndex) {
        const moveButtons = document.querySelectorAll('.movemenu button');
        const moveButton = moveButtons[moveIndex - 1];
        
        if (!moveButton) {
            console.log('No move button found at index:', moveIndex);
            return null;
        }
    
        const moveName = moveButton.getAttribute('data-move');
        const moveType = moveButton.querySelector('.type')?.textContent;
        const movePP = moveButton.querySelector('.pp')?.textContent;
        
        // Get move data from BattleMovedex
        const moveId = this.toID(moveName);
        const moveData = window.BattleMovedex?.[moveId];
        
        if (!moveData) {
            console.log(`Move data not found for: ${moveName} (${moveId})`);
            return {
                name: moveName,
                type: moveType,
                pp: movePP,
                formattedText: `${moveName}: Move data unavailable`
            };
        }

        // Format the text in the desired order
        const formattedText = `${moveName}: A ${moveData.category.toLowerCase()} ${moveType.toLowerCase()} type move` +
            (moveData.category !== 'Status' ? ` with ${moveData.basePower} base power` : '') +
            ` and ${moveData.accuracy === true ? 100 : moveData.accuracy}% accuracy. ` +
            moveData.shortDesc;

        return {
            name: moveName,
            type: moveType,
            pp: movePP,
            description: moveData,
            formattedText
        };
    }

    toID(text) {
        if (text?.toLowerCase) {
            return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
        }
        return '';
    }

    clickHighlightedElement() {
        // Try to find and click highlighted move
        const highlightedMove = document.querySelector('.movemenu button[style*="outline"]');
        if (highlightedMove) {
            highlightedMove.click();
            return;
        }

        // Try to find and click highlighted switch
        const highlightedSwitch = document.querySelector('button[name="chooseSwitch"][style*="outline"]');
        if (highlightedSwitch) {
            highlightedSwitch.click();
            return;
        }

        // Try to find and click highlighted tera checkbox
        const highlightedTera = document.querySelector('input[name="terastallize"][style*="outline"]');
        if (highlightedTera) {
            highlightedTera.click();
            return;
        }
    }

    clearHighlights() {
        console.log('UIHandler.clearHighlights called');
        document.querySelectorAll('.movemenu button, button[name="chooseSwitch"], input[name="terastallize"]').forEach(button => {
            button.style.removeProperty('border');
            button.style.removeProperty('box-shadow');
            button.style.removeProperty('outline');
            button.style.removeProperty('outline-offset');
        });
        console.log('Highlights cleared');
    }

    // Method to add keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Alt + number for moves
            if (event.altKey && event.key >= '1' && event.key <= '4') {
                const moveIndex = parseInt(event.key) - 1;
                const moveButtons = document.querySelectorAll('.movemenu button');
                if (moveButtons[moveIndex]) {
                    moveButtons[moveIndex].click();
                }
            }

            // Ctrl + number for switching
            if (event.ctrlKey && event.key >= '1' && event.key <= '6') {
                const switchIndex = parseInt(event.key) - 1;
                const switchButtons = document.querySelectorAll('.switchmenu button');
                if (switchButtons[switchIndex]) {
                    switchButtons[switchIndex].click();
                }
            }
        });
    }

    highlightSwitch(switchIndex) {
        console.log('UIHandler.highlightSwitch called with index:', switchIndex);
        const switchButtons = document.querySelectorAll('.switchmenu button[name="chooseSwitch"]');
        console.log('Found switch buttons:', switchButtons.length, switchButtons);
        this.clearHighlights();
        
        if (switchButtons[switchIndex - 1]) {
            console.log('Highlighting switch:', switchIndex);
            switchButtons[switchIndex - 1].style.outline = `${this.highlightColor} solid 2px`;
            switchButtons[switchIndex - 1].style.outlineOffset = '2px';
            console.log('Button after highlight:', switchButtons[switchIndex - 1].outerHTML);
        } else {
            console.log('No switch button found at index:', switchIndex);
        }
    }

    highlightTera() {
        console.log('UIHandler.highlightTera called');
        const teraCheckbox = document.querySelector('input[name="terastallize"]');
        this.clearHighlights();
        
        if (teraCheckbox) {
            console.log('Found tera checkbox');
            teraCheckbox.style.outline = `${this.highlightColor} solid 2px`;
            teraCheckbox.style.outlineOffset = '2px';
            
            const teraTypeImg = teraCheckbox.parentElement.querySelector('img');
            console.log('Tera button after highlight:', teraCheckbox.parentElement.outerHTML);
            return teraTypeImg ? teraTypeImg.alt : null;
        } else {
            console.log('No tera checkbox found');
            return null;
        }
    }

    clearTeraHighlight() {
        const teraCheckbox = document.querySelector('input[name="terastallize"]');
        if (teraCheckbox) {
            teraCheckbox.style.removeProperty('outline');
            teraCheckbox.style.removeProperty('outline-offset');
        }
    }

    setupDynamicStyles() {
        // Create a style element for dynamic styles
        const styleEl = document.createElement('style');
        document.head.appendChild(styleEl);
        this.styleSheet = styleEl.sheet;
        this.updateHighlightStyles();
    }

    updateHighlightStyles() {
        // Remove existing rules if any
        while (this.styleSheet.cssRules.length > 0) {
            this.styleSheet.deleteRule(0);
        }

        // Add new rules with current highlight color and fixed offset
        this.styleSheet.insertRule(`
            .movemenu button[style*="outline"],
            .switchmenu button[style*="outline"],
            input[name="terastallize"][style*="outline"] {
                outline: ${this.highlightWidth}px solid ${this.highlightColor} !important;
                outline-offset: 0px !important;
            }
        `, 0);
    }

    setHighlightColor(color) {
        this.highlightColor = color;
        this.updateHighlightStyles();
        
        // Re-highlight currently highlighted element
        if (window.keyManager) {
            const currentType = window.keyManager.lastHighlightedType;
            const currentIndex = window.keyManager.lastHighlightedIndex;
            
            if (currentType === 'move') {
                this.highlightMove(currentIndex);
            } else if (currentType === 'pokemon') {
                this.highlightSwitch(currentIndex);
            } else if (currentType === 'tera') {
                this.highlightTera();
            }
        }
    }

    setHighlightWidth(width) {
        this.highlightWidth = width;
        this.updateHighlightStyles();
        
        // Re-highlight currently highlighted element
        if (window.keyManager) {
            const currentType = window.keyManager.lastHighlightedType;
            const currentIndex = window.keyManager.lastHighlightedIndex;
            
            if (currentType === 'move') {
                this.highlightMove(currentIndex);
            } else if (currentType === 'pokemon') {
                this.highlightSwitch(currentIndex);
            } else if (currentType === 'tera') {
                this.highlightTera();
            }
        }
    }

    clickCancelButton() {
        const cancelButton = document.querySelector('button[name="undoChoice"]');
        if (cancelButton) {
            cancelButton.click();
            if (window.keyManager?.speechify) {
                window.keyManager.speechify.speak('cancelled');
            }
            return true;
        }
        return false;
    }

    getPokemonDetails(pokemonIndex) {
        const switchButtons = document.querySelectorAll('button[name="chooseSwitch"]');
        const switchButton = switchButtons[pokemonIndex - 1];
        
        if (!switchButton) {
            console.log('No switch button found at index:', pokemonIndex);
            return null;
        }

        const pokemonName = switchButton.textContent.trim();
        
        // Get Pokemon data from battle state if available
        const pokemon = window.keyManager?.battleState.getPokemonBySlot(pokemonIndex - 1);
        
        if (!pokemon) {
            return {
                name: pokemonName,
                formattedText: pokemonName
            };
        }

        // Format the text in a consistent way
        const formattedText = `${pokemon.species}: ${pokemon.types.join(' ')} type with ${pokemon.currentHP}% HP remaining. ` +
            `Base stats: HP ${pokemon.stats.hp}, Attack ${pokemon.stats.atk}, Defense ${pokemon.stats.def}, ` +
            `Special Attack ${pokemon.stats.spa}, Special Defense ${pokemon.stats.spd}, Speed ${pokemon.stats.spe}. ` +
            `Ability: ${pokemon.ability}. ` +
            (pokemon.item ? `Holding ${pokemon.item}. ` : '') +
            `Moves: ${pokemon.moves.map(m => m.name).join(', ')}. ` +
            (pokemon.status ? this.getStatusText(pokemon.status) : '') +
            (pokemon.teraType ? `Tera type: ${pokemon.teraType}. ` : '') +
            (pokemon.statChanges ? this.getStatChangesText(pokemon.statChanges) : '');

        return {
            name: pokemonName,
            pokemon: pokemon,
            formattedText: formattedText
        };
    }
}

// Make UIHandler available globally
window.UIHandler = UIHandler;
console.log('UI-handler.js loaded'); 
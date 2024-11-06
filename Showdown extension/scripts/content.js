console.log('Content script loaded');

let speechify;
let observer;
let waitingForStatChange = false;
let pendingMove = null;
let pendingStats = {
    pokemon: null,
    stats: [],
    direction: null,
    magnitude: null,
    noRetreatMessage: null,
};

let statChangeTimeout = null;

const statChangingMoves = new Set([
    // Self-boosting moves
    'Acupressure', 'Ancient Power', 'Belly Drum', 'Bulk Up', 'Clangorous Soul',
    'Coil', 'Dragon Dance', 'Growth', 'Hone Claws', 'Howl', 'No Retreat',
    'Ominous Wind', 'Shell Smash', 'Shift Gear', 'Swords Dance', 'Work Up',
    'Calm Mind', 'Nasty Plot', 'Quiver Dance', 'Acid Armor', 'Barrier',
    'Cosmic Power', 'Cotton Guard', 'Defend Order', 'Defense Curl', 'Iron Defense',
    'Stockpile', 'Withdraw', 'Amnesia', 'Charge', 'Agility', 'Autotomize',
    'Rock Polish', 'Geomancy',
    
    // Attack decreasing moves
    'Aurora Beam', 'Baby-Doll Eyes', 'Breaking Swipe', 'Charm', 'Feather Dance',
    'Growl', "King's Shield", 'Lunge', 'Max Wyrmwind', 'Memento', 'Noble Roar',
    'Parting Shot', 'Play Nice', 'Play Rough', 'Snarl', 'Strength Sap',
    'Superpower', 'Tearful Look', 'Tickle', 'Trop Kick', 'Venom Drench',
    
    // Special Attack decreasing moves
    'Confide', 'Eerie Impulse', 'Max Flutterby', 'Mist Ball', 'Moonblast',
    'Mystical Fire', 'Skitter Smack', 'Spirit Break', 'Struggle Bug',
    
    // Defense decreasing moves
    'Clanging Scales', 'Close Combat', 'Crunch', 'Crush Claw', 'Dragon Ascent',
    'Fire Lash', 'Grav Apple', 'Iron Tail', 'Leer', 'Liquidation', 'Max Phantasm',
    'Obstruct', 'Octolock', 'Razor Shell', 'Rock Smash', 'Scale Shot', 'Screech',
    'Shadow Ball', 'Shadow Bone', 'Tail Whip', 'Thunderous Kick', 'V-create',
    
    // Special Defense decreasing moves
    'Acid', 'Acid Spray', 'Apple Acid', 'Bug Buzz', 'Earth Power', 'Energy Ball',
    'Fake Tears', 'Flash Cannon', 'Focus Blast', 'Luster Purge', 'Max Darkness',
    'Metal Sound', 'Seed Flare',
    
    // Speed decreasing moves
    'Bubble', 'Bulldoze', 'Constrict', 'Cotton Spore', 'Drum Beating',
    'Electroweb', 'G-Max Foam Burst', 'Glaciate', 'Icy Wind', 'Low Sweep',
    'Max Strike', 'Mud Shot', 'Rock Tomb', 'Scary Face', 'Sticky Web',
    'String Shot', 'Toxic Thread',
    
    // Accuracy decreasing moves
    'Leaf Tornado', 'Mud-Slap', 'Muddy Water', 'Night Daze', 'Sand Attack',
    'Smokescreen',
    
    // Evasiveness decreasing moves
    'Defog', 'G-Max Tartness', 'Sweet Scent'
]);

async function initializeManagers() {
    console.log('Initializing managers...');
    try {
        // Initialize speech
        speechify = new window.SpeechifyManager();
        await speechify.loadSavedVoice();
        
        // Initialize battle state with speechify instance
        const battleState = new window.BattleState(speechify);
        const uiHandler = new window.UIHandler();
        
        // Create and store key manager globally
        window.keyManager = new window.KeyBindingManager(battleState, speechify, uiHandler);
        
        console.log('Managers initialized successfully');
        
        // Load saved highlight color
        const stored = await chrome.storage.sync.get('highlightColor');
        if (stored.highlightColor && window.keyManager?.uiHandler) {
            window.keyManager.uiHandler.highlightColor = stored.highlightColor;
        }
        
    } catch (error) {
        console.error('Error initializing managers:', error);
    }
}

function shouldReadMessage(message) {
    // Skip these patterns
    const ignoredPatterns = [
        /Turn \d+/,
        /^$/,
        /Battle timer/,
        /joined/,
        /left/,
        /is overflowing/,
        
        /Rated battle/,
        /Time left:/,
        /continues to fall/,
        /continues to pour/,
        /continues to be harsh/,
        /continues to rage/,
        /may be unable to move/,
        /come back!/,
        /Format:/,
        /Species Clause:/,
        /HP Percentage Mod:/,
        /Sleep Clause Mod:/,
        /Illusion Level Mod:/,
        /^☆/,
        // Add patterns for stat changes that are handled by move processing
        /'s Attack rose!/,
        /'s Defense rose!/,
        /'s Special Attack rose!/,
        /'s Special Defense rose!/,
        /'s Speed rose!/,
        /'s Attack fell!/,
        /'s Defense fell!/,
        /'s Special Attack fell!/,
        /'s Special Defense fell!/,
        /'s Speed fell!/,
        /'s .* rose sharply!/,
        /'s .* fell sharply!/,
        /'s .* rose drastically!/,
        /'s .* fell drastically!/
    ];

    // Skip if message matches any ignored pattern
    for (const pattern of ignoredPatterns) {
        if (pattern.test(message)) {
            return false;
        }
    }

    // Allow these specific messages
    const allowedPatterns = [
        'started to rain',
        'sunlight turned harsh',
        'sandstorm',
        'hail',
        'snow',
        'Drizzle',
        'Drought',
        'avoided the attack',
        'missed',
        'protected itself',
        'is paralyzed',
        'was burned',
        'was poisoned',
        'was badly poisoned',
        'fell asleep',
        'was frozen',
        'restored a little HP using its Leftovers',
        /lost \d+/
    ];

    // Allow if message matches any allowed pattern
    for (const pattern of allowedPatterns) {
        if (typeof pattern === 'string' && message.includes(pattern)) {
            return true;
        }
        if (pattern instanceof RegExp && pattern.test(message)) {
            return true;
        }
    }

    // Skip empty messages or those with just whitespace
    if (!message || message.trim() === '') {
        return false;
    }

    // Default to allowing other messages
    return true;
}

function formatStatName(stat) {
    switch(stat) {
        case 'Sp. Atk':
            return 'Special Attack';
        case 'Sp. Def':
            return 'Special Defense';
        default:
            return stat;
    }
}

function formatBattleMessage(message) {
    // Keep small tag content but remove the tags themselves
    message = message.replace(/<\/?small>/g, '');
    
    // Remove other HTML tags
    message = message.replace(/<(?!small)[^>]+>/g, '');
    
    // Remove "The opposing" from all messages
    message = message.replace(/The opposing /g, '');

    // Handle move usage first
    const moveMatch = message.match(/(.*) used (.*)!/);
    if (moveMatch) {
        const pokemon = moveMatch[1];
        const move = moveMatch[2];
        
        // If we were waiting for a stat change but got a new move instead
        if (waitingForStatChange) {
            // Announce the previous move with any collected stat changes
            const statChanges = pendingStats.stats.length > 0 
                ? `, its ${pendingStats.stats.join(', ')} ${pendingStats.direction}${pendingStats.magnitude}` 
                : '';
            const noRetreatEffect = pendingStats.noRetreatMessage ? `, ${pendingStats.noRetreatMessage}` : '';
            const previousMove = `${pendingMove.pokemon} used ${pendingMove.move}${statChanges}${noRetreatEffect}`;
            waitingForStatChange = false;
            pendingMove = null;
            pendingStats = { pokemon: null, stats: [], direction: null, magnitude: null, noRetreatMessage: null };
            if (speechify) {
                speechify.speak(previousMove);
            }
        }

        // Check if this is a stat-changing move
        if (statChangingMoves.has(move)) {
            waitingForStatChange = true;
            pendingMove = { pokemon, move };
            pendingStats = { pokemon: null, stats: [], direction: null, magnitude: null, noRetreatMessage: null };
            return null; // Don't announce yet, wait for stat changes
        }

        return `${pokemon} used ${move}`;
    }

    // Handle stat changes
    const statMatch = message.match(/(.*)'s (.*) (rose|fell)( sharply| drastically| harshly)?!/);
    if (statMatch && waitingForStatChange) {
        const pokemon = statMatch[1];
        const stat = formatStatName(statMatch[2]);
        const direction = statMatch[3];
        const magnitude = statMatch[4] || '';

        pendingStats.pokemon = pokemon;
        pendingStats.stats.push(stat);
        pendingStats.direction = direction;
        pendingStats.magnitude = magnitude;

        // Announce the move with stat changes
        const statChanges = `, its ${pendingStats.stats.join(', ')} ${pendingStats.direction}${pendingStats.magnitude}`;
        const moveAnnouncement = `${pendingMove.pokemon} used ${pendingMove.move}${statChanges}`;
        waitingForStatChange = false;
        pendingMove = null;
        pendingStats = { pokemon: null, stats: [], direction: null, magnitude: null, noRetreatMessage: null };
        return moveAnnouncement;
    }

    // Handle hazard setup messages
    if (message.includes('sticky web has been laid') ||
        message.includes('spikes were scattered') ||
        message.includes('pointed stones float') ||
        message.includes('toxic spikes were scattered')) {
        return null; // Skip the follow-up message since we already announced the move
    }

    // If we're waiting for a stat change, handle incoming messages
    if (waitingForStatChange && pendingMove) {
        // Handle health loss during stat wait
        const healthMatch = message.match(/\((.*) lost ([\d.]+)% of its health!\)/);
        if (healthMatch) {
            const pokemon = healthMatch[1].replace('The opposing ', '');
            return `${pokemon} lost ${healthMatch[2]}% of its health`; // Return the message instead of speaking directly
        }

        // Handle No Retreat's escape prevention message
        if (message.includes('can no longer escape because it used No Retreat')) {
            pendingStats.noRetreatMessage = 'and can no longer escape';
            return null;
        }

        // If we get here with pending stats, announce the move and stats
        if (pendingStats.stats.length > 0) {
            const statChanges = `${pendingStats.stats.join(', ')} ${pendingStats.direction}${pendingStats.magnitude}`;
            const noRetreatEffect = pendingStats.noRetreatMessage ? `, ${pendingStats.noRetreatMessage}` : '';
            const combinedMessage = `${pendingMove.pokemon} used ${pendingMove.move}, its ${statChanges}${noRetreatEffect}`;
            waitingForStatChange = false;
            pendingMove = null;
            pendingStats = { pokemon: null, stats: [], direction: null, magnitude: null, noRetreatMessage: null };
            return combinedMessage;
        }

        // If it's not a stat change and we haven't collected any stats, announce just the move
        const moveOnly = `${pendingMove.pokemon} used ${pendingMove.move}`;
        waitingForStatChange = false;
        pendingMove = null;
        pendingStats = { pokemon: null, stats: [], direction: null, magnitude: null, noRetreatMessage: null };
        return moveOnly;
    }

    // Replace username withdrew with "pokemon was withdrawn"
    const withdrewMatch = message.match(/(.*) withdrew (.*?)!/);
    if (withdrewMatch) {
        const pokemon = withdrewMatch[2];
        return `${pokemon} was withdrawn`;
    }

    // Replace other username instances with "they"
    const userActionMatch = message.match(/(.*?) sent out/);
    if (userActionMatch && userActionMatch[1] !== 'You') {
        message = message.replace(userActionMatch[1], 'They');
    }

    // Handle health loss
    const healthMatch = message.match(/\((.*) lost ([\d.]+)% of its health!\)/);
    if (healthMatch) {
        const pokemon = healthMatch[1].replace('The opposing ', '');
        return `${pokemon} lost ${healthMatch[2]}% of its health`;
    }

    // Handle Leftovers
    if (message.includes('restored a little HP using its Leftovers')) {
        const leftoversMatch = message.match(/(.*) restored/);
        if (leftoversMatch) {
            const pokemon = leftoversMatch[1].replace('The opposing ', '');
            return `${pokemon} restored health from Leftovers`;
        }
    }

    // Handle basic messages
    if (message.includes('Battle started')) {
        return 'Battle started';
    }

    if (message.startsWith('Go!')) {
        const pokemonName = message.replace('Go! ', '').replace('!', '');
        return `You sent out ${pokemonName}`;
    }
    
    const sentOutMatch = message.match(/(.*) sent out (.*?)!/);
    if (sentOutMatch) {
        return `They sent out ${sentOutMatch[2]}`;
    }

    // Handle avoided/missed attacks
    if (message.includes('avoided the attack')) {
        const avoidMatch = message.match(/(.*) avoided the attack!/);
        if (avoidMatch) {
            return `${avoidMatch[1]} avoided the attack`;
        }
    }

    // Handle effectiveness
    if (message.includes('It\'s super effective!')) {
        return 'It\'s super effective!';
    }

    if (message.includes('It\'s not very effective...')) {
        return 'It\'s not very effective';
    }

    if (message.includes('It doesn\'t affect')) {
        return 'They are immune';
    }

    // Handle ability activations
    if (message.includes("'s")) {
        const abilityMatch = message.match(/\[(.*)'s (.*)\]/);
        if (abilityMatch) {
            const pokemon = abilityMatch[1];
            const ability = abilityMatch[2];
            return `${pokemon}'s ${ability} activated`;
        }
    }

    // Handle knocked off items
    const knockOffMatch = message.match(/(.*) knocked off (.*)'s (.*)!/);
    if (knockOffMatch) {
        const targetPokemon = knockOffMatch[2];
        const item = knockOffMatch[3];
        return `${targetPokemon} lost their ${item}`;
    }

    return message;
}

// Update the observer to handle messages more reliably
function initializeObserver() {
    const battleLog = document.querySelector('.battle-log');
    
    if (!battleLog) {
        console.log('Battle log not found, retrying in 1 second...');
        setTimeout(initializeObserver, 1000);
        return;
    }

    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const message = node.textContent;
                        console.log('Raw message:', message);
                        
                        if (shouldReadMessage(message)) {
                            console.log('Message passed filter');
                            const formattedMessage = formatBattleMessage(message);
                            console.log('Formatted message:', formattedMessage);
                            
                            if (formattedMessage && speechify) {
                                console.log('Speaking message:', formattedMessage);
                                speechify.speak(formattedMessage);
                            }
                        } else {
                            console.log('Message filtered out');
                        }
                    }
                });
            }
        });
    });

    observer.observe(battleLog, { childList: true, subtree: true });
    console.log('Battle log observer initialized');
}

// Initialize everything when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeManagers);
} else {
    initializeManagers();
}

// Re-initialize when the URL changes (for new battles)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('URL changed, reinitializing...');
        initializeObserver();
    }
}).observe(document, { subtree: true, childList: true });

// Add to existing event listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateHighlightColor') {
        if (window.keyManager?.uiHandler) {
            window.keyManager.uiHandler.highlightColor = message.color;
            // Save to storage to persist
            chrome.storage.sync.set({ highlightColor: message.color });
        }
    }
});

// Update the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'forceSettingsUpdate') {
        console.log('Forcing settings update:', message.settings);
        if (window.keyManager?.uiHandler) {
            // Update UI settings
            window.keyManager.uiHandler.setHighlightColor(message.settings.highlightColor);
            window.keyManager.uiHandler.setHighlightWidth(message.settings.highlightWidth);
            
            // Update speech settings
            if (window.speechify) {
                window.speechify.setSpeechRate(message.settings.speechRate);
                window.speechify.setVoice(message.settings.voiceId);
            }
            
            // Update key bindings
            window.keyManager.updateKeyBindings(message.settings);
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateHighlightWidth') {
        if (window.keyManager?.uiHandler) {
            window.keyManager.uiHandler.setHighlightWidth(message.width);
            // Save to storage to persist
            chrome.storage.sync.set({ highlightWidth: message.width });
        }
    }
});
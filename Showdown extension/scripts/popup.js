function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        if (!window.config || !window.config.speechifyApiKey) {
            throw new Error('Speechify API key not configured');
        }
        
        const speechify = new window.SpeechifyManager();
        const voiceSelect = document.getElementById('voiceSelect');
        const testButton = document.getElementById('testVoice');
        const speechRateSlider = document.getElementById('speechRate');
        const speechRateValue = document.getElementById('speechRateValue');

        // Load saved speech rate
        const savedRate = await speechify.loadSavedRate();
        speechRateSlider.value = savedRate;
        speechRateValue.textContent = `${savedRate.toFixed(1)}x`;

        // Add event listener for speech rate changes
        speechRateSlider.addEventListener('input', function() {
            const rate = parseFloat(this.value);
            speechRateValue.textContent = `${rate.toFixed(1)}x`;
            speechify.setSpeechRate(rate);
            console.log('Speech rate slider changed to:', rate);
        });

        // Populate voice selection dropdown
        const voices = await speechify.getAvailableVoices();
        voiceSelect.innerHTML = voices.map(voice => 
            `<option value="${voice.id}">${voice.display_name} (${voice.gender})</option>`
        ).join('');

        // Set the currently selected voice
        const currentVoice = await speechify.loadSavedVoice();
        if (currentVoice) {
            voiceSelect.value = currentVoice;
        }

        // Voice selection handling
        voiceSelect.addEventListener('change', async function() {
            await speechify.setVoice(this.value);
            console.log('Voice changed to:', this.value);
        });

        // Test button handling
        testButton.addEventListener('click', async () => {
            try {
                console.log('Testing voice...');
                await speechify.speak('Pikachu, I choose you!');
                console.log('Speech completed successfully');
            } catch (error) {
                console.error('Error testing voice:', error);
            }
        });

        // Load saved settings
        const stored = await chrome.storage.sync.get(['highlightColor', 'highlightWidth']);
        
        // Set up color picker
        const colorPicker = document.getElementById('highlightColor');
        if (stored.highlightColor) {
            colorPicker.value = stored.highlightColor;
        }

        // Set up width slider
        const widthSlider = document.getElementById('highlightWidth');
        const widthValue = document.getElementById('highlightWidthValue');
        if (stored.highlightWidth) {
            widthSlider.value = stored.highlightWidth;
            widthValue.textContent = `${stored.highlightWidth}px`;
        }

        // Debounced storage functions
        const debouncedColorStorage = debounce(async (color) => {
            await chrome.storage.sync.set({ highlightColor: color });
        }, 250);

        const debouncedWidthStorage = debounce(async (width) => {
            await chrome.storage.sync.set({ highlightWidth: width });
        }, 250);

        // Live color updates
        colorPicker.addEventListener('input', async (e) => {
            const color = e.target.value;
            
            try {
                const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                const activeTab = tabs[0];
                
                if (activeTab?.url?.includes('pokemonshowdown.com')) {
                    await chrome.tabs.sendMessage(activeTab.id, {
                        type: 'updateHighlightColor',
                        color: color
                    });
                }
                // Debounced storage update
                debouncedColorStorage(color);
            } catch (error) {
                console.log('Tab not ready yet, saving to storage only');
            }
        });

        // Live width updates
        widthSlider.addEventListener('input', (e) => {
            // Just update the display value, don't send messages or save
            const width = parseInt(e.target.value);
            widthValue.textContent = `${width}px`;
        });

        // Update save button to handle all settings
        document.getElementById('saveSettings').addEventListener('click', async () => {
            // Collect all settings
            const settings = {
                // Display settings
                highlightColor: document.getElementById('highlightColor').value,
                highlightWidth: parseInt(document.getElementById('highlightWidth').value),
                showTeraType: document.getElementById('showTeraType').checked,
                
                // Speech settings
                speechRate: parseFloat(document.getElementById('speechRate').value),
                voiceId: document.getElementById('voiceSelect').value,
                
                // Key bindings
                currentPokemonKey: document.getElementById('currentPokemonKey').value,
                opponentPokemonKey: document.getElementById('opponentPokemonKey').value,
                teamPreviewKey: document.getElementById('teamPreviewKey').value,
                fieldConditionsKey: document.getElementById('fieldConditionsKey').value,
                teraKey: document.getElementById('teraKey').value,
                cancelKey: document.getElementById('cancelKey').value,
                move1Key: document.getElementById('move1Key').value,
                move2Key: document.getElementById('move2Key').value,
                move3Key: document.getElementById('move3Key').value,
                move4Key: document.getElementById('move4Key').value,
                pokemon1Key: document.getElementById('pokemon1Key').value,
                pokemon2Key: document.getElementById('pokemon2Key').value,
                pokemon3Key: document.getElementById('pokemon3Key').value,
                pokemon4Key: document.getElementById('pokemon4Key').value,
                pokemon5Key: document.getElementById('pokemon5Key').value,
                pokemon6Key: document.getElementById('pokemon6Key').value
            };
            
            // Save all settings to storage
            await chrome.storage.sync.set(settings);
            
            // Send update to content script
            try {
                const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                const activeTab = tabs[0];
                
                if (activeTab?.url?.includes('pokemonshowdown.com')) {
                    await chrome.tabs.sendMessage(activeTab.id, {
                        type: 'forceSettingsUpdate',
                        settings: settings
                    });
                }
            } catch (error) {
                console.log('Tab not ready yet, saving to storage only');
            }
            
            // Visual feedback
            const saveButton = document.getElementById('saveSettings');
            saveButton.textContent = 'Saved!';
            setTimeout(() => {
                saveButton.textContent = 'Save Settings';
            }, 1000);
        });

    } catch (error) {
        console.error('Initialization error:', error);
        document.body.innerHTML = `
            <div style="color: red; padding: 20px;">
                Error: ${error.message}<br>
                Please ensure config.js is properly set up with your Speechify API key.
            </div>`;
    }
});
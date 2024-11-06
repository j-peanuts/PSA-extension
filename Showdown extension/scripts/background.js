importScripts('../scripts/config.js');
// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'speechify') {
        fetch(`https://api.sws.speechify.com/v1/${request.endpoint}`, {
            method: request.method,
            headers: {
                'Authorization': `Bearer ${CONFIG.speechifyApiKey}`, // Using CONFIG from config.js
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.data)
        })
        .then(async response => {
            const responseText = await response.text();
            
            if (!response.ok) {
                throw new Error(`API Error (${response.status}): ${responseText}`);
            }

            let jsonData;
            try {
                jsonData = JSON.parse(responseText);
            } catch (error) {
                throw new Error('Invalid JSON response from API');
            }

            // Send the audio data back to the content script
            sendResponse({ 
                success: true, 
                audio_data: jsonData.audio_data 
            });
        })
        .catch(error => {
            console.error('Speechify API Error:', error);
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        });
        
        return true;
    }

    return true;
});
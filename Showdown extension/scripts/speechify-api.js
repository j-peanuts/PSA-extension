
class SpeechifyManager {
  constructor() {
    if (!window.config || !window.config.speechifyApiKey) {
      throw new Error('Speechify API key not configured. Please set up config.js with your API key.');
    }
    this.apiKey = window.config.speechifyApiKey;
    this.API_BASE_URL = "https://api.sws.speechify.com";
    this.speechRate = 1.0;
    this.availableVoices = [];
    this.loadSavedVoice();
    this.speechQueue = [];
    this.isSpeaking = false;
  }

  async processQueue() {
    if (this.isSpeaking || this.speechQueue.length === 0) return;
    
    this.isSpeaking = true;
    const text = this.speechQueue.shift();
    
    try {
      await this.speakText(text);
    } catch (error) {
      console.error('Error processing speech queue:', error);
    } finally {
      this.isSpeaking = false;
      if (this.speechQueue.length > 0) {
        await this.processQueue();
      }
    }
  }

  async speak(text) {
    if (!text) {
      console.error('No text provided for speech');
      return;
    }

    this.speechQueue.push(text);
    
    if (!this.isSpeaking) {
      await this.processQueue();
    }
  }

  async speakText(text) {
    if (!text) return;

    try {
      const ratePercentage = Math.round(this.speechRate * 50);
      
      const requestData = {
        input: `<speak><prosody rate="${ratePercentage}%">${text}</prosody></speak>`,
        voice_id: this.selectedVoice,
        audio_format: 'mp3'
      };

      console.log('Sending speech request:', {
        ...requestData,
        originalRate: this.speechRate,
        calculatedPercentage: ratePercentage
      });

      const response = await chrome.runtime.sendMessage({
        type: 'speechify',
        method: 'POST',
        endpoint: 'audio/speech',
        apiKey: this.apiKey,
        data: requestData
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      if (response.audio_data) {
        return new Promise((resolve, reject) => {
          const audio = new Audio();
          
          audio.addEventListener('canplaythrough', () => {
            console.log('Audio ready to play');
            audio.play()
              .then(() => {
                console.log('Audio playing');
                audio.addEventListener('ended', () => {
                  console.log('Audio finished');
                  resolve();
                }, { once: true });
              })
              .catch(error => {
                console.error('Play error:', error);
                reject(error);
              });
          }, { once: true });

          audio.addEventListener('error', (e) => {
            const errorDetails = {
              code: e.target.error?.code,
              message: e.target.error?.message
            };
            console.error('Audio error details:', errorDetails);
            reject(new Error(`Audio loading failed: ${errorDetails.message || 'Unknown error'}`));
          }, { once: true });

          const dataUrl = `data:audio/mp3;base64,${response.audio_data}`;
          audio.src = dataUrl;
        });
      } else {
        throw new Error('No audio data received');
      }
    } catch (error) {
      console.error('Error using Speechify API:', error);
      return new Promise((resolve, reject) => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = this.speechRate;
          utterance.onend = resolve;
          utterance.onerror = reject;
          speechSynthesis.speak(utterance);
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  async loadSavedRate() {
    try {
      const result = await chrome.storage.sync.get('speechRate');
      this.speechRate = result.speechRate || 1.0;
      return this.speechRate;
    } catch (error) {
      console.error('Error loading saved rate:', error);
      return 1.0; // Default rate if loading fails
    }
  }

  async setSpeechRate(rate) {
    try {
      this.speechRate = rate;
      await chrome.storage.sync.set({ speechRate: rate });
    } catch (error) {
      console.error('Error saving speech rate:', error);
    }
  }

  getSpeechRate() {
    return this.speechRate;
  }

  async loadSavedVoice() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['selectedVoice'], (result) => {
        if (result.selectedVoice) {
          this.selectedVoice = result.selectedVoice;
        } else {
          this.selectedVoice = 'matthew'; // Default voice
        }
        resolve(this.selectedVoice);
      });
    });
  }

  async setVoice(voiceId) {
    this.selectedVoice = voiceId;
    await chrome.storage.sync.set({ selectedVoice: voiceId });
  }

  async getAvailableVoices() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/v1/voices`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const voices = await response.json();
      this.availableVoices = voices;
      return voices;
    } catch (error) {
      console.error('Error fetching voices from Speechify API:', error);
      return [];
    }
  }
}

window.SpeechifyManager = SpeechifyManager; 
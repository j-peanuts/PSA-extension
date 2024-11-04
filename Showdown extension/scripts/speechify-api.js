class SpeechifyManager {
  constructor() {
    this.apiKey = 'i1qo1h5eYsC92URMP_Ji9DzdX9eUAzVEw0VNAgFDYCU=';
    this.speechRate = 1.0;
  }

  async speak(text) {
    try {
      const response = await fetch('https://api.speechify.com/api/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          text: text,
          voice: 'en-US',
          rate: this.speechRate
        })
      });

      if (!response.ok) {
        throw new Error('Speechify API request failed');
      }

      const audioData = await response.blob();
      const audio = new Audio(URL.createObjectURL(audioData));
      audio.play();
    } catch (error) {
      console.error('Error using Speechify API:', error);
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.speechRate;
      speechSynthesis.speak(utterance);
    }
  }

  setSpeechRate(rate) {
    this.speechRate = rate;
  }

  stop() {
    speechSynthesis.cancel();
  }
} 
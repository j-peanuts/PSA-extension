class UIHandler {
  constructor() {
    this.highlightColor = '#ff0000';
    this.highlightedElements = new Set();
  }

  setHighlightColor(color) {
    this.highlightColor = color;
    // Update any currently highlighted elements
    this.highlightedElements.forEach(element => {
      element.style.borderColor = color;
    });
  }

  highlightMove(moveIndex) {
    // Clear previous highlights
    this.clearHighlights();

    // Find and highlight the move button
    const moveButtons = document.querySelectorAll('.movemenu button');
    if (moveButtons[moveIndex - 1]) {
      const button = moveButtons[moveIndex - 1];
      button.style.border = `3px solid ${this.highlightColor}`;
      this.highlightedElements.add(button);
    }
  }

  highlightSwitch(pokemonIndex) {
    // Clear previous highlights
    this.clearHighlights();

    // Find and highlight the switch button
    const switchButtons = document.querySelectorAll('.switchmenu button');
    if (switchButtons[pokemonIndex - 1]) {
      const button = switchButtons[pokemonIndex - 1];
      button.style.border = `3px solid ${this.highlightColor}`;
      this.highlightedElements.add(button);
    }
  }

  highlightTera() {
    // Clear previous highlights
    this.clearHighlights();

    // Find and highlight the tera button
    const teraButton = document.querySelector('.terastallize');
    if (teraButton) {
      teraButton.style.border = `3px solid ${this.highlightColor}`;
      this.highlightedElements.add(teraButton);
    }
  }

  clearHighlights() {
    this.highlightedElements.forEach(element => {
      element.style.border = '';
    });
    this.highlightedElements.clear();
  }

  clickHighlightedElement() {
    if (this.highlightedElements.size === 1) {
      const element = this.highlightedElements.values().next().value;
      element.click();
      this.clearHighlights();
      return true;
    }
    return false;
  }

  clickCancelButton() {
    const cancelButton = document.querySelector('.cancelButton');
    if (cancelButton) {
      cancelButton.click();
      this.clearHighlights();
      return true;
    }
    return false;
  }
} 
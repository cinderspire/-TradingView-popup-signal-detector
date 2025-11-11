/**
 * Dark Mode Toggle Script
 * Persists theme preference in localStorage
 */

class ThemeManager {
  constructor() {
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    // Apply saved theme
    document.documentElement.setAttribute('data-theme', this.theme);

    // Create toggle button
    this.createToggleButton();

    // Listen for system preference changes
    this.watchSystemPreference();
  }

  createToggleButton() {
    const toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.setAttribute('aria-label', 'Toggle theme');
    toggle.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';

    toggle.addEventListener('click', () => this.toggleTheme());

    document.body.appendChild(toggle);
    this.toggleButton = toggle;
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('theme', this.theme);

    this.toggleButton.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';

    console.log(`🎨 Theme switched to ${this.theme} mode`);
  }

  watchSystemPreference() {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    darkModeQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        // Only auto-switch if user hasn't set preference
        this.theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        this.toggleButton.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
      }
    });
  }

  getTheme() {
    return this.theme;
  }

  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;

    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.toggleButton.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Initialize on page load
const themeManager = new ThemeManager();

// Expose globally for external scripts
window.themeManager = themeManager;

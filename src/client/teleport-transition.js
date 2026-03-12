/**
 * TeleportTransition — screen fade for zone teleportation.
 *
 * Creates a full-screen overlay that fades to black on teleport,
 * then fades back in. Makes zone transitions feel intentional,
 * not like a glitch.
 *
 * CPU cost:  0 (CSS transitions, no JS per frame)
 * GPU cost:  0 (composited by browser, not Three.js)
 * Memory:    ~1 KB
 */

export class TeleportTransition {
  constructor() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'teleport-overlay';
    Object.assign(this._overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: '#0d1b2a',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '500',
      transition: 'opacity 0.25s ease-in-out',
    });
    document.body.appendChild(this._overlay);

    // Zone name flash
    this._label = document.createElement('div');
    Object.assign(this._label.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#00ff88',
      fontFamily: '"Courier New", monospace',
      fontSize: '28px',
      letterSpacing: '4px',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '501',
      transition: 'opacity 0.3s ease-in-out',
      textShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
      textTransform: 'uppercase',
    });
    document.body.appendChild(this._label);

    this._active = false;
  }

  /**
   * Play teleport transition.
   * @param {string} zoneName - Name of the destination zone
   * @param {Function} onMidpoint - Called when screen is fully black (do the actual move here)
   * @returns {Promise} Resolves when transition completes
   */
  play(zoneName, onMidpoint) {
    if (this._active) return Promise.resolve();
    this._active = true;

    return new Promise((resolve) => {
      // Phase 1: Fade to black
      this._overlay.style.opacity = '1';
      this._label.textContent = zoneName;

      setTimeout(() => {
        // Midpoint: screen is black, show zone name, execute move
        this._label.style.opacity = '1';
        if (onMidpoint) onMidpoint();

        setTimeout(() => {
          // Phase 2: Fade zone name
          this._label.style.opacity = '0';

          setTimeout(() => {
            // Phase 3: Fade from black
            this._overlay.style.opacity = '0';

            setTimeout(() => {
              this._active = false;
              resolve();
            }, 300);
          }, 200);
        }, 600);
      }, 300);
    });
  }
}

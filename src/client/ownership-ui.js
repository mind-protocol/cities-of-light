/**
 * OwnershipUI — Zone ownership placeholder overlay.
 *
 * Shows current zone info + ownership status in a minimal HUD.
 * Non-functional for now — displays "Unclaimed" with a placeholder
 * claim button. Evokes the Islands NFT collection (108 tokens on Polygon).
 *
 * No backend dependency. Pure DOM overlay.
 */

import { ZONES } from '../shared/zones.js';

export class OwnershipUI {
  constructor() {
    this._currentZone = null;
    this._el = null;
    this._build();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'ownership-panel';
    Object.assign(this._el.style, {
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      padding: '12px 16px',
      background: 'rgba(13, 27, 42, 0.85)',
      border: '1px solid rgba(0, 255, 136, 0.2)',
      borderRadius: '6px',
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: 'rgba(200, 200, 200, 0.7)',
      zIndex: '100',
      backdropFilter: 'blur(8px)',
      lineHeight: '1.6',
      minWidth: '180px',
      pointerEvents: 'auto',
      transition: 'opacity 0.3s',
    });

    this._el.innerHTML = `
      <div id="own-zone-name" style="color:#00ff88;font-size:13px;font-weight:bold;margin-bottom:4px;">—</div>
      <div id="own-zone-lore" style="color:rgba(255,255,255,0.4);font-size:10px;margin-bottom:6px;font-style:italic;">—</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:rgba(255,204,68,0.6);">Owner:</span>
        <span id="own-owner" style="color:rgba(255,255,255,0.5);">Unclaimed</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        <span style="color:rgba(255,204,68,0.6);">Mode:</span>
        <span id="own-mode" style="color:rgba(255,255,255,0.5);">—</span>
      </div>
      <button id="own-claim-btn" style="
        margin-top:8px;
        width:100%;
        padding:6px 0;
        background:rgba(0,255,136,0.08);
        border:1px solid rgba(0,255,136,0.25);
        color:rgba(0,255,136,0.6);
        font-family:'Courier New',monospace;
        font-size:10px;
        cursor:pointer;
        border-radius:3px;
        letter-spacing:1px;
      ">CLAIM ISLAND</button>
    `;

    document.body.appendChild(this._el);

    // Placeholder: claim button does nothing yet
    const btn = this._el.querySelector('#own-claim-btn');
    btn.addEventListener('click', () => {
      btn.textContent = 'COMING SOON';
      btn.style.color = 'rgba(255, 255, 255, 0.3)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      btn.disabled = true;
    });
  }

  /**
   * Update displayed zone info.
   * @param {Object} zone - Zone object from ZONES array
   */
  setZone(zone) {
    if (!zone || zone.id === this._currentZone?.id) return;
    this._currentZone = zone;

    const nameEl = this._el.querySelector('#own-zone-name');
    const loreEl = this._el.querySelector('#own-zone-lore');
    const modeEl = this._el.querySelector('#own-mode');
    const ownerEl = this._el.querySelector('#own-owner');
    const btn = this._el.querySelector('#own-claim-btn');

    nameEl.textContent = zone.name;
    loreEl.textContent = zone.loreName;
    modeEl.textContent = zone.mode;

    // Nicolas's island is "owned"
    if (zone.id === 'island') {
      ownerEl.textContent = 'NLR_ai';
      ownerEl.style.color = '#00ff88';
      btn.style.display = 'none';
    } else {
      ownerEl.textContent = 'Unclaimed';
      ownerEl.style.color = 'rgba(255, 255, 255, 0.5)';
      btn.style.display = 'block';
      btn.textContent = 'CLAIM ISLAND';
      btn.disabled = false;
      btn.style.color = 'rgba(0, 255, 136, 0.6)';
      btn.style.borderColor = 'rgba(0, 255, 136, 0.25)';
    }
  }

  /** Hide in VR (panel is 2D overlay, not useful in headset). */
  setVisible(visible) {
    this._el.style.opacity = visible ? '1' : '0';
    this._el.style.pointerEvents = visible ? 'auto' : 'none';
  }
}

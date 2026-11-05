/**
 * Rooms & flats page, flat details modal and Wi-Fi display.
 */
import {state} from './store.js';
import {esc, goPage, toast} from './ui.js';

export function renderRooms() {
  const fs = window.pgFlats || [],
    rs = state.residents || [];
  const body = fs
    .map((f) => {
      const o = window.flatOccupancyInfo(f, rs),
        used = Number.isInteger(o.used) ? o.used : o.used.toFixed(1);
      return (
        '<div class="floor"><div class="floorlabel">' +
        esc(f.floor_name) +
        '</div><div class="roomrow"><button type="button" class="room room-select ' +
        o.state +
        '" data-flat="' +
        esc(f.flat_number) +
        '" aria-label="Open details for ' +
        esc(f.flat_number) +
        '"><b>' +
        esc(f.flat_number) +
        '</b><small>' +
        o.count +
        ' resident' +
        (o.count === 1 ? '' : 's') +
        ' · ' +
        used +
        ' / ' +
        o.capacity +
        ' rooms occupied</small></button></div></div>'
      );
    })
    .join('');
  document.getElementById('pageContent').innerHTML = fs.length
    ? '<div class="occupancy">' + body + '</div>'
    : '<div style="padding:25px;text-align:center"><h3 style="font:700 14px Manrope">No flats added yet</h3><p class="sub">Add your building and flats in Settings.</p><button class="primary" onclick="window.editPropertySetup?.()">Set up building</button></div>';
}

window.flatOccupancyInfo = (flat, list) => {
  const assigned = list.filter((r) => r.room === flat.flat_number),
    capacity = Math.max(0, Number(flat.room_count) || 0),
    used = assigned.reduce((n, r) => n + (r.sharing_type === 'double' ? 0.5 : 1), 0),
    state =
      capacity > 0 && used > capacity
        ? 'overfull'
        : capacity > 0 && used >= capacity
          ? 'full'
          : assigned.length
            ? 'partial'
            : 'empty';
  return {count: assigned.length, used, capacity, state};
};

window.showFlatDetails = (flatNumber) => {
  const flat = (window.pgFlats || []).find((f) => f.flat_number === flatNumber) || {},
    box = document.createElement('div');
  box.id = 'flatDetailsModal';
  box.className = 'overlay show';
  box.innerHTML =
    '<div class="modal"><div class="modalhead"><div><h2>' +
    esc(flatNumber) +
    ' details</h2><p>Wi-Fi details</p></div><button class="close" type="button">×</button></div><div class="field"><label>Wi-Fi name</label><div style="display:flex;gap:8px"><input id="flatWifiName" readonly value="' +
    esc(flat.wifi_ssid || 'Not configured') +
    '"><button class="secondary" type="button">Copy</button></div></div><div class="field" style="margin-top:12px"><label>Wi-Fi password</label><div style="display:flex;gap:8px"><input id="flatWifiPassword" readonly value="' +
    esc(flat.wifi_password || 'Not configured') +
    '"><button class="secondary" type="button">Copy</button></div></div></div>';
  const b = box.querySelectorAll('.secondary');
  b[0].onclick = () =>
    navigator.clipboard.writeText(box.querySelector('#flatWifiName').value).then(() => toast('Wi-Fi name copied'));
  b[1].onclick = () =>
    navigator.clipboard
      .writeText(box.querySelector('#flatWifiPassword').value)
      .then(() => toast('Wi-Fi password copied'));
  box.querySelector('.close').onclick = () => box.remove();
  document.body.appendChild(box);
};

window.showFlatResidents = (flat) => {
  const s = document.getElementById('searchInput');
  if (s) {
    s.value = flat;
    goPage('residents');
    toast('Residents in ' + flat);
  }
};

const addWifi = () =>
  document.querySelectorAll('.room-select').forEach((room) => {
    if (room.nextElementSibling?.classList.contains('wifi-select')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary wifi-select';
    b.textContent = 'Wi-Fi';
    b.style.padding = '6px 8px';
    room.parentElement.style.justifyContent = 'flex-start';
    room.parentElement.style.gap = '10px';
    b.onclick = (e) => {
      e.stopPropagation();
      window.showFlatDetails(room.dataset.flat);
    };
    room.parentElement.appendChild(b);
  });

/** Attach DOM event listeners for this feature. Called once from main.js. */
export function initRooms() {
  document.addEventListener('click', (e) => {
    const tile = e.target.closest && e.target.closest('.room-select');
    if (tile) {
      e.preventDefault();
      e.stopPropagation();
      window.showFlatResidents(tile.dataset.flat);
    }
  });
  new MutationObserver(addWifi).observe(document.getElementById('pageContent'), {childList: true, subtree: true});
  addWifi();
}

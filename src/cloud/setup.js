/**
 * Owner property setup: the flats/rooms editor and its save handler.
 */
import {toast} from '../app/ui.js';
import {supabase} from './client.js';
import {gate} from './elements.js';
import {session} from './session.js';

export function addSetupFlat(flat = {}) {
  const row = document.createElement('div');
  row.className = 'formgrid setup-flat';
  row.style.cssText = 'border:1px solid var(--line);padding:10px;border-radius:10px;align-items:end';
  row.dataset.id = flat.id || '';
  row.innerHTML = `<div class="field"><label>Flat / room name *</label><input name="flat_number" required value="${String(flat.flat_number || '').replaceAll('"', '&quot;')}" placeholder="e.g. Flat 101"></div><div class="field"><label>Floor *</label><input name="floor_name" required value="${String(flat.floor_name || 'Ground').replaceAll('"', '&quot;')}" placeholder="e.g. First floor"></div><div class="field"><label>Number of rooms *</label><input name="room_count" type="number" min="1" required value="${flat.room_count || 2}"></div><div class="field"><label>Wi-Fi network (optional)</label><input name="wifi_ssid" value="${String(flat.wifi_ssid || '').replaceAll('"', '&quot;')}" placeholder="Network name"></div><div class="field"><label>Wi-Fi password (optional)</label><input name="wifi_password" type="password" value="${String(flat.wifi_password || '').replaceAll('"', '&quot;')}" placeholder="Password"></div><button type="button" class="secondary remove-flat">Remove</button>`;
  row.querySelector('.remove-flat').onclick = () => {
    if (document.querySelectorAll('.setup-flat').length === 1) return;
    row.remove();
  };
  document.getElementById('setupFlats').append(row);
}

/**
 * Open the building setup form.
 * @param {object|null} existingProperty Building being edited, or null when creating one.
 * @param {object[]} [existingFlats] Its current flats.
 * @param {object} [pending] Details captured at sign-up for a first-time setup.
 * @param {{createNew?: boolean}} [options] createNew adds another building without touching the active one.
 */
export function showSetup(existingProperty, existingFlats = [], pending = {}, options = {}) {
  // Kept apart from session.property so cancelling "new building" never disturbs the building in use.
  session.setup = {property: existingProperty || null, flats: existingFlats, createNew: Boolean(options.createNew)};
  gate.style.display = 'none';
  const setup = document.getElementById('ownerSetupGate');
  setup.style.display = 'block';
  const f = document.getElementById('ownerSetupForm');
  f.elements.propertyName.value = existingProperty?.name || pending?.name || '';
  f.elements.propertyAddress.value = existingProperty?.address || pending?.address || '';
  document.getElementById('setupFlats').innerHTML = '';
  (existingFlats.length
    ? existingFlats
    : pending?.flats?.length
      ? pending.flats
      : [{flat_number: '', floor_name: '', room_count: 1}]
  ).forEach(addSetupFlat);
  document.getElementById('addFlatRow').onclick = () => addSetupFlat();
  setup.querySelector('h2').textContent = options.createNew ? 'Add a new building' : 'Set up your building';
  const skip = document.getElementById('skipPropertySetup');
  skip.textContent = options.createNew ? 'Cancel' : 'Skip for now';
  skip.onclick = () => {
    if (options.createNew) {
      setup.style.display = 'none';
      return;
    }
    localStorage.setItem('staywise_skip_setup', '1');
    document.getElementById('ownerSetupGate').style.display = 'none';
    gate.style.display = 'none';
    toast('You can add building details later from Settings');
  };
}

/** Attach the setup form submit handler. Called once from index.js. */
export function initOwnerSetup() {
  document.getElementById('ownerSetupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('setupError');
    err.textContent = 'Saving property and rooms…';
    const {
      data: {user: authUser},
      error: authErr
    } = await supabase.auth.getUser();
    if (authErr || !authUser) {
      err.textContent = 'Your sign-in session expired. Sign in again, then retry building setup.';
      return;
    }
    session.currentUser = authUser;
    const d = new FormData(e.target),
      rows = [...document.querySelectorAll('.setup-flat')].map((row) => ({
        id: row.dataset.id || null,
        flat_number: String(row.querySelector('[name=flat_number]').value).trim(),
        floor_name: String(row.querySelector('[name=floor_name]').value).trim(),
        room_count: Number(row.querySelector('[name=room_count]').value),
        wifi_ssid: row.querySelector('[name=wifi_ssid]').value.trim() || null,
        wifi_password: row.querySelector('[name=wifi_password]').value || null
      }));
    if (!rows.length || rows.some((x) => !x.flat_number || !x.floor_name || x.room_count < 1))
      return (err.textContent = 'Add at least one room and complete its details.');
    if (new Set(rows.map((x) => x.flat_number.toLowerCase())).size !== rows.length)
      return (err.textContent = 'Flat / room names must be unique.');
    let prop = session.setup.property;
    if (prop) {
      const {data, error} = await supabase
        .from('properties')
        .update({name: d.get('propertyName'), address: d.get('propertyAddress') || null, setup_complete: true})
        .eq('id', prop.id)
        .select()
        .single();
      if (error) {
        err.textContent =
          error.code === '23503'
            ? 'Supabase could not match this session to an Auth user. Sign out, sign back in using the same Supabase project, then retry.'
            : error.message;
        return;
      }
      prop = data;
    } else {
      const {data, error} = await supabase
        .from('properties')
        .insert({name: d.get('propertyName'), address: d.get('propertyAddress') || null, setup_complete: true})
        .select()
        .single();
      if (error) {
        err.textContent =
          error.code === '23503'
            ? 'Supabase could not match this session to an Auth user. Sign out, sign back in using the same Supabase project, then retry.'
            : error.message;
        return;
      }
      prop = data;
    }
    const old = session.setup.flats;
    for (const r of rows) {
      const payload = {
        property_id: prop.id,
        flat_number: r.flat_number,
        floor_name: r.floor_name,
        room_count: r.room_count,
        wifi_ssid: r.wifi_ssid,
        wifi_password: r.wifi_password,
        active: true
      };
      const q = r.id
        ? await supabase.from('flats').update(payload).eq('id', r.id)
        : await supabase.from('flats').insert(payload);
      if (q.error) {
        err.textContent = q.error.message;
        return;
      }
    }
    const removed = old.filter((f) => !rows.some((r) => r.id === f.id));
    for (const f of removed) {
      const {count, error} = await supabase
        .from('residents')
        .select('id', {count: 'exact', head: true})
        .eq('flat_id', f.id)
        .eq('active', true);
      if (error) {
        err.textContent = error.message;
        return;
      }
      if (count) {
        err.textContent = `${f.flat_number} has active residents. Move them before removing this flat.`;
        return;
      }
      const q = await supabase.from('flats').update({active: false}).eq('id', f.id);
      if (q.error) {
        err.textContent = q.error.message;
        return;
      }
    }
    // Open the building that was just saved (a newly created one becomes the active building).
    localStorage.setItem('staywise_property_id', prop.id);
    location.hash = '';
    location.reload();
  });
}

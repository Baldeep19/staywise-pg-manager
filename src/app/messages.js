/**
 * Messages page and WhatsApp reminder drafting.
 */
import {state} from './store.js';
import {closeModal, goPage, openModal, toast} from './ui.js';

export function goMessages() {
  goPage('messages');
}

export function renderMessages() {
  document.getElementById('pageContent').innerHTML =
    `<div style="padding:20px"><div class="pagehead"><div><h2>Send a resident update</h2><div class="sub">Draft a rent reminder or electricity bill message</div></div></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 22px"><button class="secondary" onclick="draftRent()">₹ Draft rent reminders</button><button class="secondary" onclick="openModal('electricityModal')">ϟ Create electricity bills</button></div><h2 style="font:700 13px Manrope">Recent messages</h2><div class="sub" style="padding:12px 0">No messages sent from this workspace yet. Your draft history will appear here.</div></div>`;
}

export function draftRent() {
  state.lastMessage = `Hello All, this is a friendly reminder that your rent is due. Please make the payment at your earliest convenience. If you have already paid, kindly ignore this message. Thank you — ${window.pgPropertyName || 'your building'}`;
  document.getElementById('messageTitle').textContent = 'Draft rent reminder';
  document.getElementById('messageText').value = state.lastMessage;
  openModal('messageModal');
}

export function launchWhatsApp() {
  let text = document.getElementById('messageText').value;
  if (!text.trim()) {
    toast('Add a message first');
    return;
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  closeModal('messageModal');
  toast('WhatsApp opened with your draft');
}

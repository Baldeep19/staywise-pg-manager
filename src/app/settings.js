/**
 * Settings page: the buildings the user can access (switch, create, edit) and account actions.
 */
import pkg from '../../package.json';
import {renderInstallSection} from './install.js';
import {esc} from './ui.js';

/** Render the Settings page into #pageContent. Buildings come from window.pgProperties (set by the cloud loader). */
export function renderSettings() {
  const buildings = window.pgProperties || [];
  const rows = buildings
    .map((b) => {
      const isCurrent = b.id === window.pgCurrentPropertyId;
      const role = b.owner_id === window.pgCurrentUserId ? 'Owner' : 'Partner';
      const action = isCurrent
        ? '<span class="sub"><b>Current building</b></span>'
        : `<button class="secondary" onclick="switchProperty('${esc(b.id)}')">Switch to this building</button>`;
      return `<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.address || '—')}</td><td>${role}</td><td>${action}</td></tr>`;
    })
    .join('');
  const emptyMessage = window.pgCurrentUserId
    ? 'You have not added a building yet — use “Add building details” above.'
    : 'Sign in to manage your buildings.';
  document.getElementById('pageContent').innerHTML = `
    <div style="padding:20px">
      <section class="report-block">
        <div class="report-blockhead" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div><h3>Your buildings</h3><p>Manage several properties from one account and switch between them.</p></div>
          <button class="primary" onclick="createNewBuilding()">＋ Create new building</button>
        </div>
        <div class="report-table"><table class="table">
          <thead><tr><th>Building</th><th>Address</th><th>Your role</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="sub">${emptyMessage}</td></tr>`}</tbody>
        </table></div>
      </section>
      ${renderInstallSection()}
      <section class="report-block" id="aboutSection">
        <div class="report-blockhead"><h3>About Staywise</h3><p>Version ${esc(pkg.version)}</p></div>
        <div class="about-grid">
          <div>Staywise is an owner-first app for running a PG (paying-guest) property: residents, rent, electricity bills, expenses and partners in one place.</div>
          <div><b>What you can do</b>
            <ul>
              <li>Keep resident records and room assignments up to date</li>
              <li>Record rent and see outstanding dues at a glance</li>
              <li>Split electricity bills from meter readings</li>
              <li>Send WhatsApp reminders</li>
              <li>Track expenses and share profit with co-owners</li>
              <li>Manage more than one building from one account</li>
            </ul>
          </div>
          <div><button class="secondary" onclick="startTour()">▶ Take the product tour</button></div>
        </div>
      </section>
      <section class="report-block">
        <div class="report-blockhead"><h3>Account</h3><p>Sign out of Staywise on this device.</p></div>
        <div style="padding:14px 16px"><button class="secondary" onclick="logout()">Log out</button></div>
      </section>
    </div>`;
}

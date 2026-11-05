/**
 * Manage partners dialog: list everyone who co-owns the building and add, update or remove partners.
 * Data and save helpers come from the cloud layer (window.pgPropertyPeople / pgPropertyMembers, window.*PropertyMember).
 */
import {currentBuilding, rentCollectorId} from './settlement.js';
import {esc, toast} from './ui.js';

/** Merge the owner + partners (names) with each partner's ownership row. */
function partnerRows() {
  const members = new Map((window.pgPropertyMembers || []).map((m) => [m.user_id, m]));
  return (window.pgPropertyPeople || []).map((p) => ({...p, member: members.get(p.user_id) || null}));
}

/**
 * Open the dialog.
 * @param {() => void} [onChange] Called after any change so the caller can re-render.
 */
export function openPartnerManager(onChange = () => {}) {
  const box = document.createElement('div');
  box.className = 'overlay show';
  document.body.appendChild(box);

  const render = () => {
    const rows = partnerRows();
    const total = rows.reduce((n, r) => n + Number(r.member?.ownership_percent || 0), 0);
    const ownerShare = Math.max(0, 100 - total); // the owner holds whatever the partners do not
    const collectorId = rentCollectorId(currentBuilding());
    const collectorOptions = (window.pgPropertyPeople || [])
      .map(
        (p) =>
          `<option value="${esc(p.user_id)}"${p.user_id === collectorId ? ' selected' : ''}>${esc(p.display_name || p.email)}</option>`
      )
      .join('');
    box.innerHTML = `<div class="modal" style="max-width:720px">
      <div class="modalhead"><div><h2>Manage partners</h2><p>Owners and partners have the same access. Ownership shares drive profit allocation.</p></div><button type="button" class="close">×</button></div>
      <div class="field" style="margin:10px 0 14px"><label>Who collects the rent?</label>
        <select class="collector">${collectorOptions}</select>
        <p class="hint">This person receives the rent payments. The Expenses page uses it to show who owes whom.</p></div>
      <div class="report-table"><table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Ownership %</th><th></th></tr></thead>
        <tbody>${
          rows
            .map((r) =>
              r.member
                ? `<tr data-user="${esc(r.user_id)}"><td><b>${esc(r.display_name || r.email)}</b></td><td>${esc(r.email || '')}</td>
                    <td><input class="share" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${Number(r.member.ownership_percent || 0)}" style="width:90px"></td>
                    <td style="white-space:nowrap"><button type="button" class="secondary save">Update</button> <button type="button" class="secondary remove">Remove</button></td></tr>`
                : `<tr><td><b>${esc(r.display_name || r.email)}</b></td><td>${esc(r.email || '')}</td><td class="sub">${ownerShare}% <small>(owner — the remainder)</small></td><td></td></tr>`
            )
            .join('') || '<tr><td colspan="4" class="sub">No partners yet.</td></tr>'
        }</tbody>
      </table></div>
      <p class="hint" style="color:${total > 100 ? 'var(--late-ink)' : 'inherit'}">Partner shares total ${total}%${total > 100 ? ' — more than 100%, please adjust.' : '.'}</p>
      <form class="add-partner" style="margin-top:14px">
        <div class="formgrid">
          <div class="field"><label>Add partner by email</label><input name="email" type="email" required placeholder="partner@example.com"></div>
          <div class="field"><label>Ownership %</label><input name="ownershipPercent" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="0"></div>
        </div>
        <p class="hint">The partner must create an account first.</p>
        <div class="formactions"><button class="primary">Add partner</button></div>
      </form>
    </div>`;
    box.querySelectorAll('.close').forEach((x) => (x.onclick = () => box.remove()));
    box.querySelector('.collector').onchange = (e) =>
      run(() => window.setRentCollector(e.target.value), 'Rent collector updated');
    box.querySelectorAll('tr[data-user]').forEach((tr) => {
      const userId = tr.dataset.user;
      tr.querySelector('.save').onclick = () =>
        run(() => window.updatePropertyMember(userId, tr.querySelector('.share').value), 'Partner updated');
      tr.querySelector('.remove').onclick = () => {
        if (confirm('Remove this partner? They will lose access to this building.'))
          run(() => window.deletePropertyMember(userId), 'Partner removed');
      };
    });
    box.querySelector('form.add-partner').onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      run(() => window.savePropertyMember(d), 'Partner added');
    };
  };

  async function run(action, message) {
    try {
      await action();
      toast(message);
      onChange();
      render();
    } catch (err) {
      toast('Could not save: ' + err.message);
    }
  }
  render();
}

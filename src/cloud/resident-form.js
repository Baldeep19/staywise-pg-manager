/**
 * Cloud (Supabase) handlers for adding, editing and removing residents.
 */
import {toast} from '../app/ui.js';
import {supabase} from './client.js';
import {session} from './session.js';

/** Attach the form handlers. Called after the initial session check. */
export function initResidentCloudForm() {
  document.getElementById('residentForm').addEventListener(
    'submit',
    async (e) => {
      const form = e.target;
      if (form.dataset.cloudReady === '1') {
        delete form.dataset.cloudReady;
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      const d = new FormData(form),
        editId = form.dataset.editResidentId,
        flat = session.flats.find((x) => x.flat_number === d.get('room'));
      if (!flat) return alert('Could not find the selected flat in Supabase.');
      const payload = {
        property_id: session.property.id,
        flat_id: flat.id,
        full_name: d.get('name'),
        phone: d.get('phone'),
        permanent_address: d.get('address') || null,
        emergency_contact: d.get('emergency') || null,
        monthly_rent: Number(d.get('rent')),
        deposit_amount: Number(d.get('deposit') || 0),
        sharing_type: d.get('sharing_type'),
        move_in: d.get('movein') || null
      };
      const result = editId
        ? await supabase
            .from('residents')
            .update(payload)
            .eq('id', editId)
            .eq('property_id', session.property.id)
            .select()
            .single()
        : await supabase.from('residents').insert(payload).select().single();
      if (result.error) return alert(result.error.message);
      const resident = result.data;
      form.dataset.cloudReady = '1';
      form.dataset.cloudResidentId = resident.id;
      form.requestSubmit();
    },
    true
  );
  window.removeResident = async (id) => {
    if (!confirm('Remove this resident from the active resident list? Their rent and bill history will be retained.'))
      return;
    const moveOut = new Date().toISOString().slice(0, 10),
      {error} = await supabase
        .from('residents')
        .update({active: false, move_out: moveOut})
        .eq('id', id)
        .eq('property_id', session.property.id);
    if (error) {
      alert(error.message);
      return;
    }
    const rs = JSON.parse(localStorage.getItem('staywise_residents') || '[]').filter((r) => r.id !== id);
    window.pgReportResidents = (window.pgReportResidents || []).map((r) =>
      String(r.id) === String(id) ? {...r, active: false, moveout: moveOut} : r
    );
    window.applyCloudState(rs, JSON.parse(localStorage.getItem('staywise_bills') || '[]'));
    toast('Resident removed from the active list.');
  };
}

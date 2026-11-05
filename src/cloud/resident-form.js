/**
 * Cloud (Supabase) handlers for adding, editing and removing residents.
 */
import {putBack, undoable} from '../app/ui.js';
import {formError, showFieldError} from '../app/field-errors.js';
import {noticePayload, todayIso} from '../app/notice.js';
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
      if (!flat)
        return showFieldError(form.elements.room, 'This flat is not in your building any more; choose another');
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
        move_in: d.get('movein') || null,
        ...noticePayload(d)
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
      if (result.error) return formError(form, 'Not saved: ' + result.error.message);
      const resident = result.data;
      form.dataset.cloudReady = '1';
      form.dataset.cloudResidentId = resident.id;
      form.requestSubmit();
    },
    true
  );
  // Remove = move out (active false). No confirm box: the resident disappears at once and the toast offers Undo;
  // the database is only updated after the Undo window (see undoable in app/ui.js).
  window.removeResident = (id) => {
    const list = () => JSON.parse(localStorage.getItem('staywise_residents') || '[]');
    const bills = () => JSON.parse(localStorage.getItem('staywise_bills') || '[]');
    const before = list();
    const index = before.findIndex((r) => String(r.id) === String(id));
    const resident = before[index];
    const reportRow = (window.pgReportResidents || []).find((r) => String(r.id) === String(id));
    const today = todayIso(),
      moveOut = resident?.vacate_on && resident.vacate_on <= today ? resident.vacate_on : today;
    const setReportRow = (row) =>
      (window.pgReportResidents = (window.pgReportResidents || []).map((r) => (String(r.id) === String(id) ? row : r)));
    return undoable({
      message: `${resident?.name || 'Resident'} moved out`,
      hide: () => {
        if (reportRow) setReportRow({...reportRow, active: false, moveout: moveOut});
        window.applyCloudState(
          list().filter((r) => String(r.id) !== String(id)),
          bills()
        );
      },
      // Put just this resident back, keeping any other change made during the Undo window.
      restore: () => {
        if (reportRow) setReportRow(reportRow);
        if (resident) window.applyCloudState(putBack(list(), resident, index), bills());
      },
      commit: async () => {
        const {error} = await supabase
          .from('residents')
          .update({active: false, move_out: moveOut})
          .eq('id', id)
          .eq('property_id', session.property.id);
        if (error) throw error;
      }
    });
  };
}

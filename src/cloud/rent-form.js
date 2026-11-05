/**
 * Cloud (Supabase) handler for recording rent payments.
 */
import {state} from '../app/store.js';
import {formError, showFieldError} from '../app/field-errors.js';
import {supabase} from './client.js';
import {session} from './session.js';

/** Attach the form handlers. Called after the initial session check. */
export function initRentCloudForm() {
  document.getElementById('rentForm').addEventListener(
    'submit',
    async (e) => {
      const form = e.target;
      if (form.dataset.cloudReady === '1') {
        delete form.dataset.cloudReady;
        return;
      }
      if (form.dataset.rentSaving === '1') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const d = new FormData(form),
        resident = state.residents.find((r) => r.name === d.get('resident'));
      if (!resident?.id)
        return showFieldError(form.elements.resident, 'This resident could not be found; refresh and try again');
      const paidOn =
          d.get('date') || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
        paidAmount = Number(d.get('amount'));
      if (!(paidAmount > 0)) return showFieldError(form.elements.amount, 'Must be more than 0');
      const saveButton = form.querySelector('button.primary');
      form.dataset.rentSaving = '1';
      if (saveButton) saveButton.disabled = true;
      const {error} = await supabase.rpc('record_rent_payment', {
        p_property_id: session.property.id,
        p_resident_id: resident.id,
        p_amount: paidAmount,
        p_paid_on: paidOn,
        p_method: d.get('method'),
        p_reference: d.get('note') || null
      });
      if (error) {
        delete form.dataset.rentSaving;
        if (saveButton) saveButton.disabled = false;
        return formError(form, 'Payment was not recorded: ' + error.message);
      }
      const rentMonth = paidOn.slice(0, 7) + '-01';
      const {data: monthlyPayment, error: refreshError} = await supabase
        .from('rent_payments')
        .select('resident_id,amount,paid_on,rent_month')
        .eq('property_id', session.property.id)
        .eq('resident_id', resident.id)
        .eq('rent_month', rentMonth)
        .maybeSingle();
      if (refreshError || !monthlyPayment) {
        delete form.dataset.rentSaving;
        if (saveButton) saveButton.disabled = false;
        return formError(
          form,
          'Payment was saved, but the monthly record could not refresh. Refresh the page before trying again.'
        );
      }
      window.pgRentPayments = (window.pgRentPayments || [])
        .filter(
          (p) =>
            !(
              String(p.resident_id) === String(resident.id) &&
              String(p.rent_month || p.paid_on).slice(0, 7) === rentMonth.slice(0, 7)
            )
        )
        .concat(monthlyPayment);
      window.rentStatusAfterPayment = Number(monthlyPayment.amount) >= Number(resident.rent) ? 'Paid' : 'Part paid';
      delete form.dataset.rentSaving;
      if (saveButton) saveButton.disabled = false;
      form.dataset.cloudReady = '1';
      form.requestSubmit();
    },
    true
  );
}

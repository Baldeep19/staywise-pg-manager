/**
 * Cloud (Supabase) handlers for the electricity bill form and bill payments.
 */
import {state} from '../app/store.js';
import {closeModal, openModal, toast} from '../app/ui.js';
import {supabase} from './client.js';
import {initSession} from './loader.js';
import {session} from './session.js';

/** Attach the form handlers. Called after the initial session check. */
export function initElectricityCloudForms() {
  document.getElementById('electricityForm').addEventListener(
    'submit',
    async (e) => {
      const form = e.target;
      if (form.dataset.cloudReady === '1') {
        delete form.dataset.cloudReady;
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      const fd = new FormData(form),
        month = String(fd.get('month') || ''),
        readingDate = String(fd.get('readingDate') || ''),
        due = String(fd.get('due') || ''),
        mainAmount = Number(fd.get('mainBillAmount')),
        commonTotal = Number(fd.get('commonMeterTotal') || 0),
        selectedFlat = session.flats.find((f) => f.flat_number === fd.get('selectedFlat')),
        flatIndex = session.flats.findIndex((f) => f.id === selectedFlat?.id);
      if (!selectedFlat) return alert('Choose a flat.');
      const selected = [];
      let invalidResident = '';
      state.residents.forEach((r, i) => {
        if (r.room === selectedFlat.flat_number && fd.has('include_' + i)) {
          const rawAmount = String(fd.get('amount_' + i) || ''),
            amount = Number(rawAmount),
            side = String(fd.get('meter_side_' + i) || '');
          if (rawAmount.trim() === '' || !Number.isFinite(amount) || amount < 0 || !['left', 'right'].includes(side))
            invalidResident = r.name;
          else selected.push({r, amount, side});
        }
      });
      if (invalidResident)
        return alert(
          'Assign ' +
            invalidResident +
            ' to Room 1 · Left meter or Room 2 · Right meter and check their calculated amount.'
        );
      if (!selected.length)
        return alert('Select at least one resident and assign them to Room 1 · Left meter or Room 2 · Right meter.');
      const readingValues = {
        previous_room1_reading: String(fd.get('prev_room1_' + flatIndex) || ''),
        current_room1_reading: String(fd.get('current_room1_' + flatIndex) || ''),
        previous_room2_reading: String(fd.get('prev_room2_' + flatIndex) || ''),
        current_room2_reading: String(fd.get('current_room2_' + flatIndex) || '')
      };
      if (Object.values(readingValues).some((v) => v.trim() === ''))
        return alert('Enter previous and current readings for both the left and right meters.');
      for (const room of [1, 2])
        if (
          Number(readingValues['current_room' + room + '_reading']) <
          Number(readingValues['previous_room' + room + '_reading'])
        )
          return alert('Current reading cannot be lower than the previous reading for Room ' + room + '.');
      const leftUnits = Number(readingValues.current_room1_reading) - Number(readingValues.previous_room1_reading),
        rightUnits = Number(readingValues.current_room2_reading) - Number(readingValues.previous_room2_reading),
        totalUnits = leftUnits + rightUnits;
      if (!(mainAmount >= 0) || !Number.isFinite(mainAmount))
        return alert('Enter a valid main bill amount for this flat.');
      if (!(commonTotal >= 0) || !Number.isFinite(commonTotal))
        return alert('Enter a valid building common meter charge.');
      if (mainAmount > 0 && totalUnits <= 0) return alert('Meter units are required to split the main bill.');
      if (leftUnits > 0 && !selected.some((x) => x.side === 'left'))
        return alert('Room 1 · Left meter has units consumed. Assign at least one resident to it.');
      if (rightUnits > 0 && !selected.some((x) => x.side === 'right'))
        return alert('Room 2 · Right meter has units consumed. Assign at least one resident to it.');
      for (const item of selected) {
        if (item.r.id && item.r.meter_side !== item.side) {
          const {error} = await supabase
            .from('residents')
            .update({meter_side: item.side})
            .eq('id', item.r.id)
            .eq('property_id', session.property.id);
          if (error) return alert('Could not save the meter-room mapping for ' + item.r.name + ': ' + error.message);
          item.r.meter_side = item.side;
        }
      }
      const meterPayload = {
        property_id: session.property.id,
        flat_id: selectedFlat.id,
        billing_month: month + '-01',
        reading_date: readingDate,
        main_bill_amount: mainAmount,
        common_meter_total: commonTotal,
        ...Object.fromEntries(Object.entries(readingValues).map(([k, v]) => [k, Number(v)]))
      };
      const {data: storedReadings, error: readingError} = await supabase
        .from('electricity_meter_readings')
        .upsert(meterPayload, {onConflict: 'property_id,flat_id,billing_month'})
        .select()
        .single();
      if (readingError) return alert('Meter readings and bill amounts were not saved: ' + readingError.message);
      window.pgElectricityReadings = (window.pgElectricityReadings || [])
        .filter(
          (old) =>
            !(String(old.flat_id) === String(storedReadings.flat_id) && String(old.billing_month).slice(0, 7) === month)
        )
        .concat({...storedReadings, flat: selectedFlat.flat_number});
      const payload = selected.map((x) => ({
        property_id: session.property.id,
        flat_id: selectedFlat.id,
        resident_id: x.r.id,
        billing_month: month + '-01',
        amount: x.amount,
        due_date: due,
        status: 'due'
      }));
      const {data, error} = await supabase
        .from('electricity_bills')
        .insert(payload)
        .select('*, residents(full_name,phone), flats(flat_number)');
      if (error)
        return alert('Readings and meter-room mappings were saved, but electricity bills were not: ' + error.message);
      window.cloudElectricBills = data.map((b) => ({
        id: b.id,
        name: b.residents?.full_name || '',
        phone: b.residents?.phone || '',
        flat: b.flats?.flat_number || '',
        amount: Number(b.amount),
        paid_amount: 0,
        billing_month: b.billing_month,
        due: b.due_date,
        month: new Date(b.billing_month + 'T00:00:00').toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}),
        status: 'Due'
      }));
      form.dataset.cloudReady = '1';
      form.requestSubmit();
    },
    true
  );
  window.openElectricityPayment = (id) => {
    const bill = JSON.parse(localStorage.getItem('staywise_bills') || '[]').find((b) => String(b.id) === String(id));
    if (!bill) return alert('Bill not found; refresh the page and try again.');
    const form = document.getElementById('electricityPaymentForm');
    form.elements.billId.value = bill.id;
    form.elements.amount.value = Math.max(0, Number(bill.amount) - Number(bill.paid_amount || 0));
    const now = new Date();
    form.elements.date.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.getElementById('electricityPaymentSubtitle').textContent =
      bill.name +
      ' · ' +
      bill.month +
      ' · Remaining ₹' +
      Math.max(0, Number(bill.amount) - Number(bill.paid_amount || 0)).toLocaleString('en-IN');
    openModal('electricityPaymentModal');
  };
  document.getElementById('electricityPaymentForm').addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(e.target),
        billId = d.get('billId'),
        bill = JSON.parse(localStorage.getItem('staywise_bills') || '[]').find((b) => String(b.id) === String(billId));
      if (!bill) return alert('Bill not found.');
      const amount = Number(d.get('amount')),
        remaining = Number(bill.amount) - Number(bill.paid_amount || 0);
      if (bill.status === 'Paid' || bill.status === 'Waived' || remaining <= 0)
        return alert('This electricity bill has no outstanding balance.');
      if (!(amount > 0)) return alert('Enter a payment amount greater than zero.');
      if (amount > remaining)
        return alert('Payment cannot exceed the remaining balance of ₹' + remaining.toLocaleString('en-IN') + '.');
      const {error} = await supabase.from('electricity_bill_payments').insert({
        property_id: session.property.id,
        bill_id: billId,
        amount,
        paid_on: d.get('date'),
        method: d.get('method'),
        reference: d.get('note') || null
      });
      if (error) return alert('Payment was not recorded: ' + error.message);
      const {data: rows, error: sumError} = await supabase
        .from('electricity_bill_payments')
        .select('amount')
        .eq('bill_id', billId);
      if (sumError) return alert('Payment saved, but status could not refresh: ' + sumError.message);
      const paid = (rows || []).reduce((n, x) => n + Number(x.amount), 0),
        status = paid >= Number(bill.amount) ? 'paid' : 'partial';
      const {error: updateError} = await supabase
        .from('electricity_bills')
        .update({status, paid_at: status === 'paid' ? new Date().toISOString() : null})
        .eq('id', billId)
        .eq('property_id', session.property.id);
      if (updateError) return alert('Payment saved, but bill status update failed: ' + updateError.message);
      closeModal('electricityPaymentModal');
      e.target.reset();
      toast(status === 'paid' ? 'Electricity bill marked paid.' : 'Partial electricity payment recorded.');
      await initSession(session.currentUser);
    },
    true
  );
}

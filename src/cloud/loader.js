/**
 * Loads everything for the signed-in user (property, flats, residents, payments, bills) into the app.
 */
import {supabase} from './client.js';
import {installDashboard} from './dashboard.js';
import {gate} from './elements.js';
import {showOwnerIdentity} from './identity.js';
import {startTourIfFirstTime} from './onboarding.js';
import {subscribeToPropertyChanges} from './live.js';
import {loadPartnerData} from './partners.js';
import {session} from './session.js';
import {showSetup} from './setup.js';

export async function initSession(user) {
  session.currentUser = user;
  showOwnerIdentity(user); // before any early return, so every path greets the person by name
  const {data: foundRows, error} = await supabase.from('properties').select('*').limit(20);
  if (error) throw error;
  // Every building this user can see (their own plus any shared with them as a partner).
  session.properties = foundRows || [];
  // Reopen the building chosen last time; otherwise prefer one the user owns.
  const savedPropertyId = localStorage.getItem('staywise_property_id');
  session.property =
    session.properties.find((x) => x.id === savedPropertyId) ||
    session.properties.find((x) => x.owner_id === user.id) ||
    session.properties[0] ||
    null;
  window.pgProperties = session.properties;
  window.pgCurrentUserId = user.id;
  window.switchProperty = (id) => {
    localStorage.setItem('staywise_property_id', id);
    location.reload();
  };
  window.createNewBuilding = () => showSetup(null, [], {}, {createNew: true});
  let foundFlats = [];
  if (session.property) {
    const q = await supabase
      .from('flats')
      .select('*')
      .eq('property_id', session.property.id)
      .eq('active', true)
      .order('floor_name')
      .order('flat_number');
    if (q.error) throw q.error;
    foundFlats = q.data || [];
  }
  session.flats = foundFlats;
  if (!session.property || !session.property.setup_complete || !session.flats.length) {
    if (localStorage.getItem('staywise_skip_setup') === '1') {
      document.getElementById('ownerSetupGate').style.display = 'none';
      gate.style.display = 'none';
      window.editPropertySetup = () =>
        showSetup(session.property, foundFlats, user.user_metadata?.pending_property || {});
      startTourIfFirstTime(user); // the app is visible even though building setup was skipped
      return;
    }
    showSetup(session.property, foundFlats, user.user_metadata?.pending_property || {});
    return;
  }
  const {data: dbResidents, error: rError} = await supabase
    .from('residents')
    .select('*, flats(flat_number)')
    .eq('property_id', session.property.id)
    .order('created_at');
  if (rError) throw rError;
  const activeResidents = (dbResidents || []).filter((r) => r.active);
  window.pgReportResidents = (dbResidents || []).map((r) => ({
    id: r.id,
    name: r.full_name,
    room: r.flats?.flat_number || '',
    rent: Number(r.monthly_rent),
    movein: r.move_in || '',
    moveout: r.move_out || '',
    active: Boolean(r.active)
  }));
  const {data: rentRows, error: rentError} = await supabase
    .from('rent_payments')
    .select('resident_id,amount,paid_on,rent_month')
    .eq('property_id', session.property.id);
  if (rentError) throw rentError;
  window.pgRentPayments = rentRows || [];
  await loadPartnerData();
  const now = new Date(),
    currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'),
    rentPaidBy = {};
  for (const payment of window.pgRentPayments) {
    if (String(payment.rent_month || payment.paid_on).slice(0, 7) === currentMonth)
      rentPaidBy[payment.resident_id] = (rentPaidBy[payment.resident_id] || 0) + Number(payment.amount);
  }
  const local = activeResidents.map((r) => {
    const paid = rentPaidBy[r.id] || 0,
      rent = Number(r.monthly_rent),
      balance = Math.max(0, rent - paid),
      dueDate = currentMonth + '-02',
      today = new Date().toISOString().slice(0, 10),
      status = balance <= 0 ? 'Paid' : paid > 0 ? 'Part paid' : dueDate < today ? 'Overdue' : 'Due';
    return {
      id: r.id,
      name: r.full_name,
      phone: r.phone,
      room: r.flats?.flat_number || '',
      sharing_type: r.sharing_type || '',
      rent,
      deposit: Number(r.deposit_amount || 0),
      status,
      movein: r.move_in || '',
      address: r.permanent_address || '',
      emergency: r.emergency_contact || '',
      meter_side: r.meter_side || ''
    };
  });
  localStorage.setItem('staywise_cloud', '1');
  const {data: billRows, error: billError} = await supabase
    .from('electricity_bills')
    .select('*, residents(full_name,phone), flats(flat_number)')
    .eq('property_id', session.property.id)
    .order('billing_month', {ascending: false})
    .order('created_at', {ascending: false});
  if (billError) throw billError;
  const {data: billPayments, error: billPaymentError} = await supabase
    .from('electricity_bill_payments')
    .select('bill_id,amount')
    .eq('property_id', session.property.id);
  if (billPaymentError) throw billPaymentError;
  const billTotals = {};
  for (const payment of billPayments || [])
    billTotals[payment.bill_id] = (billTotals[payment.bill_id] || 0) + Number(payment.amount);
  const savedBills = (billRows || []).map((b) => {
    const paid = billTotals[b.id] || 0;
    return {
      id: b.id,
      name: b.residents?.full_name || '',
      phone: b.residents?.phone || '',
      flat: b.flats?.flat_number || '',
      amount: Number(b.amount),
      paid_amount: paid,
      billing_month: b.billing_month,
      due: b.due_date,
      month: new Date(b.billing_month + 'T00:00:00').toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}),
      status:
        b.status === 'paid' ? 'Paid' : b.status === 'partial' ? 'Part paid' : b.status === 'waived' ? 'Waived' : 'Due'
    };
  });
  window.pgElectricityBills = savedBills;
  const {data: meterRows, error: meterError} = await supabase
    .from('electricity_meter_readings')
    .select('*, flats(flat_number)')
    .eq('property_id', session.property.id)
    .order('billing_month', {ascending: false});
  if (meterError) throw meterError;
  window.pgElectricityReadings = (meterRows || []).map((m) => ({...m, flat: m.flats?.flat_number || ''}));
  const roomSelect = document.querySelector('#residentForm [name=room]');
  roomSelect.innerHTML =
    '<option value="">Choose flat / room</option>' +
    session.flats.map((f) => `<option>${f.flat_number}</option>`).join('');
  window.pgFlats = session.flats;
  window.pgPropertyName = session.property.name;
  window.applyCloudState?.(local, savedBills);
  installDashboard();
  subscribeToPropertyChanges();
  window.editPropertySetup = () => showSetup(session.property, session.flats);
  gate.style.display = 'none';
  window.pgCurrentPropertyId = session.property.id;
  const propertySelect = document.getElementById('propertySelect');
  if (propertySelect) {
    propertySelect.innerHTML = session.properties
      .map(
        (p) =>
          `<option value="${p.id}"${p.id === session.property.id ? ' selected' : ''}>${window.esc(p.name)}</option>`
      )
      .join('');
    propertySelect.onchange = () => window.switchProperty(propertySelect.value);
  }
  document.getElementById('propertyNameHeading').textContent = session.property.name;
  startTourIfFirstTime(user);
}

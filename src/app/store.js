/**
 * Application state (localStorage-backed) shared by every feature module.
 */

export const state = {
  residents: readStore('residents', []).map((r) => {
    delete r.aadhaar;
    return r;
  }),
  activities: readStore('activities', []),
  bills: readStore('bills', []),
  payments: readStore('payments', []),
  lastMessage: ''
};

export function readStore(k, f) {
  try {
    return JSON.parse(localStorage.getItem('staywise_' + k)) || f;
  } catch {
    return f;
  }
}

export function persist() {
  localStorage.setItem(
    'staywise_residents',
    JSON.stringify(
      state.residents.map((r) => {
        const clean = {...r};
        delete clean.aadhaar;
        return clean;
      })
    )
  );
  localStorage.setItem('staywise_activities', JSON.stringify(state.activities));
  localStorage.setItem('staywise_bills', JSON.stringify(state.bills));
  localStorage.setItem('staywise_payments', JSON.stringify(state.payments));
}

window.applyCloudState = (nextResidents, nextBills) => {
  state.residents = nextResidents;
  state.bills = nextBills;
  localStorage.setItem('staywise_residents', JSON.stringify(nextResidents));
  localStorage.setItem('staywise_bills', JSON.stringify(nextBills));
  window.refreshDashboard?.();
  window.renderCurrentPage?.();
};

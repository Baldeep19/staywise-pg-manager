/**
 * Application entry point: loads the feature modules, attaches listeners and exposes the handlers that
 * inline `onclick` attributes in index.html and generated markup still call by name.
 */
import './app/store.js';
import {toast, applyDateDefaults, openModal, closeModal, goPage, renderPage, initials, esc, initUi} from './app/ui.js';
import {
  resetResidentForm,
  draftResidentRentReminder,
  renderResidents,
  editResident,
  initResidents
} from './app/residents.js';
import {rentBalanceForResident, renderRent, refreshOptions, openForResident, initRent} from './app/rent.js';
import {
  renderElectricity,
  shareBill,
  meterReadingsForFlat,
  meterValueFor,
  meterNumberInput,
  ensureElectricityMessagePreview,
  updateElectricityMessagePreview,
  markElectricityManual,
  markElectricityAmount,
  selectedFlatIndex,
  renderBillResidents,
  refreshMeterPreviousReadings,
  updateMeterUnits,
  calculateElectricitySplit,
  initElectricity
} from './app/electricity.js';
import {renderRooms, initRooms} from './app/rooms.js';
import {renderReports} from './app/reports.js';
import {goMessages, renderMessages, draftRent, launchWhatsApp} from './app/messages.js';
import {initApp} from './app/app.js';

// Handlers referenced from HTML attributes (legacy inline handlers).
Object.assign(window, {
  toast,
  applyDateDefaults,
  resetResidentForm,
  openModal,
  closeModal,
  goPage,
  rentBalanceForResident,
  draftResidentRentReminder,
  renderResidents,
  renderRent,
  renderElectricity,
  shareBill,
  renderRooms,
  renderReports,
  renderPage,
  initials,
  esc,
  editResident,
  refreshOptions,
  openForResident,
  meterReadingsForFlat,
  meterValueFor,
  meterNumberInput,
  ensureElectricityMessagePreview,
  updateElectricityMessagePreview,
  markElectricityManual,
  markElectricityAmount,
  selectedFlatIndex,
  renderBillResidents,
  refreshMeterPreviousReadings,
  updateMeterUnits,
  calculateElectricitySplit,
  goMessages,
  renderMessages,
  draftRent,
  launchWhatsApp
});

initUi();
initResidents();
initRent();
initElectricity();
initRooms();
initApp();

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
import {initInstall} from './app/install.js';
import {initResponsiveTables} from './app/responsive-tables.js';
import {startTour} from './app/tour.js';
import {initTabbar} from './app/tabbar.js';
import {renderIcons} from './app/icons.js';
import {initModalLayout} from './app/modal-layout.js';
import {initFieldErrors} from './app/field-errors.js';
import {initTheme, setTheme} from './app/theme.js';

// Handlers referenced from HTML attributes (legacy inline handlers).
Object.assign(window, {
  setTheme,
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
  launchWhatsApp,
  startTour
});

initUi();
initResidents();
initRent();
initElectricity();
initRooms();
initApp();
initInstall();
initResponsiveTables();
initTabbar();
renderIcons();
initModalLayout();
initFieldErrors();
initTheme();

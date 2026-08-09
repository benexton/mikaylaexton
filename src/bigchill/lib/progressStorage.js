// Whole-game local persistence, so a mid-game page reload (a PWA update, a
// phone rotation glitch, a curious four-year-old hitting refresh) resumes
// where the group left off instead of dropping them back to square one.
// Deliberately just one localStorage key holding one JSON blob - there's
// nothing here that benefits from being split up, and one key means one
// place to read/write/clear.
const STORAGE_KEY = 'bigchill-progress';

// Same shape BigChillApp's state is in, so loadProgress() can be spread
// straight into useState initializers. phase defaults to 'password' -
// meaningful only when there's no saved `code` yet (see BigChillApp).
const DEFAULTS = {
  code: '',
  phase: 'password',
  juniorNames: [],
  stopIndex: 0,
  completedStopIds: [],
  stopNotes: {},
  history: [],
  startTime: null,
  elapsedSeconds: null,
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full/unavailable (private browsing, say) - the game still
    // works this session, it just won't survive a reload.
  }
}

// Not a real redeemed code - bigchill-record-time only ever updates a row
// that's already marked used, so this harmlessly matches nothing server
// side. Used by the admin page's "launch game" bypass (see AdminApp.jsx) so
// trial runs never touch the real one-time-code pool.
export const PREVIEW_CODE = 'ADMIN-PREVIEW';

export function writePreviewProgress() {
  saveProgress({ ...DEFAULTS, code: PREVIEW_CODE, phase: 'start' });
}

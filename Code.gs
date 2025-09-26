/**
 * Ensures the Games sheet exists with the expected columns.
 */
function setupGamesSheet() {
  ensureGamesSheetStructure_();
}

/**
 * Returns the active games for the current competition week.
 * Filters rows marked as active whose week start date aligns with the
 * current week (Monday) or the upcoming Friday.
 */
function getActiveGames() {
  const sheet = ensureGamesSheetStructure_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }

  const headers = data[0];
  const weekStartIndex = headers.indexOf('WeekStart');
  const titleIndex = headers.indexOf('Title');
  const promptIndex = headers.indexOf('Prompt');
  const instructionsIndex = headers.indexOf('Instructions');
  const inputPlaceholderIndex = headers.indexOf('InputPlaceholder');
  const isActiveIndex = headers.indexOf('IsActive');

  validateColumnIndex_(weekStartIndex, 'WeekStart');
  validateColumnIndex_(titleIndex, 'Title');
  validateColumnIndex_(promptIndex, 'Prompt');
  validateColumnIndex_(instructionsIndex, 'Instructions');
  validateColumnIndex_(inputPlaceholderIndex, 'InputPlaceholder');
  validateColumnIndex_(isActiveIndex, 'IsActive');

  const today = new Date();
  const targetFriday = getUpcomingFriday_(today);
  const targetWeekStart = getWeekStartForDate_(targetFriday);
  const acceptableStarts = [targetWeekStart, targetFriday];

  const timezone = Session.getScriptTimeZone();
  const activeGames = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isActive = isRowActive_(row[isActiveIndex]);
    if (!isActive) {
      continue;
    }

    const weekStartCell = row[weekStartIndex];
    if (!acceptableStarts.some(date => isSameDay_(weekStartCell, date))) {
      continue;
    }

    activeGames.push({
      weekStart: formatDateForReturn_(weekStartCell, timezone),
      title: safeToString_(row[titleIndex]),
      prompt: safeToString_(row[promptIndex]),
      instructions: safeToString_(row[instructionsIndex]),
      inputPlaceholder: safeToString_(row[inputPlaceholderIndex])
    });
  }

  return activeGames;
}

/**
 * Toggles the IsActive flag so that only the games for the upcoming week
 * remain active. Intended to be used with a Friday trigger.
 */
function flipGameActivity() {
  const sheet = ensureGamesSheetStructure_();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length <= 1) {
    return;
  }

  const headers = values[0];
  const weekStartIndex = headers.indexOf('WeekStart');
  const isActiveIndex = headers.indexOf('IsActive');

  validateColumnIndex_(weekStartIndex, 'WeekStart');
  validateColumnIndex_(isActiveIndex, 'IsActive');

  const targetFriday = getUpcomingFriday_(new Date());
  const targetWeekStart = getWeekStartForDate_(targetFriday);
  const acceptableStarts = [targetWeekStart, targetFriday];

  const updates = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const weekStartCell = row[weekStartIndex];
    const isTargetWeek = acceptableStarts.some(date => isSameDay_(weekStartCell, date));
    updates.push([isTargetWeek]);
  }

  if (updates.length) {
    sheet.getRange(2, isActiveIndex + 1, updates.length, 1).setValues(updates);
  }
}

/**
 * Creates a weekly time-driven trigger so flipGameActivity runs every Friday.
 */
function scheduleWeeklyActivationTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const alreadyExists = triggers.some(trigger => trigger.getHandlerFunction() === 'flipGameActivity');
  if (!alreadyExists) {
    ScriptApp.newTrigger('flipGameActivity')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(6) // 6 AM script timezone
      .create();
  }

  // Make sure the sheet headers exist before scheduling kicks in.
  ensureGamesSheetStructure_();
  flipGameActivity();
}

// --- Helper utilities ---

function ensureGamesSheetStructure_() {
  const sheet = getOrCreateGamesSheet_();
  const headers = ['WeekStart', 'Title', 'Prompt', 'Instructions', 'InputPlaceholder', 'IsActive'];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const existing = headerRange.getValues()[0];
  let needsUpdate = existing.length !== headers.length;

  for (let i = 0; i < headers.length; i++) {
    if (existing[i] !== headers[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    headerRange.setValues([headers]);
  }

  headerRange.setFontWeight('bold');
  return sheet;
}

function getOrCreateGamesSheet_() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error('No active spreadsheet is available.');
  }

  let sheet = ss.getSheetByName('Games');
  if (!sheet) {
    sheet = ss.insertSheet('Games');
  }
  return sheet;
}

function getUpcomingFriday_(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const day = target.getDay();
  const diff = (5 - day + 7) % 7;
  target.setDate(target.getDate() + diff);
  return target;
}

function getWeekStartForDate_(date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  return weekStart;
}

function isSameDay_(value, comparator) {
  if (!value) {
    return false;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (isNaN(date)) {
    return false;
  }
  date.setHours(0, 0, 0, 0);
  const check = new Date(comparator);
  check.setHours(0, 0, 0, 0);
  return date.getTime() === check.getTime();
}

function isRowActive_(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === 'true' || lowered === 'yes' || lowered === '1';
  }
  return false;
}

function safeToString_(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function formatDateForReturn_(value, timezone) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date)) {
    return '';
  }
  return Utilities.formatDate(date, timezone || Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function validateColumnIndex_(index, columnName) {
  if (index === -1) {
    throw new Error('The Games sheet is missing the required column: ' + columnName);
  }
}

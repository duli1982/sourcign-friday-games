const LEADERBOARD_SHEET_NAME = 'Leaderboard';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function onOpen() {
  getLeaderboardSheet_();
}

function getLeaderboard() {
  const sheet = getLeaderboardSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .filter(row => row[0])
    .map(row => ({
      name: row[0],
      score: Number(row[1]) || 0,
    }));
}

function recordScore(name, delta) {
  const trimmedName = (name || '').toString().trim();
  if (!trimmedName) {
    throw new Error('A player name is required.');
  }

  const numericDelta = Number(delta);
  if (Number.isNaN(numericDelta)) {
    throw new Error('Score delta must be numeric.');
  }

  const sheet = getLeaderboardSheet_();
  const values = sheet.getDataRange().getValues();

  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] && values[i][0].toString().trim() === trimmedName) {
      targetRow = i + 1; // Account for 1-indexed sheet rows and header row
      break;
    }
  }

  const existingScore = targetRow > 0 ? Number(sheet.getRange(targetRow, 2).getValue()) || 0 : 0;
  const newScore = existingScore + numericDelta;

  if (targetRow > 0) {
    sheet.getRange(targetRow, 2).setValue(newScore);
  } else {
    sheet.appendRow([trimmedName, newScore]);
  }

  return getLeaderboard();
}

function getLeaderboardSheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(LEADERBOARD_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(LEADERBOARD_SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, 2);
  const headers = headerRange.getValues()[0];
  if (headers[0] !== 'Name' || headers[1] !== 'Score') {
    headerRange.setValues([['Name', 'Score']]);
  }

  return sheet;
}

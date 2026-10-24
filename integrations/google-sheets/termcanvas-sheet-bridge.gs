/**
 * TermCanvas sheet bridge — lets the agents on a TermCanvas team read and
 * change rows of this spreadsheet, without sharing it publicly.
 *
 * Setup (once per spreadsheet):
 *   1. In the sheet: Extensions → Apps Script, paste this file, save.
 *   2. Set TOKEN below to a long random string (keep it out of git).
 *   3. Deploy → New deployment → type "Web app":
 *        Execute as: Me        Who has access: Anyone
 *      Copy the web app URL (…/exec).
 *   4. In TermCanvas, paste  <web app URL>?token=<TOKEN>  into the sheet
 *      node's second field ("Write bridge URL").
 *
 * The token is the only lock: anyone with the full URL can change rows.
 * After editing this script, deploy a new version (Deploy → Manage
 * deployments → edit → Version: New) or the old code keeps running.
 *
 * Requests (POST JSON; tc.mjs sends these for you):
 *   { "action": "read",   "tab": "Leads", "limit": 50, "where": { "status": "Pending" } }
 *   { "action": "append", "tab": "Leads", "rows": [ { "email": "…", "status": "New" } ] }
 *   { "action": "update", "tab": "Leads", "key": "email", "rows": [ { "email": "…", "status": "Sent" } ] }
 *   { "action": "upsert", … same as update, rows whose key is not found are appended }
 * Rows are objects keyed by the header row (row 1). Update changes only the
 * columns a row object names. Unknown columns are added to the header.
 */

var TOKEN = "CHANGE-ME-TO-A-LONG-RANDOM-STRING";
/** Tab used when a request names none; empty = the first tab. */
var DEFAULT_TAB = "";

function doPost(e) {
  var request;
  try {
    request = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "Body is not JSON" });
  }
  return handle_(e, request);
}

function doGet(e) {
  var where = {};
  Object.keys(e.parameter || {}).forEach(function (name) {
    if (name.indexOf("where.") === 0) where[name.slice(6)] = e.parameter[name];
  });
  return handle_(e, {
    action: "read",
    tab: e.parameter.tab,
    limit: Number(e.parameter.limit) || 0,
    where: where,
  });
}

function handle_(e, request) {
  try {
    var given = (e.parameter && e.parameter.token) || request.token || "";
    if (TOKEN.indexOf("CHANGE-ME") === 0) throw new Error("Set TOKEN in the bridge script first");
    if (given !== TOKEN) throw new Error("Invalid token");
    var sheet = tab_(request.tab);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (request.action || "read") {
        case "read":
          return json_(read_(sheet, request));
        case "append":
          return json_(append_(sheet, rows_(request)));
        case "update":
          return json_(update_(sheet, request.key, rows_(request), false));
        case "upsert":
          return json_(update_(sheet, request.key, rows_(request), true));
        default:
          throw new Error("Unknown action " + request.action);
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function tab_(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var wanted = name || DEFAULT_TAB;
  var sheet = wanted ? spreadsheet.getSheetByName(wanted) : spreadsheet.getSheets()[0];
  if (!sheet) throw new Error("No tab named " + wanted);
  return sheet;
}

function rows_(request) {
  if (!Array.isArray(request.rows)) throw new Error("rows must be an array of objects");
  return request.rows.filter(function (row) {
    return row && typeof row === "object" && !Array.isArray(row);
  });
}

function headers_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(String);
}

/** Make sure every key the rows use has a header column; returns headers. */
function ensureHeaders_(sheet, rows) {
  var headers = headers_(sheet);
  var added = [];
  rows.forEach(function (row) {
    Object.keys(row).forEach(function (key) {
      if (headers.indexOf(key) < 0 && added.indexOf(key) < 0) added.push(key);
    });
  });
  if (added.length > 0) {
    sheet.getRange(1, headers.length + 1, 1, added.length).setValues([added]);
    headers = headers.concat(added);
  }
  return { headers: headers, added: added };
}

function read_(sheet, request) {
  var values = sheet.getDataRange().getDisplayValues();
  var headers = (values[0] || []).map(String);
  var where = request.where || {};
  var whereKeys = Object.keys(where);
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      row[headers[c]] = values[r][c];
      if (values[r][c] !== "") empty = false;
    }
    if (empty) continue;
    var matches = whereKeys.every(function (key) {
      return String(row[key] || "").toLowerCase() === String(where[key]).toLowerCase();
    });
    if (matches) rows.push(row);
  }
  var total = rows.length;
  var limit = Number(request.limit) || 0;
  if (limit > 0) rows = rows.slice(0, limit);
  return { ok: true, tab: sheet.getName(), count: total, rows: rows };
}

function append_(sheet, rows) {
  if (rows.length === 0) return { ok: true, tab: sheet.getName(), count: 0 };
  var result = ensureHeaders_(sheet, rows);
  var headers = result.headers;
  var matrix = rows.map(function (row) {
    return headers.map(function (header) {
      return row[header] === undefined ? "" : row[header];
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
  return { ok: true, tab: sheet.getName(), count: rows.length, addedColumns: result.added };
}

function update_(sheet, key, rows, insertMissing) {
  if (!key) throw new Error("update needs a key column");
  var result = ensureHeaders_(sheet, rows);
  var headers = result.headers;
  var keyColumn = headers.indexOf(key);
  if (keyColumn < 0) throw new Error("No column named " + key);
  var lastRow = sheet.getLastRow();
  var keys = lastRow > 1
    ? sheet.getRange(2, keyColumn + 1, lastRow - 1, 1).getDisplayValues().map(function (r) {
        return String(r[0]);
      })
    : [];
  var updated = 0;
  var missing = [];
  var toAppend = [];
  rows.forEach(function (row) {
    var wanted = String(row[key] === undefined ? "" : row[key]);
    var index = wanted ? keys.indexOf(wanted) : -1;
    if (index < 0) {
      if (insertMissing) toAppend.push(row);
      else missing.push(wanted);
      return;
    }
    Object.keys(row).forEach(function (column) {
      if (column === key) return;
      var c = headers.indexOf(column);
      sheet.getRange(index + 2, c + 1).setValue(row[column]);
    });
    updated++;
  });
  var appended = toAppend.length > 0 ? append_(sheet, toAppend).count : 0;
  return {
    ok: true,
    tab: sheet.getName(),
    count: updated + appended,
    updated: updated,
    appended: appended,
    missing: missing.length > 0 ? missing : undefined,
    addedColumns: result.added,
  };
}

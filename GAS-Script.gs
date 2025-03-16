// This is a new Apps Script file to be added to your Google Apps Script project

// Handle web app requests
function doGet(e) {
  var action = e.parameter.action;

  if (action == 'search') {
    return handleSearch(e);
  } else if (action == 'getSettings') {
    return getSystemSettings();
  } else if (action == 'getAllSubmissions') {
    return getAllSubmissions();
  } else if (action == 'viewAllData') {
    return viewAllData();
  } else if (action == 'query') {
    return queryData(e);
  } else if (action == 'adminLogin') {
    return handleAdminLogin(e);
  } else {
    return ContentService.createTextOutput(JSON.stringify({error: 'Invalid action'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests (form submissions and settings changes)
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  
  if (data.action === 'saveSettings') {
    return saveSystemSettings(data);
  } else {
    // Verify Turnstile token first
    if (!data.token || !verifyTurnstileToken(data.token)) {
      return ContentService.createTextOutput(JSON.stringify({
        'result': 'error',
        'message': 'Invalid CAPTCHA verification'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check if system is open before processing form submission
    var settingsData = getSystemSettingsData();
    var now = new Date();
    var openTime = settingsData.settings.openTime ? new Date(settingsData.settings.openTime) : null;
    var closeTime = settingsData.settings.closeTime ? new Date(settingsData.settings.closeTime) : null;
    
    var systemOpen = true;
    if (openTime && now < openTime) {
      systemOpen = false;
    } else if (closeTime && now > closeTime) {
      systemOpen = false;
    }
    
    if (!systemOpen) {
      return ContentService.createTextOutput(JSON.stringify({
        'result': 'error',
        'message': 'System is currently closed'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle normal form submission
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions') || 
                SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Get current timestamp
    var timestamp = new Date().toISOString();
    
    // Write data to spreadsheet
    sheet.appendRow([
      timestamp,
      data.studentId,
      data.name,
      data.class,
      data.intention,
      data.reason,
      data.signature,
      data.deviceInfo || 'Unknown',
      data.browserInfo || 'Unknown',
      data.ipAddress || 'Unknown',
      data.screenSize || 'Unknown',
      data.signingTime || timestamp
    ]);
    
    // Return success message
    return ContentService.createTextOutput(JSON.stringify({'result': 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle search requests
function handleSearch(e) {
  var searchType = e.parameter.searchType;
  var searchValue = e.parameter.searchValue;
  var token = e.parameter.token;
  
  // Verify Turnstile token
  if (!token || !verifyTurnstileToken(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Invalid CAPTCHA verification'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions') || 
              SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var results = [];
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var entry = {};
    
    // Map spreadsheet columns to JSON properties
    for (var j = 0; j < headers.length; j++) {
      if (j === 0) { // Handle timestamp separately
        entry['timestamp'] = Utilities.formatDate(new Date(row[j]), 
                                               Session.getScriptTimeZone(), 
                                               "yyyy-MM-dd HH:mm:ss");
      } else {
        // Map other columns based on headers (adjust as needed)
        var propName = '';
        switch(j) {
          case 1: propName = 'studentId'; break;
          case 2: propName = 'name'; break;
          case 3: propName = 'class'; break;
          case 4: propName = 'intention'; break;
          case 5: propName = 'reason'; break;
          case 6: propName = 'signature'; break;
          case 7: propName = 'deviceInfo'; break;
          case 8: propName = 'browserInfo'; break;
          case 9: propName = 'ipAddress'; break;
          case 10: propName = 'screenSize'; break;
          case 11: propName = 'signingTime'; break;
          default: propName = headers[j].toLowerCase().replace(/\s+/g, '');
        }
        entry[propName] = row[j];
      }
    }
    
    // Filter based on search type and value
    if (searchType === 'student' && entry.studentId.toString() === searchValue.toString()) {
      results.push(entry);
      // For student search, we only need the first matching result
      break;
    } else if (searchType === 'class' && entry.class === searchValue) {
      results.push(entry);
      // For class search, we collect all matching results
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    results: results
  })).setMimeType(ContentService.MimeType.JSON);
}

// Get system settings from the Settings sheet
function getSystemSettings() {
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  
  // Create settings sheet if it doesn't exist
  if (!settingsSheet) {
    settingsSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Settings');
    settingsSheet.appendRow(['Setting', 'Value']);
    settingsSheet.appendRow(['openTime', '']);
    settingsSheet.appendRow(['closeTime', '']);
  }
  
  var data = settingsSheet.getDataRange().getValues();
  var settings = {};
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  
  // Add current server time
  settings['serverTime'] = new Date().toISOString();
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    settings: settings
  })).setMimeType(ContentService.MimeType.JSON);
}

// Save system settings to the Settings sheet
function saveSystemSettings(data) {
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  
  // Create settings sheet if it doesn't exist
  if (!settingsSheet) {
    settingsSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Settings');
    settingsSheet.appendRow(['Setting', 'Value']);
    settingsSheet.appendRow(['openTime', '']);
    settingsSheet.appendRow(['closeTime', '']);
  }
  
  // Find and update openTime
  var openTimeRow = findSettingRow(settingsSheet, 'openTime');
  if (openTimeRow > 0) {
    settingsSheet.getRange(openTimeRow, 2).setValue(data.openTime || '');
  } else {
    settingsSheet.appendRow(['openTime', data.openTime || '']);
  }
  
  // Find and update closeTime
  var closeTimeRow = findSettingRow(settingsSheet, 'closeTime');
  if (closeTimeRow > 0) {
    settingsSheet.getRange(closeTimeRow, 2).setValue(data.closeTime || '');
  } else {
    settingsSheet.appendRow(['closeTime', data.closeTime || '']);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Settings saved successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Helper function to find a setting row in the settings sheet
function findSettingRow(sheet, settingName) {
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === settingName) {
      return i + 1; // Adding 1 because sheet rows are 1-indexed
    }
  }
  return -1; // Not found
}

// Helper function to get system settings
function getSystemSettingsData() {
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  
  // Create settings sheet if it doesn't exist
  if (!settingsSheet) {
    settingsSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Settings');
    settingsSheet.appendRow(['Setting', 'Value']);
    settingsSheet.appendRow(['openTime', '']);
    settingsSheet.appendRow(['closeTime', '']);
  }
  
  var data = settingsSheet.getDataRange().getValues();
  var settings = {};
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  
  return {
    success: true,
    settings: settings
  };
}

// Function to verify Turnstile token with Cloudflare
function verifyTurnstileToken(token) {
  try {
    var response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: {
        secret: '0x4AAAAAABA6Z3cgrQE8lmhzEYzQz-vUjmY',
        response: token
      }
    });
    
    var result = JSON.parse(response.getContentText());
    return result.success === true;
  } catch(e) {
    console.error('Error verifying Turnstile token:', e);
    return false;
  }
}

// Handle admin login authentication
function handleAdminLogin(e) {
  var username = e.parameter.username;
  var password = e.parameter.password;
  var token = e.parameter.token;
  
  // Verify Turnstile token
  if (!token || !verifyTurnstileToken(token)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Invalid CAPTCHA verification'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // In a real app, credentials should be stored securely
  // For this example, using hardcoded values
  if (username === 'admin' && password === 'admin123') {
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Authentication successful'
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Invalid username or password'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Get all submissions for admin statistics
function getAllSubmissions() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions') || 
              SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var submissions = [];
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var entry = {};
    
    // Map spreadsheet columns to JSON properties
    for (var j = 0; j < headers.length; j++) {
      if (j === 0) { // Handle timestamp
        entry['timestamp'] = row[j];
      } else {
        // Map other columns based on headers
        var propName = '';
        switch(j) {
          case 1: propName = 'studentId'; break;
          case 2: propName = 'name'; break;
          case 3: propName = 'class'; break;
          case 4: propName = 'intention'; break;
          case 5: propName = 'reason'; break;
          case 6: propName = 'signature'; break;
          case 7: propName = 'deviceInfo'; break;
          case 8: propName = 'browserInfo'; break;
          case 9: propName = 'ipAddress'; break;
          case 10: propName = 'screenSize'; break;
          case 11: propName = 'signingTime'; break;
          default: propName = headers[j].toLowerCase().replace(/\s+/g, '');
        }
        entry[propName] = row[j];
      }
    }
    
    submissions.push(entry);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    submissions: submissions
  })).setMimeType(ContentService.MimeType.JSON);
}
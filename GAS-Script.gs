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
  } else if (action == 'exportData') {
    return exportDataAsCSV(e);
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
    return handleFormSubmission(data);
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
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
  
  // If submissions sheet doesn't exist, create it and return empty results
  if (!sheet) {
    sheet = createSubmissionsSheet();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      results: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
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
    } else if (searchType === 'class' && entry.class.toString() === searchValue.toString()) {
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
    settingsSheet = createSettingsSheet();
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
    settingsSheet = createSettingsSheet();
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
    settingsSheet = createSettingsSheet();
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
  
  // Get admin credentials from Settings
  var adminCredentials = getAdminCredentials();
  
  // Rate limiting check
  var ipAddress = getClientIP();
  if (isRateLimited(ipAddress, 'login')) {
    logActivity('login_rate_limited', {ipAddress: ipAddress, username: username});
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Too many attempts, please try again later',
      rateLimited: true
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // In a real app, credentials should be stored securely with proper hashing
  if (username === adminCredentials.username && 
      (password === adminCredentials.password || password === 'admin123')) { // Fallback for demo
    
    // Log successful login
    logActivity('admin_login_success', {
      ipAddress: ipAddress,
      username: username,
      userAgent: e.parameter.userAgent || 'Unknown'
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Authentication successful'
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    // Log failed login attempt
    logActivity('admin_login_failure', {
      ipAddress: ipAddress,
      username: username,
      userAgent: e.parameter.userAgent || 'Unknown'
    });
    
    // Increment failed attempts counter
    incrementFailedAttempts(ipAddress);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Invalid username or password'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Get admin credentials from Settings sheet
function getAdminCredentials() {
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  var defaultCredentials = {username: 'admin', password: 'admin123'};
  
  if (!settingsSheet) return defaultCredentials;
  
  var data = settingsSheet.getDataRange().getValues();
  var credentials = {};
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'adminUsername') {
      credentials.username = data[i][1] || defaultCredentials.username;
    }
    if (data[i][0] === 'adminPassword') {
      credentials.password = data[i][1] || defaultCredentials.password;
    }
  }
  
  return {
    username: credentials.username || defaultCredentials.username,
    password: credentials.password || defaultCredentials.password
  };
}

// Get client IP address
function getClientIP() {
  return 'unknown-ip';  // In production, implement proper IP extraction
}

// Check if user is rate limited
function isRateLimited(ipAddress, action) {
  var cacheKey = ipAddress + '_' + action + '_attempts';
  var cache = CacheService.getScriptCache();
  var attempts = cache.get(cacheKey);
  
  if (attempts !== null && parseInt(attempts) >= 5) {
    return true;
  }
  
  return false;
}

// Increment failed attempts counter
function incrementFailedAttempts(ipAddress) {
  var cacheKey = ipAddress + '_login_attempts';
  var cache = CacheService.getScriptCache();
  var attempts = cache.get(cacheKey);
  
  if (attempts === null) {
    attempts = 1;
  } else {
    attempts = parseInt(attempts) + 1;
  }
  
  // Set with 10 minute expiry
  cache.put(cacheKey, attempts.toString(), 600);
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

// Export data in CSV format for admin downloads
function exportDataAsCSV(e) {
  // Verify admin authentication
  if (!e.parameter.adminToken || e.parameter.adminToken !== 'validAdminToken') {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Authentication required'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions') || 
              SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  var csvContent = '';
  data.forEach(function(row) {
    // Format timestamp for CSV
    if (row[0] instanceof Date) {
      row[0] = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }
    
    // Process each cell to handle special characters
    var processedRow = row.map(function(cell) {
      if (typeof cell === 'string') {
        // Escape quotes and wrap in quotes
        return '"' + cell.replace(/"/g, '""') + '"';
      } else if (cell === null || cell === undefined) {
        return '""';
      } else {
        return '"' + cell.toString() + '"';
      }
    });
    
    csvContent += processedRow.join(',') + '\n';
  });
  
  return ContentService.createTextOutput(csvContent)
    .setMimeType(ContentService.MimeType.CSV)
    .setDownloadAsFile('survey_data.csv');
}

// Log system activity for auditing
function logActivity(action, details) {
  var sheet = getSystemLogsSheet();
  
  var timestamp = new Date();
  sheet.appendRow([
    timestamp,
    action,
    JSON.stringify(details),
    details.ipAddress || 'Unknown',
    details.userAgent || 'Unknown'
  ]);
  
  return {
    success: true,
    timestamp: timestamp
  };
}

// Handle normal form submission
function handleFormSubmission(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
  
  // Create submissions sheet if it doesn't exist
  if (!sheet) {
    sheet = createSubmissionsSheet();
  }
  
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
  
  return ContentService.createTextOutput(JSON.stringify({'result': 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Function to create Settings sheet with default structure
function createSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.insertSheet('Settings');
  
  // Add headers and default settings
  sheet.appendRow(['Setting', 'Value']);
  sheet.appendRow(['openTime', '']);
  sheet.appendRow(['closeTime', '']);
  sheet.appendRow(['adminUsername', 'admin']);
  sheet.appendRow(['adminPassword', 'admin123']);
  
  // Format the sheet
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);
  
  return sheet;
}

// Function to create Submissions sheet with headers
function createSubmissionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.insertSheet('Submissions');
  
  // Add headers
  sheet.appendRow([
    'Timestamp',
    'Student ID',
    'Name',
    'Class',
    'Intention',
    'Reason',
    'Signature',
    'Device Info',
    'Browser Info',
    'IP Address',
    'Screen Size',
    'Signing Time'
  ]);
  
  // Format the header row
  var headerRange = sheet.getRange(1, 1, 1, 12);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f3f3f3');
  
  // Set column widths for better readability
  sheet.setColumnWidth(1, 180); // Timestamp
  sheet.setColumnWidth(2, 100); // Student ID
  sheet.setColumnWidth(3, 150); // Name
  sheet.setColumnWidth(4, 80);  // Class
  sheet.setColumnWidth(5, 80);  // Intention
  sheet.setColumnWidth(6, 200); // Reason
  sheet.setColumnWidth(7, 300); // Signature (will be wide for base64 data)
  sheet.setColumnWidth(8, 200); // Device Info
  sheet.setColumnWidth(9, 200); // Browser Info
  sheet.setColumnWidth(10, 150); // IP Address
  sheet.setColumnWidth(11, 150); // Screen Size
  sheet.setColumnWidth(12, 180); // Signing Time
  
  // Freeze the header row
  sheet.setFrozenRows(1);
  
  return sheet;
}

// Function to create or get SystemLogs sheet
function getSystemLogsSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SystemLogs');
  
  // Create logs sheet if it doesn't exist
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('SystemLogs');
    sheet.appendRow(['Timestamp', 'Action', 'Details', 'IP Address', 'User Agent']);
    
    // Format the header row
    var headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    
    // Set column widths
    sheet.setColumnWidth(1, 180); // Timestamp
    sheet.setColumnWidth(2, 150); // Action
    sheet.setColumnWidth(3, 300); // Details
    sheet.setColumnWidth(4, 150); // IP Address
    sheet.setColumnWidth(5, 250); // User Agent
    
    // Freeze the header row
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}
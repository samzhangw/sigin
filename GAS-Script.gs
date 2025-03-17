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
  } else if (action == 'teacherLogin') {
    return handleTeacherLogin(e);
  } else if (action == 'exportData') {
    return exportDataAsCSV(e);
  } else if (action == 'getTeachers') {
    return getTeacherAccounts();
  } else if (action == 'getSystemLogs') {
    return getSystemLogs();
  } else if (action == 'clearSystemLogs') {
    return clearSystemLogs();
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
  } else if (data.action === 'addTeacher') {
    return addTeacherAccount(data);
  } else if (data.action === 'updateTeacher') {
    return updateTeacherAccount(data);
  } else if (data.action === 'resetTeacherPassword') {
    return resetTeacherPassword(data);
  } else if (data.action === 'deleteTeacher') {
    return deleteTeacherAccount(data);
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
          case 12: propName = 'signatureVerified'; break;
          case 13: propName = 'verificationData'; break;
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
  var hashedPassword = e.parameter.hashedPassword;
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
      (password === adminCredentials.password || password === 'admin123' || hashedPassword === adminCredentials.password)) { // Fallback for demo
    
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
          case 12: propName = 'signatureVerified'; break;
          case 13: propName = 'verificationData'; break;
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
  
  // Parse verification data
  var signatureVerification = data.signatureVerification ? JSON.parse(data.signatureVerification) : {};
  var signatureVerified = verifySignature(data.signature, signatureVerification);
  
  // Calculate biometric confidence level (0-100%)
  var biometricConfidence = signatureVerification.biometricScore || 0;
  
  // Enhanced verification status
  var verificationStatus = signatureVerified ? 
    (biometricConfidence > 70 ? 'Highly Verified' : 'Verified') : 
    'Unverified';
  
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
    data.signingTime || timestamp,
    verificationStatus,
    JSON.stringify(signatureVerification)
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({'result': 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Function to verify signature integrity
function verifySignature(signatureData, verificationData) {
  // Basic verification - check if verification data exists and has minimum path count
  if (!verificationData || !verificationData.pathCount) {
    return false;
  }
  
  // Check if signature has a reasonable number of points
  if (verificationData.pathCount < 3 || verificationData.pathPoints < 20) {
    return false;
  }
  
  // Check if timestamp is within a reasonable range
  if (verificationData.timestamp) {
    var signatureTime = new Date(verificationData.timestamp);
    var now = new Date();
    var timeDifference = now.getTime() - signatureTime.getTime();
    var maxTimeDifference = 30 * 60 * 1000; // 30 minutes
    
    if (timeDifference > maxTimeDifference) {
      return false;
    }
  }
  
  // Check for signature dimensions
  if (verificationData.signatureWidth && verificationData.signatureHeight) {
    if (verificationData.signatureWidth < 100 || verificationData.signatureHeight < 50) {
      return false;
    }
  }
  
  // Check for potential fraud (too perfect paths or geometric patterns)
  if (verificationData.pathPoints / verificationData.pathCount > 100) {
    // Suspiciously high number of points per path
    return false;
  }
  
  // Check for reasonable biometric score
  if (verificationData.biometricScore !== undefined) {
    if (verificationData.biometricScore < 30) {
      return false; // Very low biometric score suggests automated or overly simple signatures
    }
  }
  
  // Check for natural drawing patterns
  if (verificationData.drawingPatterns) {
    // Verify that drawing has natural variations in stroke direction
    if (verificationData.drawingPatterns.strokeCurvature < 0.5) {
      return false; // Too straight/perfect lines suggest automated drawing
    }
    
    // If pressure data is available, ensure it has natural variation
    if (verificationData.drawingPatterns.averagePressure > 0 && 
        verificationData.drawingSpeed < 5) {
      return false; // Too consistent pressure and speed suggests automation
    }
  }
  
  // Check drawing speed is within human ranges
  if (verificationData.drawingSpeed !== undefined) {
    if (verificationData.drawingSpeed > 500) {
      return false; // Too fast to be human drawing
    }
  }
  
  return true;
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
    'Signing Time',
    'Signature Verified',
    'Verification Data'
  ]);
  
  // Format the header row
  var headerRange = sheet.getRange(1, 1, 1, 14);
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
  sheet.setColumnWidth(13, 120); // Signature Verified
  sheet.setColumnWidth(14, 300); // Verification Data
  
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

// Get teacher accounts
function getTeacherAccounts() {
  var sheet = getTeachersSheet();
  var data = sheet.getDataRange().getValues();
  var teachers = [];
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    teachers.push({
      id: i,  // Use row index as ID
      username: row[0],
      name: row[1],
      class: row[2],
      createdAt: row[4] ? new Date(row[4]).toISOString() : new Date().toISOString()
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    teachers: teachers
  })).setMimeType(ContentService.MimeType.JSON);
}

// Add teacher account
function addTeacherAccount(data) {
  var sheet = getTeachersSheet();
  
  // Check if username already exists
  var existingData = sheet.getDataRange().getValues();
  for (var i = 1; i < existingData.length; i++) {
    if (existingData[i][0] === data.username) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Username already exists'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Add new teacher row
  sheet.appendRow([
    data.username,
    data.name,
    data.class,
    data.password, // In a real implementation, this should be hashed
    new Date().toISOString(),
    'active',
    data.type || 'teacher'
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Teacher account created successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Update teacher account
function updateTeacherAccount(data) {
  var sheet = getTeachersSheet();
  var rowIndex = data.id;
  
  // Only update name and class, not username or password
  sheet.getRange(rowIndex, 2).setValue(data.name);
  sheet.getRange(rowIndex, 3).setValue(data.class);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Teacher account updated successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Reset teacher password
function resetTeacherPassword(data) {
  var sheet = getTeachersSheet();
  var rowIndex = data.id;
  
  // Update password column (column 4)
  sheet.getRange(rowIndex, 4).setValue(data.password); // In a real implementation, this should be hashed
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Password reset successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Delete teacher account
function deleteTeacherAccount(data) {
  var sheet = getTeachersSheet();
  var rowIndex = data.id;
  
  // Mark as deleted instead of actually deleting (safer approach)
  sheet.getRange(rowIndex, 6).setValue('deleted');
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Teacher account deleted successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Handle teacher login
function handleTeacherLogin(e) {
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
  
  // Get teacher sheet
  var sheet = getTeachersSheet();
  var data = sheet.getDataRange().getValues();
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][3] === password && data[i][5] === 'active') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        teacherInfo: {
          username: data[i][0],
          name: data[i][1],
          class: data[i][2],
          type: data[i][6] || 'teacher'
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: 'Invalid username or password'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Create or get Teachers sheet
function getTeachersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Teachers');
  
  if (!sheet) {
    sheet = ss.insertSheet('Teachers');
    
    // Add headers
    sheet.appendRow([
      'Username', 
      'Name', 
      'Class', 
      'Password', 
      'Created', 
      'Status', 
      'Type'
    ]);
    
    // Format the header row
    var headerRange = sheet.getRange(1, 1, 1, 7);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    
    // Set column widths
    sheet.setColumnWidth(1, 150); // Username
    sheet.setColumnWidth(2, 150); // Name
    sheet.setColumnWidth(3, 100); // Class
    sheet.setColumnWidth(4, 150); // Password
    sheet.setColumnWidth(5, 180); // Created
    sheet.setColumnWidth(6, 100); // Status
    sheet.setColumnWidth(7, 100); // Type
    
    // Freeze the header row
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// Get system logs
function getSystemLogs() {
  var sheet = getSystemLogsSheet();
  var data = sheet.getDataRange().getValues();
  var logs = [];
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    logs.push({
      timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0],
      action: row[1],
      details: row[2],
      ipAddress: row[3],
      userAgent: row[4]
    });
  }
  
  // Sort logs by timestamp, newest first
  logs.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    logs: logs
  })).setMimeType(ContentService.MimeType.JSON);
}

// Clear system logs
function clearSystemLogs() {
  var sheet = getSystemLogsSheet();
  
  // Keep the header row and delete all other rows
  var numRows = sheet.getLastRow();
  if (numRows > 1) {
    sheet.deleteRows(2, numRows - 1);
  }
  
  // Log the clearing action itself
  logActivity('logs_cleared', {
    clearedBy: 'admin',
    timestamp: new Date().toISOString()
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'System logs cleared successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}
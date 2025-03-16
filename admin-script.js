document.addEventListener('DOMContentLoaded', function() {
  const adminForm = document.getElementById('adminForm');
  const adminLoading = document.getElementById('adminLoading');
  const adminResult = document.getElementById('adminResult');
  const adminAlertModal = document.getElementById('adminAlertModal');
  const adminConfirmModal = document.getElementById('adminConfirmModal');
  const openTimeInput = document.getElementById('openTime');
  const closeTimeInput = document.getElementById('closeTime');
  const currentOpenTime = document.getElementById('currentOpenTime');
  const currentCloseTime = document.getElementById('currentCloseTime');
  const closeBtns = document.getElementsByClassName('close');

  // Login elements
  const loginForm = document.getElementById('loginForm');
  const loginSection = document.getElementById('loginSection');
  const adminSection = document.getElementById('adminSection');
  const loginLoading = document.getElementById('loginLoading');
  const loginResult = document.getElementById('loginResult');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const rememberMeCheckbox = document.getElementById('rememberMe');
  const forgotPasswordLink = document.getElementById('forgotPassword');

  // Toggle password visibility
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePasswordBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
  }

  // Forgot password handler
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', function(e) {
      e.preventDefault();
      showAdminAlert('請聯繫系統管理員重設密碼');
    });
  }

  // Check saved credentials
  function checkSavedCredentials() {
    const savedUsername = localStorage.getItem('adminUsername');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (savedUsername && savedRememberMe) {
      document.getElementById('username').value = savedUsername;
      document.getElementById('rememberMe').checked = true;
    }
  }

  // Auto-check for saved credentials on page load
  checkSavedCredentials();

  // Check if admin is already logged in with a valid session
  function checkAdminSession() {
    const adminSession = sessionStorage.getItem('adminSession');
    const sessionExpiry = sessionStorage.getItem('sessionExpiry');
    
    if (adminSession && sessionExpiry && new Date().getTime() < parseInt(sessionExpiry)) {
      // Session is still valid
      showAdminSection();
      return true;
    } else if (adminSession) {
      // Session expired
      sessionStorage.removeItem('adminSession');
      sessionStorage.removeItem('sessionExpiry');
      showLoginMessage('登入階段已過期，請重新登入', 'error');
    }
    
    return false;
  }

  // Check for active admin session
  if (checkAdminSession()) {
    showAdminSection();
  } else if (localStorage.getItem('adminLoggedIn') === 'true') {
    // Legacy check - transition to new session-based system
    sessionStorage.setItem('adminSession', 'true');
    sessionStorage.setItem('sessionExpiry', (new Date().getTime() + 3600000).toString()); // 1 hour
    showAdminSection();
  }

  // Login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe').checked;

      // Basic input validation
      if (!username || !password) {
        showLoginMessage('請輸入帳號和密碼', 'error');
        loginForm.classList.add('shakeError');
        setTimeout(() => loginForm.classList.remove('shakeError'), 500);
        return;
      }

      // Check if Turnstile token is valid
      const token = turnstile.getResponse();
      if (!token) {
        showLoginMessage('請完成人機驗證', 'error');
        return;
      }

      loginLoading.style.display = 'block';
      loginResult.style.display = 'none';

      // Hash the password before sending (for demo - in production use HTTPS)
      const hashedPassword = simpleHash(password);

      // Use server-side authentication
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbxCCH1cdUGSjPVnOPqyfyZ9yQ9eHmCp1Uc4J2hbt3aDwDTwOhUAlPf52gSZRfhrH4jbwg/exec';
      
      fetch(`${scriptUrl}?action=adminLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(hashedPassword)}&token=${encodeURIComponent(token)}`)
        .then(response => response.json())
        .then(data => {
          loginLoading.style.display = 'none';
          
          if (data.success) {
            // Save credentials if remember me is checked
            if (rememberMe) {
              localStorage.setItem('adminUsername', username);
              localStorage.setItem('rememberMe', 'true');
            } else {
              localStorage.removeItem('adminUsername');
              localStorage.removeItem('rememberMe');
            }
            
            // Set session storage with expiry (1 hour)
            sessionStorage.setItem('adminSession', 'true');
            sessionStorage.setItem('sessionExpiry', (new Date().getTime() + 3600000).toString());
            
            // Keep legacy storage for backward compatibility
            localStorage.setItem('adminLoggedIn', 'true');
            
            showLoginMessage('登入成功，正在進入管理系統...', 'success');

            // Show admin section after a brief delay
            setTimeout(() => {
              showAdminSection();
            }, 1000);
          } else {
            showLoginMessage('帳號或密碼錯誤，請重試', 'error');
            loginForm.classList.add('shakeError');
            setTimeout(() => loginForm.classList.remove('shakeError'), 500);
          }
        })
        .catch(error => {
          loginLoading.style.display = 'none';
          showLoginMessage('登入失敗，請稍後再試', 'error');
          console.error('Error:', error);
        });
    });
  }

  function showLoginMessage(message, type) {
    loginResult.textContent = message;
    loginResult.className = type;
    loginResult.style.display = 'block';
  }

  function showAdminSection() {
    if (loginSection) loginSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'block';

    // Fetch settings and stats after showing admin section
    fetchCurrentSettings();
  }

  // Simple hash function for demo purposes
  function simpleHash(str) {
    // Just return the raw password for now since server handles authentication
    return str;
  }

  // Logout functionality with session clearing
  window.logoutAdmin = function() {
    localStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminSession');
    sessionStorage.removeItem('sessionExpiry');
    
    if (loginSection) loginSection.style.display = 'block';
    if (adminSection) adminSection.style.display = 'none';
    
    // Reset login form
    if (loginForm) {
      loginForm.reset();
      checkSavedCredentials();
    }
    
    // Reset login result message
    if (loginResult) {
      loginResult.style.display = 'none';
    }
  }

  // Session timeout check
  function checkSessionTimeout() {
    const sessionExpiry = sessionStorage.getItem('sessionExpiry');
    if (sessionExpiry && parseInt(sessionExpiry) < new Date().getTime()) {
      logoutAdmin();
      showAdminAlert('登入階段已過期，請重新登入');
    }
  }

  // Check session timeout every minute
  setInterval(checkSessionTimeout, 60000);

  // Tab navigation
  const tabs = document.querySelectorAll('.admin-tab');
  const tabContents = document.querySelectorAll('.admin-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');

      if (tab.dataset.tab === 'statsTab') {
        fetchStatistics();
      }
    });
  });

  // Close modal buttons
  Array.from(closeBtns).forEach(btn => {
    btn.onclick = function() {
      btn.closest('.modal').style.display = 'none';
    }
  });

  // Modal window click outside
  window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  }

  // Admin form submission
  adminForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const openTime = openTimeInput.value;
    const closeTime = closeTimeInput.value;

    if (openTime && closeTime && new Date(openTime) >= new Date(closeTime)) {
      showAdminAlert('開放時間必須早於關閉時間');
      return;
    }

    adminConfirmModal.style.display = 'block';
  });

  document.getElementById('confirmAdmin').addEventListener('click', function() {
    adminConfirmModal.style.display = 'none';
    saveSettings();
  });

  document.getElementById('cancelAdmin').addEventListener('click', function() {
    adminConfirmModal.style.display = 'none';
  });

  function fetchCurrentSettings() {
    adminLoading.style.display = 'block';

    fetch('https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec?action=getSettings')
      .then(response => response.json())
      .then(data => {
        adminLoading.style.display = 'none';

        if (data && data.settings) {
          if (data.settings.openTime) {
            const openTime = new Date(data.settings.openTime);
            currentOpenTime.textContent = `開放時間：${openTime.toLocaleString()}`;

            // Format for input field: YYYY-MM-DDThh:mm
            const year = openTime.getFullYear();
            const month = String(openTime.getMonth() + 1).padStart(2, '0');
            const day = String(openTime.getDate()).padStart(2, '0');
            const hours = String(openTime.getHours()).padStart(2, '0');
            const minutes = String(openTime.getMinutes()).padStart(2, '0');
            openTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
          }

          if (data.settings.closeTime) {
            const closeTime = new Date(data.settings.closeTime);
            currentCloseTime.textContent = `關閉時間：${closeTime.toLocaleString()}`;

            const year = closeTime.getFullYear();
            const month = String(closeTime.getMonth() + 1).padStart(2, '0');
            const day = String(closeTime.getDate()).padStart(2, '0');
            const hours = String(closeTime.getHours()).padStart(2, '0');
            const minutes = String(closeTime.getMinutes()).padStart(2, '0');
            closeTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
          }

          // Add server time display
          const serverTime = data.settings.serverTime ? new Date(data.settings.serverTime) : new Date();
          const serverTimeElement = document.createElement('p');
          serverTimeElement.innerHTML = `<i class="fas fa-clock"></i> 系統時間：${serverTime.toLocaleString()}`;
          
          // Show current system state
          const systemStateElement = document.createElement('div');
          systemStateElement.className = 'system-state';
          const now = serverTime;
          const openTime = data.settings.openTime ? new Date(data.settings.openTime) : null;
          const closeTime = data.settings.closeTime ? new Date(data.settings.closeTime) : null;

          let stateText = '系統狀態：';
          let stateClass = '';

          if (!openTime || !closeTime) {
            stateText += '未完整設定';
            stateClass = 'warning';
          } else if (now < openTime) {
            stateText += '尚未開放';
            stateClass = 'inactive';
          } else if (now > closeTime) {
            stateText += '已關閉';
            stateClass = 'inactive';
          } else {
            stateText += '開放中';
            stateClass = 'active';
          }

          systemStateElement.innerHTML = `<p class="${stateClass}"><i class="fas fa-circle"></i> ${stateText}</p>`;
          const currentSettings = document.getElementById('currentSettings');

          // Remove existing system state if exists
          const existingState = currentSettings.querySelector('.system-state');
          if (existingState) {
            existingState.remove();
          }
          
          // Add server time to current settings
          const existingServerTime = currentSettings.querySelector('.server-time');
          if (existingServerTime) {
            existingServerTime.remove();
          }
          
          serverTimeElement.classList.add('server-time');
          currentSettings.insertBefore(serverTimeElement, currentSettings.firstChild);
          currentSettings.appendChild(systemStateElement);
        }
      })
      .catch(error => {
        adminLoading.style.display = 'none';
        showAdminAlert('獲取當前設定失敗，請稍後再試');
        console.error('Error:', error);
      });
  }

  function saveSettings() {
    const openTime = openTimeInput.value;
    const closeTime = closeTimeInput.value;

    adminLoading.style.display = 'block';
    adminResult.style.display = 'none';

    const scriptUrl = 'https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec';

    fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveSettings',
        openTime: openTime ? new Date(openTime).toISOString() : null,
        closeTime: closeTime ? new Date(closeTime).toISOString() : null
      })
    })
    .then(response => {
      adminLoading.style.display = 'none';
      adminResult.textContent = '系統設定已成功更新';
      adminResult.className = 'success';
      adminResult.style.display = 'block';

      // Update current settings display
      fetchCurrentSettings();
    })
    .catch(error => {
      adminLoading.style.display = 'none';
      adminResult.textContent = '更新設定失敗，請稍後再試';
      adminResult.className = 'error';
      adminResult.style.display = 'block';
      console.error('Error:', error);
    });
  }

  function showAdminAlert(message) {
    const alertMessage = document.getElementById('adminAlertMessage');
    alertMessage.textContent = message;
    adminAlertModal.style.display = 'block';
  }

  let statsCache = null;
  let lastStatsFetch = 0;
  const CACHE_DURATION = 60000; // 1 minute cache

  function fetchStatistics() {
    const statsLoading = document.getElementById('statsLoading');
    const classStatsContainer = document.getElementById('classStatistics');
    const submissionsTable = document.getElementById('submissionsTable').querySelector('tbody');
    
    // Check if we have cached data that is still valid
    const now = Date.now();
    if (statsCache && (now - lastStatsFetch < CACHE_DURATION)) {
      displayStatistics(statsCache);
      return;
    }

    statsLoading.style.display = 'block';
    classStatsContainer.innerHTML = '';
    submissionsTable.innerHTML = '';

    fetch('https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec?action=getAllSubmissions')
      .then(response => response.json())
      .then(data => {
        statsLoading.style.display = 'none';

        if (data.success && data.submissions) {
          // Cache the data
          statsCache = data;
          lastStatsFetch = now;
          
          displayStatistics(data);
        } else {
          showAdminAlert('無法載入統計資料，請稍後再試');
        }
      })
      .catch(error => {
        statsLoading.style.display = 'none';
        showAdminAlert('載入統計資料失敗，請稍後再試');
        console.error('Error:', error);
      });
  }
  
  function displayStatistics(data) {
    // Store submissions globally for filtering
    window.allSubmissions = data.submissions;

    // Process class statistics
    const classTotals = {};

    data.submissions.forEach(submission => {
      const className = submission.class;

      if (!classTotals[className]) {
        classTotals[className] = {
          total: 0,
          participate: 0,
          notParticipate: 0
        };
      }

      classTotals[className].total++;
      if (submission.intention === '參加') {
        classTotals[className].participate++;
      } else {
        classTotals[className].notParticipate++;
      }
    });

    // Create summary statistics
    const totalSubmissions = data.submissions.length;
    const totalParticipate = data.submissions.filter(s => s.intention === '參加').length;
    const totalNotParticipate = totalSubmissions - totalParticipate;
    const participatePercent = (totalParticipate / totalSubmissions * 100).toFixed(1);

    document.getElementById('statsTotalSubmissions').textContent = totalSubmissions;
    document.getElementById('statsParticipateCount').textContent = totalParticipate;
    document.getElementById('statsNotParticipateCount').textContent = totalNotParticipate;
    document.getElementById('statsParticipatePercent').textContent = `${participatePercent}%`;

    // Create overview chart
    createOverviewChart(totalParticipate, totalNotParticipate);
    
    // Create class stats cards
    Object.keys(classTotals).sort().forEach(className => {
      const stats = classTotals[className];
      const participatePercent = (stats.participate / stats.total * 100).toFixed(1);

      const classCard = document.createElement('div');
      classCard.className = 'class-stat-card';
      classCard.innerHTML = `
        <h4>${className}</h4>
        <div class="class-stat-numbers">
          <div class="class-stat-number total">
            <span>${stats.total}</span>
            <p>總人數</p>
          </div>
          <div class="class-stat-number yes">
            <span>${stats.participate}</span>
            <p>參加</p>
          </div>
          <div class="class-stat-number no">
            <span>${stats.notParticipate}</span>
            <p>不參加</p>
          </div>
        </div>
        <div class="class-stat-progress">
          <div class="class-stat-bar" style="width: ${participatePercent}%"></div>
        </div>
        <p>參加率: ${participatePercent}%</p>
      `;

      document.getElementById('classStatistics').appendChild(classCard);
    });

    // Create timeline chart
    createTimelineChart(data.submissions);
    
    // Populate submissions table with virtualization for performance
    virtualizedTableRender(data.submissions);
  }
  
  function createOverviewChart(participate, notParticipate) {
    const chartContainer = document.getElementById('overviewChart');
    chartContainer.innerHTML = '';
    
    const total = participate + notParticipate;
    const participatePercent = (participate / total * 100).toFixed(1);
    const notParticipatePercent = (notParticipate / total * 100).toFixed(1);
    
    chartContainer.innerHTML = `
      <div class="donut-chart-container">
        <div class="donut-chart" style="--percentage: ${participatePercent}; --fill: var(--secondary-color);">
          <div class="donut-chart-text">
            <span class="donut-chart-percent">${participatePercent}%</span>
            <span class="donut-chart-label">參加率</span>
          </div>
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color" style="background-color: var(--secondary-color);"></span>
            <span>參加 (${participate}人)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: #e74c3c;"></span>
            <span>不參加 (${notParticipate}人)</span>
          </div>
        </div>
      </div>
    `;
  }
  
  function createTimelineChart(submissions) {
    if (!submissions || submissions.length === 0) return;
    
    const timelineContainer = document.getElementById('timelineChart');
    timelineContainer.innerHTML = '';
    
    // Group submissions by hour
    const submissionsByHour = {};
    
    submissions.forEach(submission => {
      const date = new Date(submission.timestamp);
      const hourKey = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:00`;
      
      if (!submissionsByHour[hourKey]) {
        submissionsByHour[hourKey] = { total: 0, participate: 0, notParticipate: 0 };
      }
      
      submissionsByHour[hourKey].total++;
      if (submission.intention === '參加') {
        submissionsByHour[hourKey].participate++;
      } else {
        submissionsByHour[hourKey].notParticipate++;
      }
    });
    
    // Sort hours chronologically
    const sortedHours = Object.keys(submissionsByHour).sort((a, b) => {
      // Simple string comparison works if format is consistent MM/DD HH:00
      return a.localeCompare(b);
    });
    
    // Find max value for scaling
    let maxValue = 0;
    sortedHours.forEach(hour => {
      if (submissionsByHour[hour].total > maxValue) {
        maxValue = submissionsByHour[hour].total;
      }
    });
    
    // Create the timeline chart
    const chartHTML = `
      <h3>填寫時間分佈</h3>
      <div class="timeline-chart">
        <div class="timeline-bars">
          ${sortedHours.map(hour => {
            const hourData = submissionsByHour[hour];
            const barHeight = (hourData.total / maxValue * 100).toFixed(0);
            const participateHeight = (hourData.participate / hourData.total * 100).toFixed(0);
            
            return `
              <div class="timeline-bar-container" title="${hour}: ${hourData.total}人">
                <div class="timeline-bar" style="height: ${barHeight}%">
                  <div class="timeline-bar-participate" style="height: ${participateHeight}%"></div>
                </div>
                <div class="timeline-label">${hour}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="timeline-legend">
        <div class="legend-item">
          <span class="legend-color" style="background-color: var(--secondary-color);"></span>
          <span>參加</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #e74c3c;"></span>
          <span>不參加</span>
        </div>
      </div>
    `;
    
    timelineContainer.innerHTML = chartHTML;
  }
  
  function virtualizedTableRender(submissions) {
    const tbody = document.getElementById('submissionsTable').querySelector('tbody');
    tbody.innerHTML = '';
    
    // Only render visible rows (virtual scrolling)
    const visibleCount = Math.min(50, submissions.length);
    
    for (let i = 0; i < visibleCount; i++) {
      const submission = submissions[i];
      addTableRow(tbody, submission, i);
    }
    
    // Add scroll listener to load more rows when scrolling
    if (submissions.length > visibleCount) {
      const tableContainer = document.querySelector('.stats-table').parentElement;
      tableContainer.onscroll = function() {
        if (tableContainer.scrollTop + tableContainer.clientHeight >= tableContainer.scrollHeight - 200) {
          const currentCount = tbody.children.length;
          const nextBatch = Math.min(20, submissions.length - currentCount);
          
          if (nextBatch <= 0) return;
          
          for (let i = 0; i < nextBatch; i++) {
            const index = currentCount + i;
            if (index < submissions.length) {
              addTableRow(tbody, submissions[index], index);
            }
          }
        }
      };
    }
  }
  
  function addTableRow(tbody, submission, index) {
    const row = document.createElement('tr');
    const timestamp = new Date(submission.timestamp);

    // Parse device info if it exists
    let deviceDetails = '';
    if (submission.deviceInfo && submission.deviceInfo !== 'Unknown') {
      try {
        const deviceData = JSON.parse(submission.deviceInfo);
        deviceDetails = `<div class="device-details">
          <span>${deviceData.platform || 'Unknown'}</span>
          <span>${deviceData.userAgent ? deviceData.userAgent.substring(0, 50) + '...' : 'Unknown'}</span>
        </div>`;
      } catch (e) {
        deviceDetails = submission.deviceInfo;
      }
    }

    row.innerHTML = `
      <td>${submission.studentId}</td>
      <td>${submission.name}</td>
      <td>${submission.class}</td>
      <td class="${submission.intention === '參加' ? 'intention-yes' : 'intention-no'}">${submission.intention}</td>
      <td>${submission.reason || '-'}</td>
      <td>${timestamp.toLocaleString()}</td>
      <td>
        <button class="view-details-btn" data-submission-id="${index}">
          <i class="fas fa-info-circle"></i> 詳細資訊
        </button>
      </td>
    `;

    tbody.appendChild(row);

    // Attach event listener to the details button
    const detailsBtn = row.querySelector('.view-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', () => showSubmissionDetails(submission));
    }
  }

  function showSubmissionDetails(submission) {
    // Create modal if it doesn't exist
    let detailsModal = document.getElementById('submissionDetailsModal');
    if (!detailsModal) {
      detailsModal = document.createElement('div');
      detailsModal.id = 'submissionDetailsModal';
      detailsModal.className = 'modal';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content submission-details-content';
      
      const closeSpan = document.createElement('span');
      closeSpan.className = 'close';
      closeSpan.innerHTML = '&times;';
      closeSpan.onclick = function() {
        detailsModal.style.display = 'none';
      };
      
      modalContent.appendChild(closeSpan);
      detailsModal.appendChild(modalContent);
      document.body.appendChild(detailsModal);
      
      // Close modal on outside click
      detailsModal.onclick = function(event) {
        if (event.target === detailsModal) {
          detailsModal.style.display = 'none';
        }
      };
    }
    
    // Format timestamp
    const timestamp = new Date(submission.timestamp).toLocaleString();
    
    // Parse signature verification data
    let signatureVerificationHtml = '<p>No verification data available</p>';
  
    if (submission.signatureVerified || submission.verificationData) {
      const verificationStatus = submission.signatureVerified === 'Verified' ? 
        '<span style="color: var(--secondary-color);"><i class="fas fa-check-circle"></i> Verified</span>' : 
        '<span style="color: #e74c3c;"><i class="fas fa-exclamation-triangle"></i> Unverified</span>';
      
      let verificationDetails = 'No detailed verification data';
      
      if (submission.verificationData) {
        try {
          const verData = JSON.parse(submission.verificationData);
          verificationDetails = `
            <p><strong>Signature Timestamp:</strong> ${new Date(verData.timestamp).toLocaleString()}</p>
            <p><strong>Signature Complexity:</strong> ${verData.pathCount} strokes, ${verData.pathPoints} points</p>
          `;
        } catch (e) {
          verificationDetails = submission.verificationData;
        }
      }
      
      signatureVerificationHtml = `
        <div class="details-section">
          <h4><i class="fas fa-shield-alt"></i> Signature Verification</h4>
          <p><strong>Status:</strong> ${verificationStatus}</p>
          ${verificationDetails}
        </div>
      `;
    }
  
    // Parse device info
    let deviceInfoHtml = '';
    if (submission.deviceInfo && submission.deviceInfo !== 'Unknown') {
      try {
        const deviceData = JSON.parse(submission.deviceInfo);
        deviceInfoHtml = `
          <div class="details-section">
            <h4><i class="fas fa-laptop"></i> Device Information</h4>
            <p><strong>Platform:</strong> ${deviceData.platform || 'Unknown'}</p>
            <p><strong>Browser:</strong> ${deviceData.vendor || 'Unknown'}</p>
            <p><strong>User Agent:</strong> ${deviceData.userAgent || 'Unknown'}</p>
          </div>
        `;
      } catch (e) {
        deviceInfoHtml = `<p>${submission.deviceInfo}</p>`;
      }
    }
    
    // Parse browser info
    let browserInfoHtml = '';
    if (submission.browserInfo && submission.browserInfo !== 'Unknown') {
      try {
        const browserData = JSON.parse(submission.browserInfo);
        browserInfoHtml = `
          <div class="details-section">
            <h4><i class="fas fa-globe"></i> Browser Information</h4>
            <p><strong>Language:</strong> ${browserData.language || 'Unknown'}</p>
            <p><strong>Cookies Enabled:</strong> ${browserData.cookiesEnabled ? 'Yes' : 'No'}</p>
            <p><strong>Do Not Track:</strong> ${browserData.doNotTrack || 'Unknown'}</p>
          </div>
        `;
      } catch (e) {
        browserInfoHtml = '';
      }
    }
    
    // Parse screen info
    let screenInfoHtml = '';
    if (submission.screenSize && submission.screenSize !== 'Unknown') {
      try {
        const screenData = JSON.parse(submission.screenSize);
        screenInfoHtml = `
          <div class="details-section">
            <h4><i class="fas fa-desktop"></i> Screen Information</h4>
            <p><strong>Resolution:</strong> ${screenData.width || 0} x ${screenData.height || 0}</p>
            <p><strong>Color Depth:</strong> ${screenData.colorDepth || 'Unknown'}</p>
            <p><strong>Pixel Ratio:</strong> ${screenData.pixelRatio || 'Unknown'}</p>
          </div>
        `;
      } catch (e) {
        screenInfoHtml = '';
      }
    }
    
    // Populate the modal with submission details
    const modalContent = detailsModal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <span class="close">&times;</span>
      <h2><i class="fas fa-user-graduate"></i> Submission Details: ${submission.name} (${submission.studentId})</h2>
      
      <div class="details-columns">
        <div class="details-column">
          <div class="details-section">
            <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
            <p><strong>Student ID:</strong> ${submission.studentId}</p>
            <p><strong>Name:</strong> ${submission.name}</p>
            <p><strong>Class:</strong> ${submission.class}</p>
            <p><strong>Intention:</strong> <span class="${submission.intention === '參加' ? 'intention-yes' : 'intention-no'}">${submission.intention}</span></p>
            <p><strong>Reason:</strong> ${submission.reason || 'None'}</p>
            <p><strong>Submission Time:</strong> ${timestamp}</p>
          </div>
          
          ${deviceInfoHtml}
        </div>
        
        <div class="details-column">
          ${browserInfoHtml}
          ${screenInfoHtml}
          ${signatureVerificationHtml}
          
          <div class="details-section">
            <h4><i class="fas fa-signature"></i> Parent Signature</h4>
            ${submission.signature ? 
              `<div class="signature-container">
                <img src="${submission.signature}" alt="Parent Signature" class="signature-image-preview">
              </div>` : 
              '<p>No signature data available</p>'
            }
          </div>
        </div>
      </div>
      
      <div class="details-actions">
        <button id="printDetails" class="details-action-btn">
          <i class="fas fa-print"></i> Print Details
        </button>
        <button id="exportSignature" class="details-action-btn">
          <i class="fas fa-file-export"></i> Export Signature
        </button>
        <button id="verifySignature" class="details-action-btn">
          <i class="fas fa-shield-alt"></i> Verify Signature
        </button>
      </div>
    `;
    
    // Attach event listeners to buttons
    const printBtn = document.getElementById('printDetails');
    if (printBtn) {
      printBtn.onclick = function() {
        printSubmissionDetails(submission);
      };
    }
    
    const exportSignatureBtn = document.getElementById('exportSignature');
    if (exportSignatureBtn) {
      exportSignatureBtn.onclick = function() {
        if (submission.signature) {
          const link = document.createElement('a');
          link.href = submission.signature;
          link.download = `signature_${submission.studentId}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          showAdminAlert('No signature data available');
        }
      };
    }
    
    const verifySignatureBtn = document.getElementById('verifySignature');
    if (verifySignatureBtn) {
      verifySignatureBtn.addEventListener('click', function() {
        // Show detailed verification information
        showSignatureVerificationDetails(submission);
      });
    }
    
    // Show the modal
    detailsModal.style.display = 'block';
  }

  // Function to show detailed signature verification
  function showSignatureVerificationDetails(submission) {
    let verificationModal = document.getElementById('signatureVerificationModal');
  
    if (!verificationModal) {
      verificationModal = document.createElement('div');
      verificationModal.id = 'signatureVerificationModal';
      verificationModal.className = 'modal';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';
      
      const closeSpan = document.createElement('span');
      closeSpan.className = 'close';
      closeSpan.innerHTML = '&times;';
      closeSpan.onclick = function() {
        verificationModal.style.display = 'none';
      };
      
      modalContent.appendChild(closeSpan);
      verificationModal.appendChild(modalContent);
      document.body.appendChild(verificationModal);
      
      // Close modal on outside click
      verificationModal.onclick = function(event) {
        if (event.target === verificationModal) {
          verificationModal.style.display = 'none';
        }
      };
    }
  
    // Parse verification data
    let verificationDetails = '<p>No verification data available for this signature.</p>';
    let verificationStatus = '<span class="verification-status-unknown">Unknown</span>';
  
    if (submission.signatureVerified) {
      verificationStatus = submission.signatureVerified === 'Verified' ? 
        '<span class="verification-status-verified">Verified</span>' : 
        '<span class="verification-status-unverified">Unverified</span>';
    }
  
    if (submission.verificationData) {
      try {
        const verData = JSON.parse(submission.verificationData);
        verificationDetails = `
          <div class="verification-details">
            <p><strong>Signature Created:</strong> ${new Date(verData.timestamp).toLocaleString()}</p>
            <p><strong>Submission Time:</strong> ${new Date(submission.timestamp).toLocaleString()}</p>
            <p><strong>Signature Complexity:</strong> ${verData.pathCount} strokes with ${verData.pathPoints} points</p>
            <p><strong>Browser Information:</strong> ${verData.browserInfo || 'Not available'}</p>
          </div>
        `;
      } catch (e) {
        verificationDetails = `<p>Raw verification data: ${submission.verificationData}</p>`;
      }
    }
  
    const modalContent = verificationModal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <span class="close">&times;</span>
      <h2><i class="fas fa-shield-alt"></i> Signature Verification</h2>
      
      <div class="verification-summary">
        <h3>Verification Status: ${verificationStatus}</h3>
        <p>Student: ${submission.name} (${submission.studentId})</p>
      </div>
      
      <div class="verification-info">
        <h3>Verification Details</h3>
        ${verificationDetails}
      </div>
      
      <div class="verification-image">
        <h3>Signature Image</h3>
        ${submission.signature ? 
          `<img src="${submission.signature}" alt="Signature" class="signature-preview">` : 
          '<p>No signature image available</p>'
        }
      </div>
    `;
  
    verificationModal.style.display = 'block';
  }

  function printSubmissionDetails(submission) {
    const timestamp = new Date(submission.timestamp).toLocaleString();
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Submission Details - ${submission.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          .details-section { margin-bottom: 20px; }
          .details-section h4 { border-bottom: 1px solid #eee; padding-bottom: 5px; }
          .signature-image { max-width: 300px; border: 1px solid #ddd; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          table, th, td { border: 1px solid #ddd; }
          th, td { padding: 8px; text-align: left; }
          th { background-color: #f8f8f8; }
          @media print { body { margin: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Submission Details</h2>
        </div>
        
        <div class="details-section">
          <h3>Basic Information</h3>
          <table>
            <tr><th>Student ID</th><td>${submission.studentId}</td></tr>
            <tr><th>Name</th><td>${submission.name}</td></tr>
            <tr><th>Class</th><td>${submission.class}</td></tr>
            <tr><th>Intention</th><td>${submission.intention}</td></tr>
            <tr><th>Reason</th><td>${submission.reason || 'None'}</td></tr>
            <tr><th>Submission Time</th><td>${timestamp}</td></tr>
          </table>
        </div>
        
        <div class="details-section">
          <h3>Parent Signature</h3>
          ${submission.signature ? 
            `<img src="${submission.signature}" alt="Parent Signature" class="signature-image">` : 
            '<p>No signature data available</p>'
          }
        </div>
        
        <div class="footer">
          <p>This details page was generated automatically - ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="no-print">
          <button onclick="window.print()">Print this page</button>
          <button onclick="window.close()">Close</button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Print after the content is loaded
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  // Filter functionality
  document.getElementById('submissionSearch').addEventListener('input', filterSubmissions);
  document.getElementById('filterYes').addEventListener('change', filterSubmissions);
  document.getElementById('filterNo').addEventListener('change', filterSubmissions);

  function filterSubmissions() {
    if (!window.allSubmissions) return;

    const searchTerm = document.getElementById('submissionSearch').value.toLowerCase();
    const filterYes = document.getElementById('filterYes').checked;
    const filterNo = document.getElementById('filterNo').checked;

    let filtered = window.allSubmissions;

    // Filter by intention
    if (filterYes && !filterNo) {
      filtered = filtered.filter(s => s.intention === '參加');
    } else if (!filterYes && filterNo) {
      filtered = filtered.filter(s => s.intention === '不參加');
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.studentId.toLowerCase().includes(searchTerm) ||
        s.name.toLowerCase().includes(searchTerm) ||
        s.class.toLowerCase().includes(searchTerm)
      );
    }

    populateSubmissionsTable(filtered);
  }

  // Export functionality
  document.getElementById('exportCSV').addEventListener('click', function() {
    if (!window.allSubmissions) return;

    let csvContent = "data:text/csv;charset=utf-8,\uFEFFStudent ID,Name,Class,Intention,Reason,Submission Time\n";

    window.allSubmissions.forEach(submission => {
      const timestamp = new Date(submission.timestamp).toLocaleString();
      const row = [
        submission.studentId,
        submission.name,
        submission.class,
        submission.intention,
        submission.reason || '',
        timestamp
      ].map(value => `"${value}"`).join(',');

      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = 'Submission Data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  function populateSubmissionsTable(submissions) {
    const tbody = document.getElementById('submissionsTable').querySelector('tbody');
    tbody.innerHTML = '';

    submissions.forEach(submission => {
      const row = document.createElement('tr');
      const timestamp = new Date(submission.timestamp);

      // Parse device info if it exists
      let deviceDetails = '';
      if (submission.deviceInfo && submission.deviceInfo !== 'Unknown') {
        try {
          const deviceData = JSON.parse(submission.deviceInfo);
          deviceDetails = `<div class="device-details">
            <span>${deviceData.platform || 'Unknown'}</span>
            <span>${deviceData.userAgent ? deviceData.userAgent.substring(0, 50) + '...' : 'Unknown'}</span>
          </div>`;
        } catch (e) {
          deviceDetails = submission.deviceInfo;
        }
      }

      row.innerHTML = `
        <td>${submission.studentId}</td>
        <td>${submission.name}</td>
        <td>${submission.class}</td>
        <td class="${submission.intention === '參加' ? 'intention-yes' : 'intention-no'}">${submission.intention}</td>
        <td>${submission.reason || '-'}</td>
        <td>${timestamp.toLocaleString()}</td>
        <td>${deviceDetails}</td>
      `;

      tbody.appendChild(row);
    });
  }

  const bulkExportBtn = document.getElementById('bulkExportBtn');
  const dataExportModal = document.getElementById('dataExportModal');
  const exportProgress = document.getElementById('exportProgress');

  // Export functionality for different formats
  if (bulkExportBtn) {
    bulkExportBtn.addEventListener('click', function() {
      dataExportModal.style.display = 'block';
    });
  }
  
  document.getElementById('downloadFullCSV').addEventListener('click', function() {
    exportProgress.style.display = 'block';
    const adminToken = localStorage.getItem('adminToken') || 'validAdminToken';
    
    window.location.href = `https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec?action=exportData&adminToken=${adminToken}`;
    
    setTimeout(() => {
      exportProgress.style.display = 'none';
      dataExportModal.style.display = 'none';
    }, 3000);
  });
  
  document.getElementById('exportJSON').addEventListener('click', function() {
    if (!window.allSubmissions) return;
    
    exportProgress.style.display = 'block';
    
    const jsonData = JSON.stringify(window.allSubmissions, null, 2);
    const blob = new Blob([jsonData], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Submission Data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      exportProgress.style.display = 'none';
      dataExportModal.style.display = 'none';
    }, 1000);
  });

  document.getElementById('exportSystemLog').addEventListener('click', function() {
    exportProgress.style.display = 'block';
    showAdminAlert('System log export feature will be available in the next version');
    exportProgress.style.display = 'none';
  });

  function updateSystemStatus() {
    fetch('https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec?action=getSettings')
      .then(response => response.json())
      .then(data => {
        const statusIndicator = document.getElementById('systemStatusIndicator');
        if (!statusIndicator) return;
        
        if (data && data.settings) {
          const now = new Date();
          const serverTime = data.settings.serverTime ? new Date(data.settings.serverTime) : now;
          const openTime = data.settings.openTime ? new Date(data.settings.openTime) : null;
          const closeTime = data.settings.closeTime ? new Date(data.settings.closeTime) : null;
          
          if (!openTime || !closeTime) {
            statusIndicator.className = 'system-status-indicator warning';
            statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            statusIndicator.title = 'System time not fully configured';
          } else if (serverTime < openTime) {
            statusIndicator.className = 'system-status-indicator inactive';
            statusIndicator.innerHTML = '<i class="fas fa-lock"></i>';
            statusIndicator.title = 'System not yet open';
          } else if (serverTime > closeTime) {
            statusIndicator.className = 'system-status-indicator inactive';
            statusIndicator.innerHTML = '<i class="fas fa-lock"></i>';
            statusIndicator.title = 'System closed';
          } else {
            statusIndicator.className = 'system-status-indicator active';
            statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
            statusIndicator.title = 'System open';
          }
        }
      })
      .catch(error => {
        console.error('Error fetching system status:', error);
      });
  }
  
  updateSystemStatus();
  setInterval(updateSystemStatus, 60000); // Check every minute

  // Initialize AOS
  AOS.init({
    duration: 800,
    easing: 'ease-out',
    once: false
  });
  
  function optimizeForMobile() {
    if (window.innerWidth <= 600) {
      // Limit table rows for better mobile performance
      document.querySelectorAll('.table-row-fade').forEach((row, index) => {
        if (index > 50) row.style.display = 'none';
      });
      
      // Simplify charts on mobile
      const chartContainers = document.querySelectorAll('.stats-chart-container');
      chartContainers.forEach(container => {
        container.classList.add('mobile-optimized');
      });
    }
  }
  
  window.addEventListener('resize', optimizeForMobile);
  optimizeForMobile();
});
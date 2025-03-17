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

    // Update server time display
    updateServerTime();
    
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
    btn.addEventListener('click', function() {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
      
      // Also close .confirm-modal if present
      const confirmModal = btn.closest('.confirm-modal');
      if (confirmModal) confirmModal.style.display = 'none';
    });
  });

  // Modal window click outside
  window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
    if (event.target.classList.contains('confirm-modal')) {
      event.target.style.display = 'none';
    }
  }

  // Modified modal close button function to ensure all close buttons work
  function ensureCloseButtonsWork() {
    document.querySelectorAll('.modal .close, .confirm-modal .close').forEach(btn => {
      // Remove existing event listeners to avoid duplicates
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add the click event listener
      newBtn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) modal.style.display = 'none';
        
        const confirmModal = this.closest('.confirm-modal');
        if (confirmModal) confirmModal.style.display = 'none';
      });
    });
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

  function fetchStatistics(forceRefresh = false) {
    const statsLoading = document.getElementById('statsLoading');
    const classStatsContainer = document.getElementById('classStatistics');
    const submissionsTable = document.getElementById('submissionsTable').querySelector('tbody');
    
    // Check if we have cached data that is still valid (unless forceRefresh is true)
    const now = Date.now();
    if (!forceRefresh && statsCache && (now - lastStatsFetch < CACHE_DURATION)) {
      displayStatistics(statsCache);
      return;
    }

    if (statsLoading) statsLoading.style.display = 'block';
    if (classStatsContainer) classStatsContainer.innerHTML = '';
    if (submissionsTable) submissionsTable.innerHTML = '';

    fetch('https://script.google.com/macros/s/AKfycbxCCH1cdUGSjPVnOPqyfyZ9yQ9eHmCp1Uc4J2hbt3aDwDTwOhUAlPf52gSZRfhrH4jbwg/exec?action=getAllSubmissions')
      .then(response => response.json())
      .then(data => {
        if (statsLoading) statsLoading.style.display = 'none';

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
        if (statsLoading) statsLoading.style.display = 'none';
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
    const participatePercent = totalSubmissions > 0 ? (totalParticipate / totalSubmissions * 100).toFixed(1) : '0.0';

    document.getElementById('statsTotalSubmissions').textContent = totalSubmissions;
    document.getElementById('statsParticipateCount').textContent = totalParticipate;
    document.getElementById('statsNotParticipateCount').textContent = totalNotParticipate;
    document.getElementById('statsParticipatePercent').textContent = `${participatePercent}%`;

    // Create overview chart
    createOverviewChart(totalParticipate, totalNotParticipate);
  
    // Create class stats cards with modern design
    const classStatsContainer = document.getElementById('classStatistics');
    classStatsContainer.innerHTML = '';
    
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

      classStatsContainer.appendChild(classCard);
    });

    // Create timeline chart
    createTimelineChart(data.submissions);
    
    // Populate submissions table with virtualization for performance
    virtualizedTableRender(data.submissions);
    
    // Call ensure close buttons work for any modals
    ensureCloseButtonsWork();
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
    let signatureVerificationHtml = '<p>無驗證資料</p>';
  
    if (submission.signatureVerified || submission.verificationData) {
      const verificationStatus = submission.signatureVerified === 'Verified' ? 
        '<span class="verification-status-verified">已驗證</span>' : 
        '<span class="verification-status-unverified">未驗證</span>';
      
      let verificationDetails = '無詳細驗證資料';
      
      if (submission.verificationData) {
        try {
          const verData = JSON.parse(submission.verificationData);
          verificationDetails = `
            <p><strong>簽名時間戳記:</strong> ${new Date(verData.timestamp).toLocaleString()}</p>
            <p><strong>提交時間:</strong> ${new Date(submission.timestamp).toLocaleString()}</p>
            <p><strong>簽名複雜度:</strong> ${verData.pathCount} 筆劃，共 ${verData.pathPoints} 點</p>
            <p><strong>生物特徵分數:</strong> <span class="biometric-score">${verData.biometricScore || 0}</span>/100</p>
            <p><strong>簽名ID:</strong> ${verData.signatureId || '未知'}</p>
            <p><strong>裝置類型:</strong> ${verData.deviceType || '未知'}</p>
            <p><strong>輸入方式:</strong> ${verData.pointerType || '未知'}</p>
            <p><strong>繪製速度:</strong> ${verData.drawingSpeed || '未知'}</p>
          `;
        } catch (e) {
          verificationDetails = submission.verificationData;
        }
      }
      
      signatureVerificationHtml = `
        <div class="details-section">
          <h4><i class="fas fa-shield-alt"></i> 簽名驗證</h4>
          <p><strong>狀態:</strong> ${verificationStatus}</p>
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
            <h4><i class="fas fa-laptop"></i> 裝置資訊</h4>
            <p><strong>平台:</strong> ${deviceData.platform || '未知'}</p>
            <p><strong>瀏覽器:</strong> ${deviceData.vendor || '未知'}</p>
            <p><strong>使用者代理:</strong> ${deviceData.userAgent || '未知'}</p>
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
            <h4><i class="fas fa-globe"></i> 瀏覽器資訊</h4>
            <p><strong>語言:</strong> ${browserData.language || '未知'}</p>
            <p><strong>Cookie 啟用:</strong> ${browserData.cookiesEnabled ? '是' : '否'}</p>
            <p><strong>請勿追蹤:</strong> ${browserData.doNotTrack || '未知'}</p>
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
            <h4><i class="fas fa-desktop"></i> 螢幕資訊</h4>
            <p><strong>解析度:</strong> ${screenData.width || 0} x ${screenData.height || 0}</p>
            <p><strong>色彩深度:</strong> ${screenData.colorDepth || '未知'}</p>
            <p><strong>像素比:</strong> ${screenData.pixelRatio || '未知'}</p>
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
      <h2><i class="fas fa-user-graduate"></i> 提交資料詳情: ${submission.name} (${submission.studentId})</h2>
      
      <div class="details-columns">
        <div class="details-column">
          <div class="details-section">
            <h4><i class="fas fa-info-circle"></i> 基本資訊</h4>
            <p><strong>學號:</strong> ${submission.studentId}</p>
            <p><strong>姓名:</strong> ${submission.name}</p>
            <p><strong>班級:</strong> ${submission.class}</p>
            <p><strong>意願:</strong> <span class="${submission.intention === '參加' ? 'intention-yes' : 'intention-no'}">${submission.intention}</span></p>
            <p><strong>理由:</strong> ${submission.reason || '無'}</p>
            <p><strong>提交時間:</strong> ${timestamp}</p>
          </div>
          
          ${deviceInfoHtml}
        </div>
        
        <div class="details-column">
          ${browserInfoHtml}
          ${screenInfoHtml}
          ${signatureVerificationHtml}
          
          <div class="details-section">
            <h4><i class="fas fa-signature"></i> 家長簽名</h4>
            ${submission.signature ? 
              `<div class="signature-container">
                <img src="${submission.signature}" alt="家長簽名" class="signature-image-preview">
              </div>` : 
              '<p>無簽名資料</p>'
            }
          </div>
        </div>
      </div>
      
      <div class="details-actions">
        <button id="printDetails" class="details-action-btn">
          <i class="fas fa-print"></i> 列印詳情
        </button>
        <button id="exportSignature" class="details-action-btn">
          <i class="fas fa-file-export"></i> 匯出簽名
        </button>
        <button id="verifySignature" class="details-action-btn">
          <i class="fas fa-shield-alt"></i> 驗證簽名
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
          showAdminAlert('無可用的簽名資料');
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
    ensureCloseButtonsWork();
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
    let verificationDetails = '<p>此簽名無可用的驗證資料。</p>';
    let verificationStatus = '<span class="verification-status-unknown">未知</span>';
    let biometricScore = 0;
    let signatureId = '';
    let signatureTiming = '';
    let drawingPatterns = '';

    if (submission.signatureVerified) {
      verificationStatus = submission.signatureVerified === 'Highly Verified' ? 
        '<span class="verification-status-high">高度驗證</span>' :
        (submission.signatureVerified === 'Verified' ? 
          '<span class="verification-status-verified">已驗證</span>' : 
          '<span class="verification-status-unverified">未驗證</span>');
    }

    if (submission.verificationData) {
      try {
        const verData = JSON.parse(submission.verificationData);
        biometricScore = verData.biometricScore || 0;
        signatureId = verData.signatureId || '未知';
        
        // Format drawing patterns information
        let patternsInfo = '';
        if (verData.drawingPatterns) {
          patternsInfo = `
            <p><strong>筆劃曲率:</strong> ${verData.drawingPatterns.strokeCurvature || '未知'}</p>
            <p><strong>平均壓力:</strong> ${verData.drawingPatterns.averagePressure || '未知'}</p>
          `;
        }
        
        verificationDetails = `
          <div class="verification-details">
            <p><strong>簽名建立時間:</strong> ${new Date(verData.timestamp).toLocaleString()}</p>
            <p><strong>提交時間:</strong> ${new Date(submission.timestamp).toLocaleString()}</p>
            <p><strong>簽名複雜度:</strong> ${verData.pathCount} 筆劃，共 ${verData.pathPoints} 點</p>
            <p><strong>生物特徵分數:</strong> <span class="biometric-score">${biometricScore}</span>/100</p>
            <p><strong>簽名ID:</strong> ${signatureId}</p>
            <p><strong>裝置類型:</strong> ${verData.deviceType || '未知'}</p>
            <p><strong>輸入方式:</strong> ${verData.pointerType || '未知'}</p>
            <p><strong>繪製速度:</strong> ${verData.drawingSpeed || '未知'}</p>
            ${patternsInfo}
          </div>
        `;
      } catch (e) {
        verificationDetails = `<p>原始驗證資料: ${submission.verificationData}</p>`;
      }
    }

    const modalContent = verificationModal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <span class="close">&times;</span>
      <h2><i class="fas fa-shield-alt"></i> 簽名驗證</h2>
      
      <div class="verification-summary">
        <h3>驗證狀態: ${verificationStatus}</h3>
        <p>學生: ${submission.name} (${submission.studentId})</p>
        <div class="biometric-gauge">
          <div class="biometric-gauge-bar" style="width: ${biometricScore}%;"></div>
          <span class="biometric-gauge-label">生物特徵分數: ${biometricScore}%</span>
        </div>
      </div>
      
      <div class="verification-info">
        <h3>驗證詳情</h3>
        ${verificationDetails}
      </div>
      
      <div class="verification-image">
        <h3>簽名圖片</h3>
        ${submission.signature ? 
          `<img src="${submission.signature}" alt="簽名" class="signature-preview">` : 
          '<p>無可用的簽名圖片</p>'
        }
      </div>
      
      <div class="verification-explanation">
        <h3><i class="fas fa-info-circle"></i> 驗證說明</h3>
        <p>系統透過分析簽名過程中的多項因素來驗證簽名真實性：</p>
        <ul>
          <li><strong>筆劃複雜度：</strong>真實簽名通常有足夠的複雜度和筆劃數量</li>
          <li><strong>時間戳記：</strong>確認簽名是在合理的時間內完成</li>
          <li><strong>生物特徵：</strong>分析手寫的自然變化、壓力、速度等特徵</li>
          <li><strong>裝置資訊：</strong>確認簽名是使用合理的裝置和輸入方式完成</li>
        </ul>
        <p>生物特徵分數70分以上視為高度可信的簽名</p>
      </div>
    `;

    // Add custom styling for biometric gauge
    const style = document.createElement('style');
    style.textContent = `
      .biometric-gauge {
        width: 100%;
        height: 20px;
        background-color: #f0f0f0;
        border-radius: 10px;
        margin-top: 10px;
        position: relative;
        overflow: hidden;
      }
      .biometric-gauge-bar {
        height: 100%;
        background: linear-gradient(90deg, #ff4e50, #f9d423 50%, #4cb8c4);
        border-radius: 10px;
        transition: width 1s ease-out;
      }
      .biometric-gauge-label {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        text-align: center;
        line-height: 20px;
        font-weight: bold;
        color: #333;
        text-shadow: 0 0 2px rgba(255,255,255,0.7);
      }
      .verification-status-high {
        background-color: #2ecc71;
        color: white;
        font-weight: bold;
        padding: 3px 10px;
        border-radius: 4px;
        display: inline-block;
      }
      .verification-explanation {
        background-color: #f8f9fa;
        border-radius: 10px;
        padding: 15px;
        margin-top: 20px;
        border-left: 3px solid var(--primary-color);
      }
    `;
    document.head.appendChild(style);

    verificationModal.style.display = 'block';
    ensureCloseButtonsWork();
  }

  function printSubmissionDetails(submission) {
    const timestamp = new Date(submission.timestamp).toLocaleString();
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>提交詳情 - ${submission.name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #000;
            line-height: 1.5;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #000; 
            padding-bottom: 15px; 
          }
          .header h1 {
            font-size: 24pt;
            margin-bottom: 5px;
          }
          .header p {
            font-size: 11pt;
            color: #555;
            margin-top: 0;
          }
          .details-section { 
            margin-bottom: 25px; 
            page-break-inside: avoid;
          }
          .details-section h3 { 
            border-bottom: 1px solid #000; 
            padding-bottom: 8px; 
            font-size: 14pt;
            margin-top: 25px;
            margin-bottom: 15px;
          }
          .signature-image { 
            max-width: 300px; 
            border: 1px solid #000; 
            margin: 15px 0;
            padding: 10px;
            background: #fff;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            font-size: 10pt; 
            color: #555; 
            border-top: 1px solid #000; 
            padding-top: 15px; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0; 
            page-break-inside: avoid;
          }
          table, th, td { 
            border: 1px solid #000; 
          }
          th { 
            padding: 12px 8px; 
            text-align: left; 
            background-color: #f0f0f0; 
            font-weight: bold;
          }
          td { 
            padding: 10px 8px; 
            text-align: left; 
          }
          @media print { 
            body { margin: 0; } 
            .no-print { display: none; } 
            table { page-break-inside: avoid; }
            h1, h2, h3, h4 { page-break-after: avoid; }
          }
          .signature-container {
            border: 1px solid #000;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            background: #fff;
          }
          .info-box {
            background: #f9f9f9;
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 20px;
          }
          .student-info {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 20px;
          }
          .student-info div {
            flex: 1;
            min-width: 200px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>第八節意願調查詳情</h1>
          <p>學生：${submission.name} (${submission.studentId}) - ${submission.class}</p>
        </div>
        
        <div class="details-section">
          <h3>基本資訊</h3>
          <div class="student-info">
            <div>
              <p><strong>學號：</strong> ${submission.studentId}</p>
              <p><strong>姓名：</strong> ${submission.name}</p>
              <p><strong>班級：</strong> ${submission.class}</p>
            </div>
            <div>
              <p><strong>意願：</strong> ${submission.intention}</p>
              <p><strong>提交時間：</strong> ${timestamp}</p>
              ${submission.reason ? `<p><strong>原因：</strong> ${submission.reason}</p>` : ''}
            </div>
          </div>
        </div>
        
        <div class="details-section">
          <h3>家長簽名</h3>
          ${submission.signature ? 
            `<div class="signature-container">
              <img src="${submission.signature}" alt="家長簽名" class="signature-image">
            </div>` : 
            '<p>無可用的簽名資料</p>'
          }
        </div>
        
        <div class="details-section">
          <h3>簽名驗證資訊</h3>
          <div class="info-box">
            <p><strong>驗證狀態：</strong> ${submission.signatureVerified || '未知'}</p>
            ${submission.verificationData ? 
              `<p><strong>簽名時間：</strong> ${new Date(JSON.parse(submission.verificationData).timestamp || '').toLocaleString()}</p>` : 
              ''
            }
          </div>
        </div>
        
        <div class="footer">
          <p>此詳情頁面由系統自動生成 - ${new Date().toLocaleString()}</p>
          <p>第八節意願調查系統  ${new Date().getFullYear()}</p>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #4a90e2; color: white; border: none; border-radius: 4px; font-size: 16px;">列印此頁面</button>
          <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer; background: #f0f0f0; color: #333; border: none; border-radius: 4px; font-size: 16px; margin-left: 10px;">關閉</button>
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

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF學號,姓名,班級,意願,理由,提交時間\n";

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
    link.download = '調查資料.csv';
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
    link.download = '調查資料.json';
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
    showAdminAlert('系統日誌匯出功能將在下一個版本中提供');
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
    disable: true
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

  // Add server time updating function
  function updateServerTime() {
    const serverTimeElement = document.getElementById('serverTime');
    if (serverTimeElement) {
      const now = new Date();
      serverTimeElement.innerHTML = `<i class="fas fa-clock"></i> ${now.toLocaleString()}`;
      
      // Update every minute
      setTimeout(updateServerTime, 60000);
    }
  }

  // Add event listener for the new refresh button
  const refreshStatsBtn = document.getElementById('refreshStats');
  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', function() {
      fetchStatistics(true); // Force refresh
    });
  }
  
  // Add export class summary button functionality
  const exportClassSummaryBtn = document.getElementById('exportClassSummary');
  if (exportClassSummaryBtn) {
    exportClassSummaryBtn.addEventListener('click', function() {
      exportClassSummaryReport();
    });
  }
  
  // Initialize new tabs
  const newTabs = document.querySelectorAll('.admin-tab');
  if (newTabs.length > 0) {
    newTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        newTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetTab = document.getElementById(tab.dataset.tab);
        if (targetTab) {
          targetTab.classList.add('active');
          
          if (tab.dataset.tab === 'statsTab') {
            fetchStatistics();
          }
        }
      });
    });
  }

  // Add function to export class summary
  function exportClassSummaryReport() {
    if (!window.allSubmissions) {
      showAdminAlert('無可用資料，請先載入統計資料');
      return;
    }
    
    const exportProgress = document.getElementById('exportProgress');
    exportProgress.style.display = 'block';
    
    // Process class statistics
    const classTotals = {};
    window.allSubmissions.forEach(submission => {
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
    
    // Generate CSV
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF班級,總人數,參加人數,不參加人數,參加率\n";
    Object.keys(classTotals).sort().forEach(className => {
      const stats = classTotals[className];
      const participatePercent = (stats.participate / stats.total * 100).toFixed(1);
      
      const row = [
        className,
        stats.total,
        stats.participate,
        stats.notParticipate,
        `${participatePercent}%`
      ].join(',');
      
      csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = '班級統計報表.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      exportProgress.style.display = 'none';
    }, 1000);
  }
});
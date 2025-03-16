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

  // Check if admin is already logged in
  if (localStorage.getItem('adminLoggedIn') === 'true') {
    showAdminSection();
  }

  // Login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      // Check if Turnstile token is valid
      const token = turnstile.getResponse();
      if (!token) {
        loginResult.textContent = '請完成人機驗證';
        loginResult.className = 'error';
        loginResult.style.display = 'block';
        return;
      }

      loginLoading.style.display = 'block';
      loginResult.style.display = 'none';

      // Use server-side authentication
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec';
      
      fetch(`${scriptUrl}?action=adminLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&token=${encodeURIComponent(token)}`)
        .then(response => response.json())
        .then(data => {
          loginLoading.style.display = 'none';
          
          if (data.success) {
            loginResult.textContent = '登入成功，正在進入管理系統...';
            loginResult.className = 'success';
            loginResult.style.display = 'block';

            // Save login state
            localStorage.setItem('adminLoggedIn', 'true');

            // Show admin section after a brief delay
            setTimeout(() => {
              showAdminSection();
            }, 1000);
          } else {
            loginResult.textContent = '帳號或密碼錯誤，請重試';
            loginResult.className = 'error';
            loginResult.style.display = 'block';
          }
        })
        .catch(error => {
          loginLoading.style.display = 'none';
          loginResult.textContent = '登入失敗，請稍後再試';
          loginResult.className = 'error';
          loginResult.style.display = 'block';
          console.error('Error:', error);
        });
    });
  }

  function showAdminSection() {
    if (loginSection) loginSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'block';

    // Fetch settings and stats after showing admin section
    fetchCurrentSettings();
  }

  // Logout functionality
  window.logoutAdmin = function() {
    localStorage.removeItem('adminLoggedIn');
    if (loginSection) loginSection.style.display = 'block';
    if (adminSection) adminSection.style.display = 'none';
  }

  // Add logout button to UI
  const container = document.querySelector('.container');
  if (container && !document.querySelector('.logout-button')) {
    const logoutButton = document.createElement('button');
    logoutButton.className = 'logout-button';
    logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> 登出';
    logoutButton.onclick = logoutAdmin;

    // Insert before the return button
    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
      container.insertBefore(logoutButton, returnButton);
    } else {
      container.appendChild(logoutButton);
    }
  }

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

    // Add animation class for new rows
    row.classList.add('table-row-fade');
    
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

    // Trigger animation with staggered delay
    setTimeout(() => {
      row.classList.add('visible');
    }, 20 * index);
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

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF學號,姓名,班級,意願,原因,提交時間\n";

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
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "第八節意願調查資料.csv");
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

      // Add animation class for new rows
      row.classList.add('table-row-fade');

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

      // Trigger animation by adding the visible class after a small delay
      setTimeout(() => {
        row.classList.add('visible');
      }, 50 * tbody.children.length);
    });
  }
});
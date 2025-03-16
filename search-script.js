document.addEventListener('DOMContentLoaded', function() {
  const searchForm = document.getElementById('searchForm');
  const searchTypeInputs = document.querySelectorAll('input[name="searchType"]');
  const studentSearchDiv = document.getElementById('studentSearch');
  const classSearchDiv = document.getElementById('classSearch');
  const searchLoading = document.getElementById('searchLoading');
  const searchResults = document.getElementById('searchResults');
  const closeBtns = document.getElementsByClassName('close');
  const searchAlertModal = document.getElementById('searchAlertModal');
  let searchCache = {};

  // Toggle search type
  searchTypeInputs.forEach(input => {
    input.addEventListener('change', function() {
      if (this.value === 'student') {
        studentSearchDiv.style.display = 'block';
        classSearchDiv.style.display = 'none';
        document.getElementById('searchStudentId').focus();
      } else {
        studentSearchDiv.style.display = 'none';
        classSearchDiv.style.display = 'block';
        document.getElementById('searchClass').focus();
      }
      
      // Force reset the Turnstile widget
      if (typeof turnstile !== 'undefined') {
        turnstile.reset();
        // Wait for DOM to update before getting new token
        setTimeout(() => {
          try {
            turnstile.render('.cf-turnstile', {
              sitekey: '0x4AAAAAABA6Z9ZJMniYyMes',
              refresh_expired: 'auto'
            });
          } catch (e) {
            console.error('Error refreshing Turnstile:', e);
          }
        }, 100);
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

  // Search form submission
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const searchType = document.querySelector('input[name="searchType"]:checked').value;
    let searchValue = '';
    
    if (searchType === 'student') {
      searchValue = document.getElementById('searchStudentId').value.trim();
      if (!searchValue) {
        showSearchAlert('請輸入學號進行查詢');
        return;
      }
    } else {
      searchValue = document.getElementById('searchClass').value.trim();
      if (!searchValue) {
        showSearchAlert('請輸入班級進行查詢');
        return;
      }
    }
    
    // Check if Turnstile token is valid
    const token = turnstile.getResponse();
    if (!token) {
      showSearchAlert('請完成人機驗證');
      return;
    }
    
    performSearch(searchType, searchValue, token);
  });

  function performSearch(type, value, token) {
    // Check cache first
    const cacheKey = `${type}:${value}`;
    if (searchCache[cacheKey] && Date.now() - searchCache[cacheKey].timestamp < 300000) { // 5 minute cache
      displaySearchResults(searchCache[cacheKey].data, type);
      return;
    }
    
    // Show loading
    searchLoading.style.display = 'block';
    searchResults.innerHTML = '';
    
    // The API URL should be updated to the actual endpoint
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec';
    
    // Prepare query parameters
    const params = new URLSearchParams();
    params.append('action', 'search');
    params.append('searchType', type);
    params.append('searchValue', value.toString()); 
    params.append('token', token);
    
    fetch(`${scriptUrl}?${params.toString()}`)
      .then(response => response.json())
      .then(data => {
        searchLoading.style.display = 'none';
        
        if (data.success) {
          // Cache the results
          searchCache[cacheKey] = {
            data: data,
            timestamp: Date.now()
          };
          displaySearchResults(data, type);
        } else {
          showSearchAlert(data.message || '查詢失敗，請稍後再試');
        }
      })
      .catch(error => {
        searchLoading.style.display = 'none';
        showSearchAlert('查詢時發生錯誤，請稍後再試');
        console.error('Error:', error);
      });
  }

  function displaySearchResults(data, type) {
    if (type === 'student') {
      // Display student result
      if (data.results && data.results.length > 0) {
        const student = data.results[0];
        const timestamp = student.timestamp || '無記錄';
        searchResults.innerHTML = `
          <div class="result-item">
            <h3><i class="fas fa-user-graduate"></i> 學生資料</h3>
            <div class="result-details">
              <p><i class="fas fa-id-card"></i> 學號：${student.studentId}</p>
              <p><i class="fas fa-user"></i> 姓名：${student.name}</p>
              <p><i class="fas fa-chalkboard-teacher"></i> 班級：${student.class}</p>
              <p><i class="fas fa-check-circle"></i> 意願：
                <span class="${student.intention === '參加' ? 'intention-yes' : 'intention-no'}">
                  ${student.intention}
                </span>
              </p>
            </div>
            ${student.intention === '不參加' && student.reason ? 
              `<div class="result-reason">
                <p><i class="fas fa-comment-alt"></i> 不參加原因：${student.reason}</p>
              </div>` : ''
            }
            <p><i class="fas fa-signature"></i> 家長簽名：</p>
            <img src="${student.signature}" alt="家長簽名" class="signature-image">
            <p><i class="fas fa-calendar-alt"></i> 提交時間：${timestamp}</p>
            <button class="print-button" onclick="printStudentResult()"><i class="fas fa-print"></i> 列印查詢結果</button>
            
            <div class="print-content" style="display: none;">
              <div class="print-header">
                <h2>第八節意願調查查詢結果</h2>
              </div>
              <p>學號：${student.studentId}</p>
              <p>姓名：${student.name}</p>
              <p>班級：${student.class}</p>
              <p>第八節意願：${student.intention}</p>
              ${student.intention === '不參加' && student.reason ? `<p>不參加原因：${student.reason}</p>` : ''}
              <p>家長簽名：</p>
              <img src="${student.signature}" alt="家長簽名" class="signature-image">
              <p>提交時間：${timestamp}</p>
              <div class="print-footer">
                <p>此查詢結果由系統自動生成 - ${new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        `;
      } else {
        searchResults.innerHTML = `
          <div class="not-found">
            <i class="fas fa-search"></i>
            <p>未找到相關學生記錄</p>
          </div>
        `;
      }
    } else {
      // Display class results
      if (data.results && data.results.length > 0) {
        const className = data.results[0].class;
        const totalStudents = data.results.length;
        const participateCount = data.results.filter(s => s.intention === '參加').length;
        const notParticipateCount = totalStudents - participateCount;
        
        let resultsHTML = `
          <div class="class-summary">
            <h3><i class="fas fa-chalkboard-teacher"></i> ${className} 班級統計</h3>
            <div class="stats-container">
              <div class="stat-box yes">
                <h4>參加人數</h4>
                <div class="stat-number">${participateCount}</div>
              </div>
              <div class="stat-box no">
                <h4>不參加人數</h4>
                <div class="stat-number">${notParticipateCount}</div>
              </div>
            </div>
          </div>
          <button class="print-button" onclick="printClassResults()"><i class="fas fa-print"></i> 列印班級統計</button>
          
          <div class="print-content" style="display: none;">
            <div class="print-header">
              <h2>${className} 班級第八節意願調查統計</h2>
            </div>
            <p>總填寫人數：${totalStudents}人</p>
            <p>參加人數：${participateCount}人</p>
            <p>不參加人數：${notParticipateCount}人</p>
            <p>參加率：${(participateCount / totalStudents * 100).toFixed(1)}%</p>
            <h3>學生明細</h3>
          </div>
        `;
        
        data.results.forEach(student => {
          resultsHTML += `
            <div class="result-item">
              <h3>${student.name} (${student.studentId})</h3>
              <div class="result-details">
                <p><i class="fas fa-check-circle"></i> 意願：
                  <span class="${student.intention === '參加' ? 'intention-yes' : 'intention-no'}">
                    ${student.intention}
                  </span>
                </p>
                ${student.intention === '不參加' && student.reason ? 
                  `<p><i class="fas fa-comment-alt"></i> 原因：${student.reason}</p>` : ''
                }
              </div>
            </div>
          `;
          
          // Add to print content
          resultsHTML += `
            <div class="print-content" style="display: none;">
              <p>學號：${student.studentId} | 姓名：${student.name} | 意願：${student.intention}</p>
              ${student.intention === '不參加' && student.reason ? `<p>不參加原因：${student.reason}</p>` : ''}
            </div>
          `;
        });
        
        resultsHTML += `
          <div class="print-content" style="display: none;">
            <div class="print-footer">
              <p>此班級統計由系統自動生成 - ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `;
        
        searchResults.innerHTML = resultsHTML;
      } else {
        searchResults.innerHTML = `
          <div class="not-found">
            <i class="fas fa-users"></i>
            <p>未找到相關班級記錄</p>
          </div>
        `;
      }
    }
  }

  function populateSubmissionsTable(submissions) {
    // No implementation provided in the plan
  }

  function showSearchAlert(message) {
    const alertMessage = document.getElementById('searchAlertMessage');
    alertMessage.textContent = message;
    searchAlertModal.style.display = 'block';
  }

  // Add print functions
  function printStudentResult() {
    // Make sure content is visible before printing
    const printContent = document.querySelector('.print-content');
    if (printContent) {
      printContent.style.display = 'block';
    }
    
    // Add today's date to the print header
    const printDate = new Date().toLocaleDateString();
    const printTimeElement = document.querySelector('.print-content .print-footer p');
    if (printTimeElement) {
      printTimeElement.textContent = `此查詢結果由系統自動生成 - ${printDate}`;
    }
    
    // Add a small delay to ensure the print content is ready
    setTimeout(() => {
      window.print();
    }, 300);
  }

  function printClassResults() {
    // Make sure all print content is visible before printing
    const printContents = document.querySelectorAll('.print-content');
    printContents.forEach(content => {
      content.style.display = 'block';
    });
    
    // Add a small delay to ensure the print content is ready
    setTimeout(() => {
      window.print();
    }, 300);
  }

  // Make the print functions global
  window.printStudentResult = printStudentResult;
  window.printClassResults = printClassResults;

  // Help modal functionality
  const helpButton = document.getElementById('helpButton');
  const helpModal = document.getElementById('helpModal');

  if (helpButton && helpModal) {
    helpButton.addEventListener('click', function() {
      helpModal.style.display = 'block';
      
      // Add entrance animation to help sections
      const helpSections = document.querySelectorAll('.help-section');
      helpSections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        setTimeout(() => {
          section.style.transition = 'all 0.5s ease';
          section.style.opacity = '1';
          section.style.transform = 'translateY(0)';
        }, 100 * (index + 1));
      });
    });
  }

  // Display system times when page loads
  function displaySystemTimes() {
    fetch('https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec?action=getSettings')
      .then(response => response.json())
      .then(data => {
        if (data && data.settings) {
          const openTime = data.settings.openTime ? new Date(data.settings.openTime) : null;
          const closeTime = data.settings.closeTime ? new Date(data.settings.closeTime) : null;
          const serverTime = data.settings.serverTime ? new Date(data.settings.serverTime) : new Date();
          
          // Display system times at the top
          const systemTimesDiv = document.createElement('div');
          systemTimesDiv.className = 'system-times';
          systemTimesDiv.innerHTML = `
            <p><i class="fas fa-clock"></i> 系統時間：${serverTime.toLocaleString()}</p>
            <p><i class="fas fa-door-open"></i> 開放時間：${openTime ? openTime.toLocaleString() : '未設定'}</p>
            <p><i class="fas fa-door-closed"></i> 關閉時間：${closeTime ? closeTime.toLocaleString() : '未設定'}</p>
          `;
          
          // Insert system times at the top of the form
          const container = document.querySelector('.container');
          const searchForm = document.getElementById('searchForm');
          if (container && searchForm && !document.querySelector('.system-times')) {
            container.insertBefore(systemTimesDiv, searchForm);
          }
        }
      })
      .catch(error => {
        console.error('Error fetching system settings:', error);
      });
  }
  
  // Call the function when page loads
  displaySystemTimes();
});
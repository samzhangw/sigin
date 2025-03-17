document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const loginSection = document.getElementById('loginSection');
  const teacherDashboard = document.getElementById('teacherDashboard');
  const loginLoading = document.getElementById('loginLoading');
  const loginResult = document.getElementById('loginResult');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const rememberMeCheckbox = document.getElementById('rememberMe');
  const forgotPasswordLink = document.getElementById('forgotPassword');
  const alertModal = document.getElementById('alertModal');
  const alertMessage = document.getElementById('alertMessage');
  const closeBtns = document.getElementsByClassName('close');
  
  // Script URL
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbxCCH1cdUGSjPVnOPqyfyZ9yQ9eHmCp1Uc4J2hbt3aDwDTwOhUAlPf52gSZRfhrH4jbwg/exec';
  
  // Current teacher data
  let currentTeacher = null;
  
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
      showAlert('請聯繫系統管理員重設密碼');
    });
  }
  
  // Check saved credentials
  function checkSavedCredentials() {
    const savedUsername = localStorage.getItem('teacherUsername');
    const savedRememberMe = localStorage.getItem('teacherRememberMe') === 'true';
    
    if (savedUsername && savedRememberMe) {
      document.getElementById('username').value = savedUsername;
      document.getElementById('rememberMe').checked = true;
    }
  }
  
  // Auto-check for saved credentials on page load
  checkSavedCredentials();
  
  // Check if teacher is already logged in with a valid session
  function checkTeacherSession() {
    const teacherSession = sessionStorage.getItem('teacherSession');
    const sessionExpiry = sessionStorage.getItem('teacherSessionExpiry');
    
    if (teacherSession && sessionExpiry && new Date().getTime() < parseInt(sessionExpiry)) {
      // Session is still valid
      try {
        currentTeacher = JSON.parse(teacherSession);
        showTeacherDashboard();
        return true;
      } catch (e) {
        console.error('Error parsing teacher session:', e);
      }
    } else if (teacherSession) {
      // Session expired
      sessionStorage.removeItem('teacherSession');
      sessionStorage.removeItem('teacherSessionExpiry');
      showLoginMessage('登入階段已過期，請重新登入', 'error');
    }
    
    return false;
  }
  
  // Check for active teacher session
  if (checkTeacherSession()) {
    showTeacherDashboard();
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
      
      // Make actual server request for teacher login
      fetch(`${scriptUrl}?action=teacherAccount&action=teacherLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&token=${encodeURIComponent(token)}`)
        .then(response => response.json())
        .catch(() => ({ success: false, message: '連線失敗' }))
        .then(data => {
          loginLoading.style.display = 'none';
          
          if (data.success) {
            // Save credentials if remember me is checked
            if (rememberMe) {
              localStorage.setItem('teacherUsername', username);
              localStorage.setItem('teacherRememberMe', 'true');
            } else {
              localStorage.removeItem('teacherUsername');
              localStorage.removeItem('teacherRememberMe');
            }
            
            // Set teacher data
            currentTeacher = data.teacher;
            
            // Set session storage with expiry (1 hour)
            sessionStorage.setItem('teacherSession', JSON.stringify(currentTeacher));
            sessionStorage.setItem('teacherSessionExpiry', (new Date().getTime() + 3600000).toString());
            
            showLoginMessage('登入成功，正在進入導師系統...', 'success');
            
            // Show teacher dashboard after a brief delay
            setTimeout(() => {
              showTeacherDashboard();
            }, 1000);
          } else {
            showLoginMessage(data.message || '帳號或密碼錯誤，請重試', 'error');
            loginForm.classList.add('shakeError');
            setTimeout(() => loginForm.classList.remove('shakeError'), 500);
          }
        });
    });
  }
  
  // Show login message
  function showLoginMessage(message, type) {
    loginResult.textContent = message;
    loginResult.className = type;
    loginResult.style.display = 'block';
  }
  
  // Show teacher dashboard
  function showTeacherDashboard() {
    if (loginSection) loginSection.style.display = 'none';
    if (teacherDashboard) teacherDashboard.style.display = 'block';
    
    // Update class title
    const classTitle = document.getElementById('classTitle');
    if (classTitle && currentTeacher) {
      classTitle.textContent = `${currentTeacher.class} 班級填寫狀況`;
    }
    
    // Update server time
    updateServerTime();
    
    // Fetch class statistics
    fetchClassStatistics(currentTeacher.class);
  }
  
  // Update server time
  function updateServerTime() {
    const serverTimeElement = document.getElementById('serverTime');
    if (serverTimeElement) {
      const now = new Date();
      serverTimeElement.innerHTML = `<i class="fas fa-clock"></i> ${now.toLocaleString()}`;
      
      // Update every minute
      setTimeout(updateServerTime, 60000);
    }
  }
  
  // Fetch class statistics
  function fetchClassStatistics(classId) {
    const classStats = document.getElementById('classStats');
    const studentListTable = document.getElementById('studentListTable').querySelector('tbody');
    
    // Show loading
    classStats.innerHTML = '<div class="loading-container" style="display:block"><div class="spinner"></div><p>載入中，請稍候...</p></div>';
    studentListTable.innerHTML = '';
    
    // Fetch actual data from server
    fetch(`${scriptUrl}?action=search&searchType=class&searchValue=${encodeURIComponent(classId)}`)
      .then(response => response.json())
      .catch(() => ({ success: false, results: [] }))
      .then(data => {
        if (data.success && data.results && data.results.length > 0) {
          // Process the real data
          const classData = {
            className: classId,
            totalStudents: data.results.length,
            responded: data.results.length,
            notResponded: 0, // We can't know this from search results
            participating: data.results.filter(s => s.intention === '參加').length,
            notParticipating: data.results.filter(s => s.intention === '不參加').length,
            students: data.results
          };
          
          // Display class statistics
          displayClassStatistics(classData);
          
          // Populate student list with real data
          populateStudentList(classData.students);
        } else {
          // No data or error
          classStats.innerHTML = `
            <div class="no-data-message">
              <i class="fas fa-info-circle"></i>
              <p>尚未有學生提交資料，或班級資料不存在</p>
            </div>
          `;
          studentListTable.innerHTML = '';
        }
      });
  }
  
  // Display class statistics
  function displayClassStatistics(classData) {
    const classStats = document.getElementById('classStats');
    
    // Calculate percentage
    const responseRate = Math.round((classData.responded / classData.totalStudents) * 100);
    const participateRate = Math.round((classData.participating / classData.responded) * 100);
    
    classStats.innerHTML = `
      <div class="class-summary">
        <div class="stats-overview">
          <div class="stat-item">
            <div class="stat-number">${classData.totalStudents}</div>
            <div class="stat-label">班級總人數</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${classData.responded}</div>
            <div class="stat-label">已填寫人數</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${classData.notResponded}</div>
            <div class="stat-label">未填寫人數</div>
          </div>
        </div>
        
        <div class="progress-container">
          <p>填寫率: ${responseRate}%</p>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${responseRate}%"></div>
          </div>
        </div>
        
        <div class="stats-overview">
          <div class="stat-item yes">
            <div class="stat-number">${classData.participating}</div>
            <div class="stat-label">參加人數</div>
          </div>
          <div class="stat-item no">
            <div class="stat-number">${classData.notParticipating}</div>
            <div class="stat-label">不參加人數</div>
          </div>
        </div>
        
        <div class="progress-container">
          <p>參加率: ${participateRate}%</p>
          <div class="progress-bar-container">
            <div class="progress-bar yes-bar" style="width: ${participateRate}%"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Populate student list with enhanced info
  function populateStudentList(students) {
    const studentListTable = document.getElementById('studentListTable').querySelector('tbody');
    studentListTable.innerHTML = '';
    
    if (!students || students.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="6" class="no-data-message">
          <i class="fas fa-info-circle"></i> 尚未有學生提交資料
        </td>
      `;
      studentListTable.appendChild(emptyRow);
      return;
    }
    
    // Sort students by student ID
    students.sort((a, b) => a.studentId.localeCompare(b.studentId));
    
    students.forEach(student => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${student.studentId || '-'}</td>
        <td>${student.name || '-'}</td>
        <td>${student.intention ? 
          `<span class="${student.intention === '參加' ? 'intention-yes' : 'intention-no'}">${student.intention}</span>` : 
          '<span class="not-submitted">未提交</span>'}</td>
        <td>${student.reason || '-'}</td>
        <td>${student.timestamp ? new Date(student.timestamp).toLocaleString() : '-'}</td>
        <td>
          <button class="view-details-btn" data-student-id="${student.studentId}">
            <i class="fas fa-info-circle"></i> 詳情
          </button>
          <button class="send-reminder-btn" data-student-id="${student.studentId}" data-student-name="${student.name}">
            <i class="fas fa-bell"></i> 提醒
          </button>
        </td>
      `;
      
      studentListTable.appendChild(row);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.view-details-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const studentId = this.getAttribute('data-student-id');
        showStudentDetails(studentId, students);
      });
    });
    
    document.querySelectorAll('.send-reminder-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const studentId = this.getAttribute('data-student-id');
        const studentName = this.getAttribute('data-student-name');
        sendReminder(studentId, studentName);
      });
    });
  }
  
  // Show student details from actual data
  function showStudentDetails(studentId, students) {
    const studentDetailModal = document.getElementById('studentDetailModal');
    const studentDetailContent = document.getElementById('studentDetailContent');
    
    // Show loading
    studentDetailContent.innerHTML = '<div class="loading-container" style="display:block"><div class="spinner"></div><p>載入中，請稍候...</p></div>';
    studentDetailModal.style.display = 'block';
    
    // Find student in the students array
    const student = students.find(s => s.studentId === studentId);
    
    if (student) {
      setTimeout(() => {
        studentDetailContent.innerHTML = `
          <div class="student-details">
            <div class="student-basic-info">
              <p><strong><i class="fas fa-id-card"></i> 學號：</strong>${student.studentId}</p>
              <p><strong><i class="fas fa-user"></i> 姓名：</strong>${student.name}</p>
              <p><strong><i class="fas fa-chalkboard-teacher"></i> 班級：</strong>${student.class}</p>
              <p><strong><i class="fas fa-check-circle"></i> 意願：</strong>
                <span class="${student.intention === '參加' ? 'intention-yes' : 'intention-no'}">
                  ${student.intention}
                </span>
              </p>
              ${student.reason ? 
                `<p><strong><i class="fas fa-comment-alt"></i> 不參加原因：</strong>${student.reason}</p>` : 
                ''}
              <p><strong><i class="fas fa-calendar-alt"></i> 提交時間：</strong>${new Date(student.timestamp).toLocaleString()}</p>
            </div>
            
            <div class="signature-section">
              <p><strong><i class="fas fa-signature"></i> 家長簽名：</strong></p>
              <img src="${student.signature}" alt="家長簽名" class="signature-image">
            </div>
            
            <div class="action-buttons">
              <button id="printStudentDetail" class="print-btn">
                <i class="fas fa-print"></i> 列印資料
              </button>
              <button id="contactParent" class="export-btn">
                <i class="fas fa-envelope"></i> 聯絡家長
              </button>
            </div>
          </div>
        `;
        
        // Add event listeners to buttons
        document.getElementById('printStudentDetail').addEventListener('click', function() {
          printStudentDetail(student);
        });
        
        document.getElementById('contactParent').addEventListener('click', function() {
          contactParent(student);
        });
      }, 500);
    } else {
      studentDetailContent.innerHTML = `
        <div class="not-found">
          <i class="fas fa-exclamation-circle"></i>
          <p>找不到學生資料</p>
        </div>
      `;
    }
  }
  
  // Send reminder to student
  function sendReminder(studentId, studentName) {
    // Show sending indicator
    showAlert(`正在發送提醒給 ${studentName}...`);
    
    // Record the reminder in a Google Sheet through the Apps Script
    fetch(`${scriptUrl}?action=sendReminder&teacherId=${currentTeacher.id}&teacherName=${currentTeacher.name}&studentId=${studentId}&studentName=${studentName}`)
      .then(response => response.json())
      .catch(() => ({ success: false }))
      .then(data => {
        if (data && data.success) {
          showAlert(`已成功發送提醒給 ${studentName}，請學生儘速完成填寫`);
        } else {
          showAlert(`發送提醒時發生錯誤，請稍後再試`);
        }
      });
  }
  
  // Contact parent function
  function contactParent(student) {
    // Create a modal for contacting parents
    const contactModal = document.createElement('div');
    contactModal.className = 'modal';
    contactModal.id = 'contactParentModal';
    
    contactModal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2><i class="fas fa-envelope"></i> 聯絡家長</h2>
        <form id="contactParentForm">
          <label for="contactSubject"><i class="fas fa-heading"></i> 主旨：</label>
          <input type="text" id="contactSubject" value="關於第八節課程的重要通知" required>
          
          <label for="contactMessage"><i class="fas fa-comment"></i> 訊息：</label>
          <textarea id="contactMessage" rows="6" required>尊敬的家長您好，

貴子弟 ${student.name} (${student.class}班) 已於 ${new Date(student.timestamp).toLocaleDateString()} 填寫了第八節意願調查，選擇「${student.intention}」。

若有任何問題，請隨時與班導師聯繫。

${currentTeacher.name} 敬上</textarea>
          
          <button type="submit"><i class="fas fa-paper-plane"></i> 發送</button>
        </form>
      </div>
    `;
    
    document.body.appendChild(contactModal);
    
    // Show the modal
    contactModal.style.display = 'block';
    
    // Close button event
    const closeBtn = contactModal.querySelector('.close');
    closeBtn.onclick = function() {
      contactModal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(contactModal);
      }, 300);
    };
    
    // Window click event
    window.onclick = function(event) {
      if (event.target === contactModal) {
        contactModal.style.display = 'none';
        setTimeout(() => {
          document.body.removeChild(contactModal);
        }, 300);
      }
    };
    
    // Form submit event
    const contactForm = document.getElementById('contactParentForm');
    contactForm.onsubmit = function(e) {
      e.preventDefault();
      
      // Show sending indicator
      const subject = document.getElementById('contactSubject').value;
      const message = document.getElementById('contactMessage').value;
      
      // Simulate sending message
      showAlert('訊息發送中...');
      
      // Record the message in a Google Sheet through the Apps Script
      fetch(`${scriptUrl}?action=contactParent&teacherId=${currentTeacher.id}&teacherName=${currentTeacher.name}&studentId=${student.studentId}&studentName=${student.name}&subject=${encodeURIComponent(subject)}&message=${encodeURIComponent(message)}`)
        .then(response => response.json())
        .catch(() => ({ success: false }))
        .then(data => {
          if (data && data.success) {
            showAlert('訊息已成功發送');
            contactModal.style.display = 'none';
            setTimeout(() => {
              document.body.removeChild(contactModal);
            }, 300);
          } else {
            showAlert('發送訊息時發生錯誤，請稍後再試');
          }
        });
    };
  }
  
  // Logout functionality
  window.logoutTeacher = function() {
    sessionStorage.removeItem('teacherSession');
    sessionStorage.removeItem('teacherSessionExpiry');
    
    if (loginSection) loginSection.style.display = 'block';
    if (teacherDashboard) teacherDashboard.style.display = 'none';
    
    // Reset login form
    if (loginForm) {
      loginForm.reset();
      checkSavedCredentials();
    }
    
    // Reset login result message
    if (loginResult) {
      loginResult.style.display = 'none';
    }
    
    // Reset teacher data
    currentTeacher = null;
  }
  
  // Close modal buttons
  Array.from(closeBtns).forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });
  
  // Modal window click outside
  window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  }
  
  // Show alert function
  function showAlert(message) {
    alertMessage.textContent = message;
    alertModal.style.display = 'block';
  }
  
  // Print student detail
  function printStudentDetail(student) {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>學生提交詳情 - ${student.name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.5;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #000; 
            padding-bottom: 15px; 
          }
          .student-info { 
            margin-bottom: 30px; 
          }
          .student-info p { 
            margin: 10px 0; 
          }
          .signature-section { 
            margin: 20px 0; 
            text-align: center;
          }
          .signature-image { 
            max-width: 300px; 
            border: 1px solid #000; 
            padding: 10px;
          }
          .footer { 
            margin-top: 30px; 
            text-align: center; 
            font-size: 12px; 
            border-top: 1px solid #000; 
            padding-top: 10px; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>第八節意願調查 - 學生提交資料</h1>
          <p>${student.class}班 - ${student.name}</p>
        </div>
        
        <div class="student-info">
          <p><strong>學號：</strong> ${student.studentId}</p>
          <p><strong>姓名：</strong> ${student.name}</p>
          <p><strong>班級：</strong> ${student.class}</p>
          <p><strong>意願：</strong> ${student.intention}</p>
          ${student.reason ? `<p><strong>不參加原因：</strong> ${student.reason}</p>` : ''}
          <p><strong>提交時間：</strong> ${new Date(student.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="signature-section">
          <p><strong>家長簽名：</strong></p>
          <img src="${student.signature}" alt="家長簽名" class="signature-image">
        </div>
        
        <div class="footer">
          <p>此報表由系統自動生成 - ${new Date().toLocaleDateString()}</p>
          <p>第八節意願調查系統  ${new Date().getFullYear()}</p>
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
  
  // Export student detail
  function exportStudentDetail(student) {
    // In a real app, this would export the data
    // For demo, just show an alert
    showAlert('學生資料已匯出');
  }
});

// Add CSS for teacher dashboard
document.head.insertAdjacentHTML('beforeend', `
<style>
  .class-summary {
    background-color: #f5f7fa;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.05);
  }
  
  .stats-overview {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  
  .stat-item {
    flex: 1;
    text-align: center;
    padding: 15px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin: 0 5px;
  }
  
  .stat-number {
    font-size: 28px;
    font-weight: bold;
    color: var(--primary-color);
    margin-bottom: 5px;
  }
  
  .stat-label {
    font-size: 14px;
    color: #666;
  }
  
  .stat-item.yes .stat-number {
    color: var(--secondary-color);
  }
  
  .stat-item.no .stat-number {
    color: #e74c3c;
  }
  
  .progress-container {
    margin: 15px 0 25px 0;
  }
  
  .progress-container p {
    margin-bottom: 5px;
    font-weight: bold;
    color: #555;
  }
  
  .progress-bar-container {
    height: 10px;
    background-color: #eee;
    border-radius: 5px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background-color: var(--primary-color);
    border-radius: 5px;
    transition: width 1s ease-out;
  }
  
  .progress-bar.yes-bar {
    background-color: var(--secondary-color);
  }
  
  .not-responded {
    background-color: #f8f9fa;
  }
  
  .not-submitted {
    color: #999;
    font-style: italic;
  }
  
  .student-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  
  .student-basic-info, .device-info {
    background-color: #f9f9fb;
    padding: 15px;
    border-radius: 8px;
    border-left: 3px solid var(--primary-color);
  }
  
  .signature-section {
    grid-column: 1 / -1;
    text-align: center;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    border: 1px solid #eee;
  }
  
  .signature-image {
    max-width: 100%;
    max-height: 200px;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .action-buttons {
    grid-column: 1 / -1;
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  
  .print-btn, .export-btn {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
  }
  
  .print-btn {
    background-color: var(--primary-color);
    color: white;
  }
  
  .export-btn {
    background-color: #34495e;
    color: white;
  }
  
  .print-btn:hover, .export-btn:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
  
  .view-details-btn, .notify-btn {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .notify-btn {
    background-color: #f39c12;
  }
  
  .send-reminder-btn {
    background-color: #f39c12;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
    cursor: pointer;
    margin-left: 5px;
    transition: all 0.2s ease;
  }
  
  .send-reminder-btn:hover {
    background-color: #e67e22;
    transform: translateY(-2px);
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  
  .no-data-message {
    text-align: center;
    padding: 30px;
    color: #999;
    font-style: italic;
  }
  
  .no-data-message i {
    font-size: 36px;
    color: #ddd;
    margin-bottom: 10px;
    display: block;
  }
  
  .not-found {
    text-align: center;
    padding: 30px;
  }
  
  .not-found i {
    font-size: 48px;
    color: #e0e0e0;
    margin-bottom: 15px;
  }
  
  .not-found p {
    color: #999;
    font-size: 16px;
  }
  
  @media (max-width: 768px) {
    .student-details {
      grid-template-columns: 1fr;
    }
    
    .stats-overview {
      flex-direction: column;
      gap: 10px;
    }
    
    .stat-item {
      margin: 0;
    }
  }
</style>
`);
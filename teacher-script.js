document.addEventListener('DOMContentLoaded', function() {
  const teacherLoginForm = document.getElementById('teacherLoginForm');
  const loginSection = document.getElementById('loginSection');
  const teacherSection = document.getElementById('teacherSection');
  const loginLoading = document.getElementById('loginLoading');
  const loginResult = document.getElementById('loginResult');
  const logoutButton = document.getElementById('logoutButton');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const alertModal = document.getElementById('alertModal');
  const studentDetailModal = document.getElementById('studentDetailModal');
  const closeBtns = document.getElementsByClassName('close');
  
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbxCCH1cdUGSjPVnOPqyfyZ9yQ9eHmCp1Uc4J2hbt3aDwDTwOhUAlPf52gSZRfhrH4jbwg/exec';
  
  // Toggle password visibility
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePasswordBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
  }
  
  // Close modal buttons
  Array.from(closeBtns).forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });
  
  // Close modal on outside click
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
  
  // Check if teacher is already logged in with a valid session
  function checkTeacherSession() {
    const teacherSession = sessionStorage.getItem('teacherSession');
    const sessionExpiry = sessionStorage.getItem('teacherSessionExpiry');
    
    if (teacherSession && sessionExpiry && new Date().getTime() < parseInt(sessionExpiry)) {
      // Session is still valid
      const teacherName = sessionStorage.getItem('teacherName');
      const teacherClass = sessionStorage.getItem('teacherClass');
      
      document.getElementById('teacherName').textContent = teacherName || '導師';
      document.getElementById('teacherClass').textContent = teacherClass || '班級';
      
      showTeacherSection();
      loadClassData(teacherClass);
      return true;
    } else if (teacherSession) {
      // Session expired
      sessionStorage.removeItem('teacherSession');
      sessionStorage.removeItem('teacherSessionExpiry');
      sessionStorage.removeItem('teacherName');
      sessionStorage.removeItem('teacherClass');
      showLoginMessage('登入階段已過期，請重新登入', 'error');
    }
    
    return false;
  }
  
  // Check for active teacher session
  if (checkTeacherSession()) {
    showTeacherSection();
  }
  
  // Teacher login form submission
  if (teacherLoginForm) {
    teacherLoginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      // Basic input validation
      if (!username || !password) {
        showLoginMessage('請輸入帳號和密碼', 'error');
        teacherLoginForm.classList.add('shakeError');
        setTimeout(() => teacherLoginForm.classList.remove('shakeError'), 500);
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
      
      fetch(`${scriptUrl}?action=teacherLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&token=${encodeURIComponent(token)}`)
        .then(response => response.json())
        .then(data => {
          loginLoading.style.display = 'none';
          
          if (data.success) {
            // Set session storage with expiry (30 minutes)
            const expiryTime = Date.now() + 1800000; // 30 minutes
            sessionStorage.setItem('teacherSession', data.sessionToken || 'true');
            sessionStorage.setItem('teacherSessionExpiry', expiryTime.toString());
            sessionStorage.setItem('teacherName', data.teacherName || '導師');
            sessionStorage.setItem('teacherClass', data.teacherClass || '班級');
            sessionStorage.setItem('lastActivity', Date.now().toString());
            
            document.getElementById('teacherName').textContent = data.teacherName || '導師';
            document.getElementById('teacherClass').textContent = data.teacherClass || '班級';
            
            showLoginMessage('登入成功，正在載入班級資料...', 'success');
            
            // Show teacher section after a brief delay
            setTimeout(() => {
              showTeacherSection();
              loadClassData(data.teacherClass);
            }, 1000);
          } else {
            showLoginMessage(data.message || '帳號或密碼錯誤', 'error');
            
            teacherLoginForm.classList.add('shakeError');
            setTimeout(() => teacherLoginForm.classList.remove('shakeError'), 500);
            
            // Check if rate limited
            if (data.rateLimited) {
              showLoginMessage('登入嘗試次數過多，請稍後再試', 'error');
            }
          }
        })
        .catch(error => {
          loginLoading.style.display = 'none';
          showLoginMessage('登入失敗，請稍後再試', 'error');
          console.error('Error:', error);
        });
    });
  }
  
  // Logout functionality
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      sessionStorage.removeItem('teacherSession');
      sessionStorage.removeItem('teacherSessionExpiry');
      sessionStorage.removeItem('teacherName');
      sessionStorage.removeItem('teacherClass');
      sessionStorage.removeItem('lastActivity');
      
      showLoginSection();
    });
  }
  
  // Show login message
  function showLoginMessage(message, type) {
    loginResult.textContent = message;
    loginResult.className = type;
    loginResult.style.display = 'block';
  }
  
  // Show teacher section
  function showTeacherSection() {
    if (loginSection) loginSection.style.display = 'none';
    if (teacherSection) teacherSection.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'block';
  }
  
  // Show login section
  function showLoginSection() {
    if (loginSection) loginSection.style.display = 'block';
    if (teacherSection) teacherSection.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'none';
    
    // Reset login form
    if (teacherLoginForm) {
      teacherLoginForm.reset();
    }
    
    // Reset login result message
    if (loginResult) {
      loginResult.style.display = 'none';
    }
  }
  
  // Session timeout check
  function checkSessionTimeout() {
    const sessionExpiry = sessionStorage.getItem('teacherSessionExpiry');
    const lastActivity = sessionStorage.getItem('lastActivity');
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
    
    if (sessionExpiry && parseInt(sessionExpiry) < Date.now()) {
      showLoginSection();
      showAlert('登入階段已過期，請重新登入');
      return;
    }
    
    if (lastActivity && (Date.now() - parseInt(lastActivity)) > INACTIVITY_TIMEOUT) {
      showLoginSection();
      showAlert('因長時間未活動，系統已自動登出');
      return;
    }
  }
  
  // Check session timeout every minute
  setInterval(checkSessionTimeout, 60000);
  
  // Update last activity on user interaction
  document.addEventListener('click', function() {
    if (sessionStorage.getItem('teacherSession')) {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    }
  });
  
  document.addEventListener('keypress', function() {
    if (sessionStorage.getItem('teacherSession')) {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    }
  });
  
  // Load class data
  function loadClassData(className) {
    const classSummary = document.getElementById('classSummary');
    const studentsTable = document.getElementById('studentsTable').querySelector('tbody');
    
    if (!className) {
      className = sessionStorage.getItem('teacherClass');
      if (!className) {
        showAlert('無法載入班級資料，請重新登入');
        return;
      }
    }
    
    classSummary.innerHTML = '<div class="class-stats-loading">載入班級資料中...</div>';
    studentsTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">載入學生資料中...</td></tr>';
    
    fetch(`${scriptUrl}?action=search&searchType=class&searchValue=${encodeURIComponent(className)}&token=teacherAccess`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.results) {
          displayClassData(data.results, className);
        } else {
          classSummary.innerHTML = '<div class="class-stats-loading">無班級資料</div>';
          studentsTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">無學生資料</td></tr>';
        }
      })
      .catch(error => {
        console.error('Error loading class data:', error);
        classSummary.innerHTML = '<div class="class-stats-loading">載入失敗，請重試</div>';
        studentsTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">載入失敗，請重試</td></tr>';
      });
  }
  
  // Display class data
  function displayClassData(students, className) {
    const classSummary = document.getElementById('classSummary');
    const studentsTable = document.getElementById('studentsTable').querySelector('tbody');
    
    const totalStudents = students.length;
    const participateCount = students.filter(s => s.intention === '參加').length;
    const notParticipateCount = totalStudents - participateCount;
    const participatePercent = totalStudents > 0 ? (participateCount / totalStudents * 100).toFixed(1) : '0.0';
    
    // Create class summary
    classSummary.innerHTML = `
      <div class="class-summary-header">
        <h3>${className} 班級統計</h3>
        <span class="timestamp">更新時間: ${new Date().toLocaleString()}</span>
      </div>
      <div class="stats-container">
        <div class="stat-box total">
          <h4>總人數</h4>
          <div class="stat-number">${totalStudents}</div>
        </div>
        <div class="stat-box yes">
          <h4>參加人數</h4>
          <div class="stat-number">${participateCount}</div>
        </div>
        <div class="stat-box no">
          <h4>不參加人數</h4>
          <div class="stat-number">${notParticipateCount}</div>
        </div>
      </div>
      <div class="stats-progress">
        <div class="stats-progress-bar" style="width: ${participatePercent}%"></div>
      </div>
      <p>參加率: ${participatePercent}%</p>
    `;
    
    // Create students table
    studentsTable.innerHTML = '';
    
    if (students.length === 0) {
      studentsTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">無學生資料</td></tr>';
      return;
    }
    
    // Sort students by student ID
    students.sort((a, b) => a.studentId.localeCompare(b.studentId));
    
    students.forEach(student => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.studentId}</td>
        <td>${student.name}</td>
        <td><span class="${student.intention === '參加' ? 'intention-yes' : 'intention-no'}">${student.intention}</span></td>
        <td>${student.reason || '-'}</td>
        <td>${formatTimestamp(student.timestamp)}</td>
        <td>
          <button class="view-btn" data-student-id="${student.studentId}">
            <i class="fas fa-eye"></i> 查看詳情
          </button>
        </td>
      `;
      
      studentsTable.appendChild(row);
    });
    
    // Add event listeners to view buttons
    studentsTable.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const studentId = this.dataset.studentId;
        const student = students.find(s => s.studentId === studentId);
        if (student) {
          showStudentDetail(student);
        }
      });
    });
    
    // Add event listeners to action buttons
    document.getElementById('printClassBtn').addEventListener('click', function() {
      printClassReport(students, className);
    });
    
    document.getElementById('exportClassBtn').addEventListener('click', function() {
      exportClassData(students, className);
    });
    
    document.getElementById('refreshClassBtn').addEventListener('click', function() {
      loadClassData(className);
    });
  }
  
  // Format timestamp
  function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  }
  
  // Show student detail
  function showStudentDetail(student) {
    const studentDetailContent = document.getElementById('studentDetailContent');
    
    studentDetailContent.innerHTML = `
      <div class="student-detail-section">
        <h3><i class="fas fa-info-circle"></i> 基本資料</h3>
        <p><strong>學號:</strong> ${student.studentId}</p>
        <p><strong>姓名:</strong> ${student.name}</p>
        <p><strong>班級:</strong> ${student.class}</p>
        <p><strong>意願:</strong> <span class="${student.intention === '參加' ? 'intention-yes' : 'intention-no'}">${student.intention}</span></p>
        ${student.reason ? `<p><strong>不參加原因:</strong> ${student.reason}</p>` : ''}
        <p><strong>提交時間:</strong> ${formatTimestamp(student.timestamp)}</p>
      </div>
      
      <div class="student-detail-section">
        <h3><i class="fas fa-signature"></i> 家長簽名</h3>
        ${student.signature ? 
          `<div class="signature-container">
            <img src="${student.signature}" alt="家長簽名" class="signature-image">
          </div>` : 
          '<p>無簽名資料</p>'
        }
      </div>
      
      <div class="student-actions">
        <button class="student-action-btn print-btn" onclick="printStudentDetail(${JSON.stringify(student).replace(/"/g, '&quot;')})">
          <i class="fas fa-print"></i> 列印學生資料
        </button>
      </div>
    `;
    
    studentDetailModal.style.display = 'block';
  }
  
  // Print student detail
  window.printStudentDetail = function(student) {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>學生資料 - ${student.name}</title>
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
          .section { 
            margin-bottom: 25px; 
            page-break-inside: avoid;
          }
          .section h3 { 
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
            h1, h2, h3, h4 { page-break-after: avoid; }
          }
          .signature-container {
            border: 1px solid #000;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            background: #fff;
          }
          .student-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>第八節意願調查學生資料</h1>
          <p>${student.class} - ${student.name} (${student.studentId})</p>
        </div>
        
        <div class="section">
          <h3>基本資料</h3>
          <div class="student-info">
            <div>
              <p><strong>學號：</strong> ${student.studentId}</p>
              <p><strong>姓名：</strong> ${student.name}</p>
              <p><strong>班級：</strong> ${student.class}</p>
            </div>
            <div>
              <p><strong>意願：</strong> ${student.intention}</p>
              <p><strong>提交時間：</strong> ${formatTimestamp(student.timestamp)}</p>
              ${student.reason ? `<p><strong>不參加原因：</strong> ${student.reason}</p>` : ''}
            </div>
          </div>
        </div>
        
        <div class="section">
          <h3>家長簽名</h3>
          ${student.signature ? 
            `<div class="signature-container">
              <img src="${student.signature}" alt="家長簽名" class="signature-image">
            </div>` : 
            '<p>無簽名資料</p>'
          }
        </div>
        
        <div class="footer">
          <p>此資料由系統自動生成 - ${new Date().toLocaleDateString()}</p>
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
    
    // Print after a delay to ensure content is loaded
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
  
  // Print class report
  function printClassReport(students, className) {
    const totalStudents = students.length;
    const participateCount = students.filter(s => s.intention === '參加').length;
    const notParticipateCount = totalStudents - participateCount;
    const participatePercent = totalStudents > 0 ? (participateCount / totalStudents * 100).toFixed(1) : '0.0';
    
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${className} 班級報表</title>
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
          .section { 
            margin-bottom: 25px; 
            page-break-inside: avoid;
          }
          .section h3 { 
            border-bottom: 1px solid #000; 
            padding-bottom: 8px; 
            font-size: 14pt;
            margin-top: 25px;
            margin-bottom: 15px;
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
            h1, h2, h3, h4 { page-break-after: avoid; }
          }
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .stat-box {
            border: 1px solid #000;
            padding: 15px;
            text-align: center;
          }
          .stat-box h4 {
            margin: 0 0 10px 0;
            font-size: 14px;
          }
          .stat-box .number {
            font-size: 24px;
            font-weight: bold;
          }
          .progress-bar {
            height: 20px;
            border: 1px solid #000;
            margin: 20px 0;
            position: relative;
          }
          .progress-bar-fill {
            height: 100%;
            background-color: #000;
            width: ${participatePercent}%;
          }
          .progress-text {
            text-align: center;
            margin-top: 5px;
          }
          .signature {
            page-break-inside: avoid;
            margin-top: 50px;
            border-top: 1px dashed #000;
            padding-top: 20px;
          }
          .signature-line {
            display: inline-block;
            width: 200px;
            border-bottom: 1px solid #000;
            margin-right: 20px;
          }
          .signature-date {
            display: inline-block;
            width: 200px;
            border-bottom: 1px solid #000;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${className} 班級第八節意願調查報表</h1>
          <p>列印日期：${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="section">
          <h3>班級統計摘要</h3>
          <div class="stats-grid">
            <div class="stat-box">
              <h4>總人數</h4>
              <div class="number">${totalStudents}</div>
            </div>
            <div class="stat-box">
              <h4>參加人數</h4>
              <div class="number">${participateCount}</div>
            </div>
            <div class="stat-box">
              <h4>不參加人數</h4>
              <div class="number">${notParticipateCount}</div>
            </div>
          </div>
          
          <div class="progress-bar">
            <div class="progress-bar-fill"></div>
          </div>
          <div class="progress-text">參加率: ${participatePercent}%</div>
        </div>
        
        <div class="section">
          <h3>學生明細</h3>
          <table>
            <thead>
              <tr>
                <th>學號</th>
                <th>姓名</th>
                <th>意願</th>
                <th>不參加原因</th>
                <th>提交時間</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(student => `
                <tr>
                  <td>${student.studentId}</td>
                  <td>${student.name}</td>
                  <td>${student.intention}</td>
                  <td>${student.reason || '-'}</td>
                  <td>${formatTimestamp(student.timestamp)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="signature">
          <p>導師簽名：<span class="signature-line"></span> 日期：<span class="signature-date"></span></p>
        </div>
        
        <div class="footer">
          <p>此報表由系統自動生成 - ${new Date().toLocaleDateString()}</p>
          <p>第八節意願調查系統  ${new Date().getFullYear()}</p>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #4a90e2; color: white; border: none; border-radius: 4px; font-size: 16px;">列印此報表</button>
          <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer; background: #f0f0f0; color: #333; border: none; border-radius: 4px; font-size: 16px; margin-left: 10px;">關閉</button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Print after a delay to ensure content is loaded
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
  
  // Export class data
  function exportClassData(students, className) {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF學號,姓名,班級,意願,不參加原因,提交時間\n";
    
    students.forEach(student => {
      const row = [
        student.studentId,
        student.name,
        student.class,
        student.intention,
        student.reason || '',
        formatTimestamp(student.timestamp)
      ].map(value => `"${value}"`).join(',');
      
      csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `${className}_班級調查資料.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  // Show alert modal
  function showAlert(message) {
    const alertMessage = document.getElementById('alertMessage');
    alertMessage.textContent = message;
    alertModal.style.display = 'block';
  }
});
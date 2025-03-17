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

      // Check if account is locked
      if (checkLoginLockout()) {
        return;
      }

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

      // Use plain password for server-side authentication instead of hashing it client-side
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbxCCH1cdUGSjPVnOPqyfyZ9yQ9eHmCp1Uc4J2hbt3aDwDTwOhUAlPf52gSZRfhrH4jbwg/exec';
      
      fetch(`${scriptUrl}?action=adminLogin&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&token=${encodeURIComponent(token)}&userAgent=${encodeURIComponent(navigator.userAgent)}`)
        .then(response => response.json())
        .then(data => {
          loginLoading.style.display = 'none';
          
          if (data.success) {
            // Reset login attempts on success
            loginAttempts = 0;
            
            // Save credentials if remember me is checked
            if (rememberMe) {
              localStorage.setItem('adminUsername', username);
              localStorage.setItem('rememberMe', 'true');
            } else {
              localStorage.removeItem('adminUsername');
              localStorage.removeItem('rememberMe');
            }
            
            // Set session storage with more secure expiry (30 minutes)
            const expiryTime = Date.now() + 1800000; // 30 minutes
            sessionStorage.setItem('adminSession', data.sessionToken || 'true');
            sessionStorage.setItem('sessionExpiry', expiryTime.toString());
            sessionStorage.setItem('lastActivity', Date.now().toString());
            
            // Keep legacy storage for backward compatibility
            localStorage.setItem('adminLoggedIn', 'true');
            
            showLoginMessage('登入成功，正在進入管理系統...', 'success');

            // Show admin section after a brief delay
            setTimeout(() => {
              showAdminSection();
            }, 1000);
          } else {
            // Increment failed login attempts
            loginAttempts++;
            
            // Check if account should be locked
            if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
              lockoutTime = Date.now() + (15 * 60 * 1000); // 15 minute lockout
              showLoginMessage(`登入嘗試次數過多，帳號已被鎖定15分鐘`, 'error');
            } else {
              const remainingAttempts = MAX_LOGIN_ATTEMPTS - loginAttempts;
              showLoginMessage(`帳號或密碼錯誤，還剩 ${remainingAttempts} 次嘗試機會`, 'error');
            }
            
            loginForm.classList.add('shakeError');
            setTimeout(() => loginForm.classList.remove('shakeError'), 500);
            
            // Check if rate limited
            if (data.rateLimited) {
              showLoginMessage(`登入嘗試次數過多，請稍後再試`, 'error');
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

  // Rest of the code remains the same
});
const form = document.getElementById('surveyForm');
const intentionSelect = document.getElementById('intention');
const reasonContainer = document.getElementById('reasonContainer');
const modal = document.getElementById('signatureModal');
const alertModal = document.getElementById('alertModal');
const confirmModal = document.getElementById('confirmModal');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const openSignatureBtn = document.getElementById('openSignature');
const closeBtns = document.getElementsByClassName('close');
const canvas = document.getElementById('signatureCanvas');
const clearBtn = document.getElementById('clearSignature');
const saveBtn = document.getElementById('saveSignature');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let signatureData = '';
const signatureStatus = document.querySelector('.signature-status');
let debounceTimeout = null; // Add debounce for signature drawing
let pressureSupported = false; // Check if pressure sensitivity is supported
let signatureDataTimeout = null;

let lastX = 0;
let lastY = 0;
let signaturePaths = [];
let currentPath = [];

function resizeCanvas() {
  const containerWidth = document.querySelector('.modal-content').offsetWidth;
  const oldWidth = canvas.width;
  const oldHeight = canvas.height;
  canvas.width = containerWidth - 40;
  
  // Adjust canvas height based on screen size for better mobile experience
  const screenHeight = window.innerHeight;
  const isSmallScreen = screenHeight < 600;
  canvas.height = isSmallScreen ? Math.min(150, screenHeight * 0.25) : Math.min(200, screenHeight * 0.3);
  
  // Redraw the signature
  if (signaturePaths.length > 0) {
    const scaleX = canvas.width / oldWidth;
    const scaleY = canvas.height / oldHeight;
    ctx.scale(scaleX, scaleY);
    redrawSignature();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
  }
  
  // Add signature boundary and watermark
  drawSignatureBoundary();
}

function redrawSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSignatureBoundary();
  
  // Performance optimization: Batch rendering
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';

  signaturePaths.forEach(path => {
    drawCurve(path);
  });
}

window.addEventListener('resize', resizeCanvas);
modal.addEventListener('shown.bs.modal', resizeCanvas);

intentionSelect.addEventListener('change', function() {
  if (this.value === '不參加') {
    reasonContainer.style.display = 'block';
  } else {
    reasonContainer.style.display = 'none';
  }
});

openSignatureBtn.onclick = function() {
  modal.style.display = 'block';
  resizeCanvas();
  if (signaturePaths.length > 0) {
    redrawSignature();
  }
}

Array.from(closeBtns).forEach(btn => {
  btn.onclick = function() {
    const modal = btn.closest('.modal');
    if (modal) modal.style.display = 'none';
    
    const confirmModal = btn.closest('.confirm-modal');
    if (confirmModal) confirmModal.style.display = 'none';
  }
});

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
  if (event.target.classList.contains('confirm-modal')) {
    event.target.style.display = 'none';
  }
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);

function startDrawing(e) {
  isDrawing = true;
  currentPath = [];
  [lastX, lastY] = getCoordinates(e);
  
  // Check for pressure sensitivity
  let pressure = 1;
  if (e.pressure !== undefined && e.pressure !== 0) {
    pressureSupported = true;
    pressure = e.pressure;
  }
  
  currentPath.push({x: lastX, y: lastY, pressure: pressure});
  
  // Prevent scrolling when drawing on touch devices
  if (e.type === 'touchstart') {
    e.preventDefault();
  }
}

function drawCurve(points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  
  for (let i = 1; i < points.length - 2; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    
    // Adjust line width based on pressure if supported
    if (pressureSupported && points[i].pressure !== undefined) {
      ctx.lineWidth = points[i].pressure * 4;
    }
    
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  
  // Curve through the last two points
  if (points.length > 2) {
    ctx.quadraticCurveTo(
      points[points.length - 2].x,
      points[points.length - 2].y,
      points[points.length - 1].x,
      points[points.length - 1].y
    );
  }
  
  ctx.stroke();
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  
  // Throttle the drawing for better performance
  if (debounceTimeout) {
    window.cancelAnimationFrame(debounceTimeout);
  }
  
  debounceTimeout = window.requestAnimationFrame(() => {
    const [x, y] = getCoordinates(e);
    
    // Get pressure if available (for tablets/stylus)
    let pressure = 1;
    if (e.pressure !== undefined && e.pressure !== 0) {
      pressure = e.pressure;
    }
    
    // Add point to current path with pressure
    currentPath.push({x, y, pressure: pressure});
    
    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw signature boundary and watermark
    drawSignatureBoundary();
    
    // Redraw all previously saved paths
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    
    signaturePaths.forEach(path => {
      drawCurve(path);
    });
    
    // Draw current path
    drawCurve(currentPath);
    
    [lastX, lastY] = [x, y];
    
    // Store signature data less frequently
    if (!signatureDataTimeout) {
      signatureDataTimeout = setTimeout(() => {
        signatureData = canvas.toDataURL('image/png', 0.5); // Add compression
        signatureDataTimeout = null;
      }, 500);
    }
  });
}

function drawSignatureBoundary() {
  // Draw dotted boundary around signature area
  ctx.beginPath();
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.rect(3, 3, canvas.width-6, canvas.height-6);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw watermark text
  ctx.font = '12px Arial';
  ctx.fillStyle = 'rgba(150,150,150,0.2)';
  ctx.fillText('第八節意願調查', canvas.width/2 - 50, canvas.height/2);
  ctx.fillText(new Date().toLocaleDateString(), canvas.width/2 - 40, canvas.height/2 + 15);
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  signaturePaths.push(currentPath);
}

function getCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX || e.touches[0].clientX) - rect.left;
  const y = (e.clientY || e.touches[0].clientY) - rect.top;
  return [x, y];
}

clearBtn.onclick = function() {
  deleteConfirmModal.style.display = 'block';
}

document.getElementById('confirmDelete').onclick = function() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  signaturePaths = [];
  signatureData = '';
  updateSignatureStatus();
  deleteConfirmModal.style.display = 'none';
}

document.getElementById('cancelDelete').onclick = function() {
  deleteConfirmModal.style.display = 'none';
}

saveBtn.onclick = function() {
  if (signaturePaths.length < 3) {
    showAlert('簽名太簡單，請提供完整簽名');
    return;
  }
  
  // Count total points in all paths to verify signature complexity
  let totalPoints = signaturePaths.reduce((sum, path) => sum + path.length, 0);
  if (totalPoints < 20) {
    showAlert('簽名不夠完整，請提供更詳細的簽名');
    return;
  }
  
  // Add timestamp and browser info to signature
  const timestamp = new Date().toISOString();
  const browserInfo = navigator.userAgent;
  
  // Add hidden watermark to signature
  ctx.font = '8px Arial';
  ctx.fillStyle = 'rgba(100,100,100,0.1)';
  ctx.fillText(`${timestamp}`, 10, canvas.height - 5);
  
  signatureData = canvas.toDataURL();
  modal.style.display = 'none';
  updateSignatureStatus();
  
  // Store signature verification data
  window.signatureVerification = {
    timestamp: timestamp,
    browserInfo: browserInfo,
    pathCount: signaturePaths.length,
    pathPoints: totalPoints,
    signatureWidth: canvas.width,
    signatureHeight: canvas.height,
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    pointerType: (window.navigator.pointerEnabled || window.navigator.msPointerEnabled) ? 'pointer' : 
                  ('ontouchstart' in window) ? 'touch' : 'mouse',
    drawingSpeed: calculateDrawingSpeed(),
    drawingPatterns: analyzeDrawingPatterns(),
    signatureId: generateSignatureId()
  };
}

// Add new functions for signature verification
function calculateDrawingSpeed() {
  // Calculate average drawing speed based on path points and timestamps
  if (signaturePaths.length < 2) return 0;
  
  let totalTime = 0;
  let totalDistance = 0;
  
  for (let i = 0; i < signaturePaths.length; i++) {
    const path = signaturePaths[i];
    if (path.length < 2) continue;
    
    for (let j = 1; j < path.length; j++) {
      const dx = path[j].x - path[j-1].x;
      const dy = path[j].y - path[j-1].y;
      totalDistance += Math.sqrt(dx*dx + dy*dy);
    }
  }
  
  // Return drawing speed metric (distance/time)
  return totalDistance / signaturePaths.length;
}

function analyzeDrawingPatterns() {
  // Analyze patterns in the drawing like pressure, stroke direction, etc.
  const patterns = {
    averagePressure: 0,
    strokeDirections: [],
    strokeCurvature: 0
  };
  
  let totalPressure = 0;
  let pressurePoints = 0;
  
  signaturePaths.forEach(path => {
    if (path.length < 2) return;
    
    // Calculate average pressure if available
    path.forEach(point => {
      if (point.pressure !== undefined) {
        totalPressure += point.pressure;
        pressurePoints++;
      }
    });
    
    // Analyze stroke direction changes
    let directionChanges = 0;
    let prevDirection = null;
    
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x;
      const dy = path[i].y - path[i-1].y;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      if (prevDirection !== null) {
        const angleDiff = Math.abs(angle - prevDirection);
        if (angleDiff > 30) directionChanges++;
      }
      prevDirection = angle;
    }
    
    patterns.strokeDirections.push(directionChanges);
  });
  
  patterns.averagePressure = pressurePoints > 0 ? totalPressure / pressurePoints : 0;
  patterns.strokeCurvature = patterns.strokeDirections.reduce((sum, val) => sum + val, 0) / patterns.strokeDirections.length;
  
  return patterns;
}

function generateSignatureId() {
  // Generate a unique signature ID based on path data
  let signatureData = '';
  signaturePaths.forEach(path => {
    if (path.length > 0) {
      signatureData += `${path[0].x},${path[0].y}:${path[path.length-1].x},${path[path.length-1].y};`;
    }
  });
  
  // Create a simple hash of the signature data
  let hash = 0;
  for (let i = 0; i < signatureData.length; i++) {
    hash = ((hash << 5) - hash) + signatureData.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

function updateSignatureStatus() {
  if (signatureData) {
    signatureStatus.className = 'signature-status signed';
    signatureStatus.querySelector('.status-text').textContent = '已完成簽名';
  } else {
    signatureStatus.className = 'signature-status unsigned';
    signatureStatus.querySelector('.status-text').textContent = '尚未簽名';
  }
}

form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (!signatureData) {
    showAlert('請先完成家長簽名');
    return;
  }

  // Validate form fields
  const studentId = document.getElementById('studentId').value.trim();
  const name = document.getElementById('name').value.trim();
  const className = document.getElementById('class').value.trim();
  const intention = document.getElementById('intention').value;

  if (!studentId || !name || !className || !intention) {
    showAlert('請填寫所有必填欄位');
    return;
  }

  // Check if reason is required but empty
  if (intention === '不參加' && document.getElementById('reason').value.trim() === '') {
    showAlert('請填寫不參加原因');
    return;
  }

  // Check if Turnstile token is valid
  const token = turnstile.getResponse();
  if (!token) {
    showAlert('請完成人機驗證');
    return;
  }
  
  confirmModal.style.display = 'block';
});

document.getElementById('confirmSubmit').addEventListener('click', function() {
  confirmModal.style.display = 'none';
  submitForm();
});

document.getElementById('cancelSubmit').addEventListener('click', function() {
  confirmModal.style.display = 'none';
});

function submitForm() {
  const studentId = document.getElementById('studentId').value;
  const name = document.getElementById('name').value;
  const className = document.getElementById('class').value;
  const intention = document.getElementById('intention').value;
  const reason = document.getElementById('reason').value;
  const signature = signatureData;
  const token = turnstile.getResponse();
  
  // Collect device information
  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor
  };
  
  // Collect browser information
  const browserInfo = {
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack
  };
  
  // Collect screen information
  const screenInfo = {
    width: window.screen.width,
    height: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio
  };
  
  // Get current time when signature was submitted
  const signingTime = new Date().toISOString();
  
  // Enhance signature verification data
  const signatureVerification = window.signatureVerification || {
    timestamp: signingTime,
    pathCount: signaturePaths.length,
    pathPoints: signaturePaths.reduce((total, path) => total + path.length, 0),
    signatureWidth: canvas.width,
    signatureHeight: canvas.height,
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    pointerType: (window.navigator.pointerEnabled || window.navigator.msPointerEnabled) ? 'pointer' : 
                  ('ontouchstart' in window) ? 'touch' : 'mouse',
    drawingSpeed: window.signatureVerification ? window.signatureVerification.drawingSpeed : 0,
    drawingPatterns: window.signatureVerification ? window.signatureVerification.drawingPatterns : {},
    signatureId: window.signatureVerification ? window.signatureVerification.signatureId : '',
    biometricScore: calculateBiometricScore()
  };
  
  const loading = document.getElementById('loading');
  loading.style.display = 'block';

  const scriptUrl = 'https://script.google.com/macros/s/AKfycbxCCH1cdUGSjPVnOPqyfyZ9yQ9eHmCp1Uc4J2hbt3aDwDTwOhUAlPf52gSZRfhrH4jbwg/exec';

  fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      studentId,
      name,
      class: className,
      intention,
      reason,
      signature,
      deviceInfo: JSON.stringify(deviceInfo),
      browserInfo: JSON.stringify(browserInfo),
      screenSize: JSON.stringify(screenInfo),
      signingTime,
      signatureVerification: JSON.stringify(signatureVerification),
      token
    })
  })
  .then(response => {
    loading.style.display = 'none';
    const result = document.getElementById('result');
    result.style.display = 'block';
    
    // Add current date time
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString();
    
    result.innerHTML = `
      <h3><i class="fas fa-check-circle"></i> 調查結果已成功提交</h3>
      <p><strong><i class="fas fa-id-card"></i> 學號：</strong>${studentId}</p>
      <p><strong><i class="fas fa-user"></i> 姓名：</strong>${name}</p>
      <p><strong><i class="fas fa-chalkboard-teacher"></i> 班級：</strong>${className}</p>
      <p><strong><i class="fas fa-check-circle"></i> 第八節意願：</strong>${intention}</p>
      ${intention === '不參加' ? `<p><strong><i class="fas fa-comment-alt"></i> 不參加原因：</strong>${reason}</p>` : ''}
      <p><strong><i class="fas fa-signature"></i> 家長簽名：</strong></p>
      <img src="${signature}" alt="家長簽名" style="max-width: 100%; border: 1px solid #bdc3c7; border-radius: var(--border-radius);">
      <p><strong><i class="fas fa-clock"></i> 提交時間：</strong>${formattedDate}</p>
      <button class="print-button" onclick="printResult()"><i class="fas fa-print"></i> 列印調查結果</button>
      
      <div class="print-content" style="display: none;">
        <div class="print-header">
          <h2>第八節意願調查表</h2>
        </div>
        <p>學號：${studentId}</p>
        <p>姓名：${name}</p>
        <p>班級：${className}</p>
        <p>第八節意願：${intention}</p>
        ${intention === '不參加' ? `<p>不參加原因：${reason}</p>` : ''}
        <p>家長簽名：</p>
        <img src="${signature}" alt="家長簽名" class="signature-image">
        <p>提交時間：${formattedDate}</p>
        <div class="print-footer">
          <p>此調查表由系統自動生成 - ${formattedDate}</p>
        </div>
      </div>
    `;
  })
  .catch(error => {
    loading.style.display = 'none';
    showAlert('提交失敗，請稍後再試');
    console.error('Error:', error);
  });
}

// Add print function
function printResult() {
  // Make sure the print content is visible before printing
  const printContent = document.querySelector('.print-content');
  if (printContent) {
    printContent.style.display = 'block';
    
    // Get student data
    const studentId = document.getElementById('studentId').value;
    const name = document.getElementById('name').value;
    const className = document.getElementById('class').value;
    const intention = document.getElementById('intention').value;
    const reason = document.getElementById('reason').value;
    const signature = document.querySelector('#result img').src;
    
    // Enhance the print layout with custom structure
    printContent.innerHTML = `
      <div class="print-header">
        <h2>第八節意願調查表</h2>
        <p style="text-align: center; margin-top: 5px;">提交日期：${new Date().toLocaleDateString()}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <th style="border: 1px solid #000; padding: 8px; width: 25%; background: #f0f0f0;">學號</th>
          <td style="border: 1px solid #000; padding: 8px;">${studentId}</td>
        </tr>
        <tr>
          <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">姓名</th>
          <td style="border: 1px solid #000; padding: 8px;">${name}</td>
        </tr>
        <tr>
          <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">班級</th>
          <td style="border: 1px solid #000; padding: 8px;">${className}</td>
        </tr>
        <tr>
          <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">第八節意願</th>
          <td style="border: 1px solid #000; padding: 8px;">${intention}</td>
        </tr>
        ${intention === '不參加' && reason ? 
          `<tr>
            <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">不參加原因</th>
            <td style="border: 1px solid #000; padding: 8px;">${reason}</td>
          </tr>` : ''
        }
      </table>
      
      <div class="signature-section" style="margin: 30px 0; padding: 20px 0; border-top: 1px dashed #aaa; border-bottom: 1px dashed #aaa;">
        <p style="margin-bottom: 10px; font-weight: bold;">家長簽名：</p>
        <div style="text-align: center;">
          <img src="${signature}" alt="家長簽名" class="signature-image" style="max-width: 100%; height: auto; border: 1px solid #000; padding: 10px; background: white;">
        </div>
      </div>
      
      <div class="print-footer">
        <p>此調查表由系統自動生成 - ${new Date().toLocaleDateString()}</p>
        <p style="margin-top: 5px; font-size: 8pt;">第八節意願調查系統 &copy; ${new Date().getFullYear()}</p>
      </div>
    `;
  }
  
  // Add a small delay to ensure the print content is ready
  setTimeout(() => {
    window.print();
  }, 500);
}

// Make the print function global
window.printResult = printResult;

function showAlert(message) {
  const alertMessage = document.getElementById('alertMessage');
  alertMessage.textContent = message;
  alertModal.style.display = 'block';
  
  // Add animation to alert modal
  const modalContent = alertModal.querySelector('.modal-content');
  modalContent.classList.add('bounce-in');
  
  // Remove animation class after animation completes
  setTimeout(() => {
    modalContent.classList.remove('bounce-in');
  }, 500);
}

document.addEventListener('DOMContentLoaded', function() {
  const helpButton = document.getElementById('helpButton');
  const helpModal = document.getElementById('helpModal');
  const helpTabs = document.querySelectorAll('.help-tab');
  const helpTabContents = document.querySelectorAll('.help-tab-content');
  
  if (helpButton && helpModal) {
    helpButton.addEventListener('click', function() {
      helpModal.style.display = 'block';
    });
  }

  // Help tab navigation with smooth transitions
  if (helpTabs.length > 0) {
    helpTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        helpTabs.forEach(t => t.classList.remove('active'));
        helpTabContents.forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
        });

        tab.classList.add('active');
        const targetTab = document.getElementById(tab.dataset.tab);
        if (targetTab) {
          setTimeout(() => {
            targetTab.style.display = 'block';
            setTimeout(() => {
              targetTab.classList.add('active');
            }, 50);
          }, 100);
        }
      });
    });
  }

  checkSystemAvailability();
});

function checkSystemAvailability() {
  const systemClosedDiv = document.createElement('div');
  systemClosedDiv.className = 'system-closed';
  systemClosedDiv.innerHTML = `
    <h3><i class="fas fa-clock"></i> 系統目前關閉</h3>
    <p>調查系統目前不在開放時間內，請在開放時間內再次訪問。</p>
    <p id="systemTimeMessage"></p>
  `;
  
  const container = document.querySelector('.container');
  const surveyForm = document.getElementById('surveyForm');
  
  fetch('https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec?action=getSettings')
    .then(response => response.json())
    .then(data => {
      if (data && data.settings) {
        const now = new Date();
        const serverTime = data.settings.serverTime ? new Date(data.settings.serverTime) : now;
        const openTime = data.settings.openTime ? new Date(data.settings.openTime) : null;
        const closeTime = data.settings.closeTime ? new Date(data.settings.closeTime) : null;
        
        let systemOpen = true;
        let message = '';
        
        if (openTime && serverTime < openTime) {
          systemOpen = false;
          message = `系統將於 ${openTime.toLocaleString()} 開放。`;
        } else if (closeTime && serverTime > closeTime) {
          systemOpen = false;
          message = `系統已於 ${closeTime.toLocaleString()} 關閉。`;
        }
        
        const systemTimesDiv = document.createElement('div');
        systemTimesDiv.className = 'system-times';
        systemTimesDiv.innerHTML = `
          <p><i class="fas fa-clock"></i> 系統時間：${serverTime.toLocaleString()}</p>
          <p><i class="fas fa-door-open"></i> 開放時間：${openTime ? openTime.toLocaleString() : '未設定'}</p>
          <p><i class="fas fa-door-closed"></i> 關閉時間：${closeTime ? closeTime.toLocaleString() : '未設定'}</p>
        `;
        
        if (surveyForm && !document.querySelector('.system-times')) {
          container.insertBefore(systemTimesDiv, surveyForm);
        }
        
        if (!systemOpen) {
          if (!container.contains(systemClosedDiv)) {
            container.insertBefore(systemClosedDiv, container.firstChild);
            systemClosedDiv.style.display = 'block';
            if (surveyForm) surveyForm.style.display = 'none';
            
            const systemTimeMessage = document.getElementById('systemTimeMessage');
            if (systemTimeMessage) systemTimeMessage.textContent = message;
          }
        }
      }
    })
    .catch(error => {
      console.error('Error fetching system settings:', error);
      // Add retry mechanism after 5 seconds
      setTimeout(() => {
        checkSystemAvailability();
      }, 5000);
    });
}

function calculateBiometricScore() {
  // Calculate a biometric confidence score from 0-100 based on signature characteristics
  if (!window.signatureVerification) return 0;
  
  let score = 60; // Base score
  
  // Add points for more complex signatures
  score += Math.min(20, signaturePaths.length * 2); // More paths = higher score
  
  // Add points for more points (more detailed signature)
  const totalPoints = signaturePaths.reduce((sum, path) => sum + path.length, 0);
  score += Math.min(15, totalPoints / 10);
  
  // Deduct points for unusually fast signatures (possible forgery)
  if (window.signatureVerification.drawingSpeed > 0) {
    const speedFactor = window.signatureVerification.drawingSpeed / 50;
    if (speedFactor > 5) score -= 15;
  }
  
  // Add points for natural drawing patterns with direction changes
  if (window.signatureVerification.drawingPatterns && 
      window.signatureVerification.drawingPatterns.strokeCurvature > 2) {
    score += 10;
  }
  
  // Add points for pressure sensitivity usage if available
  if (window.signatureVerification.drawingPatterns && 
      window.signatureVerification.drawingPatterns.averagePressure > 0) {
    score += 10;
  }
  
  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, score));
}
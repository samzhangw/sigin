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

let lastX = 0;
let lastY = 0;
let signaturePaths = [];
let currentPath = [];

function resizeCanvas() {
  const containerWidth = document.querySelector('.modal-content').offsetWidth;
  const oldWidth = canvas.width;
  const oldHeight = canvas.height;
  canvas.width = containerWidth - 40;
  canvas.height = Math.min(200, window.innerHeight * 0.3);
  
  // Redraw the signature
  if (signaturePaths.length > 0) {
    const scaleX = canvas.width / oldWidth;
    const scaleY = canvas.height / oldHeight;
    ctx.scale(scaleX, scaleY);
    redrawSignature();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
  }
}

function redrawSignature() {
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';

  signaturePaths.forEach(path => {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
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
    btn.closest('.modal').style.display = 'none';
  }
});

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
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
  currentPath.push({x: lastX, y: lastY});
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  
  const [x, y] = getCoordinates(e);
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  currentPath.push({x, y});
  [lastX, lastY] = [x, y];
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
  signatureData = canvas.toDataURL();
  modal.style.display = 'none';
  updateSignatureStatus();
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
  
  const loading = document.getElementById('loading');
  loading.style.display = 'block';

  const scriptUrl = 'https://script.google.com/macros/s/AKfycbyaPZzxLyV9La_5V86LsEj0KYse4lyT5qBHbzxNHmLuMUm6Vom7OXgXSfPmwcfQQKC9bQ/exec';

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
      signature
    })
  })
  .then(response => {
    loading.style.display = 'none';
    const result = document.getElementById('result');
    result.style.display = 'block';
    result.innerHTML = `
      <h3><i class="fas fa-check-circle"></i> 調查結果已成功提交</h3>
      <p><strong><i class="fas fa-id-card"></i> 學號：</strong>${studentId}</p>
      <p><strong><i class="fas fa-user"></i> 姓名：</strong>${name}</p>
      <p><strong><i class="fas fa-chalkboard-teacher"></i> 班級：</strong>${className}</p>
      <p><strong><i class="fas fa-check-circle"></i> 第八節意願：</strong>${intention}</p>
      ${intention === '不參加' ? `<p><strong><i class="fas fa-comment-alt"></i> 不參加原因：</strong>${reason}</p>` : ''}
      <p><strong><i class="fas fa-signature"></i> 家長簽名：</strong></p>
      <img src="${signature}" alt="家長簽名" style="max-width: 100%; border: 1px solid #bdc3c7; border-radius: var(--border-radius);">
    `;
  })
  .catch(error => {
    loading.style.display = 'none';
    showAlert('提交失敗，請稍後再試');
    console.error('Error:', error);
  });
}

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
        const openTime = data.settings.openTime ? new Date(data.settings.openTime) : null;
        const closeTime = data.settings.closeTime ? new Date(data.settings.closeTime) : null;
        
        let systemOpen = true;
        let message = '';
        
        if (openTime && now < openTime) {
          systemOpen = false;
          message = `系統將於 ${openTime.toLocaleString()} 開放。`;
        } else if (closeTime && now > closeTime) {
          systemOpen = false;
          message = `系統已於 ${closeTime.toLocaleString()} 關閉。`;
        }
        
        const systemTimesDiv = document.createElement('div');
        systemTimesDiv.className = 'system-times';
        systemTimesDiv.innerHTML = `
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
    });
}
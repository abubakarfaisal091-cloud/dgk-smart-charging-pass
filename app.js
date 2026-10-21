// Storage Keys & Defaults
const STORAGE_KEY = "DGK_PASSES_DATA";
const PIN_KEY = "DGK_ADMIN_PIN";

let html5QrcodeScanner = null;

// Initialize Storage
function getPassData() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : { counter: 1, passes: [] };
}

function savePassData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getAdminPin() {
  return localStorage.getItem(PIN_KEY) || "1234";
}

// UI Navigation
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.getElementById(`tab-${tabName}-btn`).classList.add('active');

  if (tabName === 'scan') {
    startScanner();
  } else {
    stopScanner();
  }
}

// Auto ID Display
function updateNextTicketId() {
  const data = getPassData();
  const nextId = "DGK-" + String(data.counter).padStart(3, '0');
  document.getElementById('next-ticket-id').innerText = nextId;
}

// Ticket Generation
function generateNewTicket() {
  const data = getPassData();
  const ticketId = "DGK-" + String(data.counter).padStart(3, '0');
  const dateStr = new Date().toLocaleDateString('en-GB');

  const newPass = {
    id: ticketId,
    date: dateStr,
    status: 'ACTIVE'
  };

  data.passes.push(newPass);
  data.counter += 1;
  savePassData(data);

  // Render Card
  document.getElementById('card-ticket-id').innerText = ticketId;
  document.getElementById('card-date').innerText = dateStr;

  // Render QR Code
  const qrContainer = document.getElementById('qrcode');
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: ticketId,
    width: 75,
    height: 75,
    colorDark: "#000000",
    colorLight: "#ffffff"
  });

  document.getElementById('print-btn').style.display = 'block';
  updateNextTicketId();
}

function printTicket() {
  window.print();
}

// QR Scanner Logic
function startScanner() {
  resetScannerUI();
  if (!html5QrcodeScanner) {
    html5QrcodeScanner = new Html5Qrcode("reader");
  }

  const config = { fps: 10, qrbox: { width: 200, height: 200 } };
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    config,
    onScanSuccess
  ).catch(err => {
    console.error("Camera access failed", err);
  });
}

function stopScanner() {
  if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
    html5QrcodeScanner.stop().catch(err => console.error(err));
  }
}

function onScanSuccess(decodedText) {
  stopScanner();
  const data = getPassData();
  const pass = data.passes.find(p => p.id === decodedText.trim());

  const resultCard = document.getElementById('verify-result');
  const statusBadge = document.getElementById('result-status-badge');
  const resultDetails = document.getElementById('result-details');

  resultCard.classList.remove('hidden', 'valid', 'invalid');

  if (pass && pass.status === 'ACTIVE') {
    resultCard.classList.add('valid');
    statusBadge.innerText = "VALID DGK PASS";
    resultDetails.innerHTML = `<p>Ticket ID: <strong>${pass.id}</strong></p><p>Issued Date: ${pass.date}</p>`;
  } else {
    resultCard.classList.add('invalid');
    statusBadge.innerText = "INVALID PASS";
    resultDetails.innerHTML = `<p>Scanned Code: <strong>${decodedText}</strong></p><p>This pass is unauthorized or revoked.</p>`;
  }
}

function resetScannerUI() {
  document.getElementById('verify-result').classList.add('hidden');
  if (html5QrcodeScanner && !html5QrcodeScanner.isScanning) {
    startScanner();
  }
}

// Admin Panel Functions
function loginAdmin() {
  const pinInput = document.getElementById('admin-pin-input').value;
  if (pinInput === getAdminPin()) {
    document.getElementById('admin-login-box').classList.add('hidden');
    document.getElementById('admin-content').classList.remove('hidden');
    renderAdminTable();
  } else {
    alert("Incorrect Admin PIN!");
  }
}

function changePin() {
  const newPin = document.getElementById('new-pin-input').value.trim();
  if (newPin.length >= 4) {
    localStorage.setItem(PIN_KEY, newPin);
    alert("Admin PIN successfully updated!");
    document.getElementById('new-pin-input').value = "";
  } else {
    alert("PIN must be at least 4 digits.");
  }
}

function renderAdminTable() {
  const data = getPassData();
  const tbody = document.getElementById('tickets-list');
  document.getElementById('ticket-count').innerText = data.passes.length;
  tbody.innerHTML = "";

  data.passes.reverse().forEach(pass => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${pass.id}</td>
      <td>${pass.date}</td>
      <td>${pass.status}</td>
      <td><button class="btn-danger" onclick="revokePass('${pass.id}')">Revoke</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function revokePass(id) {
  if (confirm(`Revoke pass ${id}?`)) {
    const data = getPassData();
    const pass = data.passes.find(p => p.id === id);
    if (pass) {
      pass.status = 'REVOKED';
      savePassData(data);
      renderAdminTable();
    }
  }
}

// Export / Import Backup
function exportData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return alert("No data to export!");

  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DGK_Passes_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const json = JSON.parse(e.target.result);
      if (json.counter && Array.isArray(json.passes)) {
        savePassData(json);
        alert("Backup restored successfully!");
        renderAdminTable();
        updateNextTicketId();
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Error reading JSON file.");
    }
  };
  reader.readAsText(file);
}

// Service Worker Registration for PWA Offline mode
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Reg failed:', err));
}

// Initial Load
window.onload = () => {
  updateNextTicketId();
};

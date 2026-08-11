let dataMaster = [];
let dataLog = []; 
let isProcessing = false;
let failedAttempts = 0; 
let scannedNIMs = new Set(); 
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let sesiKegiatan = "";
let currentFacingMode = "environment"; 
let isMirrored = false;
let html5QrCode = null;

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
});

// --- MANAJEMEN LAYER (VIEW SWITCHING) ---
function switchView(viewId) {
    // Sembunyikan semua section
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    // Tampilkan section yang dituju
    const target = document.getElementById(viewId);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
}

function setupEventListeners() {
    // 1. LOGIN SYSTEM
    document.getElementById('btn-login').addEventListener('click', async () => {
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        const errEl = document.getElementById('login-error');
        
        if(!user || !pass) {
            errEl.innerText = "Isi username dan password!";
            errEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('btn-login');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...';
        btn.disabled = true;
        errEl.style.display = 'none';

        // Panggil fungsi auth
        await loadDataMaster(user, pass);
    });

    // 2. DASHBOARD MENU
    document.getElementById('btn-menu-scanner').addEventListener('click', () => {
        switchView('view-setup');
    });

    document.getElementById('btn-menu-rekap').addEventListener('click', () => {
        window.open("https://docs.google.com/spreadsheets/d/1RZKe0ZGAwuJWuhfoOW0qxgMYTmCUFZUPcQO0AKR2kYE/edit?usp=sharing", "_blank");
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        // Hapus data dari memori dan kembalikan ke layar login
        dataMaster = [];
        dataLog = [];
        scannedNIMs.clear();
        document.getElementById('login-user').value = "";
        document.getElementById('login-pass').value = "";
        switchView('view-login');
    });

    // 3. SETUP KEGIATAN
    const selectKategori = document.getElementById('kategori-kegiatan');
    const inputKustom = document.getElementById('kategori-kustom');
    const btnMulai = document.getElementById('btn-mulai-sesi');

    selectKategori.addEventListener('change', (e) => {
        document.getElementById('kustom-container').style.display = e.target.value === "Kustom" ? 'block' : 'none';
        validasiFormSesi();
    });
    inputKustom.addEventListener('input', validasiFormSesi);

    btnMulai.addEventListener('click', () => {
        sesiKegiatan = selectKategori.value === "Kustom" ? inputKustom.value : selectKategori.value;
        
        // Membangun ulang Set memori berdasarkan data Log Vercel (Sinkronisasi)
        scannedNIMs.clear();
        dataLog.forEach(log => {
            if (log.Kegiatan === sesiKegiatan) {
                scannedNIMs.add(String(log.NIM));
            }
        });

        document.getElementById('label-kegiatan-aktif').innerText = sesiKegiatan;
        switchView('view-scanner');
        document.getElementById('session-info').innerText = `Memori Sesi: ${scannedNIMs.size} Hadir`;
        
        startScanner();
    });

    // 4. KONTROL SCANNER UI
    document.getElementById('toggle-manual').addEventListener('click', (e) => {
        e.preventDefault();
        const manCont = document.getElementById('manual-container');
        manCont.style.display = manCont.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('btn-ganti-kamera').addEventListener('click', () => {
        currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
        restartScanner();
    });
    
    document.getElementById('btn-mirror').addEventListener('click', () => {
        isMirrored = !isMirrored;
        const readerEl = document.getElementById('reader');
        if(isMirrored) readerEl.classList.add('mirror-mode');
        else readerEl.classList.remove('mirror-mode');
    });
}

// FUNGSI AUTH & FETCH DATA
async function loadDataMaster(username, password) {
    try {
        const credentials = btoa(`${username}:${password}`);
        const response = await fetch('/api/getMaster', {
            method: 'GET',
            headers: { 'Authorization': `Basic ${credentials}` }
        }); 
        
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || "Gagal Login");

        dataMaster = result.master;
        dataLog = result.log || []; 

        // Beralih ke Dashboard jika login berhasil
        switchView('view-dashboard');
        
    } catch (err) {
        console.error("Auth Error:", err);
        const errEl = document.getElementById('login-error');
        errEl.innerText = err.message;
        errEl.style.display = 'block';
    } finally {
        const btn = document.getElementById('btn-login');
        btn.innerHTML = 'Login Sistem';
        btn.disabled = false;
    }
}

function validasiFormSesi() {
    const val = document.getElementById('kategori-kegiatan').value;
    const kustom = document.getElementById('kategori-kustom').value.trim();
    const btnMulai = document.getElementById('btn-mulai-sesi');
    if (dataMaster.length === 0) return;
    if (val && val !== "Kustom") btnMulai.disabled = false;
    else if (val === "Kustom" && kustom.length > 2) btnMulai.disabled = false;
    else btnMulai.disabled = true;
}

// FUNGSI AUDIO
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'success') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); gain.gain.setValueAtTime(1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2); osc.start(); osc.stop(audioCtx.currentTime + 0.2); } 
    else if (type === 'warning') { osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4); osc.start(); osc.stop(audioCtx.currentTime + 0.4); } 
    else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); gain.gain.setValueAtTime(1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); osc.start(); osc.stop(audioCtx.currentTime + 0.6); }
}

// KONTROL KAMERA
function startScanner() { if(html5QrCode) { html5QrCode.stop().then(() => initCamera()).catch(err => initCamera()); } else { initCamera(); } }
function initCamera() { html5QrCode = new Html5Qrcode("reader"); html5QrCode.start({ facingMode: currentFacingMode }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess).catch(err => { alert("Gagal mengakses kamera."); }); }
function restartScanner() { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => { initCamera(); }); } }

function stopScannerAndBack() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            switchView('view-dashboard');
        }).catch(err => {
            console.error("Gagal stop kamera:", err);
            switchView('view-dashboard');
        });
    } else {
        switchView('view-dashboard');
    }
}

async function onScanSuccess(decodedText) { if (isProcessing) return; performAbsensi(decodedText); }
function processManualInput() { const nim = document.getElementById('manual-nim').value; if (nim.trim() !== "") performAbsensi(nim); }

async function performAbsensi(nim) {
    isProcessing = true;
    const resContainer = document.getElementById('result-container');
    resContainer.style.display = "block";

    if (scannedNIMs.has(nim)) {
        playSound('warning');
        showResult("warning", "PERINGATAN!", "NIM: " + nim, "-", "SUDAH ABSEN DI SESI INI.");
        resetScanner(); return;
    }

    const anggota = dataMaster.find(item => item.NIM == String(nim));

    if (anggota) {
        scannedNIMs.add(String(nim));
        document.getElementById('session-info').innerText = `Memori Sesi: ${scannedNIMs.size} Hadir`;
        failedAttempts = 0; 
        playSound('success'); 
        
        const imgFoto = document.getElementById('res-foto');
        if (anggota.Foto) { imgFoto.src = anggota.Foto; imgFoto.style.display = "inline-block"; } 
        else { imgFoto.style.display = "none"; }

        showResult("success", anggota.Nama, "NIM: " + anggota.NIM, "Divisi: " + anggota.Divisi, "BERHASIL");
        kirimKeGoogleSheets(anggota, "Hadir");
    } else {
        failedAttempts++;
        playSound('error'); 
        document.getElementById('res-foto').style.display = "none"; 
        showResult("error", "TIDAK TERDAFTAR", "NIM: " + nim, "-", "Cek master data DPO.");
        if (failedAttempts >= 3) document.getElementById('manual-container').style.display = 'block';
    }
    resetScanner();
}

function showResult(cls, nama, nim, div, msg) {
    const res = document.getElementById('result-container');
    res.className = cls;
    document.getElementById('res-nama').innerText = nama;
    document.getElementById('res-nim').innerText = nim;
    document.getElementById('res-divisi').innerText = div;
    document.getElementById('res-msg').innerText = msg;
}

function resetScanner() { setTimeout(() => { isProcessing = false; document.getElementById('result-container').style.display = "none"; }, 4500); }

async function kirimKeGoogleSheets(mhs, status) {
    try {
        await fetch('/api/postLog', { 
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nim: mhs.NIM, nama: mhs.Nama, divisi: mhs.Divisi, status: status, kegiatan: sesiKegiatan }) 
        });
    } catch (err) { console.error("Gagal mengirim log:", err); }
}
let dataMaster = [];
let isProcessing = false;
let failedAttempts = 0; 
const scannedNIMs = new Set(); 
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Variabel Kontrol Sesi & Kamera
let sesiKegiatan = "";
let currentFacingMode = "environment"; // default kamera belakang
let isMirrored = false;
let html5QrCode = null;

// --- INISIALISASI HALAMAN ---
document.addEventListener("DOMContentLoaded", () => {
    loadDataMaster();
    setupEventListeners();
});

function setupEventListeners() {
    const selectKategori = document.getElementById('kategori-kegiatan');
    const inputKustom = document.getElementById('kategori-kustom');
    const btnMulai = document.getElementById('btn-mulai-sesi');

    // Kontrol Dropdown Kegiatan
    selectKategori.addEventListener('change', (e) => {
        if (e.target.value === "Kustom") {
            document.getElementById('kustom-container').style.display = 'block';
        } else {
            document.getElementById('kustom-container').style.display = 'none';
        }
        validasiFormSesi();
    });

    inputKustom.addEventListener('input', validasiFormSesi);

    // Tombol Mulai Scanner
    btnMulai.addEventListener('click', () => {
        sesiKegiatan = selectKategori.value === "Kustom" ? inputKustom.value : selectKategori.value;
        
        document.getElementById('label-kegiatan-aktif').innerText = sesiKegiatan;
        document.getElementById('setup-panel').style.display = 'none';
        document.getElementById('scanner-panel').style.display = 'block';
        
        startScanner();
    });

    // Kontrol UI Manual & Kamera
    document.getElementById('toggle-manual').addEventListener('click', (e) => {
        e.preventDefault();
        const manCont = document.getElementById('manual-container');
        manCont.style.display = manCont.style.display === 'none' ? 'block' : 'none';
    });

    // Tombol Putar Kamera
    document.getElementById('btn-ganti-kamera').addEventListener('click', () => {
        currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
        restartScanner();
    });

    // Tombol Mirror Kamera
    document.getElementById('btn-mirror').addEventListener('click', () => {
        isMirrored = !isMirrored;
        const readerEl = document.getElementById('reader');
        if(isMirrored) {
            readerEl.classList.add('mirror-mode');
        } else {
            readerEl.classList.remove('mirror-mode');
        }
    });
}

function validasiFormSesi() {
    const val = document.getElementById('kategori-kegiatan').value;
    const kustom = document.getElementById('kategori-kustom').value.trim();
    const btnMulai = document.getElementById('btn-mulai-sesi');
    
    // Jangan izinkan mulai jika data belum dimuat
    if (dataMaster.length === 0) return;

    if (val && val !== "Kustom") {
        btnMulai.disabled = false;
    } else if (val === "Kustom" && kustom.length > 2) {
        btnMulai.disabled = false;
    } else {
        btnMulai.disabled = true;
    }
}

// --- FUNGSI AUDIO ---
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (type === 'success') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'warning') {
        osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    }
}

// --- FETCH DATA VERCEL ---
async function loadDataMaster() {
    try {
        const response = await fetch('/api/getMaster'); 
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        dataMaster = await response.json();
        if (dataMaster.error) throw new Error(dataMaster.error);

        const statusEl = document.getElementById('status-data');
        statusEl.innerText = "Data Master Siap. Silakan pilih kegiatan.";
        statusEl.style.color = "var(--success)";
        
        // Panggil validasi form agar tombol terbuka jika sudah ada isinya
        validasiFormSesi();
    } catch (err) {
        console.error("Detail Error Load Master:", err);
        const statusEl = document.getElementById('status-data');
        statusEl.innerText = "Sistem Offline / Gagal memuat data.";
        statusEl.style.color = "var(--danger)";
    }
}

// --- KONTROL KAMERA QR ---
function startScanner() {
    if(html5QrCode) { html5QrCode.stop().then(() => initCamera()).catch(err => initCamera()); } 
    else { initCamera(); }
}

function initCamera() {
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: currentFacingMode }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        onScanSuccess
    ).catch(err => {
        console.error("Error mulai kamera:", err);
        alert("Gagal mengakses kamera. Coba ganti sisi kamera atau cek izin browser.");
    });
}

function restartScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            initCamera();
        }).catch(err => {
            console.error("Gagal stop kamera:", err);
        });
    }
}

async function onScanSuccess(decodedText) {
    if (isProcessing) return;
    performAbsensi(decodedText);
}

function processManualInput() {
    const nim = document.getElementById('manual-nim').value;
    if (nim.trim() !== "") performAbsensi(nim);
}

// --- LOGIKA ABSENSI ---
async function performAbsensi(nim) {
    isProcessing = true;
    const resContainer = document.getElementById('result-container');

    resContainer.style.display = "block";

    if (scannedNIMs.has(nim)) {
        playSound('warning');
        showResult("warning", "PERINGATAN!", "NIM: " + nim, "-", "SUDAH ABSEN DI SESI INI.");
        resetScanner(); return;
    }

    const anggota = dataMaster.find(item => item.NIM == nim);

    if (anggota) {
        scannedNIMs.add(nim);
        document.getElementById('session-info').innerText = `Memori Sesi: ${scannedNIMs.size} Hadir`;
        failedAttempts = 0; 
        playSound('success'); 

        const imgFoto = document.getElementById('res-foto');
        if (anggota.Foto) {
            imgFoto.src = anggota.Foto;
            imgFoto.style.display = "inline-block";
        } else {
            imgFoto.style.display = "none"; 
        }

        showResult("success", anggota.Nama, "NIM: " + anggota.NIM, "Divisi: " + anggota.Divisi, "BERHASIL");
        
        // KIRIM DATA DITAMBAH NAMA KEGIATAN
        kirimKeGoogleSheets(anggota, "Hadir");
    } else {
        failedAttempts++;
        playSound('error'); 
        document.getElementById('res-foto').style.display = "none"; 
        showResult("error", "TIDAK TERDAFTAR", "NIM: " + nim, "-", "Cek master data DPO.");
        
        if (failedAttempts >= 3) {
            document.getElementById('manual-container').style.display = 'block';
        }
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

function resetScanner() {
    setTimeout(() => { 
        isProcessing = false; 
        document.getElementById('result-container').style.display = "none"; 
    }, 4500); 
}

// --- PENGIRIMAN KE API VERCEL ---
async function kirimKeGoogleSheets(mhs, status) {
    try {
        await fetch('/api/postLog', { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Menambahkan Payload Kegiatan
            body: JSON.stringify({
                nim: mhs.NIM, 
                nama: mhs.Nama, 
                divisi: mhs.Divisi, 
                status: status,
                kegiatan: sesiKegiatan // Variabel dari form awal
            }) 
        });
    } catch (err) {
        console.error("Gagal mengirim log:", err);
    }
}
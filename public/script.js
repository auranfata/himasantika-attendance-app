let dataMaster = [];
let isProcessing = false;
let failedAttempts = 0; 
const scannedNIMs = new Set(); 
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 1. FUNGSI AUDIO (3 Indikator Berbeda)
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (type === 'success') {
        // BERHASIL: Nada tinggi, jernih (Ting!)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'warning') {
        // SUDAH ABSEN: Nada sedang, mengalun (Tet!)
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else {
        // GAGAL/TIDAK TERDAFTAR: Nada sangat rendah, kasar (Buzzer!)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    }
}

// 1. UPDATE: Fungsi Fetch On Load
async function loadDataMaster() {
    try {
        // Tembak ke API lokal Vercel
        const response = await fetch('/api/getMaster'); 
        dataMaster = await response.json();
        
        if (dataMaster.error) throw new Error(dataMaster.error);

        document.getElementById('status-data').innerText = "Data Master Siap.";
        document.getElementById('status-data').style.color = "green";
        startScanner();
    } catch (err) {
        document.getElementById('status-data').innerText = "Sistem Offline / Gagal memuat data.";
        document.getElementById('status-data').style.color = "red";
    }
}

async function kirimKeGoogleSheets(mhs, status) {
    try {
        // Tembak ke API lokal Vercel
        await fetch('/api/postLog', { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({nim: mhs.NIM, nama: mhs.Nama, divisi: mhs.Divisi, status: status}) 
        });
    } catch (err) {
        console.error("Gagal mengirim data:", err);
    }
}

// 3. START SCANNER
function startScanner() {
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess);
}

async function onScanSuccess(decodedText) {
    if (isProcessing) return;
    performAbsensi(decodedText);
}

function processManualInput() {
    const nim = document.getElementById('manual-nim').value;
    if (nim.trim() !== "") performAbsensi(nim);
}

// 4. LOGIKA ABSENSI UTAMA
async function performAbsensi(nim) {
    isProcessing = true;
    const resContainer = document.getElementById('result-container');
    const now = new Date();
    const timeString = now.toLocaleDateString('id-ID') + " " + now.toLocaleTimeString('id-ID');

    resContainer.style.display = "block";

    // Cek Double Scan
    if (scannedNIMs.has(nim)) {
        playSound('warning'); // Suara beda
        showResult("warning", "PERINGATAN!", "NIM: " + nim, "-", "Anggota ini SUDAH ABSEN.");
        resetScanner(); return;
    }

    const anggota = dataMaster.find(item => item.NIM == nim);

    if (anggota) {
        scannedNIMs.add(nim);
        document.getElementById('session-info').innerText = "Memori Sesi: " + scannedNIMs.size + " Hadir";
        failedAttempts = 0; 
        playSound('success'); 

        // Tampilkan Foto
        const imgFoto = document.getElementById('res-foto');
        if (anggota.Foto) {
            imgFoto.src = anggota.Foto;
            imgFoto.style.display = "inline-block";
        } else {
            imgFoto.style.display = "none"; // Sembunyikan jika tidak ada foto
        }

        showResult("success", anggota.Nama, "NIM: " + anggota.NIM, "Divisi: " + anggota.Divisi, "BERHASIL DICATAT");
        kirimKeGoogleSheets(anggota, "Hadir");
    } else {
        failedAttempts++;
        playSound('error'); 
        
        // Sembunyikan foto saat error
        document.getElementById('res-foto').style.display = "none"; 
        
        showResult("error", "TIDAK TERDAFTAR", "NIM: " + nim, "-", "Silakan cek data atau input manual.");
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

// JEDA WAKTU POP-UP: Diubah menjadi 4.5 Detik
function resetScanner() {
    setTimeout(() => { 
        isProcessing = false; 
        document.getElementById('result-container').style.display = "none"; 
    }, 4500); 
}

// MENGIRIM KE DATABASE (Tanpa memblokir UI)
async function kirimKeGoogleSheets(mhs, status) {
    try {
        await fetch(GAS_URL, { 
            method: "POST", 
            body: JSON.stringify({nim: mhs.NIM, nama: mhs.Nama, divisi: mhs.Divisi, status: status}) 
        });
    } catch (err) {
        console.error("Gagal mengirim data:", err);
        // DPO belum tahu kalau ini gagal.
    }
}

loadDataMaster();
let dataMaster = [];
let isProcessing = false;
let failedAttempts = 0; 
const scannedNIMs = new Set(); 
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 1. FUNGSI AUDIO
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'warning') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    }
}

// 2. FUNGSI FETCH ON LOAD
async function loadDataMaster() {
    try {
        const response = await fetch('/api/getMaster'); 
        
        // Cek jika status bukan 200 OK (misal 404 atau 500)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        dataMaster = await response.json();
        
        if (dataMaster.error) throw new Error(dataMaster.error);

        document.getElementById('status-data').innerText = "Data Master Siap.";
        document.getElementById('status-data').style.color = "green";
        startScanner();
    } catch (err) {
        console.error("Detail Error Load Master:", err);
        document.getElementById('status-data').innerText = "Sistem Offline / Gagal memuat data.";
        document.getElementById('status-data').style.color = "red";
    }
}

// 3. FUNGSI KIRIM LOG (Hanya ada SATU fungsi ini)
async function kirimKeGoogleSheets(mhs, status) {
    try {
        await fetch('/api/postLog', { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({nim: mhs.NIM, nama: mhs.Nama, divisi: mhs.Divisi, status: status}) 
        });
    } catch (err) {
        console.error("Gagal mengirim data:", err);
    }
}

// 4. START SCANNER
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

// 5. LOGIKA ABSENSI UTAMA
async function performAbsensi(nim) {
    isProcessing = true;
    const resContainer = document.getElementById('result-container');
    const now = new Date();
    const timeString = now.toLocaleDateString('id-ID') + " " + now.toLocaleTimeString('id-ID');

    resContainer.style.display = "block";

    if (scannedNIMs.has(nim)) {
        playSound('warning');
        showResult("warning", "PERINGATAN!", "NIM: " + nim, "-", "Anggota ini SUDAH ABSEN.");
        resetScanner(); return;
    }

    const anggota = dataMaster.find(item => item.NIM == nim);

    if (anggota) {
        scannedNIMs.add(nim);
        document.getElementById('session-info').innerText = "Memori Sesi: " + scannedNIMs.size + " Hadir";
        failedAttempts = 0; 
        playSound('success'); 

        const imgFoto = document.getElementById('res-foto');
        if (anggota.Foto) {
            imgFoto.src = anggota.Foto;
            imgFoto.style.display = "inline-block";
        } else {
            imgFoto.style.display = "none"; 
        }

        showResult("success", anggota.Nama, "NIM: " + anggota.NIM, "Divisi: " + anggota.Divisi, "BERHASIL DICATAT");
        kirimKeGoogleSheets(anggota, "Hadir");
    } else {
        failedAttempts++;
        playSound('error'); 
        
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

function resetScanner() {
    setTimeout(() => { 
        isProcessing = false; 
        document.getElementById('result-container').style.display = "none"; 
    }, 4500); 
}

loadDataMaster();
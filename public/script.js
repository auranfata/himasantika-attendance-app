let dataMaster = [];
let dataLog = []; 
let dataKegiatan = []; 
let isProcessing = false;
let failedAttempts = 0; 
let scannedNIMs = new Set(); 
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let sesiKegiatan = ""; // Akan berisi UUID dari Supabase
let currentFacingMode = "environment"; 
let isMirrored = false;
let html5QrCode = null;
let chartKehadiran = null;
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
});

// --- MANAJEMEN LAYER (VIEW SWITCHING) ---
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    
    const target = document.getElementById(viewId);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }

    // MANUVER UX: Perlebar kontainer khusus untuk halaman rekap
    const appContainer = document.querySelector('.app-container');
    if (viewId === 'view-rekap') {
        appContainer.classList.add('wide-mode');
    } else {
        appContainer.classList.remove('wide-mode');
    }
}

// --- SETUP EVENT LISTENERS ---
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

        await loadDataMaster(user, pass);
    });

    // 2. DASHBOARD MENU
    document.getElementById('btn-menu-scanner').addEventListener('click', () => {
        refreshDropdownKegiatan(); // Memastikan dropdown menarik data terbaru dari memori
        switchView('view-setup');
    });
    
    document.getElementById('btn-menu-rekap').addEventListener('click', () => {
       siapkanTabelRekap();
       switchView('view-rekap');
    });

    document.getElementById('btn-menu-kegiatan').addEventListener('click', () => {
        renderDaftarKegiatan(); // Render tabel dulu
        switchView('view-manage-kegiatan'); // Baru pindah layar
    });

    document.getElementById('btn-menu-anggota').addEventListener('click', () => {
        renderDaftarAnggota(); // Render tabel anggota saat dibuka
        switchView('view-manage-anggota');
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        dataMaster = []; dataLog = []; dataKegiatan = []; scannedNIMs.clear();
        document.getElementById('login-user').value = "";
        document.getElementById('login-pass').value = "";
        switchView('view-login');
    });


    // 3. SETUP KEGIATAN
    const selectKategori = document.getElementById('kategori-kegiatan');
    const btnMulai = document.getElementById('btn-mulai-sesi');

    selectKategori.addEventListener('change', validasiFormSesi);

    btnMulai.addEventListener('click', () => {
        sesiKegiatan = selectKategori.value; // ID UUID Kegiatan
        
        const kegiatanTerpilih = dataKegiatan.find(k => k.id === sesiKegiatan);
        const namaTampil = kegiatanTerpilih ? kegiatanTerpilih.nama_kegiatan : "Kegiatan Aktif";

        // Membangun Set memori berdasarkan log dari Supabase
        scannedNIMs.clear();
        dataLog.forEach(log => {
            if (log.kegiatan_id === sesiKegiatan) {
                scannedNIMs.add(String(log.nim));
            }
        });

        document.getElementById('label-kegiatan-aktif').innerText = namaTampil;
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

// --- FUNGSI AUTH & FETCH DARI SUPABASE ---
async function loadDataMaster(username, password) {
    try {
        const credentials = btoa(`${username}:${password}`);
        const response = await fetch('/api/getMaster', {
            method: 'GET',
            headers: { 'Authorization': `Basic ${credentials}` }
        }); 
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gagal Login");

        // Tangkap 3 tabel dari API Supabase kita
        dataMaster = result.master || [];
        dataLog = result.log || []; 
        dataKegiatan = result.kegiatan || [];

        // Injeksi data kegiatan ke Dropdown HTML secara dinamis
        const selectEl = document.getElementById('kategori-kegiatan');
        selectEl.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan Aktif --</option>';
        
        dataKegiatan.forEach(kegiatan => {
            const option = document.createElement('option');
            option.value = kegiatan.id;
            option.textContent = `${kegiatan.nama_kegiatan}`;
            selectEl.appendChild(option);
        });

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
    const btnMulai = document.getElementById('btn-mulai-sesi');
    btnMulai.disabled = (!val || val === "");
}

// --- FUNGSI AUDIO ---
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'success') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); gain.gain.setValueAtTime(1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2); osc.start(); osc.stop(audioCtx.currentTime + 0.2); } 
    else if (type === 'warning') { osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4); osc.start(); osc.stop(audioCtx.currentTime + 0.4); } 
    else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); gain.gain.setValueAtTime(1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); osc.start(); osc.stop(audioCtx.currentTime + 0.6); }
}

// --- KONTROL KAMERA ---
function startScanner() { if(html5QrCode) { html5QrCode.stop().then(() => initCamera()).catch(err => initCamera()); } else { initCamera(); } }
function initCamera() { html5QrCode = new Html5Qrcode("reader"); html5QrCode.start({ facingMode: currentFacingMode }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess).catch(err => { alert("Gagal mengakses kamera."); }); }
function restartScanner() { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => { initCamera(); }); } }

function stopScannerAndBack() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => switchView('view-dashboard')).catch(err => switchView('view-dashboard'));
    } else { switchView('view-dashboard'); }
}

async function onScanSuccess(decodedText) { if (isProcessing) return; performAbsensi(decodedText); }
function processManualInput() { const nim = document.getElementById('manual-nim').value; if (nim.trim() !== "") performAbsensi(nim); }

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

    const anggota = dataMaster.find(item => item.nim == String(nim));

    if (anggota) {
        scannedNIMs.add(String(nim));
        document.getElementById('session-info').innerText = `Memori Sesi: ${scannedNIMs.size} Hadir`;
        failedAttempts = 0; 
        playSound('success'); 
        
        const imgFoto = document.getElementById('res-foto');
        if (anggota.foto_url) { imgFoto.src = anggota.foto_url; imgFoto.style.display = "inline-block"; } 
        else { imgFoto.style.display = "none"; }

        // --- KALKULASI KETERLAMBATAN OTOMATIS ---
        const kegiatanTerpilih = dataKegiatan.find(k => k.id === sesiKegiatan);
        let statusKehadiran = "HADIR";
        
        if (kegiatanTerpilih && kegiatanTerpilih.waktu_mulai) {
            const waktuMulai = new Date(kegiatanTerpilih.waktu_mulai);
            const batasToleransi = kegiatanTerpilih.batas_toleransi || 0; // dalam menit
            const waktuSekarang = new Date();
            
            // Hitung selisih dalam menit
            const selisihMenit = (waktuSekarang - waktuMulai) / (1000 * 60);
            
            if (selisihMenit > batasToleransi) {
                statusKehadiran = "TERLAMBAT";
            }
        }

        showResult("success", anggota.nama, "NIM: " + anggota.nim, "Divisi: " + anggota.divisi, statusKehadiran);
        
        // Kirim status yang sudah dikalkulasi ke database
        kirimKeDatabase(anggota, statusKehadiran);
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

// --- FITUR TIER 1: REKAPITULASI & EXPORT ---
function siapkanTabelRekap() {
    const filterEl = document.getElementById('filter-kegiatan');
    filterEl.innerHTML = '<option value="ALL">Semua Kegiatan</option>';
    dataKegiatan.forEach(k => {
        filterEl.innerHTML += `<option value="${k.id}">${k.nama_kegiatan}</option>`;
    });

    filterEl.onchange = () => renderTabelRekap(filterEl.value);
    renderTabelRekap("ALL");
}

function renderTabelRekap(filterId) {
    const tbody = document.getElementById('body-rekap');
    tbody.innerHTML = "";

    // Sortir data log dari yang paling baru
    let filteredLog = [...dataLog].sort((a, b) => new Date(b.waktu_scan) - new Date(a.waktu_scan));
    
    if (filterId !== "ALL") {
        filteredLog = filteredLog.filter(log => log.kegiatan_id === filterId);
    }

    // Variabel untuk menghitung statistik Grafik
    let totalHadir = 0;
    let totalTerlambat = 0;

    filteredLog.forEach(log => {
        const profil = dataMaster.find(m => m.nim === log.nim);
        const namaAnggota = profil ? profil.nama : "Tidak Diketahui";
        
        const acara = dataKegiatan.find(k => k.id === log.kegiatan_id);
        const namaAcara = acara ? acara.nama_kegiatan : "Event Dihapus";

        const formatWaktu = new Date(log.waktu_scan).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'
        });

        // Hitung untuk Grafik
        if (log.status_kehadiran === 'HADIR') totalHadir++;
        if (log.status_kehadiran === 'TERLAMBAT') totalTerlambat++;

        const warnaStatus = log.status_kehadiran === 'TERLAMBAT' ? 'color: red; font-weight: bold;' : 'color: green;';

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee; text-align: left;">
                <td style="padding: 10px;">${formatWaktu}</td>
                <td style="padding: 10px;">${log.nim}</td>
                <td style="padding: 10px;">${namaAnggota}</td>
                <td style="padding: 10px;">${namaAcara}</td>
                <td style="padding: 10px; ${warnaStatus}">${log.status_kehadiran}</td>
            </tr>
        `;
    });

    // Panggil fungsi render grafik
    renderGrafik(totalHadir, totalTerlambat);
}

// Fungsi Khusus Membangun Grafik Chart.js
function renderGrafik(hadir, telat) {
    const ctx = document.getElementById('kehadiranChart');
    if (!ctx) return;

    // Hancurkan grafik lama jika sudah ada (agar tidak tumpang tindih saat ganti filter)
    if (chartKehadiran) {
        chartKehadiran.destroy();
    }

    chartKehadiran = new Chart(ctx, {
        type: 'doughnut', // Anda bisa ganti menjadi 'bar' atau 'pie'
        data: {
            labels: ['Hadir Tepat Waktu', 'Terlambat'],
            datasets: [{
                data: [hadir, telat],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function exportExcel() {
    const table = document.getElementById("tabel-rekap");
    const workbook = XLSX.utils.table_to_book(table, {sheet: "Rekap Kehadiran"});
    XLSX.writeFile(workbook, `Rekap_HIMASANTIKA_${new Date().getTime()}.xlsx`);
}

function exportPDF() {
    const table = document.getElementById("tabel-rekap");
    const opt = {
        margin:       1,
        filename:     `Rekap_HIMASANTIKA_${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    // Menggunakan library html2pdf
    html2pdf().set(opt).from(table).save();
}

// --- PENGIRIMAN DATA KE BACKEND VERCEL ---
async function kirimKeDatabase(mhs, status) {
    try {
        await fetch('/api/postLog', { 
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                nim: mhs.nim, 
                status: status, 
                kegiatan_id: sesiKegiatan 
            }) 
        });
    } catch (err) { console.error("Gagal mengirim log:", err); }
}

// =======================================================
//  MANAJEMEN KEGIATAN (CRUD)
// =======================================================

async function tambahKegiatanBaru() {
    const nama = document.getElementById('crud-nama-acara').value.trim();
    const waktu = document.getElementById('crud-waktu-mulai').value;
    const toleransi = document.getElementById('crud-toleransi').value;
    const msgEl = document.getElementById('msg-kegiatan');

    if (!nama || !waktu || !toleransi) {
        msgEl.innerText = "Harap isi semua kolom dengan benar!";
        msgEl.style.color = "red";
        msgEl.style.display = "block";
        return;
    }

    const btn = document.getElementById('btn-tambah-kegiatan');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;
    msgEl.style.display = "none";

    try {
        const response = await fetch('/api/postKegiatan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama_kegiatan: nama,
                waktu_mulai: waktu, 
                batas_toleransi: toleransi
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gagal menyimpan");

        // Reset Formulir
        document.getElementById('crud-nama-acara').value = "";
        document.getElementById('crud-waktu-mulai').value = "";
        document.getElementById('crud-toleransi').value = "";

        // Push data baru ke RAM agar tidak perlu refresh halaman
        if (result.data && result.data.length > 0) {
            dataKegiatan.push(result.data[0]);
        }

        msgEl.innerText = "Kegiatan berhasil ditambahkan!";
        msgEl.style.color = "green";
        msgEl.style.display = "block";

        renderDaftarKegiatan(); // Segarkan tabel di bawah form

    } catch (err) {
        msgEl.innerText = err.message;
        msgEl.style.color = "red";
        msgEl.style.display = "block";
    } finally {
        btn.innerHTML = 'Simpan Kegiatan';
        btn.disabled = false;
        setTimeout(() => { msgEl.style.display = "none"; }, 3500);
    }
}

function refreshDropdownKegiatan() {
    const selectEl = document.getElementById('kategori-kegiatan');
    selectEl.innerHTML = '<option value="" disabled selected>-- Pilih Kegiatan Aktif --</option>';
    
    dataKegiatan.forEach(kegiatan => {
        const option = document.createElement('option');
        option.value = kegiatan.id;
        option.textContent = `${kegiatan.nama_kegiatan}`;
        selectEl.appendChild(option);
    });
    validasiFormSesi();
}

function renderDaftarKegiatan() {
    const tbody = document.getElementById('body-list-kegiatan');
    tbody.innerHTML = "";

    if (dataKegiatan.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 10px;">Belum ada kegiatan.</td></tr>`;
        return;
    }

async function tambahAnggotaBaru() {
    const nim = document.getElementById('crud-nim-anggota').value.trim();
    const nama = document.getElementById('crud-nama-anggota').value.trim();
    const divisi = document.getElementById('crud-divisi-anggota').value.trim();
    const msgEl = document.getElementById('msg-anggota');

    if (!nim || !nama || !divisi) {
        msgEl.innerText = "Harap isi seluruh kolom form!";
        msgEl.style.color = "red";
        msgEl.style.display = "block";
        return;
    }

    const btn = document.getElementById('btn-tambah-anggota');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;
    msgEl.style.display = "none";

    try {
        const response = await fetch('/api/postAnggota', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nim, nama, divisi })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gagal menyimpan");

        document.getElementById('crud-nim-anggota').value = "";
        document.getElementById('crud-nama-anggota').value = "";
        document.getElementById('crud-divisi-anggota').value = "";

        // Push data baru ke RAM browser
        if (result.data && result.data.length > 0) {
            dataMaster.push(result.data[0]);
        }

        msgEl.innerText = "Data Anggota berhasil ditambahkan!";
        msgEl.style.color = "green";
        msgEl.style.display = "block";

        renderDaftarAnggota(); // Segarkan tabel UI

    } catch (err) {
        msgEl.innerText = err.message;
        msgEl.style.color = "red";
        msgEl.style.display = "block";
    } finally {
        btn.innerHTML = 'Simpan Anggota';
        btn.disabled = false;
        setTimeout(() => { msgEl.style.display = "none"; }, 3500);
    }
}

function renderDaftarAnggota() {
    const tbody = document.getElementById('body-list-anggota');
    tbody.innerHTML = "";

    if (dataMaster.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 10px;">Belum ada data anggota terdaftar.</td></tr>`;
        return;
    }

    const reversedData = [...dataMaster].reverse();

    reversedData.forEach(anggota => {
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; font-weight: bold;">${anggota.nim}</td>
                <td style="padding: 8px;">
                    ${anggota.nama}<br>
                    <span style="font-size: 0.75rem; color: #666;">Divisi: ${anggota.divisi || '-'}</span>
                </td>
            </tr>
        `;
    });
}

    // Tampilkan data paling baru di atas
    const reversedData = [...dataKegiatan].reverse();

    reversedData.forEach(kegiatan => {
        const formatWaktu = kegiatan.waktu_mulai 
            ? new Date(kegiatan.waktu_mulai).toLocaleString('id-ID', {day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit'}) 
            : '-';

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">
                    <strong>${kegiatan.nama_kegiatan}</strong><br>
                    <span style="font-size: 0.75rem; color: #666;">${formatWaktu}</span>
                </td>
                <td style="padding: 8px; text-align: center;">${kegiatan.batas_toleransi || 0} mnt</td>
                <td style="padding: 8px; text-align: center;">
                    <span class="badge" style="background: ${kegiatan.status === 'AKTIF' ? 'var(--success)' : '#999'}">${kegiatan.status}</span>
                </td>
            </tr>
        `;
    });
}
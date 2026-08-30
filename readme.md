Sistem Absensi QR Code DPO HIMASANTIKA
Sistem absensi berbasis Single Page Application (SPA) yang dirancang khusus untuk Departemen Pengembangan Organisasi (DPO) HIMASANTIKA. Sistem ini memadukan pemindai QR Code dengan verifikasi visual, proteksi double-scan, dan sinkronisasi data lintas perangkat secara real-time menggunakan infrastruktur tanpa server (serverless).

Fitur Utama
Otentikasi Panitia Tertutup: Akses aplikasi digembok menggunakan sistem Role-Based Access Control statis. Hanya panitia dengan kredensial valid yang dapat membuka portal scanner.

Manajemen Sesi Kegiatan: Panitia dapat mendefinisikan kategori acara (Rapat Pleno, Diklat, Open Recruitment, dll) sebelum pemindaian dimulai. Data akan terklasifikasi otomatis di basis data.

Sinkronisasi Memori Lintas Perangkat: Sistem membaca riwayat absensi historis dari database saat login, mencegah anggota melakukan scan ganda meskipun panitia menggunakan dua perangkat (HP dan Laptop) yang berbeda.

Kontrol Kamera Fleksibel: Mendukung peralihan lensa (kamera depan/belakang) dan mode mirroring (cermin) untuk menyesuaikan ergonomi posisi panitia di lapangan.

Verifikasi Visual & Audio: Memberikan feedback berupa suara yang berbeda (Berhasil, Gagal, Sudah Absen) dan memunculkan foto wajah anggota secara real-time untuk mencegah kecurangan titip absen.

Tautan Rekap Terenkripsi: Tautan basis data Google Sheets disembunyikan menggunakan API Redirect di sisi server, mencegah kebocoran URL kepada publik.

Teknologi yang Digunakan
Frontend: HTML5, CSS3 (Custom Card-UI), Vanilla JavaScript (ES6+).

Library Pemindai: html5-qrcode (Pemrosesan gambar ke teks secara lokal di perangkat).

Backend / API Proxy: Vercel Serverless Functions (Node.js).

Database & Micro-service: Google Sheets & Google Apps Script (REST API doGet dan doPost).

Logika dan Mekanisme Sistem
Sistem ini beroperasi dengan memisahkan beban kerja antara Klien (Browser), Proksi (Vercel), dan Basis Data (Google).

Mekanisme Otentikasi & Pemuatan Data (Fetch-on-Load)

Klien mengirimkan kredensial otentikasi dasar (Basic Auth) ke endpoint /api/getMaster.

Vercel memvalidasi kredensial. Jika valid, Vercel meneruskan permintaan ke URL Google Apps Script.

Google mengembalikan dua set data sekaligus: Master_Anggota (daftar anggota valid) dan Log_Absensi (riwayat kehadiran).

Klien menyimpan data ini di dalam memori RAM (browser).

Mekanisme Sinkronisasi Sesi (State Management)

Saat panitia memilih "Kategori Kegiatan" dan menekan tombol mulai, sistem mencocokkan data historis Log_Absensi dengan kegiatan yang dipilih.

Anggota yang sudah terekam pada kegiatan tersebut langsung dimasukkan ke dalam scannedNIMs (Memori Sesi).

Mekanisme Validasi Pemindaian (QR Scanning)

Kamera membaca teks QR (NIM) dan mengirimkannya ke fungsi validasi lokal.

Cek 1 (Duplikasi): Apakah NIM ada di dalam scannedNIMs? Jika ya, tolak (Suara Peringatan).

Cek 2 (Registrasi): Apakah NIM ada di Master_Anggota? Jika tidak, tolak (Suara Gagal).

Jika lolos kedua cek, sistem menampilkan UI Berhasil (Foto + Nama) dan memainkan nada sukses.

Mekanisme Pencatatan (Asynchronous Logging)

Data kehadiran yang valid dikirim ke Vercel via /api/postLog di latar belakang (non-blocking), bersamaan dengan parameter "Kegiatan".

Vercel meneruskan data ke Google Apps Script yang mengeksekusi appendRow untuk mencatat waktu, identitas, dan status kehadiran.
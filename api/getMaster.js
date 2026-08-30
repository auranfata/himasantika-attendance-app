export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    // 1. Validasi Autentikasi (Sama seperti sebelumnya)
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Akses ditolak.' });
    const base64Credentials = authHeader.split(' ')[1];
    const [username, password] = Buffer.from(base64Credentials, 'base64').toString('ascii').split(':');

    const validAccounts = {
        "HarisDPO2026": "dpo2026A",
        "NitaDPO2026": "dpo2026B",
        "AdeDPO2026": "dpo2026C",
        "FarizDPO2026": "dpo2026D",
        "DillaDPO2026": "dpo2026E"
    };
    if (validAccounts[username] !== password) return res.status(401).json({ error: 'Kredensial salah!' });

    // 2. Kredensial Supabase dari Vercel Environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Kunci Supabase Hilang.' });

    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    };

    try {
        // Tarik data secara simultan untuk kecepatan maksimal
        const [resAnggota, resLog, resKegiatan] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/anggota?select=*&is_active=eq.true`, { headers }),
            fetch(`${supabaseUrl}/rest/v1/absensi?select=*`, { headers }),
            fetch(`${supabaseUrl}/rest/v1/kegiatan?select=*&status=eq.AKTIF`, { headers })
        ]);

        const masterData = await resAnggota.json();
        const logData = await resLog.json();
        const kegiatanData = await resKegiatan.json();

        return res.status(200).json({ 
            master: masterData, 
            log: logData, 
            kegiatan: kegiatanData 
        });
    } catch (error) {
        return res.status(500).json({ error: 'Gagal fetch ke Supabase.' });
    }
}
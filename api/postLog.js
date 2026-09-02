// File: api/postLog.js
export default async function handler(req, res) {
    // Matikan Caching
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        const payload = req.body; 

        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        };

        // 1. Dapatkan Detail Kegiatan dari Supabase
        const eventRes = await fetch(
            `${supabaseUrl}/rest/v1/kegiatan?id=eq.${payload.kegiatan_id}&select=waktu_mulai,batas_toleransi`, 
            { headers: headers }
        );
        const eventData = await eventRes.json();
        
        let finalStatus = "HADIR"; // Default Optimistic

        // 2. KALKULASI KETERLAMBATAN MATEMATIS (KEBAL TIMEZONE)
        if (eventData && eventData.length > 0) {
            const kegiatan = eventData[0];
            
            if (kegiatan.waktu_mulai) {
                // Waktu mulai yang disimpan di DB (dikonversi ke milidetik absolut)
                const waktuMulaiMs = new Date(kegiatan.waktu_mulai).getTime();
                const toleransiMs = (kegiatan.batas_toleransi || 0) * 60000; 
                
                const batasBolehMasukMs = waktuMulaiMs + toleransiMs;
                const jamServerSekarangMs = new Date().getTime(); // Jam asli server eksekusi saat ini

                if (jamServerSekarangMs > batasBolehMasukMs) {
                    finalStatus = "TERLAMBAT";
                }
            }
        }

        // 3. Simpan Hasil Akhir ke Tabel Absensi
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/absensi`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                nim: payload.nim,
                nama: payload.nama, 
                kegiatan_id: payload.kegiatan_id,
                status_kehadiran: finalStatus // Status mutlak hasil hitungan server
            })
        });

        if (!insertRes.ok) throw new Error(await insertRes.text());
        
        res.status(200).json({ success: true, recorded_status: finalStatus });

    } catch (error) {
        console.error("POST LOG ERROR:", error);
        res.status(500).json({ error: error.message });
    }
}
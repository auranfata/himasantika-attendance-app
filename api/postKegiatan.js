// File: api/postKegiatan.js
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

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Konfigurasi Supabase hilang.' });
        }

        const waktuWIB = payload.waktu_mulai + "+07:00"; 
        const waktuLokal = new Date(waktuWIB); 
        const isoString = waktuLokal.toISOString(); 

        const insertRes = await fetch(`${supabaseUrl}/rest/v1/kegiatan`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                nama_kegiatan: payload.nama_kegiatan,
                waktu_mulai: isoString, // Disimpan secara absolut dengan offset yang benar
                batas_toleransi: parseInt(payload.batas_toleransi) || 0,
                status: 'AKTIF'
            })
        });

        if (!insertRes.ok) throw new Error(await insertRes.text());
        
        const result = await insertRes.json();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
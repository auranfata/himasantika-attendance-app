export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const payload = req.body; 

    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/absensi`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                kegiatan_id: payload.kegiatan_id,
                nim: payload.nim,
                status_kehadiran: payload.status
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            // Menangkap penolakan UNIQUE(kegiatan_id, nim) dari PostgreSQL
            if (errData.code === '23505') {
                return res.status(400).json({ error: 'Double scan ditolak oleh database mutlak.' });
            }
            throw new Error(errData.message || 'Gagal menyimpan.');
        }

        return res.status(200).json({ result: "success" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
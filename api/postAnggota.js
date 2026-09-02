// File: api/postAnggota.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        const payload = req.body;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Konfigurasi Supabase hilang dari server.' });
        }

        const insertRes = await fetch(`${supabaseUrl}/rest/v1/anggota`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                nim: payload.nim,
                nama: payload.nama,
                divisi: payload.divisi
            })
        });

        if (!insertRes.ok) {
            const errDetail = await insertRes.text();
            throw new Error(`Gagal menyimpan ke Supabase: ${errDetail}`);
        }
        
        const result = await insertRes.json();
        res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error("POST ANGGOTA ERROR:", error);
        res.status(500).json({ error: 'Gagal menyimpan anggota baru.' });
    }
}
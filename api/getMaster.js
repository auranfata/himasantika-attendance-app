export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const gasUrl = process.env.GAS_URL; 
        
        // INVESTIGASI 1: Cek apakah variabel lingkungan Vercel terbaca
        if (!gasUrl) {
            console.error("CRITICAL ERROR: Variabel GAS_URL di Vercel KOSONG atau belum di-redeploy.");
            return res.status(500).json({ error: 'GAS_URL tidak ditemukan di server.' });
        }

        const response = await fetch(gasUrl);
        const textResponse = await response.text(); // Ambil respons sebagai teks mentah dulu

        // INVESTIGASI 2: Cek apakah Google membalas dengan HTML (Error Akses) alih-alih JSON
        try {
            const data = JSON.parse(textResponse); 
            return res.status(200).json(data);
        } catch (parseError) {
            console.error("CRITICAL ERROR: Google Apps Script tidak mengirimkan data JSON!");
            console.error("Isi balasan Google yang ditolak:", textResponse.substring(0, 200) + "...");
            return res.status(500).json({ error: 'Format balasan dari Google salah (Bukan JSON).' });
        }
        
    } catch (error) {
        // MENCETAK ERROR ASLI KE VERCEL LOGS
        console.error("CRITICAL ERROR FETCHING:", error);
        return res.status(500).json({ error: 'Gagal menghubungi server database.' });
    }
}
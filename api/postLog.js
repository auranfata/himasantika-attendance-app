export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const gasUrl = process.env.GAS_URL;
        
        // Ambil data yang dikirim dari script.js
        const payload = req.body;

        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, // GAS merespon lebih baik dengan text/plain
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengirim log absensi.' });
    }
}
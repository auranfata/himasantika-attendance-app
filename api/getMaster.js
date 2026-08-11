export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Mencegat Header Autentikasi dari Frontend
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Akses ditolak. Silakan login.' });
    }

    // Dekode kredensial (Format Basic Auth)
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const validAccounts = {
        "HarisDPO2026": "dpo2026A",
        "NitaDPO2026": "dpo2026B",
        "AdeDPO2026": "dpo2026C",
        "FarizDPO2026": "dpo2026D",
        "DillaDPO2026": "dpo2026E"
    };

    // Validasi Akun
    if (validAccounts[username] !== password) {
        return res.status(401).json({ error: 'Username atau Password salah!' });
    }

    // Jika Login Berhasil, Lanjutkan Menarik Database
    try {
        const gasUrl = process.env.GAS_URL; 
        if (!gasUrl) return res.status(500).json({ error: 'Konfigurasi Server Hilang.' });

        const response = await fetch(gasUrl);
        const textResponse = await response.text();

        try {
            const data = JSON.parse(textResponse); 
            return res.status(200).json(data);
        } catch (parseError) {
            return res.status(500).json({ error: 'Format Google salah.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Gagal terhubung ke Database.' });
    }
}
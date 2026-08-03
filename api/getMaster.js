export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const gasUrl = process.env.GAS_URL; 
        
        const response = await fetch(gasUrl);
        const data = await response.json();
        
        // Teruskan data ke frontend
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghubungi server database.' });
    }
}
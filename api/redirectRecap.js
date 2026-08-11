export default function handler(req, res) {
    const recapUrl = process.env.SHEET_RECAP_URL;
    
    if (!recapUrl) {
        return res.status(500).send("URL Rekap belum dikonfigurasi di server Vercel.");
    }

    res.redirect(302, recapUrl);
}
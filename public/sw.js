const CACHE_NAME = 'himasantika-absensi-v1';

const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/images/hima.png',
];

const ALLOWED_CDN_ORIGINS = [
  'https://cdnjs.cloudflare.com',
  'https://unpkg.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching local assets');
      return cache.addAll(LOCAL_ASSETS);
    })
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (!url.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  const isSameOrigin = url.startsWith(self.location.origin);
  const isAllowedCDN = ALLOWED_CDN_ORIGINS.some(origin => url.startsWith(origin));

  if (!isSameOrigin && !isAllowedCDN) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;

        // ✅ Guard final: pastikan URL response juga http/https
        // Mencegah chrome-extension:// atau redirect aneh masuk ke cache.put
        if (!response.url.startsWith('http')) return response;

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
});

// const CACHE_NAME = 'himasantika-absensi-v1';
// const ASSETS_TO_CACHE = [
//   '/',
//   '/index.html',
//   '/style.css',
//   '/script.js',
//   '/images/hima.png',
//   'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
//   'https://unpkg.com/html5-qrcode',
//   'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
//   'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
// ];

// // Instal Service Worker dan simpan aset ke dalam Cache
// self.addEventListener('install', event => {
//   event.waitUntil(
//     caches.open(CACHE_NAME)
//       .then(cache => {
//         console.log('Opened cache');
//         return cache.addAll(ASSETS_TO_CACHE);
//       })
//   );
// });

// // Mengambil data dari Cache jika tersedia, jika tidak ambil dari jaringan (Cache First Strategy)
// self.addEventListener('fetch', event => {
//   // Hanya lakukan caching untuk permintaan GET dan dari sumber yang sama atau CDN yang kita izinkan
//   if (event.request.method !== 'GET') return;

//   event.respondWith(
//     caches.match(event.request)
//       .then(response => {
//         // Jika file ditemukan di cache, kembalikan file tersebut
//         if (response) {
//           return response;
//         }

//         // Jika tidak, ambil dari jaringan
//         return fetch(event.request).then(
//           function(response) {
//             // Cek jika respons valid
//             if(!response || response.status !== 200 || response.type !== 'basic') {
//               return response;
//             }

//             // Kloning respons untuk disimpan ke cache
//             var responseToCache = response.clone();

//             caches.open(CACHE_NAME)
//               .then(function(cache) {
//                 cache.put(event.request, responseToCache);
//               });

//             return response;
//           }
//         );
//       })
//   );
// });

// // Bersihkan cache lama saat Service Worker baru aktif
// self.addEventListener('activate', event => {
//   const cacheAllowlist = [CACHE_NAME];
//   event.waitUntil(
//     caches.keys().then(cacheNames => {
//       return Promise.all(
//         cacheNames.map(cacheName => {
//           if (cacheAllowlist.indexOf(cacheName) === -1) {
//             return caches.delete(cacheName);
//           }
//         })
//       );
//     })
//   );
// });

// pages/_app.js
import '../styles/globals.css';
import ThemeToggle from '../components/ThemeToggle';

export default function App({ Component, pageProps }) {
  return (
    <>
      {/* Ikon toggle muncul di semua halaman */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
        <ThemeToggle />
      </div>

      <Component {...pageProps} />
    </>
  );
}


// // pages/_app.js
// import '../styles/globals.css'; // Sesuaikan jika ada global css

// export default function App({ Component, pageProps }) {
//   return <Component {...pageProps} />;
// }
// // pages/_app.js
// import { useEffect } from 'react';

// export default function App({ Component, pageProps }) {
//   useEffect(() => {
//     if ('serviceWorker' in navigator) {
//       navigator.serviceWorker.register('/service-worker.js')
//         .then((registration) => {
//           console.log('SW registered: ', registration);
//         })
//         .catch((registrationError) => {
//           console.log('SW registration failed: ', registrationError);
//           // Jika error masih muncul, coba buka DevTools > Application > Service Workers > Unregister
//         });
//     }
//   }, []);

//   return <Component {...pageProps} />;
// }
// // // pages/_app.js
// // import { useEffect } from 'react';

// // export default function App({ Component, pageProps }) {
// //   useEffect(() => {
// //     if ('serviceWorker' in navigator) {
// //       navigator.serviceWorker.register('/service-worker.js')
// //         .then(reg => console.log('SW Registered:', reg))
// //         .catch(err => console.error('SW Error:', err));
// //     }
// //   }, []);

// //   return <Component {...pageProps} />;
// // }



// // // // pages/_app.js
// // // import { useEffect } from 'react';

// // // export default function App({ Component, pageProps }) {
// // //   useEffect(() => {
// // //     if ('serviceWorker' in navigator) {
// // //       navigator.serviceWorker.register('/service-worker.js')
// // //         .then(() => console.log('Service Worker Registered'))
// // //         .catch(err => console.error('SW Error:', err));
// // //     }
// // //   }, []);

// // //   return <Component {...pageProps} />;
// // // }








// // // // import "@/styles/globals.css";

// // // // export default function App({ Component, pageProps }) {
// // // //   return <Component {...pageProps} />;
// // // // }

// lib/device-utils.js

export const getDeviceType = (userAgent) => {
  const ua = userAgent.toLowerCase();
  let device = 'Unknown';
  let platform = 'Unknown OS';

  // Deteksi OS
  if (ua.indexOf('win') !== -1) platform = 'Windows';
  if (ua.indexOf('mac') !== -1) platform = 'macOS';
  if (ua.indexOf('linux') !== -1) platform = 'Linux';
  if (ua.indexOf('android') !== -1) platform = 'Android';
  if (ua.indexOf('like mac') !== -1) platform = 'iOS'; // Safari/iOS

  // Deteksi Device/Brand (Sederhana)
  if (ua.indexOf('iphone') !== -1) device = 'iPhone';
  if (ua.indexOf('ipad') !== -1) device = 'iPad';
  if (ua.indexOf('android') !== -1) {
    if (ua.indexOf('mobile') !== -1) device = 'Android Phone';
    else device = 'Android Tablet';
  }
  if (platform === 'Windows') device = 'Desktop PC';
  if (platform === 'macOS') device = 'MacBook';

  return { device, platform };
};

export const getBrowser = (userAgent) => {
  const ua = userAgent.toLowerCase();
  if (ua.indexOf('firefox') !== -1) return 'Firefox';
  if (ua.indexOf('edg') !== -1) return 'Edge';
  if (ua.indexOf('opr') !== -1 || ua.indexOf('opera') !== -1) return 'Opera';
  if (ua.indexOf('chrome') !== -1) return 'Chrome';
  if (ua.indexOf('safari') !== -1) return 'Safari';
  return 'Unknown Browser';
};

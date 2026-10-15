// Local browser-session WhatsApp automation is retired for the production
// pilot. These stable no-op exports keep dormant legacy controller functions
// fail-closed without pulling Chromium/Puppeteer into the web service.
const getStatus = () => ({ enabled: false, isReady: false, qrCodeDataURL: null });

const logout = async () => false;

const sendMessage = async () => {
  throw new Error('Local WhatsApp integration is disabled');
};

module.exports = { client: null, getStatus, logout, sendMessage };

const crypto = require('crypto');

const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'meet.jit.si';
const JITSI_APP_ID = process.env.JITSI_APP_ID || null;
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || null;

/**
 * Generate unique room name
 */
const generateRoomName = (bookingId) => {
  const random = crypto.randomBytes(8).toString('hex');
  return `thesunbook-${bookingId.toString().slice(-6)}-${random}`;
};

/**
 * Generate Jitsi URL
 */
const getJitsiUrl = (roomName) => {
  return `https://${JITSI_DOMAIN}/${roomName}`;
};

/**
 * Generate JWT for private rooms (optional - if you have JaaS or self-hosted)
 */
const generateJitsiJWT = (roomName, user, isModerator = false) => {
  if (!JITSI_APP_SECRET || !JITSI_APP_ID) {
    return null; // No JWT for public meet.jit.si
  }

  const payload = {
    context: {
      user: {
        avatar: user.avatar || '',
        name: user.name || 'User',
        email: user.email || '',
        id: user._id?.toString() || ''
      },
      features: {
        recording: isModerator,
        'livestreaming': false,
        'screen-sharing': true,
        'outbound-call': false
      }
    },
    aud: 'jitsi',
    iss: JITSI_APP_ID,
    sub: JITSI_DOMAIN,
    room: roomName,
    moderator: isModerator,
    exp: Math.floor(Date.now() / 1000) + 3600, // ساعة
    nbf: Math.floor(Date.now() / 1000)
  };

  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, JITSI_APP_SECRET, { algorithm: 'HS256' });
};

/**
 * Generate meeting config for frontend
 */
const getMeetingConfig = (roomName, user, isTeacher = false) => {
  const jwt = generateJitsiJWT(roomName, user, isTeacher);
  
  return {
    domain: JITSI_DOMAIN,
    roomName,
    url: getJitsiUrl(roomName),
    jwt: jwt,
    configOverwrite: {
      // مكالمة صوت بس - من غير كاميرا خالص من أول لحظة، ومقفولة برضو من الإعدادات
      startAudioOnly: true,
      startWithAudioMuted: false,
      startWithVideoMuted: true,
      prejoinPageEnabled: false,
      disableDeepLinking: true,
    },
    interfaceConfigOverwrite: {
      // من غير كاميرا (لأن المكالمة صوت بس) ومن غير خيار دعوة/إضافة حد تاني للمكالمة
      TOOLBAR_BUTTONS: [
        'microphone', 'closedcaptions', 'fullscreen',
        'fodeviceselection', 'hangup', 'profile', 'chat',
        'settings', 'raisehand', 'filmstrip', 'feedback',
        'stats', 'shortcuts', 'help', 'mute-everyone', 'security'
      ],
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      DEFAULT_BACKGROUND: '#1a1a2e',
      DEFAULT_LOGO_URL: ''
    },
    userInfo: {
      displayName: user.name || 'User',
      email: user.email || ''
    }
  };
};

module.exports = {
  generateRoomName,
  getJitsiUrl,
  generateJitsiJWT,
  getMeetingConfig
};
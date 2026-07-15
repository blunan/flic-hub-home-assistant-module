// BUTTON_ACTIONS
exports.CLICK_HOLD = 'hold';
exports.CLICK_SINGLE = 'single';
exports.CLICK_DOUBLE = 'double';

// BUTTON_STATES
exports.BUTTON_STATE_ON = 'on';
exports.BUTTON_STATE_OFF = 'off';

// BATTERY_STATES
exports.BATTERY_STATE_UNKNOWN = 'unknown';

// CONNECTIVITY_STATES
exports.CONNECTIVITY_STATE_CONNECTED = 'on';
exports.CONNECTIVITY_STATE_DISCONNECTED = 'off';

// LOG_LEVELS
exports.LOG_LEVEL_NONE = 0;
exports.LOG_LEVEL_ERROR = 1;
exports.LOG_LEVEL_WARNING = 2;
exports.LOG_LEVEL_INFO = 3;
exports.LOG_LEVEL_DEBUG = 4;

// LOG_PREFIXES
exports.LOG_PREFIX_ERROR = 'ERROR';
exports.LOG_PREFIX_WARNING = 'WARNING';
exports.LOG_PREFIX_INFO = 'INFO';
exports.LOG_PREFIX_DEBUG = 'DEBUG';

// UTILS
exports.COLON_REGEX = new RegExp(':', 'g');
exports.EMPTY_STATE = Object.freeze({'timestamp': 0, 'emitted': false});
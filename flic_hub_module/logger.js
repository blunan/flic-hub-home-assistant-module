const CFG = require("./config");
const C = require("./constants");

function log(logPefix, message) {
    console.log(Date.now() + " : " + logPefix + " : " + message);
}

exports.error = function(message) {
    if(CFG.LOG_LEVEL >= C.LOG_LEVEL_ERROR) {
        log(C.LOG_PREFIX_ERROR, message);
    }
}

exports.warn = function(message) {
    if(CFG.LOG_LEVEL >= C.LOG_LEVEL_WARNING) {
        log(C.LOG_PREFIX_WARNING, message);
    }
}

exports.info = function(message) {
    if(CFG.LOG_LEVEL >= C.LOG_LEVEL_INFO) {
        log(C.LOG_PREFIX_INFO, message);
    }
}

exports.debug = function(message) {
    if(CFG.LOG_LEVEL >= C.LOG_LEVEL_DEBUG) {
        log(C.LOG_PREFIX_DEBUG, message);
    }
}
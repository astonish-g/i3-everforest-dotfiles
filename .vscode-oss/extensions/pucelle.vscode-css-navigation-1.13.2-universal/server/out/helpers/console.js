"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logListQuerierExecutedTime = exports.timeEnd = exports.timeStart = exports.error = exports.warn = exports.info = exports.log = exports.setLogEnabled = exports.pipeTo = void 0;
let scopedConsole = console;
let logEnabled = true;
/** Get a time marker `hh:MM:ss` for current time. */
function getTimeMarker() {
    let date = new Date();
    return '['
        + String(date.getHours())
        + ':'
        + String(date.getMinutes()).padStart(2, '0')
        + ':'
        + String(date.getSeconds()).padStart(2, '0')
        + '] ';
}
/**
 * Pipe messages to connection, such that all messages will be shown in output channel.
 * After tested I found just using `console.xxx` can also output messages,
 * so this piping should be useless anymore, may be removed after checking it carefully.
 */
function pipeTo(connection) {
    scopedConsole = connection.console;
}
exports.pipeTo = pipeTo;
/** Enables or disables log level message, that means, not important messages. */
function setLogEnabled(enabled) {
    logEnabled = enabled;
}
exports.setLogEnabled = setLogEnabled;
/** Log level message. */
function log(msg) {
    if (logEnabled) {
        scopedConsole.log(getTimeMarker() + msg);
    }
}
exports.log = log;
/** Info level message. */
function info(msg) {
    scopedConsole.info(getTimeMarker() + msg);
}
exports.info = info;
/** Warn level message. */
function warn(msg) {
    scopedConsole.warn(getTimeMarker() + msg);
}
exports.warn = warn;
/** Error level message. */
function error(msg) {
    scopedConsole.error(String(msg));
}
exports.error = error;
let startTimeMap = new Map();
function getMillisecond() {
    let time = process.hrtime();
    return time[0] * 1000 + time[1] / 1000000;
}
/** Start a new time counter with specified name. */
function timeStart(name) {
    startTimeMap.set(name, getMillisecond());
}
exports.timeStart = timeStart;
/** End a time counter with specified name. */
function timeEnd(name, message = null) {
    let startTime = startTimeMap.get(name);
    if (startTime === undefined) {
        warn(`Timer "${name}" is not started`);
        return;
    }
    startTimeMap.delete(name);
    let timeCost = Math.round(getMillisecond() - startTime);
    if (message !== null) {
        log(message + ` in ${timeCost} ms`);
    }
}
exports.timeEnd = timeEnd;
/** Log executed time of a function, which will return a list. */
function logListQuerierExecutedTime(fn, type) {
    return async (...args) => {
        let startTime = getMillisecond();
        let list = await fn(...args);
        let time = Math.round(getMillisecond() - startTime);
        if (list) {
            if (list.length === 0) {
                log(`No ${type} found, ${time} ms cost`);
            }
            else if (list.length === 1) {
                log(`1 ${type} found, ${time} ms cost`);
            }
            else {
                log(`${list.length} ${type}s found, ${time} ms cost`);
            }
        }
        return list;
    };
}
exports.logListQuerierExecutedTime = logListQuerierExecutedTime;
//# sourceMappingURL=console.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diff_1 = require("./diff");
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType = exports.ChangeType || (exports.ChangeType = {}));
function getChangeType(change) {
    if (!change.after.exists) {
        return ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
}
exports.getChangeType = getChangeType;
function getTimestamp(context, change) {
    const changeType = getChangeType((change));
    switch (changeType) {
        case ChangeType.CREATE:
            return change.after.updateTime.toDate();
        case ChangeType.DELETE:
            // Due to an internal bug (129264426), before.update_time is actually the commit timestamp.
            return new Date(change.before.updateTime.toDate().getTime() + 1);
        case ChangeType.UPDATE:
            return change.after.updateTime.toDate();
        default: {
            throw new Error(`Invalid change type: ${changeType}`);
        }
    }
}
exports.getTimestamp = getTimestamp;
function getData(change) {
    const changeType = getChangeType((change));
    let data = changeType == ChangeType.DELETE ? {} : change.after.data();
    data.__diff = diff_1.getHistoryDiffs(changeType, changeType == ChangeType.CREATE ? null : change.before.data(), changeType == ChangeType.DELETE ? null : change.after.data());
    return data;
}
exports.getData = getData;

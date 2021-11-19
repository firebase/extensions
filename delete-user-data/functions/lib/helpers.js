"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseUrl = void 0;
exports.getDatabaseUrl = (selectedDatabaseInstance, selectedDatabaseLocation) => {
    if (!selectedDatabaseLocation || !selectedDatabaseInstance)
        return null;
    if (selectedDatabaseLocation === "us-central1")
        return `https://${selectedDatabaseInstance}.firebaseio.com`;
    return `https://${selectedDatabaseInstance}.${selectedDatabaseLocation}.firebasedatabase.app`;
};

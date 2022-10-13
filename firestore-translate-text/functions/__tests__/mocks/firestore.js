"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockFirestoreUpdate = exports.mockFirestoreTransaction = exports.makeChange = exports.mockDocumentSnapshotFactory = exports.snapshot = void 0;
const functionsTestInit = require("firebase-functions-test");
const snapshot = (input = { input: "hello" }, path = "translations/id1") => {
    let functionsTest = functionsTestInit();
    return functionsTest.firestore.makeDocumentSnapshot(input, path);
};
exports.snapshot = snapshot;
const mockDocumentSnapshotFactory = (documentSnapshot) => {
    return jest.fn().mockImplementation(() => {
        return {
            exists: true,
            get: documentSnapshot.get.bind(documentSnapshot),
            ref: { path: documentSnapshot.ref.path },
        };
    })();
};
exports.mockDocumentSnapshotFactory = mockDocumentSnapshotFactory;
const makeChange = (before, after) => {
    let functionsTest = functionsTestInit();
    return functionsTest.makeChange(before, after);
};
exports.makeChange = makeChange;
exports.mockFirestoreTransaction = jest.fn().mockImplementation(() => {
    return (transactionHandler) => {
        transactionHandler({
            update(ref, field, data) {
                (0, exports.mockFirestoreUpdate)(field, data);
            },
        });
    };
});
exports.mockFirestoreUpdate = jest.fn();

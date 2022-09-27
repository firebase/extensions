const fft = require("firebase-functions-test")();
const funcs = require("../index");
/** prepare extension functions */
// const exportUserData = fft.wrap(funcs.exportUserData);

// /** Use fn (oncall example) */
//  await exportUserData.call(
//    {}, data,
//    { auth: { uid: user.uid } }
// );

describe("exportUserData", async () => {
    test("should export user data", async () => {

        console.log('test');
    })
});
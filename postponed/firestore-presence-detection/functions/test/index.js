/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const assert = require('assert');
const mocha = require('mocha');
const extension = require('./../lib/index.js');
const admin = require('firebase-admin');

// Unit test app parameters
const testCollection = "_user_presence";
const testUser = "unit-test";
const testSession = "sess0";
const docRef = admin.firestore().collection(testCollection).doc(testUser);

/**
 * Takes an array of elements, returns an array of all array permutations
 * @param baseArr: arbitrary array of elements
 * @return {*[]|Array}: array of all permutations
 */
const getPermutations = (baseArr) => {

  // Return if there are no elements left to iterate over
  if (baseArr.length <= 1) {
    return [baseArr];
  }

  // Permute over all possible
  const permutationArr = [];
  baseArr.forEach( (el, ind) => {
    // Remove the element from the baseArray
    const baseArrCopy = [...baseArr];
    baseArrCopy.splice(ind, 1);

    // Get the permutations of the remaining elements
    getPermutations(baseArrCopy).forEach((singleArr) => {
      singleArr.push(el);
      permutationArr.push(singleArr);
    });
  });

  return permutationArr;
};

/**
 * Smoke tests for basic functionality (online/offline)
 */
mocha.describe('Smoke Test (Idempotency)', function() {
  it("Reset Environment: should succeed", function() {
    return docRef.delete();
  });
  it("Online: should have 1 active session", async () => {
    const payload = "test";
    const timestamp = 0;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {[testSession]: payload});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
  it("Online: should have 1 active session (NOOP)", async () => {
    const payload = "test";
    const timestamp = 0;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {[testSession]: payload});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
  it("Offline: should have 0 active sessions", async () => {
    const payload = admin.firestore.FieldValue.delete();
    const timestamp = 1;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
  it("Offline: should have 0 active sessions (NOOP)", async () => {
    const payload = admin.firestore.FieldValue.delete();
    const timestamp = 1;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
});

/**
 * Offline should overwrite a online state if timestamps are equivalent. Online will not overwrite.
 */
mocha.describe('Equivalent timestamp tie-breaker (offline should always win)', function() {
  it("Reset Environment: should succeed", function() {
    return docRef.delete();
  });
  it("Online: should have 1 active session", async () => {
    const payload = "test";
    const timestamp = 0;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {[testSession]: payload});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
  it("Offline: should have 0 active sessions (overwrite)", async () => {
    const payload = admin.firestore.FieldValue.delete();
    const timestamp = 0;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
  it("Offline: should have 0 active sessions (overwrite to online fail)", async () => {
    const payload = admin.firestore.FieldValue.delete();
    const timestamp = 0;
    await extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession);
    const docSnap = await docRef.get();
    assert.deepEqual(docSnap.data().sessions, {});
    assert.deepEqual(docSnap.data().last_updated, {[testSession]: timestamp});
  });
});

/**
 * Tests the robustness of the extension when Cloud Functions does not fire in the correct order
 */
mocha.describe('Permuted Operations', function() {

  // The operations to permute are (1) online, (2) metadata update 1, (3) metadata update 2, and (4) offline
  const testArr = {
    0: true,
    1: "hello",
    2: "world!",
    3: admin.firestore.FieldValue.delete()
  };

  // Get array of all permutations of the 4 operations
  const permutations = getPermutations(Object.keys(testArr));

  // Iterate over all possible permutations of operations. The most recent operation should persist correctly
  // Keep track of the most recent operation per sequence (i.e. with greatest timestamp).
  permutations.forEach((operationSequence, index) => {
    const groupName = `Permutation ${index + 1}/${permutations.length}: ${JSON.stringify(operationSequence)}`;
    let recentOp = -1;

    // Group by different permutations
    mocha.describe(groupName, function() {
      it("Reset Environment: should succeed", function() {
        return docRef.delete();
      });

      // Commit each operation and observe the result
      operationSequence.forEach((op) => {
        // Define a log that will describe what operation is occurring and what the expected result is
        let testName = `(Operation ${recentOp}) should still be operation: ${recentOp}, data: ${JSON.stringify(testArr[recentOp])}`;
        if (recentOp < parseInt(op)) {
          recentOp = parseInt(op);
          testName = `(Operation ${recentOp}) should succeed, data: ${JSON.stringify(testArr[recentOp])}`;
        }

        // Commit the transaction and compare the result from firestore
        it(testName, async () => {
          await extension.firestoreTransaction(docRef, testArr[recentOp], recentOp, testUser, testSession);
          const docSnap = await docRef.get();
          if (testArr[recentOp] === admin.firestore.FieldValue.delete()) {
            assert.deepEqual(docSnap.data().sessions, {});
          } else {
            assert.deepEqual(docSnap.data().sessions, {[testSession]: testArr[recentOp]});
          }
          assert.deepEqual(docSnap.data().last_updated, {[testSession]: recentOp});
        });
      });
    });
  });
});
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
 * testTransaction is a helper function that
 *
 * @param testName: describes the result expected (e.g. "should have an online session")
 * @param payload: payload (or delete field) to emulate online/offline/metadata operation
 * @param timestamp: timestamp of the operation
 * @param assertCallback: callback on a DocumentSnapshot, should be used to assert the state of the document
 */
const testTransaction = (testName, payload, timestamp, assertCallback) => {
  it(testName, function(done){
    extension.firestoreTransaction(docRef, payload, timestamp, testUser, testSession)
        .then(() => {
          docRef.get().then((docSnap) => {
            assertCallback(docSnap);
            done();
          }).catch((error) => {
            done(error);
          });
        })
        .catch( (error) => {
          done(error);
        });
  });
};

/**
 * Deletes the document, should be run prior to running any test
 */
const resetTestEnvironment = () => {
  it("Reset Environment: should succeed", function(done) {
      docRef.delete().then(() => {
        done();
      }).catch((error) => {
        done(error);
      })
    });
};

/**
 *
 * @param baseArr
 * @return {*[]|Array}
 */
const getPermutations = (baseArr) => {

  // Return if there are no elements left to iterate over
  if (baseArr.length === 1) {
    return [baseArr];
  }

  // Permute over all possible
  const permutationArr = [];
  baseArr.forEach( (el, ind) => {
    // Remove the element from the baseArray
    const baseArrCopy = [...baseArr];
    baseArrCopy.splice(ind, 1);

    // Get the permutations of the remaining elements
    const arr = getPermutations(baseArrCopy);
    arr.forEach((singleArr) => {
      singleArr.push(el);
      permutationArr.push(singleArr);
    });
  });

  return permutationArr;
};

/**
 * Smoke tests for basic functionality (online/offline)
 */
mocha.describe('Smoke Test', function() {
  resetTestEnvironment();
  testTransaction("Online: should have 1 active session", "test", 0, (docSnap) => {
    assert.equal(0, docSnap.data()["last_updated"][testSession]);
    assert.equal("test", docSnap.data()["sessions"][testSession]);
  });
  testTransaction("Online: should have 0 active sessions", admin.firestore.FieldValue.delete(), 1,(docSnap) => {
    assert.equal(1, docSnap.data()["last_updated"][testSession]);
    assert.equal(undefined, docSnap.data()["sessions"][testSession]);
  });
});

/**
 * Tests for idempotency of online/offline calls
 */
mocha.describe('Idempotency', function() {
  resetTestEnvironment();
  testTransaction("Online: should have 1 active session", "test", 0, (docSnap) => {
    assert.equal(0, docSnap.data()["last_updated"][testSession]);
    assert.equal("test", docSnap.data()["sessions"][testSession]);
  });
  testTransaction("Online: should have 1 active session (NOOP)", "test", 0, (docSnap) => {
    assert.equal(0, docSnap.data()["last_updated"][testSession]);
    assert.equal("test", docSnap.data()["sessions"][testSession]);
  });

  testTransaction("Online: should have 0 active sessions", admin.firestore.FieldValue.delete(), 1,(docSnap) => {
    assert.equal(1, docSnap.data()["last_updated"][testSession]);
    assert.equal(undefined, docSnap.data()["sessions"][testSession]);
  });
  testTransaction("Offline: should have 0 active sessions (NOOP)", admin.firestore.FieldValue.delete(), 1,(docSnap) => {
    assert.equal(1, docSnap.data()["last_updated"][testSession]);
    assert.equal(undefined, docSnap.data()["sessions"][testSession]);
  });
});

/**
 * Offline should overwrite a online state if timestamps are equivalent. Online will not overwrite.
 */
mocha.describe('Equivalent timestamp tie-breaker (offline should always win)', function() {
  resetTestEnvironment();
  testTransaction("Online: should have 1 active session", "test", 0, (docSnap) => {
    assert.equal(0, docSnap.data()["last_updated"][testSession]);
    assert.equal("test", docSnap.data()["sessions"][testSession]);
  });
  testTransaction("Offline: should have 0 active sessions (overwrite)", admin.firestore.FieldValue.delete(), 0,(docSnap) => {
    assert.equal(0, docSnap.data()["last_updated"][testSession]);
    assert.equal(undefined, docSnap.data()["sessions"][testSession]);
  });
  testTransaction("Offline: online write should fail", "test", 0, (docSnap) => {
    assert.equal(0, docSnap.data()["last_updated"][testSession]);
    assert.equal(undefined, docSnap.data()["sessions"][testSession]);
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

  const permutations = getPermutations(Object.keys(testArr));

  // Iterate over all possible permutations of operations. The most recent operation should persist correctly
  // Keep track of the most recent operation per sequence.
  permutations.forEach((operationSequence, index) => {
    const groupName = `Permutation ${index + 1}/${permutations.length}: ${JSON.stringify(operationSequence)}`;
    let recentOp = -1;

    // Group by different permutations
    mocha.describe(groupName, function() {
      resetTestEnvironment();
      operationSequence.forEach((op) => {
        // Define the group/test name for mocha and update the most recent op in the sequence so far
        let testName = `(Operation ${recentOp}) should still be operation: ${recentOp}, data: ${JSON.stringify(testArr[recentOp])}`;
        if (recentOp < parseInt(op)) {
          recentOp = parseInt(op);
          testName = `(Operation ${recentOp}) should succeed`;
        }

        // Commit the transaction and compare the result from firestore
        // The expectedOP needs to be copied over because of the nature of the callback.
        let expectedOp = recentOp;
        testTransaction(testName, testArr[op], op, (docSnap) => {
          assert.equal(expectedOp, docSnap.data()["last_updated"][testSession]);
          if (testArr[expectedOp] === admin.firestore.FieldValue.delete()) {
            assert.equal(undefined, docSnap.data()["sessions"][testSession]);
          } else {
            assert.equal(testArr[expectedOp], docSnap.data()["sessions"][testSession]);
          }
        });
      });
    });
  });
});
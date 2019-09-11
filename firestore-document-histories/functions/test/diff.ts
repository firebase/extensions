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

import {expect} from "chai";
import {suite, test} from "mocha-typescript";
import {firestore} from "firebase-admin";
import {computeDiff} from "../src/diff"

@suite
class DifferTest {
  @test "basic primitives"() {
    expect(computeDiff("a", "a")).to.be.undefined;
    expect(computeDiff("a", "b")).equal("a");
    expect(computeDiff("a", 1)).equal("a");
    expect(computeDiff(1, "a")).equal(1);
    expect(computeDiff(1, 1)).to.be.undefined;
    expect(computeDiff(1, 2)).equal(1);
  }

  @test "shallow maps computeDiffed to be empty"() {
    expect(computeDiff({
      a: 1,
      b: 2,
    }, {
      a: 1,
      b: 2,
    })).to.be.undefined;

    expect(computeDiff({
      a: 1
    }, {
      a: 1
    })).to.be.undefined;

    expect(computeDiff({
      a: 1
    }, {
      a: 1,
      b: 1
    })).to.be.undefined;
  }

  @test "Shallow maps computeDiffed to not empty"() {
    expect(computeDiff({
      a: 1
    }, {
      b: 1
    })).deep.equal({
      a: 1
    });

    expect(computeDiff({
      a: 1
    }, {
      a: 2
    })).deep.equal({
      a: 1
    })

    expect(computeDiff({
      a: 1,
      b: 1
    }, {
      a: 2,
      b: 1
    })).deep.equal({
      a: 1
    })

    expect(computeDiff({
      a: 1,
      b: 2
    }, {
      a: 1,
    })).deep.equal({
      b: 2
    })
  }

  @test "nested map computeDiffed to be empty"() {
    expect(computeDiff(
        {
          x: {
            b: {
              z: "ok"
            }
          }
        },
        {
          x: {
            b: {
              z: "ok"
            }
          }
        })).to.be.undefined;

    expect(computeDiff(
        {
          x: {
            a: 1,
            b: {
              z: "ok"
            }
          }
        },
        {
          x: {
            a: 1,
            b: {
              z: "ok"
            },
            c: 0
          },
          y: [1]
        })).to.be.undefined;

    expect(computeDiff(
        {
          x: {
            a: 1,
            b: 2
          }
        },
        {
          x: {
            a: 1,
            b: 2
          }
        })).to.be.undefined;

    expect(computeDiff(
        {
          x: {
            a: 1
          }
        },
        {
          x: {
            a: 1,
            b: 2
          }
        })).to.be.undefined;
  }

  @test "nested map computeDiffed to be not empty"() {
    expect(computeDiff(
        {
          x: {
            b: {
              z: "ok"
            }
          }
        },
        {
          y: []
        })).deep.equal({
      x: {
        b: {
          z: "ok"
        }
      }
    });

    expect(computeDiff(
        {
          x: {
            b: {
              z: "ok"
            }
          }
        },
        {
          x: {
            b: {
              z: 1
            }
          }
        })).deep.equal({
      x: {
        b: {
          z: "ok"
        }
      }
    });

    expect(computeDiff(
        {
          x: {
            a: 1,
            b: 1,
          }
        },
        {
          x: {
            b: 1,
          }
        })).deep.equal(
        {
          x: {
            a: 1
          }
        });

    expect(computeDiff(
        {
          x: {
            a: 1,
            b: 2
          },
          y: {
            a: 1,
            b: 2
          }
        },
        {
          x: {
            a: 1,
            b: 2
          },
          y: {
            a: 1
          },
          z: {
            a: 1,
          }
        })).deep.equal(
        {
          y: {
            b: 2
          }
        });
  }

  @test "array are identical"() {
    expect(computeDiff([1, "a"], [1, "a"])).to.be.undefined;
    expect(computeDiff(["a"], ["a"])).to.be.undefined;
    expect(computeDiff([1], [1])).to.be.undefined;
  }

  @test "array computeDiffed to be empty"() {
    expect(computeDiff(["a", "a", 1], [1, "a"])).deep.equal(["a", "a", 1]);
    expect(computeDiff(["a", "a", 1], [1, 1, "a"])).deep.equal(["a", "a", 1]);

    expect(computeDiff(["a"], ["a", "b"])).deep.equal(["a"]);
  }


  @test "array computeDiffed to be not empty"() {
    expect(computeDiff(["a"], [])).deep.equal(["a"]);
    expect(computeDiff(["a", 1], [1])).deep.equal(["a", 1]);
    expect(computeDiff([1, "a"], [1])).deep.equal([1, "a"]);
    expect(computeDiff([1, "a", "a"], [1])).deep.equal([1, "a", "a"]);
    expect(computeDiff([1, 1, "a", "a"], [1])).deep.equal([1, 1, "a", "a"]);
  }

  ////
}

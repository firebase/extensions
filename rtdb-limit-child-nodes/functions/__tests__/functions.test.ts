import functionsConfig from "../src/config";
import * as exportedFunctions from "../src";

describe("extension", () => {
  test("functions configuration detected from environment variables", async () => {
    expect(functionsConfig).toMatchSnapshot();
  });

  test("functions are exported", async () => {
    expect(exportedFunctions.rtdblimit).toBeInstanceOf(Function);
  });
});

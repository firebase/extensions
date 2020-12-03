import mockedEnv from "mocked-env";

const environment = {
  LOCATION: "us-central1",
  IMG_BUCKET: "extensions-testing.appspot.com",
  CACHE_CONTROL_HEADER: undefined,
  IMG_SIZES: "200x200",
  RESIZED_IMAGES_PATH: undefined,
  DELETE_ORIGINAL_FILE: "true",
};

const { mockGenerateResizedImage } = global;
let restoreEnv;
describe("extension", () => {
  beforeEach(() => {
    jest.resetModules();

    restoreEnv = mockedEnv(environment);
  });

  afterEach(() => restoreEnv());

  test("'generateResizedImage' function is exported", () => {
    const exportedFunctions = jest.requireActual("../functions/src");
    expect(exportedFunctions.generateResizedImage).toBeInstanceOf(Function);
  });

  describe("functions.generateResizedImage", () => {
    let mockResizedImage;
    let logMock;
    let errorLogMock;

    beforeEach(() => {
      mockResizedImage = mockGenerateResizedImage();
      logMock = jest.fn();
      errorLogMock = jest.fn();

      require("firebase-functions").logger = {
        log: logMock,
        error: errorLogMock,
      };
    });
    test("image contentType does not exist", () => {
      mockResizedImage({ name: "test" });

      expect(logMock).toHaveBeenCalledWith(
        `File has no Content-Type, no processing is required`
      );
    });

    test("image contentType does not start with 'image/'", () => {
      let contentType = "wrong/jpg";
      mockResizedImage({ contentType, name: "test" });

      expect(logMock).toHaveBeenCalledWith(
        `File of type '${contentType}' is not an image, no processing is required`
      );
    });
  });
});

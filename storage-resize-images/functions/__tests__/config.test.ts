import mockedEnv from "mocked-env";

const environment = {
  LOCATION: "us-central1",
  IMG_BUCKET: "extensions-testing.appspot.com",
  CACHE_CONTROL_HEADER: undefined,
  IMG_SIZES: "200x200",
  RESIZED_IMAGES_PATH: undefined,
  DELETE_ORIGINAL_FILE: "true",
};

let restoreEnv;

const { config, deleteImage } = global;
let deleteTypeCounter = 0;

describe("extension", () => {
  beforeEach(() => {
    jest.resetModules();
    if (deleteTypeCounter === 0) {
      restoreEnv = mockedEnv(environment);
    } else if (deleteTypeCounter === 1) {
      restoreEnv = mockedEnv({ ...environment, DELETE_ORIGINAL_FILE: "false" });
    } else if (deleteTypeCounter === 2) {
      restoreEnv = mockedEnv({
        ...environment,
        DELETE_ORIGINAL_FILE: "on_success",
      });
    }
  });

  afterEach(() => restoreEnv());

  test("configuration detected from environment variables", async () => {
    const mockConfig = config();

    expect(mockConfig).toMatchSnapshot({});
  });

  test("always delete original file", async () => {
    const mockConfig = config();
    const mockDeleteImage = deleteImage();
    deleteTypeCounter++;
    expect(mockConfig.deleteOriginalFile).toEqual(mockDeleteImage.always);
  });

  test("never delete original file", async () => {
    const mockConfig = config();
    const mockDeleteImage = deleteImage();
    deleteTypeCounter++;
    expect(mockConfig.deleteOriginalFile).toEqual(mockDeleteImage.never);
  });
  test("delete original file on success", async () => {
    const mockConfig = config();
    const mockDeleteImage = deleteImage();

    expect(mockConfig.deleteOriginalFile).toEqual(mockDeleteImage.onSuccess);
  });
});

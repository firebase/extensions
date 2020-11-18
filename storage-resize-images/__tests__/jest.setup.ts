import { mockGenerateResizedImage } from "./mocks/generateResizedImage";

global.config = () => require("../functions/src/config").default;
global.deleteImage = () => require("../functions/src/config").deleteImage;
global.mockGenerateResizedImage = mockGenerateResizedImage;

import { mockGenerateResizedImage } from "./mocks/generateResizedImage";

global.config = () => require("../src/config").default;
global.deleteImage = () => require("../src/config").deleteImage;
global.mockGenerateResizedImage = mockGenerateResizedImage;

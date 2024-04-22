// export enum deleteImage {
//     always = 0,
//     never,
//     onSuccess,
//   }

//   function deleteOriginalFile(deleteType) {
//     switch (deleteType) {
//       case "true":
//         return deleteImage.always;
//       case "false":
//         return deleteImage.never;
//       default:
//         return deleteImage.onSuccess;
//     }
//   }

//   function paramToArray(param) {
//     return typeof param === "string" ? param.split(",") : undefined;
//   }

//   function allowAnimated(sharpOptions = "{}", overrideIsAnimated) {
//     const ops = JSON.parse(sharpOptions);
//     if (ops && ops.animated) {
//       return true;
//     }

//     return overrideIsAnimated === "true" || undefined ? true : false;
//   }

//   export const config = {
//     bucket: process.env.IMG_BUCKET,
//     cacheControlHeader: process.env.CACHE_CONTROL_HEADER,
//     doBackfill: process.env.DO_BACKFILL === "true",
//     imageSizes: process.env.IMG_SIZES.split(","),
//     regenerateToken: process.env.REGENERATE_TOKEN == "true",
//     makePublic: process.env.MAKE_PUBLIC === "true",
//     resizedImagesPath: process.env.RESIZED_IMAGES_PATH,
//     includePathList: paramToArray(process.env.INCLUDE_PATH_LIST),
//     excludePathList: paramToArray(process.env.EXCLUDE_PATH_LIST),
//     failedImagesPath: process.env.FAILED_IMAGES_PATH,
//     deleteOriginalFile: deleteOriginalFile(process.env.DELETE_ORIGINAL_FILE),
//     imageTypes: paramToArray(process.env.IMAGE_TYPE),
//     sharpOptions: process.env.SHARP_OPTIONS || "{}",
//     outputOptions: process.env.OUTPUT_OPTIONS,
//     animated: allowAnimated(process.env.SHARP_OPTIONS, process.env.IS_ANIMATED),
//     location: process.env.LOCATION,
//   };

// mock config
export const config = {
  bucket: "extensions-testing.appspot.com",
  cacheControlHeader: undefined,
  doBackfill: false,
  imageSizes: ["200x200"],
  regenerateToken: false,
  makePublic: false,
  resizedImagesPath: undefined,
  includePathList: undefined,
  excludePathList: undefined,
  failedImagesPath: undefined,
  deleteOriginalFile: 0,
  imageTypes: undefined,
  sharpOptions: "{}",
  outputOptions: undefined,
  animated: false,
  location: "us-central1",
};

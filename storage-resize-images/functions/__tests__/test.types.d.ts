declare namespace NodeJS {
  interface Global {
    config: () => any;
    deleteImage: () => any;
    mockGenerateResizedImage: () => jest.MockedFunction<any>;
  }
}

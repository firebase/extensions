declare namespace NodeJS {
  interface Global {
    config: () => jest.ModuleMocker;
    deleteImage: () => jest.ModuleMocker;
    mockGenerateResizedImage: () => jest.MockedFunction<any>;
  }
}

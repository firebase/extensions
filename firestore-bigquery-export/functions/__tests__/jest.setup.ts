declare namespace NodeJS {
  interface Global {
    config: () => jest.ModuleMocker;
  }
}

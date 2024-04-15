declare namespace NodeJS {
  interface Global {
    conf: () => jest.ModuleMocker;
  }
}

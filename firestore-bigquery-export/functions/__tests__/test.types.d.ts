import * as mock from "jest-mock";

declare namespace NodeJS {
  interface Global {
    config: () => mock.ModuleMocker;
  }
}

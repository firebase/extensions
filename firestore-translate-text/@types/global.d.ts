declare module NodeJS {
  export interface Global {
    snapshot: (
      input?: { input?: string; changed?: number; notTheInput?: string },
      path?: string
    ) => any;
  }
}

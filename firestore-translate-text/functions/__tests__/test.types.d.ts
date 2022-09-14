declare namespace NodeJS {
  interface Global {
    config: () => jest.ModuleMocker;
    snapshot: (
      input?: { input?: any; changed?: number; notTheInput?: string },
      path?: string
    ) => any;
    testTranslations: {
      de: string;
      en: string;
      es: string;
      fr: string;
    };
    mockDocumentSnapshotFactory: (
      documentSnapshot: any
    ) => jest.MockedFunction<any>;
    mockTranslate: () => jest.MockedFunction<any>;
    mockTranslateClassMethod: jest.MockedFunction<any>;
    mockTranslateClass: jest.MockedClass<any>;
    mockTranslateModule: () => jest.ModuleMocker;
    mockConsoleLog: jest.MockedFunction<any>;
    mockConsoleError: jest.MockedFunction<any>;
    mockFirestoreUpdate: jest.MockedFunction<any>;
    mockFirestoreTransaction: jest.MockedFunction<any>;
    clearMocks: () => void;
  }
}

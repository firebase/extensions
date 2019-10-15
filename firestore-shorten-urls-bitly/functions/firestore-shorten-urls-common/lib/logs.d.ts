export declare class FirestoreUrlShortenerLogger {
    protected config: object;
    constructor(config: object);
    complete(): void;
    documentCreatedNoUrl(): void;
    documentCreatedWithUrl(): void;
    documentDeleted(): void;
    documentUpdatedChangedUrl(): void;
    documentUpdatedDeletedUrl(): void;
    documentUpdatedNoUrl(): void;
    documentUpdatedUnchangedUrl(): void;
    error(err: Error): void;
    fieldNamesNotDifferent(): void;
    init(): void;
    shortenUrl(url: string): void;
    shortenUrlComplete(shortUrl: string): void;
    start(): void;
    updateDocument(path: string): void;
    updateDocumentComplete(path: string): void;
}
export declare const logs: FirestoreUrlShortenerLogger;

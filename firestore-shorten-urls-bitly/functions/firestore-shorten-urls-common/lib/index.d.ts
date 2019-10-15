import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import config from "./config";
import { FirestoreUrlShortenerLogger } from "./logs";
export { config };
export { FirestoreUrlShortenerLogger };
export declare abstract class FirestoreUrlShortener {
    protected urlFieldName: string;
    protected shortUrlFieldName: string;
    protected logs: FirestoreUrlShortenerLogger;
    constructor(urlFieldName: string, shortUrlFieldName: string);
    onDocumentWrite(change: functions.Change<admin.firestore.DocumentSnapshot>): Promise<void>;
    protected extractUrl(snapshot: admin.firestore.DocumentSnapshot): any;
    private getChangeType;
    private handleCreateDocument;
    private handleDeleteDocument;
    private handleUpdateDocument;
    protected abstract shortenUrl(snapshot: admin.firestore.DocumentSnapshot): Promise<void>;
    protected updateShortUrl(snapshot: admin.firestore.DocumentSnapshot, url: any): Promise<void>;
}

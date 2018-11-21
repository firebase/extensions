import { firestore } from "firebase-admin";
import * as path from "path";

interface AggregationPlan {
    aggregate: string,                      // a document path to store this aggregation
    isPartial: boolean,                     // is the aggregate a partial shard or the main counter
    shards: firestore.DocumentSnapshot[],   // shards to be aggregated
    partials: firestore.DocumentSnapshot[]  // partials to be aggregated
}

export class Planner {
    /**
     * Takes all the shard snapshots and creates aggregation plans.
     * @param start Beginning of document range for this worker.
     * @param snaps List of shard snapshots to aggregate.
     */
    public static planAggregations(start: string, snaps: firestore.DocumentSnapshot[]): AggregationPlan[] {
        if (snaps.length === 0) return [];     

        let result: AggregationPlan[] = [];

        let prefixLen = Planner.aggrPrefixLen(start, snaps[snaps.length - 1].ref.path);
        let [aggregate, isPartial] = Planner.constructAggregate(
            snaps[snaps.length - 1].ref.path, prefixLen);
        let shards: firestore.DocumentSnapshot[] = [];
        let partials: firestore.DocumentSnapshot[] = [];
        for (let i = snaps.length - 1; i >= 0; i--) {
        let [newAggregate, newIsPartial] = Planner.constructAggregate(snaps[i].ref.path, prefixLen);
            if (newAggregate !== aggregate) {
                shards.reverse();
                partials.reverse();
                result.push({aggregate: aggregate, isPartial: isPartial, shards: shards, partials: partials});
                aggregate = newAggregate;
                isPartial = newIsPartial;
                shards = [];
                partials = [];
            }
            if (Planner.isPartialShard(snaps[i].ref.path)) {
                partials.push(snaps[i]);
            } else {
                shards.push(snaps[i]);
            }
        }
        shards.reverse();
        partials.reverse();
        result.push({aggregate: aggregate, isPartial: isPartial, shards: shards, partials: partials});    
        result.reverse();    
        return result;
    }

    protected static constructAggregate(shard: string, prefixLen): [string, boolean] {
        if (prefixLen === 0) return [path.dirname(path.dirname(shard)), false];
    
        let collection = path.dirname(shard);
        shard = path.basename(shard);
        shard = Planner.decodeShard(shard);
    
        // Make sure we're making a progress.
        if (shard.length <= prefixLen) prefixLen--; 
    
        shard = shard.substring(0, Math.min(prefixLen, 4));
        shard = Planner.encodeShard(shard);
        return [path.join(collection, shard), true];
    }

    protected static aggrPrefixLen(start: string, end: string): number {
        if (start === '') return 0;
        if (path.dirname(start) !== path.dirname(end)) return 0;
    
        const shard1 = Planner.decodeShard(path.basename(start));
        const shard2 = Planner.decodeShard(path.basename(end));
        if (shard1.length !== shard2.length) return 0;
    
        for (let i = 0; i < Math.min(shard1.length, 4); i++) {
            if (shard1.charAt(i) !== shard2.charAt(i)) return i+1;
        }
        return 4;
    }

    protected static decodeShard(shard: string): string {
        while (shard.charAt(0) === '\t') shard = shard.substring(1);
        return shard;
    }

    protected static encodeShard(shard: string): string {
        while (shard.length < 5) shard = '\t' + shard;
        return shard;
    }

    protected static isPartialShard(shard: string): boolean {
        return path.basename(shard).charAt(0) === '\t';
    }
}










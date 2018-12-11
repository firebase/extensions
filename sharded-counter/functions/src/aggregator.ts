import { firestore } from "firebase-admin";

export class Aggregator {
  /**
   * Aggregates increments from shards and partials and returns an update object suitable for
   * DocumentRef.update() call.
   * @param counter Current snap of the main counter document. null means we aggregate to partial.
   * @param partials Shard snapshots with partial aggregations.
   * @param shards Shard snapshots with counter increments.
   * 
   * TODO: Use numeric transforms instead of array transforms for partial aggregations.
   */
  public static aggregate(
    counter: firestore.DocumentSnapshot | null,
    partials: firestore.DocumentSnapshot[],
    shards: firestore.DocumentSnapshot[]): { [key: string]: any } {
    const update = {};
    shards.forEach((shard) => {
      if (!shard.exists) return;
      const data = shard.data();
      Aggregator.mergeIntoUpdate([], data, update);
    });
    partials.forEach((partial) => {
      if (!partial.exists) return;
      const data = partial.data();
      data['_updates_'].forEach((item) => {
        for (let path in item) {
          if (path in update) {
            update[path] += item[path];
          } else {
            update[path] = item[path];
          }
        }
      });
    });
    if (counter === null) {
      // We are aggregating to a partial, append to an array of updates.
      return { '_updates_': firestore.FieldValue.arrayUnion(update) }
    } else {
      for (let key in update) update[key] += (counter.get(key) || 0);
      return update;
    }
  }

  /**
   * Appends data from a document into an update object that is suitable for DocumentRef.update()
   * call.
   * e.g.
   *   let update = {'user': 'john', 'profile.name': 'John'};
   *   mergeIntoUpdate([], {profile: {name: 'John Smith', cell: '123-456-7890'}}, update);
   *   expect(update).to.deep.equal({
   *     'user': 'john',
   *     'profile.name': 'John Smith',
   *     'profile.cell': '123-456-7890'
   *   });
   * @param field A field name stored as an array (e.g. 'stats.vists' => ['stats', 'visits'])
   * @param data A document data that needs to be merged into the update
   * @param update An object that accumulates changes.
   */
  protected static mergeIntoUpdate(field: string[], data: firestore.DocumentData,
    update: { [key: string]: any }) {
    // TODO: handle unsupported data better (e.g. arrays)
    let elem = data;
    field.forEach((key) => elem = elem[key]);
    for (let key in elem) {
      if (typeof elem[key] === 'number') {
        // TODO(patryk): figure out escaping story here.
        const path = field.concat(key).join('.')
        if (path in update) {
          update[path] += elem[key];
        } else {
          update[path] = elem[key];
        }
      } else if (typeof elem[key] === 'object') {
        Aggregator.mergeIntoUpdate(field.concat(key), data, update);
      }
    }
  }
}




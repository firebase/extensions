(function (exports) {
  'use strict';
  exports.firebasePresence = {SessionManager: SessionManager};

  function SessionManager(auth, ref) {
    if (!(this instanceof SessionManager)) {
      return new SessionManager(auth, ref);
    }

    var metadata = true;
    var databaseConnected = false;
    var user = null;
    var session = null;

    this.setMetadata = function (newMetadata) {
      if (newMetadata != null) {
        metadata = newMetadata;
      } else {
        // RTDB does not allow null/undefined as a value, so:
        metadata = true;
      }
      if (session) {
        session.updateMetadata(metadata);
      }
    };

    ref.root.child('.info/connected').on('value', function (snapshot) {
      databaseConnected = snapshot.val();
      if (session && !databaseConnected) {
        session.end();
        session = null;
      }
      createSessionIfNeeded();
    });

    auth.onAuthStateChanged(function (newUser) {
      if (session && (!newUser || newUser.uid !== user.uid)) {
        // TODO: This will stop working if we add RTDB security rules to only
        // allow a user to change their own sessions. Since they're already
        // logged out at this point, they won't have permission to even delete
        // the session. The session will then stay until network disconnection.
        session.end();
        session = null;
      }
      user = newUser;
      createSessionIfNeeded();
    });

    function createSessionIfNeeded() {
      if (!session && databaseConnected && user) {
        var sessionId = randomId();
        var sessionRef = ref.child(user.uid).child('sessions').child(sessionId);
        session = new Session(sessionRef, metadata, onSessionError);
      }
    }

    function onSessionError(err) {
      console.warn('Error updating presence', err);
      session.end();
      session = null;
      setTimeout(createSessionIfNeeded, 1000);
    }
  }

  function Session(ref, metadata, onError) {
    var setMetadataPromise = null;

    this.end = end;

    this.updateMetadata = function (newMetadata) {
      metadata = newMetadata;
      if (setMetadataPromise) {
        setMetadataPromise = setMetadataPromise.then(function () {
          var promise = ref.set(metadata);
          promise.catch(onError);
          return promise;
        });
      }
    };

    function end() {
      if (setMetadataPromise) {
        return setMetadataPromise.then(function () {
          return ref.remove().then(function() {
            setMetadataPromise = null;
            return end();
          }, onError);
        }, function() {});
      } else {
        return ref.onDisconnect().cancel().catch(onError);
      }
    };

    ref.onDisconnect().remove().then(function () {
      // onDisconnect registered!
      setMetadataPromise = ref.set(metadata);
      setMetadataPromise.catch(onError);
    }, onError);
  }

  function randomId() {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 20; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
})(this);

// DOM rendering logic specific to our sample app.

window.supView = {
  render: function(app) {
    var that = this;
    that._auth = app.auth();
    that._firestore = app.firestore();

    document.addEventListener('DOMContentLoaded', function() {
      window.mdc.autoInit();

      var sentimentEls = document.querySelectorAll('.sup-sentiment');
      [].forEach.call(sentimentEls, function (sentimentEl) {
        sentimentEl.addEventListener('click', function(e) {
          that.onUserSelectEmoji(sentimentEl.textContent);
          sentimentEls.forEach(function (el) { el.classList.remove('sup-sentiment-active'); });
          sentimentEl.classList.add('sup-sentiment-active');
        }, false);
      });
      that.onUserSelectEmoji('sentiment_satisfied_alt');

      var userTempl = document.querySelector('.sup-online .mdc-list-item');
      userTempl.parentElement.removeChild(userTempl);
      var sessionTempl = userTempl.querySelector('.sup-session');
      sessionTempl.parentElement.removeChild(sessionTempl);
      that._userTempl = userTempl;
      that._sessionTempl= sessionTempl;

      that._handleSups();
    }, false);
  },
  renderUsers: function(userById) {
    var that = this;
    var onlineUsersEl = document.querySelector('.sup-online .mdc-list');
    onlineUsersEl.innerHTML = '';
    Object.keys(userById).forEach(function(uid) {
      var sessions = userById[uid];
      var userEl = that._userTempl.cloneNode(true);
      userEl.querySelector('.sup-uid').textContent = uid;
      var sessionsEl = userEl.querySelector('.sup-sessions');
      Object.keys(sessions).forEach(function (sessionId) {
        var sessionEl = that._sessionTempl.cloneNode(true);
        sessionEl.textContent = sessions[sessionId];
        sessionsEl.appendChild(sessionEl);
      });
      userEl.addEventListener('click', function() {
        that._firestore.collection('sups').doc().set({toUid: uid});
      });
      onlineUsersEl.appendChild(userEl);
    });
  },
  _handleSups: function() {
    var that = this;

    document.querySelector('.sup-header').addEventListener('click', function() {
      document.querySelector('.sup-header').classList.remove('sup-supd');
    }, false);

    var unsubscribe = null;
    that._auth.onAuthStateChanged(function(user) {
      if (user) {
        document.querySelector('.sup-me .sup-uid').textContent = user.uid;
        that._firestore.collection('sups').where('toUid', '==', user.uid).onSnapshot(function(snap) {
          if (snap.docs.length > 0) {
            document.querySelector('.sup-header').classList.add('sup-supd');
            snap.docs.forEach(function (doc) {
              doc.ref.delete();
            });
          }
        });
      } else {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      }
    });
      var signOutButton = document.querySelector('.sup-sign-out')
      signOutButton.addEventListener('click', function() {
        that.onLogoutButtonClick();
        signOutButton.parentElement.removeChild(signOutButton);
        document.querySelector('.sup-me .sup-uid').textContent = '(Signed out. RERESH to sign back in)';
      }, false);
  },
};

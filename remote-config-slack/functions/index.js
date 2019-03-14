/*
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const rp = require('request-promise');

admin.initializeApp();

exports.showConfigDiff = functions.remoteConfig.onUpdate(versionMetadata => {
  return getAccessToken()
    .then(accessToken => getRecentTemplatesAtVersion(accessToken, versionMetadata.versionNumber))
    .then(({ previous, current }) => {
      const diff = getDiffOfTemplateParameters(previous, current);
      const message = buildDiffMessageFormattedForSlack(current.version, diff);

      return postToSlack(message);
    });
});

function buildDiffMessageFormattedForSlack(version, diff) {
  const versionNumber = `Remote config changed to version *${version.versionNumber}*. `;
  const updatedBy = "Updated by `" + version.updateUser.email + "` ";
  const updateDetail = "from `" + version.updateOrigin + "` as `" + version.updateType + "`.";

  const message = [
    versionNumber,
    updatedBy,
    updateDetail
  ];

  if (diff.added.length > 0) {
    message.push(buildDiffSection(`Added`, diff.added));
  }

  if (diff.removed.length > 0) {
    message.push(buildDiffSection(`Removed`, diff.removed));
  }

  if (diff.updated.length > 0) {
    message.push(buildDiffSection(`Updated`, diff.updated));
  }

  return message.join(`\n`);
}

function buildDiffSection(heading, list) {
  const params = list.length == 1 ? `parameter` : `parameters`;
  const header = `*${heading} ${list.length} ${params}:*`;
  const items = list.map(v => JSON.stringify(v, null, 3));

  const formattedMessage = [
    header,
    '```',
    items,
    '```'
  ].join('\n');

  return formattedMessage;
}

function getDiffOfTemplateParameters(previous, current) {
  const before = Object.keys(previous.parameters);
  const after = Object.keys(current.parameters);

  const added = after.filter(isNotInPreviousTemplate)
                  .map(name => ({ name, param : current.parameters[name] }));

  const removed = before.filter(isNotInCurrentTemplate)
                  .map(name => ({ name, param : previous.parameters[name] }));

  const updated = after.filter(isInPreviousTemplate)
                  .map(name => getTemplateDifferences(name, previous.parameters[name], current.parameters[name]))
                  .filter(v => !!v);

  return { added, removed, updated };

  function isInPreviousTemplate(name) {
    return (name in previous.parameters);
  }

  function isNotInCurrentTemplate(name) {
    return !(name in current.parameters);
  }

  function isNotInPreviousTemplate(name) {
    return !(name in previous.parameters);
  }
}

function getTemplateDifferences(name, prev, curr) {
  const diff = { name };

  fillValueDifferenceIfAny();
  fillDescriptionDifferenceIfAny();

  if (noDifferencesFound()) {
    return null;
  }

  return diff;

  function noDifferencesFound() {
    return Object.keys(diff).length === 1;
  }

  function fillDescriptionDifferenceIfAny() {
    const prevDescription = prev.description;
    const currDescription = curr.description;
    const isDescriptionDifferent = prevDescription !== currDescription;

    if (!isDescriptionDifferent) {
      return;
    }

    diff.description = {
      from: prevDescription,
      to: currDescription
    };
  }

  function fillValueDifferenceIfAny() {
    const prevValue = prev.defaultValue.value;
    const currValue = curr.defaultValue.value;
    const isValueDifferent = prevValue !== currValue;

    if (!isValueDifferent) {
      return null;
    }

    diff.value = {
      from: prevValue,
      to: currValue
    };
  }
}

function postToSlack(text) {
  const options = {
    method : 'POST',
    uri: process.env.SLACK_WEBHOOK_URL,
    json : true,
    body : {
      text,
      mrkdwn: true
    }
  };

  return rp(options);
}

function getAccessToken() {
  return admin.credential.applicationDefault().getAccessToken()
    .then(accessTokenObj => accessTokenObj.access_token);
}

function getRecentTemplatesAtVersion(accessToken, version) {
  return Promise.all([
      getTemplate(version, accessToken),
      getTemplate(version - 1, accessToken)
    ])
    .then(results => {
      const current = results[0];
      const previous = results[1];

      return { current, previous }
    });
}

function getTemplate(version, accessToken) {
  const uri = `https://firebaseremoteconfig.googleapis.com/v1/projects/${process.env.PROJECT_ID}/remoteConfig`;

  const options = {
    uri,
    qs: {
      versionNumber: version
    },
    headers: {
        Authorization: `Bearer ${accessToken}`
    },
    json: true
  };

  return rp(options);
}

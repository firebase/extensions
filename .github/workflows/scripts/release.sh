#!/bin/bash
set -e
set -o pipefail

# Uncomment for testing purposes:

#GITHUB_TOKEN=YOUR_TOKEN_HERE
#GITHUB_REPOSITORY=invertase/extensions-release-testing

# -------------------
#      Functions
# -------------------
json_escape () {
  printf '%s' "$1" | python -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

# Creates a new GitHub release
#   ARGS:
#     1: Name of the release (becomes the release title on GitHub)
#     2: Markdown body of the release
#     3: Release Git tag
create_github_release(){
  local response=''
  local release_name=$1
  local release_body=$2
  local release_tag=$3

	local body='{
	  "tag_name": "%s",
	  "target_commitish": "master",
	  "name": "%s",
	  "body": %s,
	  "draft": false,
	  "prerelease": false
	}'

  # shellcheck disable=SC2059
  body=$(printf "$body" "$release_tag" "$release_name" "$release_body")
	response=$(curl --request POST \
	  --url https://api.github.com/repos/${GITHUB_REPOSITORY}/releases \
	  --header "Authorization: Bearer $GITHUB_TOKEN" \
	  --header 'Content-Type: application/json' \
	  --data "$body" \
	  -s)

	created=$(echo "$response" | python -c "import sys, json; data = json.load(sys.stdin); print(data.get('id', sys.stdin))")
	if [ "$created" != "$response" ]; then
    echo "release created successfully"
  else
    echo "release failed to create; "
    printf "\n%s\n" "$body"
    printf "\n%s\n" "$response"
    exit 1;
  fi
}

# Updates an existing GitHub release
#   ARGS:
#     1: Name of the release (becomes the release title on GitHub)
#     2: Markdown body of the release
#     3: Release Git tag
#     4: ID of the existing release
update_github_release(){
  local response=''
  local release_name=$1
  local release_body=$2
  local release_tag=$3
  local release_id=$4

	local body='{
	  "tag_name": "%s",
	  "target_commitish": "master",
	  "name": "%s",
	  "body": %s,
	  "draft": false,
	  "prerelease": false
	}'

  # shellcheck disable=SC2059
  body=$(printf "$body" "$release_tag" "$release_name" "$release_body")
	response=$(curl --request PATCH \
	  --url "https://api.github.com/repos/$GITHUB_REPOSITORY/releases/$release_id" \
	  --header "Authorization: Bearer $GITHUB_TOKEN" \
	  --header 'Content-Type: application/json' \
	  --data "$body" \
	  -s)

	updated=$(echo "$response" | python -c "import sys, json; data = json.load(sys.stdin); print(data.get('id', sys.stdin))")
	if [ "$updated" != "$response" ]; then
    echo "release updated successfully"
  else
    echo "release failed to update; "
    printf "\n%s\n" "$body"
    printf "\n%s\n" "$response"
    exit 1;
  fi
}

# Creates or updates a GitHub release
#   ARGS:
#     1: Extension name
#     2: Extension version
#     3: Markdown body to use for the release
create_or_update_github_release() {
  local response=''
  local release_id=''
  local extension_name=$1
  local extension_version=$2
  local release_body=$3
  local release_tag="$extension_name-$extension_version"
  local release_name="$extension_name $extension_version"

  response=$(curl --request GET \
    --url "https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/tags/${release_tag}" \
    --header "Authorization: Bearer $GITHUB_TOKEN" \
    --header 'Content-Type: application/json' \
    --data "$body" \
    -s)

  release_id=$(echo "$response" | python -c "import sys, json; data = json.load(sys.stdin); print(data.get('id', 'Not Found'))")
  if [ "$release_id" != "Not Found" ]; then
    echo "Existing release (${release_id}) found for $release_tag - updating it ... "
    update_github_release "$release_name" "$release_body" "$release_tag" "$release_id"
  else
    response_message=$(echo "$response" | python -c "import sys, json; data = json.load(sys.stdin); print(data.get('message', 'OK'))")
    if [ "$response_message" != "OK" ]; then
      echo "Failed to create/update release '$release_name' -> GitHub API request failed with response: $response_message"
      echo "$response"
      exit 1;
    else
      echo "Creating new release '$release_tag' ... "
      create_github_release "$release_name" "$release_body" "$release_tag"
    fi
  fi
}

# -------------------
#    Main Script
# -------------------

# Ensure that the GITHUB_TOKEN env variable is defined
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Missing required GITHUB_TOKEN env variable. Set this on the workflow action or on your local environment."
  exit 1
fi

# Ensure that the GITHUB_REPOSITORY env variable is defined
if [[ -z "$GITHUB_REPOSITORY" ]]; then
  echo "Missing required GITHUB_REPOSITORY env variable. Set this on the workflow action or on your local environment."
  exit 1
fi

if [[ $(git branch | grep "^*" | awk '{print $2}') != "master" ]]; then
  # Find all extensions based on whether a extension.yaml file exists in the directory
  for i in $(find . -type f -name 'extension.yaml' -exec dirname {} \; | sort -u); do
    # Pluck extension name from directory name
    extension_name=$(echo "$i" | sed "s/\.\///")
    # Pluck extension latest version from yaml file
    extension_version=$(awk '/^version: /' "$i/extension.yaml" | sed "s/version: //")
    # Pluck out change log contents for the latest extension version
    changelog_contents=$(awk -v ver="$extension_version" '/^## Version / { if (p) { exit }; if ($3 == ver) { p=1; next} } p && NF' "$i/CHANGELOG.md")
    # JSON escape the markdown content for the release body
    changelog_contents=$(json_escape "$changelog_contents")
    # Creates a new release if it does not exist
    #   OR
    # Updates an existing release with updated content (allows updating CHANGELOG.md which will update relevant release body)
    create_or_update_github_release "$extension_name" "$extension_version" "$changelog_contents"
  done
else
	echo "This action can only run on 'master' branch."
	exit 0
fi

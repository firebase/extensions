This Mod installs `${FUNCTION_NAME_TRANSLATE}` located in `${FUNCTION_LOCATION_TRANSLATE}`.

The Mod will automatically translate messages in the format:
`{"message": "Your message contents go here."}`

created under the following path:
`/messages/ORIGINAL_LANGUAGE_CODE`, where ORIGINAL_LANGUAGE_CODE is the ISO-639-1 code.

Example usage, with languages en,pt,ko, and the original language as English:

```
firebase database:push /messages/en --data '{"message": "I like to eat cake"}'
firebase database:push /messages/en --data '{"message": "Good morning! Good night."}'
```

This will create database entries in the following format. Note that the IDs for
each message under a language are automatically generated.

```
{
  "en": {
    "messageID1": {
      "message": "Good morning! Good night.",
      "translated": true
    },
    "messageID2": {
      "message": "I like to eat cake.",
      "translated": true
    },
  },
  "ko": {
    "messageID1": {
      "message": "좋은 아침! 안녕히 주무세요.",
      "translated": true
    },
    "messageID2": {
      "message": "나는 케이크를 먹기를 좋아한다.",
      "translated": true
    },
  },
  "pt": {
    "messageID1": {
      "message": "Bom Dia! Boa noite.",
      "translated": true
    },
    "messageID2": {
      "message": "Eu gosto de comer bolo",
      "translated": true
    },
  }
}
```

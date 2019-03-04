This Mod installs `${FUNCTION_NAME_TRANSLATE}` located in `${FUNCTION_LOCATION_TRANSLATE}`

Example usage, with languages en,pt,ko
```
translate({after: {message: "I like to eat cake"}}, {params: {languageID: 'en'}})
translate({after: {message: "Good morning! Good night."}}, {params: {languageID: 'en'}})
```

This will create database entries in the following format:

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

This mod takes two environment variables - `MAX_COUNT`, which is the maximum
number of database items to retain, and `PARENT_NODE_PATH`, which is the
path we want this mod to operate on.

For example, given a chat application with the following data structure:

```
/functions-project-12345
    /chat
        /key-123456
            user: "Mat",
            text: "Hey Bob!"
        /key-123457
            user: "Bob",
            text: "Hey Mat! What's Up?"
```

`PARENT_NODE_PATH` can be defined as `/chat/{message_id}`. Every time a new
chat message is added, the Function counts the number of chat messages and
removes the old ones if there are too many.

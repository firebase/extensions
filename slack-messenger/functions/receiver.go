package receiver

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// PubSubMessage represents a PubSub message from GCP.
type PubSubMessage struct {
	Data []byte `json:"data"`
}

// SlackMessageSender receives PubSub messages and sends the contents to the
// appropriate slack webhook.
// Returning an error in this handler may cause performance issues as it causes
// the function to be restarted. However, if it the function is configured to
// retry on an error, it will retry if an error is returned (do not configure
// this function to do so as messages could be indefinitely repeated).
func SlackMessageSender(ctx context.Context, m PubSubMessage) error {
	log.Printf("Received message %q", m.Data)

	sURL := os.Getenv("SLACK_WEBHOOK_URL")
	if sURL == "" {
		log.Printf("No SLACK_WEBHOOK_URL is defined, not sending anything.")
		return nil
	}

	j := map[string]string{"text": string(m.Data)}
	v, err := json.Marshal(j)
	if err != nil {
		log.Printf("Failed to marshal message %q to JSON: %s", m.Data, err)
		log.Print("Not sending anything to Slack.")
		return nil
	}
	log.Print("Sending to Slack...")
	_, err = http.Post(sURL, "application/json", bytes.NewBuffer(v))
	if err != nil {
		log.Printf("Failed to call Slack: %s", err)
		// Consider this function unhealthy if any HTTP error occures - return the
		// error.
		return err
	}
	log.Print("Message sent!")

	return nil
}

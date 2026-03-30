package main

import "fmt"
import "net/http"
import "encoding/json"
import "github.com/redis/go-redis/v9"
import "context"
import "os"



type GameEvent struct {
	ID        string `json:"id"`
	DeviceID  string `json:"deviceId"`
	SessionID string `json:"sessionId,omitempty"`
	UserID    string `json:"userId,omitempty"`
	Category  string `json:"eventCategory"`
	Timestamp int64  `json:"timestamp"`
	GameID    string `json:"gameId,omitempty"`
	Type      string `json:"type,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}
type IngestRequest struct {
	Events []GameEvent `json:"events"`
}


func main() {
	fmt.Println("Ingestor service started");
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
    	addr = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	ctx := context.Background()
	http.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		fmt.Printf("Received request: %s %s\n", r.Method, r.URL.Path);
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req IngestRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		for _, event := range req.Events {
			fmt.Printf("Received event: %+v\n", event);
			eventJSON, err := json.Marshal(event)

			if err != nil {
				fmt.Printf("Error encoding event: %v\n", err);
				continue
			}
			if err := rdb.LPush(ctx, "events:queue", eventJSON).Err(); err != nil {
				fmt.Printf("Error pushing event to Redis: %v\n", err);
			}
		}

		w.WriteHeader(http.StatusAccepted);
		fmt.Fprintln(w, "Event received and being processed");
	});
	http.ListenAndServe(":3002", nil);
}
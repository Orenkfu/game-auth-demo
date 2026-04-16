package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/redis/go-redis/v9"
)

func ingestHandler(rdb *redis.Client, ctx context.Context) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

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
			eventJSON, err := json.Marshal(event)
			if err != nil {
				fmt.Printf("Error encoding event: %v\n", err)
				continue
			}
			if err := rdb.LPush(ctx, "events:queue", eventJSON).Err(); err != nil {
				fmt.Printf("Error pushing event to Redis: %v\n", err)
			}
		}

		w.WriteHeader(http.StatusAccepted)
	}
}

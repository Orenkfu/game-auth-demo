package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

func startConsumer(ctx context.Context, rdb *redis.Client, db *sql.DB) {
	log.Println("Consumer started, waiting for events...")

	for {
		result, err := rdb.BRPop(ctx, 5*time.Second, "events:queue").Result()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("Redis error: %v", err)
			time.Sleep(time.Second)
			continue
		}

		// result is [key, value]
		raw := result[1]

		var event GameEvent
		if err := json.Unmarshal([]byte(raw), &event); err != nil {
			log.Printf("Failed to parse event: %v", err)
			continue
		}

		if err := insertEvent(db, event); err != nil {
			log.Printf("Failed to insert event %s: %v", event.ID, err)
			continue
		}

		updateUserTraits(db, event)
		log.Printf("Processed: %s [%s] game=%s user=%s", event.Type, event.EventCategory, event.GameID, event.UserID)
	}
}

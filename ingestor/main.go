package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/redis/go-redis/v9"
)

func main() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{Addr: addr})
	ctx := context.Background()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis at %s: %v", addr, err)
	}
	log.Printf("Ingestor service started, connected to Redis at %s", addr)

	http.HandleFunc("/ingest", ingestHandler(rdb, ctx))
	log.Fatal(http.ListenAndServe(":3002", nil))
}

package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/redis/go-redis/v9"
)

func main() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	dbPath := os.Getenv("DUCKDB_PATH")
	if dbPath == "" {
		dbPath = "events.duckdb"
	}

	rdb := redis.NewClient(&redis.Options{ Addr: redisAddr })
	ctx, cancel := context.WithCancel(context.Background())

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis at %s: %v", redisAddr, err)
	}
	log.Printf("Connected to Redis at %s", redisAddr)

	db, err := initDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to init DuckDB at %s: %v", dbPath, err)
	}
	defer db.Close()
	log.Printf("DuckDB initialized at %s", dbPath)

	go startConsumer(ctx, rdb, db)
	go startQueryServer(db)
	log.Println("Query server started on :3003")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	cancel()
}

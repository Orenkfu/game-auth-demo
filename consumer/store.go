package main

import (
	"database/sql"
	"encoding/json"
	"log"

	_ "github.com/marcboeker/go-duckdb"
)

func initDB(path string) (*sql.DB, error) {
	db, err := sql.Open("duckdb", path)
	if err != nil {
		return nil, err
	}

	if _, err = db.Exec("INSTALL json; LOAD json;"); err != nil {
		return nil, err
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS events (
			id            VARCHAR PRIMARY KEY,
			device_id     VARCHAR NOT NULL,
			session_id    VARCHAR,
			user_id       VARCHAR,
			event_category VARCHAR NOT NULL,
			type          VARCHAR NOT NULL,
			game_id       VARCHAR,
			timestamp     BIGINT NOT NULL,
			metadata      JSON
		)
	`)
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS user_traits (
			user_id           VARCHAR PRIMARY KEY,
			device_id         VARCHAR NOT NULL,
			games_played      JSON,
			total_matches     INTEGER DEFAULT 0,
			matches_last_7d   INTEGER DEFAULT 0,
			last_active_at    BIGINT,
			updated_at        BIGINT
		)
	`)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func insertEvent(db *sql.DB, e GameEvent) error {
	metadataJSON, err := json.Marshal(e.Metadata)
	if err != nil {
		metadataJSON = []byte("{}")
	}

	_, err = db.Exec(`
		INSERT OR IGNORE INTO events
			(id, device_id, session_id, user_id, event_category, type, game_id, timestamp, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, e.ID, e.DeviceID, e.SessionID, e.UserID, e.EventCategory, e.Type, e.GameID, e.Timestamp, string(metadataJSON))
	return err
}

func updateUserTraits(db *sql.DB, e GameEvent) {
	if e.UserID == "" && e.DeviceID == "" {
		return
	}

	id := e.UserID
	if id == "" {
		id = e.DeviceID
	}

	switch e.Type {
	case "match_started":
		_, err := db.Exec(`
			INSERT INTO user_traits (user_id, device_id, total_matches, last_active_at, updated_at)
			VALUES (?, ?, 1, ?, epoch_ms(current_timestamp))
			ON CONFLICT (user_id) DO UPDATE SET
				total_matches   = user_traits.total_matches + 1,
				last_active_at  = excluded.last_active_at,
				updated_at      = excluded.updated_at
		`, id, e.DeviceID, e.Timestamp)
		if err != nil {
			log.Printf("Failed to update traits on match_started: %v", err)
		}

	case "game_opened":
		if e.GameID == "" {
			return
		}
		_, err := db.Exec(`
			INSERT INTO user_traits (user_id, device_id, games_played, last_active_at, updated_at)
			VALUES (?, ?, json_array(?), ?, epoch_ms(current_timestamp))
			ON CONFLICT (user_id) DO UPDATE SET
				games_played   = CASE
					WHEN json_contains(user_traits.games_played, ?) THEN user_traits.games_played
					ELSE json_insert(user_traits.games_played, '$[#]', ?)
				END,
				last_active_at = excluded.last_active_at,
				updated_at     = excluded.updated_at
		`, id, e.DeviceID, e.GameID, e.Timestamp, e.GameID, e.GameID)
		if err != nil {
			log.Printf("Failed to update traits on game_opened: %v", err)
		}
	}
}

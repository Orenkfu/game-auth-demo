package main

type GameEvent struct {
	ID        string                 `json:"id"`
	DeviceID  string                 `json:"deviceId"`
	SessionID string                 `json:"sessionId,omitempty"`
	UserID    string                 `json:"userId,omitempty"`
	Category  string                 `json:"eventCategory"`
	Timestamp int64                  `json:"timestamp"`
	GameID    string                 `json:"gameId,omitempty"`
	Type      string                 `json:"type,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type IngestRequest struct {
	Events []GameEvent `json:"events"`
}

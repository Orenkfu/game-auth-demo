package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func startQueryServer(db *sql.DB) {
	http.HandleFunc("/query", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")

		query := r.URL.Query().Get("sql")
		if query == "" {
			http.Error(w, "missing ?sql= parameter", http.StatusBadRequest)
			return
		}

		rows, err := db.Query(query)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		var results []map[string]any
		for rows.Next() {
			values := make([]any, len(cols))
			valuePtrs := make([]any, len(cols))
			for i := range values {
				valuePtrs[i] = &values[i]
			}
			if err := rows.Scan(valuePtrs...); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			row := make(map[string]any, len(cols))
			for i, col := range cols {
				row[col] = values[i]
			}
			results = append(results, row)
		}

		if results == nil {
			results = []map[string]any{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(results)
	})

	http.ListenAndServe(":3003", nil)
}

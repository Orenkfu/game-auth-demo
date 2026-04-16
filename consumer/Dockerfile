FROM golang:1.26 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o consumer .

FROM golang:1.26
WORKDIR /app
COPY --from=builder /app/consumer .
VOLUME ["/data"]
ENV DUCKDB_PATH=/data/events.duckdb
CMD ["./consumer"]
